/**
 * Group Member Service
 *
 * Business logic for group member management
 */

import { groupMemberRepository } from "../repositories/group-member.repository";
import { groupRepository } from "../repositories/group.repository";
import type { NewGroupMember } from "@agentifui/db/schema";
import type { GroupMemberWithUser } from "../repositories/group-member.repository";

/**
 * Add member input
 */
export interface AddMemberInput {
  groupId: string;
  userId: string;
  role?: string;
  addedBy: string;
}

/**
 * Update member role input
 */
export interface UpdateMemberRoleInput {
  memberId: string;
  role: string;
}

/**
 * Remove member input
 */
export interface RemoveMemberInput {
  memberId: string;
  removedBy: string;
}

/**
 * Remove user from group input
 */
export interface RemoveUserFromGroupInput {
  groupId: string;
  userId: string;
  removedBy: string;
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
 * Valid member roles
 */
export const VALID_ROLES = ["member", "manager", "admin"] as const;
export type MemberRole = typeof VALID_ROLES[number];

/**
 * Group Member Service
 */
export class GroupMemberService {
  /**
   * Add a member to a group
   */
  async addMember(input: AddMemberInput): Promise<ServiceResult<GroupMemberWithUser>> {
    // Verify group exists
    const group = await groupRepository.findById(input.groupId);
    if (!group) {
      return { success: false, error: "Group not found" };
    }

    // Validate role
    const role = input.role || "member";
    if (!VALID_ROLES.includes(role as MemberRole)) {
      return { success: false, error: "Invalid role" };
    }

    // Check if user is already an active member
    const existing = await groupMemberRepository.findByUserAndGroup(
      input.userId,
      input.groupId
    );

    if (existing) {
      // If previously removed, reactivate with new role
      if (existing.removedAt) {
        const updated = await this.reactivateMember(existing.id, role, input.addedBy);
        if (updated) {
          return { success: true, data: updated };
        }
      }
      return { success: false, error: "User is already a member of this group" };
    }

    // Create new membership
    const data: NewGroupMember = {
      groupId: input.groupId,
      userId: input.userId,
      role,
      addedBy: input.addedBy,
    };

    const member = await groupMemberRepository.create(data);

    // Fetch with user details
    const memberWithUser = await groupMemberRepository.findById(member.id);
    if (memberWithUser) {
      return { success: true, data: memberWithUser as GroupMemberWithUser };
    }

    return { success: true, data: member as any };
  }

  /**
   * Reactivate a previously removed member
   */
  private async reactivateMember(
    id: string,
    role: string,
    addedBy: string
  ): Promise<GroupMemberWithUser | null> {
    const db = await import("@agentifui/db/client").then((m) => m.getDatabase());
    const { groupMember: gm } = await import("@agentifui/db/schema");
    const { sql } = await import("drizzle-orm");

    const [result] = await db
      .update(gm)
      .set({
        role,
        addedBy,
        addedAt: new Date(),
        removedAt: null,
        removedBy: null,
      })
      .where(sql`${gm.id} = ${id}`)
      .returning();

    return result as any;
  }

  /**
   * Get all members of a group
   */
  async getGroupMembers(groupId: string, tenantId: string): Promise<ServiceResult<GroupMemberWithUser[]>> {
    // Verify group exists and belongs to tenant
    const group = await groupRepository.findById(groupId);
    if (!group) {
      return { success: false, error: "Group not found" };
    }

    if (group.tenantId !== tenantId) {
      return { success: false, error: "Access denied" };
    }

    const members = await groupMemberRepository.findActiveByGroup(groupId);
    return { success: true, data: members };
  }

