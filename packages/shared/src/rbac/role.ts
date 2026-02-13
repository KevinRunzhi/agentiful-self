/**
 * Shared RBAC Role Types (T048)
 */

export type RoleName = 'root_admin' | 'tenant_admin' | 'user';

export interface Role {
  id: number;
  name: RoleName;
  displayName: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateRoleInput {
  name: string;
  displayName: string;
  description?: string;
  isSystem?: boolean;
  isActive?: boolean;
}

export interface UpdateRoleInput {
  displayName?: string;
  description?: string;
  isActive?: boolean;
}
