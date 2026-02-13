/**
 * Permission Service
 *
 * Core service for RBAC permission checking (S1-2).
 * Implements the permission determination engine with 50ms P95 performance target.
 *
 * Permission Priority Chain:
 * 1. Deny (explicit rejection) - highest priority
 * 2. User direct grant
 * 3. Group grant / Manager user-level grant (equal)
 * 4. RBAC role permission
 * 5. Default deny
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, or, sql, desc } from 'drizzle-orm';
import {
  rbacRole,
  permission,
  rolePermission,
  rbacUserRole,
  appGrant,
  app,
} from '@agentifui/db/schema/rbac';
import { groupMember } from '@agentifui/db/schema/group-member';
import { user } from '@agentifui/db/schema/user';
import type {
  PermissionCheckInput,
  PermissionCheckOutput,
  MatchedGrant,
  PermissionDenialReason,
  PermissionAllowReason,
} from '@agentifui/shared/rbac';

// =============================================================================
// Permission Check Result Types
// =============================================================================

export interface PermissionCheckContext {
  userId: string;
  tenantId: string;
  activeGroupId: string | null;
  traceId?: string;
}

export interface PermissionCacheEntry {
  userId: string;
  tenantId: string;
  roles: Array<{ id: number; name: string; expiresAt: Date | null }>;
  groupGrants: Array<{
    id: string;
    appId: string;
    granteeType: 'group';
    permission: 'use' | 'deny';
    expiresAt: Date | null;
  }>;
  userGrants: Array<{
    id: string;
    appId: string;
    granteeType: 'user';
    permission: 'use' | 'deny';
    expiresAt: Date | null;
  }>;
  denies: Array<{
    id: string;
    appId: string;
    granteeId: string;
    expiresAt: Date | null;
  }>;
  expiresAt: Date;
}

// =============================================================================
// Permission Service Interface
// =============================================================================

export interface IPermissionService {
  /**
   * Check if a user has permission to perform an action on a resource.
   * Performance target: P95 ≤ 50ms
   */
  checkPermission(input: PermissionCheckInput): Promise<PermissionCheckOutput>;

  /**
   * Check multiple permissions at once (batch optimization).
   */
  checkBatch(
    userId: string,
    tenantId: string,
    activeGroupId: string | null,
    checks: Array<{ resourceType: string; action: string; resourceId?: string }>
  ): Promise<Array<{ allowed: boolean; reason: string }>>;

  /**
   * Invalidate permission cache for a user (called after grant/role changes).
   */
  invalidateCache(userId: string, tenantId: string): Promise<void>;

  /**
   * Get all permissions for a user in a tenant (cached).
   */
  getUserPermissions(
    userId: string,
    tenantId: string
  ): Promise<Set<string>>;

  /**
   * Check if user is a manager in the specified group.
   */
  isGroupManager(userId: string, groupId: string): Promise<boolean>;

  /**
   * Check if user has a specific role in a tenant.
   */
  hasRole(userId: string, tenantId: string, roleName: string): Promise<boolean>;
}

// =============================================================================
// Permission Service Implementation
// =============================================================================

export class PermissionService implements IPermissionService {
  private cache: Map<string, PermissionCacheEntry> = new Map();
  private readonly CACHE_TTL = 5000; // 5 seconds

  constructor(
    private db: PostgresJsDatabase,
    private redis?: {
      get(key: string): Promise<string | null>;
      set(key: string, value: string, px?: number): Promise<void>;
      del(pattern: string): Promise<void>;
      publish(channel: string, message: string): Promise<void>;
    }
  ) {}

  // ==========================================================================
  // Core Permission Check Logic
  // ==========================================================================

