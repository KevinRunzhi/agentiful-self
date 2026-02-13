/**
 * User Schema
 *
 * User is a global entity WITHOUT tenant_id.
 * User-Tenant relationship is through UserRole table.
 */

import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";

/**
 * User preferences type
 */
export type UserPreferences = {
  language?: string;
  timezone?: string;
  theme?: "light" | "dark" | "system";
};

/**
 * User table
 */
export const user = pgTable(
  "user",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }),
    avatarUrl: text("avatar_url"),
    phone: varchar("phone", { length: 50 }),
    status: varchar("status", { length: 20 })
      .notNull()
      .default("pending"), // 'active' | 'pending' | 'suspended' | 'rejected'
    emailVerified: boolean("email_verified").default(false),
    mfaEnabled: boolean("mfa_enabled").default(false),
    mfaForced: boolean("mfa_forced").default(false),
    preferences: jsonb("preferences").$type<UserPreferences>().default({}),
    lastActiveAt: timestamp("last_active_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    emailIdx: index("idx_user_email").on(table.email),
    statusIdx: index("idx_user_status").on(table.status),
  })
);

/**
 * User types
 */
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

/**
 * User status enum
 */
export const UserStatus = {
  ACTIVE: "active",
  PENDING: "pending",
  SUSPENDED: "suspended",
  REJECTED: "rejected",
} as const;
