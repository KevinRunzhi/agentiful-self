import type { FastifyInstance } from "fastify";
import { createAnalyticsAggregator } from "../services/analytics-aggregator.service.js";
import {
  badRequest,
  getRequestDb,
  requireAdminRole,
  resolveActorRole,
  resolveActorUserId,
  resolveTenantId,
} from "./shared.js";

interface DashboardQuerystring {
  windowDays?: number;
  groupId?: string;
  breakglassReason?: string;
}

export async function registerAdminAnalyticsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{
    Querystring: DashboardQuerystring;
  }>("/analytics/dashboard", async (request, reply) => {
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

    const service = createAnalyticsAggregator(db as any);
    const dashboard = await service.getDashboard({
      tenantId,
      windowDays: request.query.windowDays,
      groupId: request.query.groupId,
    });

    return reply.status(200).send({
      data: dashboard,
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  fastify.post<{
    Body: { anchor?: string };
    Querystring: { breakglassReason?: string };
  }>("/analytics/refresh", async (request, reply) => {
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

    const service = createAnalyticsAggregator(db as any);
    await service.refreshHourly(tenantId, request.body?.anchor ? new Date(request.body.anchor) : new Date());

    return reply.status(200).send({
      data: {
        refreshed: true,
      },
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });
}
