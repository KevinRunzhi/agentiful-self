/**
 * Conversation & Message Schema (S2-2)
 *
 * Covers:
 * - conversation
 * - message
 * - message_feedback
 * - conversation_share
 * - file_attachment
 * - artifact
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenant } from "./tenant.js";
import { user } from "./user.js";
import { group } from "./group.js";
import { app } from "./rbac.js";

export type MessageContentPart =
  | { type: "text"; text: string }
  | { type: "think"; think: string }
  | { type: "image"; imageUrl: string }
  | { type: "artifact"; artifactId: string; title?: string }
  | { type: "citation"; citation: { source: string; content?: string } }
  | {
      type: "hitl";
      hitl: {
        action: "confirm" | "select" | "approve" | "input";
        title: string;
        description?: string;
        options?: Array<{ id: string; label: string }>;
        required: boolean;
        timeoutMs?: number;
        multiple?: boolean;
      };
    };

export interface MessageContentPayload {
  parts: MessageContentPart[];
}

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
      .references(() => app.id, { onDelete: "cascade" })
      .notNull(),
    activeGroupId: uuid("active_group_id").references(() => group.id, {
      onDelete: "set null",
    }),
    externalId: varchar("external_id", { length: 255 }),
    title: varchar("title", { length: 512 }),
    status: varchar("status", { length: 32 }).default("active").notNull(), // active | archived | deleted
    pinned: boolean("pinned").default(false).notNull(),
    clientId: text("client_id").unique(),
    inputs: jsonb("inputs").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantUserIdx: index("idx_conversation_tenant_user").on(table.tenantId, table.userId),
    appIdx: index("idx_conversation_app").on(table.appId),
    userUpdatedIdx: index("idx_conversation_user_updated").on(table.userId, table.updatedAt),
    pinnedUpdatedIdx: index("idx_conversation_pinned_updated").on(table.userId, table.pinned, table.updatedAt),
    clientIdIdx: index("idx_conversation_client_id").on(table.clientId),
  })
);

export type Conversation = typeof conversation.$inferSelect;
export type NewConversation = typeof conversation.$inferInsert;

export const message = pgTable(
  "message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .references(() => conversation.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    parentId: uuid("parent_id"),
    role: varchar("role", { length: 32 }).notNull(), // user | assistant | system | tool
    content: text("content"),
    contentParts: jsonb("content_parts")
      .$type<MessageContentPayload>()
      .default(sql`'{"parts":[]}'::jsonb`)
      .notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    model: varchar("model", { length: 255 }),
    provider: varchar("provider", { length: 64 }),
    traceId: varchar("trace_id", { length: 64 }),
    observationId: varchar("observation_id", { length: 64 }),
    clientId: text("client_id").unique(),
    status: varchar("status", { length: 32 }).default("active").notNull(), // active | overridden
    error: jsonb("error").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    conversationCreatedIdx: index("idx_message_conversation_created").on(table.conversationId, table.createdAt),
    userIdx: index("idx_message_user").on(table.userId),
    traceIdx: index("idx_message_trace").on(table.traceId),
    clientIdIdx: index("idx_message_client_id").on(table.clientId),
    parentIdx: index("idx_message_parent").on(table.parentId),
  })
);

export type Message = typeof message.$inferSelect;
export type NewMessage = typeof message.$inferInsert;

export const messageFeedback = pgTable(
  "message_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenant.id, { onDelete: "cascade" })
      .notNull(),
    messageId: uuid("message_id")
      .references(() => message.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    rating: varchar("rating", { length: 16 }).notNull(), // like | dislike
    comment: text("comment"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    messageUserUnique: unique("uq_message_feedback_message_user").on(table.messageId, table.userId),
    tenantCreatedIdx: index("idx_message_feedback_tenant_created").on(table.tenantId, table.createdAt),
  })
);

export type MessageFeedback = typeof messageFeedback.$inferSelect;
export type NewMessageFeedback = typeof messageFeedback.$inferInsert;

export const conversationShare = pgTable(
  "conversation_share",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenant.id, { onDelete: "cascade" })
      .notNull(),
    conversationId: uuid("conversation_id")
      .references(() => conversation.id, { onDelete: "cascade" })
      .notNull(),
    groupId: uuid("group_id").references(() => group.id, { onDelete: "set null" }),
    shareCode: varchar("share_code", { length: 32 }).notNull().unique(),
    permission: varchar("permission", { length: 32 }).default("read").notNull(),
    requireLogin: boolean("require_login").default(true).notNull(),
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    conversationIdx: index("idx_conversation_share_conversation").on(table.conversationId),
    shareCodeIdx: index("idx_conversation_share_code").on(table.shareCode),
    tenantCreatedIdx: index("idx_conversation_share_tenant_created").on(table.tenantId, table.createdAt),
  })
);

export type ConversationShare = typeof conversationShare.$inferSelect;
export type NewConversationShare = typeof conversationShare.$inferInsert;

export const fileAttachment = pgTable(
  "file_attachment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenant.id, { onDelete: "cascade" })
      .notNull(),
    conversationId: uuid("conversation_id")
      .references(() => conversation.id, { onDelete: "cascade" })
      .notNull(),
    messageId: uuid("message_id").references(() => message.id, { onDelete: "set null" }),
    uploadedBy: uuid("uploaded_by").references(() => user.id, { onDelete: "set null" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileType: varchar("file_type", { length: 128 }).notNull(),
    fileSize: integer("file_size").notNull(),
    storageUrl: text("storage_url").notNull(),
    scanStatus: varchar("scan_status", { length: 32 }).default("skipped").notNull(),
    retainUntil: timestamp("retain_until").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    conversationCreatedIdx: index("idx_file_attachment_conversation_created").on(table.conversationId, table.createdAt),
    messageIdx: index("idx_file_attachment_message").on(table.messageId),
    retainUntilIdx: index("idx_file_attachment_retain_until").on(table.retainUntil),
  })
);

export type FileAttachment = typeof fileAttachment.$inferSelect;
export type NewFileAttachment = typeof fileAttachment.$inferInsert;

export const artifact = pgTable(
  "artifact",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenant.id, { onDelete: "cascade" })
      .notNull(),
    conversationId: uuid("conversation_id")
      .references(() => conversation.id, { onDelete: "cascade" })
      .notNull(),
    messageId: uuid("message_id").references(() => message.id, { onDelete: "set null" }),
    type: varchar("type", { length: 32 }).notNull(), // code | document | visualization
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    format: varchar("format", { length: 32 }),
    version: integer("version").default(1).notNull(),
    isDraft: boolean("is_draft").default(true).notNull(),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    conversationCreatedIdx: index("idx_artifact_conversation_created").on(table.conversationId, table.createdAt),
    conversationDraftIdx: index("idx_artifact_conversation_draft").on(table.conversationId, table.isDraft, table.createdAt),
    messageIdx: index("idx_artifact_message").on(table.messageId),
  })
);

export type Artifact = typeof artifact.$inferSelect;
export type NewArtifact = typeof artifact.$inferInsert;