  async checkPermission(input: PermissionCheckInput): Promise<PermissionCheckOutput> {
    const startTime = Date.now();
    const traceId = input.traceId || this.generateTraceId();

    // Input validation
    this.validatePermissionInput(input);

    // 1. Check for explicit Deny (highest priority)
    const denyResult = await this.checkDeny(input);
    if (denyResult) {
      this.logPerformance(traceId, 'checkPermission', Date.now() - startTime);
      return denyResult;
    }

    // 2. Check user direct grant
    const userGrantResult = await this.checkUserGrant(input);
    if (userGrantResult) {
      this.logPerformance(traceId, 'checkPermission', Date.now() - startTime);
      return userGrantResult;
    }

    // 3. Check group grant
    const groupGrantResult = await this.checkGroupGrant(input);
    if (groupGrantResult) {
      this.logPerformance(traceId, 'checkPermission', Date.now() - startTime);
      return groupGrantResult;
    }

    // 4. Check RBAC role permission
    const rolePermissionResult = await this.checkRolePermission(input);
    if (rolePermissionResult) {
      this.logPerformance(traceId, 'checkPermission', Date.now() - startTime);
      return rolePermissionResult;
    }

    // 5. Default deny
    this.logPerformance(traceId, 'checkPermission', Date.now() - startTime);
    return {
      allowed: false,
      reason: 'default_deny' as PermissionDenialReason,
    };
  }

  // ==========================================================================
  // Validation (T016a)
  // ==========================================================================

  private validatePermissionInput(input: PermissionCheckInput): void {
    if (!input.userId || typeof input.userId !== 'string') {
      throw new Error('Invalid userId: must be a non-empty string');
    }
    if (!input.tenantId || typeof input.tenantId !== 'string') {
      throw new Error('Invalid tenantId: must be a non-empty string');
    }
    if (!input.resourceType || typeof input.resourceType !== 'string') {
      throw new Error('Invalid resourceType: must be a non-empty string');
    }
    if (!input.action || typeof input.action !== 'string') {
      throw new Error('Invalid action: must be a non-empty string');
    }

    // Validate activeGroupId if provided
    if (input.activeGroupId && typeof input.activeGroupId !== 'string') {
      throw new Error('Invalid activeGroupId: must be a string or null');
    }

    // Validate resourceType
    const validResourceTypes = ['app', 'conversation', 'group', 'tenant', 'grant', 'role'];
    if (!validResourceTypes.includes(input.resourceType)) {
      throw new Error(`Invalid resourceType: ${input.resourceType}. Must be one of ${validResourceTypes.join(', ')}`);
    }
  }

  // ==========================================================================
  // Deny Check (Priority 1)
  // ==========================================================================

  private async checkDeny(
    input: PermissionCheckInput
  ): Promise<PermissionCheckOutput | null> {
    const now = new Date();

    // Check user-level deny
    const userDenies = await this.db
      .select()
      .from(appGrant)
      .where(
        and(
          eq(appGrant.appId, input.resourceId || ''),
          eq(appGrant.granteeType, 'user'),
          eq(appGrant.granteeId, input.userId),
          eq(appGrant.permission, 'deny'),
          or(
            sql`${appGrant.expiresAt} IS NULL`,
            sql`${appGrant.expiresAt} > ${now}`
          )
        )
      )
      .limit(1);

    if (userDenies.length > 0) {
      return {
        allowed: false,
        reason: 'explicit_deny' as PermissionDenialReason,
        matchedGrant: {
          grantId: userDenies[0].id,
          grantType: 'user',
          source: 'user_direct_deny',
        },
      };
    }

    // Check group-level deny (only if activeGroupId is provided)
    if (input.activeGroupId) {
      const groupDenies = await this.db
        .select()
        .from(appGrant)
        .where(
          and(
            eq(appGrant.appId, input.resourceId || ''),
            eq(appGrant.granteeType, 'group'),
            eq(appGrant.granteeId, input.activeGroupId),
            eq(appGrant.permission, 'deny')
          )
        )
        .limit(1);

      if (groupDenies.length > 0) {
        return {
          allowed: false,
          reason: 'explicit_deny' as PermissionDenialReason,
          matchedGrant: {
            grantId: groupDenies[0].id,
            grantType: 'group',
            source: 'group_deny',
          },
        };
      }
    }

    return null;
  }

  // ==========================================================================
  // User Direct Grant Check (Priority 2)
  // ==========================================================================

