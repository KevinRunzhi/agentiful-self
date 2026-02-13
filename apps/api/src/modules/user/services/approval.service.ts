/**
 * Approval Workflow Service
 *
 * Business logic for user approval queue management
 */

import { userStatusService } from "./user-status.service";
import { tenantRepository } from "../auth/repositories/tenant.repository";
import { userRoleRepository } from "../auth/repositories/user-role.repository";
import { auditService } from "../auth/services/audit.service";

/**
 * Approval queue item
 */
export interface ApprovalQueueItem {
  userId: string;
  userName: string;
  userEmail: string;
  tenantId: string;
  tenantName: string;
  role: string;
  createdAt: string;
  invitedBy?: string;
}

/**
 * Service result
 */
export interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Approval Workflow Service
 */
export class ApprovalService {
  /**
   * Get approval queue for a tenant
   */
  async getApprovalQueue(tenantId: string): Promise<ServiceResult<ApprovalQueueItem[]>> {
    const pendingUsers = await userStatusService.getPendingUsers(tenantId);

    // Enrich with tenant and role info
    const queue: ApprovalQueueItem[] = [];

    for (const user of pendingUsers) {
      const userRole = await userRoleRepository.findByUserAndTenant(user.id, tenantId);

      if (userRole) {
        const tenant = await tenantRepository.findById(tenantId);

        queue.push({
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          tenantId,
          tenantName: tenant?.name || "",
          role: userRole.role,
          createdAt: user.createdAt.toISOString(),
        });
      }
    }

    return { success: true, data: queue };
  }

  /**
   * Approve a user
   */
  async approveUser(
    userId: string,
    tenantId: string,
    approvedBy: string
  ): Promise<ServiceResult> {
    const result = await userStatusService.approveUser(userId, tenantId);

    if (!result.success) {
      return result;
    }

    // Log approval
    await auditService.logSuccess({
      userId: approvedBy,
      tenantId,
      action: "user.approve",
      targetUserId: userId,
      details: { approvedAt: new Date().toISOString() },
    });

    return { success: true };
  }

  /**
   * Reject a user
   */
  async rejectUser(
    userId: string,
    tenantId: string,
    rejectedBy: string,
    reason?: string
  ): Promise<ServiceResult> {
    const result = await userStatusService.rejectUser(userId, tenantId);

    if (!result.success) {
      return result;
    }

    // Log rejection
    await auditService.logSuccess({
      userId: rejectedBy,
      tenantId,
      action: "user.reject",
      targetUserId: userId,
      details: { rejectedAt: new Date().toISOString(), reason },
    });

    return { success: true };
  }

  /**
   * Bulk approve users
   */
  async bulkApprove(
    userIds: string[],
    tenantId: string,
    approvedBy: string
  ): Promise<ServiceResult<{ approved: number; failed: string[] }>> {
    let approved = 0;
    const failed: string[] = [];

    for (const userId of userIds) {
      const result = await this.approveUser(userId, tenantId, approvedBy);

      if (result.success) {
        approved++;
      } else {
        failed.push(userId);
      }
    }

    return { success: true, data: { approved, failed } };
  }

  /**
   * Get approval queue statistics
   */
  async getQueueStats(tenantId: string): Promise<{
    pending: number;
    approvedThisWeek: number;
    rejectedThisWeek: number;
  }> {
    const pending = await userStatusService.getPendingUsers(tenantId);

    // For approved/rejected counts, we'd need to query audit events
    // For now, return just the pending count
    return {
      pending: pending.length,
      approvedThisWeek: 0,
      rejectedThisWeek: 0,
    };
  }

  /**
   * Check if user requires approval based on tenant settings
   */
  async requiresApproval(tenantId: string): Promise<boolean> {
    const tenant = await tenantRepository.findById(tenantId);

    if (!tenant) return true;

    // Check tenant's customConfig for userApproval requirement
    const config = tenant.customConfig as { userApproval?: { enabled: boolean } } | null;

    return config?.userApproval?.enabled ?? true;
  }

  /**
   * Skip approval for invited user (if enabled)
   */
  async canSkipApproval(tenantId: string): Promise<boolean> {
    const tenant = await tenantRepository.findById(tenantId);

    if (!tenant) return false;

    // Check if tenant has auto-approval enabled for invited users
    const config = tenant.customConfig as { userApproval?: { autoApproveInvites: boolean } } | null;

    return config?.userApproval?.autoApproveInvites ?? false;
  }
}

// Singleton instance
export const approvalService = new ApprovalService();
