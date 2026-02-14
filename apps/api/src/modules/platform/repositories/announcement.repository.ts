import { getDatabase } from "@agentifui/db/client";
import { announcementDismissal, systemAnnouncement } from "@agentifui/db/schema";
import { and, eq, isNull, lte, or } from "drizzle-orm";
import type { AnnouncementRepository } from "../services/system-announcement.service.js";

export class DrizzleAnnouncementRepository implements AnnouncementRepository {
  async create(input: any): Promise<any> {
    const db = getDatabase();
    const [created] = await db
      .insert(systemAnnouncement)
      .values({
        scopeType: input.scopeType,
        tenantId: input.tenantId,
        title: input.title,
        content: input.content,
        displayType: input.displayType,
        isPinned: input.isPinned ?? false,
        status: input.status ?? "draft",
        publishedAt: input.publishedAt ?? null,
        expiresAt: input.expiresAt ?? null,
        createdBy: input.createdBy,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create announcement");
    }

    return created;
  }

  async update(input: { id: string; patch: Record<string, unknown>; updatedAt: Date }): Promise<any | null> {
    const db = getDatabase();
    const [updated] = await db
      .update(systemAnnouncement)
      .set({
        ...input.patch,
        updatedAt: input.updatedAt,
      } as any)
      .where(eq(systemAnnouncement.id, input.id))
      .returning();

    return updated ?? null;
  }

  async findById(id: string): Promise<any | null> {
    const db = getDatabase();
    const [row] = await db.select().from(systemAnnouncement).where(eq(systemAnnouncement.id, id)).limit(1);
    return row ?? null;
  }

  async listPublished(input: { tenantId: string; now: Date }): Promise<any[]> {
    const db = getDatabase();
    return db
      .select()
      .from(systemAnnouncement)
      .where(
        and(
          eq(systemAnnouncement.status, "published"),
          lte(systemAnnouncement.publishedAt, input.now),
          or(eq(systemAnnouncement.scopeType, "platform"), eq(systemAnnouncement.tenantId, input.tenantId)),
          or(isNull(systemAnnouncement.expiresAt), lte(input.now, systemAnnouncement.expiresAt))
        )
      );
  }

  async listDismissedAnnouncementIds(input: { tenantId: string; userId: string }): Promise<string[]> {
    const db = getDatabase();
    const rows = await db
      .select({ announcementId: announcementDismissal.announcementId })
      .from(announcementDismissal)
      .where(and(eq(announcementDismissal.tenantId, input.tenantId), eq(announcementDismissal.userId, input.userId)));
    return rows.map((row) => row.announcementId);
  }

  async dismiss(input: { announcementId: string; tenantId: string; userId: string; dismissedAt: Date }): Promise<void> {
    const db = getDatabase();
    await db
      .insert(announcementDismissal)
      .values({
        announcementId: input.announcementId,
        tenantId: input.tenantId,
        userId: input.userId,
        dismissedAt: input.dismissedAt,
      })
      .onConflictDoNothing();
  }
}

export function createAnnouncementRepository(): AnnouncementRepository {
  return new DrizzleAnnouncementRepository();
}
