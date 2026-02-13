/**
 * Group Repository
 *
 * Data access layer for Group entity
 */

import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import { getDatabase } from "@agentifui/db/client";
import { group, groupMember } from "@agentifui/db/schema";
import type { Group, NewGroup } from "@agentifui/db/schema";

/**
 * Group repository
 */
export class GroupRepository {
  /**
   * Get group by ID
   */
  async findById(id: string): Promise<Group | null> {
    const db = getDatabase();
    const [result] = await db
      .select()
      .from(group)
      .where(eq(group.id, id))
      .limit(1);
    return result || null;
  }

  /**
   * Get groups by tenant ID
   */
  async findByTenantId(tenantId: string): Promise<Group[]> {
    const db = getDatabase();
    return db
      .select()
      .from(group)
      .where(eq(group.tenantId, tenantId))
      .orderBy(asc(group.sortOrder), asc(group.name));
  }

  /**
   * Get group by tenant ID and name
   */
  async findByTenantAndName(tenantId: string, name: string): Promise<Group | null> {
    const db = getDatabase();
    const [result] = await db
      .select()
      .from(group)
      .where(
        and(
          eq(group.tenantId, tenantId),
          eq(group.name, name)
        )
      )
      .limit(1);
    return result || null;
  }

  /**
   * Create a new group
   */
  async create(data: NewGroup): Promise<Group> {
    const db = getDatabase();
    const [result] = await db.insert(group).values(data).returning();
    return result;
  }

  /**
   * Update a group
   */
  async update(id: string, data: Partial<NewGroup>): Promise<Group | null> {
    const db = getDatabase();
    const [result] = await db
      .update(group)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(group.id, id))
      .returning();
    return result || null;
  }

  /**
   * Delete a group
   */
  async delete(id: string): Promise<boolean> {
    const db = getDatabase();
    const result = await db.delete(group).where(eq(group.id, id));
    return result.rowCount > 0;
  }

  /**
   * Get group with member count
   */
  async getWithMemberCount(id: string): Promise<(Group & { memberCount: number }) | null> {
    const db = getDatabase();

    const result = await db
      .select({
        id: group.id,
        tenantId: group.tenantId,
        name: group.name,
        description: group.description,
        sortOrder: group.sortOrder,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        memberCount: sql<number>`COUNT(DISTINCT ${groupMember.userId})`,
      })
      .from(group)
      .leftJoin(groupMember, and(
        eq(groupMember.groupId, group.id),
        sql`${groupMember.removedAt} IS NULL`
      ))
      .where(eq(group.id, id))
      .groupBy(group.id)
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get groups with member counts for a tenant
   */
  async getWithMemberCounts(tenantId: string): Promise<Array<Group & { memberCount: number }>> {
    const db = getDatabase();

    return db
      .select({
        id: group.id,
        tenantId: group.tenantId,
        name: group.name,
        description: group.description,
        sortOrder: group.sortOrder,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        memberCount: sql<number>`COUNT(DISTINCT ${groupMember.userId})`,
      })
      .from(group)
      .leftJoin(groupMember, and(
        eq(groupMember.groupId, group.id),
        sql`${groupMember.removedAt} IS NULL`
      ))
      .where(eq(group.tenantId, tenantId))
      .groupBy(group.id)
      .orderBy(asc(group.sortOrder), asc(group.name));
  }

  /**
   * Check if user is a member of a group
   */
  async isUserInGroup(groupId: string, userId: string): Promise<boolean> {
    const db = getDatabase();
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(groupMember)
      .where(
        and(
          eq(groupMember.groupId, groupId),
          eq(groupMember.userId, userId),
          sql`${groupMember.removedAt} IS NULL`
        )
      )
      .limit(1);
    return (result?.count ?? 0) > 0;
  }

  /**
   * Get groups where user is a member
   */
  async findByUserMember(userId: string, tenantId: string): Promise<Array<Group & { role: string }>> {
    const db = getDatabase();

    return db
      .select({
        id: group.id,
        tenantId: group.tenantId,
        name: group.name,
        description: group.description,
        sortOrder: group.sortOrder,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        role: groupMember.role,
      })
      .from(group)
      .innerJoin(groupMember, eq(groupMember.groupId, group.id))
      .where(
        and(
          eq(group.tenantId, tenantId),
          eq(groupMember.userId, userId),
          sql`${groupMember.removedAt} IS NULL`
        )
      )
      .orderBy(asc(group.sortOrder), asc(group.name));
  }

  /**
   * Update sort order for multiple groups
   */
  async updateSortOrder(updates: Array<{ id: string; sortOrder: number }>): Promise<void> {
    const db = getDatabase();

    for (const { id, sortOrder } of updates) {
      await db
        .update(group)
        .set({ sortOrder, updatedAt: new Date() })
        .where(eq(group.id, id));
    }
  }

  /**
   * Get total count of groups for a tenant
   */
  async countByTenant(tenantId: string): Promise<number> {
    const db = getDatabase();
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(group)
      .where(eq(group.tenantId, tenantId))
      .limit(1);
    return result?.count ?? 0;
  }
}

// Singleton instance
export const groupRepository = new GroupRepository();
