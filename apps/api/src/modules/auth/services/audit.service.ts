/**
 * Audit Service
 *
 * Service for logging audit events
 */

import type { AuditEvent, CreateAuditEvent, AuditResult, ActorType } from "@agentifui/shared/types";
import { getDatabase } from "@agentifui/db/client";
import { auditEvent } from "@agentifui/db/schema";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

function inferEventCategory(action: string): CreateAuditEvent["eventCategory"] {
  if (action.startsWith("auth.")) return "authentication";
  if (action.startsWith("authz.")) return "authorization";
  if (action.startsWith("access.")) return "data_access";
  if (action.startsWith("gov.")) return "security_event";
  if (action.startsWith("admin.")) return "management_change";
  return undefined;
}

function inferSeverity(action: string, current?: CreateAuditEvent["severity"]): CreateAuditEvent["severity"] {
  if (current) {
    return current;
  }

  if (
    action.includes("breakglass") ||
    action.includes("blocked") ||
    action.includes("exceeded")
  ) {
    return "critical";
  }

  if (action.includes("failure") || action.includes("denied")) {
    return "high";
  }

  if (action.startsWith("gov.")) {
    return "medium";
  }

  return "low";
}

/**
 * Audit service
 */
export class AuditService {
  /**
   * Create audit event
   */
  async createEvent(data: CreateAuditEvent): Promise<AuditEvent> {
    const db = getDatabase();

    const [event] = await db
      .insert(auditEvent)
      .values({
        id: randomUUID(),
        tenantId: data.tenantId,
        actorUserId: data.actorUserId,
        actorType: data.actorType,
        actorRole: data.actorRole,
        eventCategory: data.eventCategory ?? inferEventCategory(data.action),
        eventType: data.eventType ?? data.action,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        targetType: data.targetType,
        targetId: data.targetId,
        result: data.result,
        severity: inferSeverity(data.action, data.severity),
        reason: data.reason,
        errorMessage: data.errorMessage,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        traceId: data.traceId,
        metadata: data.metadata as any,
        createdAt: new Date(),
      })
      .returning();

    return event;
  }

  /**
   * Log successful action
   */
  async logSuccess(
    data: Omit<CreateAuditEvent, "result" | "traceId"> & { traceId?: string }
  ): Promise<AuditEvent> {
    return this.createEvent({
      ...data,
      result: "success",
      traceId: data.traceId || this.generateTraceId(),
    });
  }

  /**
   * Log failed action
   */
  async logFailure(
    data: Omit<CreateAuditEvent, "result" | "traceId"> & { traceId?: string },
    errorMessage: string
  ): Promise<AuditEvent> {
    return this.createEvent({
      ...data,
      result: "failure",
      errorMessage,
      traceId: data.traceId || this.generateTraceId(),
    });
  }

  /**
   * Log partial success
   */
  async logPartial(
    data: Omit<CreateAuditEvent, "result" | "traceId"> & { traceId?: string },
    errorMessage?: string
  ): Promise<AuditEvent> {
    return this.createEvent({
      ...data,
      result: "partial",
      errorMessage,
      traceId: data.traceId || this.generateTraceId(),
    });
  }

  /**
   * Generate trace ID
   */
  private generateTraceId(): string {
    return randomUUID();
  }

  /**
   * Query audit events for a tenant
   */
  async getTenantEvents(tenantId: string, limit = 100, offset = 0): Promise<AuditEvent[]> {
    const db = getDatabase();

    const events = await db
      .select()
      .from(auditEvent)
      .where(eq(auditEvent.tenantId, tenantId))
      .orderBy(desc(auditEvent.createdAt))
      .limit(limit)
      .offset(offset);

    return events;
  }

  /**
   * Query audit events for a user
   */
  async getUserEvents(actorUserId: string, limit = 100, offset = 0): Promise<AuditEvent[]> {
    const db = getDatabase();

    const events = await db
      .select()
      .from(auditEvent)
      .where(eq(auditEvent.actorUserId, actorUserId))
      .orderBy(desc(auditEvent.createdAt))
      .limit(limit)
      .offset(offset);

    return events;
  }

  /**
   * Query audit events by trace ID
   */
  async getEventsByTraceId(traceId: string): Promise<AuditEvent[]> {
    const db = getDatabase();

    const events = await db
      .select()
      .from(auditEvent)
      .where(eq(auditEvent.traceId, traceId))
      .orderBy(auditEvent.createdAt);

    return events;
  }
}

// Singleton instance
export const auditService = new AuditService();

/**
 * Helper function to create audit context from request
 */
export function createAuditContext(request: {
  headers: { [key: string]: string | undefined };
  ip?: string;
  user?: { id: string };
  tenant?: { id: string };
}) {
  return {
    tenantId: request.tenant?.id,
    actorUserId: request.user?.id,
    actorType: request.user ? ("user" as ActorType) : ("system" as ActorType),
    ipAddress: request.ip || request.headers["x-forwarded-for"] || request.headers["x-real-ip"],
    userAgent: request.headers["user-agent"],
    traceId: request.headers["x-trace-id"] || request.headers["x-request-id"] || randomUUID(),
  };
}
