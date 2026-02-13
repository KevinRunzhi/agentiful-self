/**
 * User Status Management Service
 *
 * Business logic for user status transitions (pending, active, suspended, etc.)
 */

import { userRepository } from "../repositories/user.repository";
import { userRoleRepository } from "../repositories/user-role.repository";
import type { User } from "@agentifui/db/schema";

/**
 * User status values
 */
export type UserStatus = "pending" | "active" | "suspended" | "inactive";

/**
 * Status transition rules
 */
const STATUS_TRANSITIONS: Record<UserStatus, UserStatus[]> = {
  pending: ["active", "inactive"],
  active: ["suspended", "inactive"],
  suspended: ["active", "inactive"],
  inactive: [], // Cannot reactivate from inactive
};

/**
 * Service result
 */
export interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * User Status Service
 */
export class UserStatusService {
  /**
   * Check if status transition is valid
   */
  private canTransition(from: UserStatus, to: UserStatus): boolean {
    return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
  }

  /**
   * Change user status
   */
  async changeStatus(
    userId: string,
    newStatus: UserStatus,
    tenantId: string
  ): Promise<ServiceResult<User>> {
    const user = await userRepository.findById(userId);

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Check if transition is valid
    if (!this.canTransition(user.status as UserStatus, newStatus)) {
      return {
        success: false,
        error: `Cannot transition from ${user.status} to ${newStatus}`,
      };
    }

    // Verify the actor has permission for this tenant
    // Check if user belongs to this tenant
    const userRole = await userRoleRepository.findByUserAndTenant(userId, tenantId);

    if (!userRole) {
      return { success: false, error: "User not found in this tenant" };
    }

    const updated = await userRepository.update(userId, { status: newStatus });

    if (!updated) {
      return { success: false, error: "Failed to update user status" };
    }

    return { success: true, data: updated };
  }

  /**
   * Approve a pending user
   */
  async approveUser(
    userId: string,
    tenantId: string
  ): Promise<ServiceResult<User>> {
    return this.changeStatus(userId, "active", tenantId);
  }

  /**
   * Reject a pending user (set to inactive)
   */
  async rejectUser(
    userId: string,
    tenantId: string
  ): Promise<ServiceResult<User>> {
    return this.changeStatus(userId, "inactive", tenantId);
  }

  /**
   * Suspend a user
   */
  async suspendUser(
    userId: string,
    tenantId: string
  ): Promise<ServiceResult<User>> {
    return this.changeStatus(userId, "suspended", tenantId);
  }

  /**
   * Reactivate a suspended user
   */
  async reactivateUser(
    userId: string,
    tenantId: string
  ): Promise<ServiceResult<User>> {
    return this.changeStatus(userId, "active", tenantId);
  }

  /**
   * Get users by status for a tenant
   */
  async getUsersByStatus(
    tenantId: string,
    status: UserStatus
  ): Promise<User[]> {
    return userRepository.findByTenant(tenantId).then((users) =>
      users.filter((u) => u.status === status)
    );
  }

  /**
   * Get pending users for a tenant
   */
  async getPendingUsers(tenantId: string): Promise<User[]> {
    return this.getUsersByStatus(tenantId, "pending");
  }

  /**
   * Check if user can access resources (status check)
   */
  async canAccess(userId: string): Promise<boolean> {
    const user = await userRepository.findById(userId);

    if (!user) return false;

    return user.status === "active";
  }

  /**
   * Check if user needs approval
   */
  async needsApproval(userId: string): Promise<boolean> {
    const user = await userRepository.findById(userId);

    return user?.status === "pending";
  }

  /**
   * Get status display info
   */
  getStatusInfo(status: UserStatus): {
    label: string;
    color: string;
    description: string;
  } {
    const statusMap = {
      pending: {
        label: "Pending Approval",
        color: "yellow",
        description: "Account is awaiting administrator approval",
      },
      active: {
        label: "Active",
        color: "green",
        description: "Account is active and can access resources",
      },
      suspended: {
        label: "Suspended",
        color: "orange",
        description: "Account is temporarily suspended",
      },
      inactive: {
        label: "Inactive",
        color: "gray",
        description: "Account has been deactivated",
      },
    };

    return statusMap[status];
  }
}

// Singleton instance
export const userStatusService = new UserStatusService();
