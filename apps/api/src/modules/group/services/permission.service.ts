/**
 * Group Permission Service
 *
 * Business logic for checking group-based permissions
 * Manager permissions are scoped to their groups only
 */

import { groupMemberRepository } from "../repositories/group-member.repository";
import { groupRepository } from "../repositories/group.repository";
import { userRepository } from "../../auth/repositories/user.repository";

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  role?: string;
}

/**
 * Permission levels
 */
export enum PermissionLevel {
  /** Can only view own data */
  SELF = "self",
  /** Can view/manage data within own groups */
  GROUP = "group",
  /** Can view/manage all data within tenant */
  TENANT = "tenant",
  /** Full system access */
  SYSTEM = "system",
}

/**
 * Group Permission Service
 */
export class GroupPermissionService {
  /**
   * Check if user has admin role in tenant
   */
  async isTenantAdmin(userId: string, tenantId: string): Promise<boolean> {
    const user = await userRepository.findById(userId);
    if (!user) {
      return false;
    }

    if (user.status !== "active") {
      return false;
    }

    // Check if user has admin role in tenant via UserRole
    // Import here to avoid circular dependency
    const { userRoleRepository } = await import("../../auth/repositories/user-role.repository");
    const adminRole = await userRoleRepository.findByUserAndTenant(userId, tenantId);

    return adminRole?.role === "admin" && !adminRole.expiresAt;
  }

  /**
   * Check if user is a manager in any group
   */
  async isGroupManager(userId: string, tenantId: string): Promise<boolean> {
    const memberships = await groupMemberRepository.findActiveByUser(userId);

    return memberships.some(
      (m) =>
        (m.role === "manager" || m.role === "admin") &&
        m.tenantId === tenantId
    );
  }

  /**
   * Check if user is a manager of a specific group
   */
  async isGroupManagerFor(userId: string, groupId: string): Promise<boolean> {
    const membership = await groupMemberRepository.findByUserAndGroup(
      userId,
      groupId
    );

    if (!membership || membership.removedAt) {
      return false;
    }

    return membership.role === "manager" || membership.role === "admin";
  }

  /**
   * Check if user is a member of a specific group
   */
  async isGroupMember(userId: string, groupId: string): Promise<boolean> {
    return groupMemberRepository.hasRole(userId, groupId, "member") ||
           groupMemberRepository.hasRole(userId, groupId, "manager") ||
           groupMemberRepository.hasRole(userId, groupId, "admin");
  }

  /**
   * Get user's permission level for tenant
   */
  async getPermissionLevel(
    userId: string,
    tenantId: string
  ): Promise<PermissionLevel> {
    const isAdmin = await this.isTenantAdmin(userId, tenantId);
    if (isAdmin) {
      return PermissionLevel.TENANT;
    }

    const isManager = await this.isGroupManager(userId, tenantId);
    if (isManager) {
      return PermissionLevel.GROUP;
    }

    // Check if user is a regular member of any group
    const memberships = await groupMemberRepository.findActiveByUser(userId);
    const hasMembership = memberships.some((m) => m.tenantId === tenantId);

    if (hasMembership) {
      return PermissionLevel.GROUP;
    }

    // User has no access to this tenant
    return PermissionLevel.SELF;
  }

