import { getDatabase } from "@agentifui/db/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  createExecutionPersistenceService,
  ExecutionHttpError,
} from "../services/execution-persistence.service";

interface RunsQuerystring {
  tenantId?: string;
  userId?: string;
  appId?: string;
  conversationId?: string;
  status?: string;
  limit?: number | string;
}

interface RunDetailQuerystring {
  tenantId?: string;
  userId?: string;
}

interface ConversationSyncBody {
  tenantId?: string;
  userId?: string;
  trigger?: "auto" | "user" | "admin";
  forceFailure?: boolean;
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

function getRequestUserId(request: FastifyRequest): string | undefined {
  const fromRequestContext = (request as { userId?: string }).userId;
  if (typeof fromRequestContext === "string" && fromRequestContext.trim()) {
    return fromRequestContext.trim();
  }
  const fromUser = (request as { user?: { id?: string } }).user?.id;
  if (fromUser) {
    return fromUser;
  }
  const fromHeader = request.headers["x-user-id"];
  return typeof fromHeader === "string" && fromHeader.trim() ? fromHeader.trim() : undefined;
}

function getRequestTenantId(request: FastifyRequest): string | undefined {
  const fromRequestContext = (request as { tenantId?: string }).tenantId;
  if (typeof fromRequestContext === "string" && fromRequestContext.trim()) {
    return fromRequestContext.trim();
  }
  const fromHeader = request.headers["x-tenant-id"];
  return typeof fromHeader === "string" && fromHeader.trim() ? fromHeader.trim() : undefined;
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

function executionErrorReply(reply: FastifyReply, traceId: string, error: ExecutionHttpError) {
  const type = error.statusCode >= 500 ? "server_error" : "invalid_request_error";
  return reply.status(error.statusCode).send({
    error: {
      type,
      code: error.code,
      message: error.message,
      trace_id: traceId,
    },
  });
}

function parseLimit(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed);
    }
  }

  return undefined;
}

export async function registerRunRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{
    Querystring: RunsQuerystring;
  }>("/runs", async (request, reply) => {
    const tenantId = request.query.tenantId ?? getRequestTenantId(request);
    const userId = request.query.userId ?? getRequestUserId(request);
    if (!tenantId || !userId) {
      return badRequestReply(reply, request.id, "tenantId and userId are required");
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

    const service = createExecutionPersistenceService(db as any);
    const data = await service.listRuns({
      tenantId,
      userId,
      appId: request.query.appId,
      conversationId: request.query.conversationId,
      status: request.query.status,
      limit: parseLimit(request.query.limit),
    });

    return reply.status(200).send({
      data: {
        items: data,
      },
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  fastify.get<{
    Params: { runId: string };
    Querystring: RunDetailQuerystring;
  }>("/runs/:runId", async (request, reply) => {
    const tenantId = request.query.tenantId ?? getRequestTenantId(request);
    const userId = request.query.userId ?? getRequestUserId(request);
    if (!tenantId || !userId) {
      return badRequestReply(reply, request.id, "tenantId and userId are required");
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

    const service = createExecutionPersistenceService(db as any);
    const detail = await service.getRunDetail({
      runId: request.params.runId,
      tenantId,
      userId,
    });

    if (!detail) {
      return reply.status(404).send({
        error: {
          type: "invalid_request_error",
          code: "run_not_found",
          message: "Run not found",
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
    Params: { runId: string };
    Querystring: RunDetailQuerystring;
  }>("/runs/:runId/stop", async (request, reply) => {
    const tenantId = request.query.tenantId ?? getRequestTenantId(request);
    const userId = request.query.userId ?? getRequestUserId(request);
    if (!tenantId || !userId) {
      return badRequestReply(reply, request.id, "tenantId and userId are required");
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

    const service = createExecutionPersistenceService(db as any);
    const ok = await service.stopExecution(request.params.runId, tenantId, userId);
    if (!ok) {
      return reply.status(404).send({
        error: {
          type: "invalid_request_error",
          code: "run_not_found",
          message: "Run not found",
          trace_id: request.id,
        },
      });
    }

    return reply.status(200).send({
      data: {
        success: true,
      },
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  fastify.post<{
    Params: { conversationId: string };
    Body: ConversationSyncBody;
  }>("/conversations/:conversationId/sync", async (request, reply) => {
    const tenantId = request.body?.tenantId ?? getRequestTenantId(request);
    const userId = request.body?.userId ?? getRequestUserId(request);
    if (!tenantId || !userId) {
      return badRequestReply(reply, request.id, "tenantId and userId are required");
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

    const service = createExecutionPersistenceService(db as any);
    try {
      const result = await service.syncConversation({
        tenantId,
        userId,
        conversationId: request.params.conversationId,
        trigger: request.body?.trigger ?? "user",
        traceId: request.id,
        forceFailure: request.body?.forceFailure ?? false,
      });

      return reply.status(200).send({
        data: result,
        meta: {
          traceId: request.id,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof ExecutionHttpError) {
        return executionErrorReply(reply, request.id, error);
      }
      throw error;
    }
  });
}
