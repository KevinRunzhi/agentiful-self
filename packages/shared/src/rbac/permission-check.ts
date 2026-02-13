/**
 * Shared RBAC Permission Check Types (T050)
 */

export interface PermissionCheckInput {
  userId: string;
  tenantId: string;
  activeGroupId: string | null;
  resourceType: string;
  action: string;
  resourceId?: string;
  traceId?: string;
}

export interface PermissionCheckOutput {
  allowed: boolean;
  reason: PermissionDenialReason | PermissionAllowReason;
  matchedGrant?: MatchedGrant;
}

export type PermissionDenialReason =
  | 'default_deny'
  | 'explicit_deny'
  | 'expired_grant'
  | 'invalid_context'
  | 'root_admin_disabled';

export type PermissionAllowReason =
  | 'role_permission'
  | 'group_grant'
  | 'user_grant'
  | 'manager_role'
  | 'breakglass';

export interface MatchedGrant {
  grantId: string;
  grantType: 'group' | 'user' | 'role';
  source: string;
}

export interface BatchPermissionCheck {
  resourceType: string;
  action: string;
  resourceId?: string;
}

export interface BatchPermissionCheckResult {
  allowed: boolean;
  reason: PermissionDenialReason | PermissionAllowReason;
}
