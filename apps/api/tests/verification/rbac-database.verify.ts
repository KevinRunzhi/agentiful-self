/**
 * RBAC Database Verification
 *
 * T126 [P] Verify all RBAC tables are created correctly
 * T127 [P] Verify pre-defined roles and permissions are populated
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  rbacRole,
  permission,
  rolePermission,
  rbacUserRole,
  app,
  appGrant,
} from '../../schema/rbac.js';
import { user } from '../../schema/user.js';
import { tenant } from '../../schema/tenant.js';
import { group } from '../../schema/group.js';

// =============================================================================
// Verification Types
// =============================================================================

export interface TableVerificationResult {
  tableName: string;
  exists: boolean;
  columnCount: number;
  indexes: string[];
  error?: string;
}

export interface SeedVerificationResult {
  category: 'roles' | 'permissions' | 'rolePermissions' | 'sampleApps';
  expected: number;
  actual: number;
  status: 'pass' | 'fail';
  missing?: string[];
}

export interface VerificationReport {
  tables: TableVerificationResult[];
  seeds: SeedVerificationResult[];
  overallStatus: 'pass' | 'fail';
  timestamp: string;
}

// =============================================================================
// Table Verification (T126)
// =============================================================================

/**
 * T126 [P] Run database migration and verify all RBAC tables created correctly
 */
