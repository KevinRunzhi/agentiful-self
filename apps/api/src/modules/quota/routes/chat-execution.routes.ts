/**
 * Gateway Chat Execution Routes (S2-1)
 *
 * OpenAI-compatible entrypoints:
 * - GET /v1/models
 * - POST /v1/chat/completions
 * - POST /v1/chat/completions/:taskId/stop
 */

import { randomUUID } from "node:crypto";
import { getDatabase } from "@agentifui/db/client";
import { app as appTable } from "@agentifui/db/schema/rbac";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  markQuotaServiceDegraded,
  markQuotaServiceHealthy,
} from "../../../middleware/quota-guard.js";
import { auditService } from "../../auth/services/audit.service.js";
import { createNotificationService } from "../../notifications/services/notification.service";
import { createAppService } from "../../rbac/services/app.service.js";
import {
  GatewayError,
  ServiceDegradedError,
  buildGatewayErrorResponse,
  toGatewayError,
} from "../../gateway/errors.js";
import { resolveGatewayAppIntegrationConfig } from "../../gateway/services/app-config.service.js";
import { createPlatformAdapterRegistry } from "../../gateway/services/platform-adapter-registry.js";
import { platformHealthStore } from "../../gateway/services/platform-health.store.js";
import { sessionMappingStore } from "../../gateway/services/session-mapping.store.js";
import type {
  GatewayChatMessage,
  GatewayChatRequestInput,
  GatewayCompletionResult,
  GatewayUsage,
  SupportedPlatform,
} from "../../gateway/types.js";
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
  content?: string | Array<{ type?: string; text?: string }>;
}

interface ChatCompletionRequestBody {
  tenantId?: string;
  userId?: string;
  groupId?: string | null;
  appId?: string;
  app_id?: string;
  model?: string;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  maxTokens?: number;
  tools?: unknown[];
  conversation_id?: string;
  meteringMode?: MeteringMode;
  estimatedUsage?: number;
  promptTokens?: number;
  completionTokens?: number;
  messages?: ChatMessagePayload[];
}

interface StopGenerationBody {
  tenantId?: string;
  userId?: string;
  groupId?: string | null;
  appId?: string;
  app_id?: string;
  model?: string;
  conversation_id?: string;
}

interface ResolvedGatewayApp {
  id: string;
  tenantId: string;
  name: string;
  mode: string;
  status: string;
  enableApi: boolean;
  externalPlatform: string | null;
  config: Record<string, unknown>;
}

const QUOTA_CHECK_TIMEOUT_MS = 2_000;
const quotaAlertDedupeStore = createQuotaAlertDedupeStore();
const adapterRegistry = createPlatformAdapterRegistry();

class QuotaCheckTimeoutError extends Error {
  constructor() {
    super("Quota check exceeded timeout");
    this.name = "QuotaCheckTimeoutError";
  }
}

function getRequestDb(request: FastifyRequest): PostgresJsDatabase | null {
  const dbFromRequest = (request as { db?: unknown }).db;
  const dbFromServer = (request.server as { db?: unknown }).db;
  if (dbFromRequest || dbFromServer) {
    return (dbFromRequest ?? dbFromServer) as PostgresJsDatabase;
  }

  try {
    return getDatabase() as PostgresJsDatabase;
  } catch {
    return null;
  }
}

function getHeaderString(request: FastifyRequest, headerName: string): string | undefined {
  const value = request.headers[headerName.toLowerCase()];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

function resolveTenantId(
  request: FastifyRequest,
  body: { tenantId?: string }
): string | undefined {
  return body.tenantId ?? getHeaderString(request, "x-tenant-id");
}

function resolveUserId(
  request: FastifyRequest,
  body: { userId?: string }
): string | undefined {
  const requestUser = (request as unknown as { user?: { id?: string } }).user;
  return body.userId ?? requestUser?.id ?? getHeaderString(request, "x-user-id");
}

function resolveAppId(body: ChatCompletionRequestBody | StopGenerationBody): string {
  const candidate = body.appId ?? body.app_id ?? body.model;
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    throw new GatewayError({
      statusCode: 400,
      type: "invalid_request_error",
      code: "invalid_request",
      message: "model (or appId) is required",
      param: "model",
    });
  }
  return candidate.trim();
}

