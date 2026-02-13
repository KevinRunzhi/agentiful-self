/**
 * App Service
 *
 * Service for managing application context and smart switching (T119-T120, User Story 7).
 * Handles app accessibility and context options for multi-group users.
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, or, sql, inArray } from 'drizzle-orm';
import { app } from '@agentifui/db/schema/rbac';
import { appGrant } from '@agentifui/db/schema/rbac';
import { groupMember } from '@agentifui/db/schema/group-member';
import { rbacRole, rbacUserRole, permission, rolePermission } from '@agentifui/db/schema/rbac';

// =============================================================================
// Types
// =============================================================================

export interface AppContextOption {
  groupId: string;
  groupName: string;
  hasAccess: boolean;
}

export interface AppWithContext {
  id: string;
  name: string;
  description?: string;
  currentGroup?: {
    id: string;
    name: string;
    hasAccess: boolean;
  };
  availableGroups: AppContextOption[];
  requiresSwitch: boolean;
}

export interface AccessibleAppsResult {
  apps: AppWithContext[];
}

// =============================================================================
// App Service Interface
// =============================================================================

export interface IAppService {
  /**
   * T120 [P] [US7] Add context-aware filtering to getAccessibleApps
   * Get all apps accessible to user, with context information
   */
  getAccessibleApps(
    userId: string,
    tenantId: string,
    activeGroupId?: string | null
  ): Promise<AccessibleAppsResult>;

  /**
   * T119 [P] [US7] Implement getAppContextOptions method
   * Get available group context options for a specific app
   */
  getAppContextOptions(
    userId: string,
    tenantId: string,
    appId: string
  ): Promise<{
    currentGroup?: AppContextOption;
    availableGroups: AppContextOption[];
  }>;

  /**
   * Check if user has access to an app
   */
  hasAppAccess(
    userId: string,
    tenantId: string,
    appId: string,
    activeGroupId?: string | null
  ): Promise<boolean>;

  /**
   * Get apps for a specific group context
   */
  getAppsForGroup(
    userId: string,
    tenantId: string,
    groupId: string
  ): Promise<AppWithContext[]>;
}

// =============================================================================
// App Service Implementation
// =============================================================================

export class AppService implements IAppService {
  constructor(private db: PostgresJsDatabase) {}

  /**
   * T120 [P] [US7] Add context-aware filtering to getAccessibleApps
   */
  async getAccessibleApps(
    userId: string,
    tenantId: string,
    activeGroupId?: string | null
  ): Promise<AccessibleAppsResult> {
    // Get all apps in the tenant
    const tenantApps = await this.db
      .select()
      .from(app)
      .where(eq(app.tenantId, tenantId))
      .orderBy(app.name);

    const appContexts: AppWithContext[] = [];

    for (const appRecord of tenantApps) {
      // Get context options for this app
      const { availableGroups, currentGroup } = await this.getAppContextOptions(
        userId,
        tenantId,
        appRecord.id
      );

      // Determine if switch is required
      // If no groups have access, skip this app
      const accessibleGroups = availableGroups.filter((g) => g.hasAccess);
      if (accessibleGroups.length === 0) {
        continue;
      }

      // Determine current group context
      let currentGroupContext: AppContextOption | undefined;
      if (activeGroupId) {
        const currentHasAccess = availableGroups.find((g) => g.groupId === activeGroupId)?.hasAccess;
        if (currentHasAccess) {
          currentGroupContext = {
            groupId: activeGroupId,
            groupName: availableGroups.find((g) => g.groupId === activeGroupId)?.groupName || '',
            hasAccess: true,
          };
        }
      }

      // Requires switch if:
      // 1. No current group set, OR
      // 2. Current group doesn't have access, OR
      // 3. Multiple groups have access (ambiguous)
      const requiresSwitch = !currentGroupContext ||
                           !currentGroupContext.hasAccess ||
                           accessibleGroups.filter((g) => g.hasAccess).length > 1;

      appContexts.push({
        id: appRecord.id,
        name: appRecord.name,
        currentGroup: currentGroupContext,
        availableGroups: accessibleGroups,
        requiresSwitch,
      });
    }

    return { apps: appContexts };
  }

