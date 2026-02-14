/**
 * User Controller
 *
 * HTTP request handlers for user management endpoints
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { userRepository } from "../../auth/repositories/user.repository.js";
import { userStatusService } from "../services/user-status.service.js";
import type { UserStatus } from "../services/user-status.service.js";
import { approvalService } from "../services/approval.service.js";

/**
 * Get authenticated user
 */
function getUserId(request: FastifyRequest): string | null {
  return (request as any).user?.id || null;
}

/**
 * Get current tenant
 */
function getTenantId(request: FastifyRequest): string | null {
  return (request as any).tenant?.id || null;
}

/**
 * Get approval queue
 */
export async function getApprovalQueueHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const tenantId = getTenantId(request);

  if (!tenantId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  const result = await approvalService.getApprovalQueue(tenantId);

  if (!result.success) {
    return reply.status(400).send({
      error: { message: result.error, code: "FETCH_QUEUE_FAILED" },
    });
  }

  reply.send({ queue: result.data });
}

/**
 * Approve user
 */
export async function approveUserHandler(
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

  const { targetUserId } = request.params as { targetUserId: string };

  const result = await approvalService.approveUser(targetUserId, tenantId, userId);

  if (!result.success) {
    return reply.status(400).send({
      error: { message: result.error, code: "APPROVE_FAILED" },
    });
  }

  reply.send({ success: true });
}

/**
 * Reject user
 */
export async function rejectUserHandler(
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

  const { targetUserId } = request.params as { targetUserId: string };
  const { reason } = request.body as { reason?: string };

  const result = await approvalService.rejectUser(targetUserId, tenantId, userId, reason);

  if (!result.success) {
    return reply.status(400).send({
      error: { message: result.error, code: "REJECT_FAILED" },
    });
  }

  reply.send({ success: true });
}

/**
 * Bulk approve users
 */
export async function bulkApproveHandler(
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

  const { userIds } = request.body as { userIds: string[] };

  const result = await approvalService.bulkApprove(userIds, tenantId, userId);

  reply.send(result.data);
}

/**
 * Update user status
 */
export async function updateUserStatusHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const actorUserId = getUserId(request);
  const tenantId = getTenantId(request);

  if (!actorUserId || !tenantId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  const { targetUserId } = request.params as { targetUserId: string };
  const { status } = request.body as { status: string };
  const allowedStatuses: UserStatus[] = ["pending", "active", "suspended", "rejected"];
  if (!allowedStatuses.includes(status as UserStatus)) {
    return reply.status(400).send({
      error: { message: "Invalid status", code: "INVALID_STATUS" },
    });
  }

  const result = await userStatusService.changeStatus(
    targetUserId,
    status as UserStatus,
    tenantId
  );

  if (!result.success) {
    return reply.status(400).send({
      error: { message: result.error, code: "STATUS_UPDATE_FAILED" },
    });
  }

  reply.send(result.data);
}

/**
 * Get user profile
 */
export async function getUserProfileHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);

  if (!userId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  const user = await userRepository.findById(userId);

  if (!user) {
    return reply.status(404).send({
      error: { message: "User not found", code: "NOT_FOUND" },
    });
  }

  reply.send({
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  });
}

/**
 * Update user profile
 */
export async function updateUserProfileHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);

  if (!userId) {
    return reply.status(401).send({
      error: { message: "Not authenticated", code: "NOT_AUTHENTICATED" },
    });
  }

  const { name } = request.body as { name?: string };
  const updateData: { name?: string | null } = {};
  if (typeof name === "string") {
    updateData.name = name.trim() ? name.trim() : null;
  }

  const updated = await userRepository.update(userId, updateData);

  if (!updated) {
    return reply.status(500).send({
      error: { message: "Failed to update profile", code: "UPDATE_FAILED" },
    });
  }

  reply.send(updated);
}
