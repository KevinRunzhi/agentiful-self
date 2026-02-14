import type { FastifyInstance } from "fastify";
import { createAuditExportService, AuditExportError } from "../services/audit-export.service.js";
import { createAuditQueryService } from "../services/audit-query.service.js";
import { createSecurityPolicyConfigService } from "../services/security-policy-config.service.js";
import {
  badRequest,
  getRequestDb,
  requireAdminRole,
  resolveActorRole,
  resolveActorUserId,
  resolveTenantId,
} from "./shared.js";

interface AuditEventQuerystring {
  actorUserId?: string;
  eventCategory?: "authentication" | "authorization" | "data_access" | "management_change" | "security_event";
  eventType?: string;
  targetType?: string;
  targetId?: string;
  result?: "success" | "failure" | "partial";
  severity?: "low" | "medium" | "high" | "critical";
  startAt?: string;
  endAt?: string;
  limit?: number;
  cursor?: string;
  breakglassReason?: string;
}

interface AuditExportBody {
  actorUserId?: string;
  eventCategory?: "authentication" | "authorization" | "data_access" | "management_change" | "security_event";
  eventType?: string;
  targetType?: string;
  targetId?: string;
  result?: "success" | "failure" | "partial";
  severity?: "low" | "medium" | "high" | "critical";
  startAt?: string;
  endAt?: string;
  format?: "csv" | "json";
  breakglassReason?: string;
}

interface RetentionBody {
  retentionDays: number;
  breakglassReason?: string;
}

function exportErrorReply(reply: any, traceId: string, error: AuditExportError) {
  return reply.status(error.statusCode).send({
    error: {
      type: "invalid_request_error",
      code: error.code,
      message: error.message,
      trace_id: traceId,
    },
  });
}

