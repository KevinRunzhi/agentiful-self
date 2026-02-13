/**
 * Password History Schema
 *
 * Stores user password hashes to prevent password reuse
 */

import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { user } from "./user.js";

/**
 * Password history table
 */
export const passwordHistory = pgTable(
  "password_history",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userCreatedAtIdx: index("idx_password_history_user_created").on(table.userId, table.createdAt),
  })
);

/**
 * Password history types
 */
export type PasswordHistory = typeof passwordHistory.$inferSelect;
export type NewPasswordHistory = typeof passwordHistory.$inferInsert;

/**
 * Default password history limit (can be overridden by tenant policy)
 */
export const DEFAULT_PASSWORD_HISTORY_LIMIT = 5;
