/**
 * Notification Routes
 *
 * S1-3 APIs:
 * - GET /notifications (cursor pagination)
 * - GET /notifications/unread-count
 * - PATCH /notifications/:id/read
 */

import { getDatabase } from "@agentifui/db/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createNotificationService } from "../services/notification.service";

interface NotificationParams {
  id: string;
}

interface NotificationQuerystring {
  cursor?: string;
  limit?: number;
  type?: string;
  unreadOnly?: string;
}

function getTenantId(request: FastifyRequest): string | undefined {
  const fromQuery = (request.query as { tenantId?: string } | undefined)?.tenantId;
  if (typeof fromQuery === "string" && fromQuery.trim().length > 0) {
    return fromQuery.trim();
  }

  const fromContext = (request.tenant as { id?: string } | undefined)?.id;
  if (fromContext) {
    return fromContext;
  }

  const fromHeader = request.headers["x-tenant-id"];
  if (typeof fromHeader === "string" && fromHeader.trim().length > 0) {
    return fromHeader.trim();
  }

  return undefined;
}

function getRecipientId(request: FastifyRequest): string | undefined {
  const userFromContext = (request as unknown as { user?: { id?: string } }).user?.id;
  if (userFromContext && userFromContext.trim().length > 0) {
    return userFromContext.trim();
  }

  const fromHeader = request.headers["x-user-id"];
  if (typeof fromHeader === "string" && fromHeader.trim().length > 0) {
    return fromHeader.trim();
  }

  return undefined;
}

function getDb(request: FastifyRequest): unknown {
  const dbFromRequest = (request as { db?: unknown }).db;
  const dbFromServer = (request.server as { db?: unknown }).db;
  if (dbFromRequest || dbFromServer) {
    return dbFromRequest ?? dbFromServer;
  }

  try {
    return getDatabase();
  } catch {
    return undefined;
  }
}

function parseBoolean(value: string | undefined): boolean {
  return value === "true";
}

async function getNotifications(
  request: FastifyRequest<{ Querystring: NotificationQuerystring }>,
  reply: FastifyReply
): Promise<void> {
  const tenantId = getTenantId(request);
  const recipientId = getRecipientId(request);
  const db = getDb(request);

  if (!tenantId) {
    return reply.status(400).send({
      errors: [{ code: "AFUI_IAM_001", message: "Tenant context required" }],
    });
  }

  if (!db) {
    return reply.status(503).send({
      errors: [{ code: "AFUI_IAM_001", message: "Database context unavailable" }],
    });
  }

  try {
    const notificationService = createNotificationService(db as any);
    const result = recipientId
      ? await notificationService.findByRecipient(tenantId, recipientId, {
          cursor: request.query.cursor ?? null,
          limit: request.query.limit,
          type: request.query.type,
          unreadOnly: parseBoolean(request.query.unreadOnly),
        })
      : {
          items: (await notificationService.findByTenant(tenantId)).slice(0, request.query.limit ?? 20),
          nextCursor: null,
        };

    reply.status(200).send({
      data: {
        items: result.items.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          message: item.message,
          metadata: item.metadata,
          createdAt: item.createdAt,
          isRead: item.isRead,
          readAt: item.readAt ?? null,
        })),
        nextCursor: result.nextCursor,
      },
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    reply.status(500).send({
      errors: [{ code: "AFUI_IAM_001", message: "Internal server error" }],
    });
  }
}

