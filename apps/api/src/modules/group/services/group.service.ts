/**
 * Group Service
 *
 * Business logic for group CRUD operations
 */

import { groupRepository } from "../repositories/group.repository";
import { groupMemberRepository } from "../repositories/group-member.repository";
import type { Group, NewGroup } from "@agentifui/db/schema";

/**
 * Group create input
 */
export interface CreateGroupInput {
  tenantId: string;
  name: string;
  description?: string;
  sortOrder?: number;
}

/**
 * Group update input
 */
export interface UpdateGroupInput {
  name?: string;
  description?: string;
  sortOrder?: number;
}

/**
 * Group with stats
 */
export interface GroupWithStats extends Group {
  memberCount: number;
}

/**
 * Result type for operations
 */
export interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Group Service
 */
export class GroupService {
  /**
   * Create a new group
   */
  async create(input: CreateGroupInput): Promise<ServiceResult<Group>> {
    // Check if group with same name exists in tenant
    const existing = await groupRepository.findByTenantAndName(
      input.tenantId,
      input.name
    );

    if (existing) {
      return {
        success: false,
        error: "A group with this name already exists in this tenant",
      };
    }

    // Validate name length
    if (input.name.length < 2 || input.name.length > 255) {
      return {
        success: false,
        error: "Group name must be between 2 and 255 characters",
      };
    }

    const data: NewGroup = {
      tenantId: input.tenantId,
      name: input.name,
      description: input.description,
      sortOrder: input.sortOrder ?? 0,
    };

    const group = await groupRepository.create(data);
    return { success: true, data: group };
  }

  /**
   * Get group by ID with member count
   */
  async getById(id: string, tenantId: string): Promise<ServiceResult<GroupWithStats>> {
    const group = await groupRepository.getWithMemberCount(id);

    if (!group) {
      return { success: false, error: "Group not found" };
    }

    // Verify tenant access
    if (group.tenantId !== tenantId) {
      return { success: false, error: "Access denied" };
    }

    return { success: true, data: group };
  }

  /**
   * Get all groups for a tenant with member counts
   */
  async getByTenant(tenantId: string): Promise<ServiceResult<GroupWithStats[]>> {
    const groups = await groupRepository.getWithMemberCounts(tenantId);
    return { success: true, data: groups };
  }

  /**
   * Update a group
   */
  async update(
    id: string,
    tenantId: string,
    input: UpdateGroupInput
  ): Promise<ServiceResult<Group>> {
    const group = await groupRepository.findById(id);

    if (!group) {
      return { success: false, error: "Group not found" };
    }

    // Verify tenant access
    if (group.tenantId !== tenantId) {
      return { success: false, error: "Access denied" };
    }

    // Check name uniqueness if updating name
    if (input.name && input.name !== group.name) {
      const existing = await groupRepository.findByTenantAndName(
        tenantId,
        input.name
      );

      if (existing && existing.id !== id) {
        return {
          success: false,
          error: "A group with this name already exists",
        };
      }

      if (input.name.length < 2 || input.name.length > 255) {
        return {
          success: false,
          error: "Group name must be between 2 and 255 characters",
        };
      }
    }

    const updated = await groupRepository.update(id, input);

    if (!updated) {
      return { success: false, error: "Failed to update group" };
    }

    return { success: true, data: updated };
  }

  /**
   * Delete a group
   */
  async delete(id: string, tenantId: string): Promise<ServiceResult> {
    const group = await groupRepository.findById(id);

    if (!group) {
      return { success: false, error: "Group not found" };
    }

    // Verify tenant access
    if (group.tenantId !== tenantId) {
      return { success: false, error: "Access denied" };
    }

    const deleted = await groupRepository.delete(id);

    if (!deleted) {
      return { success: false, error: "Failed to delete group" };
    }

    return { success: true };
  }

  /**
   * Reorder groups
   */
  async reorder(
    tenantId: string,
    updates: Array<{ id: string; sortOrder: number }>
  ): Promise<ServiceResult> {
    // Verify all groups belong to the tenant
    const groupIds = updates.map((u) => u.id);
    const groups = await Promise.all(
      groupIds.map((id) => groupRepository.findById(id))
    );

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      if (!group || group.tenantId !== tenantId) {
        return { success: false, error: "Invalid group or access denied" };
      }
    }

    await groupRepository.updateSortOrder(updates);
    return { success: true };
  }

  /**
   * Get groups where user is a member
   */
  async getUserGroups(userId: string, tenantId: string): Promise<ServiceResult<Array<Group & { role: string }>>> {
    const groups = await groupRepository.findByUserMember(userId, tenantId);
    return { success: true, data: groups };
  }
}

// Singleton instance
export const groupService = new GroupService();