function resolveMeteringMode(mode: unknown): MeteringMode {
  return mode === "request" ? "request" : "token";
}

function extractMessageText(message: ChatMessagePayload): string {
  const { content } = message;
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n");
}

function estimatePromptTokens(body: ChatCompletionRequestBody, normalizedMessages: GatewayChatMessage[]): number {
  const explicit = typeof body.promptTokens === "number" ? Math.max(0, Math.floor(body.promptTokens)) : null;
  if (explicit !== null) {
    return explicit;
  }

  const text = normalizedMessages.map((message) => message.content).join("\n");
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
    return Math.max(0, Math.floor(body.completionTokens));
  }

  const maxTokens = body.max_tokens ?? body.maxTokens;
  if (typeof maxTokens === "number" && Number.isFinite(maxTokens)) {
    return Math.max(16, Math.min(1024, Math.floor(maxTokens)));
  }

  return 64;
}

function resolveEstimatedUsage(
  body: ChatCompletionRequestBody,
  meteringMode: MeteringMode,
  promptTokens: number
): number {
  if (typeof body.estimatedUsage === "number" && Number.isFinite(body.estimatedUsage)) {
    return Math.max(0, Math.floor(body.estimatedUsage));
  }

  if (meteringMode === "request") {
    return 1;
  }

  return Math.max(1, promptTokens);
}

function normalizeMessages(inputMessages: ChatMessagePayload[]): GatewayChatMessage[] {
  if (inputMessages.length === 0) {
    throw new GatewayError({
      statusCode: 400,
      type: "invalid_request_error",
      code: "invalid_messages",
      message: "messages must not be empty",
      param: "messages",
    });
  }

  const normalized: GatewayChatMessage[] = [];
  for (const message of inputMessages) {
    const role = message.role;
    if (!role || !["system", "user", "assistant", "tool"].includes(role)) {
      throw new GatewayError({
        statusCode: 400,
        type: "invalid_request_error",
        code: "invalid_messages",
        message: "messages[].role is invalid",
        param: "messages",
      });
    }

    const text = extractMessageText(message);
    normalized.push({
      role: role as GatewayChatMessage["role"],
      content: text,
    });
  }

  return normalized;
}

function normalizePlatform(value: string | null): SupportedPlatform {
  if (value === "coze" || value === "n8n" || value === "dify") {
    return value;
  }
  return "dify";
}

function normalizeUsage(
  usage: GatewayUsage,
  fallbackPromptTokens: number,
  fallbackCompletionTokens: number,
  meteringMode: MeteringMode
): GatewayUsage {
  if (meteringMode === "request") {
    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
  }

  const promptTokens = Math.max(0, usage.promptTokens || fallbackPromptTokens);
  const completionTokens = Math.max(0, usage.completionTokens || fallbackCompletionTokens);
  const totalTokens = Math.max(0, usage.totalTokens || promptTokens + completionTokens);

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

function buildFallbackUsage(
  promptTokens: number,
  completionTokens: number,
  meteringMode: MeteringMode
): GatewayUsage {
  if (meteringMode === "request") {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }

  return {
    promptTokens: Math.max(0, promptTokens),
    completionTokens: Math.max(0, completionTokens),
    totalTokens: Math.max(0, promptTokens + completionTokens),
  };
}

function gatewayErrorReply(reply: FastifyReply, traceId: string, error: GatewayError) {
  return reply.status(error.statusCode).send(buildGatewayErrorResponse(error, traceId));
}

function parseTraceparent(request: FastifyRequest): string {
  const traceparentHeader = request.headers.traceparent;
  if (typeof traceparentHeader === "string" && traceparentHeader.trim()) {
    return traceparentHeader.trim();
  }

  const traceId = request.id;
  const spanId = randomUUID().replaceAll("-", "").slice(0, 16);
  return `00-${traceId}-${spanId}-01`;
}

async function withQuotaTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new QuotaCheckTimeoutError()), QUOTA_CHECK_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function isTimeoutGatewayError(error: GatewayError): boolean {
  return error.code === "timeout";
}

