/**
 * AuditEvent Schema
 *
 * Records all critical operations for audit logging.
 */

import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { tenant } from "./tenant.js";
import { user } from "./user.js";

/**
 * AuditEvent table
 */
export const auditEvent = pgTable(
  "audit_event",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenant.id),
    actorUserId: uuid("actor_user_id").references(() => user.id),
    actorType: varchar("actor_type", { length: 50 }).notNull(), // 'user' | 'system' | 'admin'
    action: varchar("action", { length: 100 }).notNull(),
    resourceType: varchar("resource_type", { length: 100 }),
    resourceId: uuid("resource_id"),
    result: varchar("result", { length: 20 }).notNull(), // 'success' | 'failure' | 'partial'
    errorMessage: text("error_message"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    traceId: varchar("trace_id", { length: 100 }).notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("idx_audit_tenant_id").on(table.tenantId),
    actorIdx: index("idx_audit_actor_id").on(table.actorUserId),
    traceIdIdx: index("idx_audit_trace_id").on(table.traceId),
    createdAtIdx: index("idx_audit_created_at").on(table.createdAt),
  })
);

/**
 * AuditEvent types
 */
export type AuditEvent = typeof auditEvent.$inferSelect;
export type NewAuditEvent = typeof auditEvent.$inferInsert;

/**
 * Actor type enum
 */
export const ActorType = {
  USER: "user",
  SYSTEM: "system",
  ADMIN: "admin",
} as const;

/**
 * Audit result enum
 */
export const AuditResult = {
  SUCCESS: "success",
  FAILURE: "failure",
  PARTIAL: "partial",
} as const;

/**
 * Audit action enum (common actions)
 */
export const AuditAction = {
  // Authentication
  LOGIN: "login",
  LOGOUT: "logout",
  LOGIN_FAILED: "login.failed",
  // User management
  USER_CREATE: "user.create",
  USER_INVITE: "user.invite",
  USER_APPROVE: "user.approve",
  USER_REJECT: "user.reject",
  USER_SUSPEND: "user.suspend",
  USER_ACTIVATE: "user.activate",
  PASSWORD_RESET: "user.password.reset",
  PASSWORD_CHANGE: "user.password.change",
  // MFA
  MFA_ENABLE: "mfa.enable",
  MFA_DISABLE: "mfa.disable",
  MFA_VERIFY: "mfa.verify",
  // Session
  SESSION_REVOKE: "session.revoke",
  // Tenant
  TENANT_CREATE: "tenant.create",
  TENANT_UPDATE: "tenant.update",
  TENANT_DELETE: "tenant.delete",
  // Group
  GROUP_CREATE: "group.create",
  GROUP_UPDATE: "group.update",
  GROUP_DELETE: "group.delete",
  GROUP_MEMBER_ADD: "group.member.add",
  GROUP_MEMBER_REMOVE: "group.member.remove",
} as const;
