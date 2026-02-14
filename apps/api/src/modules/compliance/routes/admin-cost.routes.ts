import type { FastifyInstance } from "fastify";
import { createCostEstimator } from "../services/cost-estimator.service.js";
import {
  badRequest,
  getRequestDb,
  requireAdminRole,
  resolveActorRole,
  resolveActorUserId,
  resolveTenantId,
} from "./shared.js";

interface CostReportQuerystring {
  windowDays?: number;
  groupId?: string;
  breakglassReason?: string;
}

interface UpsertPricingBody {
  provider: string;
  model: string;
  inputPricePer1kUsd: number;
  outputPricePer1kUsd: number;
  effectiveFrom?: string;
  breakglassReason?: string;
}

function windowToStart(days: number | undefined): Date {
  const safe = Math.min(Math.max(Math.floor(days ?? 30), 1), 365);
  return new Date(Date.now() - safe * 24 * 60 * 60 * 1000);
}

export async function registerAdminCostRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{
    Querystring: { breakglassReason?: string };
  }>("/cost/pricing", async (request, reply) => {
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

    const service = createCostEstimator(db as any);
    const pricing = await service.listPricing(tenantId);

    return reply.status(200).send({
      data: pricing,
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  fastify.put<{
    Body: UpsertPricingBody;
  }>("/cost/pricing", async (request, reply) => {
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

    if (!request.body.provider?.trim() || !request.body.model?.trim()) {
      return badRequest(reply, request.id, "provider and model are required");
    }
    if (
      !Number.isFinite(request.body.inputPricePer1kUsd) ||
      !Number.isFinite(request.body.outputPricePer1kUsd)
    ) {
      return badRequest(reply, request.id, "inputPricePer1kUsd and outputPricePer1kUsd must be numbers");
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

    const service = createCostEstimator(db as any);
    await service.upsertPricing(
      {
        tenantId,
        provider: request.body.provider,
        model: request.body.model,
        inputPricePer1kUsd: request.body.inputPricePer1kUsd,
        outputPricePer1kUsd: request.body.outputPricePer1kUsd,
        effectiveFrom: request.body.effectiveFrom,
      },
      actorUserId
    );

    return reply.status(200).send({
      data: { updated: true },
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  fastify.post<{
    Body: {
      provider: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      usageAt?: string;
      breakglassReason?: string;
    };
  }>("/cost/estimate", async (request, reply) => {
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

    const service = createCostEstimator(db as any);
    const estimate = await service.estimate({
      tenantId,
      provider: request.body.provider,
      model: request.body.model,
      inputTokens: request.body.inputTokens,
      outputTokens: request.body.outputTokens,
      usageAt: request.body.usageAt,
    });

    return reply.status(200).send({
      data: estimate,
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  fastify.get<{
    Querystring: CostReportQuerystring;
  }>("/cost/report", async (request, reply) => {
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

    const service = createCostEstimator(db as any);
    const now = new Date();
    const startAt = windowToStart(request.query.windowDays);
    const costs = await service.estimateForRuns({
      tenantId,
      startAt,
      endAt: now,
      groupId: request.query.groupId,
    });

    let totalCostUsd = 0;
    let totalTokens = 0;
    for (const item of costs) {
      totalCostUsd += item.costUsd;
      totalTokens += item.totalTokens;
    }

    return reply.status(200).send({
      data: {
        totalCostUsd: Number(totalCostUsd.toFixed(8)),
        totalTokens,
        runCount: costs.length,
        windowStart: startAt.toISOString(),
        windowEnd: now.toISOString(),
      },
      meta: {
        traceId: request.id,
        timestamp: now.toISOString(),
      },
    });
  });
}
