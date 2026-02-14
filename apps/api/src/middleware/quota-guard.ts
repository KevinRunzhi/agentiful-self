/**
 * Quota Guard Middleware (S1-3)
 *
 * Guardrails:
 * - Allow workbench list reads during degradation
 * - Deny new executions when quota service is degraded
 */

import type { FastifyInstance } from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import { auditService } from "../modules/auth/services/audit.service.js";

const SAFE_READ_PATHS = [
  /^\/api\/rbac\/apps\/accessible$/,
  /^\/api\/rbac\/apps\/[^/]+\/context-options$/,
  /^\/health$/,
  /^\/ready$/,
];

const EXECUTION_PATHS = [
  /^\/v1\/chat\/completions$/,
];

export interface QuotaGuardState {
  degraded: boolean;
  reason?: string;
  source?: string;
  updatedAt: string;
  auditLogged: boolean;
}

const DEFAULT_GUARD_STATE: QuotaGuardState = {
  degraded: false,
  source: "startup",
  updatedAt: new Date().toISOString(),
  auditLogged: false,
};

function getServerStateContainer(server: FastifyInstance | FastifyRequest["server"]): {
  quotaGuardState?: QuotaGuardState;
} {
  return server as unknown as { quotaGuardState?: QuotaGuardState };
}

export function getQuotaGuardState(
  server: FastifyInstance | FastifyRequest["server"]
): QuotaGuardState {
  const container = getServerStateContainer(server);
  if (!container.quotaGuardState) {
    container.quotaGuardState = { ...DEFAULT_GUARD_STATE };
  }

  return container.quotaGuardState;
}

export function markQuotaServiceHealthy(
  server: FastifyInstance | FastifyRequest["server"],
  source = "quota_service"
): QuotaGuardState {
  const state = getQuotaGuardState(server);
  state.degraded = false;
  state.reason = undefined;
  state.source = source;
  state.updatedAt = new Date().toISOString();
  state.auditLogged = false;
  return state;
}

export function markQuotaServiceDegraded(
  server: FastifyInstance | FastifyRequest["server"],
  reason: string,
  source = "quota_service"
): QuotaGuardState {
  const state = getQuotaGuardState(server);
  const nextReason = reason || "Quota service degraded";
  const reasonChanged = state.reason !== nextReason;
  const statusChanged = !state.degraded;

  state.degraded = true;
  state.reason = nextReason;
  state.source = source;
  state.updatedAt = new Date().toISOString();
  if (reasonChanged || statusChanged) {
    state.auditLogged = false;
  }

  return state;
}

async function emitDegradationAuditIfNeeded(request: FastifyRequest, state: QuotaGuardState) {
  if (state.auditLogged) {
    return;
  }

  try {
    await auditService.logFailure(
      {
        tenantId: request.headers["x-tenant-id"] as string | undefined,
        actorType: "system",
        action: "gov.degradation.triggered",
        resourceType: "quota_service",
        resourceId: state.source || "quota_service",
        traceId: request.id,
        metadata: {
          reason: state.reason,
          path: request.url,
          method: request.method,
          updatedAt: state.updatedAt,
        },
      },
      state.reason || "Quota service degraded"
    );
  } catch {
    // Ignore audit errors to avoid blocking request pipeline.
  } finally {
    state.auditLogged = true;
  }
}

function isSafeReadPath(pathname: string): boolean {
  return SAFE_READ_PATHS.some((pattern) => pattern.test(pathname));
}

function isGuardedExecutionPath(pathname: string): boolean {
  return EXECUTION_PATHS.some((pattern) => pattern.test(pathname));
}

export async function quotaGuardMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const path = request.url.split("?")[0] || request.url;
  const state = getQuotaGuardState(request.server);

  if (!state?.degraded) {
    return;
  }

  if (request.method === "GET" && isSafeReadPath(path)) {
    return;
  }

  if (request.method === "POST" && isGuardedExecutionPath(path)) {
    await emitDegradationAuditIfNeeded(request, state);
    return reply.status(503).send({
      error: {
        type: "service_unavailable",
        code: "quota_guard_degraded_deny_new",
        message: state.reason || "Quota service degraded, new requests are temporarily denied",
        trace_id: request.id,
      },
    });
  }
}
