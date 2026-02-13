/**
 * GroupMember Repository
 *
 * Data access layer for GroupMember entity
 */

import { eq, and, or, desc, asc, sql, inArray } from "drizzle-orm";
import { getDatabase } from "@agentifui/db/client";
import { groupMember, group, user } from "@agentifui/db/schema";
import type { GroupMember, NewGroupMember } from "@agentifui/db/schema";

/**
 * GroupMember with user details
 */
export interface GroupMemberWithUser extends GroupMember {
  userName: string;
  userEmail: string;
  groupName?: string;
}

/**
 * GroupMember repository
 */
export class GroupMemberRepository {
  /**
   * Get group member by ID
   */
  async findById(id: string): Promise<GroupMember | null> {
    const db = getDatabase();
    const [result] = await db
      .select()
      .from(groupMember)
      .where(eq(groupMember.id, id))
      .limit(1);
    return result || null;
  }

  /**
   * Get members of a group
   */
  async findByGroup(groupId: string): Promise<GroupMemberWithUser[]> {
    const db = getDatabase();

    return db
      .select({
        id: groupMember.id,
        groupId: groupMember.groupId,
        userId: groupMember.userId,
        role: groupMember.role,
        addedBy: groupMember.addedBy,
        addedAt: groupMember.addedAt,
        removedAt: groupMember.removedAt,
        removedBy: groupMember.removedBy,
        userName: user.name,
        userEmail: user.email,
        groupName: group.name,
      })
      .from(groupMember)
      .innerJoin(user, eq(groupMember.userId, user.id))
      .innerJoin(group, eq(groupMember.groupId, group.id))
      .where(eq(groupMember.groupId, groupId))
      .orderBy(asc(groupMember.addedAt));
  }

  /**
   * Get active members of a group (not removed)
   */
  async findActiveByGroup(groupId: string): Promise<GroupMemberWithUser[]> {
    const db = getDatabase();

    return db
      .select({
        id: groupMember.id,
        groupId: groupMember.groupId,
        userId: groupMember.userId,
        role: groupMember.role,
        addedBy: groupMember.addedBy,
        addedAt: groupMember.addedAt,
        removedAt: groupMember.removedAt,
        removedBy: groupMember.removedBy,
        userName: user.name,
        userEmail: user.email,
        groupName: group.name,
      })
      .from(groupMember)
      .innerJoin(user, eq(groupMember.userId, user.id))
      .innerJoin(group, eq(groupMember.groupId, group.id))
      .where(
        and(
          eq(groupMember.groupId, groupId),
          sql`${groupMember.removedAt} IS NULL`
        )
      )
      .orderBy(asc(groupMember.addedAt));
  }

  /**
   * Get user's memberships across groups
   */
  async findByUser(userId: string): Promise<Array<GroupMember & { groupName: string; tenantId: string }>> {
    const db = getDatabase();

    return db
      .select({
        id: groupMember.id,
        groupId: groupMember.groupId,
        userId: groupMember.userId,
        role: groupMember.role,
        addedBy: groupMember.addedBy,
        addedAt: groupMember.addedAt,
        removedAt: groupMember.removedAt,
        removedBy: groupMember.removedBy,
        groupName: group.name,
        tenantId: group.tenantId,
      })
      .from(groupMember)
      .innerJoin(group, eq(groupMember.groupId, group.id))
      .where(eq(groupMember.userId, userId))
      .orderBy(desc(groupMember.addedAt));
  }

  /**
   * Get user's active memberships
   */
  async findActiveByUser(userId: string): Promise<Array<GroupMember & { groupName: string; tenantId: string }>> {
    const db = getDatabase();

    return db
      .select({
        id: groupMember.id,
        groupId: groupMember.groupId,
        userId: groupMember.userId,
        role: groupMember.role,
        addedBy: groupMember.addedBy,
        addedAt: groupMember.addedAt,
        removedAt: groupMember.removedAt,
        removedBy: groupMember.removedBy,
        groupName: group.name,
        tenantId: group.tenantId,
      })
      .from(groupMember)
      .innerJoin(group, eq(groupMember.groupId, group.id))
      .where(
        and(
          eq(groupMember.userId, userId),
          sql`${groupMember.removedAt} IS NULL`
        )
      )
      .orderBy(desc(groupMember.addedAt));
  }

  /**
   * Get membership for a specific user and group
   */
  async findByUserAndGroup(userId: string, groupId: string): Promise<GroupMember | null> {
    const db = getDatabase();
    const [result] = await db
      .select()
      .from(groupMember)
      .where(
        and(
          eq(groupMember.userId, userId),
          eq(groupMember.groupId, groupId),
          sql`${groupMember.removedAt} IS NULL`
        )
      )
      .limit(1);
    return result || null;
  }

