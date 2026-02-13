/**
 * Active Group Service
 *
 * Service for managing active group context (T072-T075).
 * Handles multi-group user scenarios and quota attribution.
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, or, sql, inArray } from 'drizzle-orm';
import { group } from '@agentifui/db/schema/group';
import { groupMember } from '@agentifui/db/schema/group-member';
import { appGrant } from '@agentifui/db/schema/rbac';
import { app } from '@agentifui/db/schema/rbac';
import type { ActiveGroupContext, AppContextOptions } from '@agentifui/shared/rbac';

// =============================================================================
// Types
// =============================================================================

interface GroupMembership {
  groupId: string;
  groupName: string;
  role: 'member' | 'manager';
  tenantId: string;
}

interface GroupWithAccess extends GroupMembership {
  hasAccess: boolean;
}

// =============================================================================
// Service Interface
// =============================================================================

export interface IActiveGroupService {
  getAccessibleGroups(userId: string, tenantId: string): Promise<ActiveGroupContext[]>;
  getGroupsForAppContext(
    userId: string,
    tenantId: string,
    appId: string
  ): Promise<AppContextOptions>;
  getActiveGroup(userId: string, tenantId: string): Promise<ActiveGroupContext | null>;
  setActiveGroup(userId: string, tenantId: string, groupId: string): Promise<void>;
  validateActiveGroup(
    userId: string,
    tenantId: string,
    activeGroupId: string,
    appId: string
  ): Promise<boolean>;
}

// =============================================================================
// Service Implementation
// =============================================================================

export class ActiveGroupService implements IActiveGroupService {
  constructor(private db: PostgresJsDatabase) {}

  /**
   * Get all groups a user can access in a tenant (T073)
   */
  async getAccessibleGroups(userId: string, tenantId: string): Promise<ActiveGroupContext[]> {
    const memberships = await this.db
      .select({
        groupId: groupMember.groupId,
        groupName: group.name,
        role: groupMember.role,
        tenantId: group.tenantId,
      })
      .from(groupMember)
      .innerJoin(group, eq(groupMember.groupId, group.id))
      .where(
        and(
          eq(groupMember.userId, userId),
          eq(group.tenantId, tenantId)
        )
      )
      .orderBy(group.name);

    return memberships.map((m) => ({
      groupId: m.groupId,
      groupName: m.groupName,
      tenantId: m.tenantId,
      hasAccess: true, // All accessible groups have access by default
    }));
  }

  /**
   * Get group options for an app context (T074)
   * Returns groups with access to the app for context switching
   */
  async getGroupsForAppContext(
    userId: string,
    tenantId: string,
    appId: string
  ): Promise<AppContextOptions> {
    // Get all user's groups in this tenant
    const userGroups = await this.getAccessibleGroups(userId, tenantId);

    if (userGroups.length === 0) {
      return {
        currentGroup: null,
        availableGroups: [],
        requiresSwitch: false,
      };
    }

    // Get groups with grants for this app
    const groupIds = userGroups.map((g) => g.groupId);

    const grants = await this.db
      .select({
        granteeId: appGrant.granteeId,
        permission: appGrant.permission,
      })
      .from(appGrant)
      .where(
        and(
          eq(appGrant.appId, appId),
          eq(appGrant.granteeType, 'group'),
          inArray(appGrant.granteeId, groupIds)
        )
      );

    // Build map of groups with access
    const groupsWithAccess = new Set<string>();
    for (const grant of grants) {
      if (grant.permission === 'use') {
        groupsWithAccess.add(grant.granteeId);
      }
    }

    const availableGroups: ActiveGroupContext[] = userGroups.map((g) => ({
      ...g,
      hasAccess: groupsWithAccess.has(g.groupId),
    }));

    // Determine current group (would come from request context/local storage)
    // For now, return the first group with access or the first group
    const currentGroup =
      availableGroups.find((g) => g.hasAccess) || availableGroups[0] || null;

    const requiresSwitch =
      currentGroup && availableGroups.some((g) => g.hasAccess && g.groupId !== currentGroup.groupId);

    return {
      currentGroup,
      availableGroups,
      requiresSwitch: requiresSwitch || false,
    };
  }

  /**
   * Get user's active group for a tenant (T072)
   */
  async getActiveGroup(userId: string, tenantId: string): Promise<ActiveGroupContext | null> {
    // This would typically be retrieved from:
    // 1. Request header (X-Active-Group-ID)
    // 2. Local storage (for frontend)
    // 3. User preferences (stored in DB)
    //
    // For now, return the first group the user belongs to
    const groups = await this.getAccessibleGroups(userId, tenantId);

    return groups[0] || null;
  }

  /**
   * Set active group for a user
   */
  async setActiveGroup(userId: string, tenantId: string, groupId: string): Promise<void> {
    // Verify user belongs to this group
    const membership = await this.db
      .select()
      .from(groupMember)
      .where(
        and(
          eq(groupMember.userId, userId),
          eq(groupMember.groupId, groupId)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      throw new Error('User is not a member of this group');
    }

    // In a real implementation, this would store the preference
    // For now, we just validate membership
  }

  /**
   * Validate that active group has access to the app (T075)
   */
  async validateActiveGroup(
    userId: string,
    tenantId: string,
    activeGroupId: string,
    appId: string
  ): Promise<boolean> {
    // First, verify user belongs to the active group
    const membership = await this.db
      .select()
      .from(groupMember)
      .where(
        and(
          eq(groupMember.userId, userId),
          eq(groupMember.groupId, activeGroupId)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return false;
    }

    // Check if the group has access to the app
    const grant = await this.db
      .select()
      .from(appGrant)
      .where(
        and(
          eq(appGrant.appId, appId),
          eq(appGrant.granteeType, 'group'),
          eq(appGrant.granteeId, activeGroupId),
          eq(appGrant.permission, 'use')
        )
      )
      .limit(1);

    return grant.length > 0;
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createActiveGroupService(db: PostgresJsDatabase): ActiveGroupService {
  return new ActiveGroupService(db);
}
