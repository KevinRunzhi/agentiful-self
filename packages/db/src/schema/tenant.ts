/**
 * Tenant Schema
 *
 * Tenant is the highest-level data isolation and governance unit.
 * Displayed as "Workspace" in the UI.
 */

import { integer, jsonb, pgTable, timestamp, uuid, varchar, index } from "drizzle-orm/pg-core";

export type TenantStatus = "active" | "suspended" | "deleted";

type SecurityAction = "log" | "alert" | "block";
type PIIMaskStrategy = "mask" | "hash" | "remove";

/**
 * Tenant configuration type
 *
 * S3-3 clarifications align config into stable namespaces while preserving
 * legacy auth/security fields.
 */
export type TenantConfig = {
  // Authentication configuration (legacy)
  auth?: {
    emailPasswordEnabled: boolean;
    requireEmailVerification: boolean;
  };
  // Password policy (legacy)
  passwordPolicy?: {
    minLength: number; // Default 8
    requireUppercase: boolean; // Default true
    requireLowercase: boolean; // Default true
    requireNumbers: boolean; // Default true
    requireSpecialChars: boolean; // Default false
    expireDays?: number; // 30-365, null means no expiration
    historyLimit: number; // 3-12, default 5
  };
  // Account lockout policy (legacy)
  accountLockout?: {
    enabled: boolean; // Default true
    maxAttempts: number; // Default 5
    lockoutDurationMinutes: number; // Default 30
  };
  // MFA policy (legacy)
  mfaPolicy?: "required" | "optional" | "disabled"; // Default 'optional'
  // User approval (legacy)
  userApproval?: {
    enabled: boolean; // Default false
    ssoBypassApproval: boolean; // Default true
  };
  // Default language / theme (legacy)
  defaultLanguage?: string;
  defaultTheme?: "light" | "dark" | "system";
  // Security settings (legacy)
  security?: {
    authMethods?: {
      password?: boolean;
      phone?: boolean;
      google?: boolean;
      github?: boolean;
      wechat?: boolean;
      sso?: boolean;
    };
    sso?: {
      provider?: "oidc" | "saml" | "cas";
      issuerUrl?: string;
      clientId?: string;
      metadataUrl?: string;
      enabled?: boolean;
    };
    promptInjection?: {
      enabled?: boolean;
      action?: SecurityAction;
      customKeywords?: string[];
    };
    pii?: {
      enabled?: boolean;
      strategy?: PIIMaskStrategy;
      fields?: Array<"phone" | "email" | "id_card" | "bank_card" | "credit_card">;
    };
    outputCompliance?: {
      enabled?: boolean;
      action?: SecurityAction;
      categories?: Array<"violence" | "hate" | "adult" | "political_cn" | "self_harm">;
      customKeywords?: string[];
    };
    audit?: {
      retentionDays?: number;
    };
  };

  // S3-3 settings namespaces
  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
    logo?: string;
    favicon?: string;
    siteName?: string;
  };
  i18n?: {
    defaultLanguage?: "zh-CN" | "en-US" | "zh" | "en";
    allowUserOverride?: boolean;
  };
  webhook?: {
    url?: string;
    subscribedEvents?: string[];
    signingSecret?: string;
    enabled?: boolean;
  };
  observability?: {
    urlTemplate?: string;
    platformType?: "grafana" | "jaeger" | "custom";
    enabled?: boolean;
  };
  notification?: {
    typesEnabled?: string[];
    retentionDays?: number;
    inAppNotifications?: boolean;
  };
  fileUpload?: {
    maxSizeMb?: number;
    allowedTypes?: string[];
    retentionDays?: number;
  };
  conversationShare?: {
    defaultTtlDays?: number;
    maxTtlDays?: number;
    requireLogin?: boolean;
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
      .default("active"), // active | suspended | deleted
    plan: varchar("plan", { length: 50 }).default("free"),
    customConfig: jsonb("custom_config").$type<TenantConfig>().default({}),
    configVersion: integer("config_version").notNull().default(1),
    deletedAt: timestamp("deleted_at"),
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