function createOpenAiCompletionResponse(
  completion: GatewayCompletionResult,
  conversationId: string,
  traceId: string
) {
  return {
    id: completion.id,
    object: "chat.completion",
    created: completion.created,
    model: completion.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: completion.content,
        },
        finish_reason: completion.finishReason,
      },
    ],
    usage: {
      prompt_tokens: completion.usage.promptTokens,
      completion_tokens: completion.usage.completionTokens,
      total_tokens: completion.usage.totalTokens,
    },
    conversation_id: conversationId,
    trace_id: traceId,
  };
}

function sseWrite(reply: FastifyReply, chunk: string): void {
  if (!reply.raw.writableEnded) {
    reply.raw.write(chunk);
  }
}

function writeSseData(reply: FastifyReply, payload: unknown): void {
  sseWrite(reply, `data: ${JSON.stringify(payload)}\n\n`);
}

function writeSseDone(reply: FastifyReply): void {
  sseWrite(reply, "data: [DONE]\n\n");
}

async function resolveGatewayApp(
  db: PostgresJsDatabase,
  tenantId: string,
  userId: string,
  appId: string,
  activeGroupId: string | null
): Promise<ResolvedGatewayApp> {
  const rows = await db
    .select({
      id: appTable.id,
      tenantId: appTable.tenantId,
      name: appTable.name,
      mode: appTable.mode,
      status: appTable.status,
      enableApi: appTable.enableApi,
      externalPlatform: appTable.externalPlatform,
      config: appTable.config,
    })
    .from(appTable)
    .where(and(eq(appTable.id, appId), eq(appTable.tenantId, tenantId)))
    .limit(1);

  if (rows.length === 0) {
    throw new GatewayError({
      statusCode: 404,
      type: "not_found_error",
      code: "app_not_found",
      message: "Application not found",
      param: "model",
    });
  }

  const app = rows[0] as ResolvedGatewayApp;
  if (app.status !== "active") {
    throw new GatewayError({
      statusCode: 403,
      type: "permission_denied",
      code: "app_not_available",
      message: "Application is not active",
    });
  }

  if (!app.enableApi) {
    throw new GatewayError({
      statusCode: 403,
      type: "permission_denied",
      code: "app_api_disabled",
      message: "Application API access is disabled",
    });
  }

  const appService = createAppService(db);
  const hasAccess = await appService.hasAppAccess(userId, tenantId, appId, activeGroupId);
  if (!hasAccess) {
    throw new GatewayError({
      statusCode: 403,
      type: "permission_denied",
      code: "app_not_authorized",
      message: "You are not authorized to use this application",
    });
  }

  return app;
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

async function scheduleQuotaDeduction(input: {
  db: PostgresJsDatabase;
  tenantId: string;
  groupId: string | null;
  userId: string;
  appId: string;
  runId: string;
  model: string;
  meteringMode: MeteringMode;
  promptTokens: number;
  completionTokens: number;
  traceId: string;
}) {
  const quotaRepository = createQuotaRepository(input.db);
  const notificationService = createNotificationService(input.db as any);
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
      tenantId: input.tenantId,
      groupId: input.groupId,
      userId: input.userId,
      appId: input.appId,
      runId: input.runId,
      model: input.model,
      meteringMode: input.meteringMode,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      traceId: input.traceId,
    });
  } catch (error) {
    if (error instanceof QuotaDeductExceededError) {
      await auditService.logFailure(
        {
          tenantId: input.tenantId,
          actorUserId: input.userId,
          actorType: "user",
          action: "gov.quota.deduct_failed",
          resourceType: "quota_policy",
          resourceId: error.scope,
          traceId: input.traceId,
          metadata: {
            scope: error.scope,
            current: error.used,
            limit: error.limit,
            resetsAt: error.resetsAt.toISOString(),
            runId: input.runId,
          },
        },
        error.message
      );
      return;
    }

    const errorMessage = error instanceof Error ? error.message : "Quota deduct failed";
    await auditService.logFailure(
      {
        tenantId: input.tenantId,
        actorUserId: input.userId,
        actorType: "user",
        action: "gov.quota.deduct_failed",
        resourceType: "quota_policy",
        resourceId: "unknown",
        traceId: input.traceId,
        metadata: {
          runId: input.runId,
          message: errorMessage,
        },
      },
      errorMessage
    );
  }
}

