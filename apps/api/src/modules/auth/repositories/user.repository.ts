/**
 * User Repository
 *
 * Data access layer for User entity
 */

import { eq, and, or, desc } from "drizzle-orm";
import { getDatabase } from "@agentifui/db/client";
import { user, userRole } from "@agentifui/db/schema";
import type { User, NewUser } from "@agentifui/db/schema";

/**
 * User repository
 */
export class UserRepository {
  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    const db = getDatabase();
    const [result] = await db.select().from(user).where(eq(user.id, id)).limit(1);
    return result || null;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const db = getDatabase();
    const [result] = await db.select().from(user).where(eq(user.email, email)).limit(1);
    return result || null;
  }

  /**
   * Create new user
   */
  async create(data: NewUser): Promise<User> {
    const db = getDatabase();
    const [result] = await db.insert(user).values(data).returning();
    return result;
  }

  /**
   * Update user
   */
  async update(id: string, data: Partial<NewUser>): Promise<User | null> {
    const db = getDatabase();
    const [result] = await db
      .update(user)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(user.id, id))
      .returning();
    return result || null;
  }

  /**
   * Delete user (soft delete by setting status)
   */
  async delete(id: string): Promise<boolean> {
    const db = getDatabase();
    const result = await db
      .update(user)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(user.id, id));
    return result.rowCount > 0;
  }

  /**
   * Get users by tenant (via UserRole)
   */
  async findByTenant(tenantId: string, limit = 50, offset = 0): Promise<User[]> {
    const db = getDatabase();

    const users = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        status: user.status,
        emailVerified: user.emailVerified,
        mfaEnabled: user.mfaEnabled,
        mfaForced: user.mfaForced,
        preferences: user.preferences,
        lastActiveAt: user.lastActiveAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .innerJoin(userRole, eq(userRole.userId, user.id))
      .where(eq(userRole.tenantId, tenantId))
      .limit(limit)
      .offset(offset);

    return users;
  }

  /**
   * Get user with tenant roles
   */
  async findByIdWithRoles(id: string): Promise<User & { roles: Array<{ tenantId: string; role: string }> } | null> {
    const db = getDatabase();
    const [userResult] = await db.select().from(user).where(eq(user.id, id)).limit(1);

    if (!userResult) return null;

    const roles = await db
      .select({
        tenantId: userRole.tenantId,
        role: userRole.role,
      })
      .from(userRole)
      .where(eq(userRole.userId, id));

    return { ...userResult, roles };
  }

  /**
   * Update last active timestamp
   */
  async updateLastActive(id: string): Promise<void> {
    const db = getDatabase();
    await db
      .update(user)
      .set({ lastActiveAt: new Date() })
      .where(eq(user.id, id));
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string, excludeUserId?: string): Promise<boolean> {
    const db = getDatabase();

    const conditions = excludeUserId
      ? and(eq(user.email, email), eq(user.id, excludeUserId))
      : eq(user.email, email);

    const [result] = await db.select().from(user).where(conditions).limit(1);
    return !!result;
  }

  /**
   * Get users by status
   */
  async findByStatus(status: string, limit = 100): Promise<User[]> {
    const db = getDatabase();
    return db
      .select()
      .from(user)
      .where(eq(user.status, status))
      .limit(limit);
  }

  /**
   * Search users by name or email
   */
  async search(query: string, tenantId?: string, limit = 20): Promise<User[]> {
    const db = getDatabase();
    const searchPattern = `${query}%`;

    if (tenantId) {
      return db
        .select({
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          phone: user.phone,
          status: user.status,
          emailVerified: user.emailVerified,
          mfaEnabled: user.mfaEnabled,
          mfaForced: user.mfaForced,
          preferences: user.preferences,
          lastActiveAt: user.lastActiveAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        })
        .from(user)
        .innerJoin(userRole, eq(userRole.userId, user.id))
        .where(
          and(
            eq(userRole.tenantId, tenantId),
            or(
              sql`LOWER(${user.name}) LIKE ${searchPattern}`,
              sql`LOWER(${user.email}) LIKE ${searchPattern}`
            )
          )
        )
        .limit(limit);
    }

    return db
      .select()
      .from(user)
      .where(
        or(
          sql`LOWER(${user.name}) LIKE ${searchPattern}`,
          sql`LOWER(${user.email}) LIKE ${searchPattern}`
        )
      )
      .limit(limit);
  }
}

// Singleton instance
export const userRepository = new UserRepository();

// Helper function for raw SQL queries
import { sql } from "drizzle-orm";
