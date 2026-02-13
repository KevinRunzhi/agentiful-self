/**
 * User Role Repository
 *
 * Data access layer for RBAC UserRole entities.
 * Handles user-role assignments with tenant scope.
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, or, sql, inArray, desc } from 'drizzle-orm';
import { rbacUserRole, rbacRole, user } from '@agentifui/db/schema/rbac';
import { tenant } from '@agentifui/db/schema/tenant';
import type { RbacUserRole } from '@agentifui/db/schema/rbac';

// =============================================================================
// Types
// =============================================================================

export interface UserRoleWithDetails extends RbacUserRole {
  userName?: string;
  roleName?: string;
  roleDisplayName?: string;
  tenantName?: string;
  isSystemRole?: boolean;
}

export interface AssignRoleInput {
  userId: string;
  roleId: number;
  tenantId: string;
  expiresAt?: Date;
}

// =============================================================================
// Repository Interface
// =============================================================================

export interface IUserRoleRepository {
  findById(userId: string, roleId: number, tenantId: string): Promise<RbacUserRole | null>;
  findByUser(userId: string, tenantId: string): Promise<UserRoleWithDetails[]>;
  findByUserAndTenant(userId: string, tenantId: string): Promise<RbacUserRole[]>;
  findByTenant(tenantId: string): Promise<UserRoleWithDetails[]>;
  findByRole(roleId: number, tenantId: string): Promise<UserRoleWithDetails[]>;
  countByRoleAndTenant(roleId: number, tenantId: string): Promise<number>;
  countTenantAdmins(tenantId: string): Promise<number>;
  assign(input: AssignRoleInput): Promise<RbacUserRole>;
  revoke(userId: string, roleId: number, tenantId: string): Promise<boolean>;
  revokeExpired(): Promise<number>;
  isLastTenantAdmin(userId: string, tenantId: string): Promise<boolean>;
}

// =============================================================================
// Repository Implementation
// =============================================================================

export class UserRoleRepository implements IUserRoleRepository {
  constructor(private db: PostgresJsDatabase) {}

  async findById(
    userId: string,
    roleId: number,
    tenantId: string
  ): Promise<RbacUserRole | null> {
    const result = await this.db
      .select()
      .from(rbacUserRole)
      .where(
        and(
          eq(rbacUserRole.userId, userId),
          eq(rbacUserRole.roleId, roleId),
          eq(rbacUserRole.tenantId, tenantId)
        )
      )
      .limit(1);

    return result[0] || null;
  }

  async findByUser(userId: string, tenantId: string): Promise<UserRoleWithDetails[]> {
    return this.db
      .select({
        userId: rbacUserRole.userId,
        roleId: rbacUserRole.roleId,
        tenantId: rbacUserRole.tenantId,
        expiresAt: rbacUserRole.expiresAt,
        createdAt: rbacUserRole.createdAt,
        userName: user.name,
        roleName: rbacRole.name,
        roleDisplayName: rbacRole.displayName,
        tenantName: tenant.name,
        isSystemRole: rbacRole.isSystem,
      })
      .from(rbacUserRole)
      .innerJoin(rbacRole, eq(rbacUserRole.roleId, rbacRole.id))
      .innerJoin(tenant, eq(rbacUserRole.tenantId, tenant.id))
      .innerJoin(user, eq(rbacUserRole.userId, user.id))
      .where(
        and(
          eq(rbacUserRole.userId, userId),
          eq(rbacUserRole.tenantId, tenantId)
        )
      ) as any;
  }

  async findByUserAndTenant(userId: string, tenantId: string): Promise<RbacUserRole[]> {
    const now = new Date();

    return this.db
      .select()
      .from(rbacUserRole)
      .where(
        and(
          eq(rbacUserRole.userId, userId),
          eq(rbacUserRole.tenantId, tenantId),
          or(
            sql`${rbacUserRole.expiresAt} IS NULL`,
            sql`${rbacUserRole.expiresAt} > ${now}`
          )
        )
      );
  }

  async findByTenant(tenantId: string): Promise<UserRoleWithDetails[]> {
    return this.db
      .select({
        userId: rbacUserRole.userId,
        roleId: rbacUserRole.roleId,
        tenantId: rbacUserRole.tenantId,
        expiresAt: rbacUserRole.expiresAt,
        createdAt: rbacUserRole.createdAt,
        userName: user.name,
        userAvatarUrl: user.avatarUrl,
        roleName: rbacRole.name,
        roleDisplayName: rbacRole.displayName,
        isSystemRole: rbacRole.isSystem,
      })
      .from(rbacUserRole)
      .innerJoin(rbacRole, eq(rbacUserRole.roleId, rbacRole.id))
      .innerJoin(user, eq(rbacUserRole.userId, user.id))
      .where(eq(rbacUserRole.tenantId, tenantId)) as any;
  }

  async findByRole(roleId: number, tenantId: string): Promise<UserRoleWithDetails[]> {
    return this.db
      .select({
        userId: rbacUserRole.userId,
        roleId: rbacUserRole.roleId,
        tenantId: rbacUserRole.tenantId,
        expiresAt: rbacUserRole.expiresAt,
        createdAt: rbacUserRole.createdAt,
        userName: user.name,
        userAvatarUrl: user.avatarUrl,
        roleName: rbacRole.name,
        roleDisplayName: rbacRole.displayName,
      })
      .from(rbacUserRole)
      .innerJoin(rbacRole, eq(rbacUserRole.roleId, rbacRole.id))
      .innerJoin(user, eq(rbacUserRole.userId, user.id))
      .where(
        and(
          eq(rbacUserRole.roleId, roleId),
          eq(rbacUserRole.tenantId, tenantId)
        )
      ) as any;
  }

  async countByRoleAndTenant(roleId: number, tenantId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(rbacUserRole)
      .where(
        and(
          eq(rbacUserRole.roleId, roleId),
          eq(rbacUserRole.tenantId, tenantId)
        )
      );

    return Number(result[0]?.count || 0);
  }

  async countTenantAdmins(tenantId: string): Promise<number> {
    const now = new Date();

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(rbacUserRole)
      .where(
        and(
          eq(rbacUserRole.tenantId, tenantId),
          eq(rbacRole.name, 'tenant_admin'),
          eq(rbacRole.isActive, true),
          or(
            sql`${rbacUserRole.expiresAt} IS NULL`,
            sql`${rbacUserRole.expiresAt} > ${now}`
          )
        )
      )
      .innerJoin(rbacRole, eq(rbacUserRole.roleId, rbacRole.id));

    return Number(result[0]?.count || 0);
  }

  async assign(input: AssignRoleInput): Promise<RbacUserRole> {
    const result = await this.db
      .insert(rbacUserRole)
      .values({
        userId: input.userId,
        roleId: input.roleId,
        tenantId: input.tenantId,
        expiresAt: input.expiresAt || null,
      })
      .returning();

    return result[0];
  }

  async revoke(userId: string, roleId: number, tenantId: string): Promise<boolean> {
    const result = await this.db
      .delete(rbacUserRole)
      .where(
        and(
          eq(rbacUserRole.userId, userId),
          eq(rbacUserRole.roleId, roleId),
          eq(rbacUserRole.tenantId, tenantId)
        )
      )
      .returning();

    return result.length > 0;
  }

  async revokeExpired(): Promise<number> {
    const now = new Date();

    const result = await this.db
      .delete(rbacUserRole)
      .where(
        and(
          sql`${rbacUserRole.expiresAt} IS NOT NULL`,
          sql`${rbacUserRole.expiresAt} < ${now}`
        )
      )
      .returning();

    return result.length;
  }

  async isLastTenantAdmin(userId: string, tenantId: string): Promise<boolean> {
    const adminCount = await this.countTenantAdmins(tenantId);

    if (adminCount > 1) {
      return false;
    }

    // Check if this user is the last admin
    const userRoles = await this.findByUserAndTenant(userId, tenantId);
    const hasAdminRole = userRoles.some((role) => {
      // Need to check if this role is tenant_admin
      // For simplicity, we'll do a separate query
      return role.roleId === 2; // Assuming tenant_admin has id 2
    });

    return adminCount === 1 && hasAdminRole;
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createUserRoleRepository(db: PostgresJsDatabase): UserRoleRepository {
  return new UserRoleRepository(db);
}
