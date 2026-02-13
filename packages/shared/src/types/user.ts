/**
 * Shared User Types
 *
 * Type definitions for user entities used across frontend and backend
 */

import type { UserStatus } from "./auth.js";

/**
 * User profile data
 */
export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  phone: string | null;
  status: UserStatus;
  emailVerified: boolean;
  mfaEnabled: boolean;
  mfaForced: boolean;
  preferences: UserPreferences;
  lastActiveAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User preferences
 */
export interface UserPreferences {
  language?: string;
  timezone?: string;
  theme?: "light" | "dark" | "system";
}

/**
 * User update data
 */
export interface UserUpdateData {
  name?: string;
  avatarUrl?: string;
  phone?: string;
  preferences?: UserPreferences;
}

/**
 * User tenant membership
 */
export interface UserTenantMembership {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: "ROOT_ADMIN" | "TENANT_ADMIN" | "USER";
  expiresAt: Date | null;
  isDefault: boolean;
}

/**
 * User list item (for admin views)
 */
export interface UserListItem {
  id: string;
  email: string;
  name: string | null;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: Date;
  lastActiveAt: Date | null;
  tenantCount: number;
}

/**
 * User statistics
 */
export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  suspendedUsers: number;
  newUsersThisMonth: number;
}
