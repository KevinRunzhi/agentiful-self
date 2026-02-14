/**
 * Notification Service
 *
 * PostgreSQL-backed in-app notifications for quota alerts, break-glass, and system events.
 */

import { getDatabase } from "@agentifui/db/client";
import { notification } from "@agentifui/db/schema";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export interface InAppNotification {
  id: string;
  type: string;
  tenantId: string;
  recipientId?: string;
  createdAt: Date;
  isRead: boolean;
  readAt?: Date | null;
  traceId?: string;
  title?: string;
  message?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  rootAdminId?: string;
  rootAdminName?: string;
  reason?: string;
  expiresAt?: Date;
}

export interface ListRecipientNotificationsOptions {
  cursor?: string | null;
  limit?: number;
  type?: string;
  unreadOnly?: boolean;
}

interface UnreadCount {
  total: number;
  breakglass: number;
  quota: number;
  other: number;
}

interface CursorPayload {
  createdAt: string;
  id: string;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function normalizeType(rawType: string | undefined): "quota_alert" | "breakglass" | "system" {
  const type = (rawType ?? "").toLowerCase();
  if (type === "quota_alert" || type === "quota_warning" || type === "quota_exceeded") {
    return "quota_alert";
  }
  if (type === "breakglass" || type === "breakglass_activated" || type === "breakglass_expired") {
    return "breakglass";
  }
  return "system";
}

function encodeCursor(input: CursorPayload): string {
  return Buffer.from(JSON.stringify(input), "utf8").toString("base64");
}

function decodeCursor(cursor: string | null | undefined): CursorPayload | null {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8")) as CursorPayload;
    if (
      typeof parsed.createdAt === "string" &&
      parsed.createdAt &&
      typeof parsed.id === "string" &&
      parsed.id
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit) || !limit || limit <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(MAX_LIMIT, Math.floor(limit));
}

export class NotificationService {
  constructor(private readonly db: PostgresJsDatabase) {}

  async create(notificationInput: Omit<InAppNotification, "id"> & { id?: string }): Promise<string> {
    const type = normalizeType(notificationInput.type);
    const content = notificationInput.message ?? notificationInput.content ?? "";
    const metadata: Record<string, unknown> = {
      ...(notificationInput.metadata ?? {}),
      eventType: notificationInput.type,
    };

    if (notificationInput.rootAdminId) {
      metadata.rootAdminId = notificationInput.rootAdminId;
    }
    if (notificationInput.rootAdminName) {
      metadata.rootAdminName = notificationInput.rootAdminName;
    }
    if (notificationInput.reason) {
      metadata.reason = notificationInput.reason;
    }
    if (notificationInput.expiresAt) {
      metadata.expiresAt = notificationInput.expiresAt.toISOString();
    }

    const rows = await this.db
      .insert(notification)
      .values({
        tenantId: notificationInput.tenantId,
        recipientId: notificationInput.recipientId ?? `tenant:${notificationInput.tenantId}`,
        type,
        title: notificationInput.title ?? this.defaultTitle(type, notificationInput.type),
        content,
        metadata,
        isRead: notificationInput.isRead ?? false,
        readAt: notificationInput.isRead ? new Date() : null,
        traceId: notificationInput.traceId,
        createdAt: notificationInput.createdAt ?? new Date(),
      })
      .returning({ id: notification.id });

    const created = rows[0];
    if (!created) {
      throw new Error("Failed to create notification");
    }

    return created.id;
  }

  async findByTenant(tenantId: string): Promise<InAppNotification[]> {
    const rows = await this.db
      .select()
      .from(notification)
      .where(eq(notification.tenantId, tenantId))
      .orderBy(desc(notification.createdAt), desc(notification.id))
      .limit(500);

    return rows.map((row) => this.toNotification(row));
  }

