/**
 * Break-glass Routes
 *
 * API routes for emergency access mechanism (S1-2 User Story 6).
 *
 * Endpoints:
 * - POST /breakglass/activate - Activate break-glass session
 * - GET /breakglass/status - Get break-glass status
 * - POST /breakglass/extend - Extend break-glass session
 * - DELETE /breakglass/revoke - Revoke break-glass session
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from "@agentifui/db/client";
import { createBreakglassService } from '../services/breakglass.service';
import { createNotificationService } from "../../notifications/services/notification.service";

// =============================================================================
// Types
// =============================================================================

interface ActivateBreakglassBody {
  tenantId: string;
  reason: string;
}

interface ExtendBreakglassBody {
  sessionId?: string;
}

interface BreakglassParams {
  tenantId?: string;
}

// =============================================================================
// Route Handlers
// =============================================================================

/**
 * T108 [P] [US6] Create POST /breakglass/activate route
 */
async function postActivateBreakglass(
  request: FastifyRequest<{ Body: ActivateBreakglassBody }>,
  reply: FastifyReply
): Promise<void> {
  const { tenantId, reason } = request.body;
  const userId = (request.user as { id: string })?.id;

  if (!userId) {
    return reply.status(401).send({
      errors: [{ code: 'AFUI_IAM_001', message: 'Unauthorized' }],
    });
  }

  try {
    const db = request.db ?? getDatabase();
    const breakglassService = createBreakglassService(
      db,
      request.auditService,
      createNotificationService(db as any)
    );

    const session = await breakglassService.activateBreakglass({
      rootAdminId: userId,
      tenantId,
      reason,
      traceId: request.headers['x-trace-id'] as string,
    });

    reply.status(200).send({
      data: {
        sessionId: session.sessionId,
        tenantId: session.tenantId,
        tenantName: session.tenantName,
        expiresAt: session.expiresAt,
        activatedAt: session.activatedAt,
      },
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not enabled')) {
        return reply.status(403).send({
          errors: [{ code: 'AFUI_IAM_007', message: error.message }],
        });
      }
      return reply.status(400).send({
        errors: [{ code: 'AFUI_IAM_001', message: error.message }],
      });
    }
    reply.status(500).send({
      errors: [{ code: 'AFUI_IAM_001', message: 'Internal server error' }],
    });
  }
}

/**
 * T109 [P] [US6] Create GET /breakglass/status route
 */
