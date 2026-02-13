/**
 * Shared RBAC Types
 *
 * This package contains TypeScript types shared between frontend and backend
 * for the RBAC Authorization Model (S1-2).
 */

// Re-export all types from individual files
export * from './role.js';
export * from './permission.js';
export * from './permission-check.js';

/**
 * Grant Types
 */

export type GranteeType = 'group' | 'user';
export type GrantPermission = 'use' | 'deny';

export interface AppGrant {
  id: string;
  appId: string;
  granteeType: GranteeType;
  granteeId: string;
  permission: GrantPermission;
  reason: string | null;
  grantedBy: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface CreateAppGrantInput {
  appId: string;
  granteeType: GranteeType;
  granteeId: string;
  permission: GrantPermission;
  reason?: string;
  expiresAt?: Date;
}

export interface CreateDirectGrantInput extends CreateAppGrantInput {
  reason: string; // Required for direct user grants
  expiresAt: Date; // Required for direct user grants
}

/**
 * User Role Types
 */

export interface UserRole {
  userId: string;
  roleId: number;
  tenantId: string;
  expiresAt: Date | null;
  createdAt: Date;
  role?: Role; // Populated when joined
}

export interface AssignRoleInput {
  userId: string;
  roleId: number;
  tenantId: string;
  expiresAt?: Date;
}

/**
 * Break-glass Types
 */

export interface BreakglassActivateInput {
  tenantId: string;
  reason: string;
}

export interface BreakglassSession {
  sessionId: string;
  tenantId: string;
  expiresAt: Date;
  auditEventId: string;
}

export interface BreakglassStatus {
  isActive: boolean;
  tenantId: string | null;
  expiresAt: Date | null;
}

/**
 * Active Group Types
 */

export interface ActiveGroupContext {
  groupId: string;
  groupName: string;
  tenantId: string;
  hasAccess: boolean;
}

export interface AppContextOptions {
  currentGroup: ActiveGroupContext | null;
  availableGroups: ActiveGroupContext[];
  requiresSwitch: boolean;
}

/**
 * Notification Types
 */

export interface BreakglassNotification {
  id: string;
  type: 'breakglass_activated';
  message: string;
  metadata: {
    rootAdminId: string;
    reason: string;
    expiresAt: Date;
  };
  createdAt: Date;
  isRead: boolean;
}

export interface NotificationCount {
  total: number;
  breakglass: number;
  other: number;
}

/**
 * Error Types
 */

export interface RBACError {
  code: string;
  message: string;
  details?: unknown;
}

export const RBAC_ERROR_CODES = {
  INSUFFICIENT_PERMISSIONS: 'AFUI_IAM_001',
  ROLE_NOT_FOUND: 'AFUI_IAM_002',
  SYSTEM_ROLE_NOT_DELETABLE: 'AFUI_IAM_003',
  LAST_ADMIN_NOT_REMOVABLE: 'AFUI_IAM_004',
  GRANT_NOT_FOUND: 'AFUI_IAM_005',
  GRANT_EXPIRED: 'AFUI_IAM_006',
  ROOT_ADMIN_DISABLED: 'AFUI_IAM_007',
  BREAKGLASS_SESSION_EXPIRED: 'AFUI_IAM_008',
} as const;

// Import Role from role.ts for use here
import type { Role } from './role.js';