  /**
   * T119 [P] [US7] Implement getAppContextOptions method
   * Returns available groups and their access status for an app
   */
  async getAppContextOptions(
    userId: string,
    tenantId: string,
    appId: string
  ): Promise<{
    currentGroup?: AppContextOption;
    availableGroups: AppContextOption[];
  }> {
    // Get all user's groups in this tenant
    const userGroups = await this.db
      .select({
        groupId: groupMember.groupId,
      })
      .from(groupMember)
      .where(eq(groupMember.userId, userId));

    if (userGroups.length === 0) {
      return { availableGroups: [] };
    }

    const groupIds = userGroups.map((g) => g.groupId);

    // Get app:use permission for this user across all contexts
    // This includes: user direct grants, group grants, role permissions
    const userPermissions = await this.getUserAppPermissions(userId, tenantId);

    // Check each group's access to this app
    const availableGroups: AppContextOption[] = [];

    for (const group of userGroups) {
      // Check if group has access to this app
      const groupGrantAccess = await this.checkGroupAccess(appId, group.groupId);
      const hasAccess = groupGrantAccess || userPermissions.includes(appId);

      // Get group name (would need to join with group table)
      // For now, use groupId as placeholder
      availableGroups.push({
        groupId: group.groupId,
        groupName: `Group ${group.groupId.substring(0, 8)}`,
        hasAccess,
      });
    }

    // Check for user direct grants (highest priority)
    const userDirectGrants = await this.db
      .select()
      .from(appGrant)
      .where(
        and(
          eq(appGrant.appId, appId),
          eq(appGrant.granteeType, 'user'),
          eq(appGrant.granteeId, userId),
          eq(appGrant.permission, 'use')
        )
      );

    // If user has direct grant, add as a "personal" context option
    if (userDirectGrants.length > 0) {
      availableGroups.push({
        groupId: userId, // Use userId as personal context ID
        groupName: 'Personal Access',
        hasAccess: true,
      });
    }

    return { availableGroups };
  }

  /**
   * Check if a group has access to an app via grants
   */
  private async checkGroupAccess(appId: string, groupId: string): Promise<boolean> {
    const now = new Date();

    const grant = await this.db
      .select()
      .from(appGrant)
      .where(
        and(
          eq(appGrant.appId, appId),
          eq(appGrant.granteeType, 'group'),
          eq(appGrant.granteeId, groupId),
          eq(appGrant.permission, 'use'),
          or(
            sql`${appGrant.expiresAt} IS NULL`,
            sql`${appGrant.expiresAt} > ${now}`
          )
        )
      )
      .limit(1);

    return grant.length > 0;
  }

  /**
   * Get apps the user has permission to use via roles
   */
  private async getUserAppPermissions(userId: string, tenantId: string): Promise<string[]> {
    const now = new Date();

    // Get user's active roles
    const userRoles = await this.db
      .select({ roleId: rbacUserRole.roleId })
      .from(rbacUserRole)
      .where(
        and(
          eq(rbacUserRole.userId, userId),
          eq(rbacUserRole.tenantId, tenantId),
          eq(rbacRole.isActive, true),
          or(
            sql`${rbacUserRole.expiresAt} IS NULL`,
            sql`${rbacUserRole.expiresAt} > ${now}`
          )
        )
      );

    if (userRoles.length === 0) {
      return [];
    }

    const roleIds = userRoles.map((r) => r.roleId);

    // Get all app:use permissions for these roles
    const permissions = await this.db
      .select({ code: permission.code })
      .from(rolePermission)
      .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
      .where(
        and(
          sql`${rolePermission.roleId} = ANY(${roleIds})`,
          eq(permission.code, 'app:use'),
          eq(permission.isActive, true)
        )
      );

    return permissions.map((p) => p.code);
  }

  /**
   * T119: Get apps for a specific group context
   * Helper method for filtering apps by group access
   */
  async getAppsForGroup(
    userId: string,
    tenantId: string,
    groupId: string
  ): Promise<AppWithContext[]> {
    // Get all apps in tenant
    const tenantApps = await this.db
      .select()
      .from(app)
      .where(eq(app.tenantId, tenantId));

    const accessibleApps: AppWithContext[] = [];

    for (const appRecord of tenantApps) {
      // Check if group has access
      const hasAccess = await this.checkGroupAccess(appRecord.id, groupId);

      if (hasAccess) {
        accessibleApps.push({
          id: appRecord.id,
          name: appRecord.name,
          currentGroup: {
            groupId,
            groupName: `Group ${groupId.substring(0, 8)}`,
            hasAccess: true,
          },
          availableGroups: [
            {
              groupId,
              groupName: `Group ${groupId.substring(0, 8)}`,
              hasAccess: true,
            },
          ],
          requiresSwitch: false,
        });
      }
    }

    return accessibleApps;
  }

  async hasAppAccess(
    userId: string,
    tenantId: string,
    appId: string,
    activeGroupId?: string | null
  ): Promise<boolean> {
    // Check direct user grant
    const now = new Date();
    const userDirectGrant = await this.db
      .select()
      .from(appGrant)
      .where(
        and(
          eq(appGrant.appId, appId),
          eq(appGrant.granteeType, 'user'),
          eq(appGrant.granteeId, userId),
          eq(appGrant.permission, 'use'),
          or(
            sql`${appGrant.expiresAt} IS NULL`,
            sql`${appGrant.expiresAt} > ${now}`
          )
        )
      )
      .limit(1);

    if (userDirectGrant.length > 0) {
      return true;
    }

    // Check group grants
    if (activeGroupId) {
      return await this.checkGroupAccess(appId, activeGroupId);
    }

    // Check role permissions
    const userPermissions = await this.getUserAppPermissions(userId, tenantId);
    return userPermissions.includes(appId);
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createAppService(db: PostgresJsDatabase): AppService {
  return new AppService(db);
}
