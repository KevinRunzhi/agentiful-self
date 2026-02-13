/**
 * Shared Authentication Types
 *
 * Type definitions used across frontend and backend for authentication
 */

/**
 * Authentication session data
 */
export interface AuthSession {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    status: UserStatus;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  } | null;
  token: string;
  expiresAt: Date;
}

/**
 * Authentication response
 */
export interface AuthResponse {
  session: AuthSession | null;
  user: AuthSession["user"] | null;
  error?: string;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
  tenantSlug?: string;
}

/**
 * Registration data
 */
export interface RegisterData {
  email: string;
  password: string;
  name: string;
  token: string; // Invitation token
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  email: string;
  tenantSlug?: string;
}

/**
 * Password reset confirmation
 */
export interface PasswordResetConfirm {
  token: string;
  password: string;
}

/**
 * User status enum
 */
export type UserStatus = "active" | "pending" | "suspended" | "rejected";

/**
 * Role enum
 */
export type Role = "ROOT_ADMIN" | "TENANT_ADMIN" | "USER";

/**
 * Permission check result
 */
export interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * MFA configuration
 */
export interface MFAConfig {
  enabled: boolean;
  forced: boolean;
  verifiedAt: Date | null;
}

/**
 * Session info for display
 */
export interface SessionInfo {
  id: string;
  tenantId: string;
  tenantName: string;
  createdAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
}

/**
 * Token payload
 */
export interface TokenPayload {
  userId: string;
  tenantId: string;
  role: Role;
  exp: number;
  iat: number;
}
