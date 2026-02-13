/**
 * Authentication Routes
 *
 * better-auth API endpoints with tenant context support
 */

import type { FastifyInstance } from "fastify";
import { auth } from "../auth.config.js";

/**
 * Register authentication routes
 */
export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const authBasePath = "/auth";

  // ========================================
  // Email/Password Authentication
  // ========================================

  // Sign up with email and password
  app.post(`${authBasePath}/sign-up`, async (request, reply) => {
    const session = await auth.api.signUpEmail({
      body: request.body as any,
    });

    return reply.send(session);
  });

  // Sign in with email and password
  app.post(`${authBasePath}/sign-in`, async (request, reply) => {
    const session = await auth.api.signInEmail({
      body: request.body as any,
    });

    return reply.send(session);
  });

  // Sign out
  app.post(`${authBasePath}/sign-out`, async (request, reply) => {
    const result = await auth.api.signOut({
      headers: request.headers as any,
    });

    return reply.send(result);
  });

  // ========================================
  // Session Management
  // ========================================

  // Get current session
  app.get(`${authBasePath}/session`, async (request, reply) => {
    const session = await auth.api.getSession({
      headers: request.headers as any,
    });

    return reply.send(session);
  });

  // Refresh session
  app.post(`${authBasePath}/session/refresh`, async (request, reply) => {
    const session = await auth.api.refreshSession({
      headers: request.headers as any,
      body: request.body as any,
    });

    return reply.send(session);
  });

  // ========================================
  // Password Management
  // ========================================

  // Forgot password
  app.post(`${authBasePath}/forgot-password`, async (request, reply) => {
    const result = await auth.api.forgetPassword({
      body: request.body as any,
    });

    return reply.send(result);
  });

  // Reset password
  app.post(`${authBasePath}/reset-password`, async (request, reply) => {
    const result = await auth.api.resetPassword({
      body: request.body as any,
    });

    return reply.send(result);
  });

  // Change password
  app.post(`${authBasePath}/change-password`, async (request, reply) => {
    const result = await auth.api.changePassword({
      body: request.body as any,
      headers: request.headers as any,
    });

    return reply.send(result);
  });

  // ========================================
  // Email Verification
  // ========================================

  // Send verification email
  app.post(`${authBasePath}/verify-email`, async (request, reply) => {
    const result = await auth.api.sendVerificationEmail({
      body: request.body as any,
      headers: request.headers as any,
    });

    return reply.send(result);
  });

  // Verify email with token
  app.get(`${authBasePath}/verify-email/:token`, async (request, reply) => {
    const result = await auth.api.verifyEmail({
      query: request.query as any,
    });

    return reply.send(result);
  });

  // ========================================
  // Two-Factor Authentication
  // ========================================

  // Enable MFA
  app.post(`${authBasePath}/mfa/enable`, async (request, reply) => {
    const result = await auth.api.enableTwoFactor({
      body: request.body as any,
      headers: request.headers as any,
    });

    return reply.send(result);
  });

  // Disable MFA
  app.post(`${authBasePath}/mfa/disable`, async (request, reply) => {
    const result = await auth.api.disableTwoFactor({
      headers: request.headers as any,
    });

    return reply.send(result);
  });

  // Verify MFA
  app.post(`${authBasePath}/mfa/verify`, async (request, reply) => {
    const result = await auth.api.verifyTwoFactor({
      body: request.body as any,
    });

    return reply.send(result);
  });

  // ========================================
  // OAuth/SSO Callbacks
  // ========================================

  // OAuth callback handler
  app.get(`${authBasePath}/callback/:provider`, async (request, reply) => {
    // better-auth handles OAuth callbacks
    const result = await auth.api.callbackOAuth({
      query: request.query as any,
      headers: request.headers as any,
    });

    return reply.send(result);
  });
}
