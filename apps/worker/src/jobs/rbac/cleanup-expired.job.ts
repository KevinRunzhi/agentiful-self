/**
 * Cleanup Expired Grants Job
 *
 * BullMQ background job for cleaning up expired RBAC records (T099-T100).
 * Runs periodically to remove expired UserRole and AppGrant records.
 *
 * This job should be scheduled to run daily (e.g., at 2 AM).
 */

import type { Job, Worker } from 'bullmq';
import { eq, and, sql, lt } from 'drizzle-orm';
import { rbacUserRole, appGrant } from '@agentifui/db/schema/rbac';

// =============================================================================
// Types
// =============================================================================

export interface CleanupExpiredJobData {
  dryRun?: boolean;
  batchSize?: number;
}

export interface CleanupExpiredJobResult {
  expiredUserRoles: number;
  expiredAppGrants: number;
  totalExpired: number;
  timestamp: string;
}

// =============================================================================
// Job Processor
// =============================================================================

/**
 * T099 [US5] Implement expired grant cleanup job
 * T100 [US5] Implement expired UserRole cleanup job
 */
export async function cleanupExpiredJobProcessor(
  job: Job<CleanupExpiredJobData>,
  db: any
): Promise<CleanupExpiredJobResult> {
  const { dryRun = false, batchSize = 1000 } = job.data;
  const now = new Date();

  let expiredUserRoles = 0;
  let expiredAppGrants = 0;

  // Cleanup expired UserRoles (T100)
  const expiredUserRoleRecords = await db
    .select()
    .from(rbacUserRole)
    .where(
      and(
        sql`${rbacUserRole.expiresAt} IS NOT NULL`,
        lt(rbacUserRole.expiresAt, now)
      )
    )
    .limit(batchSize);

  if (expiredUserRoleRecords.length > 0) {
    expiredUserRoles = expiredUserRoleRecords.length;

    if (!dryRun) {
      // Delete expired user roles
      for (const record of expiredUserRoleRecords) {
        await db
          .delete(rbacUserRole)
          .where(
            and(
              eq(rbacUserRole.userId, record.userId),
              eq(rbacUserRole.roleId, record.roleId),
              eq(rbacUserRole.tenantId, record.tenantId)
            )
          );
      }
    }
  }

  // Cleanup expired AppGrants (T099)
  const expiredGrantRecords = await db
    .select()
    .from(appGrant)
    .where(
      and(
        sql`${appGrant.expiresAt} IS NOT NULL`,
        lt(appGrant.expiresAt, now)
      )
    )
    .limit(batchSize);

  if (expiredGrantRecords.length > 0) {
    expiredAppGrants = expiredGrantRecords.length;

    if (!dryRun) {
      // Delete expired grants and log audit events
      for (const record of expiredGrantRecords) {
        await db.delete(appGrant).where(eq(appGrant.id, record.id));

        // Log grant.expired audit event (T072 from US2)
        if (job.logEvent) {
          await job.logEvent({
            action: 'grant.expired',
            resourceType: 'app_grant',
            resourceId: record.id,
            tenantId: record.tenantId,
            result: 'success',
            metadata: {
              granteeType: record.granteeType,
              granteeId: record.granteeId,
              appId: record.appId,
              expiresAt: record.expiresAt,
            },
          });
        }
      }
    }
  }

  const result: CleanupExpiredJobResult = {
    expiredUserRoles,
    expiredAppGrants,
    totalExpired: expiredUserRoles + expiredAppGrants,
    timestamp: now.toISOString(),
  };

  // Log result
  if (dryRun) {
    console.log(`[DRY RUN] Cleanup would remove ${result.totalExpired} expired records:`, result);
  } else {
    console.log(`[Cleanup] Removed ${result.totalExpired} expired records:`, result);
  }

  return result;
}

// =============================================================================
// Job Registration
// =============================================================================

/**
 * Register the cleanup expired job with a BullMQ worker.
 */
export function registerCleanupExpiredJob(
  worker: Worker,
  db: any
): void {
  worker.process(
    'rbac:cleanup-expired',
    async (job: Job<CleanupExpiredJobData>) => {
      return cleanupExpiredJobProcessor(job, db);
    }
  );
}

// =============================================================================
// Job Scheduler Helper
// =============================================================================

/**
 * Add a recurring cleanup job to the queue.
 * Should be scheduled to run daily at 2 AM.
 */
export async function scheduleCleanupExpiredJob(queue: any): Promise<void> {
  const jobPattern = {
    pattern: '0 2 * * *', // Daily at 2 AM
    // Alternative: every hour
    // pattern: '0 * * * *',
  };

  await queue.add(
    'rbac:cleanup-expired',
    {
      dryRun: false,
      batchSize: 1000,
    },
    {
      repeat: {
        pattern: jobPattern.pattern,
      },
      jobId: 'rbac:cleanup-expired:daily', // Unique ID to prevent duplicate jobs
    }
  );

  console.log('[Scheduler] Cleanup expired job scheduled: daily at 2 AM');
}