  private async checkUserGrant(
    input: PermissionCheckInput
  ): Promise<PermissionCheckOutput | null> {
    const now = new Date();

    // For app:use permission, check if user has direct grant
    if (input.resourceType === 'app' && input.action === 'use' && input.resourceId) {
      const userGrants = await this.db
        .select()
        .from(appGrant)
        .where(
          and(
            eq(appGrant.appId, input.resourceId),
            eq(appGrant.granteeType, 'user'),
            eq(appGrant.granteeId, input.userId),
            eq(appGrant.permission, 'use'),
            or(
              sql`${appGrant.expiresAt} IS NULL`,
              sql`${appGrant.expiresAt} > ${now}`
            )
          )
        )
        .limit(1);

      if (userGrants.length > 0) {
        return {
          allowed: true,
          reason: 'user_grant' as PermissionAllowReason,
          matchedGrant: {
            grantId: userGrants[0].id,
            grantType: 'user',
            source: 'direct_user_grant',
          },
        };
      }
    }

    return null;
  }

  // ==========================================================================
  // Group Grant Check (Priority 3)
  // ==========================================================================

  private async checkGroupGrant(
    input: PermissionCheckInput
  ): Promise<PermissionCheckOutput | null> {
    if (!input.activeGroupId) {
      return null;
    }

    const now = new Date();

    // For app:use permission, check if group has grant
    if (input.resourceType === 'app' && input.action === 'use' && input.resourceId) {
      const groupGrants = await this.db
        .select()
        .from(appGrant)
        .where(
          and(
            eq(appGrant.appId, input.resourceId),
            eq(appGrant.granteeType, 'group'),
            eq(appGrant.granteeId, input.activeGroupId),
            eq(appGrant.permission, 'use')
          )
        )
        .limit(1);

      if (groupGrants.length > 0) {
        return {
          allowed: true,
          reason: 'group_grant' as PermissionAllowReason,
          matchedGrant: {
            grantId: groupGrants[0].id,
            grantType: 'group',
            source: 'group_membership',
          },
        };
      }
    }

    return null;
  }

  // ==========================================================================
  // RBAC Role Permission Check (Priority 4)
  // ==========================================================================

  private async checkRolePermission(
    input: PermissionCheckInput
  ): Promise<PermissionCheckOutput | null> {
    const now = new Date();

    // Get user's roles in this tenant
    const userRoles = await this.db
      .select({
        roleId: rbacUserRole.roleId,
        roleName: rbacRole.name,
      })
      .from(rbacUserRole)
      .innerJoin(rbacRole, eq(rbacUserRole.roleId, rbacRole.id))
      .where(
        and(
          eq(rbacUserRole.userId, input.userId),
          eq(rbacUserRole.tenantId, input.tenantId),
          eq(rbacRole.isActive, true),
          or(
            sql`${rbacUserRole.expiresAt} IS NULL`,
            sql`${rbacUserRole.expiresAt} > ${now}`
          )
        )
      );

    if (userRoles.length === 0) {
      return null;
    }

    // Build permission code
    const permissionCode = `${input.resourceType}:${input.action}`;

    // Check if any role has this permission
    const roleIds = userRoles.map((r) => r.roleId);

    const permissions = await this.db
      .select({ code: permission.code })
      .from(rolePermission)
      .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
      .where(
        and(
          sql`${rolePermission.roleId} = ANY(${roleIds})`,
          eq(permission.code, permissionCode),
          eq(permission.isActive, true)
        )
      )
      .limit(1);

    if (permissions.length > 0) {
      return {
        allowed: true,
        reason: 'role_permission' as PermissionAllowReason,
      };
    }

    return null;
  }

  // ==========================================================================
  // Manager Role Check (via GroupMember.role='manager')
  // ==========================================================================

  async isGroupManager(userId: string, groupId: string): Promise<boolean> {
    const membership = await this.db
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

    return membership.length > 0;
  }

  // ==========================================================================
  // Batch Permission Check
  // ==========================================================================

