/**
 * Group Routes
 *
 * HTTP routes for group and group member management
 */

import type { FastifyInstance } from "fastify";
import {
  getGroupsHandler,
  getGroupHandler,
  createGroupHandler,
  updateGroupHandler,
  deleteGroupHandler,
  reorderGroupsHandler,
  getUserGroupsHandler,
  getGroupMembersHandler,
  addMemberHandler,
  updateMemberRoleHandler,
  removeMemberHandler,
  removeUserFromGroupHandler,
  addMultipleMembersHandler,
} from "../controllers/group.controller.js";

/**
 * Register group routes
 */
export async function registerGroupRoutes(app: FastifyInstance): Promise<void> {
  const groupBasePath = "/groups";

  // ========================================
  // Group Management
  // ========================================

  // Get all groups for current tenant
  app.get(`${groupBasePath}`, getGroupsHandler);

  // Get user's groups
  app.get(`${groupBasePath}/my-groups`, getUserGroupsHandler);

  // Get a single group
  app.get(`${groupBasePath}/:groupId`, getGroupHandler);

  // Create a new group
  app.post(`${groupBasePath}`, createGroupHandler);

  // Update a group
  app.patch(`${groupBasePath}/:groupId`, updateGroupHandler);

  // Delete a group
  app.delete(`${groupBasePath}/:groupId`, deleteGroupHandler);

  // Reorder groups
  app.post(`${groupBasePath}/reorder`, reorderGroupsHandler);

  // ========================================
  // Group Member Management
  // ========================================

  // Get members of a group
  app.get(`${groupBasePath}/:groupId/members`, getGroupMembersHandler);

  // Add a member to a group
  app.post(`${groupBasePath}/:groupId/members`, addMemberHandler);

  // Add multiple members to a group
  app.post(`${groupBasePath}/:groupId/members/bulk`, addMultipleMembersHandler);

  // Update member role (by member ID)
  app.patch(`${groupBasePath}/members/:memberId/role`, updateMemberRoleHandler);

  // Remove a member (by member ID)
  app.delete(`${groupBasePath}/members/:memberId`, removeMemberHandler);

  // Remove user from a group
  app.post(`${groupBasePath}/:groupId/members/remove`, removeUserFromGroupHandler);
}
