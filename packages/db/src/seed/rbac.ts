/**
 * RBAC Seed Data
 *
 * Seed data for RBAC Authorization Model (S1-2)
 * - Predefined roles: root_admin, tenant_admin, user
 * - Predefined permissions: tenant, group, app, conversation categories
 * - Role-Permission associations
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, eq } from 'drizzle-orm';
import {
  rbacRole,
  permission,
  rolePermission,
  app,
  appGrant,
} from '../schema/rbac.js';
import { user } from '../schema/user.js';
import { tenant } from '../schema/tenant.js';
import { group } from '../schema/group.js';
import { quotaPolicy } from '../schema/quota.js';

// =============================================================================
// Role Seed Data
// =============================================================================

export const ROLES = [
  {
    name: 'root_admin',
    displayName: 'ROOT ADMIN',
    description: 'Platform super administrator with cross-tenant access',
    isSystem: true,
    isActive: false, // Default disabled, requires ENABLE_ROOT_ADMIN=true
  },
  {
    name: 'tenant_admin',
    displayName: 'Tenant Admin',
    description: 'Tenant administrator with full tenant-scoped permissions',
    isSystem: true,
    isActive: true,
  },
  {
    name: 'user',
    displayName: 'User',
    description: 'Regular user with basic permissions',
    isSystem: true,
    isActive: true,
  },
] as const;

export async function seedRoles(db: PostgresJsDatabase) {
  console.log('Seeding RBAC roles...');

  for (const role of ROLES) {
    await db
      .insert(rbacRole)
      .values(role)
      .onConflictDoNothing({ target: rbacRole.name });
  }

  console.log(`✓ Seeded ${ROLES.length} roles`);
}

// =============================================================================
// Permission Seed Data
// =============================================================================

export const PERMISSIONS = [
  // Tenant permissions
  { code: 'tenant:manage', name: 'Manage tenant settings', category: 'tenant' },
  { code: 'tenant:view_audit', name: 'View audit logs', category: 'tenant' },

  // Group permissions
  { code: 'group:create', name: 'Create groups', category: 'group' },
  { code: 'group:manage', name: 'Manage group members', category: 'group' },

  // App permissions
  { code: 'app:register', name: 'Register applications', category: 'app' },
  { code: 'app:grant', name: 'Grant application access', category: 'app' },
  { code: 'app:use', name: 'Use applications', category: 'app' },

  // Conversation permissions
  { code: 'conversation:view_others', name: 'View others conversations', category: 'conversation' },
  { code: 'conversation:export', name: 'Export conversations', category: 'conversation' },
] as const;

export async function seedPermissions(db: PostgresJsDatabase) {
  console.log('Seeding RBAC permissions...');

  for (const perm of PERMISSIONS) {
    await db
      .insert(permission)
      .values(perm)
      .onConflictDoNothing({ target: permission.code });
  }

  console.log(`✓ Seeded ${PERMISSIONS.length} permissions`);
}

// =============================================================================
// Role-Permission Associations
// =============================================================================

export async function seedRolePermissions(db: PostgresJsDatabase) {
  console.log('Seeding role-permission associations...');

  // Get all permissions
  const allPermissions = await db.select().from(permission);

  // Tenant Admin: All permissions
  const tenantAdminRole = await db.query.rbacRole.findFirst({
    where: (role, { eq }) => eq(role.name, 'tenant_admin'),
  });

  if (tenantAdminRole) {
    for (const perm of allPermissions) {
      await db
        .insert(rolePermission)
        .values({
          roleId: tenantAdminRole.id,
          permissionId: perm.id,
        })
        .onConflictDoNothing();
    }
    console.log(`✓ Tenant Admin: ${allPermissions.length} permissions`);
  }

  // User: Only app:use permission
  const userRole = await db.query.rbacRole.findFirst({
    where: (role, { eq }) => eq(role.name, 'user'),
  });

  const appUsePermission = await db.query.permission.findFirst({
    where: (perm, { eq }) => eq(perm.code, 'app:use'),
  });

  if (userRole && appUsePermission) {
    await db
      .insert(rolePermission)
      .values({
        roleId: userRole.id,
        permissionId: appUsePermission.id,
      })
      .onConflictDoNothing();
    console.log(`✓ User: app:use permission`);
  }

  // ROOT ADMIN: All permissions (when enabled)
  const rootAdminRole = await db.query.rbacRole.findFirst({
    where: (role, { eq }) => eq(role.name, 'root_admin'),
  });

  if (rootAdminRole) {
    for (const perm of allPermissions) {
      await db
        .insert(rolePermission)
        .values({
          roleId: rootAdminRole.id,
          permissionId: perm.id,
        })
        .onConflictDoNothing();
    }
    console.log(`✓ ROOT ADMIN: ${allPermissions.length} permissions`);
  }
}

// =============================================================================
// Sample App Data (for testing)
// =============================================================================

export async function seedSampleApps(db: PostgresJsDatabase) {
  console.log('Seeding sample applications...');

  // Get first tenant for sample data
  const tenants = await db.select().from(tenant).limit(1);

  if (tenants.length === 0) {
    console.log('⚠ No tenants found, skipping sample apps');
    return;
  }

  const sampleApps = [
    {
      tenantId: tenants[0].id,
      name: 'Customer Service Bot',
      description: 'Customer support assistant',
      mode: 'chat',
      tags: ['support', 'chatbot'],
      status: 'active',
    },
    {
      tenantId: tenants[0].id,
      name: 'Data Analytics Assistant',
      description: 'Data analysis workflow helper',
      mode: 'workflow',
      tags: ['analytics', 'workflow'],
      status: 'active',
    },
    {
      tenantId: tenants[0].id,
      name: 'Ops Automation Agent',
      description: 'Operations agent for routine tasks',
      mode: 'agent',
      tags: ['ops', 'automation'],
      status: 'active',
    },
    {
      tenantId: tenants[0].id,
      name: 'Executive Summary Generator',
      description: 'Summarize long-form reports',
      mode: 'completion',
      tags: ['summary', 'report'],
      status: 'active',
    },
  ] as const;

  for (const sampleApp of sampleApps) {
    await db
      .insert(app)
      .values(sampleApp)
      .onConflictDoNothing();
  }

  console.log(`✓ Seeded ${sampleApps.length} sample apps`);
}

async function seedSampleAppGrants(db: PostgresJsDatabase) {
  console.log('Seeding sample app grants...');

  const tenants = await db.select().from(tenant).limit(1);
  if (tenants.length === 0) {
    console.log('⚠ No tenants found, skipping app grants');
    return;
  }

  const tenantId = tenants[0].id;
  const defaultGroup = await db
    .select({ id: group.id })
    .from(group)
    .where(eq(group.tenantId, tenantId))
    .limit(1);
  const seedOperator = await db.select({ id: user.id }).from(user).limit(1);
  const apps = await db
    .select({ id: app.id })
    .from(app)
    .where(eq(app.tenantId, tenantId));

  if (defaultGroup.length === 0 || apps.length === 0) {
    console.log('⚠ No default group/apps found, skipping app grants');
    return;
  }

  for (const appRow of apps) {
    const existing = await db
      .select({ id: appGrant.id })
      .from(appGrant)
      .where(
        and(
          eq(appGrant.appId, appRow.id),
          eq(appGrant.granteeType, 'group'),
          eq(appGrant.granteeId, defaultGroup[0].id),
          eq(appGrant.permission, 'use')
        )
      )
      .limit(1);
    if (existing.length > 0) {
      continue;
    }

    await db
      .insert(appGrant)
      .values({
        appId: appRow.id,
        granteeType: 'group',
        granteeId: defaultGroup[0].id,
        permission: 'use',
        grantedBy: seedOperator[0]?.id ?? null,
      });
  }

  console.log(`✓ Seeded ${apps.length} sample app grants`);
}

async function seedDefaultTenantQuota(db: PostgresJsDatabase) {
  console.log('Seeding default tenant quota policy...');

  const tenants = await db.select().from(tenant).limit(1);
  if (tenants.length === 0) {
    console.log('⚠ No tenants found, skipping default quota');
    return;
  }

  await db
    .insert(quotaPolicy)
    .values({
      tenantId: tenants[0].id,
      scopeType: 'tenant',
      scopeId: tenants[0].id,
      metricType: 'token',
      periodType: 'month',
      limitValue: 1_000_000,
      alertThresholds: [80, 90, 100],
      isActive: true,
    })
    .onConflictDoNothing({
      target: [
        quotaPolicy.tenantId,
        quotaPolicy.scopeType,
        quotaPolicy.scopeId,
        quotaPolicy.metricType,
        quotaPolicy.periodType,
      ],
    });

  console.log('✓ Seeded default tenant quota policy');
}

// =============================================================================
// Main Seed Function
// =============================================================================

export async function seedRbac(db: PostgresJsDatabase) {
  console.log('\n========================================');
  console.log('Seeding RBAC Authorization Model (S1-2)');
  console.log('========================================\n');

  await seedRoles(db);
  await seedPermissions(db);
  await seedRolePermissions(db);
  await seedSampleApps(db);
  await seedSampleAppGrants(db);
  await seedDefaultTenantQuota(db);

  console.log('\n========================================');
  console.log('RBAC seeding completed!');
  console.log('========================================\n');
}
