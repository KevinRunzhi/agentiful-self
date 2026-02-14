import type { FastifyInstance, FastifyRequest } from "fastify";
import { createOpenApiAuthPreHandler } from "../middleware/open-api-auth.middleware.js";

export interface OpenApiDataService {
  listUsers(input: { tenantId: string; limit: number }): Promise<Array<Record<string, unknown>>>;
  listGroups(input: { tenantId: string; limit: number }): Promise<Array<Record<string, unknown>>>;
  listConversations(input: { tenantId: string; limit: number }): Promise<Array<Record<string, unknown>>>;
  getQuotaSummary(input: { tenantId: string }): Promise<Record<string, unknown>>;
}

export interface OpenApiRoutesOptions {
  apiKeyAuthenticator: {
    authenticate(rawKey: string, tenantIdHint?: string): Promise<{
      keyId: string;
      tenantId: string;
      principalId: string;
      rateLimitRpm: number;
    } | null>;
  };
  oauthAuthenticator?: {
    authenticate(token: string): Promise<{
      tenantId: string;
      principalId: string;
      rateLimitRpm?: number;
    } | null>;
  };
  dataService: OpenApiDataService;
}

function getAuthContext(request: FastifyRequest): {
  tenantId: string;
  principalId: string;
  authType: "api_key" | "oauth2";
  rateLimitRpm: number;
} {
  const auth = (request as any).openApiAuth as {
    tenantId: string;
    principalId: string;
    authType: "api_key" | "oauth2";
    rateLimitRpm: number;
  } | null;

  if (!auth) {
    throw new Error("Open API auth context missing");
  }

  return auth;
}

function normalizeLimit(value: unknown, fallback = 50, max = 200): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(max, Math.floor(parsed));
}

export async function registerOpenApiRoutes(
  fastify: FastifyInstance,
  options: OpenApiRoutesOptions
): Promise<void> {
  const authPreHandler = createOpenApiAuthPreHandler({
    apiKeyAuthenticator: options.apiKeyAuthenticator,
    oauthAuthenticator: options.oauthAuthenticator,
  });

  fastify.get<{ Querystring: { limit?: number } }>(
    "/open-api/v1/users",
    { preHandler: authPreHandler },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const data = await options.dataService.listUsers({
        tenantId: auth.tenantId,
        limit: normalizeLimit(request.query.limit),
      });
      reply.send({ data, meta: { tenantId: auth.tenantId, authType: auth.authType } });
    }
  );

  fastify.get<{ Querystring: { limit?: number } }>(
    "/open-api/v1/groups",
    { preHandler: authPreHandler },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const data = await options.dataService.listGroups({
        tenantId: auth.tenantId,
        limit: normalizeLimit(request.query.limit),
      });
      reply.send({ data, meta: { tenantId: auth.tenantId, authType: auth.authType } });
    }
  );

  fastify.get<{ Querystring: { limit?: number } }>(
    "/open-api/v1/conversations",
    { preHandler: authPreHandler },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const data = await options.dataService.listConversations({
        tenantId: auth.tenantId,
        limit: normalizeLimit(request.query.limit),
      });
      reply.send({ data, meta: { tenantId: auth.tenantId, authType: auth.authType } });
    }
  );

  fastify.get(
    "/open-api/v1/quota/summary",
    { preHandler: authPreHandler },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const data = await options.dataService.getQuotaSummary({
        tenantId: auth.tenantId,
      });
      reply.send({ data, meta: { tenantId: auth.tenantId, authType: auth.authType } });
    }
  );
}
