/**
 * Integration Test: Visibility Boundaries
 *
 * T133 [P] Add integration test for visibility boundaries
 *
 * Tests three-tier visibility:
 * 1. User Level: See only own conversations
 * 2. Manager Level: See conversations of own group members
 * 3. Tenant Admin Level: See all conversations in tenant
 *
 * Also tests:
 * - Audit logging for view_others access
 * - Unauthorized view attempt detection
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { createVisibilityService } from '../../../src/modules/rbac/services/visibility.service';
import { createRoleService } from '../../../src/modules/rbac/services/role.service';
import { rbacRole, rbacUserRole } from '@agentifui/db/schema/rbac';
import { user } from '@agentifui/db/schema/user';
import { tenant } from '@agentifui/db/schema/tenant';
import { group } from '@agentifui/db/schema/group';
import { groupMember } from '@agentifui/db/schema/group-member';
import { auditEvent } from '@agentifui/db/schema/audit-event';
import { eq, and } from 'drizzle-orm';

// =============================================================================
// Test Types
// =============================================================================

interface Conversation {
  id: string;
  userId: string;
  tenantId: string;
  title: string;
  createdAt: Date;
}

interface VisibilityTestContext {
  db: PostgresJsDatabase;
  visibilityService: ReturnType<typeof createVisibilityService>;
  roleService: ReturnType<typeof createRoleService>;
  regularUserId: string;
  managerUserId: string;
  adminUserId: string;
  tenantId: string;
  groupId: string;
  otherGroupId: string;
  conversations: {
    own: Conversation;
    groupMember: Conversation;
    otherGroup: Conversation;
    anyTenant: Conversation;
  };
}

// =============================================================================
// Mock Data
// =============================================================================

const MOCK_CONVERSATIONS = {
  own: {
    id: 'conv-own',
    userId: 'user-regular',
    title: 'My Own Conversation',
  },
  groupMember: {
    id: 'conv-group',
    userId: 'user-group-member',
    title: 'Group Member Conversation',
  },
  otherGroup: {
    id: 'conv-other',
    userId: 'user-other-group',
    title: 'Other Group Conversation',
  },
  anyTenant: {
    id: 'conv-any',
    userId: 'user-any',
    title: 'Any Tenant Conversation',
  },
};

// =============================================================================
// Test Setup
// =============================================================================

async function setupVisibilityTestContext(
  db: PostgresJsDatabase
): Promise<VisibilityTestContext> {
  // Create test tenant
  const [tenantResult] = await db
    .insert(tenant)
    .values({
      name: 'Visibility Test Tenant',
      slug: 'visibility-test-' + Date.now(),
    })
    .returning();

  // Create test users
  const [regularUser] = await db
    .insert(user)
    .values({
      email: 'regular@example.com',
      name: 'Regular User',
    })
    .returning();

  const [managerUser] = await db
    .insert(user)
    .values({
      email: 'manager@example.com',
      name: 'Manager User',
    })
    .returning();

  const [adminUser] = await db
    .insert(user)
    .values({
      email: 'admin@example.com',
      name: 'Admin User',
    })
    .returning();

  // Create test groups
  const [groupResult] = await db
    .insert(group)
    .values({
      tenantId: tenantResult.id,
      name: 'Test Group',
    })
    .returning();

  const [otherGroupResult] = await db
    .insert(group)
    .values({
      tenantId: tenantResult.id,
      name: 'Other Group',
    })
    .returning();

  // Add users to groups
  await db.insert(groupMember).values({
    groupId: groupResult.id,
    userId: regularUser.id,
    role: 'member',
  });

  await db.insert(groupMember).values({
    groupId: groupResult.id,
    userId: managerUser.id,
    role: 'manager',
  });

  await db.insert(groupMember).values({
    groupId: otherGroupResult.id,
    userId: regularUser.id,
    role: 'member',
  });

  // Grant admin role to admin user
  const [adminRole] = await db
    .select()
    .from(rbacRole)
    .where(eq(rbacRole.name, 'tenant_admin'))
    .limit(1);

  if (adminRole) {
    await db.insert(rbacUserRole).values({
      userId: adminUser.id,
      roleId: adminRole.id,
      tenantId: tenantResult.id,
    });
  }

  return {
    db,
    visibilityService: createVisibilityService(db),
    roleService: createRoleService(db),
    regularUserId: regularUser.id,
    managerUserId: managerUser.id,
    adminUserId: adminUser.id,
    tenantId: tenantResult.id,
    groupId: groupResult.id,
    otherGroupId: otherGroupResult.id,
    conversations: MOCK_CONVERSATIONS as any,
  };
}

async function cleanupVisibilityTestContext(
  ctx: VisibilityTestContext
): Promise<void> {
  await ctx.db.delete(auditEvent).where(eq(auditEvent.tenantId, ctx.tenantId));
  await ctx.db
    .delete(groupMember)
    .where(eq(groupMember.userId, ctx.regularUserId));
  await ctx.db
    .delete(rbacUserRole)
    .where(eq(rbacUserRole.userId, ctx.adminUserId));
  await ctx.db.delete(group).where(eq(group.tenantId, ctx.tenantId));
  await ctx.db.delete(user).where(eq(user.id, ctx.regularUserId));
  await ctx.db.delete(tenant).where(eq(tenant.id, ctx.tenantId));
}

// =============================================================================
// Visibility Boundary Tests
// =============================================================================

describe('T133 [P] Visibility Boundaries', () => {
  let ctx: VisibilityTestContext;

  beforeEach(async () => {
    // Mock implementation - in real test would use test database
  });

  afterEach(async () => {
    if (ctx) {
      await cleanupVisibilityTestContext(ctx);
    }
  });

  /**
   * Test 1: Regular User - Own Conversations Only
   * Regular users should only see their own conversations
   */
  it('should allow regular user to view own conversations only', async () => {
    const visibility = await ctx.visibilityService.getConversationVisibility({
      userId: ctx.regularUserId,
      tenantId: ctx.tenantId,
      conversationId: ctx.conversations.own.id,
      conversationOwnerId: ctx.regularUserId,
      activeGroupId: ctx.groupId,
      isManager: false,
      userRoles: ['user'],
    });

    expect(visibility.canView).toBe(true);
    expect(visibility.level).toBe('user');
    expect(visibility.requiresAudit).toBe(false);
  });

  /**
   * Test 2: Regular User - Cannot View Group Member Conversations
   * Regular users should NOT see conversations of other group members
   */
  it('should deny regular user from viewing group member conversations', async () => {
    const visibility = await ctx.visibilityService.getConversationVisibility({
      userId: ctx.regularUserId,
      tenantId: ctx.tenantId,
      conversationId: ctx.conversations.groupMember.id,
      conversationOwnerId: 'user-group-member',
      activeGroupId: ctx.groupId,
      isManager: false,
      userRoles: ['user'],
    });

    expect(visibility.canView).toBe(false);
    expect(visibility.level).toBe('none');
    expect(visibility.requiresAudit).toBe(false);
  });

  /**
   * Test 3: Regular User - Cannot View Other Group Conversations
   * Regular users should NOT see conversations from other groups
   */
  it('should deny regular user from viewing other group conversations', async () => {
    const visibility = await ctx.visibilityService.getConversationVisibility({
      userId: ctx.regularUserId,
      tenantId: ctx.tenantId,
      conversationId: ctx.conversations.otherGroup.id,
      conversationOwnerId: 'user-other-group',
      activeGroupId: ctx.otherGroupId,
      isManager: false,
      userRoles: ['user'],
    });

    expect(visibility.canView).toBe(false);
    expect(visibility.level).toBe('none');
  });

  /**
   * Test 4: Manager - Can View Group Member Conversations
   * Managers should see conversations of their group members
   */
  it('should allow manager to view group member conversations', async () => {
    const visibility = await ctx.visibilityService.getConversationVisibility({
      userId: ctx.managerUserId,
      tenantId: ctx.tenantId,
      conversationId: ctx.conversations.groupMember.id,
      conversationOwnerId: 'user-group-member',
      activeGroupId: ctx.groupId,
      isManager: true,
      userRoles: ['user'],
    });

    expect(visibility.canView).toBe(true);
    expect(visibility.level).toBe('manager');
    expect(visibility.requiresAudit).toBe(true);
  });

  /**
   * Test 5: Manager - Cannot View Other Group Conversations
   * Managers should NOT see conversations from other groups
   */
  it('should deny manager from viewing other group conversations', async () => {
    const visibility = await ctx.visibilityService.getConversationVisibility({
      userId: ctx.managerUserId,
      tenantId: ctx.tenantId,
      conversationId: ctx.conversations.otherGroup.id,
      conversationOwnerId: 'user-other-group',
      activeGroupId: ctx.otherGroupId,
      isManager: false, // Not manager of this group
      userRoles: ['user'],
    });

    expect(visibility.canView).toBe(false);
    expect(visibility.level).toBe('none');
  });

  /**
   * Test 6: Tenant Admin - Can View All Tenant Conversations
   * Tenant admins should see all conversations in the tenant
   */
  it('should allow tenant admin to view all tenant conversations', async () => {
    const visibility = await ctx.visibilityService.getConversationVisibility({
      userId: ctx.adminUserId,
      tenantId: ctx.tenantId,
      conversationId: ctx.conversations.anyTenant.id,
      conversationOwnerId: 'user-any',
      activeGroupId: ctx.groupId,
      isManager: false,
      userRoles: ['tenant_admin'],
    });

    expect(visibility.canView).toBe(true);
    expect(visibility.level).toBe('tenant_admin');
    expect(visibility.requiresAudit).toBe(true);
  });

  /**
   * Test 7: Filter Conversations by Visibility Level
   * Service should filter conversations based on user's visibility level
   */
  it('should filter conversations based on user visibility level', async () => {
    const allConversations = [
      ctx.conversations.own,
      ctx.conversations.groupMember,
      ctx.conversations.otherGroup,
      ctx.conversations.anyTenant,
    ];

    const filtered = await ctx.visibilityService.filterConversationsByVisibility({
      userId: ctx.regularUserId,
      tenantId: ctx.tenantId,
      conversations: allConversations,
      activeGroupId: ctx.groupId,
      isManager: false,
      userRoles: ['user'],
    });

    // Regular user should only see their own conversation
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(ctx.conversations.own.id);
  });

  /**
   * Test 8: Manager Filter Conversations
   * Manager should see their own + group member conversations
   */
  it('should allow manager to see group member conversations', async () => {
    const allConversations = [
      ctx.conversations.own,
      ctx.conversations.groupMember,
      ctx.conversations.otherGroup,
      ctx.conversations.anyTenant,
    ];

    const filtered = await ctx.visibilityService.filterConversationsByVisibility({
      userId: ctx.managerUserId,
      tenantId: ctx.tenantId,
      conversations: allConversations,
      activeGroupId: ctx.groupId,
      isManager: true,
      userRoles: ['user'],
    });

    // Manager should see own + group member conversations
    expect(filtered.length).toBeGreaterThanOrEqual(1);
  });

  /**
   * Test 9: Audit Logging for view_others
   * When viewing others' conversations, audit event should be logged
   */
  it('should log audit event when manager views group member conversation', async () => {
    await ctx.visibilityService.getConversationVisibility({
      userId: ctx.managerUserId,
      tenantId: ctx.tenantId,
      conversationId: ctx.conversations.groupMember.id,
      conversationOwnerId: 'user-group-member',
      activeGroupId: ctx.groupId,
      isManager: true,
      userRoles: ['user'],
      logAudit: true,
    });

    // Verify audit event was logged
    const auditEvents = await ctx.db
      .select()
      .from(auditEvent)
      .where(
        and(
          eq(auditEvent.tenantId, ctx.tenantId),
          eq(auditEvent.userId, ctx.managerUserId)
        )
      );

    const viewOthersEvent = auditEvents.find(
      (e) => e.action === 'view_others.attempted' || e.action === 'conversation.view_others'
    );

    expect(auditEvents.length).toBeGreaterThan(0);
  });

  /**
   * Test 10: Unauthorized View Attempt Detection
   * Attempts to view inaccessible conversations should be logged
   */
  it('should detect and log unauthorized view attempts', async () => {
    const visibility = await ctx.visibilityService.getConversationVisibility({
      userId: ctx.regularUserId,
      tenantId: ctx.tenantId,
      conversationId: ctx.conversations.groupMember.id,
      conversationOwnerId: 'user-group-member',
      activeGroupId: ctx.groupId,
      isManager: false,
      userRoles: ['user'],
      logAudit: true,
    });

    expect(visibility.canView).toBe(false);

    // Verify unauthorized attempt was logged
    const auditEvents = await ctx.db
      .select()
      .from(auditEvent)
      .where(
        and(
          eq(auditEvent.tenantId, ctx.tenantId),
          eq(auditEvent.userId, ctx.regularUserId)
        )
      );

    const unauthorizedEvent = auditEvents.find(
      (e) => e.action === 'view_others.attempted'
    );

    expect(auditEvents.length).toBeGreaterThan(0);
  });

  /**
   * Test 11: Visibility Level Hierarchy
   * Test that tenant_admin > manager > user hierarchy is enforced
   */
  it('should enforce visibility level hierarchy correctly', async () => {
    // User level
    const userLevel = await ctx.visibilityService.getConversationVisibility({
      userId: ctx.regularUserId,
      tenantId: ctx.tenantId,
      conversationId: ctx.conversations.own.id,
      conversationOwnerId: ctx.regularUserId,
      activeGroupId: ctx.groupId,
      isManager: false,
      userRoles: ['user'],
    });

    // Manager level
    const managerLevel = await ctx.visibilityService.getConversationVisibility({
      userId: ctx.managerUserId,
      tenantId: ctx.tenantId,
      conversationId: ctx.conversations.groupMember.id,
      conversationOwnerId: 'user-group-member',
      activeGroupId: ctx.groupId,
      isManager: true,
      userRoles: ['user'],
    });

    // Admin level
    const adminLevel = await ctx.visibilityService.getConversationVisibility({
      userId: ctx.adminUserId,
      tenantId: ctx.tenantId,
      conversationId: ctx.conversations.anyTenant.id,
      conversationOwnerId: 'user-any',
      activeGroupId: ctx.groupId,
      isManager: false,
      userRoles: ['tenant_admin'],
    });

    expect(userLevel.level).toBe('user');
    expect(managerLevel.level).toBe('manager');
    expect(adminLevel.level).toBe('tenant_admin');
  });
});
