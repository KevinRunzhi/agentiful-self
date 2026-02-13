/**
 * User Role Service
 *
 * Service for managing user-role assignments (T035-T037).
 * Handles role assignment/removal with tenant admin protection.
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, sql, or } from 'drizzle-orm';
import { rbacRole, rbacUserRole } from '@agentifui/db/schema/rbac';
import { createUserRoleRepository, type IUserRoleRepository } from '../repositories/user-role.repository';
import { createRoleRepository } from '../repositories/role.repository';
import type { RbacUserRole } from '@agentifui/db/schema/rbac';

// =============================================================================
// Types
// =============================================================================

export interface AssignRoleInput {
  userId: string;
  roleId: number;
  tenantId: string;
  expiresAt?: Date;
  grantedBy?: string;
}

export interface RemoveRoleInput {
  userId: string;
  roleId: number;
  tenantId: string;
  removedBy?: string;
}

export interface UserRoleWithDetails extends RbacUserRole {
  userName?: string;
  roleName?: string;
  roleDisplayName?: string;
  tenantName?: string;
  isSystemRole?: boolean;
}

// =============================================================================
// User Role Service Interface
// =============================================================================

export interface IUserRoleService {
  /**
   * T035 [US1] Implement assignRoleToUser method
   * Assign a role to a user in a tenant context
   */
  assignRoleToUser(input: AssignRoleInput): Promise<RbacUserRole>;

  /**
   * T036 [US1] Implement removeRoleFromUser method
   * Remove a role from a user in a tenant context
   */
  removeRoleFromUser(input: RemoveRoleInput): Promise<boolean>;

  /**
   * T037 [US1] Implement last Tenant Admin protection
   * Check if removing this role would leave tenant with no admins
   */
  isLastTenantAdmin(userId: string, tenantId: string): Promise<boolean>;

  /**
   * Get all roles for a user in a tenant
   */
  getUserRoles(userId: string, tenantId: string): Promise<UserRoleWithDetails[]>;

  /**
   * Get all users with a specific role in a tenant
   */
  getUsersByRole(roleId: number, tenantId: string): Promise<UserRoleWithDetails[]>;

  /**
   * Check if user has a specific role
   */
  hasRole(userId: string, tenantId: string, roleName: string): Promise<boolean>;

  /**
   * Revoke expired roles
   */
  revokeExpiredRoles(): Promise<number>;
}

// =============================================================================
// User Role Service Implementation
// =============================================================================

export class UserRoleService implements IUserRoleService {
  constructor(
    private db: PostgresJsDatabase,
    private userRoleRepo: IUserRoleRepository
  ) {}

  /**
   * T035 [US1] Implement assignRoleToUser method
   */
  async assignRoleToUser(input: AssignRoleInput): Promise<RbacUserRole> {
    // Verify role exists
    const roleRepo = createRoleRepository(this.db);
    const role = await roleRepo.findById(input.roleId);

    if (!role) {
      throw new Error('Role not found');
    }

    if (!role.isActive) {
      throw new Error('Cannot assign inactive role');
    }

    // Check if user already has this role in the tenant
    const existing = await this.userRoleRepo.findById(
      input.userId,
      input.roleId,
      input.tenantId
    );

    if (existing) {
      // Update expiration if provided
      if (input.expiresAt !== undefined) {
        const updated = await this.db
          .update(rbacUserRole)
          .set({ expiresAt: input.expiresAt })
          .where(
            and(
              eq(rbacUserRole.userId, input.userId),
              eq(rbacUserRole.roleId, input.roleId),
              eq(rbacUserRole.tenantId, input.tenantId)
            )
          )
          .returning();

        return updated[0];
      }

      return existing;
    }

    // Create new role assignment
    return this.userRoleRepo.assign({
      userId: input.userId,
      roleId: input.roleId,
      tenantId: input.tenantId,
      expiresAt: input.expiresAt,
    });
  }

  /**
   * T036 [US1] Implement removeRoleFromUser method
   */
  async removeRoleFromUser(input: RemoveRoleInput): Promise<boolean> {
    // Verify the role assignment exists
    const existing = await this.userRoleRepo.findById(
      input.userId,
      input.roleId,
      input.tenantId
    );

    if (!existing) {
      throw new Error('User does not have this role in the tenant');
    }

    // T037 [US1] Implement last Tenant Admin protection
    // Check if this is the last tenant admin
    const roleRepo = createRoleRepository(this.db);
    const role = await roleRepo.findById(input.roleId);

    if (role?.name === 'tenant_admin') {
      const isLastAdmin = await this.isLastTenantAdmin(input.userId, input.tenantId);
      if (isLastAdmin) {
        throw new Error('Cannot remove the last Tenant Admin. Assign another admin first.');
      }
    }

    return this.userRoleRepo.revoke(input.userId, input.roleId, input.tenantId);
  }

  /**
   * T037 [US1] Implement last Tenant Admin protection (check count before remove)
   */
  async isLastTenantAdmin(userId: string, tenantId: string): Promise<boolean> {
    const adminCount = await this.userRoleRepo.countTenantAdmins(tenantId);

    if (adminCount > 1) {
      return false;
    }

    // Check if this user is the last admin
    const userRoles = await this.userRoleRepo.findByUserAndTenant(userId, tenantId);
    const roleRepo = createRoleRepository(this.db);
    const tenantAdminRole = await roleRepo.findByName('tenant_admin');

    if (!tenantAdminRole) {
      return false;
    }

    const hasAdminRole = userRoles.some((r) => r.roleId === tenantAdminRole.id);

    return adminCount === 1 && hasAdminRole;
  }

  async getUserRoles(
    userId: string,
    tenantId: string
  ): Promise<UserRoleWithDetails[]> {
    return this.userRoleRepo.findByUser(userId, tenantId);
  }

  async getUsersByRole(
    roleId: number,
    tenantId: string
  ): Promise<UserRoleWithDetails[]> {
    return this.userRoleRepo.findByRole(roleId, tenantId);
  }

  async hasRole(
    userId: string,
    tenantId: string,
    roleName: string
  ): Promise<boolean> {
    const now = new Date();

    const result = await this.db
      .select({ id: rbacRole.id })
      .from(rbacUserRole)
      .innerJoin(rbacRole, eq(rbacUserRole.roleId, rbacRole.id))
      .where(
        and(
          eq(rbacUserRole.userId, userId),
          eq(rbacUserRole.tenantId, tenantId),
          eq(rbacRole.name, roleName),
          eq(rbacRole.isActive, true),
          or(
            sql`${rbacUserRole.expiresAt} IS NULL`,
            sql`${rbacUserRole.expiresAt} > ${now}`
          )
        )
      )
      .limit(1);

    return result.length > 0;
  }

  async revokeExpiredRoles(): Promise<number> {
    return this.userRoleRepo.revokeExpired();
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createUserRoleService(db: PostgresJsDatabase): UserRoleService {
  const userRoleRepo = createUserRoleRepository(db);
  return new UserRoleService(db, userRoleRepo);
}
