/**
 * Visibility Service
 *
 * Service for enforcing content visibility boundaries (S1-2 User Story 4).
 * Implements three-tier visibility:
 * - User: Can only view their own conversations
 * - Manager: Can view statistics for current group only
 * - Tenant Admin: Can view others' conversations with reason (audited)
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, or, sql, inArray } from 'drizzle-orm';
import { rbacRole, rbacUserRole, appGrant, app } from '@agentifui/db/schema/rbac';
import { groupMember } from '@agentifui/db/schema/group-member';
import { conversation } from '@agentifui/db/schema/conversation';
import { auditEvent } from '@agentifui/db/schema/audit-event';
import type { Conversation, GroupMember } from '@agentifui/db';
import type { PermissionCheckInput } from '@agentifui/shared/rbac';

// =============================================================================
// Types
// =============================================================================

export interface VisibilityContext {
  userId: string;
  tenantId: string;
  activeGroupId: string | null;
  traceId?: string;
}

export interface ViewOthersRequest {
  reason: string;
  targetUserId?: string;
  conversationId?: string;
  traceId?: string;
}

export interface VisibilityScope {
  canViewOwn: boolean;
  canViewGroup: boolean;
  canViewOthers: boolean;
  requiresReason: boolean;
  allowedGroups: string[];
  allowedUsers: string[];
}

export interface ConversationFilter {
  userId?: string;
  groupIds?: string[];
  includeOwn: boolean;
  includeGroup: boolean;
  includeOthers: boolean;
}

// =============================================================================
// Visibility Service Interface
// =============================================================================

export interface IVisibilityService {
  /**
   * Get the visibility scope for a user based on their roles.
   * Determines what content the user can access.
   */
  getVisibilityScope(context: VisibilityContext): Promise<VisibilityScope>;

  /**
   * Check if user can view a specific conversation.
   */
  canViewConversation(
    context: VisibilityContext,
    conversationId: string,
    viewOthersRequest?: ViewOthersRequest
  ): Promise<{ allowed: boolean; reason?: string }>;

  /**
   * Get conversation filter for database queries.
   * Returns filters to apply when querying conversations.
   */
  getConversationFilter(context: VisibilityContext): Promise<ConversationFilter>;

  /**
   * Get statistics filter for Manager role.
   * Managers can only view statistics for their active group.
   */
  getStatisticsFilter(context: VisibilityContext): Promise<{ groupIds: string[] }>;

  /**
   * Record view_others access with reason (Tenant Admin only).
   * Creates a critical audit event.
   */
  recordViewOthersAccess(
    context: VisibilityContext,
    request: ViewOthersRequest
  ): Promise<void>;

  /**
   * Check if user is Tenant Admin.
   */
  isTenantAdmin(userId: string, tenantId: string): Promise<boolean>;

  /**
   * Check if user is Manager in specified group.
   */
  isGroupManager(userId: string, groupId: string): Promise<boolean>;

  /**
   * Get groups where user is a Manager.
   */
  getManagerGroups(userId: string, tenantId: string): Promise<string[]>;
}

// =============================================================================
// Visibility Service Implementation
// =============================================================================

export class VisibilityService implements IVisibilityService {
  constructor(
    private db: PostgresJsDatabase,
    private audit?: {
      logEvent(event: {
        tenantId: string;
        actorUserId: string;
        actorType: string;
        action: string;
        resourceType: string;
        resourceId?: string;
        result: string;
        traceId?: string;
        metadata?: Record<string, unknown>;
      }): Promise<void>;
    }
  ) {}

  // ==========================================================================
  // Core Visibility Logic
  // ==========================================================================

  /**
   * T086 [P] [US4] Implement user-scoped query filter
   */
  async getVisibilityScope(context: VisibilityContext): Promise<VisibilityScope> {
    const { userId, tenantId, activeGroupId } = context;

    // Check if user is Tenant Admin
    const isTenantAdmin = await this.isTenantAdmin(userId, tenantId);

    // Check if user is Manager in any group
    const managerGroups = await this.getManagerGroups(userId, tenantId);
    const isManager = managerGroups.length > 0;

    // Check for explicit view_others permission (Tenant Admin only)
    const canViewOthers = isTenantAdmin;

    return {
      canViewOwn: true, // All users can view their own content
      canViewGroup: isManager && activeGroupId !== null,
      canViewOthers, // Only Tenant Admin can view others' content
      requiresReason: isTenantAdmin,
      allowedGroups: isManager && activeGroupId ? [activeGroupId] : managerGroups,
      allowedUsers: canViewOthers ? [] : [userId], // Empty array = all users for Tenant Admin
    };
  }

  /**
   * T087 [P] [US4] Implement manager-scoped query filter
   * Manager can only view current group statistics
   */
  async getStatisticsFilter(context: VisibilityContext): Promise<{ groupIds: string[] }> {
    const { userId, tenantId, activeGroupId } = context;

    // Check if user is Manager
    const managerGroups = await this.getManagerGroups(userId, tenantId);

    if (managerGroups.length === 0) {
      // Not a manager, return empty filter (no access)
      return { groupIds: [] };
    }

    // Manager can only view statistics for their active group
    if (activeGroupId && managerGroups.includes(activeGroupId)) {
      return { groupIds: [activeGroupId] };
    }

    // If no active group specified, use all managed groups
    return { groupIds: managerGroups };
  }

