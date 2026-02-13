/**
 * UserRole Schema
 *
 * Implements N:N relationship between User and Tenant.
 * A user can belong to multiple tenants with different roles.
 */

import { pgTable, uuid, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { user } from "./user.js";
import { tenant } from "./tenant.js";

/**
 * UserRole table
 */
export const userRole = pgTable(
  "user_role",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }).notNull(), // 'ROOT_ADMIN' | 'TENANT_ADMIN' | 'USER'
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userTenantUniqueIdx: index("idx_user_role_user_tenant").on(table.userId, table.tenantId),
    tenantIdx: index("idx_user_role_tenant").on(table.tenantId),
  })
);

/**
 * UserRole types
 */
export type UserRole = typeof userRole.$inferSelect;
export type NewUserRole = typeof userRole.$inferInsert;

/**
 * Role enum
 */
export const Role = {
  ROOT_ADMIN: "ROOT_ADMIN", // System super admin (cross-tenant)
  TENANT_ADMIN: "TENANT_ADMIN", // Tenant admin (within tenant)
  USER: "USER", // Regular user
} as const;
