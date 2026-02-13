/**
 * SSO Controller
 *
 * HTTP request handlers for SSO endpoints
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { ssoConfigRepository } from "../repositories/sso.repository";
import { detectSSOForEmail, extractDomain } from "../services/sso-detection.service";
import { invalidateAllDomainCache } from "../services/sso-detection.service";

/**
 * Get authenticated user from request
 */
function getUserId(request: FastifyRequest): string | null {
  return (request as any).user?.id || null;
}

/**
 * Get current tenant from request context
 */
function getTenantId(request: FastifyRequest): string | null {
  return (request as any).tenant?.id || null;
}

/**
 * Detect SSO provider for email
 */
export async function detectSSOHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { email } = request.body as { email: string };

  if (!email || !email.includes("@")) {
    return reply.status(400).send({
      error: { message: "Invalid email address", code: "INVALID_EMAIL" },
    });
  }

  const result = await detectSSOForEmail(email);

  reply.send({
    email,
    domain: extractDomain(email),
    sso: result.provider ? {
      provider: result.provider,
      tenantId: result.tenantId,
    } : null,
  });
}

/**
 * Get SSO configs for current tenant
 */
export async function getSSOConfigsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const tenantId = getTenantId(request);

  if (!tenantId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  const configs = await ssoConfigRepository.findByTenantId(tenantId);

  // Return without sensitive data
  const sanitized = configs.map((c) => ({
    id: c.id,
    provider: c.provider,
    domains: c.domains,
    enabled: c.enabled,
    jitProvisioning: c.jitProvisioning,
    jitAutoActivate: c.jitAutoActivate,
    defaultRole: c.defaultRole,
    attributeMapping: c.attributeMapping,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));

  reply.send({ configs: sanitized });
}

/**
 * Create SSO config
 */
export async function createSSOConfigHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const tenantId = getTenantId(request);

  if (!userId || !tenantId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  // Check if user is tenant admin
  // TODO: Verify admin permission

  const body = request.body as {
    provider: string;
    providerClientId: string;
    providerClientSecret: string;
    domains?: string[];
    scopes?: string[];
    jitProvisioning?: boolean;
    jitAutoActivate?: boolean;
    defaultRole?: string;
    attributeMapping?: Record<string, string>;
  };

  // Check if config for this provider already exists
  const existing = await ssoConfigRepository.findByTenantAndProvider(
    tenantId,
    body.provider
  );

  if (existing) {
    return reply.status(400).send({
      error: { message: "SSO config for this provider already exists", code: "DUPLICATE_PROVIDER" },
    });
  }

  const config = await ssoConfigRepository.create({
    tenantId,
    provider: body.provider,
    providerClientId: body.providerClientId,
    providerClientSecret: body.providerClientSecret,
    domains: body.domains || [],
    scopes: body.scopes || ["openid", "profile", "email"],
    jitProvisioning: body.jitProvisioning ?? true,
    jitAutoActivate: body.jitAutoActivate ?? true,
    defaultRole: body.defaultRole || "member",
    attributeMapping: body.attributeMapping || {},
    enabled: true,
  });

  // Invalidate domain cache
  await invalidateAllDomainCache();

  reply.status(201).send({
    id: config.id,
    provider: config.provider,
    domains: config.domains,
    enabled: config.enabled,
  });
}

/**
 * Update SSO config
 */
export async function updateSSOConfigHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const tenantId = getTenantId(request);
  const { configId } = request.params as { configId: string };

  if (!userId || !tenantId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  const body = request.body as {
    domains?: string[];
    scopes?: string[];
    enabled?: boolean;
    jitProvisioning?: boolean;
    jitAutoActivate?: boolean;
    defaultRole?: string;
    attributeMapping?: Record<string, string>;
    providerClientSecret?: string;
  };

  const config = await ssoConfigRepository.findById(configId);

  if (!config || config.tenantId !== tenantId) {
    return reply.status(404).send({
      error: { message: "SSO config not found", code: "NOT_FOUND" },
    });
  }

  const updated = await ssoConfigRepository.update(configId, body);

  // Invalidate domain cache
  await invalidateAllDomainCache();

  reply.send(updated);
}

/**
 * Delete SSO config
 */
export async function deleteSSOConfigHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const tenantId = getTenantId(request);
  const { configId } = request.params as { configId: string };

  if (!userId || !tenantId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  const config = await ssoConfigRepository.findById(configId);

  if (!config || config.tenantId !== tenantId) {
    return reply.status(404).send({
      error: { message: "SSO config not found", code: "NOT_FOUND" },
    });
  }

  await ssoConfigRepository.delete(configId);

  // Invalidate domain cache
  await invalidateAllDomainCache();

  reply.status(204).send();
}