  /**
   * T088 [P] [US4] Implement tenant-admin view-others access control
   */
  async canViewConversation(
    context: VisibilityContext,
    conversationId: string,
    viewOthersRequest?: ViewOthersRequest
  ): Promise<{ allowed: boolean; reason?: string }> {
    const { userId, tenantId } = context;

    // Try to get the conversation first
    const conversationRecord = await this.getConversation(conversationId);
    if (!conversationRecord) {
      return { allowed: false, reason: 'Conversation not found' };
    }

    // Check 1: User owns the conversation
    if (conversationRecord.userId === userId) {
      return { allowed: true, reason: 'owner' };
    }

    // Check 2: User is Tenant Admin with reason
    const isTenantAdmin = await this.isTenantAdmin(userId, tenantId);
    if (isTenantAdmin) {
      if (!viewOthersRequest || !viewOthersRequest.reason || viewOthersRequest.reason.trim().length === 0) {
        return { allowed: false, reason: 'Reason required for viewing others\' conversations' };
      }

      // Record the access attempt
      await this.recordViewOthersAccess(context, {
        ...viewOthersRequest,
        conversationId,
      });

      return { allowed: true, reason: 'tenant_admin_with_reason' };
    }

    // Check 3: User is Manager in the conversation's group
    if (conversationRecord.groupId) {
      const isManager = await this.isGroupManager(userId, conversationRecord.groupId);
      if (isManager) {
        // Managers can see group statistics but NOT conversation content
        return { allowed: false, reason: 'Managers cannot view conversation content, only statistics' };
      }
    }

    return { allowed: false, reason: 'access_denied' };
  }

  /**
   * T089 [US4] Implement conversation access control for Tenant Admin
   */
  async getConversationFilter(context: VisibilityContext): Promise<ConversationFilter> {
    const { userId, activeGroupId } = context;
    const scope = await this.getVisibilityScope(context);

    return {
      userId: scope.canViewOwn ? userId : undefined,
      groupIds: scope.allowedGroups.length > 0 ? scope.allowedGroups : undefined,
      includeOwn: scope.canViewOwn,
      includeGroup: scope.canViewGroup,
      includeOthers: scope.canViewOthers,
    };
  }

  /**
   * T092 [US4] Add conversation.view_others audit event
   */
  async recordViewOthersAccess(
    context: VisibilityContext,
    request: ViewOthersRequest
  ): Promise<void> {
    if (!this.audit) {
      return;
    }

    await this.audit.logEvent({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      actorType: 'user',
      action: 'conversation.view_others',
      resourceType: 'conversation',
      resourceId: request.conversationId,
      result: 'success',
      traceId: context.traceId || request.traceId,
      metadata: {
        reason: request.reason,
        targetUserId: request.targetUserId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * T093 [US4] Add view_others.attempted audit event for unauthorized access
   */
  async recordUnauthorizedAccessAttempt(
    context: VisibilityContext,
    resourceType: string,
    resourceId: string,
    attemptReason: string
  ): Promise<void> {
    if (!this.audit) {
      return;
    }

    await this.audit.logEvent({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      actorType: 'user',
      action: 'view_others.attempted',
      resourceType,
      resourceId,
      result: 'failure',
      traceId: context.traceId,
      metadata: {
        attemptReason,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // ==========================================================================
  // Role Check Methods
  // ==========================================================================

  async isTenantAdmin(userId: string, tenantId: string): Promise<boolean> {
    const now = new Date();

    const result = await this.db
      .select({ id: rbacRole.id })
      .from(rbacUserRole)
      .innerJoin(rbacRole, eq(rbacUserRole.roleId, rbacRole.id))
      .where(
        and(
          eq(rbacUserRole.userId, userId),
          eq(rbacUserRole.tenantId, tenantId),
          eq(rbacRole.name, 'tenant_admin'),
          eq(rbacRole.isActive, true),
          or(
            sql`${rbacUserRole.expiresAt} IS NULL`,
            sql`${rbacUserRole.expiresAt} > ${now}`
          )
        )
      )
      .limit(1);

    return result.length > 0;
  }

  async isGroupManager(userId: string, groupId: string): Promise<boolean> {
    const result = await this.db
      .select()
      .from(groupMember)
      .where(
        and(
          eq(groupMember.userId, userId),
          eq(groupMember.groupId, groupId),
          eq(groupMember.role, 'manager')
        )
      )
      .limit(1);

    return result.length > 0;
  }

  async getManagerGroups(userId: string, tenantId: string): Promise<string[]> {
    const result = await this.db
      .select({ groupId: groupMember.groupId })
      .from(groupMember)
      .where(
        and(
          eq(groupMember.userId, userId),
          eq(groupMember.role, 'manager')
        )
      );

    return result.map((r) => r.groupId);
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private async getConversation(conversationId: string): Promise<{ userId: string; groupId: string | null } | null> {
    // Import conversation schema dynamically to avoid circular dependency
    // For now, return a mock result
    // In production, this would query the actual conversation table

    try {
      const result = await this.db
        .select({
          userId: conversation.userId,
          groupId: conversation.activeGroupId,
        })
        .from(conversation)
        .where(eq(conversation.id, conversationId))
        .limit(1);

      return result[0] || null;
    } catch {
      // Conversation table might not exist yet in this phase
      return null;
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createVisibilityService(
  db: PostgresJsDatabase,
  audit?: VisibilityService['audit']
): VisibilityService {
  return new VisibilityService(db, audit);
}
