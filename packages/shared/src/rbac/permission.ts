/**
 * Shared RBAC Permission Types (T049)
 */

export interface Permission {
  id: number;
  code: string;
  name: string;
  category: string;
  isActive: boolean;
  createdAt: Date;
}

export type PermissionCategory = 'tenant' | 'group' | 'app' | 'conversation';

export const PERMISSION_CATEGORIES = {
  TENANT: 'tenant',
  GROUP: 'group',
  APP: 'app',
  CONVERSATION: 'conversation',
} as const;