  async findByRecipient(
    tenantId: string,
    recipientId: string,
    options: ListRecipientNotificationsOptions = {}
  ): Promise<{ items: InAppNotification[]; nextCursor: string | null }> {
    const limit = normalizeLimit(options.limit);
    const cursor = decodeCursor(options.cursor);
    const conditions = [
      eq(notification.tenantId, tenantId),
      eq(notification.recipientId, recipientId),
    ];

    if (options.type) {
      conditions.push(eq(notification.type, normalizeType(options.type)));
    }
    if (options.unreadOnly) {
      conditions.push(eq(notification.isRead, false));
    }
    if (cursor) {
      conditions.push(
        or(
          lt(notification.createdAt, new Date(cursor.createdAt)),
          and(
            eq(notification.createdAt, new Date(cursor.createdAt)),
            sql`${notification.id} < ${cursor.id}`
          )
        ) as any
      );
    }

    const rows = await this.db
      .select()
      .from(notification)
      .where(and(...conditions))
      .orderBy(desc(notification.createdAt), desc(notification.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];

    return {
      items: items.map((row) => this.toNotification(row)),
      nextCursor: hasMore && last
        ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
        : null,
    };
  }

  async getUnreadCount(tenantId: string, recipientId?: string): Promise<UnreadCount> {
    const conditions = [eq(notification.tenantId, tenantId), eq(notification.isRead, false)];
    if (recipientId) {
      conditions.push(eq(notification.recipientId, recipientId));
    }

    const rows = await this.db
      .select({
        type: notification.type,
        count: sql<number>`count(*)`,
      })
      .from(notification)
      .where(and(...conditions))
      .groupBy(notification.type);

    let breakglass = 0;
    let quota = 0;
    let other = 0;

    for (const row of rows) {
      const count = Number(row.count);
      if (row.type === "breakglass") {
        breakglass += count;
      } else if (row.type === "quota_alert") {
        quota += count;
      } else {
        other += count;
      }
    }

    return {
      total: breakglass + quota + other,
      breakglass,
      quota,
      other,
    };
  }

  async markAsRead(notificationId: string, tenantId?: string, recipientId?: string): Promise<void> {
    const conditions = [eq(notification.id, notificationId)];
    if (tenantId) {
      conditions.push(eq(notification.tenantId, tenantId));
    }
    if (recipientId) {
      conditions.push(eq(notification.recipientId, recipientId));
    }

    await this.db
      .update(notification)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(and(...conditions));
  }

  async markAllAsRead(tenantId: string, recipientId?: string): Promise<void> {
    const conditions = [eq(notification.tenantId, tenantId)];
    if (recipientId) {
      conditions.push(eq(notification.recipientId, recipientId));
    }

    await this.db
      .update(notification)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(and(...conditions));
  }

  async deleteOld(before: Date): Promise<number> {
    const rows = await this.db
      .delete(notification)
      .where(lt(notification.createdAt, before))
      .returning({ id: notification.id });

    return rows.length;
  }

  private defaultTitle(type: "quota_alert" | "breakglass" | "system", originalType?: string): string {
    if (type === "quota_alert") {
      return originalType === "quota_exceeded" ? "Quota exceeded" : "Quota warning";
    }
    if (type === "breakglass") {
      return "Break-glass notification";
    }
    return "System notification";
  }

  private toNotification(row: typeof notification.$inferSelect): InAppNotification {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const expiresAtRaw = metadata["expiresAt"];

    return {
      id: row.id,
      type: (metadata["eventType"] as string | undefined) ?? row.type,
      tenantId: row.tenantId,
      recipientId: row.recipientId,
      createdAt: row.createdAt,
      isRead: row.isRead,
      readAt: row.readAt ?? null,
      traceId: row.traceId ?? undefined,
      title: row.title,
      message: row.content,
      content: row.content,
      metadata,
      rootAdminId: (metadata["rootAdminId"] as string | undefined) ?? undefined,
      rootAdminName: (metadata["rootAdminName"] as string | undefined) ?? undefined,
      reason: (metadata["reason"] as string | undefined) ?? undefined,
      expiresAt:
        typeof expiresAtRaw === "string"
          ? new Date(expiresAtRaw)
          : expiresAtRaw instanceof Date
            ? expiresAtRaw
            : undefined,
    };
  }
}

export function createNotificationService(db: PostgresJsDatabase): NotificationService {
  return new NotificationService(db);
}

export function createNotificationStore(db?: PostgresJsDatabase): NotificationService {
  const effectiveDb = db ?? (getDatabase() as unknown as PostgresJsDatabase);
  return new NotificationService(effectiveDb);
}
