/**
 * Roles Routes
 *
 * API routes for role management (T039-T040).
 *
 * Endpoints:
 * - GET /roles - List all roles
 * - GET /roles/:id - Get role details with permissions
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createRoleRepository } from '../repositories/role.repository.js';
import { createPermissionRepository } from '../repositories/permission.repository.js';
import type { Role } from '@agentifui/shared/rbac';

// =============================================================================
// Schemas
// =============================================================================

const roleSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    name: { type: 'string' },
    displayName: { type: 'string' },
    description: { type: ['string', 'null'] },
    isSystem: { type: 'boolean' },
    isActive: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const roleWithPermissionsSchema = {
  type: 'object',
  properties: {
    ...roleSchema.properties,
    permissions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          code: { type: 'string' },
          name: { type: 'string' },
          category: { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },
    },
  },
};

const listRolesResponseSchema = {
  type: 'object',
  properties: {
    data: {
      type: 'array',
      items: roleSchema,
    },
    meta: {
      type: 'object',
      properties: {
        traceId: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  },
};

// =============================================================================
// Routes
// =============================================================================

export async function rolesRoutes(fastify: FastifyInstance) {
  const roleRepo = createRoleRepository(fastify.db);
  const permissionRepo = createPermissionRepository(fastify.db);

  // GET /roles - List all roles
  fastify.get('/roles', {
    schema: {
      response: {
        200: listRolesResponseSchema,
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const activeOnly = request.query as { active_only?: string };
    const roles = await roleRepo.findAll(activeOnly.active_only === 'true');

    return reply.send({
      data: roles.map((role) => ({
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        isSystem: role.isSystem,
        isActive: role.isActive,
        createdAt: role.createdAt.toISOString(),
      })),
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // GET /roles/:id - Get role details with permissions
  fastify.get('/roles/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'number' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: roleWithPermissionsSchema,
            meta: {
              type: 'object',
              properties: {
                traceId: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        404: {
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
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const roleId = parseInt(request.params.id, 10);

    if (isNaN(roleId)) {
      return reply.status(400).send({
        errors: [{ code: 'AFUI_IAM_002', message: 'Invalid role ID' }],
      });
    }

    const role = await roleRepo.findById(roleId);

    if (!role) {
      return reply.status(404).send({
        errors: [{ code: 'AFUI_IAM_002', message: 'Role not found' }],
      });
    }

    const permissions = await roleRepo.getPermissions(roleId);

    return reply.send({
      data: {
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        isSystem: role.isSystem,
        isActive: role.isActive,
        permissions: permissions.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          category: p.category,
          isActive: p.isActive,
        })),
        createdAt: role.createdAt.toISOString(),
      },
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });
}
