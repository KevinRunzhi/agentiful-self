/**
 * Tenant Repository
 *
 * Data access layer for Tenant entity
 */

import { eq, and, or, desc, sql } from "drizzle-orm";
import { getDatabase } from "@agentifui/db/client";
import { tenant } from "@agentifui/db/schema";
import type { Tenant, NewTenant } from "@agentifui/db/schema";

/**
 * Tenant repository
 */
export class TenantRepository {
  /**
   * Find tenant by ID
   */
  async findById(id: string): Promise<Tenant | null> {
    const db = getDatabase();
    const [result] = await db.select().from(tenant).where(eq(tenant.id, id)).limit(1);
    return result || null;
  }

  /**
   * Find tenant by slug
   */
  async findBySlug(slug: string): Promise<Tenant | null> {
    const db = getDatabase();
    const [result] = await db.select().from(tenant).where(eq(tenant.slug, slug)).limit(1);
    return result || null;
  }

  /**
   * Find tenant by ID or slug
   */
  async findByIdOrSlug(identifier: string): Promise<Tenant | null> {
    const db = getDatabase();
    const [result] = await db
      .select()
      .from(tenant)
      .where(or(eq(tenant.id, identifier), eq(tenant.slug, identifier)))
      .limit(1);
    return result || null;
  }

  /**
   * Create new tenant
   */
  async create(data: NewTenant): Promise<Tenant> {
    const db = getDatabase();
    const [result] = await db.insert(tenant).values(data).returning();
    return result;
  }

  /**
   * Update tenant
   */
  async update(id: string, data: Partial<NewTenant>): Promise<Tenant | null> {
    const db = getDatabase();
    const [result] = await db
      .update(tenant)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tenant.id, id))
      .returning();
    return result || null;
  }

  /**
   * Get all tenants
   */
  async findAll(limit = 100, offset = 0): Promise<Tenant[]> {
    const db = getDatabase();
    return db
      .select()
      .from(tenant)
      .orderBy(desc(tenant.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get active tenants
   */
  async findActive(limit = 100): Promise<Tenant[]> {
    const db = getDatabase();
    return db
      .select()
      .from(tenant)
      .where(eq(tenant.status, "active"))
      .orderBy(desc(tenant.createdAt))
      .limit(limit);
  }

  /**
   * Check if slug exists
   */
  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const db = getDatabase();

    const conditions = excludeId
      ? and(eq(tenant.slug, slug), sql`${tenant.id} != ${excludeId}`)
      : eq(tenant.slug, slug);

    const [result] = await db.select().from(tenant).where(conditions).limit(1);
    return !!result;
  }

  /**
   * Update tenant status
   */
  async updateStatus(id: string, status: "active" | "suspended"): Promise<void> {
    const db = getDatabase();
    await db
      .update(tenant)
      .set({ status, updatedAt: new Date() })
      .where(eq(tenant.id, id));
  }

  /**
   * Delete tenant (soft delete by suspending)
   */
  async delete(id: string): Promise<boolean> {
    const db = getDatabase();
    const result = await db
      .update(tenant)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(tenant.id, id));
    return result.rowCount > 0;
  }

  /**
   * Get tenant user count
   */
  async getUserCount(tenantId: string): Promise<number> {
    const db = getDatabase();
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sql`user_role`)
      .where(sql`tenant_id = ${tenantId}`);

    return result?.count || 0;
  }

  /**
   * Get tenant statistics
   */
  async getStats(tenantId: string): Promise<{
    userCount: number;
    groupCount: number;
  }> {
    const db = getDatabase();

    const [userCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sql`user_role`)
      .where(sql`tenant_id = ${tenantId}`);

    const [groupCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sql`"group"`)
      .where(sql`tenant_id = ${tenantId}`);

    return {
      userCount: userCountResult?.count || 0,
      groupCount: groupCountResult?.count || 0,
    };
  }
}

// Singleton instance
export const tenantRepository = new TenantRepository();
