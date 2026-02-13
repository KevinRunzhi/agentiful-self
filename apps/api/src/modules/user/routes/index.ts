/**
 * User Routes
 *
 * HTTP routes for user management endpoints
 */

import type { FastifyInstance } from "fastify";
import {
  getApprovalQueueHandler,
  approveUserHandler,
  rejectUserHandler,
  bulkApproveHandler,
  updateUserStatusHandler,
  getUserProfileHandler,
  updateUserProfileHandler,
} from "../controllers/user.controller.js";

/**
 * Register user routes
 */
export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  const userBasePath = "/users";

  // ========================================
  // User Profile
  // ========================================

  // Get current user profile
  app.get(`${userBasePath}/me`, getUserProfileHandler);

  // Update current user profile
  app.patch(`${userBasePath}/me`, updateUserProfileHandler);

  // ========================================
  // User Management (Admin)
  // ========================================

  // Get approval queue
  app.get(`${userBasePath}/approvals`, getApprovalQueueHandler);

  // Approve a user
  app.post(`${userBasePath}/:targetUserId/approve`, approveUserHandler);

  // Reject a user
  app.post(`${userBasePath}/:targetUserId/reject`, rejectUserHandler);

  // Bulk approve users
  app.post(`${userBasePath}/bulk-approve`, bulkApproveHandler);

  // Update user status
  app.patch(`${userBasePath}/:targetUserId/status`, updateUserStatusHandler);
}
