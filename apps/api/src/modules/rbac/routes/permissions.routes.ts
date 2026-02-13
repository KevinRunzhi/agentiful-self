/**
 * Permissions Routes
 *
 * API routes for permission checking (T043-T044).
 *
 * Endpoints:
 * - POST /permissions/check - Check if user has permission
 * - POST /permissions/check-batch - Batch permission check
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createPermissionService } from '../services/permission.service';
import type {
  PermissionCheckInput,
  PermissionCheckOutput,
  BatchPermissionCheck,
  BatchPermissionCheckResult,
} from '@agentifui/shared/rbac';

// =============================================================================
// Schemas
// =============================================================================

const permissionCheckRequestSchema = {
  type: 'object',
  properties: {
    resourceType: { type: 'string' },
    action: { type: 'string' },
    resourceId: { type: 'string' },
  },
  required: ['resourceType', 'action'],
};

const batchPermissionCheckRequestSchema = {
  type: 'object',
  properties: {
    checks: {
      type: 'array',
      items: permissionCheckRequestSchema,
    },
  },
  required: ['checks'],
};

const permissionCheckResponseSchema = {
  type: 'object',
  properties: {
    data: {
      type: 'object',
      properties: {
        allowed: { type: 'boolean' },
        reason: { type: 'string' },
        matchedGrant: {
          type: 'object',
          properties: {
            grantId: { type: 'string' },
            grantType: { type: 'string' },
            source: { type: 'string' },
          },
        },
      },
    },
    meta: {
      type: 'object',
      properties: {
        traceId: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        duration: { type: 'number' }, // Response time in ms
      },
    },
  },
};

const batchPermissionCheckResponseSchema = {
  type: 'object',
  properties: {
    data: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              allowed: { type: 'boolean' },
              reason: { type: 'string' },
            },
          },
        },
      },
    },
    meta: {
      type: 'object',
      properties: {
        traceId: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        duration: { type: 'number' },
      },
    },
  },
};

// =============================================================================
// Routes
// =============================================================================

export async function permissionsRoutes(fastify: FastifyInstance) {
  const permissionService = createPermissionService(fastify.db, fastify.redis);

  // POST /permissions/check - Check if user has permission
  fastify.post('/permissions/check', {
    schema: {
      body: permissionCheckRequestSchema,
      response: {
        200: permissionCheckResponseSchema,
        400: {
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
  }, async (
    request: FastifyRequest<{
      Body: Omit<PermissionCheckInput, 'userId' | 'tenantId' | 'activeGroupId'>;
    }>,
    reply: FastifyReply
  ) => {
    const startTime = Date.now();

    // Get user context from auth middleware
    const currentUser = request.user;
    if (!currentUser) {
      return reply.status(401).send({
        errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }],
      });
    }

    const activeGroupId = request.headers['x-active-group-id'] as string | null;
    const tenantId = request.headers['x-tenant-id'] as string || currentUser.tenantId;

    const input: PermissionCheckInput = {
      userId: currentUser.id,
      tenantId,
      activeGroupId,
      resourceType: request.body.resourceType,
      action: request.body.action,
      resourceId: request.body.resourceId,
      traceId: request.id,
    };

    try {
      const result = await permissionService.checkPermission(input);
      const duration = Date.now() - startTime;

      // Log if performance is below target
      if (duration > 50) {
        fastify.log.warn({
          traceId: request.id,
          duration,
          message: 'Permission check exceeded 50ms target',
        });
      }

      return reply.send({
        data: result,
        meta: {
          traceId: request.id,
          timestamp: new Date().toISOString(),
          duration,
        },
      });
    } catch (error) {
      // Log permission denied event for audit
      await fastify.audit.log({
        eventType: 'permission.denied',
        userId: currentUser.id,
        tenantId,
        metadata: {
          resourceType: input.resourceType,
          action: input.action,
          resourceId: input.resourceId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  });

  // POST /permissions/check-batch - Batch permission check
  fastify.post('/permissions/check-batch', {
    schema: {
      body: batchPermissionCheckRequestSchema,
      response: {
        200: batchPermissionCheckResponseSchema,
      },
    },
  }, async (
    request: FastifyRequest<{ Body: { checks: BatchPermissionCheck[] } }>,
    reply: FastifyReply
  ) => {
    const startTime = Date.now();

    const currentUser = request.user;
    if (!currentUser) {
      return reply.status(401).send({
        errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }],
      });
    }

    const activeGroupId = request.headers['x-active-group-id'] as string | null;
    const tenantId = request.headers['x-tenant-id'] as string || currentUser.tenantId;

    try {
      const results = await permissionService.checkBatch(
        currentUser.id,
        tenantId,
        activeGroupId,
        request.body.checks
      );

      const duration = Date.now() - startTime;

      return reply.send({
        data: { results },
        meta: {
          traceId: request.id,
          timestamp: new Date().toISOString(),
          duration,
        },
      });
    } catch (error) {
      throw error;
    }
  });
}
