/**
 * Apps Routes
 *
 * API routes for accessible apps and context options (T076-T077, T119-T120).
 *
 * Endpoints:
 * - GET /apps/accessible - Get apps accessible to user
 * - GET /apps/:id/context-options - Get context switching options for an app
 */

import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyJsonSchema } from 'fastify';
import { createAppService } from '../services/app.service';

// =============================================================================
// Route Handlers
// =============================================================================

/**
 * T076 [P] [US3] Create GET /apps/accessible route
 */
async function getAccessibleApps(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const currentUser = request.user as { id: string; tenantId?: string } | undefined;

  if (!currentUser) {
    return reply.status(401).send({
      errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }],
    });
  }

  const tenantId = request.headers['x-tenant-id'] as string || currentUser.tenantId;
  const activeGroupId = request.headers['x-active-group-id'] as string | null;

  if (!tenantId) {
    return reply.status(400).send({
      errors: [{ code: 'BAD_REQUEST', message: 'Tenant ID required' }],
    });
  }

  try {
    const appService = createAppService(request.db);
    const result = await appService.getAccessibleApps(currentUser.id, tenantId, activeGroupId);

    reply.status(200).send({
      data: result,
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return reply.status(500).send({
        errors: [{ code: 'INTERNAL_ERROR', message: error.message }],
      });
    }
    throw error;
  }
}

/**
 * T077 [P] [US3] Create GET /apps/:id/context-options route
 * T119 [P] [US7] Get context options for a specific app
 */
async function getAppContextOptions(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const currentUser = request.user as { id: string; tenantId?: string } | undefined;

  if (!currentUser) {
    return reply.status(401).send({
      errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }],
    });
  }

  const tenantId = request.headers['x-tenant-id'] as string || currentUser.tenantId;
  const appId = request.params.id;

  if (!tenantId) {
    return reply.status(400).send({
      errors: [{ code: 'BAD_REQUEST', message: 'Tenant ID required' }],
    });
  }

  try {
    const appService = createAppService(request.db);
    const options = await appService.getAppContextOptions(currentUser.id, tenantId, appId);

    reply.status(200).send({
      data: options,
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return reply.status(404).send({
        errors: [{ code: 'NOT_FOUND', message: error.message }],
      });
    }
    return reply.status(500).send({
      errors: [{ code: 'INTERNAL_ERROR', message: 'Internal server error' }],
    });
  }
}

// =============================================================================
// Route Registration
// =============================================================================

export async function appsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{
    Querystring: { activeGroupId?: string };
  }>(
    '/apps/accessible',
    {
      schema: {
        description: 'T120 [P] [US7] Get apps accessible to user with context information',
        tags: ['Apps', 'Context Switching'],
        querystring: {
          type: 'object',
          properties: {
            activeGroupId: {
              type: 'string',
              description: 'Current active group ID from header override',
            },
          },
        },
        headers: new FastifyJsonSchema({
          type: 'object',
          properties: {
            'x-active-group-id': {
              type: 'string',
              description: 'Active group ID',
            },
          },
        }),
        response: {
          200: {
            description: 'Accessible apps with context',
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  apps: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        currentGroup: {
                          type: 'object',
                          properties: {
                            groupId: { type: 'string' },
                            groupName: { type: 'string' },
                            hasAccess: { type: 'boolean' },
                          },
                        },
                        availableGroups: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              groupId: { type: 'string' },
                              groupName: { type: 'string' },
                              hasAccess: { type: 'boolean' },
                            },
                          },
                        },
                        requiresSwitch: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    getAccessibleApps
  );

  fastify.get<{
    Params: { id: string };
  }>(
    '/apps/:id/context-options',
    {
      schema: {
        description: 'T119 [P] [US7] Get context options for a specific app',
        tags: ['Apps', 'Context Switching'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'App ID',
            },
          },
        },
        response: {
          200: {
            description: 'Context options for app',
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  currentGroup: {
                    type: 'object',
                    properties: {
                      groupId: { type: 'string' },
                      groupName: { type: 'string' },
                      hasAccess: { type: 'boolean' },
                    },
                  },
                  availableGroups: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        groupId: { type: 'string' },
                        groupName: { type: 'string' },
                        hasAccess: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    getAppContextOptions
  );
}
