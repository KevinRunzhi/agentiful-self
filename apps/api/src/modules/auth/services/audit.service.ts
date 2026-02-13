/**
 * Audit Service
 *
 * Service for logging audit events
 */

import type { AuditEvent, CreateAuditEvent, AuditResult, ActorType } from "@agentifui/shared/types";
import { getDatabase } from "@agentifui/db/client";
import { auditEvent } from "@agentifui/db/schema";
import { randomUUID } from "node:crypto";

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
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        result: data.result,
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
      .orderBy(auditEvent.createdAt, "desc")
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
      .orderBy(auditEvent.createdAt, "desc")
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
      .orderBy(auditEvent.createdAt, "asc");

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

import { eq } from "drizzle-orm";