async function chatCompletions(
  request: FastifyRequest<{ Body: ChatCompletionRequestBody }>,
  reply: FastifyReply
): Promise<void> {
  const traceId = request.id;
  const body = request.body ?? {};
  const tenantId = resolveTenantId(request, body);
  const userId = resolveUserId(request, body);
  let platform: SupportedPlatform | null = null;

  try {
    if (!tenantId || !userId) {
      throw new GatewayError({
        statusCode: 400,
        type: "invalid_request_error",
        code: "invalid_request",
        message: "tenantId and userId are required",
      });
    }

    const appId = resolveAppId(body);
    const db = getRequestDb(request);
    if (!db) {
      throw new ServiceDegradedError("Gateway database context is unavailable");
    }

    const requestedGroupId = body.groupId ?? getHeaderString(request, "x-active-group-id") ?? null;
    const appRecord = await resolveGatewayApp(db, tenantId, userId, appId, requestedGroupId);
    platform = normalizePlatform(appRecord.externalPlatform);

    if (!platformHealthStore.shouldAllowRequest(platform)) {
      throw new ServiceDegradedError(`Platform ${platform} is temporarily unavailable`);
    }

    const normalizedMessages = normalizeMessages(body.messages ?? []);
    const meteringMode = resolveMeteringMode(body.meteringMode);
    const promptTokens = estimatePromptTokens(body, normalizedMessages);
    const completionTokensEstimate = estimateCompletionTokens(body, meteringMode);
    const estimatedUsage = resolveEstimatedUsage(body, meteringMode, promptTokens);

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
        throw new GatewayError({
          statusCode: 400,
          type: "invalid_request_error",
          code: "invalid_active_group",
          message: "Provided active group is not valid for this user and tenant",
          param: "groupId",
        });
      }
      throw error;
    }

    let checkResult;
    try {
      checkResult = await withQuotaTimeout(
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
    } catch (error) {
      if (error instanceof QuotaCheckTimeoutError) {
        markQuotaServiceDegraded(request.server, error.message, "gateway_chat");
        throw new ServiceDegradedError("Quota service degraded");
      }
      throw error;
    }

    if (!checkResult.allowed) {
      throw new GatewayError({
        statusCode: 429,
        type: "rate_limit_error",
        code: "quota_exceeded",
        message: checkResult.exceededDetail
          ? `Quota exceeded at ${checkResult.exceededDetail.scope} scope`
          : "Quota exceeded",
      });
    }

    markQuotaServiceHealthy(request.server, "gateway_chat");

    const integrationConfig = resolveGatewayAppIntegrationConfig(appRecord.config);
    const adapter = adapterRegistry.get(platform, integrationConfig);
    const model = body.model ?? appId;
    const conversationId =
      typeof body.conversation_id === "string" && body.conversation_id.trim()
        ? body.conversation_id.trim()
        : randomUUID();
    const existingMapping = sessionMappingStore.get(conversationId, tenantId, userId, appId);

    const adapterInput: GatewayChatRequestInput = {
      tenantId,
      userId,
      appId,
      model,
      messages: normalizedMessages,
      tools: body.tools,
      temperature: body.temperature,
      maxTokens: body.max_tokens ?? body.maxTokens,
      traceId,
      traceparent: parseTraceparent(request),
      conversationId,
      externalConversationId: existingMapping?.externalConversationId ?? null,
      activeGroupId: attribution.groupId,
    };

    if (body.stream) {
      const streamId = `chatcmpl_${randomUUID()}`;
      const runId = `run_${randomUUID()}`;
      const created = Math.floor(Date.now() / 1000);
      const response = reply.raw;
      reply.hijack();
      response.statusCode = 200;
      response.setHeader("content-type", "text/event-stream");
      response.setHeader("cache-control", "no-cache");
      response.setHeader("connection", "keep-alive");
      response.setHeader("x-trace-id", traceId);
      response.setHeader("traceparent", adapterInput.traceparent);

      let completionTokens = Math.max(0, completionTokensEstimate);
      let finishReason: "stop" | "length" | "tool_calls" | "content_filter" = "stop";
      let finalUsage: GatewayUsage | null = null;
      let externalConversationId: string | undefined;
      let externalRunId: string | undefined;
      const heartbeatTimer = setInterval(() => {
        sseWrite(reply, ": heartbeat\n\n");
      }, 15_000);

      writeSseData(reply, {
        id: streamId,
        object: "chat.completion.chunk",
        created,
        model,
        choices: [
          {
            index: 0,
            delta: { role: "assistant" },
            finish_reason: null,
          },
        ],
      });

      try {
        for await (const chunk of adapter.streamMessage(adapterInput)) {
          if (chunk.externalConversationId) {
            externalConversationId = chunk.externalConversationId;
          }
          if (chunk.externalRunId) {
            externalRunId = chunk.externalRunId;
          }
          if (chunk.usage) {
            finalUsage = chunk.usage;
          }
          if (chunk.finishReason) {
            finishReason = chunk.finishReason;
          }
          if (chunk.delta && chunk.delta.length > 0) {
            completionTokens += Math.ceil(chunk.delta.length / 4);
            writeSseData(reply, {
              id: chunk.id ?? streamId,
              object: "chat.completion.chunk",
              created,
              model,
              choices: [
                {
                  index: 0,
                  delta: { content: chunk.delta },
                  finish_reason: null,
                },
              ],
            });
          }
        }

        if (!finalUsage) {
          finalUsage = buildFallbackUsage(promptTokens, completionTokens, meteringMode);
        }

        writeSseData(reply, {
          id: streamId,
          object: "chat.completion.chunk",
          created,
          model,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: finishReason,
            },
          ],
          usage: {
            prompt_tokens: finalUsage.promptTokens,
            completion_tokens: finalUsage.completionTokens,
            total_tokens: finalUsage.totalTokens,
          },
        });
        writeSseDone(reply);

        platformHealthStore.recordSuccess(platform);

        if (externalConversationId || externalRunId) {
          sessionMappingStore.upsert({
            conversationId,
            tenantId,
            userId,
            appId,
            externalConversationId: externalConversationId ?? null,
            externalRunId: externalRunId ?? null,
          });
        }

        const usage = finalUsage;
        void scheduleQuotaDeduction({
          db,
          tenantId,
          groupId: attribution.groupId,
          userId,
          appId,
          runId: externalRunId ?? runId,
          model,
          meteringMode,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          traceId,
        });
      } catch (error) {
        const normalizedError = toGatewayError(error);
        platformHealthStore.recordFailure(platform, {
          reason: normalizedError.message,
          timeout: isTimeoutGatewayError(normalizedError),
        });
        writeSseData(reply, buildGatewayErrorResponse(normalizedError, traceId));
        writeSseDone(reply);
      } finally {
        clearInterval(heartbeatTimer);
        if (!response.writableEnded) {
          response.end();
        }
      }

      return;
    }

    const completion = await adapter.sendMessage(adapterInput);
    platformHealthStore.recordSuccess(platform);

    const usage = normalizeUsage(
      completion.usage,
      promptTokens,
      completionTokensEstimate,
      meteringMode
    );
    const normalizedCompletion: GatewayCompletionResult = {
      ...completion,
      usage,
    };

    if (completion.externalConversationId || completion.externalRunId) {
      sessionMappingStore.upsert({
        conversationId,
        tenantId,
        userId,
        appId,
        externalConversationId: completion.externalConversationId ?? null,
        externalRunId: completion.externalRunId ?? null,
      });
    }

    const runId = completion.externalRunId ?? `run_${randomUUID()}`;
    void scheduleQuotaDeduction({
      db,
      tenantId,
      groupId: attribution.groupId,
      userId,
      appId,
      runId,
      model,
      meteringMode,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      traceId,
    });

    return reply.status(200).send(
      createOpenAiCompletionResponse(normalizedCompletion, conversationId, traceId)
    );
  } catch (error) {
    const normalizedError = toGatewayError(error);
    if (platform) {
      platformHealthStore.recordFailure(platform, {
        reason: normalizedError.message,
        timeout: isTimeoutGatewayError(normalizedError),
      });
    }
    return gatewayErrorReply(reply, traceId, normalizedError);
  }
}