  /**
   * Add a member to a group
   */
  async create(data: NewGroupMember): Promise<GroupMember> {
    const db = getDatabase();
    const [result] = await db.insert(groupMember).values(data).returning();
    return result;
  }

  /**
   * Update a member's role
   */
  async updateRole(id: string, role: string): Promise<GroupMember | null> {
    const db = getDatabase();
    const [result] = await db
      .update(groupMember)
      .set({ role })
      .where(eq(groupMember.id, id))
      .returning();
    return result || null;
  }

  /**
   * Remove a member from a group (soft delete)
   */
  async remove(id: string, removedBy: string): Promise<GroupMember | null> {
    const db = getDatabase();
    const [result] = await db
      .update(groupMember)
      .set({ removedAt: new Date(), removedBy })
      .where(eq(groupMember.id, id))
      .returning();
    return result || null;
  }

  /**
   * Remove user from group by user and group ID
   */
  async removeUserFromGroup(userId: string, groupId: string, removedBy: string): Promise<boolean> {
    const db = getDatabase();
    const result = await db
      .update(groupMember)
      .set({ removedAt: new Date(), removedBy })
      .where(
        and(
          eq(groupMember.userId, userId),
          eq(groupMember.groupId, groupId),
          sql`${groupMember.removedAt} IS NULL`
        )
      );
    return result.rowCount > 0;
  }

  /**
   * Permanently delete a group member record
   */
  async delete(id: string): Promise<boolean> {
    const db = getDatabase();
    const result = await db.delete(groupMember).where(eq(groupMember.id, id));
    return result.rowCount > 0;
  }

  /**
   * Count active members in a group
   */
  async countActiveMembers(groupId: string): Promise<number> {
    const db = getDatabase();
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(groupMember)
      .where(
        and(
          eq(groupMember.groupId, groupId),
          sql`${groupMember.removedAt} IS NULL`
        )
      )
      .limit(1);
    return result?.count ?? 0;
  }

  /**
   * Count active groups for a user
   */
  async countActiveGroupsForUser(userId: string): Promise<number> {
    const db = getDatabase();
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(groupMember)
      .where(
        and(
          eq(groupMember.userId, userId),
          sql`${groupMember.removedAt} IS NULL`
        )
      )
      .limit(1);
    return result?.count ?? 0;
  }

  /**
   * Get members by role in a group
   */
  async findByGroupAndRole(groupId: string, role: string): Promise<GroupMemberWithUser[]> {
    const db = getDatabase();

    return db
      .select({
        id: groupMember.id,
        groupId: groupMember.groupId,
        userId: groupMember.userId,
        role: groupMember.role,
        addedBy: groupMember.addedBy,
        addedAt: groupMember.addedAt,
        removedAt: groupMember.removedAt,
        removedBy: groupMember.removedBy,
        userName: user.name,
        userEmail: user.email,
        groupName: group.name,
      })
      .from(groupMember)
      .innerJoin(user, eq(groupMember.userId, user.id))
      .innerJoin(group, eq(groupMember.groupId, group.id))
      .where(
        and(
          eq(groupMember.groupId, groupId),
          eq(groupMember.role, role),
          sql`${groupMember.removedAt} IS NULL`
        )
      )
      .orderBy(asc(groupMember.addedAt));
  }

  /**
   * Check if user has specific role in group
   */
  async hasRole(userId: string, groupId: string, role: string): Promise<boolean> {
    const db = getDatabase();
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(groupMember)
      .where(
        and(
          eq(groupMember.userId, userId),
          eq(groupMember.groupId, groupId),
          eq(groupMember.role, role),
          sql`${groupMember.removedAt} IS NULL`
        )
      )
      .limit(1);
    return (result?.count ?? 0) > 0;
  }

  /**
   * Get managers or admins of a group
   */
  async findLeaders(groupId: string): Promise<GroupMemberWithUser[]> {
    const db = getDatabase();

    return db
      .select({
        id: groupMember.id,
        groupId: groupMember.groupId,
        userId: groupMember.userId,
        role: groupMember.role,
        addedBy: groupMember.addedBy,
        addedAt: groupMember.addedAt,
        removedAt: groupMember.removedAt,
        removedBy: groupMember.removedBy,
        userName: user.name,
        userEmail: user.email,
        groupName: group.name,
      })
      .from(groupMember)
      .innerJoin(user, eq(groupMember.userId, user.id))
      .innerJoin(group, eq(groupMember.groupId, group.id))
      .where(
        and(
          eq(groupMember.groupId, groupId),
          inArray(groupMember.role, ["manager", "admin"]),
          sql`${groupMember.removedAt} IS NULL`
        )
      )
      .orderBy(asc(groupMember.addedAt));
  }
}

// Singleton instance
export const groupMemberRepository = new GroupMemberRepository();
