/**
 * Integration Test: Permission Determination Priority Chain
 *
 * T131 [P] Add integration test for permission determination priority chain
 *
 * Tests the complete priority chain:
 * 1. Explicit Deny - Always deny if deny record exists
 * 2. User Direct Grant - User-level grant with permission='use'
 * 3. Group Grant / Manager User-Level Grant - Group-based authorization
 * 4. RBAC Role Permission - Permission granted through role assignment
 * 5. Default Deny - If no other rules match, access is denied
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { createPermissionService } from '../../../src/modules/rbac/services/permission.service';
import { createGrantService } from '../../../src/modules/rbac/services/grant.service';
import {
  rbacRole,
  permission,
  rolePermission,
  rbacUserRole,
  app,
  appGrant,
} from '@agentifui/db/schema/rbac';
import { user } from '@agentifui/db/schema/user';
import { tenant } from '@agentifui/db/schema/tenant';
import { group } from '@agentifui/db/schema/group';
import { groupMember } from '@agentifui/db/schema/group-member';
import { eq, and } from 'drizzle-orm';

// =============================================================================
// Test Fixtures
// =============================================================================

interface TestContext {
  db: PostgresJsDatabase;
  permissionService: ReturnType<typeof createPermissionService>;
  grantService: ReturnType<typeof createGrantService>;
  userId: string;
  tenantId: string;
  appId: string;
  groupId: string;
}

async function setupTestContext(db: PostgresJsDatabase): Promise<TestContext> {
  // Create test tenant
  const [tenantResult] = await db
    .insert(tenant)
    .values({
      name: 'Test Tenant',
      slug: 'test-tenant-' + Date.now(),
    })
    .returning();

  // Create test user
  const [userResult] = await db
    .insert(user)
    .values({
      email: 'test@example.com',
      name: 'Test User',
    })
    .returning();

  // Create test app
  const [appResult] = await db
    .insert(app)
    .values({
      tenantId: tenantResult.id,
      name: 'Test App',
      status: 'active',
    })
    .returning();

  // Create test group
  const [groupResult] = await db
    .insert(group)
    .values({
      tenantId: tenantResult.id,
      name: 'Test Group',
    })
    .returning();

  // Add user to group
  await db.insert(groupMember).values({
    groupId: groupResult.id,
    userId: userResult.id,
    role: 'member',
  });

  return {
    db,
    permissionService: createPermissionService(db),
    grantService: createGrantService(db),
    userId: userResult.id,
    tenantId: tenantResult.id,
    appId: appResult.id,
    groupId: groupResult.id,
  };
}

async function cleanupTestContext(ctx: TestContext): Promise<void> {
  // Cleanup in correct order due to foreign keys
  await ctx.db.delete(groupMember).where(eq(groupMember.userId, ctx.userId));
  await ctx.db.delete(appGrant).where(eq(appGrant.appId, ctx.appId));
  await ctx.db.delete(rbacUserRole).where(eq(rbacUserRole.userId, ctx.userId));
  await ctx.db.delete(app).where(eq(app.id, ctx.appId));
  await ctx.db.delete(group).where(eq(group.id, ctx.groupId));
  await ctx.db.delete(user).where(eq(user.id, ctx.userId));
  await ctx.db.delete(tenant).where(eq(tenant.id, ctx.tenantId));
}

// =============================================================================
// Priority Chain Tests
// =============================================================================

describe('T131 [P] Permission Determination Priority Chain', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    // Mock implementation - in real test would use test database
  });

  afterEach(async () => {
    if (ctx) {
      await cleanupTestContext(ctx);
    }
  });

  /**
   * Test 1: Default Deny (Priority 5)
   * When no permissions exist, access should be denied by default
   */
  it('should deny access by default (Priority 5)', async () => {
    const result = await ctx.permissionService.checkPermission({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      resourceType: 'app',
      action: 'use',
      resourceId: ctx.appId,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('default_deny');
  });

  /**
   * Test 2: RBAC Role Permission (Priority 4)
   * User with role permission should be allowed
   */
  it('should allow access via RBAC role permission (Priority 4)', async () => {
    // Grant user role
    const [userRole] = await ctx.db
      .select()
      .from(rbacRole)
      .where(eq(rbacRole.name, 'user'))
      .limit(1);

    if (userRole) {
      await ctx.db.insert(rbacUserRole).values({
        userId: ctx.userId,
        roleId: userRole.id,
        tenantId: ctx.tenantId,
      });
    }

    const result = await ctx.permissionService.checkPermission({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      resourceType: 'app',
      action: 'use',
      resourceId: ctx.appId,
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('role_permission');
  });

  /**
   * Test 3: Group Grant (Priority 3)
   * Group grant should provide access
   */
  it('should allow access via group grant (Priority 3)', async () => {
    // Create group grant
    await ctx.db.insert(appGrant).values({
      appId: ctx.appId,
      granteeType: 'group',
      granteeId: ctx.groupId,
      permission: 'use',
    });

    const result = await ctx.permissionService.checkPermission({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      resourceType: 'app',
      action: 'use',
      resourceId: ctx.appId,
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('group_grant');
  });

  /**
   * Test 4: User Direct Grant (Priority 2)
   * User direct grant should provide access
   */
  it('should allow access via user direct grant (Priority 2)', async () => {
    // Create user direct grant
    await ctx.db.insert(appGrant).values({
      appId: ctx.appId,
      granteeType: 'user',
      granteeId: ctx.userId,
      permission: 'use',
      reason: 'Test user grant',
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    });

    const result = await ctx.permissionService.checkPermission({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      resourceType: 'app',
      action: 'use',
      resourceId: ctx.appId,
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('user_grant');
  });

  /**
   * Test 5: Explicit Deny (Priority 1)
   * Explicit deny should always override allow permissions
   */
  it('should deny access via explicit deny (Priority 1 - highest priority)', async () => {
    // First, grant role permission
    const [userRole] = await ctx.db
      .select()
      .from(rbacRole)
      .where(eq(rbacRole.name, 'tenant_admin'))
      .limit(1);

    if (userRole) {
      await ctx.db.insert(rbacUserRole).values({
        userId: ctx.userId,
        roleId: userRole.id,
        tenantId: ctx.tenantId,
      });
    }

    // Create explicit deny
    await ctx.db.insert(appGrant).values({
      appId: ctx.appId,
      granteeType: 'user',
      granteeId: ctx.userId,
      permission: 'deny',
      reason: 'Test explicit deny',
    });

    const result = await ctx.permissionService.checkPermission({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      resourceType: 'app',
      action: 'use',
      resourceId: ctx.appId,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('explicit_deny');
  });

  /**
   * Test 6: Priority Chain Override
   * User grant should override group grant
   */
  it('should prioritize user grant over group grant', async () => {
    // Create group grant
    await ctx.db.insert(appGrant).values({
      appId: ctx.appId,
      granteeType: 'group',
      granteeId: ctx.groupId,
      permission: 'use',
    });

    // Create user grant
    await ctx.db.insert(appGrant).values({
      appId: ctx.appId,
      granteeType: 'user',
      granteeId: ctx.userId,
      permission: 'use',
      reason: 'User grant takes priority',
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    });

    const result = await ctx.permissionService.checkPermission({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      resourceType: 'app',
      action: 'use',
      resourceId: ctx.appId,
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('user_grant');
  });

  /**
   * Test 7: Expired User Grant
   * Expired user grant should not grant access
   */
  it('should not allow access via expired user grant', async () => {
    // Create expired user grant
    await ctx.db.insert(appGrant).values({
      appId: ctx.appId,
      granteeType: 'user',
      granteeId: ctx.userId,
      permission: 'use',
      reason: 'Expired test grant',
      expiresAt: new Date(Date.now() - 1000), // Expired
    });

    const result = await ctx.permissionService.checkPermission({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      resourceType: 'app',
      action: 'use',
      resourceId: ctx.appId,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('default_deny'); // No valid permissions
  });

  /**
   * Test 8: Manager Role in Group
   * Manager should have elevated permissions via group
   */
  it('should grant elevated permissions to group manager', async () => {
    // Update user to be group manager
    await ctx.db
      .update(groupMember)
      .set({ role: 'manager' })
      .where(
        and(
          eq(groupMember.userId, ctx.userId),
          eq(groupMember.groupId, ctx.groupId)
        )
      );

    const result = await ctx.permissionService.checkPermission({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      resourceType: 'app',
      action: 'use',
      resourceId: ctx.appId,
      isManagerCheck: true,
    });

    expect(result.allowed).toBe(true);
  });
});
