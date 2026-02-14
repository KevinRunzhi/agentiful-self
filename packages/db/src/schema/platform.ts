/**
 * Platform Management Schema (S3-3)
 *
 * Includes:
 * - Tenant API keys for Open API auth
 * - Webhook delivery logs for observability/retry trace
 * - System announcements and per-user dismissals
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { tenant } from "./tenant.js";
import { user } from "./user.js";

// =============================================================================
// Tenant API Keys
// =============================================================================

export const tenantApiKey = pgTable(
  "tenant_api_key",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenant.id, { onDelete: "cascade" })
      .notNull(),
    keyName: varchar("key_name", { length: 128 }).notNull(),
    keyPrefix: varchar("key_prefix", { length: 24 }).notNull(),
    keyHash: varchar("key_hash", { length: 128 }).notNull(),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    lastUsedAt: timestamp("last_used_at"),
    usageCount: integer("usage_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantCreatedIdx: index("idx_tenant_api_key_tenant_created").on(table.tenantId, table.createdAt),
    tenantRevokedIdx: index("idx_tenant_api_key_tenant_revoked").on(table.tenantId, table.revokedAt),
    hashUnique: unique("idx_tenant_api_key_hash").on(table.keyHash),
  })
);

export type TenantApiKey = typeof tenantApiKey.$inferSelect;
export type NewTenantApiKey = typeof tenantApiKey.$inferInsert;

// =============================================================================
// Webhook Delivery Logs
// =============================================================================

export const webhookDeliveryLog = pgTable(
  "webhook_delivery_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenant.id, { onDelete: "cascade" })
      .notNull(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    endpoint: text("endpoint").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    signature: varchar("signature", { length: 255 }),
    attempt: integer("attempt").default(1).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("pending"), // pending | delivered | failed
    responseCode: integer("response_code"),
    responseTimeMs: integer("response_time_ms"),
    errorMessage: text("error_message"),
    scheduledAt: timestamp("scheduled_at").notNull().defaultNow(),
    deliveredAt: timestamp("delivered_at"),
    traceId: varchar("trace_id", { length: 128 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    tenantCreatedIdx: index("idx_webhook_delivery_tenant_created").on(table.tenantId, table.createdAt),
    tenantEventIdx: index("idx_webhook_delivery_tenant_event").on(table.tenantId, table.eventType, table.createdAt),
    statusIdx: index("idx_webhook_delivery_status").on(table.status, table.createdAt),
  })
);

export type WebhookDeliveryLog = typeof webhookDeliveryLog.$inferSelect;
export type NewWebhookDeliveryLog = typeof webhookDeliveryLog.$inferInsert;

// =============================================================================
// System Announcements
// =============================================================================

export const systemAnnouncement = pgTable(
  "system_announcement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scopeType: varchar("scope_type", { length: 16 }).notNull().default("tenant"), // platform | tenant
    tenantId: uuid("tenant_id").references(() => tenant.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    displayType: varchar("display_type", { length: 16 }).notNull().default("banner"), // banner | modal
    status: varchar("status", { length: 16 }).notNull().default("draft"), // draft | published | ended
    isPinned: boolean("is_pinned").notNull().default(false),
    publishedAt: timestamp("published_at"),
    expiresAt: timestamp("expires_at"),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    scopeStatusIdx: index("idx_system_announcement_scope_status").on(
      table.scopeType,
      table.status,
      table.publishedAt
    ),
    tenantStatusIdx: index("idx_system_announcement_tenant_status").on(table.tenantId, table.status, table.publishedAt),
  })
);

export type SystemAnnouncement = typeof systemAnnouncement.$inferSelect;
export type NewSystemAnnouncement = typeof systemAnnouncement.$inferInsert;

export const announcementDismissal = pgTable(
  "announcement_dismissal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    announcementId: uuid("announcement_id")
      .references(() => systemAnnouncement.id, { onDelete: "cascade" })
      .notNull(),
    tenantId: uuid("tenant_id")
      .references(() => tenant.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    dismissedAt: timestamp("dismissed_at").notNull().defaultNow(),
  },
  (table) => ({
    userDismissedIdx: index("idx_announcement_dismissal_user_dismissed").on(table.userId, table.dismissedAt),
    announcementUserUnique: unique("idx_announcement_dismissal_announcement_user").on(
      table.announcementId,
      table.userId
    ),
  })
);

export type AnnouncementDismissal = typeof announcementDismissal.$inferSelect;
export type NewAnnouncementDismissal = typeof announcementDismissal.$inferInsert;
