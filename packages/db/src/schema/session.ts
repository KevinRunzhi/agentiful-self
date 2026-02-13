/**
 * Session Schema
 *
 * better-auth managed session table with tenant context extension.
 */

import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { user } from "./user.js";

/**
 * Session table (better-auth extension with tenant_id)
 */
export const session = pgTable("session", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull(), // Extended field for tenant context
  token: varchar("token").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * Session types
 */
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
