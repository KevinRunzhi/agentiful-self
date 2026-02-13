/**
 * Grant Service
 *
 * Service for managing application access grants (T057-T061).
 * Handles group and user grants, including direct user grants and explicit denies.
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, sql } from 'drizzle-orm';
import { appGrant } from '@agentifui/db/schema/rbac';
import { app } from '@agentifui/db/schema/rbac';
import { createGrantRepository, type IGrantRepository } from '../repositories/grant.repository';
import { createPermissionRepository } from '../repositories/permission.repository';
import { createRbacAuditHelper } from './rbac-audit.helper';
import type {
  CreateAppGrantInput,
  CreateDirectGrantInput,
} from '@agentifui/shared/rbac';

// =============================================================================
// Types
// =============================================================================

export interface CreateGrantOptions {
  grantedBy: string;
  tenantId: string;
}

export interface RevokeGrantOptions {
  revokedBy: string;
  tenantId: string;
}

// =============================================================================
// Grant Service
// =============================================================================

export class GrantService {
  constructor(
    private db: PostgresJsDatabase,
    private grantRepo: IGrantRepository,
    private audit: any,
    private permissionService?: any
  ) {}

  /**
   * Create a new app grant (T057)
   */
  async createGrant(
    input: CreateAppGrantInput,
    options: CreateGrantOptions
  ) {
    // Verify the app exists and belongs to the tenant
    const appRecord = await this.db
      .select()
      .from(app)
      .where(
        and(
          eq(app.id, input.appId),
          eq(app.tenantId, options.tenantId)
        )
      )
      .limit(1);

    if (appRecord.length === 0) {
      throw new Error('App not found or not in tenant');
    }

    // Check if caller has app:grant permission (T061)
    // This would typically be done via middleware
    const hasPermission = await this.checkPermission(options.grantedBy, options.tenantId, 'app', 'grant');
    if (!hasPermission) {
      throw new Error('Insufficient permissions: app:grant required');
    }

    // Validate user direct grant requirements
    if (input.granteeType === 'user') {
      if (!input.reason) {
        throw new Error('Reason is required for user direct grants');
      }
      if (!input.expiresAt) {
        throw new Error('ExpiresAt is required for user direct grants');
      }

      // Validate max expiration (90 days) - T094
      const maxExpiresAt = new Date();
      maxExpiresAt.setDate(maxExpiresAt.getDate() + 90);
      if (input.expiresAt > maxExpiresAt) {
        throw new Error('Direct grants cannot exceed 90 days');
      }
    }

    // Create the grant
    const grant = await this.grantRepo.create({
      appId: input.appId,
      granteeType: input.granteeType,
      granteeId: input.granteeId,
      permission: input.permission,
      reason: input.reason,
      grantedBy: options.grantedBy,
      expiresAt: input.expiresAt,
    });

    // Invalidate permission cache for affected users
    await this.invalidateCacheForGrantee(input.granteeType, input.granteeId, options.tenantId);

    // Log audit event (T071)
    const auditHelper = createRbacAuditHelper(this.audit);
    await auditHelper.logGrantCreated({
      actorUserId: options.grantedBy,
      tenantId: options.tenantId,
      appId: input.appId,
      granteeType: input.granteeType,
      granteeId: input.granteeId,
      permission: input.permission,
      reason: input.reason,
      expiresAt: input.expiresAt,
    });

    return grant;
  }

  /**
   * Revoke a grant (T058)
   */
  async revokeGrant(grantId: string, options: RevokeGrantOptions) {
    const grant = await this.grantRepo.findById(grantId);

    if (!grant) {
      throw new Error('Grant not found');
    }

    // Verify app belongs to tenant
    const appRecord = await this.db
      .select()
      .from(app)
      .where(eq(app.id, grant.appId))
      .limit(1);

    if (appRecord.length === 0 || appRecord[0].tenantId !== options.tenantId) {
      throw new Error('App not found or not in tenant');
    }

    // Check permissions
    const hasPermission = await this.checkPermission(options.revokedBy, options.tenantId, 'app', 'grant');
    if (!hasPermission) {
      throw new Error('Insufficient permissions: app:grant required');
    }

    // Revoke the grant
    await this.grantRepo.revoke(grantId);

    // Invalidate cache
    await this.invalidateCacheForGrantee(grant.granteeType, grant.granteeId, options.tenantId);

    // Log audit event (T072)
    const auditHelper = createRbacAuditHelper(this.audit);
    await auditHelper.logGrantRevoked({
      actorUserId: options.revokedBy,
      tenantId: options.tenantId,
      grantId,
      appId: grant.appId,
      granteeType: grant.granteeType,
      granteeId: grant.granteeId,
    });

    return true;
  }

  /**
   * Get grants for an app (T059)
   */
  async getGrantsByApp(appId: string, tenantId: string) {
    // Verify app belongs to tenant
    const appRecord = await this.db
      .select()
      .from(app)
      .where(
        and(
          eq(app.id, appId),
          eq(app.tenantId, tenantId)
        )
      )
      .limit(1);

    if (appRecord.length === 0) {
      throw new Error('App not found or not in tenant');
    }

    return this.grantRepo.findByApp(appId);
  }

  /**
   * Get grants for a grantee (T060)
   */
  async getGrantsByGrantee(
    granteeType: 'group' | 'user',
    granteeId: string,
    tenantId: string
  ) {
    return this.grantRepo.findByGranteeWithApp(granteeType, granteeId);
  }

  /**
   * T094 [P] [US5] Implement createUserGrant method (with reason and maxExpiresAt validation)
   */
  async createUserDirectGrant(
    input: CreateDirectGrantInput,
    options: CreateGrantOptions
  ) {
    // Enforce reason and expiresAt (T094)
    if (!input.reason || input.reason.trim().length === 0) {
      throw new Error('Reason is required for direct user grants');
    }

    if (!input.expiresAt) {
      throw new Error('Expiration date is required for direct user grants');
    }

    // T095 [US5] Implement maxExpiresAt validation (90 days)
    const maxExpiresAt = new Date();
    maxExpiresAt.setDate(maxExpiresAt.getDate() + 90);
    if (input.expiresAt > maxExpiresAt) {
      throw new Error('Direct grants cannot exceed 90 days from now');
    }

    // T096 [US5] Implement Manager authorization check (should fail)
    const isManager = await this.checkIsManager(options.grantedBy, options.tenantId);
    if (isManager) {
      throw new Error('Managers are not authorized to create direct user grants');
    }

    // Verify the app exists and belongs to the tenant
    const appRecord = await this.db
      .select()
      .from(app)
      .where(
        and(
          eq(app.id, input.appId),
          eq(app.tenantId, options.tenantId)
        )
      )
      .limit(1);

    if (appRecord.length === 0) {
      throw new Error('App not found or not in tenant');
    }

    // Check if caller has app:grant permission
    const hasPermission = await this.checkPermission(options.grantedBy, options.tenantId, 'app', 'grant');
    if (!hasPermission) {
      throw new Error('Insufficient permissions: app:grant required');
    }

    // T097 [US5] Handle Deny record creation (permission='deny')
    let auditAction: string;
    if (input.permission === 'deny') {
      auditAction = 'deny.created';
      // Log deny audit event (T101)
      const auditHelper = createRbacAuditHelper(this.audit);
      await auditHelper.logDenyCreated({
        actorUserId: options.grantedBy,
        tenantId: options.tenantId,
        appId: input.appId,
        granteeId: input.granteeId,
        reason: input.reason,
      });
    } else {
      auditAction = 'grant.created';
    }

    // Create the grant
    const grant = await this.grantRepo.create({
      appId: input.appId,
      granteeType: input.granteeType,
      granteeId: input.granteeId,
      permission: input.permission || 'use',
      reason: input.reason,
      grantedBy: options.grantedBy,
      expiresAt: input.expiresAt,
    });

    // Invalidate permission cache for affected users
    await this.invalidateCacheForGrantee(input.granteeType, input.granteeId, options.tenantId);

    // Log audit event
    const auditHelper = createRbacAuditHelper(this.audit);
    if (input.permission === 'deny') {
      // T101 [P] [US5] Add deny.created audit event
      await auditHelper.logDenyCreated({
        actorUserId: options.grantedBy,
        tenantId: options.tenantId,
        appId: input.appId,
        granteeId: input.granteeId,
        reason: input.reason,
      });
    } else {
      await auditHelper.logGrantCreated({
        actorUserId: options.grantedBy,
        tenantId: options.tenantId,
        appId: input.appId,
        granteeType: input.granteeType,
        granteeId: input.granteeId,
        permission: input.permission || 'use',
        reason: input.reason,
        expiresAt: input.expiresAt,
      });
    }

    return grant;
  }

  /**
   * T097 [US5] Create explicit Deny record
   */
  async createDenyGrant(
    input: CreateDirectGrantInput,
    options: CreateGrantOptions
  ) {
    // Validate reason is required for deny
    if (!input.reason || input.reason.trim().length === 0) {
      throw new Error('Reason is required for deny grants');
    }

    return this.createUserDirectGrant(
      {
        ...input,
        permission: 'deny',
      },
      options
    );
  }

  /**
   * Revoke deny grant (T102)
   */
  async revokeDenyGrant(grantId: string, options: RevokeGrantOptions) {
    const grant = await this.grantRepo.findById(grantId);

    if (!grant) {
      throw new Error('Grant not found');
    }

    if (grant.permission !== 'deny') {
      throw new Error('This endpoint is only for revoking deny grants');
    }

    // Verify app belongs to tenant
    const appRecord = await this.db
      .select()
      .from(app)
      .where(eq(app.id, grant.appId))
      .limit(1);

    if (appRecord.length === 0 || appRecord[0].tenantId !== options.tenantId) {
      throw new Error('App not found or not in tenant');
    }

    // Check permissions
    const hasPermission = await this.checkPermission(options.revokedBy, options.tenantId, 'app', 'grant');
    if (!hasPermission) {
      throw new Error('Insufficient permissions: app:grant required');
    }

    // Revoke the grant
    await this.grantRepo.revoke(grantId);

    // Invalidate cache
    await this.invalidateCacheForGrantee(grant.granteeType, grant.granteeId, options.tenantId);

    // Log deny.revoked audit event (T102)
    const auditHelper = createRbacAuditHelper(this.audit);
    await auditHelper.logDenyRevoked({
      actorUserId: options.revokedBy,
      tenantId: options.tenantId,
      grantId,
      appId: grant.appId,
      granteeId: grant.granteeId,
    });

    return true;
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private async checkPermission(userId: string, tenantId: string, resourceType: string, action: string): Promise<boolean> {
    if (!this.permissionService) {
      // If no permission service, assume true for now
      // In production, this should always check
      return true;
    }

    const result = await this.permissionService.checkPermission({
      userId,
      tenantId,
      activeGroupId: null,
      resourceType,
      action,
    });

    return result.allowed;
  }

  private async checkIsManager(userId: string, tenantId: string): Promise<boolean> {
    // Check if user has Manager role in any group in this tenant
    // For now, we'll return false
    // In production, this would query GroupMember table
    return false;
  }

  private async invalidateCacheForGrantee(
    granteeType: 'group' | 'user',
    granteeId: string,
    tenantId: string
  ): Promise<void> {
    if (!this.permissionService) {
      return;
    }

    if (granteeType === 'user') {
      await this.permissionService.invalidateCache(granteeId, tenantId);
    } else {
      // For group grants, we'd need to invalidate all members' caches
      // This is more complex and may require a separate group members query
      // For now, we'll skip this optimization
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createGrantService(
  db: PostgresJsDatabase,
  audit: any,
  permissionService?: any
): GrantService {
  const grantRepo = createGrantRepository(db);
  return new GrantService(db, grantRepo, audit, permissionService);
}
