/**
 * Permission Repository
 *
 * Data access layer for Permission entities.
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, or, sql, inArray } from 'drizzle-orm';
import { permission, rolePermission, rbacRole } from '@agentifui/db/schema/rbac';
import type { Permission } from '@agentifui/db/schema/rbac';

// =============================================================================
// Repository Interface
// =============================================================================

export interface IPermissionRepository {
  findAll(activeOnly?: boolean): Promise<Permission[]>;
  findById(id: number): Promise<Permission | null>;
  findByCode(code: string): Promise<Permission | null>;
  findByCategory(category: string, activeOnly?: boolean): Promise<Permission[]>;
  findByCodes(codes: string[]): Promise<Permission[]>;
  create(data: {
    code: string;
    name: string;
    category: string;
    isActive?: boolean;
  }): Promise<Permission>;
  update(
    id: number,
    data: Partial<{
      name: string;
      category: string;
      isActive: boolean;
    }>
  ): Promise<Permission | null>;
  delete(id: number): Promise<boolean>;
}

// =============================================================================
// Repository Implementation
// =============================================================================

export class PermissionRepository implements IPermissionRepository {
  constructor(private db: PostgresJsDatabase) {}

  async findAll(activeOnly = false): Promise<Permission[]> {
    const query = this.db.select().from(permission);

    if (activeOnly) {
      return query.where(eq(permission.isActive, true));
    }

    return query;
  }

  async findById(id: number): Promise<Permission | null> {
    const result = await this.db
      .select()
      .from(permission)
      .where(eq(permission.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findByCode(code: string): Promise<Permission | null> {
    const result = await this.db
      .select()
      .from(permission)
      .where(eq(permission.code, code))
      .limit(1);

    return result[0] || null;
  }

  async findByCategory(category: string, activeOnly = false): Promise<Permission[]> {
    const conditions = [eq(permission.category, category)];

    if (activeOnly) {
      conditions.push(eq(permission.isActive, true));
    }

    return this.db
      .select()
      .from(permission)
      .where(and(...conditions));
  }

  async findByCodes(codes: string[]): Promise<Permission[]> {
    if (codes.length === 0) return [];

    return this.db
      .select()
      .from(permission)
      .where(inArray(permission.code, codes));
  }

  async create(data: {
    code: string;
    name: string;
    category: string;
    isActive?: boolean;
  }): Promise<Permission> {
    const result = await this.db
      .insert(permission)
      .values({
        code: data.code,
        name: data.name,
        category: data.category,
        isActive: data.isActive !== false,
      })
      .returning();

    return result[0];
  }

  async update(
    id: number,
    data: Partial<{
      name: string;
      category: string;
      isActive: boolean;
    }>
  ): Promise<Permission | null> {
    const result = await this.db
      .update(permission)
      .set(data)
      .where(eq(permission.id, id))
      .returning();

    return result[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(permission)
      .where(eq(permission.id, id))
      .returning();

    return result.length > 0;
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createPermissionRepository(db: PostgresJsDatabase): PermissionRepository {
  return new PermissionRepository(db);
}
