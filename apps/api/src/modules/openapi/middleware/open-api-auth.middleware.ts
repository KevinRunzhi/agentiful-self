import type { FastifyReply, FastifyRequest } from "fastify";

export interface OpenApiApiKeyAuthenticator {
  authenticate(rawKey: string, tenantIdHint?: string): Promise<{
    keyId: string;
    tenantId: string;
    principalId: string;
    rateLimitRpm: number;
  } | null>;
}

export interface OpenApiOAuthAuthenticator {
  authenticate(token: string): Promise<{
    tenantId: string;
    principalId: string;
    rateLimitRpm?: number;
  } | null>;
}

export interface OpenApiAuthContext {
  tenantId: string;
  principalId: string;
  authType: "api_key" | "oauth2";
  rateLimitRpm: number;
}

function readSingleHeaderValue(value: string | string[] | undefined): string | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }
  const [scheme, token] = authorizationHeader.split(/\s+/, 2);
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }
  return token.trim() || null;
}

export function createOpenApiAuthPreHandler(input: {
  apiKeyAuthenticator: OpenApiApiKeyAuthenticator;
  oauthAuthenticator?: OpenApiOAuthAuthenticator;
}) {
  return async function openApiAuthPreHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authorization = readSingleHeaderValue(request.headers.authorization);
    const xApiKey = readSingleHeaderValue(request.headers["x-api-key"] as string | string[] | undefined);
    const bearerToken = extractBearerToken(authorization);
    const candidateToken = xApiKey ?? bearerToken;
    const tenantIdHint = readSingleHeaderValue(request.headers["x-tenant-id"] as string | string[] | undefined) ?? undefined;

    if (!candidateToken) {
      reply.status(401).send({
        error: {
          code: "OPEN_API_AUTH_REQUIRED",
          message: "Missing API key or bearer token",
        },
      });
      return;
    }

    if (candidateToken.startsWith("ak_")) {
      const authenticated = await input.apiKeyAuthenticator.authenticate(candidateToken, tenantIdHint);
      if (!authenticated) {
        reply.status(401).send({
          error: {
            code: "OPEN_API_INVALID_API_KEY",
            message: "Invalid API key",
          },
        });
        return;
      }

      (request as any).openApiAuth = {
        tenantId: authenticated.tenantId,
        principalId: authenticated.principalId,
        authType: "api_key",
        rateLimitRpm: authenticated.rateLimitRpm,
      } satisfies OpenApiAuthContext;
      return;
    }

    if (!input.oauthAuthenticator) {
      reply.status(401).send({
        error: {
          code: "OPEN_API_OAUTH_UNSUPPORTED",
          message: "OAuth2 token is not supported in current deployment",
        },
      });
      return;
    }

    const oauth = await input.oauthAuthenticator.authenticate(candidateToken);
    if (!oauth) {
      reply.status(401).send({
        error: {
          code: "OPEN_API_INVALID_TOKEN",
          message: "Invalid OAuth2 token",
        },
      });
      return;
    }

    (request as any).openApiAuth = {
      tenantId: oauth.tenantId,
      principalId: oauth.principalId,
      authType: "oauth2",
      rateLimitRpm: oauth.rateLimitRpm ?? 60,
    } satisfies OpenApiAuthContext;
  };
}