  /**
   * Update a member's role
   */
  async updateRole(
    input: UpdateMemberRoleInput,
    tenantId: string
  ): Promise<ServiceResult<GroupMemberWithUser>> {
    const member = await groupMemberRepository.findById(input.memberId);

    if (!member) {
      return { success: false, error: "Member not found" };
    }

    // Verify tenant access through group
    const group = await groupRepository.findById(member.groupId);
    if (!group || group.tenantId !== tenantId) {
      return { success: false, error: "Access denied" };
    }

    // Validate role
    if (!VALID_ROLES.includes(input.role as MemberRole)) {
      return { success: false, error: "Invalid role" };
    }

    // Check if member is active
    if (member.removedAt) {
      return { success: false, error: "Cannot update role of removed member" };
    }

    const updated = await groupMemberRepository.updateRole(input.memberId, input.role);

    if (!updated) {
      return { success: false, error: "Failed to update member role" };
    }

    // Fetch with user details
    const memberWithUser = await groupMemberRepository.findById(updated.id);
    return { success: true, data: memberWithUser as GroupMemberWithUser };
  }

  /**
   * Remove a member from a group
   */
  async removeMember(
    input: RemoveMemberInput,
    tenantId: string
  ): Promise<ServiceResult> {
    const member = await groupMemberRepository.findById(input.memberId);

    if (!member) {
      return { success: false, error: "Member not found" };
    }

    // Verify tenant access through group
    const group = await groupRepository.findById(member.groupId);
    if (!group || group.tenantId !== tenantId) {
      return { success: false, error: "Access denied" };
    }

    // Check if already removed
    if (member.removedAt) {
      return { success: false, error: "Member already removed" };
    }

    const removed = await groupMemberRepository.remove(input.memberId, input.removedBy);

    if (!removed) {
      return { success: false, error: "Failed to remove member" };
    }

    return { success: true };
  }

  /**
   * Remove user from a group by user ID
   */
  async removeUserFromGroup(
    input: RemoveUserFromGroupInput,
    tenantId: string
  ): Promise<ServiceResult> {
    // Verify group exists and belongs to tenant
    const group = await groupRepository.findById(input.groupId);
    if (!group) {
      return { success: false, error: "Group not found" };
    }

    if (group.tenantId !== tenantId) {
      return { success: false, error: "Access denied" };
    }

    // Check if user is a member
    const member = await groupMemberRepository.findByUserAndGroup(
      input.userId,
      input.groupId
    );

    if (!member) {
      return { success: false, error: "User is not a member of this group" };
    }

    if (member.removedAt) {
      return { success: false, error: "User already removed from this group" };
    }

    const removed = await groupMemberRepository.removeUserFromGroup(
      input.groupId,
      input.userId,
      input.removedBy
    );

    if (!removed) {
      return { success: false, error: "Failed to remove user from group" };
    }

    return { success: true };
  }

  /**
   * Get user's memberships
   */
  async getUserMemberships(userId: string): Promise<ServiceResult<GroupMemberWithUser[]>> {
    const memberships = await groupMemberRepository.findActiveByUser(userId);
    return { success: true, data: memberships as GroupMemberWithUser[] };
  }

  /**
   * Get members by role in a group
   */
  async getMembersByRole(
    groupId: string,
    role: string,
    tenantId: string
  ): Promise<ServiceResult<GroupMemberWithUser[]>> {
    // Verify tenant access
    const group = await groupRepository.findById(groupId);
    if (!group || group.tenantId !== tenantId) {
      return { success: false, error: "Access denied" };
    }

    const members = await groupMemberRepository.findByGroupAndRole(groupId, role);
    return { success: true, data: members };
  }

  /**
   * Add multiple members to a group
   */
  async addMultipleMembers(
    groupId: string,
    userIds: string[],
    role: string,
    addedBy: string,
    tenantId: string
  ): Promise<ServiceResult<{ added: number; skipped: number; errors: string[] }>> {
    // Verify tenant access
    const group = await groupRepository.findById(groupId);
    if (!group || group.tenantId !== tenantId) {
      return { success: false, error: "Access denied" };
    }

    // Validate role
    if (!VALID_ROLES.includes(role as MemberRole)) {
      return { success: false, error: "Invalid role" };
    }

    let added = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const userId of userIds) {
      const result = await this.addMember({
        groupId,
        userId,
        role,
        addedBy,
      });

      if (result.success) {
        added++;
      } else {
        skipped++;
        errors.push(`User ${userId}: ${result.error}`);
      }
    }

    return {
      success: true,
      data: { added, skipped, errors },
    };
  }
}

// Singleton instance
export const groupMemberService = new GroupMemberService();