export async function verifyRbacTables(
  db: PostgresJsDatabase
): Promise<TableVerificationResult[]> {
  const results: TableVerificationResult[] = [];

  const tables = [
    { name: 'rbac_role', schema: rbacRole },
    { name: 'permission', schema: permission },
    { name: 'role_permission', schema: rolePermission },
    { name: 'rbac_user_role', schema: rbacUserRole },
    { name: 'app', schema: app },
    { name: 'app_grant', schema: appGrant },
  ];

  for (const table of tables) {
    try {
      // Check if table exists by attempting a simple query
      const result = await db.execute(`SELECT COUNT(*) FROM ${table.name}`);

      // Get column info
      const columns = await db.execute(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = '${table.name}'
      `);

      // Get index info
      const indexes = await db.execute(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = '${table.name}'
      `);

      results.push({
        tableName: table.name,
        exists: true,
        columnCount: columns.rows?.length || 0,
        indexes: (indexes.rows as { indexname: string }[]).map((r) => r.indexname),
      });
    } catch (error) {
      results.push({
        tableName: table.name,
        exists: false,
        columnCount: 0,
        indexes: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Verify foreign key relationships
 */
export async function verifyForeignKeys(
  db: PostgresJsDatabase
): Promise<{ table: string; hasForeignKeys: boolean; error?: string }[]> {
  const tablesWithForeignKeys = [
    'rbac_user_role',
    'role_permission',
    'app_grant',
    'app',
  ];

  const results = [];

  for (const tableName of tablesWithForeignKeys) {
    try {
      const result = await db.execute(`
        SELECT COUNT(*) as fk_count
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = '${tableName}'
        AND tc.constraint_type = 'FOREIGN KEY'
      `);

      const count = Number((result.rows[0] as { fk_count: string })?.fk_count || 0);

      results.push({
        table: tableName,
        hasForeignKeys: count > 0,
      });
    } catch (error) {
      results.push({
        table: tableName,
        hasForeignKeys: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

// =============================================================================
// Seed Data Verification (T127)
// =============================================================================

/**
 * T127 [P] Execute seed data and verify pre-defined roles and permissions populated
 */
export async function verifyRolesSeed(
  db: PostgresJsDatabase
): Promise<SeedVerificationResult> {
  const expectedRoles = ['root_admin', 'tenant_admin', 'user'];

  const roles = await db.select({ name: rbacRole.name }).from(rbacRole);
  const actualNames = roles.map((r) => r.name);

  const missing = expectedRoles.filter((name) => !actualNames.includes(name));

  return {
    category: 'roles',
    expected: expectedRoles.length,
    actual: roles.length,
    status: missing.length === 0 ? 'pass' : 'fail',
    missing: missing.length > 0 ? missing : undefined,
  };
}

export async function verifyPermissionsSeed(
  db: PostgresJsDatabase
): Promise<SeedVerificationResult> {
  const expectedPermissions = [
    'tenant:manage',
    'tenant:view_audit',
    'group:create',
    'group:manage',
    'app:register',
    'app:grant',
    'app:use',
    'conversation:view_others',
    'conversation:export',
  ];

  const permissions = await db.select({ code: permission.code }).from(permission);
  const actualCodes = permissions.map((p) => p.code);

  const missing = expectedPermissions.filter((code) => !actualCodes.includes(code));

  return {
    category: 'permissions',
    expected: expectedPermissions.length,
    actual: permissions.length,
    status: missing.length === 0 ? 'pass' : 'fail',
    missing: missing.length > 0 ? missing : undefined,
  };
}

export async function verifyRolePermissionsSeed(
  db: PostgresJsDatabase
): Promise<SeedVerificationResult> {
  // Check that tenant_admin has all permissions
  const tenantAdminRole = await db.query.rbacRole.findFirst({
    where: (role, { eq }) => eq(rbacRole.name, 'tenant_admin'),
    with: {
      rolePermissions: true,
    },
  });

  if (!tenantAdminRole) {
    return {
      category: 'rolePermissions',
      expected: 9, // All permissions
      actual: 0,
      status: 'fail',
      missing: ['tenant_admin role not found'],
    };
  }

  // All permissions should be assigned to tenant_admin
  const allPermissionsCount = await db.select().from(permission);
  const expectedCount = allPermissionsCount.length;

  return {
    category: 'rolePermissions',
    expected: expectedCount,
    actual: tenantAdminRole.rolePermissions.length,
    status: tenantAdminRole.rolePermissions.length === expectedCount ? 'pass' : 'fail',
  };
}

export async function verifySampleAppsSeed(
  db: PostgresJsDatabase
): Promise<SeedVerificationResult> {
  const apps = await db.select().from(app);

  // This is optional seed data, so we just check if apps exist
  return {
    category: 'sampleApps',
    expected: 0, // No minimum expected
    actual: apps.length,
    status: 'pass', // Always pass since sample apps are optional
  };
}

// =============================================================================
// Comprehensive Verification
// =============================================================================

/**
 * Run full RBAC database verification (T126-T127)
 */
export async function verifyRbacDatabase(
  db: PostgresJsDatabase
): Promise<VerificationReport> {
  const timestamp = new Date().toISOString();

  // Verify tables (T126)
  const tables = await verifyRbacTables(db);
  const foreignKeys = await verifyForeignKeys(db);

  // Verify seed data (T127)
  const roles = await verifyRolesSeed(db);
  const permissions = await verifyPermissionsSeed(db);
  const rolePermissions = await verifyRolePermissionsSeed(db);
  const sampleApps = await verifySampleAppsSeed(db);

  const seeds = [roles, permissions, rolePermissions, sampleApps];

  // Calculate overall status
  const allTablesExist = tables.every((t) => t.exists);
  const allSeedsValid = seeds.every((s) => s.status === 'pass');

  const overallStatus = allTablesExist && allSeedsValid ? 'pass' : 'fail';

  return {
    tables,
    seeds,
    overallStatus,
    timestamp,
  };
}

/**
 * Print verification report to console
 */
export function printVerificationReport(report: VerificationReport): void {
  console.log('\n========================================');
  console.log('RBAC Database Verification Report');
  console.log('========================================');
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Overall Status: ${report.overallStatus === 'pass' ? '✓ PASS' : '✗ FAIL'}`);
  console.log('\n--- Tables (T126) ---');

  for (const table of report.tables) {
    if (table.exists) {
      console.log(`✓ ${table.tableName}: ${table.columnCount} columns, ${table.indexes.length} indexes`);
    } else {
      console.log(`✗ ${table.tableName}: ${table.error || 'Not found'}`);
    }
  }

  console.log('\n--- Seed Data (T127) ---');

  for (const seed of report.seeds) {
    const icon = seed.status === 'pass' ? '✓' : '✗';
    console.log(
      `${icon} ${seed.category}: ${seed.actual}/${seed.expected} records ${
        seed.missing ? `(missing: ${seed.missing.join(', ')})` : ''
      }`
    );
  }

  console.log('========================================\n');
}
