/**
 * Audit Middleware
 *
 * Automatically logs authentication-related events
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { auditService, createAuditContext } from "../services/audit.service.js";

/**
 * Auth actions to log
 */
const AUTH_ACTIONS = {
  LOGIN: "login",
  LOGOUT: "logout",
  LOGIN_FAILED: "login.failed",
  SIGN_UP: "user.create",
  PASSWORD_CHANGE: "user.password.change",
  PASSWORD_RESET: "user.password.reset",
  MFA_ENABLE: "mfa.enable",
  MFA_DISABLE: "mfa.disable",
  MFA_VERIFY: "mfa.verify",
  MFA_VERIFY_FAILED: "mfa.verify.failed",
  SESSION_REFRESH: "session.refresh",
} as const;

/**
 * Extract user from request (after auth)
 */
function getRequestUser(request: FastifyRequest) {
  return (request as any).user;
}

/**
 * Extract tenant from request
 */
function getRequestTenant(request: FastifyRequest) {
  return (request as any).tenant;
}

/**
 * Audit middleware factory
 */
export function createAuditMiddleware(options: {
  logSuccess?: boolean;
  logFailure?: boolean;
}) {
  const { logSuccess = true, logFailure = true } = options;

  return async function auditMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Store original send to intercept response
    const originalSend = reply.raw.send.bind(reply.raw);

    let statusCode = 200;

    // Intercept response to get status code
    reply.raw.send = function (data: any) {
      statusCode = reply.statusCode;
      originalSend(data);
    } as any;

    // Continue with request
    const auditContext = createAuditContext({
      headers: request.headers as any,
      ip: request.ip,
      user: getRequestUser(request),
      tenant: getRequestTenant(request),
    });

    // Store audit context for later use
    (request as any).auditContext = auditContext;
  };
}

/**
 * On-response hook for logging
 */
export async function auditOnResponse(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const auditContext = (request as any).auditContext;
  if (!auditContext) return;

  // Determine if this was an auth-related request
  const url = request.routeOptions?.url || request.url;
  const isAuthRoute = url.startsWith("/auth/");
  const success = reply.statusCode < 400;

  // Only log auth events for now
  if (!isAuthRoute) return;

  const action = inferAuthAction(request, reply.statusCode);

  try {
    if (success) {
      await auditService.logSuccess({
        ...auditContext,
        action,
        resourceType: "session",
      });
    } else {
      await auditService.logFailure(
        {
          ...auditContext,
          action: inferFailureAction(request),
        },
        `HTTP ${reply.statusCode}`
      );
    }
  } catch (error) {
    // Don't fail request if audit logging fails
    request.log.error({ error }, "Failed to log audit event");
  }
}

/**
 * Infer auth action from request
 */
function inferAuthAction(request: FastifyRequest, statusCode: number): string {
  const method = request.method;
  const url = request.routeOptions?.url || request.url;

  if (url.includes("/sign-in")) return AUTH_ACTIONS.LOGIN;
  if (url.includes("/sign-up")) return AUTH_ACTIONS.SIGN_UP;
  if (url.includes("/sign-out")) return AUTH_ACTIONS.LOGOUT;
  if (url.includes("/forgot-password")) return AUTH_ACTIONS.PASSWORD_RESET;
  if (url.includes("/reset-password")) return AUTH_ACTIONS.PASSWORD_RESET;
  if (url.includes("/change-password")) return AUTH_ACTIONS.PASSWORD_CHANGE;
  if (url.includes("/mfa/enable")) return AUTH_ACTIONS.MFA_ENABLE;
  if (url.includes("/mfa/disable")) return AUTH_ACTIONS.MFA_DISABLE;
  if (url.includes("/mfa/verify")) {
    return statusCode >= 400 ? AUTH_ACTIONS.MFA_VERIFY_FAILED : AUTH_ACTIONS.MFA_VERIFY;
  }

  return "unknown";
}

/**
 * Infer failure action
 */
function inferFailureAction(request: FastifyRequest): string {
  const url = request.routeOptions?.url || request.url;

  if (url.includes("/sign-in")) return AUTH_ACTIONS.LOGIN_FAILED;
  if (url.includes("/mfa/verify")) return AUTH_ACTIONS.MFA_VERIFY_FAILED;

  return "unknown";
}

/**
 * Log login attempt
 */
export async function logLoginAttempt(
  request: FastifyRequest,
  success: boolean,
  userId?: string,
  errorMessage?: string
): Promise<void> {
  const auditContext = createAuditContext({
    headers: request.headers as any,
    ip: request.ip,
    user: userId ? { id: userId } : undefined,
    tenant: (request as any).tenant,
  });

  if (success) {
    await auditService.logSuccess({
      ...auditContext,
      action: AUTH_ACTIONS.LOGIN,
      resourceType: "session",
      resourceId: userId,
    });
  } else {
    await auditService.logFailure(
      {
        ...auditContext,
        action: AUTH_ACTIONS.LOGIN_FAILED,
        resourceType: "session",
      },
      errorMessage || "Authentication failed"
    );
  }
}

/**
 * Log logout
 */
export async function logLogout(request: FastifyRequest, userId: string): Promise<void> {
  const auditContext = createAuditContext({
    headers: request.headers as any,
    ip: request.ip,
    user: { id: userId },
    tenant: (request as any).tenant,
  });

  await auditService.logSuccess({
    ...auditContext,
    action: AUTH_ACTIONS.LOGOUT,
    resourceType: "session",
    resourceId: userId,
  });
}

/**
 * Log MFA verification
 */
export async function logMFAVerification(
  request: FastifyRequest,
  success: boolean,
  userId: string
): Promise<void> {
  const auditContext = createAuditContext({
    headers: request.headers as any,
    ip: request.ip,
    user: { id: userId },
    tenant: (request as any).tenant,
  });

  if (success) {
    await auditService.logSuccess({
      ...auditContext,
      action: AUTH_ACTIONS.MFA_VERIFY,
      resourceType: "mfa",
      resourceId: userId,
    });
  } else {
    await auditService.logFailure({
      ...auditContext,
      action: AUTH_ACTIONS.MFA_VERIFY_FAILED,
      resourceType: "mfa",
      resourceId: userId,
    }, "MFA verification failed");
  }
}
