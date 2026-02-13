/**
 * Grant Types
 *
 * Shared types for application grants (T070).
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
