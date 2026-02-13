/**
 * Invitation Repository
 *
 * Data access layer for Invitation entity
 */

import { eq, and, lt, sql } from "drizzle-orm";
import { getDatabase } from "@agentifui/db/client";
import { invitation } from "@agentifui/db/schema";
import type { Invitation, NewInvitation } from "@agentifui/db/schema";
import { InvitationStatus } from "@agentifui/db/schema";

/**
 * Invitation repository
 */
export class InvitationRepository {
  /**
   * Find invitation by token
   */
  async findByToken(token: string): Promise<Invitation | null> {
    const db = getDatabase();
    const [result] = await db
      .select()
      .from(invitation)
      .where(eq(invitation.token, token))
      .limit(1);
    return result || null;
  }

  /**
   * Create new invitation
   */
  async create(data: NewInvitation): Promise<Invitation> {
    const db = getDatabase();
    const [result] = await db.insert(invitation).values(data).returning();
    return result;
  }

  /**
   * Update invitation status
   */
  async updateStatus(id: string, status: typeof InvitationStatus[keyof typeof InvitationStatus]): Promise<Invitation | null> {
    const db = getDatabase();

    const updateData: Partial<Invitation> = { status };
    if (status === InvitationStatus.USED) {
      updateData.usedAt = new Date();
    }

    const [result] = await db
      .update(invitation)
      .set(updateData)
      .where(eq(invitation.id, id))
      .returning();

    return result || null;
  }

  /**
   * Get pending invitations by tenant
   */
  async findPendingByTenant(tenantId: string, limit = 50): Promise<Invitation[]> {
    const db = getDatabase();
    return db
      .select()
      .from(invitation)
      .where(
        and(
          eq(invitation.tenantId, tenantId),
          eq(invitation.status, InvitationStatus.PENDING)
        )
      )
      .limit(limit);
  }

  /**
   * Get invitations by email
   */
  async findByEmail(email: string, limit = 20): Promise<Invitation[]> {
    const db = getDatabase();
    return db
      .select()
      .from(invitation)
      .where(eq(invitation.email, email))
      .orderBy(invitation.createdAt, "desc")
      .limit(limit);
  }

  /**
   * Get expired invitations (for cleanup)
   */
  async findExpired(limit = 100): Promise<Invitation[]> {
    const db = getDatabase();
    return db
      .select()
      .from(invitation)
      .where(
        and(
          eq(invitation.status, InvitationStatus.PENDING),
          lt(invitation.expiresAt, new Date())
        )
      )
      .limit(limit);
  }

  /**
   * Revoke invitation (set to revoked status)
   */
  async revoke(id: string): Promise<boolean> {
    const db = getDatabase();
    const result = await db
      .update(invitation)
      .set({ status: InvitationStatus.REVOKED })
      .where(eq(invitation.id, id));
    return result.rowCount > 0;
  }

  /**
   * Mark invitation as used
   */
  async markAsUsed(id: string): Promise<Invitation | null> {
    return this.updateStatus(id, InvitationStatus.USED);
  }

  /**
   * Mark expired invitations
   */
  async markExpired(): Promise<number> {
    const db = getDatabase();
    const result = await db
      .update(invitation)
      .set({ status: InvitationStatus.EXPIRED })
      .where(
        and(
          eq(invitation.status, InvitationStatus.PENDING),
          lt(invitation.expiresAt, new Date())
        )
      );

    return result.rowCount;
  }

  /**
   * Count pending invitations by tenant
   */
  async countPending(tenantId: string): Promise<number> {
    const db = getDatabase();
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(invitation)
      .where(
        and(
          eq(invitation.tenantId, tenantId),
          eq(invitation.status, InvitationStatus.PENDING)
        )
      );

    return result?.count || 0;
  }

  /**
   * Check if user has pending invitation
   */
  async findPendingByEmail(email: string, tenantId: string): Promise<Invitation | null> {
    const db = getDatabase();
    const [result] = await db
      .select()
      .from(invitation)
      .where(
        and(
          eq(invitation.email, email),
          eq(invitation.tenantId, tenantId),
          eq(invitation.status, InvitationStatus.PENDING)
        )
      )
      .limit(1);

    return result || null;
  }
}

// Singleton instance
export const invitationRepository = new InvitationRepository();
