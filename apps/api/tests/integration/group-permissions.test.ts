/**
 * Group Permissions Integration Test
 *
 * Tests that group permissions are properly enforced
 */

import { describe, it, expect, beforeAll } from "vitest";
import { getDatabase } from "@agentifui/db/client";
import { sql } from "drizzle-orm";
import { groupRepository } from "../../repositories/group.repository";
import { groupMemberRepository } from "../../repositories/group-member.repository";
import { groupPermissionService } from "../../services/permission.service";

describe("Group Permissions", () => {
  let tenantId: string;
  let adminUserId: string;
  let managerUserId: string;
  let memberUserId: string;
  let groupId: string;

  beforeAll(async () => {
    const db = getDatabase();

    // Create test tenant
    const [tenant] = await db
      .insert({
        id: crypto.randomUUID(),
        name: "Test Tenant",
        slug: "test-tenant",
        status: "active",
        plan: "basic",
        customConfig: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    tenantId = tenant.id;

    // Create test users
    const [admin] = await db
      .insert({
        id: crypto.randomUUID(),
        email: "admin@test.com",
        name: "Admin User",
        status: "active",
        emailVerified: true,
        createdAt: new Date(),
      })
      .returning();

    adminUserId = admin.id;

    // Create group
    const [group] = await db
      .insert({
        id: crypto.randomUUID(),
        tenantId,
        name: "Test Group",
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    groupId = group.id;
  });

  it("should allow tenant admin to manage any group", async () => {
    const hasPermission = await groupPermissionService.isTenantAdmin(adminUserId, tenantId);
    expect(hasPermission).toBe(true);
  });

  it("should allow manager to manage members in their group", async () => {
    const isManager = await groupPermissionService.isGroupManagerFor(
      managerUserId,
      groupId
    );

    // After adding manager to group
    await groupMemberRepository.create({
      groupId,
      userId: managerUserId,
      role: "manager",
      addedAt: new Date(),
    } as any);

    const canManage = await groupPermissionService.canManageGroup(
      managerUserId,
      groupId,
      tenantId
    );

    expect(canManage.allowed).toBe(true);
  });

  it("should not allow member to manage group", async () => {
    await groupMemberRepository.create({
      groupId,
      userId: memberUserId,
      role: "member",
      addedAt: new Date(),
    } as any);

    const canManage = await groupPermissionService.canManageGroup(
      memberUserId,
      groupId,
      tenantId
    );

    expect(canManage.allowed).toBe(false);
  });

  it("should not allow manager to manage users outside their group", async () => {
    // Create another group
    const otherGroup = await groupRepository.create({
      tenantId,
      name: "Other Group",
    });

    const canManage = await groupPermissionService.canManageGroup(
      managerUserId,
      otherGroup.id,
      tenantId
    );

    expect(canManage.allowed).toBe(false);
  });
});
