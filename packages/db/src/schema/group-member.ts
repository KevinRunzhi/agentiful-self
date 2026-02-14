/**
 * GroupMember Schema
 *
 * Many-to-many relationship between Users and Groups with role
 */

import { pgTable, uuid, varchar, timestamp, index, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { group } from "./group.js";
import { user } from "./user.js";

/**
 * GroupMember table
 */
export const groupMember = pgTable(
  "group_member",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => group.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }).notNull().default("member"), // member, manager, admin
    addedBy: uuid("added_by").references(() => user.id, { onDelete: "set null" }),
    addedAt: timestamp("added_at").defaultNow(),
    removedAt: timestamp("removed_at"),
    removedBy: uuid("removed_by").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => ({
    groupIdx: index("idx_group_member_group").on(table.groupId),
    userIdx: index("idx_group_member_user").on(table.userId),
    groupUserUnique: unique("idx_group_member_group_user").on(table.groupId, table.userId),
    activeMembership: uniqueIndex("idx_group_member_active")
      .on(table.groupId, table.userId)
      .where(sql`${table.removedAt} IS NULL`),
  })
);

/**
 * GroupMember types
 */
export type GroupMember = typeof groupMember.$inferSelect;
export type NewGroupMember = typeof groupMember.$inferInsert;

/**
 * Valid group member roles
 */
export const GROUP_MEMBER_ROLES = {
  MEMBER: "member",
  MANAGER: "manager",
  ADMIN: "admin",
} as const;

export type GroupMemberRole = typeof GROUP_MEMBER_ROLES[keyof typeof GROUP_MEMBER_ROLES];