async function getUnreadCount(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const tenantId = getTenantId(request);
  const recipientId = getRecipientId(request);
  const db = getDb(request);

  if (!tenantId) {
    return reply.status(400).send({
      errors: [{ code: "AFUI_IAM_001", message: "Tenant context required" }],
    });
  }

  if (!db) {
    return reply.status(503).send({
      errors: [{ code: "AFUI_IAM_001", message: "Database context unavailable" }],
    });
  }

  try {
    const notificationService = createNotificationService(db as any);
    const count = await notificationService.getUnreadCount(tenantId, recipientId);

    reply.status(200).send({
      data: count,
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    reply.status(500).send({
      errors: [{ code: "AFUI_IAM_001", message: "Internal server error" }],
    });
  }
}

async function markAsRead(
  request: FastifyRequest<{ Params: NotificationParams }>,
  reply: FastifyReply
): Promise<void> {
  const tenantId = getTenantId(request);
  const recipientId = getRecipientId(request);
  const db = getDb(request);

  if (!tenantId) {
    return reply.status(400).send({
      errors: [{ code: "AFUI_IAM_001", message: "Tenant context required" }],
    });
  }

  if (!db) {
    return reply.status(503).send({
      errors: [{ code: "AFUI_IAM_001", message: "Database context unavailable" }],
    });
  }

  try {
    const notificationService = createNotificationService(db as any);
    await notificationService.markAsRead(request.params.id, tenantId, recipientId);
    reply.status(204).send();
  } catch {
    reply.status(500).send({
      errors: [{ code: "AFUI_IAM_001", message: "Internal server error" }],
    });
  }
}

async function markAllAsRead(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const tenantId = getTenantId(request);
  const recipientId = getRecipientId(request);
  const db = getDb(request);

  if (!tenantId) {
    return reply.status(400).send({
      errors: [{ code: "AFUI_IAM_001", message: "Tenant context required" }],
    });
  }

  if (!db) {
    return reply.status(503).send({
      errors: [{ code: "AFUI_IAM_001", message: "Database context unavailable" }],
    });
  }

  try {
    const notificationService = createNotificationService(db as any);
    await notificationService.markAllAsRead(tenantId, recipientId);
    reply.status(204).send();
  } catch {
    reply.status(500).send({
      errors: [{ code: "AFUI_IAM_001", message: "Internal server error" }],
    });
  }
}

async function getBreakglassNotifications(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const tenantId = getTenantId(request);
  const db = getDb(request);

  if (!tenantId) {
    return reply.status(400).send({
      errors: [{ code: "AFUI_IAM_001", message: "Tenant context required" }],
    });
  }
  if (!db) {
    return reply.status(503).send({
      errors: [{ code: "AFUI_IAM_001", message: "Database context unavailable" }],
    });
  }

  const notificationService = createNotificationService(db as any);
  const rows = await notificationService.findByTenant(tenantId);
  const items = rows.filter((row) =>
    ["breakglass", "breakglass_activated", "breakglass_expired"].includes(row.type)
  );

  reply.status(200).send({
    data: items,
    meta: {
      traceId: request.id,
      timestamp: new Date().toISOString(),
    },
  });
}

async function getQuotaNotifications(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const tenantId = getTenantId(request);
  const db = getDb(request);

  if (!tenantId) {
    return reply.status(400).send({
      errors: [{ code: "AFUI_IAM_001", message: "Tenant context required" }],
    });
  }
  if (!db) {
    return reply.status(503).send({
      errors: [{ code: "AFUI_IAM_001", message: "Database context unavailable" }],
    });
  }

  const notificationService = createNotificationService(db as any);
  const rows = await notificationService.findByTenant(tenantId);
  const items = rows.filter((row) =>
    ["quota_alert", "quota_warning", "quota_exceeded"].includes(row.type)
  );

  reply.status(200).send({
    data: items,
    meta: {
      traceId: request.id,
      timestamp: new Date().toISOString(),
    },
  });
}

export async function notificationRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{
    Querystring: NotificationQuerystring;
  }>(
    "/notifications",
    {
      schema: {
        description: "List in-app notifications",
        tags: ["Notifications"],
        querystring: {
          type: "object",
          properties: {
            cursor: { type: "string" },
            limit: { type: "number", minimum: 1, maximum: 100 },
            type: { type: "string" },
            unreadOnly: { type: "string", enum: ["true", "false"] },
          },
        },
      },
    },
    getNotifications
  );

  fastify.get(
    "/notifications/unread-count",
    {
      schema: {
        description: "Get unread notification count",
        tags: ["Notifications"],
      },
    },
    getUnreadCount
  );

  fastify.get(
    "/notifications/breakglass",
    {
      schema: {
        description: "List break-glass notifications (compat endpoint)",
        tags: ["Notifications"],
      },
    },
    getBreakglassNotifications
  );

  fastify.get(
    "/notifications/quota",
    {
      schema: {
        description: "List quota notifications (compat endpoint)",
        tags: ["Notifications"],
      },
    },
    getQuotaNotifications
  );

  fastify.patch<{
    Params: NotificationParams;
  }>(
    "/notifications/:id/read",
    {
      schema: {
        description: "Mark notification as read",
        tags: ["Notifications"],
      },
    },
    markAsRead
  );

  fastify.patch(
    "/notifications/read-all",
    {
      schema: {
        description: "Mark all notifications as read",
        tags: ["Notifications"],
      },
    },
    markAllAsRead
  );
}