async function getBreakglassStatus(
  request: FastifyRequest<{ Querystring: { tenantId?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = (request.user as { id: string })?.id;
  const tenantId = request.query.tenantId || (request.tenant as { id: string })?.id;

  if (!userId) {
    return reply.status(401).send({
      errors: [{ code: 'AFUI_IAM_001', message: 'Unauthorized' }],
    });
  }

  if (!tenantId) {
    return reply.status(400).send({
      errors: [{ code: 'AFUI_IAM_001', message: 'Tenant ID required' }],
    });
  }

  try {
    const db = request.db ?? getDatabase();
    const breakglassService = createBreakglassService(
      db,
      request.auditService
    );

    const status = await breakglassService.getBreakglassStatus(userId, tenantId);

    reply.status(200).send({
      data: status,
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
 * T110 [US6] Create POST /breakglass/extend route
 */
async function postExtendBreakglass(
  request: FastifyRequest<{ Body: ExtendBreakglassBody; Querystring: { tenantId?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = (request.user as { id: string })?.id;
  const tenantId = request.query.tenantId || (request.tenant as { id: string })?.id;

  if (!userId) {
    return reply.status(401).send({
      errors: [{ code: 'AFUI_IAM_001', message: 'Unauthorized' }],
    });
  }

  if (!tenantId) {
    return reply.status(400).send({
      errors: [{ code: 'AFUI_IAM_001', message: 'Tenant ID required' }],
    });
  }

  try {
    const db = request.db ?? getDatabase();
    const breakglassService = createBreakglassService(
      db,
      request.auditService
    );

    const session = await breakglassService.extendSession(userId, tenantId);

    reply.status(200).send({
      data: {
        sessionId: session.sessionId,
        tenantId: session.tenantId,
        expiresAt: session.expiresAt,
      },
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('No active')) {
        return reply.status(404).send({
          errors: [{ code: 'AFUI_IAM_008', message: error.message }],
        });
      }
      return reply.status(400).send({
        errors: [{ code: 'AFUI_IAM_001', message: error.message }],
      });
    }
    reply.status(500).send({
      errors: [{ code: 'AFUI_IAM_001', message: 'Internal server error' }],
    });
  }
}

/**
 * Revoke break-glass session
 */
async function deleteBreakglass(
  request: FastifyRequest<{ Querystring: { tenantId?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = (request.user as { id: string })?.id;
  const tenantId = request.query.tenantId || (request.tenant as { id: string })?.id;

  if (!userId) {
    return reply.status(401).send({
      errors: [{ code: 'AFUI_IAM_001', message: 'Unauthorized' }],
    });
  }

  if (!tenantId) {
    return reply.status(400).send({
      errors: [{ code: 'AFUI_IAM_001', message: 'Tenant ID required' }],
    });
  }

  try {
    const db = request.db ?? getDatabase();
    const breakglassService = createBreakglassService(
      db,
      request.auditService
    );

    const revoked = await breakglassService.revokeBreakglass(userId, tenantId);

    if (!revoked) {
      return reply.status(404).send({
        errors: [{ code: 'AFUI_IAM_008', message: 'No active break-glass session found' }],
      });
    }

    reply.status(204).send();
  } catch (error) {
    reply.status(500).send({
      errors: [{ code: 'AFUI_IAM_001', message: 'Internal server error' }],
    });
  }
}

// =============================================================================
// Route Registration
// =============================================================================

export async function breakglassRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{
    Body: ActivateBreakglassBody;
  }>(
    '/breakglass/activate',
    {
      schema: {
        description: 'Activate break-glass emergency access session',
        tags: ['Break-glass'],
        body: {
          type: 'object',
          required: ['tenantId', 'reason'],
          properties: {
            tenantId: { type: 'string', format: 'uuid', description: 'Target tenant ID' },
            reason: {
              type: 'string',
              minLength: 10,
              maxLength: 500,
              description: 'Reason for emergency access',
            },
          },
        },
        response: {
          200: {
            description: 'Break-glass session activated',
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  sessionId: { type: 'string' },
                  tenantId: { type: 'string' },
                  tenantName: { type: 'string' },
                  expiresAt: { type: 'string', format: 'date-time' },
                  activatedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
          403: {
            description: 'ROOT ADMIN not enabled',
            type: 'object',
            properties: {
              errors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    code: { type: 'string' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    postActivateBreakglass
  );

  fastify.get<{
    Querystring: { tenantId?: string };
  }>(
    '/breakglass/status',
    {
      schema: {
        description: 'Get break-glass session status',
        tags: ['Break-glass'],
        querystring: {
          type: 'object',
          properties: {
            tenantId: { type: 'string', format: 'uuid', description: 'Tenant ID' },
          },
        },
        response: {
          200: {
            description: 'Break-glass status',
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  isActive: { type: 'boolean' },
                  session: {
                    type: 'object',
                    properties: {
                      sessionId: { type: 'string' },
                      rootAdminId: { type: 'string' },
                      tenantId: { type: 'string' },
                      expiresAt: { type: 'string', format: 'date-time' },
                    },
                  },
                  remainingTime: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    getBreakglassStatus
  );

  fastify.post<{
    Body: ExtendBreakglassBody;
    Querystring: { tenantId?: string };
  }>(
    '/breakglass/extend',
    {
      schema: {
        description: 'Extend break-glass session by 1 hour',
        tags: ['Break-glass'],
        body: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session ID (optional)' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            tenantId: { type: 'string', format: 'uuid', description: 'Tenant ID' },
          },
        },
        response: {
          200: {
            description: 'Session extended',
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  sessionId: { type: 'string' },
                  tenantId: { type: 'string' },
                  expiresAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
          404: {
            description: 'No active session',
            type: 'object',
            properties: {
              errors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    code: { type: 'string' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    postExtendBreakglass
  );

  fastify.delete<{
    Querystring: { tenantId?: string };
  }>(
    '/breakglass/revoke',
    {
      schema: {
        description: 'Revoke active break-glass session',
        tags: ['Break-glass'],
        querystring: {
          type: 'object',
          properties: {
            tenantId: { type: 'string', format: 'uuid', description: 'Tenant ID' },
          },
        },
        response: {
          204: {
            description: 'Session revoked',
            type: 'null',
          },
          404: {
            description: 'No active session',
            type: 'object',
            properties: {
              errors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    code: { type: 'string' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    deleteBreakglass
  );
}
