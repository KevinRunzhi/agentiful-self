/**
 * Group Schema
 *
 * Tenant-level organization unit for member management
 */

import { pgTable, uuid, varchar, text, integer, timestamp, index, unique } from "drizzle-orm/pg-core";
import { tenant } from "./tenant.js";

/**
 * Group table
 */
export const group = pgTable(
  "group",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("idx_group_tenant").on(table.tenantId),
    tenantNameUnique: unique("idx_group_tenant_name").on(table.tenantId, table.name),
  })
);

/**
 * Group types
 */
export type Group = typeof group.$inferSelect;
export type NewGroup = typeof group.$inferInsert;
