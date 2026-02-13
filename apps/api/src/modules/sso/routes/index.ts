/**
 * SSO Routes
 *
 * HTTP routes for SSO management and OAuth callbacks
 */

import type { FastifyInstance } from "fastify";
import {
  detectSSOHandler,
  getSSOConfigsHandler,
  createSSOConfigHandler,
  updateSSOConfigHandler,
  deleteSSOConfigHandler,
} from "../controllers/sso.controller.js";

/**
 * Register SSO routes
 */
export async function registerSSORoutes(app: FastifyInstance): Promise<void> {
  const ssoBasePath = "/sso";

  // ========================================
  // SSO Detection
  // ========================================

  // Detect SSO provider for email
  app.post(`${ssoBasePath}/detect`, detectSSOHandler);

  // ========================================
  // SSO Config Management
  // ========================================

  // Get all SSO configs for current tenant
  app.get(`${ssoBasePath}/configs`, getSSOConfigsHandler);

  // Create SSO config
  app.post(`${ssoBasePath}/configs`, createSSOConfigHandler);

  // Update SSO config
  app.patch(`${ssoBasePath}/configs/:configId`, updateSSOConfigHandler);

  // Delete SSO config
  app.delete(`${ssoBasePath}/configs/:configId`, deleteSSOConfigHandler);

  // ========================================
  // OAuth Callbacks
  // ========================================
  // Note: OAuth callbacks are handled by better-auth
  // These are registered in the auth.config.ts file
}
