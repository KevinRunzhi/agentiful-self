/**
 * RBAC Audit Helper
 *
 * Helper functions for logging RBAC-specific audit events (T053-T055).
 */

import type { AuditService } from '../../auth/services/audit.service';

// =============================================================================
// Audit Event Types for RBAC
// =============================================================================

const RBAC_AUDIT_EVENTS = {
  // Role events
  ROLE_ASSIGNED: 'role.assigned',
  ROLE_REMOVED: 'role.removed',
  ROLE_CREATED: 'role.created',
  ROLE_UPDATED: 'role.updated',
  ROLE_DELETED: 'role.deleted',

  // Grant events
  GRANT_CREATED: 'grant.created',
  GRANT_REVOKED: 'grant.revoked',
  GRANT_EXPIRED: 'grant.expired',
  DENY_CREATED: 'deny.created',
  DENY_REVOKED: 'deny.revoked',

  // Break-glass events
  BREAKGLASS_ACTIVATED: 'breakglass.activated',
  BREAKGLASS_EXPIRED: 'breakglass.expired',

  // Permission events
  PERMISSION_DENIED: 'permission.denied',
  PERMISSION_GRANTED: 'permission.granted',

  // Conversation events
  CONVERSATION_VIEW_OTHERS: 'conversation.view_others',
  CONVERSATION_EXPORT: 'conversation.export',
} as const;

// =============================================================================
// RBAC Audit Helper
// =============================================================================

export class RbacAuditHelper {
  constructor(private audit: AuditService) {}

  /**
   * Log role assignment event
   */
  async logRoleAssigned(data: {
    actorUserId: string;
    tenantId: string;
    targetUserId: string;
    roleId: number;
    roleName: string;
    expiresAt?: Date | null;
    traceId?: string;
  }) {
    return this.audit.logSuccess({
      eventType: RBAC_AUDIT_EVENTS.ROLE_ASSIGNED,
      actorUserId: data.actorUserId,
      actorType: 'user',
      tenantId: data.tenantId,
      action: 'assign_role',
      resourceType: 'user_role',
      resourceId: data.targetUserId,
      metadata: {
        roleId: data.roleId,
        roleName: data.roleName,
        expiresAt: data.expiresAt?.toISOString() || null,
      },
      traceId: data.traceId,
    });
  }

  /**
   * Log role removal event
   */
  async logRoleRemoved(data: {
    actorUserId: string;
    tenantId: string;
    targetUserId: string;
    roleId: number;
    roleName: string;
    traceId?: string;
  }) {
    return this.audit.logSuccess({
      eventType: RBAC_AUDIT_EVENTS.ROLE_REMOVED,
      actorUserId: data.actorUserId,
      actorType: 'user',
      tenantId: data.tenantId,
      action: 'remove_role',
      resourceType: 'user_role',
      resourceId: data.targetUserId,
      metadata: {
        roleId: data.roleId,
        roleName: data.roleName,
      },
      traceId: data.traceId,
    });
  }

  /**
   * Log permission denied event
   */
  async logPermissionDenied(data: {
    userId: string;
    tenantId: string;
    resourceType: string;
    action: string;
    resourceId?: string;
    reason?: string;
    traceId?: string;
  }) {
    return this.audit.logSuccess({
      eventType: RBAC_AUDIT_EVENTS.PERMISSION_DENIED,
      actorUserId: data.userId,
      actorType: 'user',
      tenantId: data.tenantId,
      action: `${data.resourceType}:${data.action}`,
      resourceType: data.resourceType,
      resourceId: data.resourceId || null,
      metadata: {
        reason: data.reason || 'Insufficient permissions',
      },
      traceId: data.traceId,
    });
  }

  /**
   * Log grant created event
   */
  async logGrantCreated(data: {
    actorUserId: string;
    tenantId: string;
    appId: string;
    granteeType: 'group' | 'user';
    granteeId: string;
    permission: 'use' | 'deny';
    reason?: string;
    expiresAt?: Date | null;
    traceId?: string;
  }) {
    return this.audit.logSuccess({
      eventType: RBAC_AUDIT_EVENTS.GRANT_CREATED,
      actorUserId: data.actorUserId,
      actorType: 'user',
      tenantId: data.tenantId,
      action: 'create_grant',
      resourceType: 'app_grant',
      resourceId: data.appId,
      metadata: {
        granteeType: data.granteeType,
        granteeId: data.granteeId,
        permission: data.permission,
        reason: data.reason || null,
        expiresAt: data.expiresAt?.toISOString() || null,
      },
      traceId: data.traceId,
    });
  }

