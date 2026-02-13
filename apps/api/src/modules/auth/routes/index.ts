/**
 * Authentication Routes Index
 *
 * Routes for authentication with custom controllers
 * (better-auth + custom logic for account lockout, tenant context)
 */

import type { FastifyInstance } from "fastify";
import {
  signInHandler,
  signOutHandler,
  getSessionHandler,
  acceptInvitationHandler,
  changePasswordHandler,
  checkLockoutHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
} from "../controllers/auth.controller.js";

/**
 * Register authentication routes
 */
export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const authBasePath = "/auth";

  // ========================================
  // Email/Password Authentication
  // ========================================

  // Sign in with email and password (custom handler with account lockout)
  app.post(`${authBasePath}/sign-in`, signInHandler);

  // Sign out
  app.post(`${authBasePath}/sign-out`, signOutHandler);

  // ========================================
  // Session Management
  // ========================================

  // Get current session
  app.get(`${authBasePath}/session`, getSessionHandler);

  // ========================================
  // Invitation Flow
  // ========================================

  // Accept invitation and create account
  app.post(`${authBasePath}/accept-invitation`, acceptInvitationHandler);

  // ========================================
  // Password Management
  // ========================================

  // Change password (authenticated)
  app.post(`${authBasePath}/change-password`, changePasswordHandler);

  // Check account lockout status
  app.post(`${authBasePath}/check-lockout`, checkLockoutHandler);

  // Forgot password (initiate reset flow)
  app.post(`${authBasePath}/forgot-password`, forgotPasswordHandler);

  // Reset password with token
  app.post(`${authBasePath}/reset-password`, resetPasswordHandler);
}
