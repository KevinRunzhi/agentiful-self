/**
 * Shared Audit Types
 *
 * Type definitions for audit logging used across frontend and backend
 */

/**
 * Audit event entry
 */
export interface AuditEvent {
  id: string;
  tenantId: string | null;
  actorUserId: string | null;
  actorType: ActorType;
  actorRole?: string | null;
  eventCategory?: AuditEventCategory | null;
  eventType?: string | null;
  action: AuditAction | string;
  resourceType: string | null;
  resourceId: string | null;
  targetType?: string | null;
  targetId?: string | null;
  result: AuditResult;
  severity?: AuditSeverity | null;
  reason?: string | null;
  errorMessage: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  traceId: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

/**
 * Actor type
 */
export type ActorType = "user" | "system" | "admin";

export type AuditEventCategory =
  | "authentication"
  | "authorization"
  | "data_access"
  | "management_change"
  | "security_event";

export type AuditSeverity = "low" | "medium" | "high" | "critical";

/**
 * Audit result
 */
export type AuditResult = "success" | "failure" | "partial";

/**
 * Common audit actions
 */
export type AuditAction =
  | "login"
  | "logout"
  | "login.failed"
  | "user.create"
  | "user.invite"
  | "user.approve"
  | "user.reject"
  | "user.suspend"
  | "user.activate"
  | "user.password.reset"
  | "user.password.change"
  | "mfa.enable"
  | "mfa.disable"
  | "mfa.verify"
  | "session.revoke"
  | "tenant.create"
  | "tenant.update"
  | "tenant.delete"
  | "group.create"
  | "group.update"
  | "group.delete"
  | "group.member.add"
  | "group.member.remove"
  | "auth.login.success"
  | "auth.login.failure"
  | "auth.logout"
  | "auth.mfa.enabled"
  | "auth.mfa.disabled"
  | "auth.password.changed"
  | "auth.password.reset"
  | "authz.role.assigned"
  | "authz.role.revoked"
  | "authz.app.granted"
  | "authz.app.revoked"
  | "authz.policy.updated"
  | "access.conversation.viewed"
  | "access.conversation.exported"
  | "access.audit.exported"
  | "access.breakglass"
  | "gov.pii.detected"
  | "gov.pii.masked"
  | "gov.content.blocked"
  | "gov.injection.detected"
  | "gov.quota.warning"
  | "gov.quota.exceeded"
  | "admin.tenant.updated"
  | "admin.user.created"
  | "admin.group.updated"
  | "admin.app.updated";

/**
 * Audit log filters
 */
export interface AuditLogFilters {
  tenantId?: string;
  userId?: string;
  action?: AuditAction | string;
  eventCategory?: AuditEventCategory;
  eventType?: string;
  resourceType?: string;
  targetType?: string;
  targetId?: string;
  result?: AuditResult;
  severity?: AuditSeverity;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Audit log list response
 */
export interface AuditLogResponse {
  events: AuditEvent[];
  total: number;
  hasMore: boolean;
}

/**
 * Trace ID context for logging
 */
export interface TraceContext {
  traceId: string;
  userId?: string;
  tenantId?: string;
  requestId?: string;
}

/**
 * Audit event creation data
 */
export interface CreateAuditEvent {
  tenantId?: string;
  actorUserId?: string;
  actorType: ActorType;
  actorRole?: string;
  eventCategory?: AuditEventCategory;
  eventType?: string;
  action: AuditAction | string;
  resourceType?: string;
  resourceId?: string;
  targetType?: string;
  targetId?: string;
  result: AuditResult;
  severity?: AuditSeverity;
  reason?: string;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  traceId: string;
  metadata?: Record<string, unknown>;
}
