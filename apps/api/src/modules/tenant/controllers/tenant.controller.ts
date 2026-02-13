/**
 * Tenant Controller
 *
 * HTTP request handlers for tenant management endpoints
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { tenantRepository } from "../repositories/tenant.repository.ts";
import { switchTenant, getUserTenants } from "../services/tenant.service.js";

/**
 * Get tenant by ID or slug
 */
export async function getTenantHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { idOrSlug } = request.params as { idOrSlug: string };

  const tenant = await tenantRepository.findByIdOrSlug(idOrSlug);

  if (!tenant) {
    return reply.status(404).send({
      error: {
        message: "Tenant not found",
        code: "TENANT_NOT_FOUND",
      },
    });
  }

  // Get tenant statistics
  const stats = await tenantRepository.getStats(tenant.id);

  reply.send({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    plan: tenant.plan,
    customConfig: tenant.customConfig,
    stats,
  });
}

/**
 * Get user's accessible tenants
 */
export async function getUserTenantsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = (request as any).user?.id;

  if (!userId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  const tenants = await getUserTenants(userId);

  reply.send({ tenants });
}

/**
 * Switch tenant context
 */
export async function switchTenantHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = (request as any).user?.id;

  if (!userId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  const { tenantId } = request.body as { tenantId: string };

  const result = await switchTenant(userId, tenantId);

  if (!result.success) {
    return reply.status(400).send({
      error: {
        message: result.error || "Failed to switch tenant",
        code: "TENANT_SWITCH_FAILED",
      },
    });
  }

  reply.send(result);
}

/**
 * Update tenant settings
 */
export async function updateTenantHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { idOrSlug } = request.params as { idOrSlug: string };
  const { name, customConfig } = request.body as {
    name?: string;
    customConfig?: Record<string, unknown>;
  };

  const tenant = await tenantRepository.findByIdOrSlug(idOrSlug);

  if (!tenant) {
    return reply.status(404).send({
      error: {
        message: "Tenant not found",
        code: "TENANT_NOT_FOUND",
      },
    });
  }

  // Check if user is admin for this tenant
  const userId = (request as any).user?.id;
  // TODO: Verify admin permission

  const updated = await tenantRepository.update(tenant.id, {
    name,
    customConfig: customConfig as any,
  });

  if (!updated) {
    return reply.status(500).send({
      error: {
        message: "Failed to update tenant",
        code: "TENANT_UPDATE_FAILED",
      },
    });
  }

  reply.send(updated);
}

/**
 * Get tenant settings
 */
export async function getTenantSettingsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { idOrSlug } = request.params as { idOrSlug: string };

  const tenant = await tenantRepository.findByIdOrSlug(idOrSlug);

  if (!tenant) {
    return reply.status(404).send({
      error: {
        message: "Tenant not found",
        code: "TENANT_NOT_FOUND",
      },
    });
  }

  reply.send({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    customConfig: tenant.customConfig,
  });
}
