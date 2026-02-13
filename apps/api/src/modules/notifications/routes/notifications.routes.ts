/**
 * Notification Routes
 *
 * API routes for notifications (S1-2 User Story 6).
 *
 * Endpoints:
 * - GET /notifications/unread-count - Get unread notification count
 * - GET /notifications/breakglass - Get break-glass notifications
 * - PATCH /notifications/:id/read - Mark notification as read
 * - PATCH /notifications/read-all - Mark all notifications as read
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createNotificationStore } from '../services/notification.service';

// =============================================================================
// Types
// =============================================================================

interface NotificationParams {
  id: string;
}

// =============================================================================
// Route Handlers
// =============================================================================

/**
 * T113 [P] [US6] Create GET /notifications/unread-count route
 */
async function getUnreadCount(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const tenantId = (request.tenant as { id: string })?.id;

  if (!tenantId) {
    return reply.status(400).send({
      errors: [{ code: 'AFUI_IAM_001', message: 'Tenant context required' }],
    });
  }

  try {
    const notificationStore = createNotificationStore();
    const count = await notificationStore.getUnreadCount(tenantId);

    reply.status(200).send({
      data: count,
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    reply.status(500).send({
      errors: [{ code: 'AFUI_IAM_001', message: 'Internal server error' }],
    });
  }
}

/**
 * T113 [P] [US6] Create GET /notifications/breakglass route
 */
async function getBreakglassNotifications(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const tenantId = (request.tenant as { id: string })?.id;

  if (!tenantId) {
    return reply.status(400).send({
      errors: [{ code: 'AFUI_IAM_001', message: 'Tenant context required' }],
    });
  }

  try {
    const notificationStore = createNotificationStore();
    const notifications = await notificationStore.findByTenant(tenantId);

    // Filter only break-glass related notifications
    const breakglassNotifications = notifications.filter(
      (n) => n.type === 'breakglass_activated' || n.type === 'breakglass_expired'
    );

    // Get user info for rootAdminName
    const enrichedNotifications = await Promise.all(
      breakglassNotifications.map(async (notification) => {
        // Try to get user info from database
        let rootAdminName: string | undefined;
        try {
          const userResult = await request.db
            .select({ name: request.users?.name })
            .from(request.users || 'users')
            .where(eq(request.users?.id || 'id', notification.rootAdminId))
            .limit(1);

          if (userResult.length > 0) {
            rootAdminName = userResult[0].name;
          }
        } catch {
          // User lookup failed, continue without name
        }

        return {
          id: notification.id,
          type: notification.type,
          message: formatNotificationMessage(notification),
          metadata: {
            rootAdminId: notification.rootAdminId,
            rootAdminName,
            reason: notification.reason,
            expiresAt: notification.expiresAt,
          },
          createdAt: notification.createdAt,
          isRead: notification.isRead,
        };
      })
    );

    reply.status(200).send({
      data: enrichedNotifications,
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    reply.status(500).send({
      errors: [{ code: 'AFUI_IAM_001', message: 'Internal server error' }],
    });
  }
}

/**
 * Mark notification as read
 */
async function markAsRead(
  request: FastifyRequest<{ Params: NotificationParams }>,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params;

  try {
    const notificationStore = createNotificationStore();
    await notificationStore.markAsRead(id);

    reply.status(204).send();
  } catch (error) {
    reply.status(500).send({
      errors: [{ code: 'AFUI_IAM_001', message: 'Internal server error' }],
    });
  }
}

/**
 * Mark all notifications as read
 */
async function markAllAsRead(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const tenantId = (request.tenant as { id: string })?.id;

  if (!tenantId) {
    return reply.status(400).send({
      errors: [{ code: 'AFUI_IAM_001', message: 'Tenant context required' }],
    });
  }

  try {
    const notificationStore = createNotificationStore();
    await notificationStore.markAllAsRead(tenantId);

    reply.status(204).send();
  } catch (error) {
    reply.status(500).send({
      errors: [{ code: 'AFUI_IAM_001', message: 'Internal server error' }],
    });
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatNotificationMessage(notification: {
  type: string;
  createdAt: Date;
  expiresAt: Date;
}): string {
  const timeStr = notification.createdAt.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (notification.type === 'breakglass_activated') {
    return `ROOT ADMIN 于 ${timeStr} 访问了本租户`;
  } else if (notification.type === 'breakglass_expired') {
    return `Break-glass 会话已过期`;
  }

  return '未知通知类型';
}

// =============================================================================
// Route Registration
// =============================================================================

export async function notificationRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/notifications/unread-count',
    {
      schema: {
        description: 'Get unread notification count',
        tags: ['Notifications'],
        response: {
          200: {
            description: 'Unread count',
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  breakglass: { type: 'number' },
                  other: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    getUnreadCount
  );

  fastify.get(
    '/notifications/breakglass',
    {
      schema: {
        description: 'Get break-glass notifications',
        tags: ['Notifications'],
        response: {
          200: {
            description: 'Break-glass notifications',
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string' },
                    message: { type: 'string' },
                    metadata: { type: 'object' },
                    createdAt: { type: 'string', format: 'date-time' },
                    isRead: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    getBreakglassNotifications
  );

  fastify.patch<{
    Params: NotificationParams;
  }>(
    '/notifications/:id/read',
    {
      schema: {
        description: 'Mark notification as read',
        tags: ['Notifications'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          204: {
            description: 'Notification marked as read',
            type: 'null',
          },
        },
      },
    },
    markAsRead
  );

  fastify.patch(
    '/notifications/read-all',
    {
      schema: {
        description: 'Mark all notifications as read',
        tags: ['Notifications'],
        response: {
          204: {
            description: 'All notifications marked as read',
            type: 'null',
          },
        },
      },
    },
    markAllAsRead
  );
}

// Import for type checking
import { eq } from 'drizzle-orm';
