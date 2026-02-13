/**
 * Role Repository
 *
 * Data access layer for RBAC Role entities.
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, or, sql, desc } from 'drizzle-orm';
import { rbacRole, permission, rolePermission } from '@agentifui/db/schema/rbac';
import type { RbacRole } from '@agentifui/db/schema/rbac';

// =============================================================================
// Repository Interface
// =============================================================================

export interface IRoleRepository {
  findAll(activeOnly?: boolean): Promise<RbacRole[]>;
  findById(id: number): Promise<RbacRole | null>;
  findByName(name: string): Promise<RbacRole | null>;
  create(data: {
    name: string;
    displayName: string;
    description?: string;
    isSystem?: boolean;
    isActive?: boolean;
  }): Promise<RbacRole>;
  update(
    id: number,
    data: Partial<{
      displayName: string;
      description: string;
      isActive: boolean;
    }>
  ): Promise<RbacRole | null>;
  delete(id: number): Promise<boolean>;
  getPermissions(roleId: number): Promise<any[]>;
}

// =============================================================================
// Repository Implementation
// =============================================================================

export class RoleRepository implements IRoleRepository {
  constructor(private db: PostgresJsDatabase) {}

  async findAll(activeOnly = false): Promise<RbacRole[]> {
    const query = this.db.select().from(rbacRole);

    if (activeOnly) {
      return query.where(eq(rbacRole.isActive, true)).orderBy(desc(rbacRole.id));
    }

    return query.orderBy(desc(rbacRole.id));
  }

  async findById(id: number): Promise<RbacRole | null> {
    const result = await this.db
      .select()
      .from(rbacRole)
      .where(eq(rbacRole.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findByName(name: string): Promise<RbacRole | null> {
    const result = await this.db
      .select()
      .from(rbacRole)
      .where(eq(rbacRole.name, name))
      .limit(1);

    return result[0] || null;
  }

  async create(data: {
    name: string;
    displayName: string;
    description?: string;
    isSystem?: boolean;
    isActive?: boolean;
  }): Promise<RbacRole> {
    const result = await this.db
      .insert(rbacRole)
      .values({
        name: data.name,
        displayName: data.displayName,
        description: data.description || null,
        isSystem: data.isSystem || false,
        isActive: data.isActive !== false,
      })
      .returning();

    return result[0];
  }

  async update(
    id: number,
    data: Partial<{
      displayName: string;
      description: string;
      isActive: boolean;
    }>
  ): Promise<RbacRole | null> {
    const result = await this.db
      .update(rbacRole)
      .set(data)
      .where(eq(rbacRole.id, id))
      .returning();

    return result[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(rbacRole)
      .where(eq(rbacRole.id, id))
      .returning();

    return result.length > 0;
  }

  async getPermissions(roleId: number): Promise<any[]> {
    return this.db
      .select({
        id: permission.id,
        code: permission.code,
        name: permission.name,
        category: permission.category,
        isActive: permission.isActive,
      })
      .from(rolePermission)
      .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
      .where(eq(rolePermission.roleId, roleId));
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createRoleRepository(db: PostgresJsDatabase): RoleRepository {
  return new RoleRepository(db);
}
