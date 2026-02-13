/**
 * User Role Repository
 *
 * Data access layer for UserRole entity
 */

import { eq, and } from "drizzle-orm";
import { getDatabase } from "@agentifui/db/client";
import { userRole } from "@agentifui/db/schema";
import type { UserRole, NewUserRole } from "@agentifui/db/schema";

/**
 * User Role repository
 */
export class UserRoleRepository {
  /**
   * Get user roles for a user
   */
  async findByUserId(userId: string): Promise<Array<UserRole & { tenantName: string; tenantSlug: string }>> {
    const db = getDatabase();
    const { tenant } = await import("@agentifui/db/schema");

    const results = await db
      .select({
        id: userRole.id,
        userId: userRole.userId,
        tenantId: userRole.tenantId,
        role: userRole.role,
        expiresAt: userRole.expiresAt,
        createdAt: userRole.createdAt,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
      })
      .from(userRole)
      .innerJoin(tenant, eq(tenant.id, userRole.tenantId))
      .where(eq(userRole.userId, userId));

    return results;
  }

  /**
   * Get user role for specific tenant
   */
  async findByUserAndTenant(userId: string, tenantId: string): Promise<UserRole | null> {
    const db = getDatabase();
    const [result] = await db
      .select()
      .from(userRole)
      .where(
        and(
          eq(userRole.userId, userId),
          eq(userRole.tenantId, tenantId)
        )
      )
      .limit(1);

    return result || null;
  }

  /**
   * Create user role
   */
  async create(data: NewUserRole): Promise<UserRole> {
    const db = getDatabase();
    const [result] = await db.insert(userRole).values(data).returning();
    return result;
  }

  /**
   * Delete user role
   */
  async delete(id: string): Promise<boolean> {
    const db = getDatabase();
    const result = await db.delete(userRole).where(eq(userRole.id, id));
    return result.rowCount > 0;
  }

  /**
   * Delete all user roles for a tenant
   */
  async deleteByTenant(tenantId: string): Promise<number> {
    const db = getDatabase();
    const result = await db.delete(userRole).where(eq(userRole.tenantId, tenantId));
    return result.rowCount;
  }

  /**
   * Check if user has role in tenant
   */
  async hasRole(userId: string, tenantId: string, role?: string): Promise<boolean> {
    const conditions = [
      eq(userRole.userId, userId),
      eq(userRole.tenantId, tenantId),
    ];

    if (role) {
      conditions.push(eq(userRole.role, role));
    }

    // Check for non-expired role
    conditions.push(sql`(${userRole.expiresAt} IS NULL OR ${userRole.expiresAt} > NOW())`);

    const db = getDatabase();
    const [result] = await db
      .select()
      .from(userRole)
      .where(and(...conditions))
      .limit(1);

    return !!result;
  }
}

// Singleton instance
export const userRoleRepository = new UserRoleRepository();

// Helper function for raw SQL
import { sql } from "drizzle-orm";
