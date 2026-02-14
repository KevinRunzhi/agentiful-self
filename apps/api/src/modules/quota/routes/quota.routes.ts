/**
 * Quota Routes
 *
 * Internal endpoints for S1-3 quota checks, deduction, and policy management.
 */

import { getDatabase } from "@agentifui/db/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  getQuotaGuardState,
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
import { createQuotaCheckService, type QuotaLimitStateDto } from "../services/quota-check.service";
import {
  QuotaDeductExceededError,
  createQuotaDeductService,
  type QuotaDeductRequestDto,
} from "../services/quota-deduct.service";
import type { QuotaCheckRequestDto } from "../services/quota-check.service";

const QUOTA_CHECK_TIMEOUT_MS = 2_000;
const quotaAlertDedupeStore = createQuotaAlertDedupeStore();

class QuotaCheckTimeoutError extends Error {
  constructor() {
    super("Quota check exceeded timeout");
    this.name = "QuotaCheckTimeoutError";
  }
}

interface UpsertQuotaPolicyBody {
  tenantId: string;
  scope: "tenant" | "group" | "user";
  scopeId: string;
  meteringMode: "token" | "request";
  resetPeriod: "monthly" | "weekly";
  limitValue: number;
  alertThresholds?: number[];
  isActive?: boolean;
}

