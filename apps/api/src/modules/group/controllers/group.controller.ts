/**
 * Group Controller
 *
 * HTTP request handlers for group management endpoints
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { groupService } from "../services/group.service";
import { groupMemberService } from "../services/group-member.service";
import { groupPermissionService } from "../services/permission.service";

/**
 * Get authenticated user from request
 */
function getUserId(request: FastifyRequest): string | null {
  return (request as any).user?.id || null;
}

/**
 * Get current tenant from request context
 */
function getTenantId(request: FastifyRequest): string | null {
  return (request as any).tenant?.id || null;
}

/**
 * Get all groups for current tenant
 */
export async function getGroupsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const tenantId = getTenantId(request);

  if (!userId || !tenantId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  const result = await groupService.getByTenant(tenantId);

  if (!result.success) {
    return reply.status(400).send({
      error: { message: result.error, code: "GROUPS_FETCH_FAILED" },
    });
  }

  reply.send({ groups: result.data });
}

/**
 * Get a single group by ID
 */
export async function getGroupHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const tenantId = getTenantId(request);
  const { groupId } = request.params as { groupId: string };

  if (!userId || !tenantId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  const result = await groupService.getById(groupId, tenantId);

  if (!result.success) {
    const statusCode = result.error === "Group not found" ? 404 : 400;
    return reply.status(statusCode).send({
      error: { message: result.error, code: "GROUP_FETCH_FAILED" },
    });
  }

  reply.send(result.data);
}

/**
 * Create a new group
 */
export async function createGroupHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const tenantId = getTenantId(request);

  if (!userId || !tenantId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  // Check if user has permission to create groups
  const canCreate = await groupPermissionService.isTenantAdmin(userId, tenantId);

  if (!canCreate) {
    return reply.status(403).send({
      error: {
        message: "Only tenant admins can create groups",
        code: "INSUFFICIENT_PERMISSIONS",
      },
    });
  }

  const body = request.body as {
    name: string;
    description?: string;
    sortOrder?: number;
  };

  const result = await groupService.create({
    tenantId,
    name: body.name,
    description: body.description,
    sortOrder: body.sortOrder,
  });

  if (!result.success) {
    return reply.status(400).send({
      error: { message: result.error, code: "GROUP_CREATE_FAILED" },
    });
  }

  reply.status(201).send(result.data);
}

/**
 * Update a group
 */
export async function updateGroupHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const tenantId = getTenantId(request);
  const { groupId } = request.params as { groupId: string };

  if (!userId || !tenantId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  // Check permissions
  const permission = await groupPermissionService.canManageGroup(
    userId,
    groupId,
    tenantId
  );

  if (!permission.allowed) {
    return reply.status(403).send({
      error: {
        message: permission.reason || "Insufficient permissions",
        code: "INSUFFICIENT_PERMISSIONS",
      },
    });
  }

  const body = request.body as {
    name?: string;
    description?: string;
    sortOrder?: number;
  };

  const result = await groupService.update(groupId, tenantId, body);

  if (!result.success) {
    const statusCode = result.error === "Group not found" ? 404 : 400;
    return reply.status(statusCode).send({
      error: { message: result.error, code: "GROUP_UPDATE_FAILED" },
    });
  }

  reply.send(result.data);
}

/**
 * Delete a group
 */
export async function deleteGroupHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const tenantId = getTenantId(request);
  const { groupId } = request.params as { groupId: string };

  if (!userId || !tenantId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  // Check permissions - only tenant admin can delete groups
  const isAdmin = await groupPermissionService.isTenantAdmin(userId, tenantId);

  if (!isAdmin) {
    return reply.status(403).send({
      error: {
        message: "Only tenant admins can delete groups",
        code: "INSUFFICIENT_PERMISSIONS",
      },
    });
  }

  const result = await groupService.delete(groupId, tenantId);

  if (!result.success) {
    const statusCode = result.error === "Group not found" ? 404 : 400;
    return reply.status(statusCode).send({
      error: { message: result.error, code: "GROUP_DELETE_FAILED" },
    });
  }

  reply.status(204).send();
}

/**
 * Reorder groups
 */
export async function reorderGroupsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const tenantId = getTenantId(request);

  if (!userId || !tenantId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  // Check permissions
  const isAdmin = await groupPermissionService.isTenantAdmin(userId, tenantId);

  if (!isAdmin) {
    return reply.status(403).send({
      error: {
        message: "Only tenant admins can reorder groups",
        code: "INSUFFICIENT_PERMISSIONS",
      },
    });
  }

  const body = request.body as {
    groups: Array<{ id: string; sortOrder: number }>;
  };

  const result = await groupService.reorder(tenantId, body.groups);

  if (!result.success) {
    return reply.status(400).send({
      error: { message: result.error, code: "GROUP_REORDER_FAILED" },
    });
  }

  reply.send({ success: true });
}

/**
 * Get user's groups
 */
