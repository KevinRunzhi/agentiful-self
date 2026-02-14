/**
 * Compliance and Governance Schema (S3-2)
 */

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  integer,
  text,
  real,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { tenant } from "./tenant.js";
import { user } from "./user.js";
import { group } from "./group.js";
import { app } from "./rbac.js";
import { run, conversation } from "./conversation.js";

export const auditExportJob = pgTable(
  "audit_export_job",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenant.id, { onDelete: "cascade" })
      .notNull(),
    requesterUserId: uuid("requester_user_id").references(() => user.id, { onDelete: "set null" }),
    format: varchar("format", { length: 16 }).default("csv").notNull(),
    status: varchar("status", { length: 16 }).default("pending").notNull(), // pending | processing | completed | failed
    filters: jsonb("filters").$type<Record<string, unknown>>().default({}).notNull(),
    itemCount: integer("item_count").default(0).notNull(),
    filePath: text("file_path"),
    error: text("error"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantStatusIdx: index("idx_audit_export_job_tenant_status").on(table.tenantId, table.status),
    expiresAtIdx: index("idx_audit_export_job_expires_at").on(table.expiresAt),
  })
);

export type AuditExportJob = typeof auditExportJob.$inferSelect;
export type NewAuditExportJob = typeof auditExportJob.$inferInsert;

export const complianceEvent = pgTable(
  "compliance_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenant.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
    runId: uuid("run_id").references(() => run.id, { onDelete: "set null" }),
    conversationId: uuid("conversation_id").references(() => conversation.id, { onDelete: "set null" }),
    category: varchar("category", { length: 64 }).notNull(),
    action: varchar("action", { length: 16 }).notNull(), // log | alert | block
    originalContent: text("original_content"),
    displayedContent: text("displayed_content"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    traceId: varchar("trace_id", { length: 128 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantCategoryCreatedIdx: index("idx_compliance_event_tenant_category_created").on(
      table.tenantId,
      table.category,
      table.createdAt
    ),
    runIdx: index("idx_compliance_event_run").on(table.runId),
  })
);

export type ComplianceEvent = typeof complianceEvent.$inferSelect;
export type NewComplianceEvent = typeof complianceEvent.$inferInsert;

export const analyticsHourly = pgTable(
  "analytics_hourly",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenant.id, { onDelete: "cascade" })
      .notNull(),
    groupId: uuid("group_id").references(() => group.id, { onDelete: "set null" }),
    appId: uuid("app_id").references(() => app.id, { onDelete: "set null" }),
    hour: timestamp("hour").notNull(),
    dimension: varchar("dimension", { length: 32 }).notNull(), // overview | user | app | model
    dimensionValue: varchar("dimension_value", { length: 255 }).notNull(),
    requestCount: integer("request_count").default(0).notNull(),
    tokenCount: integer("token_count").default(0).notNull(),
    costUsd: real("cost_usd").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantHourDimensionUnique: unique("idx_analytics_hourly_unique").on(
      table.tenantId,
      table.groupId,
      table.appId,
      table.hour,
      table.dimension,
      table.dimensionValue
    ),
    tenantHourIdx: index("idx_analytics_hourly_tenant_hour").on(table.tenantId, table.hour),
  })
);

export type AnalyticsHourly = typeof analyticsHourly.$inferSelect;
export type NewAnalyticsHourly = typeof analyticsHourly.$inferInsert;

export const modelPricing = pgTable(
  "model_pricing",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenant.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 64 }).notNull(),
    model: varchar("model", { length: 255 }).notNull(),
    inputPricePer1kUsd: real("input_price_per_1k_usd").notNull(),
    outputPricePer1kUsd: real("output_price_per_1k_usd").notNull(),
    currency: varchar("currency", { length: 16 }).default("USD").notNull(),
    effectiveFrom: timestamp("effective_from").defaultNow().notNull(),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantProviderModelIdx: index("idx_model_pricing_tenant_provider_model").on(
      table.tenantId,
      table.provider,
      table.model,
      table.effectiveFrom
    ),
    providerModelIdx: index("idx_model_pricing_provider_model").on(table.provider, table.model),
  })
);

export type ModelPricing = typeof modelPricing.$inferSelect;
export type NewModelPricing = typeof modelPricing.$inferInsert;
