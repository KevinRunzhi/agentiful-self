/**
 * SSOConfig Schema
 *
 * SSO/OAuth configuration per tenant with domain detection
 */

import { pgTable, uuid, varchar, text, boolean, json, timestamp, index, unique } from "drizzle-orm/pg-core";
import { tenant } from "./tenant.js";

/**
 * SSOConfig table
 */
export const ssoConfig = pgTable(
  "sso_config",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 50 }).notNull(), // google, microsoft, github, etc.
    providerClientId: varchar("provider_client_id", { length: 255 }).notNull(),
    providerClientSecret: varchar("provider_client_secret", { length: 500 }).notNull(),
    // Domain mapping for auto-detection (email domain -> SSO provider)
    domains: json("domains").$type<string[]>(), // ["company.com", "corp.com"]
    scopes: json("scopes").$type<string[]>(), // ["openid", "profile", "email"]
    enabled: boolean("enabled").notNull().default(true),
    // JIT provisioning settings
    jitProvisioning: boolean("jit_provisioning").notNull().default(true),
    jitAutoActivate: boolean("jit_auto_activate").notNull().default(true),
    // Default role for JIT provisioned users
    defaultRole: varchar("default_role", { length: 50 }).default("member"),
    // Mapping of SSO provider attributes to user fields
    attributeMapping: json("attribute_mapping").$type<Record<string, string>>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("idx_sso_config_tenant").on(table.tenantId),
    tenantProviderUnique: unique("idx_sso_config_tenant_provider").on(table.tenantId, table.provider),
  })
);

/**
 * SSOConfig types
 */
export type SSOConfig = typeof ssoConfig.$inferSelect;
export type NewSSOConfig = typeof ssoConfig.$inferInsert;

/**
 * Supported OAuth providers
 */
export const OAUTH_PROVIDERS = {
  GOOGLE: "google",
  MICROSOFT: "microsoft",
  GITHUB: "github",
  GITLAB: "gitlab",
  OIDC: "oidc",
} as const;

export type OAuthProvider = typeof OAUTH_PROVIDERS[keyof typeof OAUTH_PROVIDERS];
