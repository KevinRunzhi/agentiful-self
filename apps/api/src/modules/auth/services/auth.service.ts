/**
 * Authentication Service
 *
 * Core authentication logic for login, session management
 */

import { userRepository } from "../repositories/user.repository.ts";
import { userRoleRepository } from "../repositories/user-role.repository.ts";
import { tenantRepository } from "../repositories/tenant.repository.ts";
import { verifyPassword, changePassword as changeUserPassword } from "./password.service.js";
import { accountLockoutService } from "./account-lockout.service.js";
import { logLoginAttempt } from "../../middleware/audit.middleware.js";
import type { LoginResult, SessionData } from "@agentifui/shared/types";

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
  tenantSlug?: string;
}

/**
 * Login result
 */
export interface LoginResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    status: string;
  };
  session?: SessionData;
  tenants?: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
  }>;
  error?: string;
}

/**
 * User roles with tenant info
 */
interface UserRoleWithTenant {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: string;
}

/**
 * Sign in with email and password
 */
export async function signIn(
  credentials: LoginCredentials,
  request: { ip?: string; headers?: any }
): Promise<LoginResult> {
  const { email, password, tenantSlug } = credentials;

  // Find user by email
  const user = await userRepository.findByEmail(email);

  if (!user) {
    // Log failed attempt
    await logLoginAttempt(request as any, false, undefined, "User not found");

    // Check account lockout (even if user doesn't exist, prevent email enumeration)
    const isLocked = await accountLockoutService.isLocked(email);
    if (isLocked) {
      return {
        success: false,
        error: "Account is temporarily locked due to too many failed attempts. Please try again later.",
      };
    }

    // Record failed attempt
    await accountLockoutService.recordFailedAttempt(email);

    return {
      success: false,
      error: "Invalid email or password",
    };
  }

  // Check account lockout
  const isLocked = await accountLockoutService.isLocked(email);
  if (isLocked) {
    return {
      success: false,
      error: "Account is temporarily locked due to too many failed attempts. Please try again later or reset your password.",
    };
  }

  // Check user status
  if (user.status === "suspended") {
    return { success: false, error: "Account has been suspended" };
  }

  if (user.status === "rejected") {
    return { success: false, error: "Account has been rejected" };
  }

  // Verify password
  const passwordMatch = await verifyPassword(password, user.passwordHash || "");
  if (!passwordMatch) {
    await logLoginAttempt(request as any, false, user.id, "Invalid password");

    // Record failed attempt
    await accountLockoutService.recordFailedAttempt(email);

    return {
      success: false,
      error: "Invalid email or password",
    };
  }

  // Clear lockout on successful login
  await accountLockoutService.clearLockout(email);

  // Log successful login
  await logLoginAttempt(request as any, true, user.id);

  // Get user's tenant memberships
  const userRoles = await getUserTenantRoles(user.id);

  if (userRoles.length === 0) {
    return {
      success: false,
      error: "User has no tenant access. Please contact an administrator.",
    };
  }

  // If tenantSlug specified, validate access
  let selectedTenant = userRoles[0];
  if (tenantSlug) {
    const tenantRole = userRoles.find((r) => r.tenantSlug === tenantSlug);
    if (!tenantRole) {
      return {
        success: false,
        error: `You do not have access to tenant: ${tenantSlug}`,
      };
    }
    selectedTenant = tenantRole;
  }

  // Update last active
  await userRepository.updateLastActive(user.id);

  // Create session (TODO: Implement actual session creation)
  const session = {
    id: crypto.randomUUID(),
    userId: user.id,
    tenantId: selectedTenant.tenantId,
    token: crypto.randomUUID(), // TODO: Generate proper JWT
    expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
  };

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      status: user.status,
    },
    session,
    tenants: userRoles.map((r) => ({
      id: r.tenantId,
      name: r.tenantName,
      slug: r.tenantSlug,
      role: r.role,
    })),
  };
}

/**
 * Get user's tenant memberships
 */
async function getUserTenantRoles(
  userId: string
): Promise<UserRoleWithTenant[]> {
  const db = await import("@agentifui/db/client").then((m) => m.getDatabase());
  const { userRole, tenant } = await import("@agentifui/db/schema");
  { eq } = await import("drizzle-orm");

  const results = await db
    .select({
      tenantId: userRole.tenantId,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      role: userRole.role,
    })
    .from(userRole)
    .innerJoin(tenant, eq(tenant.id, userRole.tenantId))
    .where(eq(userRole.userId, userId));

  return results;
}

/**
 * Sign out
 */
export async function signOut(sessionId: string): Promise<void> {
  // TODO: Implement session invalidation
  // await sessionService.revoke(sessionId);
}

/**
 * Refresh session
 */
export async function refreshSession(refreshToken: string): Promise<LoginResult | null> {
  // TODO: Implement refresh token validation and session renewal
  return null;
}

/**
 * Change password
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  tenantConfig?: any
): Promise<{ success: boolean; error?: string }> {
  const user = await userRepository.findById(userId);
  if (!user) {
    return { success: false, error: "User not found" };
  }

  return changeUserPassword(
    userId,
    currentPassword,
    newPassword,
    user.passwordHash || "",
    tenantConfig
  );
}

/**
 * Get session by token
 */
export async function getSessionByToken(token: string): Promise<SessionData | null> {
  // TODO: Implement session lookup from token
  return null;
}

/**
 * Get user tenants
 */
export async function getUserTenants(userId: string) {
  return getUserTenantRoles(userId);
}
