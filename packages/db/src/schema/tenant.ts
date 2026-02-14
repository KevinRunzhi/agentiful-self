/**
 * Tenant Schema
 *
 * Tenant is the highest-level data isolation and governance unit.
 * Displayed as "Workspace" in the UI.
 */

import { pgTable, uuid, varchar, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Tenant configuration type
 */
export type TenantConfig = {
  // Authentication configuration
  auth?: {
    emailPasswordEnabled: boolean;
    requireEmailVerification: boolean;
  };
  // Password policy
  passwordPolicy?: {
    minLength: number; // Default 8
    requireUppercase: boolean; // Default true
    requireLowercase: boolean; // Default true
    requireNumbers: boolean; // Default true
    requireSpecialChars: boolean; // Default false
    expireDays?: number; // 30-365, null means no expiration
    historyLimit: number; // 3-12, default 5
  };
  // Account lockout policy
  accountLockout?: {
    enabled: boolean; // Default true
    maxAttempts: number; // Default 5
    lockoutDurationMinutes: number; // Default 30
  };
  // MFA policy
  mfaPolicy?: "required" | "optional" | "disabled"; // Default 'optional'
  // User approval
  userApproval?: {
    enabled: boolean; // Default false
    ssoBypassApproval: boolean; // Default true
  };
  // Default language
  defaultLanguage?: string; // Default 'en'
  // Theme preference
  defaultTheme?: "light" | "dark" | "system"; // Default 'system'
  // Security settings
  security?: {
    promptInjection?: {
      action?: "log" | "alert" | "block";
    };
  };
};

/**
 * Tenant table
 */
export const tenant = pgTable(
  "tenant",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).unique(),
    status: varchar("status", { length: 20 })
      .notNull()
      .default("active"), // 'active' | 'suspended'
    plan: varchar("plan", { length: 50 }).default("free"),
    customConfig: jsonb("custom_config").$type<TenantConfig>().default({}),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    slugIdx: index("idx_tenant_slug").on(table.slug),
    statusIdx: index("idx_tenant_status").on(table.status),
  })
);

/**
 * Tenant type
 */
export type Tenant = typeof tenant.$inferSelect;
export type NewTenant = typeof tenant.$inferInsert;
