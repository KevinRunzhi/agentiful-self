/**
 * Chat Execution Routes (S1-3)
 *
 * OpenAI-compatible execution entry:
 * - POST /v1/chat/completions
 *
 * Flow:
 * - Phase 1: pre-check quota before execution start
 * - Phase 2: async deduct quota after completion
 */

import { getDatabase } from "@agentifui/db/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  markQuotaServiceDegraded,
  markQuotaServiceHealthy,
} from "../../../middleware/quota-guard.js";
import { auditService } from "../../auth/services/audit.service.js";
import { createNotificationService } from "../../notifications/services/notification.service";
import { createQuotaRepository } from "../repositories/quota.repository";
import { createQuotaAlertService } from "../services/quota-alert.service";
import { createQuotaAlertDedupeStore } from "../services/quota-alert-dedupe.store";
import {
  InvalidActiveGroupError,
  resolveQuotaAttributionGroupId,
} from "../services/quota-attribution.service";
import { createQuotaCheckService } from "../services/quota-check.service";
import { QuotaDeductExceededError, createQuotaDeductService } from "../services/quota-deduct.service";

type MeteringMode = "token" | "request";

interface ChatMessagePayload {
  role?: string;
  content?: string;
}

interface ChatCompletionRequestBody {
  tenantId?: string;
  userId?: string;
  groupId?: string | null;
  appId?: string;
  model?: string;
  meteringMode?: MeteringMode;
  estimatedUsage?: number;
  promptTokens?: number;
  completionTokens?: number;
  maxTokens?: number;
  messages?: ChatMessagePayload[];
}

const QUOTA_CHECK_TIMEOUT_MS = 2_000;
const quotaAlertDedupeStore = createQuotaAlertDedupeStore();

class QuotaCheckTimeoutError extends Error {
  constructor() {
    super("Quota check exceeded timeout");
    this.name = "QuotaCheckTimeoutError";
  }
}

function getRequestDb(request: FastifyRequest): unknown {
  const dbFromRequest = (request as { db?: unknown }).db;
  const dbFromServer = (request.server as { db?: unknown }).db;
  if (dbFromRequest || dbFromServer) {
    return dbFromRequest ?? dbFromServer;
  }

  try {
    return getDatabase();
  } catch {
    return undefined;
  }
}

