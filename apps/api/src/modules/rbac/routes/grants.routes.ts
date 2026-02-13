/**
 * Grants Routes
 *
 * API routes for application access grant management (T062-T064).
 *
 * Endpoints:
 * - POST /grants - Create a new grant
 * - GET /grants - List grants
 * - DELETE /grants/:id - Revoke a grant
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createGrantService } from '../services/grant.service';
import { createAppRepository } from '../repositories/app.repository';
import type { CreateAppGrantInput } from '@agentifui/shared/rbac';

// =============================================================================
// Schemas
// =============================================================================

const createGrantSchema = {
  type: 'object',
  properties: {
    appId: { type: 'string' },
    granteeType: { type: 'string', enum: ['group', 'user'] },
    granteeId: { type: 'string' },
    permission: { type: 'string', enum: ['use', 'deny'] },
    reason: { type: 'string' },
    expiresAt: { type: 'string', format: 'date-time' },
  },
  required: ['appId', 'granteeType', 'granteeId', 'permission'],
};

// =============================================================================
// Routes
// =============================================================================

export async function grantsRoutes(fastify: FastifyInstance) {
  const grantService = createGrantService(fastify.db, fastify.audit, fastify.permissionService);

  // POST /grants - Create a new grant (T062)
  fastify.post('/grants', {
    schema: {
      body: createGrantSchema,
    },
  }, async (
    request: FastifyRequest<{ Body: CreateAppGrantInput }>,
    reply: FastifyReply
  ) => {
    const currentUser = request.user;
    if (!currentUser) {
      return reply.status(401).send({
        errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }],
      });
    }

    const tenantId = request.headers['x-tenant-id'] as string || currentUser.tenantId;

    try {
      const grant = await grantService.createGrant(request.body, {
        grantedBy: currentUser.id,
        tenantId,
      });

      return reply.status(201).send({
        data: {
          id: grant.id,
          appId: grant.appId,
          granteeType: grant.granteeType,
          granteeId: grant.granteeId,
          permission: grant.permission,
          reason: grant.reason,
          grantedBy: grant.grantedBy,
          expiresAt: grant.expiresAt?.toISOString() || null,
          createdAt: grant.createdAt.toISOString(),
        },
        meta: {
          traceId: request.id,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(400).send({
          errors: [{ code: 'BAD_REQUEST', message: error.message }],
        });
      }
      throw error;
    }
  });

  // GET /grants - List grants (T063)
  fastify.get('/grants', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          appId: { type: 'string' },
          granteeType: { type: 'string', enum: ['group', 'user'] },
          granteeId: { type: 'string' },
        },
      },
    },
  }, async (
    request: FastifyRequest<{
      Querystring: { appId?: string; granteeType?: string; granteeId?: string };
    }>,
    reply: FastifyReply
  ) => {
    const currentUser = request.user;
    if (!currentUser) {
      return reply.status(401).send({
        errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }],
      });
    }

    const tenantId = request.headers['x-tenant-id'] as string || currentUser.tenantId;

    try {
      let grants;

      if (request.query.appId) {
        grants = await grantService.getGrantsByApp(request.query.appId, tenantId);
      } else if (request.query.granteeType && request.query.granteeId) {
        grants = await grantService.getGrantsByGrantee(
          request.query.granteeType as 'group' | 'user',
          request.query.granteeId,
          tenantId
        );
      } else {
        // Return all grants for the tenant
        grants = await grantService.getGrantsByApp('all', tenantId);
      }

      return reply.send({
        data: grants.map((g) => ({
          id: g.id,
          appId: g.appId,
          appName: g.appName,
          granteeType: g.granteeType,
          granteeId: g.granteeId,
          granteeName: g.granteeName,
          permission: g.permission,
          reason: g.reason,
          grantedBy: g.grantedBy,
          grantedByName: g.grantedByName,
          expiresAt: g.expiresAt?.toISOString() || null,
          createdAt: g.createdAt.toISOString(),
        })),
        meta: {
          total: grants.length,
          traceId: request.id,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(400).send({
          errors: [{ code: 'BAD_REQUEST', message: error.message }],
        });
      }
      throw error;
    }
  });

  // DELETE /grants/:id - Revoke a grant (T064)
  fastify.delete('/grants/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const currentUser = request.user;
    if (!currentUser) {
      return reply.status(401).send({
        errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }],
      });
    }

    const tenantId = request.headers['x-tenant-id'] as string || currentUser.tenantId;

    try {
      await grantService.revokeGrant(request.params.id, {
        revokedBy: currentUser.id,
        tenantId,
      });

      return reply.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Grant not found') {
          return reply.status(404).send({
            errors: [{ code: 'NOT_FOUND', message: error.message }],
          });
        }
        return reply.status(400).send({
          errors: [{ code: 'BAD_REQUEST', message: error.message }],
        });
      }
      throw error;
    }
  });
}