async function listModels(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const tenantId = getHeaderString(request, "x-tenant-id");
  const currentUser = (request as unknown as { user?: { id?: string } }).user;
  const userId = currentUser?.id ?? getHeaderString(request, "x-user-id");

  try {
    if (!tenantId || !userId) {
      throw new GatewayError({
        statusCode: 400,
        type: "invalid_request_error",
        code: "invalid_request",
        message: "tenantId and userId are required",
      });
    }

    const db = getRequestDb(request);
    if (!db) {
      throw new ServiceDegradedError("Gateway database context is unavailable");
    }

    const activeGroupId = getHeaderString(request, "x-active-group-id") ?? null;
    const appService = createAppService(db);
    const result = await appService.getAccessibleApps(userId, tenantId, activeGroupId, {
      view: "all",
      limit: 100,
    });

    return reply.status(200).send({
      object: "list",
      data: result.items.map((item) => ({
        id: item.id,
        object: "model",
        created: Math.floor(Date.now() / 1000),
        owned_by: tenantId,
        name: item.name,
        description: item.description ?? null,
        mode: item.mode ?? "chat",
        capabilities: {
          streaming: true,
          stop: true,
          tools: true,
          files: false,
          citations: false,
        },
      })),
      trace_id: request.id,
    });
  } catch (error) {
    const normalizedError = toGatewayError(error);
    return gatewayErrorReply(reply, request.id, normalizedError);
  }
}

