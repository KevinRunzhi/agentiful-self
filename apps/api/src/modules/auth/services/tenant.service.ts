/**
 * Tenant Switch Service
 *
 * Handles switching between tenant contexts for multi-tenant users
 */

import { userRepository } from "../repositories/user.repository.ts";
import { tenantRepository } from "../repositories/tenant.repository.ts";

/**
 * Tenant switch result
 */
export interface TenantSwitchResult {
  success: boolean;
  session?: any;
  error?: string;
}

/**
 * Switch to a different tenant
 */
export async function switchTenant(
  userId: string,
  newTenantId: string
): Promise<TenantSwitchResult> {
  // Verify user exists
  const user = await userRepository.findById(userId);
  if (!user) {
    return { success: false, error: "User not found" };
  }

  // Verify tenant exists and is active
  const tenant = await tenantRepository.findById(newTenantId);
  if (!tenant) {
    return { success: false, error: "Tenant not found" };
  }

  if (tenant.status !== "active") {
    return { success: false, error: "Tenant is not active" };
  }

  // TODO: Verify user has access to this tenant via UserRole table

  // Create new session with new tenant context
  const newSession = {
    id: crypto.randomUUID(),
    userId,
    tenantId: newTenantId,
    token: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  };

  return {
    success: true,
    session: newSession,
  };
}

/**
 * Get available tenants for user
 */
export async function getUserTenants(userId: string) {
  const db = await import("@agentifui/db/client").then((m) => m.getDatabase());
  const { userRole, tenant } = await import("@agentifui/db/schema");
  const { eq } = await import("drizzle-orm");

  const results = await db
    .select({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      role: userRole.role,
    })
    .from(userRole)
    .innerJoin(tenant, eq(tenant.id, userRole.tenantId))
    .where(eq(userRole.userId, userId));

  return results;
}

/**
 * Get tenant by slug for login
 */
export async function getTenantForLogin(slug: string) {
  return tenantRepository.findBySlug(slug);
}