  /**
   * Check if user can manage another user
   * Users can be managed if:
   * 1. The manager has tenant admin role
   * 2. The target user is in the manager's group
   */
  async canManageUser(
    managerUserId: string,
    targetUserId: string,
    tenantId: string
  ): Promise<PermissionCheckResult> {
    // Check if manager is tenant admin
    const isAdmin = await this.isTenantAdmin(managerUserId, tenantId);
    if (isAdmin) {
      return { allowed: true, role: "admin" };
    }

    // Get manager's groups where they have manager/admin role
    const managerGroups = await groupRepository.findByUserMember(
      managerUserId,
      tenantId
    );

    const managedGroupIds = managerGroups
      .filter((g) => g.role === "manager" || g.role === "admin")
      .map((g) => g.id);

    if (managedGroupIds.length === 0) {
      return {
        allowed: false,
        reason: "User does not have manager permissions in any group",
      };
    }

    // Check if target user is in any of the manager's groups
    const targetMemberships = await groupMemberRepository.findActiveByUser(
      targetUserId
    );

    const isInManagedGroup = targetMemberships.some((m) =>
      managedGroupIds.includes(m.groupId)
    );

    if (!isInManagedGroup) {
      return {
        allowed: false,
        reason: "Target user is not in any of the manager's groups",
      };
    }

    return {
      allowed: true,
      role: "manager",
    };
  }

  /**
   * Check if user can manage a group
   */
  async canManageGroup(
    userId: string,
    groupId: string,
    tenantId: string
  ): Promise<PermissionCheckResult> {
    // Verify group belongs to tenant
    const group = await groupRepository.findById(groupId);
    if (!group || group.tenantId !== tenantId) {
      return {
        allowed: false,
        reason: "Group not found or access denied",
      };
    }

    // Check if user is tenant admin
    const isAdmin = await this.isTenantAdmin(userId, tenantId);
    if (isAdmin) {
      return { allowed: true, role: "admin" };
    }

    // Check if user is group manager/admin
    const isManager = await this.isGroupManagerFor(userId, groupId);
    if (isManager) {
      return { allowed: true, role: "manager" };
    }

    return {
      allowed: false,
      reason: "User does not have permission to manage this group",
    };
  }

  /**
   * Get groups where user has management permissions
   */
  async getManagedGroups(userId: string, tenantId: string): Promise<string[]> {
    // If tenant admin, return all groups
    const isAdmin = await this.isTenantAdmin(userId, tenantId);
    if (isAdmin) {
      const groups = await groupRepository.findByTenantId(tenantId);
      return groups.map((g) => g.id);
    }

    // Otherwise, return groups where user is manager/admin
    const memberships = await groupMemberRepository.findActiveByUser(userId);
    const managedGroupIds = memberships
      .filter((m) => m.tenantId === tenantId && (m.role === "manager" || m.role === "admin"))
      .map((m) => m.groupId);

    return managedGroupIds;
  }

  /**
   * Filter entities based on user's group permissions
   * Returns list of group IDs where user has access
   */
  async filterByGroupAccess(
    userId: string,
    tenantId: string
  ): Promise<string[]> {
    // If tenant admin, return all groups
    const isAdmin = await this.isTenantAdmin(userId, tenantId);
    if (isAdmin) {
      const groups = await groupRepository.findByTenantId(tenantId);
      return groups.map((g) => g.id);
    }

    // Return groups where user is a member
    const memberships = await groupMemberRepository.findActiveByUser(userId);
    return memberships
      .filter((m) => m.tenantId === tenantId)
      .map((m) => m.groupId);
  }

  /**
   * Check if user can view data scoped to a group
   */
  async canViewGroupData(
    userId: string,
    groupId: string,
    tenantId: string
  ): Promise<PermissionCheckResult> {
    // Verify group belongs to tenant
    const group = await groupRepository.findById(groupId);
    if (!group || group.tenantId !== tenantId) {
      return {
        allowed: false,
        reason: "Group not found or access denied",
      };
    }

    // Check if user is tenant admin
    const isAdmin = await this.isTenantAdmin(userId, tenantId);
    if (isAdmin) {
      return { allowed: true, role: "admin" };
    }

    // Check if user is a member of the group
    const isMember = await this.isGroupMember(userId, groupId);
    if (isMember) {
      return { allowed: true, role: "member" };
    }

    return {
      allowed: false,
      reason: "User is not a member of this group",
    };
  }
}

// Singleton instance
export const groupPermissionService = new GroupPermissionService();
