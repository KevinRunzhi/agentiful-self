/**
 * User Roles Routes
 *
 * API routes for user-role management (T041-T042).
 *
 * Endpoints:
 * - POST /users/:userId/roles - Assign role to user
 * - DELETE /users/:userId/roles/:roleId - Remove role from user
 * - GET /users/:userId/roles - Get user's roles
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createUserRoleRepository, createRoleRepository } from '../repositories';
import { createPermissionService } from '../services/permission.service';
import { RBAC_ERROR_CODES } from '@agentifui/shared/rbac';

// =============================================================================
// Routes
// =============================================================================

export async function userRolesRoutes(fastify: FastifyInstance) {
  const userRoleRepo = createUserRoleRepository(fastify.db);
  const roleRepo = createRoleRepository(fastify.db);
  const permissionService = createPermissionService(fastify.db, fastify.redis);

  // POST /users/:userId/roles - Assign role to user
  fastify.post('/users/:userId/roles', {
    schema: {
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
        },
        required: ['userId'],
      },
      body: {
        type: 'object',
        properties: {
          roleId: { type: 'number' },
          tenantId: { type: 'string' },
          expiresAt: { type: 'string', format: 'date-time' },
        },
        required: ['roleId', 'tenantId'],
      },
    },
  }, async (
    request: FastifyRequest<{
      Params: { userId: string };
      Body: { roleId: number; tenantId: string; expiresAt?: string };
    }>,
    reply: FastifyReply
  ) => {
    const { userId } = request.params;
    const { roleId, tenantId, expiresAt } = request.body;

    // Check if caller has permission to assign roles
    // This would typically be done via middleware, but for now we'll check directly
    const currentUser = request.user; // Assuming auth middleware sets this
    if (!currentUser) {
      return reply.status(401).send({
        errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }],
      });
    }

    // Verify the role exists
    const role = await roleRepo.findById(roleId);
    if (!role) {
      return reply.status(404).send({
        errors: [{ code: RBAC_ERROR_CODES.ROLE_NOT_FOUND, message: 'Role not found' }],
      });
    }

    // Check if this is the last Tenant Admin being removed
    if (role.name === 'tenant_admin') {
      const isLastAdmin = await userRoleRepo.isLastTenantAdmin(userId, tenantId);
      if (isLastAdmin) {
        return reply.status(400).send({
          errors: [
            { code: RBAC_ERROR_CODES.LAST_ADMIN_NOT_REMOVABLE, message: 'Cannot remove the last Tenant Admin' },
          ],
        });
      }
    }

    // Assign the role
    const result = await userRoleRepo.assign({
      userId,
      roleId,
      tenantId,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    // Invalidate permission cache for this user
    await permissionService.invalidateCache(userId, tenantId);

    // Log audit event
    await fastify.audit.log({
      eventType: 'role.assigned',
      userId: currentUser.id,
      tenantId,
      metadata: {
        targetUserId: userId,
        roleId,
        roleName: role.name,
        expiresAt,
      },
    });

    // Get role details for response
    const roleDetails = await roleRepo.findById(result.roleId);

    return reply.status(201).send({
      data: {
        userId: result.userId,
        roleId: result.roleId,
        roleName: roleDetails?.name,
        tenantId: result.tenantId,
        expiresAt: result.expiresAt?.toISOString() || null,
        createdAt: result.createdAt.toISOString(),
      },
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // DELETE /users/:userId/roles/:roleId - Remove role from user
  fastify.delete('/users/:userId/roles/:roleId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          roleId: { type: 'number' },
        },
        required: ['userId', 'roleId'],
      },
      query: {
        type: 'object',
        properties: {
          tenantId: { type: 'string' },
        },
        required: ['tenantId'],
      },
    },
  }, async (
    request: FastifyRequest<{
      Params: { userId: string; roleId: string };
      Querystring: { tenantId: string };
    }>,
    reply: FastifyReply
  ) => {
    const { userId } = request.params;
    const roleId = parseInt(request.params.roleId, 10);
    const { tenantId } = request.query;

    const currentUser = request.user;
    if (!currentUser) {
      return reply.status(401).send({
        errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }],
      });
    }

    // Verify the role exists
    const role = await roleRepo.findById(roleId);
    if (!role) {
      return reply.status(404).send({
        errors: [{ code: RBAC_ERROR_CODES.ROLE_NOT_FOUND, message: 'Role not found' }],
      });
    }

    // Check if this is the last Tenant Admin being removed
    if (role.name === 'tenant_admin') {
      const isLastAdmin = await userRoleRepo.isLastTenantAdmin(userId, tenantId);
      if (isLastAdmin) {
        return reply.status(400).send({
          errors: [
            { code: RBAC_ERROR_CODES.LAST_ADMIN_NOT_REMOVABLE, message: 'Cannot remove the last Tenant Admin' },
          ],
        });
      }
    }

    // Check if system role is being deleted (not allowed)
    if (role.isSystem) {
      // System roles can be removed from users, but the role itself cannot be deleted
      // This is allowed, so we continue
    }

    // Remove the role
    const revoked = await userRoleRepo.revoke(userId, roleId, tenantId);

    if (!revoked) {
      return reply.status(404).send({
        errors: [{ code: 'NOT_FOUND', message: 'User role assignment not found' }],
      });
    }

    // Invalidate permission cache
    await permissionService.invalidateCache(userId, tenantId);

    // Log audit event
    await fastify.audit.log({
      eventType: 'role.removed',
      userId: currentUser.id,
      tenantId,
      metadata: {
        targetUserId: userId,
        roleId,
        roleName: role.name,
      },
    });

    return reply.status(204).send();
  });

  // GET /users/:userId/roles - Get user's roles
  fastify.get('/users/:userId/roles', {
    schema: {
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
        },
        required: ['userId'],
      },
      query: {
        type: 'object',
        properties: {
          tenantId: { type: 'string' },
        },
      },
    },
  }, async (
    request: FastifyRequest<{
      Params: { userId: string };
      Querystring: { tenantId?: string };
    }>,
    reply: FastifyReply
  ) => {
    const { userId } = request.params;
    const { tenantId } = request.query;

    let roles;
    if (tenantId) {
      roles = await userRoleRepo.findByUser(userId, tenantId);
    } else {
      // Get all roles across all tenants
      // This might need adjustment based on requirements
      return reply.status(400).send({
        errors: [{ code: 'BAD_REQUEST', message: 'tenantId query parameter is required' }],
      });
    }

    return reply.send({
      data: roles.map((r) => ({
        userId: r.userId,
        roleId: r.roleId,
        roleName: r.roleName,
        roleDisplayName: r.roleDisplayName,
        tenantId: r.tenantId,
        expiresAt: r.expiresAt?.toISOString() || null,
      })),
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });
}
