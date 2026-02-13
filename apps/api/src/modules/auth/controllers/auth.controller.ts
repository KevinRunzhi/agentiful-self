/**
 * Authentication Controller
 *
 * HTTP request handlers for authentication endpoints
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { auth as betterAuth } from "../auth.config.js";
import { signIn, signOut } from "../services/auth.service.js";
import { acceptInvitation } from "../services/invitation.service.js";
import { changePassword } from "../services/password.service.js";
import { accountLockoutService } from "../services/account-lockout.service.js";

/**
 * Sign in with email and password
 */
export async function signInHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { email, password, tenantSlug } = request.body as {
    email: string;
    password: string;
    tenantSlug?: string;
  };

  const result = await signIn(
    { email, password, tenantSlug },
    { ip: request.ip, headers: request.headers }
  );

  if (!result.success) {
    return reply.status(401).send({
      error: {
        message: result.error || "Authentication failed",
        code: "INVALID_CREDENTIALS",
      },
    });
  }

  reply.send(result);
}

/**
 * Sign out
 */
export async function signOutHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const sessionId = (request as any).session?.id;

  await signOut(sessionId || "");

  reply.send({ success: true });
}

/**
 * Get current session
 */
export async function getSessionHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const session = await betterAuth.api.getSession({
    headers: request.headers as any,
  });

  if (!session) {
    return reply.status(401).send({
      error: {
        message: "Not authenticated",
        code: "NOT_AUTHENTICATED",
      },
    });
  }

  reply.send(session);
}

/**
 * Accept invitation and create account
 */
export async function acceptInvitationHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { token, password, name } = request.body as {
    token: string;
    password: string;
    name: string;
  };

  const result = await acceptInvitation(token, password, name);

  if (!result.success) {
    return reply.status(400).send({
      error: {
        message: result.error || "Failed to accept invitation",
        code: "INVITATION_ERROR",
      },
    });
  }

  reply.send({
    success: true,
    userId: result.userId,
  });
}

/**
 * Change password
 */
export async function changePasswordHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = (request as any).user?.id;
  if (!userId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  const { currentPassword, newPassword } = request.body as {
    currentPassword: string;
    newPassword: string;
  };

  const result = await changePassword(userId, currentPassword, newPassword);

  if (!result.success) {
    return reply.status(400).send({
      error: {
        message: result.error || "Failed to change password",
        code: "PASSWORD_CHANGE_FAILED",
      },
    });
  }

  reply.send({ success: true });
}

/**
 * Check lockout status
 */
export async function checkLockoutHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { email } = request.body as { email: string };

  const isLocked = await accountLockoutService.isLocked(email);
  const remainingAttempts = await accountLockoutService.getRemainingAttempts(email);

  reply.send({
    isLocked,
    remainingAttempts: isLocked ? 0 : remainingAttempts,
    lockoutTimeRemaining: isLocked
      ? await accountLockoutService.getLockoutTimeRemaining(email)
      : 0,
    maxAttempts: 5,
  });
}

/**
 * Send password reset email
 */
export async function forgotPasswordHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { email, tenantSlug } = request.body as {
    email: string;
    tenantSlug?: string;
  };

  // TODO: Implement password reset email sending

  reply.send({
    success: true,
    message: "If an account exists with this email, a password reset link has been sent.",
  });
}

/**
 * Reset password with token
 */
export async function resetPasswordHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { token, newPassword } = request.body as {
    token: string;
    newPassword: string;
  };

  // TODO: Verify token and update password

  reply.send({ success: true });
}
