/**
 * Invitation Schema
 *
 * Stores user invitation link information with tenant context
 */

import { pgTable, uuid, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { user } from "./user.js";
import { tenant } from "./tenant.js";
import { group } from "./group.js";

/**
 * Invitation status enum
 */
export const InvitationStatus = {
  PENDING: "pending",
  USED: "used",
  EXPIRED: "expired",
  REVOKED: "revoked",
} as const;

/**
 * Invitation table
 */
export const invitation = pgTable(
  "invitation",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 255 }).notNull().unique(),
    email: varchar("email", { length: 255 }).notNull(),
    role: varchar("role", { length: 50 }).notNull(), // 'TENANT_ADMIN' | 'USER'
    groupId: uuid("group_id").references(() => group.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow(),
    usedAt: timestamp("used_at"),
  },
  (table) => ({
    tokenIdx: index("idx_invitation_token").on(table.token),
    tenantIdx: index("idx_invitation_tenant").on(table.tenantId),
  })
);

/**
 * Invitation types
 */
export type Invitation = typeof invitation.$inferSelect;
export type NewInvitation = typeof invitation.$inferInsert;
