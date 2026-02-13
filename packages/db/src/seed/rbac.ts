/**
 * RBAC Seed Data
 *
 * Seed data for RBAC Authorization Model (S1-2)
 * - Predefined roles: root_admin, tenant_admin, user
 * - Predefined permissions: tenant, group, app, conversation categories
 * - Role-Permission associations
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import {
  rbacRole,
  permission,
  rolePermission,
  app,
} from '../schema/rbac.js';
import { user } from '../schema/user.js';
import { tenant } from '../schema/tenant.js';

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
      status: 'active',
    },
    {
      tenantId: tenants[0].id,
      name: 'Data Analytics Assistant',
      status: 'active',
    },
  ] as const;

  for (const app of sampleApps) {
    await db
      .insert(app)
      .values(app)
      .onConflictDoNothing();
  }

  console.log(`✓ Seeded ${sampleApps.length} sample apps`);
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

  console.log('\n========================================');
  console.log('RBAC seeding completed!');
  console.log('========================================\n');
}