interface ListPoliciesQuerystring {
  tenantId?: string;
  scope?: "tenant" | "group" | "user";
  scopeId?: string;
  meteringMode?: "token" | "request";
  resetPeriod?: "monthly" | "weekly";
  isActive?: string;
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

function parseBoolean(input: string | undefined): boolean | undefined {
  if (typeof input !== "string") {
    return undefined;
  }
  if (input === "true") {
    return true;
  }
  if (input === "false") {
    return false;
  }
  return undefined;
}

function getRequestedActiveGroupId(request: FastifyRequest): string | null {
  const headerValue = request.headers["x-active-group-id"];
  if (typeof headerValue === "string" && headerValue.trim().length > 0) {
    return headerValue.trim();
  }

  return null;
}

function toPeriodType(resetPeriod: "monthly" | "weekly"): "month" | "week" {
  return resetPeriod === "weekly" ? "week" : "month";
}

function toResetPeriod(periodType: "month" | "week"): "monthly" | "weekly" {
  return periodType === "week" ? "weekly" : "monthly";
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

function quotaExceededReply(reply: FastifyReply, detail: QuotaLimitStateDto | null, traceId: string) {
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
          source: "quota_guard",
        },
      });
    }
  } catch {
    // Skip notification failures to avoid blocking main flow.
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
  const threshold = event.threshold;

  if (event.scope === "user") {
    if (event.userId) {
      recipients.add(event.userId);
    }

    if (threshold >= 90 && event.groupId) {
      const managerIds = await quotaRepository.listGroupManagerUserIds(event.tenantId, event.groupId);
      for (const managerId of managerIds) {
        recipients.add(managerId);
      }
    }

    if (threshold >= 100) {
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

    if (threshold >= 90) {
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

export async function quotaRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/health", async (request, reply) => {
    const state = getQuotaGuardState(request.server);

    return reply.status(200).send({
      data: {
        status: state.degraded ? "degraded" : "healthy",
        degraded: state.degraded,
        reason: state.reason ?? null,
        source: state.source ?? null,
        updatedAt: state.updatedAt,
      },
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  fastify.post<{
    Body: {
      degraded: boolean;
      reason?: string;
      source?: string;
    };
  }>("/health", async (request, reply) => {
    if (request.body.degraded) {
      markQuotaServiceDegraded(
        request.server,
        request.body.reason || "Manually set degraded state",
        request.body.source || "manual"
      );
    } else {
      markQuotaServiceHealthy(request.server, request.body.source || "manual");
    }

    const state = getQuotaGuardState(request.server);
    return reply.status(200).send({
      data: {
        status: state.degraded ? "degraded" : "healthy",
        degraded: state.degraded,
        reason: state.reason ?? null,
        source: state.source ?? null,
        updatedAt: state.updatedAt,
      },
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  fastify.get<{
    Querystring: ListPoliciesQuerystring;
  }>("/policies", async (request, reply) => {
    const tenantId = request.query.tenantId;
    if (!tenantId) {
      return badRequestReply(reply, request.id, "tenantId is required");
    }

    const db = getRequestDb(request);
    if (!db) {
      return quotaUnavailableReply(reply, request.id, "Database context unavailable");
    }

    const quotaRepository = createQuotaRepository(db as any);
    const policies = await quotaRepository.listPolicies(tenantId, {
      scopeType: request.query.scope,
      scopeId: request.query.scopeId,
      meteringMode: request.query.meteringMode,
      periodType: request.query.resetPeriod ? toPeriodType(request.query.resetPeriod) : undefined,
      isActive: parseBoolean(request.query.isActive),
    });

    return reply.status(200).send({
      data: policies.map((policy) => ({
        id: policy.id,
        tenantId: policy.tenantId,
        scope: policy.scopeType,
        scopeId: policy.scopeId,
        meteringMode: policy.metricType,
        resetPeriod: toResetPeriod(policy.periodType),
        limitValue: policy.limitValue,
        alertThresholds: policy.alertThresholds,
        isActive: policy.isActive,
      })),
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  fastify.post<{
    Body: UpsertQuotaPolicyBody;
  }>("/policies", async (request, reply) => {
    const body = request.body;
    let normalizedAlertThresholds: number[] | undefined;

    if (!["tenant", "group", "user"].includes(body.scope)) {
      return badRequestReply(reply, request.id, "scope must be one of tenant/group/user");
    }
    if (!["token", "request"].includes(body.meteringMode)) {
      return badRequestReply(reply, request.id, "meteringMode must be token or request");
    }
    if (!["monthly", "weekly"].includes(body.resetPeriod)) {
      return badRequestReply(reply, request.id, "resetPeriod must be monthly or weekly");
    }

    if (
      !Number.isFinite(body.limitValue) ||
      !Number.isInteger(body.limitValue) ||
      body.limitValue < 0 ||
      body.limitValue > 1_000_000_000
    ) {
      return badRequestReply(reply, request.id, "limitValue must be within [0, 1000000000]");
    }

    if (typeof body.alertThresholds !== "undefined") {
      if (!Array.isArray(body.alertThresholds) || body.alertThresholds.length === 0) {
        return badRequestReply(reply, request.id, "alertThresholds must be a non-empty number array");
      }

      const normalized = [...new Set(body.alertThresholds.map((value) => Number(value)))]
        .filter((value) => Number.isInteger(value) && value > 0 && value <= 100)
        .sort((a, b) => a - b);

      if (normalized.length !== body.alertThresholds.length) {
        return badRequestReply(
          reply,
          request.id,
          "alertThresholds must be unique integers within [1, 100]"
        );
      }

      normalizedAlertThresholds = normalized;
    }

    const db = getRequestDb(request);
    if (!db) {
      return quotaUnavailableReply(reply, request.id, "Database context unavailable");
    }

    const quotaRepository = createQuotaRepository(db as any);

    const scopeBelongsToTenant = await quotaRepository.scopeBelongsToTenant(
      body.tenantId,
      body.scope,
      body.scopeId
    );
    if (!scopeBelongsToTenant) {
      return badRequestReply(reply, request.id, "scopeId must belong to current tenant");
    }

    if (body.scope !== "tenant") {
      const parentPolicy = await quotaRepository.findActivePolicy(
        body.tenantId,
        "tenant",
        body.tenantId,
        body.meteringMode
      );
      if (parentPolicy && body.limitValue > Number(parentPolicy.limitValue)) {
        return badRequestReply(reply, request.id, "child quota cannot exceed tenant quota");
      }
    }

    const policy = await quotaRepository.upsertPolicy({
      tenantId: body.tenantId,
      scopeType: body.scope,
      scopeId: body.scopeId,
      meteringMode: body.meteringMode,
      periodType: toPeriodType(body.resetPeriod),
      limitValue: Math.floor(body.limitValue),
      alertThresholds: normalizedAlertThresholds,
      isActive: body.isActive,
    });

    return reply.status(200).send({
      data: {
        id: policy.id,
        tenantId: policy.tenantId,
        scope: policy.scopeType,
        scopeId: policy.scopeId,
        meteringMode: policy.metricType,
        resetPeriod: toResetPeriod(policy.periodType),
        limitValue: policy.limitValue,
        alertThresholds: policy.alertThresholds,
        isActive: policy.isActive,
      },
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  fastify.post<{
    Body: QuotaCheckRequestDto;
  }>("/check", async (request, reply) => {
    try {
      if (!request.body?.tenantId || !request.body?.userId) {
        return badRequestReply(reply, request.id, "tenantId and userId are required");
      }

      if (!["token", "request"].includes(request.body.meteringMode)) {
        return badRequestReply(reply, request.id, "meteringMode must be token or request");
      }

      if (
        !Number.isFinite(request.body.estimatedUsage) ||
        Number(request.body.estimatedUsage) < 0
      ) {
        return badRequestReply(reply, request.id, "estimatedUsage must be a non-negative number");
      }

      const db = getRequestDb(request);
      if (!db) {
        markQuotaServiceDegraded(request.server, "Database context unavailable", "quota_check");
        if (request.body.tenantId) {
          await notifyTenantAdminsOnDegradedQuota(
            request,
            request.body.tenantId,
            "database_context_unavailable"
          );
        }
        return quotaUnavailableReply(reply, request.id);
      }

      const quotaRepository = createQuotaRepository(db as any);
      const quotaCheckService = createQuotaCheckService(quotaRepository);
      const requestedGroupId = request.body.groupId ?? getRequestedActiveGroupId(request);

      let attribution;
      try {
        attribution = await resolveQuotaAttributionGroupId(quotaRepository, {
          tenantId: request.body.tenantId,
          userId: request.body.userId,
          appId: request.body.appId,
          requestedGroupId,
        });
      } catch (error) {
        if (error instanceof InvalidActiveGroupError) {
          return invalidActiveGroupReply(reply, request.id);
        }
        throw error;
      }

      const result = await withQuotaTimeout(
        quotaCheckService.check({
          ...request.body,
          groupId: attribution.groupId,
          traceId: request.body.traceId ?? request.id,
        })
      );

      if (!result.allowed) {
        await auditService.logFailure(
          {
            tenantId: request.body.tenantId,
            actorUserId: request.body.userId,
            actorType: "user",
            action: "gov.quota.exceeded",
            resourceType: "quota_policy",
            resourceId: result.exceededScope ?? "unknown",
            traceId: request.id,
            metadata: {
              scope: result.exceededScope ?? "unknown",
              attributionGroupId: attribution.groupId,
              attributionSource: attribution.source,
              limits: result.limits,
            },
          },
          `Quota exceeded at ${result.exceededScope ?? "unknown"} scope`
        );

        return quotaExceededReply(reply, result.exceededDetail ?? null, request.id);
      }

      markQuotaServiceHealthy(request.server, "quota_check");

      return reply.status(200).send({
        allowed: true,
        limits: result.limits.map((limit) => ({
          scope: limit.scope,
          scopeId: limit.scopeId,
          current: limit.used,
          remaining: limit.remaining,
          limit: limit.limit,
          resetsAt: limit.resetsAt,
        })),
        attribution: {
          groupId: attribution.groupId,
          source: attribution.source,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Quota check failed";
      markQuotaServiceDegraded(request.server, message, "quota_check");
      if (error instanceof QuotaCheckTimeoutError && request.body.tenantId) {
        await notifyTenantAdminsOnDegradedQuota(request, request.body.tenantId, "quota_check_timeout");
      }
      return quotaUnavailableReply(reply, request.id, message);
    }
  });

  fastify.post<{
    Body: QuotaDeductRequestDto;
  }>("/deduct", async (request, reply) => {
    try {
      if (!request.body?.tenantId || !request.body?.userId || !request.body?.appId) {
        return badRequestReply(reply, request.id, "tenantId, userId and appId are required");
      }

      if (!["token", "request"].includes(request.body.meteringMode)) {
        return badRequestReply(reply, request.id, "meteringMode must be token or request");
      }

      if (
        typeof request.body.promptTokens !== "undefined" &&
        (!Number.isFinite(request.body.promptTokens) || Number(request.body.promptTokens) < 0)
      ) {
        return badRequestReply(reply, request.id, "promptTokens must be a non-negative number");
      }

      if (
        typeof request.body.completionTokens !== "undefined" &&
        (!Number.isFinite(request.body.completionTokens) || Number(request.body.completionTokens) < 0)
      ) {
        return badRequestReply(reply, request.id, "completionTokens must be a non-negative number");
      }

      const db = getRequestDb(request);
      if (!db) {
        markQuotaServiceDegraded(request.server, "Database context unavailable", "quota_deduct");
        return quotaUnavailableReply(reply, request.id);
      }

      const quotaRepository = createQuotaRepository(db as any);
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
      const requestedGroupId = request.body.groupId ?? getRequestedActiveGroupId(request);

      let attribution;
      try {
        attribution = await resolveQuotaAttributionGroupId(quotaRepository, {
          tenantId: request.body.tenantId,
          userId: request.body.userId,
          appId: request.body.appId,
          requestedGroupId,
        });
      } catch (error) {
        if (error instanceof InvalidActiveGroupError) {
          return invalidActiveGroupReply(reply, request.id);
        }
        throw error;
      }

      await quotaDeductService.deduct({
        ...request.body,
        groupId: attribution.groupId,
        traceId: request.body.traceId ?? request.id,
      });

      markQuotaServiceHealthy(request.server, "quota_deduct");

      return reply.status(200).send({
        success: true,
        attribution: {
          groupId: attribution.groupId,
          source: attribution.source,
        },
      });
    } catch (error) {
      if (error instanceof QuotaDeductExceededError) {
        return quotaExceededReply(
          reply,
          {
            scope: error.scope,
            scopeId: "",
            used: error.used,
            limit: error.limit,
            remaining: Math.max(0, error.limit - error.used),
            resetsAt: error.resetsAt.toISOString(),
          },
          request.id
        );
      }

      const message = error instanceof Error ? error.message : "Quota deduct failed";
      markQuotaServiceDegraded(request.server, message, "quota_deduct");
      return quotaUnavailableReply(reply, request.id, message);
    }
  });
}
