/**
 * AuditEvent Schema
 *
 * Records all critical operations for audit logging.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
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
    actorRole: varchar("actor_role", { length: 64 }),
    eventCategory: varchar("event_category", { length: 64 }),
    eventType: varchar("event_type", { length: 128 }),
    action: varchar("action", { length: 100 }).notNull(),
    resourceType: varchar("resource_type", { length: 100 }),
    resourceId: varchar("resource_id", { length: 255 }),
    targetType: varchar("target_type", { length: 100 }),
    targetId: varchar("target_id", { length: 255 }),
    result: varchar("result", { length: 20 }).notNull(), // 'success' | 'failure' | 'partial'
    severity: varchar("severity", { length: 16 }), // 'low' | 'medium' | 'high' | 'critical'
    reason: text("reason"),
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
    tenantCategoryCreatedIdx: index("idx_audit_tenant_category_created").on(
      table.tenantId,
      table.eventCategory,
      table.createdAt
    ),
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
  // Authentication (auth.*)
  AUTH_LOGIN_SUCCESS: "auth.login.success",
  AUTH_LOGIN_FAILURE: "auth.login.failure",
  AUTH_LOGOUT: "auth.logout",
  AUTH_MFA_ENABLED: "auth.mfa.enabled",
  AUTH_MFA_DISABLED: "auth.mfa.disabled",
  AUTH_PASSWORD_CHANGED: "auth.password.changed",
  AUTH_PASSWORD_RESET: "auth.password.reset",
  // Authorization (authz.*)
  AUTHZ_ROLE_ASSIGNED: "authz.role.assigned",
  AUTHZ_ROLE_REVOKED: "authz.role.revoked",
  AUTHZ_APP_GRANTED: "authz.app.granted",
  AUTHZ_APP_REVOKED: "authz.app.revoked",
  AUTHZ_POLICY_UPDATED: "authz.policy.updated",
  // Access (access.*)
  ACCESS_CONVERSATION_VIEWED: "access.conversation.viewed",
  ACCESS_CONVERSATION_EXPORTED: "access.conversation.exported",
  ACCESS_AUDIT_EXPORTED: "access.audit.exported",
  ACCESS_BREAKGLASS: "access.breakglass",
  // Governance (gov.*)
  GOV_PII_DETECTED: "gov.pii.detected",
  GOV_PII_MASKED: "gov.pii.masked",
  GOV_CONTENT_BLOCKED: "gov.content.blocked",
  GOV_INJECTION_DETECTED: "gov.injection.detected",
  GOV_QUOTA_WARNING: "gov.quota.warning",
  GOV_QUOTA_EXCEEDED: "gov.quota.exceeded",
  // Admin (admin.*)
  ADMIN_TENANT_UPDATED: "admin.tenant.updated",
  ADMIN_USER_CREATED: "admin.user.created",
  ADMIN_GROUP_UPDATED: "admin.group.updated",
  ADMIN_APP_UPDATED: "admin.app.updated",
} as const;