function getHeaderString(
  request: FastifyRequest,
  headerName: string
): string | undefined {
  const value = request.headers[headerName.toLowerCase()];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

function quotaExceededReply(
  reply: FastifyReply,
  detail: {
    scope: string;
    used: number;
    limit: number;
    resetsAt: string;
  } | null,
  traceId: string
) {
  return reply.status(403).send({
    error: {
      type: "permission_denied",
      code: "quota_exceeded",
      message: detail ? `Quota exceeded at ${detail.scope} scope` : "Quota exceeded",
      trace_id: traceId,
    },
    level: detail?.scope ?? "unknown",
    current: detail?.used ?? null,
    limit: detail?.limit ?? null,
    resetsAt: detail?.resetsAt ?? null,
  });
}

function quotaUnavailableReply(reply: FastifyReply, traceId: string, message?: string) {
  return reply.status(503).send({
    error: {
      type: "service_unavailable",
      code: "quota_service_unavailable",
      message: message || "Quota service unavailable",
      trace_id: traceId,
    },
  });
}

function badRequestReply(reply: FastifyReply, traceId: string, message: string) {
  return reply.status(400).send({
    error: {
      type: "invalid_request_error",
      code: "invalid_request",
      message,
      trace_id: traceId,
    },
  });
}

function invalidActiveGroupReply(reply: FastifyReply, traceId: string) {
  return reply.status(400).send({
    error: {
      type: "invalid_request_error",
      code: "invalid_active_group",
      message: "Provided active group is not valid for this user and tenant",
      trace_id: traceId,
    },
  });
}

function estimatePromptTokens(body: ChatCompletionRequestBody): number {
  const explicit = typeof body.promptTokens === "number" ? Math.max(0, body.promptTokens) : null;
  if (explicit !== null) {
    return explicit;
  }

  const text = (body.messages ?? [])
    .map((msg) => (typeof msg.content === "string" ? msg.content : ""))
    .join("\n");

  if (!text) {
    return 1;
  }

  return Math.max(1, Math.ceil(text.length / 4));
}

function estimateCompletionTokens(body: ChatCompletionRequestBody, mode: MeteringMode): number {
  if (mode === "request") {
    return 0;
  }

  if (typeof body.completionTokens === "number") {
    return Math.max(0, body.completionTokens);
  }

  if (typeof body.maxTokens === "number" && Number.isFinite(body.maxTokens)) {
    return Math.max(16, Math.min(1024, Math.floor(body.maxTokens)));
  }

  return 64;
}

function resolveMeteringMode(mode: unknown): MeteringMode {
  return mode === "request" ? "request" : "token";
}

function resolveEstimatedUsage(
  body: ChatCompletionRequestBody,
  meteringMode: MeteringMode,
  promptTokens: number
): number {
  if (typeof body.estimatedUsage === "number" && Number.isFinite(body.estimatedUsage)) {
    return Math.max(0, body.estimatedUsage);
  }

  if (meteringMode === "request") {
    return 1;
  }

  return Math.max(1, promptTokens);
}

async function withQuotaTimeout<T>(promise: Promise<T>): Promise<T> {
  const timeout = new Promise<T>((_, reject) => {
    setTimeout(() => reject(new QuotaCheckTimeoutError()), QUOTA_CHECK_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]);
}

async function notifyTenantAdminsOnDegradedQuota(
  request: FastifyRequest,
  tenantId: string,
  reason: string
): Promise<void> {
  try {
    const db = getRequestDb(request);
    if (!db) {
      return;
    }

    const quotaRepository = createQuotaRepository(db as any);
    const notificationService = createNotificationService(db as any);
    const adminIds = await quotaRepository.listTenantAdminUserIds(tenantId);
    const createdAt = new Date();

    for (const adminId of adminIds) {
      await notificationService.create({
        tenantId,
        recipientId: adminId,
        type: "system",
        title: "Quota service degraded",
        content: "Quota check is temporarily unavailable. New executions are blocked.",
        createdAt,
        traceId: request.id,
        metadata: {
          reason,
          source: "chat_completions",
        },
      });
    }
  } catch {
    // Skip notification failures to avoid blocking request flow.
  }
}

async function resolveQuotaAlertRecipients(
  quotaRepository: ReturnType<typeof createQuotaRepository>,
  event: {
    tenantId: string;
    scope: "tenant" | "group" | "user";
    scopeId?: string;
    threshold: number;
    userId?: string;
    groupId?: string | null;
  }
): Promise<string[]> {
  const recipients = new Set<string>();

  if (event.scope === "user") {
    if (event.userId) {
      recipients.add(event.userId);
    }

    if (event.threshold >= 90 && event.groupId) {
      const managerIds = await quotaRepository.listGroupManagerUserIds(event.tenantId, event.groupId);
      for (const managerId of managerIds) {
        recipients.add(managerId);
      }
    }

    if (event.threshold >= 100) {
      const tenantAdminIds = await quotaRepository.listTenantAdminUserIds(event.tenantId);
      for (const adminId of tenantAdminIds) {
        recipients.add(adminId);
      }
    }
  }

  if (event.scope === "group") {
    const targetGroupId = event.scopeId ?? event.groupId ?? null;
    if (targetGroupId) {
      const managerIds = await quotaRepository.listGroupManagerUserIds(event.tenantId, targetGroupId);
      for (const managerId of managerIds) {
        recipients.add(managerId);
      }
    }

    if (event.threshold >= 90) {
      const tenantAdminIds = await quotaRepository.listTenantAdminUserIds(event.tenantId);
      for (const adminId of tenantAdminIds) {
        recipients.add(adminId);
      }
    }
  }

  if (event.scope === "tenant") {
    const tenantAdminIds = await quotaRepository.listTenantAdminUserIds(event.tenantId);
    for (const adminId of tenantAdminIds) {
      recipients.add(adminId);
    }
  }

  return [...recipients];
}

async function chatCompletions(
  request: FastifyRequest<{ Body: ChatCompletionRequestBody }>,
  reply: FastifyReply
): Promise<void> {
  const traceId = request.id;
  const body = request.body ?? {};
  const requestUser = (request as unknown as { user?: { id?: string } }).user;
  const tenantId = body.tenantId ?? getHeaderString(request, "x-tenant-id");
  const userId = body.userId ?? requestUser?.id ?? getHeaderString(request, "x-user-id");
  const requestedGroupId = body.groupId ?? getHeaderString(request, "x-active-group-id");
  const appId = body.appId ?? "chat.completions";
  const model = body.model ?? "gpt-4.1-mini";

  if (!tenantId || !userId) {
    return badRequestReply(reply, traceId, "tenantId and userId are required");
  }

  try {
    const db = getRequestDb(request);
    if (!db) {
      markQuotaServiceDegraded(request.server, "Database context unavailable", "chat_completions");
      await notifyTenantAdminsOnDegradedQuota(request, tenantId, "database_context_unavailable");
      return quotaUnavailableReply(reply, traceId);
    }

    const quotaRepository = createQuotaRepository(db as any);
    const quotaCheckService = createQuotaCheckService(quotaRepository);

    let attribution;
    try {
      attribution = await resolveQuotaAttributionGroupId(quotaRepository, {
        tenantId,
        userId,
        appId,
        requestedGroupId,
      });
    } catch (error) {
      if (error instanceof InvalidActiveGroupError) {
        return invalidActiveGroupReply(reply, traceId);
      }
      throw error;
    }

    const meteringMode = resolveMeteringMode(body.meteringMode);
    const promptTokens = estimatePromptTokens(body);
    const completionTokens = estimateCompletionTokens(body, meteringMode);
    const estimatedUsage = resolveEstimatedUsage(body, meteringMode, promptTokens);

    const checkResult = await withQuotaTimeout(
      quotaCheckService.check({
        tenantId,
        groupId: attribution.groupId,
        userId,
        appId,
        meteringMode,
        estimatedUsage,
        traceId,
      })
    );

    if (!checkResult.allowed) {
      await auditService.logFailure(
        {
          tenantId,
          actorUserId: userId,
          actorType: "user",
          action: "gov.quota.exceeded",
          resourceType: "quota_policy",
          resourceId: checkResult.exceededScope ?? "unknown",
          traceId,
          metadata: {
            scope: checkResult.exceededScope ?? "unknown",
            attributionGroupId: attribution.groupId,
            attributionSource: attribution.source,
            limits: checkResult.limits,
          },
        },
        `Quota exceeded at ${checkResult.exceededScope ?? "unknown"} scope`
      );

      return quotaExceededReply(
        reply,
        checkResult.exceededDetail
          ? {
              scope: checkResult.exceededDetail.scope,
              used: checkResult.exceededDetail.used,
              limit: checkResult.exceededDetail.limit,
              resetsAt: checkResult.exceededDetail.resetsAt,
            }
          : null,
        traceId
      );
    }

    markQuotaServiceHealthy(request.server, "chat_completions");

    const totalTokens = promptTokens + completionTokens;
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const createdAt = Math.floor(Date.now() / 1000);

    // Deduct asynchronously after response is generated to mimic run.completed event consumption.
    void Promise.resolve().then(async () => {
      const notificationService = createNotificationService(db as any);
      const quotaAlertService = createQuotaAlertService(quotaRepository, {
        dedupeStore: quotaAlertDedupeStore,
        notificationDispatcher: {
          dispatch: async (event) => {
            const recipients = await resolveQuotaAlertRecipients(quotaRepository, {
              tenantId: event.tenantId,
              scope: event.scope,
              scopeId: event.scopeId,
              threshold: event.threshold,
              userId: event.userId,
              groupId: event.groupId,
            });

            for (const recipientId of recipients) {
              await notificationService.create({
                type: event.threshold >= 100 ? "quota_exceeded" : "quota_warning",
                tenantId: event.tenantId,
                recipientId,
                createdAt: new Date(),
                isRead: false,
                traceId: event.traceId,
                title: event.threshold >= 100 ? "Quota exceeded" : "Quota warning",
                content:
                  event.threshold >= 100
                    ? `Quota exceeded at ${event.scope} scope`
                    : `Quota usage reached ${event.threshold}% at ${event.scope} scope`,
                metadata: {
                  policyId: event.policyId,
                  scope: event.scope,
                  scopeId: event.scopeId,
                  threshold: event.threshold,
                  usedValue: event.usedValue,
                  limitValue: event.limitValue,
                  periodStart: event.periodStart.toISOString(),
                  periodEnd: event.periodEnd?.toISOString() ?? null,
                  userId: event.userId,
                  groupId: event.groupId ?? null,
                  appId: event.appId,
                },
              });
            }
          },
        },
        auditLogger: {
          log: async (event) => {
            const action = event.threshold >= 100 ? "gov.quota.exceeded" : "gov.quota.warning";
            await auditService.logSuccess({
              tenantId: event.tenantId,
              actorUserId: event.userId,
              actorType: event.userId ? "user" : "system",
              action,
              resourceType: "quota_policy",
              resourceId: event.policyId,
              traceId: event.traceId,
              metadata: {
                threshold: event.threshold,
                scope: event.scope,
                scopeId: event.scopeId,
                usedValue: event.usedValue,
                limitValue: event.limitValue,
                periodStart: event.periodStart.toISOString(),
                periodEnd: event.periodEnd?.toISOString() ?? null,
                appId: event.appId,
              },
            });
          },
        },
      });

      const quotaDeductService = createQuotaDeductService(quotaRepository, quotaAlertService);
      try {
        await quotaDeductService.deduct({
          tenantId,
          groupId: attribution.groupId,
          userId,
          appId,
          runId,
          model,
          meteringMode,
          promptTokens,
          completionTokens,
          traceId,
        });
      } catch (error) {
        if (error instanceof QuotaDeductExceededError) {
          await auditService.logFailure(
            {
              tenantId,
              actorUserId: userId,
              actorType: "user",
              action: "gov.quota.deduct_failed",
              resourceType: "quota_policy",
              resourceId: error.scope,
              traceId,
              metadata: {
                scope: error.scope,
                current: error.used,
                limit: error.limit,
                resetsAt: error.resetsAt.toISOString(),
                runId,
              },
            },
            error.message
          );
          return;
        }

        const errorMessage = error instanceof Error ? error.message : "Quota deduct failed";
        await auditService.logFailure(
          {
            tenantId,
            actorUserId: userId,
            actorType: "user",
            action: "gov.quota.deduct_failed",
            resourceType: "quota_policy",
            resourceId: "unknown",
            traceId,
            metadata: {
              runId,
              message: errorMessage,
            },
          },
          errorMessage
        );
      }
    });

    return reply.status(200).send({
      id: `chatcmpl_${Date.now()}`,
      object: "chat.completion",
      created: createdAt,
      model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "S1-3 execution entry placeholder response.",
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
      },
      run: {
        id: runId,
        status: "completed",
      },
      quota: {
        meteringMode,
        attribution: {
          groupId: attribution.groupId,
          source: attribution.source,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quota execution failed";
    markQuotaServiceDegraded(request.server, message, "chat_completions");
    if (error instanceof QuotaCheckTimeoutError) {
      await notifyTenantAdminsOnDegradedQuota(request, tenantId, "quota_check_timeout");
    }
    return quotaUnavailableReply(reply, traceId, message);
  }
}

export async function registerChatExecutionRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{
    Body: ChatCompletionRequestBody;
  }>("/chat/completions", chatCompletions);
}
