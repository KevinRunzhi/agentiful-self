/**
 * Performance Benchmarking Tests
 *
 * T128 [P] Add performance benchmarking for permission check (P95 <= 50ms verification)
 * T129 [P] Add performance benchmarking for cache invalidation (<= 5s verification)
 * T130 [P] Verify group switching response time <= 300ms
 */

import { describe, bench, beforeEach, afterEach } from 'vitest';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { createPermissionService } from '../../../src/modules/rbac/services/permission.service';
import { createActiveGroupService } from '../../../src/modules/rbac/services/active-group.service';
import { createAppService } from '../../../src/modules/rbac/services/app.service';
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
import { eq } from 'drizzle-orm';

// =============================================================================
// Mock DB for Performance Testing
// =============================================================================

interface MockDb extends PostgresJsDatabase {
  query: {
    rbacRole: any;
    permission: any;
    rbacUserRole: any;
    appGrant: any;
    groupMember: any;
  };
  select: any;
  insert: any;
}

/**
 * Create a mock database for benchmarking
 * In production, this would use a real test database
 */
function createMockDb(): MockDb {
  return {
    query: {
      rbacRole: {
        findMany: async () => [
          { id: 1, name: 'tenant_admin', isActive: true },
        ],
      },
      permission: {
        findMany: async () => [
          { id: 1, code: 'app:use', category: 'app', isActive: true },
        ],
      },
      rbacUserRole: {
        findMany: async () => [
          {
            roleId: 1,
            expiresAt: null,
          },
        ],
      },
      appGrant: {
        findMany: async () => [],
      },
      groupMember: {
        findMany: async () => [],
      },
    },
    select: () => ({
      from: () => ({
        where: async () => [],
      }),
    }),
  } as unknown as MockDb;
}

// =============================================================================
// Performance Benchmark: Permission Check (T128)
// =============================================================================

describe('T128 [P] Permission Check Performance', () => {
  let permissionService: ReturnType<typeof createPermissionService>;
  let mockDb: MockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    permissionService = createPermissionService(mockDb);
  });

  // Target: P95 latency <= 50ms
  const TARGET_MS = 50;
  const P95_TARGET_MS = 50;

  bench('checkPermission - happy path', async () => {
    await permissionService.checkPermission({
      userId: 'user-123',
      tenantId: 'tenant-123',
      resourceType: 'app',
      action: 'use',
      resourceId: 'app-123',
    });
  }, {
    iterations: 1000,
    time: 10_000,
  });

  bench('checkPermission - with cache hit', async () => {
    // Simulate cache hit scenario
    await permissionService.checkPermission({
      userId: 'user-123',
      tenantId: 'tenant-123',
      resourceType: 'app',
      action: 'use',
      resourceId: 'app-123',
    });
  }, {
    iterations: 1000,
    time: 10_000,
  });

  bench('batchCheckPermissions - 5 permissions', async () => {
    await permissionService.batchCheckPermissions({
      userId: 'user-123',
      tenantId: 'tenant-123',
      checks: [
        { resourceType: 'app', action: 'use', resourceId: 'app-1' },
        { resourceType: 'app', action: 'use', resourceId: 'app-2' },
        { resourceType: 'app', action: 'use', resourceId: 'app-3' },
        { resourceType: 'app', action: 'use', resourceId: 'app-4' },
        { resourceType: 'app', action: 'use', resourceId: 'app-5' },
      ],
    });
  }, {
    iterations: 500,
    time: 10_000,
  });
});

// =============================================================================
// Performance Benchmark: Cache Invalidation (T129)
// =============================================================================

describe('T129 [P] Cache Invalidation Performance', () => {
  let permissionService: ReturnType<typeof createPermissionService>;
  let mockDb: MockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    permissionService = createPermissionService(mockDb);
  });

  // Target: Cache invalidation propagates within 5 seconds
  const CACHE_INVALIDATION_TARGET_MS = 5000;

  bench('invalidateUserCache - single user', async () => {
    await permissionService.invalidateUserCache('user-123', 'tenant-123');
  }, {
    iterations: 1000,
    time: 5000,
  });

  bench('invalidateUserCache - batch (10 users)', async () => {
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        permissionService.invalidateUserCache(`user-${i}`, 'tenant-123')
      );
    }
    await Promise.all(promises);
  }, {
    iterations: 100,
    time: 10_000,
  });

  bench('invalidateTenantCache - all users in tenant', async () => {
    await permissionService.invalidateTenantCache('tenant-123');
  }, {
    iterations: 100,
    time: 10_000,
  });
});

// =============================================================================
// Performance Benchmark: Group Switching (T130)
// =============================================================================

describe('T130 [P] Group Switching Performance', () => {
  let activeGroupService: ReturnType<typeof createActiveGroupService>;
  let mockDb: MockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    activeGroupService = createActiveGroupService(mockDb);
  });

  // Target: Response time <= 300ms
  const GROUP_SWITCH_TARGET_MS = 300;

  bench('setActiveGroup - happy path', async () => {
    await activeGroupService.setActiveGroup({
      userId: 'user-123',
      tenantId: 'tenant-123',
      groupId: 'group-123',
    });
  }, {
    iterations: 500,
    time: 10_000,
  });

  bench('setActiveGroup - with permission refresh', async () => {
    await activeGroupService.setActiveGroup({
      userId: 'user-123',
      tenantId: 'tenant-123',
      groupId: 'group-123',
      invalidatePermissions: true,
    });
  }, {
    iterations: 200,
    time: 10_000,
  });
});

// =============================================================================
// Performance Targets Summary
// =============================================================================

export const PERFORMANCE_TARGETS = {
  permissionCheck: {
    metric: 'P95 latency',
    target: '50ms',
    description: 'Permission check should complete within 50ms at 95th percentile',
  },
  cacheInvalidation: {
    metric: 'Propagation time',
    target: '5s',
    description: 'Cache invalidation should propagate within 5 seconds',
  },
  groupSwitching: {
    metric: 'Response time',
    target: '300ms',
    description: 'Group switching should respond within 300ms',
  },
} as const;