  async checkBatch(
    userId: string,
    tenantId: string,
    activeGroupId: string | null,
    checks: Array<{ resourceType: string; action: string; resourceId?: string }>
  ): Promise<Array<{ allowed: boolean; reason: string }>> {
    const results: Array<{ allowed: boolean; reason: string }> = [];

    for (const check of checks) {
      const result = await this.checkPermission({
        userId,
        tenantId,
        activeGroupId,
        resourceType: check.resourceType,
        action: check.action,
        resourceId: check.resourceId,
      });
      results.push({ allowed: result.allowed, reason: result.reason });
    }

    return results;
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  async invalidateCache(userId: string, tenantId: string): Promise<void> {
    const cacheKey = `perm:${userId}:${tenantId}`;

    // Clear local cache
    this.cache.delete(cacheKey);

    // Clear Redis cache
    if (this.redis) {
      await this.redis.del(cacheKey);

      // Publish cache invalidation event
      await this.redis.publish('permission:invalidate', JSON.stringify({ userId, tenantId }));
    }
  }

  async getUserPermissions(userId: string, tenantId: string): Promise<Set<string>> {
    const cacheKey = `perm:${userId}:${tenantId}`;

    // Check Redis cache first
    if (this.redis) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const data = JSON.parse(cached) as PermissionCacheEntry;
        if (new Date(data.expiresAt) > new Date()) {
          return new Set(data.permissions || []);
        }
      }
    }

    // Check local cache
    const localCached = this.cache.get(cacheKey);
    if (localCached && new Date(localCached.expiresAt) > new Date()) {
      return new Set(localCached.permissions || []);
    }

    // Build permission set from roles
    const now = new Date();
    const userRoles = await this.db
      .select({ roleId: rbacUserRole.roleId })
      .from(rbacUserRole)
      .where(
        and(
          eq(rbacUserRole.userId, userId),
          eq(rbacUserRole.tenantId, tenantId),
          or(
            sql`${rbacUserRole.expiresAt} IS NULL`,
            sql`${rbacUserRole.expiresAt} > ${now}`
          )
        )
      );

    const roleIds = userRoles.map((r) => r.roleId);

    const permissions = await this.db
      .select({ code: permission.code })
      .from(rolePermission)
      .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
      .where(
        and(
          sql`${rolePermission.roleId} = ANY(${roleIds})`,
          eq(permission.isActive, true)
        )
      );

    const permissionSet = new Set(permissions.map((p) => p.code));

    // Cache the result
    const cacheEntry: PermissionCacheEntry = {
      userId,
      tenantId,
      roles: userRoles.map((r) => ({ id: r.roleId, name: '', expiresAt: null })),
      groupGrants: [],
      userGrants: [],
      denies: [],
      permissions: Array.from(permissionSet),
      expiresAt: new Date(Date.now() + this.CACHE_TTL),
    } as PermissionCacheEntry & { permissions: string[] };

    this.cache.set(cacheKey, cacheEntry);

    if (this.redis) {
      await this.redis.set(
        cacheKey,
        JSON.stringify(cacheEntry),
        this.CACHE_TTL
      );
    }

    return permissionSet;
  }

  // ==========================================================================
  // Role Check
  // ==========================================================================

  async hasRole(userId: string, tenantId: string, roleName: string): Promise<boolean> {
    const now = new Date();

    const result = await this.db
      .select({ id: rbacRole.id })
      .from(rbacUserRole)
      .innerJoin(rbacRole, eq(rbacUserRole.roleId, rbacRole.id))
      .where(
        and(
          eq(rbacUserRole.userId, userId),
          eq(rbacUserRole.tenantId, tenantId),
          eq(rbacRole.name, roleName),
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

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private logPerformance(traceId: string, operation: string, duration: number): void {
    if (duration > 50) {
      console.warn(`[PERF] ${traceId} ${operation} took ${duration}ms (> 50ms target)`);
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createPermissionService(
  db: PostgresJsDatabase,
  redis?: PermissionService['redis']
): PermissionService {
  return new PermissionService(db, redis);
}
