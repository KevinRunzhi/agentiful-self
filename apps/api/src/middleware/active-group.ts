/**
 * Active Group Middleware
 *
 * Fastify middleware for parsing X-Active-Group-ID header (T083-T084).
 * Validates group membership and adds active group to request context.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { createActiveGroupService } from '../modules/rbac/services/active-group.service';

// =============================================================================
// Middleware
// =============================================================================

export async function activeGroupMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Get X-Active-Group-ID header
  const activeGroupId = request.headers['x-active-group-id'] as string | undefined;

  if (!activeGroupId) {
    // No active group specified, continue
    return;
  }

  const currentUser = request.user;
  if (!currentUser) {
    // User not authenticated, auth middleware will handle this
    return;
  }

  const tenantId = request.headers['x-tenant-id'] as string || currentUser.tenantId;

  try {
    const activeGroupService = createActiveGroupService(request.db);

    // Validate user belongs to this group
    const groups = await activeGroupService.getAccessibleGroups(
      currentUser.id,
      tenantId
    );

    const activeGroup = groups.find((g) => g.groupId === activeGroupId);

    if (!activeGroup) {
      return reply.status(400).send({
        errors: [
          {
            code: 'INVALID_ACTIVE_GROUP',
            message: 'User is not a member of the specified active group',
          },
        ],
      });
    }

    // Add active group to request context
    request.activeGroup = activeGroup;
  } catch (error) {
    // Log error but don't block request
    request.log.warn(`Failed to validate active group: ${error}`);
  }
}

// =============================================================================
// Fastify Plugin
// =============================================================================

export async function activeGroupPlugin(fastify: any) {
  fastify.addHook('preHandler', activeGroupMiddleware);

  // Decorate request type
  fastify.decorateRequest('activeGroup', null);
}
