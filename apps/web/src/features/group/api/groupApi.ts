/**
 * Group API
 *
 * API client for group endpoints
 */

import { apiClient } from "../../../lib/api-client";

/**
 * Group
 */
export interface Group {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  sortOrder: number;
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Group member
 */
export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  addedAt: string;
}

/**
 * Create group request
 */
export interface CreateGroupRequest {
  name: string;
  description?: string;
  sortOrder?: number;
}

/**
 * Update group request
 */
export interface UpdateGroupRequest {
  name?: string;
  description?: string;
  sortOrder?: number;
}

/**
 * Add member request
 */
export interface AddMemberRequest {
  userId: string;
  role?: string;
}

/**
 * Update member role request
 */
export interface UpdateMemberRoleRequest {
  role: string;
}

/**
 * Reorder groups request
 */
export interface ReorderGroupsRequest {
  groups: Array<{ id: string; sortOrder: number }>;
}

/**
 * Bulk add members request
 */
export interface BulkAddMembersRequest {
  userIds: string[];
  role?: string;
}

/**
 * Bulk add members response
 */
export interface BulkAddMembersResponse {
  added: number;
  skipped: number;
  errors: string[];
}

/**
 * Group API
 */
export const groupApi = {
  /**
   * Get all groups for current tenant
   */
  async getGroups(): Promise<{ groups: Group[] }> {
    return apiClient.get("/groups");
  },

  /**
   * Get user's groups
   */
  async getMyGroups(): Promise<{ groups: Array<Group & { role: string }> }> {
    return apiClient.get("/groups/my-groups");
  },

  /**
   * Get a single group by ID
   */
  async getGroup(groupId: string): Promise<Group> {
    return apiClient.get(`/groups/${groupId}`);
  },

  /**
   * Create a new group
   */
  async createGroup(data: CreateGroupRequest): Promise<Group> {
    return apiClient.post("/groups", data);
  },

  /**
   * Update a group
   */
  async updateGroup(groupId: string, data: UpdateGroupRequest): Promise<Group> {
    return apiClient.patch(`/groups/${groupId}`, data);
  },

  /**
   * Delete a group
   */
  async deleteGroup(groupId: string): Promise<void> {
    return apiClient.delete(`/groups/${groupId}`);
  },

  /**
   * Reorder groups
   */
  async reorderGroups(data: ReorderGroupsRequest): Promise<{ success: boolean }> {
    return apiClient.post("/groups/reorder", data);
  },

  /**
   * Get group members
   */
  async getGroupMembers(groupId: string): Promise<{ members: GroupMember[] }> {
    return apiClient.get(`/groups/${groupId}/members`);
  },

  /**
   * Add a member to a group
   */
  async addMember(groupId: string, data: AddMemberRequest): Promise<GroupMember> {
    return apiClient.post(`/groups/${groupId}/members`, data);
  },

  /**
   * Add multiple members to a group
   */
  async addMultipleMembers(
    groupId: string,
    data: BulkAddMembersRequest
  ): Promise<BulkAddMembersResponse> {
    return apiClient.post(`/groups/${groupId}/members/bulk`, data);
  },

  /**
   * Update member role
   */
  async updateMemberRole(
    memberId: string,
    data: UpdateMemberRoleRequest
  ): Promise<GroupMember> {
    return apiClient.patch(`/groups/members/${memberId}/role`, data);
  },

  /**
   * Remove a member from group
   */
  async removeMember(memberId: string): Promise<void> {
    return apiClient.delete(`/groups/members/${memberId}`);
  },

  /**
   * Remove user from a group
   */
  async removeUserFromGroup(groupId: string, userId: string): Promise<void> {
    return apiClient.post(`/groups/${groupId}/members/remove`, { userId });
  },
};
