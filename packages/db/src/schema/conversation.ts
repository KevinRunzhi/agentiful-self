/**
 * Conversation, Message, and Run Persistence Schema (S2-3)
 *
 * Covers:
 * - Conversation/message persistence
 * - Unified run and run-step tracking
 * - Data backfill/sync logs
 * - Prompt injection detection logs
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
  index,
  unique,
  real,
} from "drizzle-orm/pg-core";
import { tenant } from "./tenant.js";
import { user } from "./user.js";
import { app } from "./rbac.js";
import { group } from "./group.js";

// =============================================================================
// Conversation
// =============================================================================

export const conversation = pgTable(
  "conversation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenant.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    appId: uuid("app_id")
      .references(() => app.id, { onDelete: "restrict" })
      .notNull(),
    activeGroupId: uuid("active_group_id").references(() => group.id, { onDelete: "set null" }),
    externalId: varchar("external_id", { length: 255 }),
    title: varchar("title", { length: 512 }),
    status: varchar("status", { length: 32 }).default("active").notNull(), // active | archived | deleted
    pinned: boolean("pinned").default(false).notNull(),
    clientId: text("client_id"),
    inputs: jsonb("inputs").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    tenantUserIdx: index("idx_conversation_tenant_user").on(table.tenantId, table.userId),
    appIdx: index("idx_conversation_app").on(table.appId),
    userUpdatedIdx: index("idx_conversation_user_updated").on(table.userId, table.updatedAt),
    statusUpdatedIdx: index("idx_conversation_status_updated").on(table.status, table.updatedAt),
    clientIdUnique: unique("idx_conversation_client_id").on(table.clientId),
  })
);

export type Conversation = typeof conversation.$inferSelect;
export type NewConversation = typeof conversation.$inferInsert;

// =============================================================================
// Run
// =============================================================================

export const run = pgTable(
  "run",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenant.id, { onDelete: "cascade" })
      .notNull(),
    conversationId: uuid("conversation_id").references(() => conversation.id, { onDelete: "set null" }),
    appId: uuid("app_id")
      .references(() => app.id, { onDelete: "restrict" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    activeGroupId: uuid("active_group_id").references(() => group.id, { onDelete: "set null" }),
    type: varchar("type", { length: 32 }).notNull(), // workflow | agent | generation
    triggeredBy: varchar("triggered_by", { length: 32 }).default("user").notNull(), // user | api | schedule
    status: varchar("status", { length: 32 }).default("pending").notNull(), // pending | running | completed | failed | stopped
    inputs: jsonb("inputs").$type<Record<string, unknown>>().default({}).notNull(),
    outputs: jsonb("outputs").$type<Record<string, unknown>>(),
    error: text("error"),
    durationMs: integer("duration_ms").default(0).notNull(),
    inputTokens: integer("input_tokens").default(0).notNull(),
    outputTokens: integer("output_tokens").default(0).notNull(),
    totalTokens: integer("total_tokens").default(0).notNull(),
    model: varchar("model", { length: 255 }),
    traceId: varchar("trace_id", { length: 128 }).notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantAppCreatedIdx: index("idx_run_tenant_app_created").on(table.tenantId, table.appId, table.createdAt),
    conversationIdx: index("idx_run_conversation").on(table.conversationId),
    traceIdx: index("idx_run_trace").on(table.traceId),
    userCreatedIdx: index("idx_run_user_created").on(table.userId, table.createdAt),
    statusUpdatedIdx: index("idx_run_status_updated").on(table.status, table.updatedAt),
  })
);

export type Run = typeof run.$inferSelect;
export type NewRun = typeof run.$inferInsert;

// =============================================================================
// Message
// =============================================================================

export const message = pgTable(
  "message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenant.id, { onDelete: "cascade" })
      .notNull(),
    conversationId: uuid("conversation_id")
      .references(() => conversation.id, { onDelete: "cascade" })
      .notNull(),
    appId: uuid("app_id")
      .references(() => app.id, { onDelete: "restrict" })
      .notNull(),
    runId: uuid("run_id"),
    userId: uuid("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    parentId: uuid("parent_id"),
    role: varchar("role", { length: 32 }).notNull(), // user | assistant | system | tool
    content: text("content"),
    contentParts: jsonb("content_parts").$type<Array<Record<string, unknown>>>().default([]).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    model: varchar("model", { length: 255 }),
    provider: varchar("provider", { length: 64 }),
    traceId: varchar("trace_id", { length: 128 }),
    observationId: varchar("observation_id", { length: 128 }),
    clientId: text("client_id"),
    error: jsonb("error").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    conversationCreatedIdx: index("idx_message_conversation_created").on(table.conversationId, table.createdAt),
    userIdx: index("idx_message_user").on(table.userId),
    traceIdx: index("idx_message_trace").on(table.traceId),
    clientIdx: index("idx_message_client").on(table.clientId),
    tenantUserAppIdx: index("idx_message_tenant_user_app").on(table.tenantId, table.userId, table.appId),
    clientIdUnique: unique("idx_message_client_unique").on(table.clientId),
  })
);

export type Message = typeof message.$inferSelect;
export type NewMessage = typeof message.$inferInsert;

// =============================================================================
// RunStep
// =============================================================================

export const runStep = pgTable(
  "run_step",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .references(() => run.id, { onDelete: "cascade" })
      .notNull(),
    stepIndex: integer("step_index").notNull(),
    nodeId: varchar("node_id", { length: 255 }).notNull(),
    nodeType: varchar("node_type", { length: 64 }).notNull(),
    title: varchar("title", { length: 255 }),
    status: varchar("status", { length: 32 }).default("pending").notNull(), // pending | running | completed | failed
    inputs: jsonb("inputs").$type<Record<string, unknown>>().default({}).notNull(),
    outputs: jsonb("outputs").$type<Record<string, unknown>>(),
    error: text("error"),
    durationMs: integer("duration_ms").default(0).notNull(),
    inputTokens: integer("input_tokens").default(0).notNull(),
    outputTokens: integer("output_tokens").default(0).notNull(),
    totalTokens: integer("total_tokens").default(0).notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    runStepIdx: index("idx_run_step_run_index").on(table.runId, table.stepIndex),
    runStepUnique: unique("idx_run_step_run_step").on(table.runId, table.stepIndex),
  })
);

export type RunStep = typeof runStep.$inferSelect;
export type NewRunStep = typeof runStep.$inferInsert;

// =============================================================================
// DataSyncLog
// =============================================================================

export const dataSyncLog = pgTable(
  "data_sync_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenant.id, { onDelete: "cascade" })
      .notNull(),
    conversationId: uuid("conversation_id")
      .references(() => conversation.id, { onDelete: "cascade" })
      .notNull(),
    syncType: varchar("sync_type", { length: 16 }).default("incremental").notNull(), // full | incremental
    status: varchar("status", { length: 16 }).default("pending").notNull(), // pending | syncing | completed | failed
    triggeredBy: varchar("triggered_by", { length: 16 }).default("auto").notNull(), // auto | user | admin
    traceId: varchar("trace_id", { length: 128 }),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantConversationCreatedIdx: index("idx_data_sync_tenant_conversation_created").on(
      table.tenantId,
      table.conversationId,
      table.createdAt
    ),
    statusUpdatedIdx: index("idx_data_sync_status_updated").on(table.status, table.updatedAt),
  })
);

export type DataSyncLog = typeof dataSyncLog.$inferSelect;
export type NewDataSyncLog = typeof dataSyncLog.$inferInsert;

// =============================================================================
// PromptInjectionLog
// =============================================================================

export const promptInjectionLog = pgTable(
  "prompt_injection_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenant.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    conversationId: uuid("conversation_id").references(() => conversation.id, { onDelete: "set null" }),
    messageId: uuid("message_id").references(() => message.id, { onDelete: "set null" }),
    riskScore: real("risk_score").notNull(),
    riskType: varchar("risk_type", { length: 64 }).notNull(),
    action: varchar("action", { length: 16 }).notNull(), // log | alert | block
    raw: text("raw"),
    traceId: varchar("trace_id", { length: 128 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantCreatedIdx: index("idx_prompt_injection_tenant_created").on(table.tenantId, table.createdAt),
    conversationIdx: index("idx_prompt_injection_conversation").on(table.conversationId),
    userIdx: index("idx_prompt_injection_user").on(table.userId),
    actionIdx: index("idx_prompt_injection_action").on(table.action),
  })
);

export type PromptInjectionLog = typeof promptInjectionLog.$inferSelect;
export type NewPromptInjectionLog = typeof promptInjectionLog.$inferInsert;