  /**
   * Log grant revoked event
   */
  async logGrantRevoked(data: {
    actorUserId: string;
    tenantId: string;
    grantId: string;
    appId: string;
    granteeType: 'group' | 'user';
    granteeId: string;
    traceId?: string;
  }) {
    return this.audit.logSuccess({
      eventType: RBAC_AUDIT_EVENTS.GRANT_REVOKED,
      actorUserId: data.actorUserId,
      actorType: 'user',
      tenantId: data.tenantId,
      action: 'revoke_grant',
      resourceType: 'app_grant',
      resourceId: data.grantId,
      metadata: {
        appId: data.appId,
        granteeType: data.granteeType,
        granteeId: data.granteeId,
      },
      traceId: data.traceId,
    });
  }

  /**
   * Log break-glass activated event (Critical severity) - T117
   */
  async logBreakglassActivated(data: {
    rootAdminId: string;
    targetTenantId: string;
    reason: string;
    expiresAt: Date;
    traceId?: string;
  }) {
    return this.audit.logSuccess({
      eventType: RBAC_AUDIT_EVENTS.BREAKGLASS_ACTIVATED,
      actorUserId: data.rootAdminId,
      actorType: 'root_admin',
      tenantId: data.targetTenantId,
      action: 'breakglass_activate',
      resourceType: 'tenant',
      resourceId: data.targetTenantId,
      metadata: {
        reason: data.reason,
        expiresAt: data.expiresAt.toISOString(),
        severity: 'critical',
      },
      traceId: data.traceId,
    });
  }

  /**
   * T101 [P] [US5] Add deny.created audit event
   */
  async logDenyCreated(data: {
    actorUserId: string;
    tenantId: string;
    appId: string;
    granteeId: string;
    reason: string;
    traceId?: string;
  }) {
    return this.audit.logSuccess({
      eventType: RBAC_AUDIT_EVENTS.DENY_CREATED,
      actorUserId: data.actorUserId,
      actorType: 'user',
      tenantId: data.tenantId,
      action: 'create_deny',
      resourceType: 'app_grant',
      resourceId: data.appId,
      metadata: {
        granteeId: data.granteeId,
        reason: data.reason,
        severity: 'high',
      },
      traceId: data.traceId,
    });
  }

  /**
   * T102 [P] [US5] Add deny.revoked audit event
   */
  async logDenyRevoked(data: {
    actorUserId: string;
    tenantId: string;
    grantId: string;
    appId: string;
    granteeId: string;
    traceId?: string;
  }) {
    return this.audit.logSuccess({
      eventType: RBAC_AUDIT_EVENTS.DENY_REVOKED,
      actorUserId: data.actorUserId,
      actorType: 'user',
      tenantId: data.tenantId,
      action: 'revoke_deny',
      resourceType: 'app_grant',
      resourceId: data.grantId,
      metadata: {
        appId: data.appId,
        granteeId: data.granteeId,
      },
      traceId: data.traceId,
    });
  }

  /**
   * T092 [US4] Add conversation.view_others audit event
   */
  async logConversationViewOthers(data: {
    actorUserId: string;
    tenantId: string;
    conversationId: string;
    targetUserId?: string;
    reason: string;
    traceId?: string;
  }) {
    return this.audit.logSuccess({
      eventType: RBAC_AUDIT_EVENTS.CONVERSATION_VIEW_OTHERS,
      actorUserId: data.actorUserId,
      actorType: 'tenant_admin',
      tenantId: data.tenantId,
      action: 'view_others_conversation',
      resourceType: 'conversation',
      resourceId: data.conversationId,
      metadata: {
        targetUserId: data.targetUserId || null,
        reason: data.reason,
        severity: 'high',
      },
      traceId: data.traceId,
    });
  }

  /**
   * T093 [US4] Add view_others.attempted audit event for unauthorized access
   */
  async logViewOthersAttempted(data: {
    actorUserId: string;
    tenantId: string;
    resourceType: string;
    resourceId: string;
    attemptReason: string;
    traceId?: string;
  }) {
    return this.audit.logFailure({
      eventType: 'view_others.attempted',
      actorUserId: data.actorUserId,
      actorType: 'user',
      tenantId: data.tenantId,
      action: 'attempted_view_others',
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      errorMessage: 'Unauthorized access attempt',
      metadata: {
        attemptReason: data.attemptReason,
        severity: 'high',
      },
      traceId: data.traceId,
    });
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createRbacAuditHelper(audit: AuditService): RbacAuditHelper {
  return new RbacAuditHelper(audit);
}
