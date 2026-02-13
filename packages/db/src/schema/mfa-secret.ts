/**
 * MFASecret Schema
 *
 * TOTP multi-factor authentication secrets
 */

import { pgTable, uuid, varchar, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { user } from "./user.js";

/**
 * MFASecret table
 */
export const mfaSecret = pgTable(
  "mfa_secret",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade"),
    // Encrypted TOTP secret
    secret: varchar("secret", { length: 255 }).notNull(),
    // Backup codes for recovery (hashed)
    backupCodes: text("backup_codes"), // JSON array of hashed codes
    // Is TOTP enabled/verified
    enabled: boolean("enabled").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
    verifiedAt: timestamp("verified_at"),
    lastUsedAt: timestamp("last_used_at"),
  },
  (table) => ({
    userIdx: index("idx_mfa_secret_user").on(table.userId),
  })
);

/**
 * MFASecret types
 */
export type MFASecret = typeof mfaSecret.$inferSelect;
export type NewMFASecret = typeof mfaSecret.$inferInsert;
