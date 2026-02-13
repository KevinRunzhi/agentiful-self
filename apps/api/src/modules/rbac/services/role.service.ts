/**
 * Role Service
 *
 * Service for managing RBAC roles (T032-T034).
 * Handles role operations including system role protection.
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, sql } from 'drizzle-orm';
import { rbacRole, rbacUserRole } from '@agentifui/db/schema/rbac';
import { createRoleRepository, type IRoleRepository } from '../repositories/role.repository';
import type { RbacRole } from '@agentifui/db/schema/rbac';

// =============================================================================
// Types
// =============================================================================

export interface CreateRoleInput {
  name: string;
  displayName: string;
  description?: string;
  isSystem?: boolean;
}

export interface UpdateRoleInput {
  displayName?: string;
  description?: string;
  isActive?: boolean;
}

export interface RoleWithPermissions extends RbacRole {
  permissions: Array<{
    id: number;
    code: string;
    name: string;
    category: string;
  }>;
}

// =============================================================================
// Role Service Interface
// =============================================================================

export interface IRoleService {
  /**
   * T032 [P] [US1] Implement getRoles method
   * Get all roles, optionally filtering by active status
   */
  getRoles(activeOnly?: boolean): Promise<RbacRole[]>;

  /**
   * T033 [P] [US1] Implement getRoleById method
   * Get role by ID with permissions
   */
  getRoleById(id: number): Promise<RoleWithPermissions | null>;

  /**
   * T034 [US1] Implement system role deletion protection
   * Check if role is a system role that cannot be deleted
   */
  isSystemRole(id: number): Promise<boolean>;

  /**
   * Check if role can be deleted
   * Throws error if role is a system role
   */
  canDeleteRole(id: number): Promise<void>;

  /**
   * Get role by name
   */
  getRoleByName(name: string): Promise<RbacRole | null>;

  /**
   * Create a new role
   */
  createRole(input: CreateRoleInput): Promise<RbacRole>;

  /**
   * Update a role
   */
  updateRole(id: number, input: UpdateRoleInput): Promise<RbacRole | null>;

  /**
   * Delete a role (with system role protection)
   */
  deleteRole(id: number): Promise<boolean>;

  /**
   * Check if role has any users assigned
   */
  hasAssignedUsers(id: number): Promise<boolean>;
}

// =============================================================================
// Role Service Implementation
// =============================================================================

export class RoleService implements IRoleService {
  constructor(
    private db: PostgresJsDatabase,
    private roleRepo: IRoleRepository
  ) {}

  /**
   * T032 [P] [US1] Implement getRoles method
   */
  async getRoles(activeOnly = false): Promise<RbacRole[]> {
    return this.roleRepo.findAll(activeOnly);
  }

  /**
   * T033 [P] [US1] Implement getRoleById method
   */
  async getRoleById(id: number): Promise<RoleWithPermissions | null> {
    const role = await this.roleRepo.findById(id);

    if (!role) {
      return null;
    }

    const permissions = await this.roleRepo.getPermissions(id);

    return {
      ...role,
      permissions: permissions.map((p: any) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        category: p.category,
      })),
    };
  }

  /**
   * T034 [US1] Implement system role deletion protection (isSystem=true check)
   */
  async isSystemRole(id: number): Promise<boolean> {
    const role = await this.roleRepo.findById(id);

    if (!role) {
      return false;
    }

    return role.isSystem === true;
  }

  /**
   * Check if role can be deleted
   * Throws error if role is a system role
   */
  async canDeleteRole(id: number): Promise<void> {
    const isSystem = await this.isSystemRole(id);

    if (isSystem) {
      throw new Error('System roles cannot be deleted');
    }

    // Check if role has assigned users
    const hasUsers = await this.hasAssignedUsers(id);
    if (hasUsers) {
      throw new Error('Cannot delete role with assigned users');
    }
  }

  async getRoleByName(name: string): Promise<RbacRole | null> {
    return this.roleRepo.findByName(name);
  }

  async createRole(input: CreateRoleInput): Promise<RbacRole> {
    // Check if role name already exists
    const existing = await this.roleRepo.findByName(input.name);
    if (existing) {
      throw new Error(`Role with name "${input.name}" already exists`);
    }

    return this.roleRepo.create({
      name: input.name,
      displayName: input.displayName,
      description: input.description,
      isSystem: input.isSystem || false,
      isActive: true,
    });
  }

  async updateRole(id: number, input: UpdateRoleInput): Promise<RbacRole | null> {
    const role = await this.roleRepo.findById(id);
    if (!role) {
      throw new Error('Role not found');
    }

    // System roles cannot be deactivated
    if (role.isSystem && input.isActive === false) {
      throw new Error('System roles cannot be deactivated');
    }

    // Only certain fields can be updated for system roles
    if (role.isSystem) {
      // For system roles, only allow updating displayName and description
      return this.roleRepo.update(id, {
        displayName: input.displayName,
        description: input.description,
      });
    }

    return this.roleRepo.update(id, input);
  }

  async deleteRole(id: number): Promise<boolean> {
    await this.canDeleteRole(id);
    return this.roleRepo.delete(id);
  }

  async hasAssignedUsers(id: number): Promise<boolean> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(rbacUserRole)
      .where(eq(rbacUserRole.roleId, id));

    const count = Number(result[0]?.count || 0);
    return count > 0;
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createRoleService(db: PostgresJsDatabase): RoleService {
  const roleRepo = createRoleRepository(db);
  return new RoleService(db, roleRepo);
}
