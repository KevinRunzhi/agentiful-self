/**
 * RBAC Schema
 *
 * Implements the RBAC Authorization Model (S1-2) including:
 * - Role (RBAC roles: root_admin, tenant_admin, user)
 * - Permission (permission definitions)
 * - RolePermission (role-permission associations)
 * - UserRole (user-role assignments with tenant scope)
 * - AppGrant (application access grants)
 * - App (minimal app structure for S1-2)
 *
 * Manager is NOT a Role - it's determined by GroupMember.role='manager'
 */

import {
  pgTable,
  serial,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  index,
  unique,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./user.js";
import { tenant } from "./tenant.js";

// =============================================================================
// Role - RBAC Role Definitions
// =============================================================================

/**
 * Role table
 * Defines RBAC roles in the system.
 * Predefined roles: root_admin, tenant_admin, user
 */
export const rbacRole = pgTable(
  "rbac_role",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 64 }).notNull().unique(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    description: text("description"),
    isSystem: boolean("is_system").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index("idx_rbac_role_name").on(table.name),
    isActiveIdx: index("idx_rbac_role_is_active").on(table.isActive),
  })
);

export type RbacRole = typeof rbacRole.$inferSelect;
export type NewRbacRole = typeof rbacRole.$inferInsert;

// =============================================================================
// Permission - Permission Definitions
// =============================================================================

/**
 * Permission table
 * Defines permissions in the system.
 * Format: {category}:{action} (e.g., "tenant:manage", "app:use")
 */
export const permission = pgTable(
  "permission",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 64 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    category: varchar("category", { length: 64 }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    codeIdx: index("idx_permission_code").on(table.code),
    categoryIsActiveIdx: index("idx_permission_category_is_active").on(table.category, table.isActive),
  })
);

export type Permission = typeof permission.$inferSelect;
export type NewPermission = typeof permission.$inferInsert;

// =============================================================================
// RolePermission - Role-Permission Associations
// =============================================================================

/**
 * RolePermission table
 * Many-to-many relationship between Role and Permission.
 */
export const rolePermission = pgTable(
  "role_permission",
  {
    roleId: serial("role_id")
      .references(() => rbacRole.id, { onDelete: "cascade" })
      .notNull(),
    permissionId: serial("permission_id")
      .references(() => permission.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    rolePermissionPk: unique("role_permission_pk").on(table.roleId, table.permissionId),
    roleIdIdx: index("idx_role_permission_role_id").on(table.roleId),
    permissionIdIdx: index("idx_role_permission_permission_id").on(table.permissionId),
  })
);

export type RolePermission = typeof rolePermission.$inferSelect;
export type NewRolePermission = typeof rolePermission.$inferInsert;

// =============================================================================
// UserRole - User-Role Assignments
// =============================================================================

/**
 * UserRole table (RBAC)
 * Many-to-many relationship between User and Role with Tenant scope.
 * Supports temporary roles (e.g., Break-glass) via expiresAt.
 *
 * Note: This is different from the S1-1 user_role table which uses varchar for role.
 * S1-2 uses proper RBAC with references to rbac_role table.
 */
export const rbacUserRole = pgTable(
  "rbac_user_role",
  {
    userId: uuid("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    roleId: serial("role_id")
      .references(() => rbacRole.id, { onDelete: "cascade" })
      .notNull(),
    tenantId: uuid("tenant_id")
      .references(() => tenant.id, { onDelete: "cascade" })
      .notNull(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    rbacUserRolePk: unique("rbac_user_role_pk").on(table.userId, table.roleId, table.tenantId),
    userTenantIdx: index("idx_rbac_user_role_user_tenant").on(table.userId, table.tenantId),
    expiresAtIdx: index("idx_rbac_user_role_expires_at").on(table.expiresAt),
  })
);

export type RbacUserRole = typeof rbacUserRole.$inferSelect;
export type NewRbacUserRole = typeof rbacUserRole.$inferInsert;

// =============================================================================
// App - Application (Minimal S1-2 Structure)
// =============================================================================

/**
 * App table
 * Minimal application structure for S1-2.
 * Full definition will be in S1-3.
 */
export const app = pgTable(
  "app",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenant.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    externalId: varchar("external_id", { length: 255 }),
    externalPlatform: varchar("external_platform", { length: 64 }),
    description: text("description"),
    mode: varchar("mode", { length: 32 }).default("chat").notNull(), // 'chat' | 'workflow' | 'agent' | 'completion'
    icon: text("icon"),
    iconType: varchar("icon_type", { length: 32 }).default("image").notNull(), // 'image' | 'emoji' | 'link'
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    isFeatured: boolean("is_featured").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    enableApi: boolean("enable_api").default(true).notNull(),
    apiRpm: integer("api_rpm").default(0).notNull(),
    config: jsonb("config").$type<Record<string, unknown>>().default({}).notNull(),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    status: varchar("status", { length: 32 })
      .default("active")
      .notNull(), // 'active' | 'disabled' | 'deleted'
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("idx_app_tenant").on(table.tenantId),
    statusIdx: index("idx_app_status").on(table.status),
    tenantStatusModeIdx: index("idx_app_tenant_status_mode").on(table.tenantId, table.status, table.mode),
    searchNameIdx: index("idx_app_search_name").on(table.name),
    featuredSortIdx: index("idx_app_featured_sort").on(
      table.tenantId,
      table.isFeatured,
      table.sortOrder
    ),
  })
);

export type App = typeof app.$inferSelect;
export type NewApp = typeof app.$inferInsert;

// =============================================================================
// AppGrant - Application Access Grants
// =============================================================================

/**
 * AppGrant table
 * Application access authorization records.
 * Supports:
 * - Group grants (granteeType='group', permission='use')
 * - User direct grants (granteeType='user', permission='use')
 * - Explicit denies (permission='deny')
 */
export const appGrant = pgTable(
  "app_grant",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),
    appId: uuid("app_id")
      .references(() => app.id, { onDelete: "cascade" })
      .notNull(),
    granteeType: varchar("grantee_type", { length: 32 })
      .notNull(), // 'group' | 'user'
    granteeId: uuid("grantee_id").notNull(),
    permission: varchar("permission", { length: 32 })
      .default("use")
      .notNull(), // 'use' | 'deny'
    reason: text("reason"),
    grantedBy: uuid("granted_by").references(() => user.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    appIdIdx: index("idx_app_grant_app_id").on(table.appId),
    granteeIdx: index("idx_app_grant_grantee").on(table.granteeType, table.granteeId),
    expiresAtIdx: index("idx_app_grant_expires_at").on(table.expiresAt),
    denyIdx: index("idx_app_grant_deny").on(table.granteeType, table.granteeId).where(
      sql`permission = 'deny'`
    ),
  })
);

export type AppGrant = typeof appGrant.$inferSelect;
export type NewAppGrant = typeof appGrant.$inferInsert;
