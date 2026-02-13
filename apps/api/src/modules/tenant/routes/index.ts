/**
 * Tenant Routes
 *
 * HTTP routes for tenant management endpoints
 */

import type { FastifyInstance } from "fastify";
import {
  getTenantHandler,
  getUserTenantsHandler,
  switchTenantHandler,
  updateTenantHandler,
  getTenantSettingsHandler,
} from "../controllers/tenant.controller.js";

/**
 * Register tenant routes
 */
export async function registerTenantRoutes(app: FastifyInstance): Promise<void> {
  const tenantBasePath = "/tenants";

  // ========================================
  // Tenant Queries
  // ========================================

  // Get tenant by ID or slug
  app.get(`${tenantBasePath}/:idOrSlug`, getTenantHandler);

  // Get tenant settings
  app.get(`${tenantBasePath}/:idOrSlug/settings`, getTenantSettingsHandler);

  // ========================================
  // User Tenant Operations
  // ========================================

  // Get user's accessible tenants
  app.get(`${tenantBasePath}`, getUserTenantsHandler);

  // Switch active tenant context
  app.post(`${tenantBasePath}/switch`, switchTenantHandler);

  // ========================================
  // Tenant Management
  // ========================================

  // Update tenant settings (admin only)
  app.patch(`${tenantBasePath}/:idOrSlug`, updateTenantHandler);
}
