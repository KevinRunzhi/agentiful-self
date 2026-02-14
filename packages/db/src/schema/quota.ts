/**
 * Quota and App Workbench Schema (S1-3)
 *
 * Includes:
 * - App favorites and recent usage
 * - Tenant/Group/User quota policy and counters
 * - Usage ledger and alert events
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  bigint,
  boolean,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { tenant } from "./tenant.js";
import { group } from "./group.js";
import { user } from "./user.js";
import { app } from "./rbac.js";

// =============================================================================
// App Workbench Tables
// =============================================================================

export const appFavorite = pgTable(
  "app_favorite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenant.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    appId: uuid("app_id")
      .references(() => app.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantUserIdx: index("idx_app_favorite_tenant_user").on(table.tenantId, table.userId),
    userCreatedIdx: index("idx_app_favorite_user_created").on(table.userId, table.createdAt),
    tenantUserAppUnique: unique("idx_app_favorite_tenant_user_app").on(
      table.tenantId,
      table.userId,
      table.appId
    ),
  })
);

export type AppFavorite = typeof appFavorite.$inferSelect;
export type NewAppFavorite = typeof appFavorite.$inferInsert;

export const appRecentUse = pgTable(
  "app_recent_use",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenant.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    appId: uuid("app_id")
      .references(() => app.id, { onDelete: "cascade" })
      .notNull(),
    lastUsedAt: timestamp("last_used_at").defaultNow().notNull(),
    useCount: integer("use_count").default(1).notNull(),
  },
  (table) => ({
    tenantUserLastUsedIdx: index("idx_app_recent_use_tenant_user_last_used").on(
      table.tenantId,
      table.userId,
      table.lastUsedAt
    ),
    userLastUsedIdx: index("idx_app_recent_use_user_last_used").on(table.userId, table.lastUsedAt),
    tenantUserAppUnique: unique("idx_app_recent_use_tenant_user_app").on(
      table.tenantId,
      table.userId,
      table.appId
    ),
  })
);

export type AppRecentUse = typeof appRecentUse.$inferSelect;
export type NewAppRecentUse = typeof appRecentUse.$inferInsert;

// =============================================================================
// Quota Tables
// =============================================================================

export const quotaPolicy = pgTable(
  "quota_policy",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenant.id, { onDelete: "cascade" })
      .notNull(),
    scopeType: varchar("scope_type", { length: 16 }).notNull(), // tenant | group | user
    scopeId: uuid("scope_id").notNull(),
    metricType: varchar("metric_type", { length: 16 }).default("token").notNull(), // token | request
    periodType: varchar("period_type", { length: 16 }).default("month").notNull(), // month | week
    limitValue: bigint("limit_value", { mode: "number" }).notNull(),
    alertThresholds: jsonb("alert_thresholds").$type<number[]>().default([80, 90, 100]).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantScopeIdx: index("idx_quota_policy_tenant_scope").on(table.tenantId, table.scopeType, table.scopeId),
    activeMetricIdx: index("idx_quota_policy_active_metric").on(table.isActive, table.metricType),
    tenantScopeMetricPeriodUnique: unique("idx_quota_policy_tenant_scope_metric_period").on(
      table.tenantId,
      table.scopeType,
      table.scopeId,
      table.metricType,
      table.periodType
    ),
  })
);

export type QuotaPolicy = typeof quotaPolicy.$inferSelect;
export type NewQuotaPolicy = typeof quotaPolicy.$inferInsert;

export const quotaCounter = pgTable(
  "quota_counter",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    policyId: uuid("policy_id")
      .references(() => quotaPolicy.id, { onDelete: "cascade" })
      .notNull(),
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),
    usedValue: bigint("used_value", { mode: "number" }).default(0).notNull(),
    version: integer("version").default(0).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    policyPeriodUnique: unique("idx_quota_counter_policy_period").on(table.policyId, table.periodStart),
    policyUpdatedIdx: index("idx_quota_counter_policy_updated").on(table.policyId, table.updatedAt),
  })
);

export type QuotaCounter = typeof quotaCounter.$inferSelect;
export type NewQuotaCounter = typeof quotaCounter.$inferInsert;

export const quotaUsageLedger = pgTable(
  "quota_usage_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenant.id, { onDelete: "cascade" })
      .notNull(),
    groupId: uuid("group_id").references(() => group.id, { onDelete: "set null" }),
    userId: uuid("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    appId: uuid("app_id")
      .references(() => app.id, { onDelete: "cascade" })
      .notNull(),
    runId: varchar("run_id", { length: 128 }),
    model: varchar("model", { length: 128 }),
    meteringMode: varchar("metering_mode", { length: 16 }).notNull(), // token | request
    promptTokens: integer("prompt_tokens").default(0).notNull(),
    completionTokens: integer("completion_tokens").default(0).notNull(),
    totalTokens: integer("total_tokens").default(0).notNull(),
    traceId: varchar("trace_id", { length: 128 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantGroupCreatedIdx: index("idx_quota_usage_tenant_group_created").on(
      table.tenantId,
      table.groupId,
      table.createdAt
    ),
    userCreatedIdx: index("idx_quota_usage_user_created").on(table.userId, table.createdAt),
  })
);

export type QuotaUsageLedger = typeof quotaUsageLedger.$inferSelect;
export type NewQuotaUsageLedger = typeof quotaUsageLedger.$inferInsert;

export const quotaAlertEvent = pgTable(
  "quota_alert_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenant.id, { onDelete: "cascade" })
      .notNull(),
    policyId: uuid("policy_id")
      .references(() => quotaPolicy.id, { onDelete: "cascade" })
      .notNull(),
    periodStart: timestamp("period_start").notNull(),
    threshold: integer("threshold").notNull(),
    usedValue: bigint("used_value", { mode: "number" }).notNull(),
    limitValue: bigint("limit_value", { mode: "number" }).notNull(),
    channel: varchar("channel", { length: 16 }).default("in_app").notNull(),
    status: varchar("status", { length: 16 }).default("sent").notNull(),
    traceId: varchar("trace_id", { length: 128 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantCreatedIdx: index("idx_quota_alert_tenant_created").on(table.tenantId, table.createdAt),
    policyPeriodThresholdChannelUnique: unique("idx_quota_alert_policy_period_threshold_channel").on(
      table.policyId,
      table.periodStart,
      table.threshold,
      table.channel
    ),
  })
);

export type QuotaAlertEvent = typeof quotaAlertEvent.$inferSelect;
export type NewQuotaAlertEvent = typeof quotaAlertEvent.$inferInsert;

// =============================================================================
// Notifications (S1-3 persistence for in-app alerts)
// =============================================================================

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenant.id, { onDelete: "cascade" })
      .notNull(),
    recipientId: varchar("recipient_id", { length: 128 }).notNull(),
    type: varchar("type", { length: 32 }).default("system").notNull(), // quota_alert | breakglass | system
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at"),
    traceId: varchar("trace_id", { length: 128 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantRecipientCreatedIdx: index("idx_notification_tenant_recipient_created").on(
      table.tenantId,
      table.recipientId,
      table.createdAt
    ),
    tenantRecipientUnreadIdx: index("idx_notification_tenant_recipient_unread").on(
      table.tenantId,
      table.recipientId,
      table.isRead
    ),
    tenantTypeCreatedIdx: index("idx_notification_tenant_type_created").on(
      table.tenantId,
      table.type,
      table.createdAt
    ),
  })
);

export type Notification = typeof notification.$inferSelect;
export type NewNotification = typeof notification.$inferInsert;
