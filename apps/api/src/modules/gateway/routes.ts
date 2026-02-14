import { getDatabase } from "@agentifui/db/client";
import { tenant } from "@agentifui/db/schema/tenant";
import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { GatewayError, buildGatewayErrorResponse } from "./errors.js";
import { platformHealthStore } from "./services/platform-health.store.js";

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

function normalizeTenantObservabilityTemplate(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const config = value as Record<string, unknown>;
  const observability = config.observability;
  if (!observability || typeof observability !== "object" || Array.isArray(observability)) {
    return null;
  }

  const template = (observability as Record<string, unknown>).urlTemplate;
  if (typeof template !== "string" || !template.trim()) {
    return null;
  }

  return template.trim();
}

function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\$\{([a-zA-Z0-9_]+)\}/g, (_full, key: string) => {
    const value = variables[key];
    return encodeURIComponent(value ?? "");
  });
}

async function resolveTenantTemplate(request: FastifyRequest, tenantId: string): Promise<string | null> {
  const db = getRequestDb(request);
  if (!db) {
    return null;
  }

  const rows = await (db as any)
    .select({ customConfig: tenant.customConfig })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1);

  const customConfig = rows[0]?.customConfig;
  return normalizeTenantObservabilityTemplate(customConfig);
}

export async function registerGatewayRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/gateway/health", async (request, reply) => {
    return reply.status(200).send({
      platforms: platformHealthStore.listSnapshots(),
    });
  });

  fastify.get<{
    Querystring: {
      traceId?: string;
      spanId?: string;
      startTime?: string;
      endTime?: string;
    };
  }>("/observability/trace-url", async (request, reply) => {
    const traceId = request.query.traceId?.trim();
    if (!traceId) {
      const error = new GatewayError({
        statusCode: 400,
        type: "invalid_request_error",
        code: "invalid_request",
        message: "traceId is required",
        param: "traceId",
      });
      return reply.status(error.statusCode).send(buildGatewayErrorResponse(error, request.id));
    }

    const tenantId = (request.headers["x-tenant-id"] as string | undefined)?.trim();
    const tenantTemplate = tenantId ? await resolveTenantTemplate(request, tenantId) : null;
    const globalTemplate = process.env.OBSERVABILITY_URL_TEMPLATE?.trim() || null;
    const template = tenantTemplate ?? globalTemplate;

    if (!template) {
      return reply.status(200).send({
        traceId,
        url: null,
      });
    }

    const rendered = renderTemplate(template, {
      traceId,
      spanId: request.query.spanId?.trim() ?? "",
      startTime: request.query.startTime?.trim() ?? "",
      endTime: request.query.endTime?.trim() ?? "",
    });

    return reply.status(200).send({
      traceId,
      url: rendered,
    });
  });
}
