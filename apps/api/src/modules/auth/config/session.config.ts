/**
 * Session Management Configuration
 *
 * Extends better-auth session handling with tenant context
 */

import type { Session } from "@agentifui/db/schema";

/**
 * Session token types
 */
export type SessionType = "access" | "refresh";

/**
 * Session TTL configuration
 */
export const SESSION_TTL = {
  ACCESS: 15 * 60, // 15 minutes in seconds
  REFRESH: 7 * 24 * 60 * 60, // 7 days in seconds
} as const;

/**
 * Create session with tenant context
 */
export interface CreateSessionOptions {
  userId: string;
  tenantId: string;
  expiresAt: Date;
  token: string;
}

/**
 * Session data structure
 */
export interface SessionData extends Session {
  tenantId: string;
  // Extended fields
  user?: {
    id: string;
    email: string;
    name: string | null;
  };
  tenant?: {
    id: string;
    name: string;
    slug: string;
  };
}

/**
 * Calculate session expiration based on type
 */
export function getSessionExpiration(type: SessionType): Date {
  const now = new Date();
  const ttl = type === "access" ? SESSION_TTL.ACCESS : SESSION_TTL.REFRESH;
  return new Date(now.getTime() + ttl * 1000);
}

/**
 * Validate session hasn't expired
 */
export function isSessionValid(expiresAt: Date): boolean {
  return new Date() < expiresAt;
}

/**
 * Check if session should be refreshed
 */
export function shouldRefreshSession(expiresAt: Date): boolean {
  // Refresh if less than 25% of TTL remaining
  const ttl = SESSION_TTL.ACCESS * 1000;
  const remaining = expiresAt.getTime() - Date.now();
  return remaining < ttl * 0.25;
}

/**
 * Extract session from request headers
 */
export function getSessionFromHeaders(headers: Headers): SessionData | null {
  const authorization = headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice(7);
  // TODO: Validate token and return session data
  return null;
}

/**
 * Create session token
 */
export function createSessionToken(): string {
  return crypto.randomUUID();
}