export async function registerAdminAuditRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{
    Querystring: AuditEventQuerystring;
  }>("/audit/events", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const actorUserId = resolveActorUserId(request);
    const actorRole = resolveActorRole(request);
    const breakglassReason = request.query.breakglassReason;

    if (!tenantId || !actorUserId) {
      return badRequest(reply, request.id, "x-tenant-id and x-user-id are required");
    }

    if (!requireAdminRole(reply, actorRole, breakglassReason)) {
      return;
    }

    const db = getRequestDb(request);
    if (!db) {
      return reply.status(503).send({
        error: {
          type: "service_unavailable",
          code: "database_unavailable",
          message: "Database context unavailable",
          trace_id: request.id,
        },
      });
    }

    const service = createAuditQueryService(db as any);
    const result = await service.query({
      tenantId,
      actorUserId: request.query.actorUserId,
      eventCategory: request.query.eventCategory,
      eventType: request.query.eventType,
      targetType: request.query.targetType,
      targetId: request.query.targetId,
      result: request.query.result,
      severity: request.query.severity,
      startAt: request.query.startAt,
      endAt: request.query.endAt,
      limit: request.query.limit,
      cursor: request.query.cursor,
    });

    return reply.status(200).send({
      object: "list",
      data: result.items,
      has_more: result.hasMore,
      next_cursor: result.nextCursor,
    });
  });

  fastify.get<{
    Params: { eventId: string };
    Querystring: { breakglassReason?: string };
  }>("/audit/events/:eventId", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const actorUserId = resolveActorUserId(request);
    const actorRole = resolveActorRole(request);
    const breakglassReason = request.query.breakglassReason;

    if (!tenantId || !actorUserId) {
      return badRequest(reply, request.id, "x-tenant-id and x-user-id are required");
    }

    if (!requireAdminRole(reply, actorRole, breakglassReason)) {
      return;
    }

    const db = getRequestDb(request);
    if (!db) {
      return reply.status(503).send({
        error: {
          type: "service_unavailable",
          code: "database_unavailable",
          message: "Database context unavailable",
          trace_id: request.id,
        },
      });
    }

    const service = createAuditQueryService(db as any);
    const detail = await service.getDetail(tenantId, request.params.eventId);

    if (!detail) {
      return reply.status(404).send({
        error: {
          type: "invalid_request_error",
          code: "audit_event_not_found",
          message: "Audit event not found",
          trace_id: request.id,
        },
      });
    }

    return reply.status(200).send({
      data: detail,
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  fastify.post<{
    Body: AuditExportBody;
  }>("/audit/exports", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const actorUserId = resolveActorUserId(request);
    const actorRole = resolveActorRole(request);
    const breakglassReason = request.body?.breakglassReason;

    if (!tenantId || !actorUserId) {
      return badRequest(reply, request.id, "x-tenant-id and x-user-id are required");
    }

    if (!requireAdminRole(reply, actorRole, breakglassReason)) {
      return;
    }

    const db = getRequestDb(request);
    if (!db) {
      return reply.status(503).send({
        error: {
          type: "service_unavailable",
          code: "database_unavailable",
          message: "Database context unavailable",
          trace_id: request.id,
        },
      });
    }

    const service = createAuditExportService(db as any);
    try {
      const exported = await service.export({
        tenantId,
        requesterUserId: actorUserId,
        requesterRole: actorRole,
        breakglassReason,
        actorUserId: request.body.actorUserId,
        eventCategory: request.body.eventCategory,
        eventType: request.body.eventType,
        targetType: request.body.targetType,
        targetId: request.body.targetId,
        result: request.body.result,
        severity: request.body.severity,
        startAt: request.body.startAt,
        endAt: request.body.endAt,
        format: request.body.format,
      });
      return reply.status(200).send({ data: exported });
    } catch (error) {
      if (error instanceof AuditExportError) {
        return exportErrorReply(reply, request.id, error);
      }
      throw error;
    }
  });

  fastify.get<{
    Params: { jobId: string };
  }>("/audit/exports/:jobId", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const actorUserId = resolveActorUserId(request);
    if (!tenantId || !actorUserId) {
      return badRequest(reply, request.id, "x-tenant-id and x-user-id are required");
    }

    const db = getRequestDb(request);
    if (!db) {
      return reply.status(503).send({
        error: {
          type: "service_unavailable",
          code: "database_unavailable",
          message: "Database context unavailable",
          trace_id: request.id,
        },
      });
    }

    const service = createAuditExportService(db as any);
    const result = await service.getAsyncExport(request.params.jobId, tenantId);
    if (!result) {
      return reply.status(404).send({
        error: {
          type: "invalid_request_error",
          code: "audit_export_not_found",
          message: "Audit export job not found",
          trace_id: request.id,
        },
      });
    }

    return reply.status(200).send({ data: result });
  });

  fastify.get<{
    Params: { jobId: string };
  }>("/audit/exports/:jobId/download", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const actorUserId = resolveActorUserId(request);
    if (!tenantId || !actorUserId) {
      return badRequest(reply, request.id, "x-tenant-id and x-user-id are required");
    }

    const db = getRequestDb(request);
    if (!db) {
      return reply.status(503).send({
        error: {
          type: "service_unavailable",
          code: "database_unavailable",
          message: "Database context unavailable",
          trace_id: request.id,
        },
      });
    }

    const service = createAuditExportService(db as any);
    const result = await service.getAsyncExport(request.params.jobId, tenantId);
    if (!result) {
      return reply.status(404).send({
        error: {
          type: "invalid_request_error",
          code: "audit_export_not_found",
          message: "Audit export job not found",
          trace_id: request.id,
        },
      });
    }

    if (!result.content) {
      return reply.status(409).send({
        error: {
          type: "invalid_request_error",
          code: "audit_export_unavailable",
          message: "Audit export content has expired or is not ready",
          trace_id: request.id,
        },
      });
    }

    const extension = result.format === "json" ? "json" : "csv";
    reply
      .header("Content-Type", result.format === "json" ? "application/json" : "text/csv")
      .header("Content-Disposition", `attachment; filename=\"audit-export-${request.params.jobId}.${extension}\"`);
    return reply.send(result.content);
  });

  fastify.put<{
    Body: RetentionBody;
  }>("/audit/retention", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const actorUserId = resolveActorUserId(request);
    const actorRole = resolveActorRole(request);
    const breakglassReason = request.body?.breakglassReason;

    if (!tenantId || !actorUserId) {
      return badRequest(reply, request.id, "x-tenant-id and x-user-id are required");
    }

    if (!requireAdminRole(reply, actorRole, breakglassReason)) {
      return;
    }

    if (!Number.isFinite(request.body.retentionDays)) {
      return badRequest(reply, request.id, "retentionDays must be a valid number");
    }

    const db = getRequestDb(request);
    if (!db) {
      return reply.status(503).send({
        error: {
          type: "service_unavailable",
          code: "database_unavailable",
          message: "Database context unavailable",
          trace_id: request.id,
        },
      });
    }

    const service = createSecurityPolicyConfigService(db as any);
    const policy = await service.updatePolicy({
      tenantId,
      actorUserId,
      actorRole,
      traceId: request.id,
      patch: {
        audit: {
          retentionDays: request.body.retentionDays,
        },
      },
    });

    return reply.status(200).send({
      data: {
        retentionDays: policy.audit?.retentionDays ?? 180,
      },
    });
  });
}