async function stopChatGeneration(
  request: FastifyRequest<{
    Params: { taskId: string };
    Body: StopGenerationBody;
  }>,
  reply: FastifyReply
): Promise<void> {
  const body = request.body ?? {};
  const tenantId = resolveTenantId(request, body);
  const userId = resolveUserId(request, body);
  let platform: SupportedPlatform | null = null;

  try {
    if (!tenantId || !userId) {
      throw new GatewayError({
        statusCode: 400,
        type: "invalid_request_error",
        code: "invalid_request",
        message: "tenantId and userId are required",
      });
    }

    const appId = resolveAppId(body);
    const db = getRequestDb(request);
    if (!db) {
      throw new ServiceDegradedError("Gateway database context is unavailable");
    }

    const requestedGroupId = body.groupId ?? getHeaderString(request, "x-active-group-id") ?? null;
    const appRecord = await resolveGatewayApp(db, tenantId, userId, appId, requestedGroupId);
    platform = normalizePlatform(appRecord.externalPlatform);

    if (!platformHealthStore.shouldAllowRequest(platform)) {
      throw new ServiceDegradedError(`Platform ${platform} is temporarily unavailable`);
    }

    const integrationConfig = resolveGatewayAppIntegrationConfig(appRecord.config);
    const adapter = adapterRegistry.get(platform, integrationConfig);
    const taskId = request.params.taskId;
    const conversationId =
      typeof body.conversation_id === "string" && body.conversation_id.trim()
        ? body.conversation_id.trim()
        : randomUUID();
    const mapping = sessionMappingStore.get(conversationId, tenantId, userId, appId);
    const stopResult = await adapter.stopGeneration(taskId, {
      tenantId,
      userId,
      appId,
      model: body.model ?? appId,
      messages: [{ role: "user", content: "" }],
      traceId: request.id,
      traceparent: parseTraceparent(request),
      conversationId,
      externalConversationId: mapping?.externalConversationId ?? null,
      activeGroupId: requestedGroupId,
    });

    platformHealthStore.recordSuccess(platform);

    return reply.status(200).send({
      result: "success",
      stop_type: stopResult.stopType,
      trace_id: request.id,
    });
  } catch (error) {
    const normalizedError = toGatewayError(error);
    if (platform) {
      platformHealthStore.recordFailure(platform, {
        reason: normalizedError.message,
        timeout: isTimeoutGatewayError(normalizedError),
      });
    }
    return gatewayErrorReply(reply, request.id, normalizedError);
  }
}

export async function registerChatExecutionRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/models", listModels);

  fastify.post<{
    Body: ChatCompletionRequestBody;
  }>("/chat/completions", chatCompletions);

  fastify.post<{
    Params: { taskId: string };
    Body: StopGenerationBody;
  }>("/chat/completions/:taskId/stop", stopChatGeneration);
}
