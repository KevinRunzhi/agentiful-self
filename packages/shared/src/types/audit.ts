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
  action: AuditAction | string;
  resourceType: string | null;
  resourceId: string | null;
  result: AuditResult;
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
  | "group.member.remove";

/**
 * Audit log filters
 */
export interface AuditLogFilters {
  tenantId?: string;
  userId?: string;
  action?: AuditAction | string;
  resourceType?: string;
  result?: AuditResult;
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
  action: AuditAction | string;
  resourceType?: string;
  resourceId?: string;
  result: AuditResult;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  traceId: string;
  metadata?: Record<string, unknown>;
}