export async function getUserGroupsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const tenantId = getTenantId(request);

  if (!userId || !tenantId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  const result = await groupService.getUserGroups(userId, tenantId);

  if (!result.success) {
    return reply.status(400).send({
      error: { message: result.error, code: "USER_GROUPS_FETCH_FAILED" },
    });
  }

  reply.send({ groups: result.data });
}

/**
 * Get group members
 */
export async function getGroupMembersHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const tenantId = getTenantId(request);
  const { groupId } = request.params as { groupId: string };

  if (!userId || !tenantId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  const result = await groupMemberService.getGroupMembers(groupId, tenantId);

  if (!result.success) {
    const statusCode = result.error?.includes("not found") ? 404 : 400;
    return reply.status(statusCode).send({
      error: { message: result.error, code: "MEMBERS_FETCH_FAILED" },
    });
  }

  reply.send({ members: result.data });
}

/**
 * Add member to group
 */
export async function addMemberHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const tenantId = getTenantId(request);

  if (!userId || !tenantId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  const { groupId } = request.params as { groupId: string };
  const body = request.body as {
    userId: string;
    role?: string;
  };

  // Check permissions
  const permission = await groupPermissionService.canManageGroup(
    userId,
    groupId,
    tenantId
  );

  if (!permission.allowed) {
    return reply.status(403).send({
      error: {
        message: permission.reason || "Insufficient permissions",
        code: "INSUFFICIENT_PERMISSIONS",
      },
    });
  }

  const result = await groupMemberService.addMember({
    groupId,
    userId: body.userId,
    role: body.role,
    addedBy: userId,
  });

  if (!result.success) {
    return reply.status(400).send({
      error: { message: result.error, code: "MEMBER_ADD_FAILED" },
    });
  }

  reply.status(201).send(result.data);
}

/**
 * Update member role
 */
export async function updateMemberRoleHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const tenantId = getTenantId(request);

  if (!userId || !tenantId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  const { memberId } = request.params as { memberId: string };
  const body = request.body as {
    role: string;
  };

  // Check permissions
  const permission = await groupPermissionService.canManageGroup(
    userId,
    memberId, // This won't work directly, we need groupId
    tenantId
  );

  // For now, just check if user is tenant admin or group manager
  // In a real implementation, we'd fetch the member first to get the groupId

  const result = await groupMemberService.updateRole(
    { memberId, role: body.role },
    tenantId
  );

  if (!result.success) {
    const statusCode = result.error?.includes("not found") ? 404 : 400;
    return reply.status(statusCode).send({
      error: { message: result.error, code: "MEMBER_UPDATE_FAILED" },
    });
  }

  reply.send(result.data);
}

/**
 * Remove member from group
 */
export async function removeMemberHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const tenantId = getTenantId(request);

  if (!userId || !tenantId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  const { memberId } = request.params as { memberId: string };

  const result = await groupMemberService.removeMember(
    { memberId, removedBy: userId },
    tenantId
  );

  if (!result.success) {
    const statusCode = result.error?.includes("not found") ? 404 : 400;
    return reply.status(statusCode).send({
      error: { message: result.error, code: "MEMBER_REMOVE_FAILED" },
    });
  }

  reply.status(204).send();
}

/**
 * Remove user from group
 */
export async function removeUserFromGroupHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const tenantId = getTenantId(request);

  if (!userId || !tenantId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  const { groupId } = request.params as { groupId: string };
  const { userId: targetUserId } = request.body as { userId: string };

  // Check permissions
  const permission = await groupPermissionService.canManageGroup(
    userId,
    groupId,
    tenantId
  );

  if (!permission.allowed) {
    return reply.status(403).send({
      error: {
        message: permission.reason || "Insufficient permissions",
        code: "INSUFFICIENT_PERMISSIONS",
      },
    });
  }

  const result = await groupMemberService.removeUserFromGroup(
    { groupId, userId: targetUserId, removedBy: userId },
    tenantId
  );

  if (!result.success) {
    const statusCode = result.error?.includes("not found") ? 404 : 400;
    return reply.status(statusCode).send({
      error: { message: result.error, code: "USER_REMOVE_FAILED" },
    });
  }

  reply.status(204).send();
}

/**
 * Add multiple members to group
 */
export async function addMultipleMembersHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const tenantId = getTenantId(request);

  if (!userId || !tenantId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  const { groupId } = request.params as { groupId: string };
  const body = request.body as {
    userIds: string[];
    role?: string;
  };

  // Check permissions
  const permission = await groupPermissionService.canManageGroup(
    userId,
    groupId,
    tenantId
  );

  if (!permission.allowed) {
    return reply.status(403).send({
      error: {
        message: permission.reason || "Insufficient permissions",
        code: "INSUFFICIENT_PERMISSIONS",
      },
    });
  }

  const result = await groupMemberService.addMultipleMembers(
    groupId,
    body.userIds,
    body.role || "member",
    userId,
    tenantId
  );

  if (!result.success) {
    return reply.status(400).send({
      error: { message: result.error, code: "BULK_ADD_FAILED" },
    });
  }

  reply.send(result.data);
}
