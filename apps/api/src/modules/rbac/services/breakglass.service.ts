/**
 * Break-glass Service
 *
 * Service for emergency access mechanism (S1-2 User Story 6).
 * Allows ROOT ADMIN to temporarily access tenant data with audit trail.
 *
 * Key features:
 * - Environment variable gated (ENABLE_ROOT_ADMIN=true)
 * - 1-hour temporary role elevation
 * - Critical audit logging
 * - Tenant Admin notification
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, or, sql, desc } from 'drizzle-orm';
import { rbacRole, rbacUserRole, appGrant } from '@agentifui/db/schema/rbac';
import { tenant } from '@agentifui/db/schema/tenant';
import { user } from '@agentifui/db/schema/user';

// =============================================================================
// Types
// =============================================================================

export interface BreakglassSession {
  sessionId: string;
  rootAdminId: string;
  tenantId: string;
  tenantName?: string;
  expiresAt: Date;
  reason: string;
  activatedAt: Date;
}

export interface ActivateBreakglassInput {
  rootAdminId: string;
  tenantId: string;
  reason: string;
  traceId?: string;
}

export interface BreakglassStatus {
  isActive: boolean;
  session?: BreakglassSession;
  remainingTime?: number; // seconds
}

export interface BreakglassNotification {
  id: string;
  type: 'breakglass_activated' | 'breakglass_expired';
  tenantId: string;
  rootAdminId: string;
  rootAdminName?: string;
  reason: string;
  expiresAt: Date;
  createdAt: Date;
  isRead: boolean;
}

// =============================================================================
// Configuration
// =============================================================================

const BREAKGLASS_DURATION_MS = 60 * 60 * 1000; // 1 hour
const MAX_REASON_LENGTH = 500;
const MIN_REASON_LENGTH = 10;

// =============================================================================
// Break-glass Service Interface
// =============================================================================

export interface IBreakglassService {
  /**
   * T103 [P] [US6] ROOT ADMIN enable check via environment variable
   * Check if ROOT ADMIN functionality is enabled
   */
  isRootAdminEnabled(): Promise<boolean>;

  /**
   * T104 [P] [US6] Activate break-glass session
   * Creates temporary tenant_admin role for ROOT ADMIN
   */
  activateBreakglass(input: ActivateBreakglassInput): Promise<BreakglassSession>;

  /**
   * T105 [US6] Temporary UserRole assignment (expiresAt = 1 hour)
   * Assigns tenant_admin role to ROOT ADMIN with expiration
   */
  assignTemporaryRole(
    rootAdminId: string,
    tenantId: string,
    expiresAt: Date
  ): Promise<void>;

  /**
   * T106 [US6] Get break-glass status
   * Returns current active session if any
   */
  getBreakglassStatus(rootAdminId: string, tenantId: string): Promise<BreakglassStatus>;

  /**
   * T107 [US6] Break-glass session expiration check
   * Checks if session is still valid
   */
  isSessionValid(rootAdminId: string, tenantId: string): Promise<boolean>;

  /**
   * T110 [US6] Extend break-glass session
   * Extends expiration time by 1 hour
   */
  extendSession(rootAdminId: string, tenantId: string): Promise<BreakglassSession>;

  /**
   * T112 [US6] Break-glass notification creation
   * Creates notification for Tenant Admins
   */
  createBreakglassNotification(session: BreakglassSession): Promise<string>;

  /**
   * T113 [P] Get break-glass notifications for tenant
   */
  getBreakglassNotifications(tenantId: string): Promise<BreakglassNotification[]>;

  /**
   * Revoke break-glass session
   * Immediately removes temporary role
   */
  revokeBreakglass(rootAdminId: string, tenantId: string): Promise<boolean>;

  /**
   * Cleanup expired sessions
   * Removes expired temporary roles
   */
  cleanupExpiredSessions(): Promise<number>;
}

// =============================================================================
// Break-glass Service Implementation
// =============================================================================

export class BreakglassService implements IBreakglassService {
  // In-memory session storage (in production, use Redis or database)
  private activeSessions: Map<string, BreakglassSession> = new Map();

  constructor(
    private db: PostgresJsDatabase,
    private audit?: {
      logEvent(event: {
        tenantId: string;
        actorUserId: string;
        actorType: string;
        action: string;
        resourceType: string;
        resourceId?: string;
        result: string;
        traceId?: string;
        metadata?: Record<string, unknown>;
      }): Promise<void>;
    },
    private notificationStore?: {
      create(notification: Omit<BreakglassNotification, 'id'>): Promise<string>;
      findByTenant(tenantId: string): Promise<BreakglassNotification[]>;
      markAsRead(notificationId: string): Promise<void>;
    }
  ) {}

  // ==========================================================================
  // ROOT ADMIN Enable Check
  // ==========================================================================

  /**
   * T103 [P] [US6] ROOT ADMIN enable check via environment variable
   */
  async isRootAdminEnabled(): Promise<boolean> {
    return process.env.ENABLE_ROOT_ADMIN === 'true';
  }

  // ==========================================================================
  // Break-glass Activation
  // ==========================================================================

  /**
   * T104 [P] [US6] Activate break-glass session
   */
  async activateBreakglass(input: ActivateBreakglassInput): Promise<BreakglassSession> {
    // Check if ROOT ADMIN is enabled
    const isEnabled = await this.isRootAdminEnabled();
    if (!isEnabled) {
      throw new Error('ROOT_ADMIN functionality is not enabled. Set ENABLE_ROOT_ADMIN=true to use this feature.');
    }

    // Validate input
    this.validateActivateInput(input);

    // Verify ROOT ADMIN user exists
    const rootAdmin = await this.db
      .select()
      .from(user)
      .where(eq(user.id, input.rootAdminId))
      .limit(1);

    if (rootAdmin.length === 0) {
      throw new Error('ROOT ADMIN user not found');
    }

    // Verify tenant exists
    const tenantRecord = await this.db
      .select()
      .from(tenant)
      .where(eq(tenant.id, input.tenantId))
      .limit(1);

    if (tenantRecord.length === 0) {
      throw new Error('Tenant not found');
    }

    // Calculate expiration time (1 hour from now)
    const expiresAt = new Date(Date.now() + BREAKGLASS_DURATION_MS);
    const activatedAt = new Date();

    // T105 [US6] Assign temporary tenant_admin role
    await this.assignTemporaryRole(input.rootAdminId, input.tenantId, expiresAt);

    // Create session
    const sessionId = this.generateSessionId(input.rootAdminId, input.tenantId);
    const session: BreakglassSession = {
      sessionId,
      rootAdminId: input.rootAdminId,
      tenantId: input.tenantId,
      tenantName: tenantRecord[0].name,
      expiresAt,
      reason: input.reason,
      activatedAt,
    };

    // Store session
    this.activeSessions.set(sessionId, session);

    // T112 [US6] Create notification for Tenant Admins
    await this.createBreakglassNotification(session);

    // Log audit event (T117)
    await this.logBreakglassActivated(session, input.traceId);

    return session;
  }

  // ==========================================================================
  // Temporary Role Assignment
  // ==========================================================================

  /**
   * T105 [US6] Temporary UserRole assignment (expiresAt = 1 hour)
   */
  async assignTemporaryRole(
    rootAdminId: string,
    tenantId: string,
    expiresAt: Date
  ): Promise<void> {
    // Get tenant_admin role
    const tenantAdminRole = await this.db
      .select()
      .from(rbacRole)
      .where(eq(rbacRole.name, 'tenant_admin'))
      .limit(1);

    if (tenantAdminRole.length === 0) {
      throw new Error('tenant_admin role not found');
    }

    // Check if user already has this role in the tenant
    const existingRole = await this.db
      .select()
      .from(rbacUserRole)
      .where(
        and(
          eq(rbacUserRole.userId, rootAdminId),
          eq(rbacUserRole.tenantId, tenantId),
          eq(rbacUserRole.roleId, tenantAdminRole[0].id)
        )
      )
      .limit(1);

    if (existingRole.length > 0) {
      // Update expiration
      await this.db
        .update(rbacUserRole)
        .set({ expiresAt })
        .where(
          and(
            eq(rbacUserRole.userId, rootAdminId),
            eq(rbacUserRole.tenantId, tenantId),
            eq(rbacUserRole.roleId, tenantAdminRole[0].id)
          )
        );
    } else {
      // Insert new role assignment
      await this.db.insert(rbacUserRole).values({
        userId: rootAdminId,
        roleId: tenantAdminRole[0].id,
        tenantId,
        expiresAt,
      });
    }
  }

  // ==========================================================================
  // Status and Validation
  // ==========================================================================

  /**
   * T106 [US6] Get break-glass status
   */
  async getBreakglassStatus(rootAdminId: string, tenantId: string): Promise<BreakglassStatus> {
    const sessionId = this.generateSessionId(rootAdminId, tenantId);
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      // Check database for existing session
      const dbSession = await this.getSessionFromDb(rootAdminId, tenantId);
      if (!dbSession) {
        return { isActive: false };
      }
      // Restore to memory
      this.activeSessions.set(sessionId, dbSession);
      return {
        isActive: true,
        session: dbSession,
        remainingTime: Math.max(0, Math.floor((dbSession.expiresAt.getTime() - Date.now()) / 1000)),
      };
    }

    const isValid = await this.isSessionValid(rootAdminId, tenantId);
    if (!isValid) {
      this.activeSessions.delete(sessionId);
      return { isActive: false };
    }

    return {
      isActive: true,
      session,
      remainingTime: Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
    };
  }

  /**
   * T107 [US6] Break-glass session expiration check
   */
  async isSessionValid(rootAdminId: string, tenantId: string): Promise<boolean> {
    const sessionId = this.generateSessionId(rootAdminId, tenantId);
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      return false;
    }

    // Check if expired
    if (session.expiresAt < new Date()) {
      // Log expiration
      await this.logBreakglassExpired(session);
      this.activeSessions.delete(sessionId);
      return false;
    }

    return true;
  }

  // ==========================================================================
  // Session Extension
  // ==========================================================================

  /**
   * T110 [US6] Extend break-glass session
   */
  async extendSession(rootAdminId: string, tenantId: string): Promise<BreakglassSession> {
    const status = await this.getBreakglassStatus(rootAdminId, tenantId);

    if (!status.isActive || !status.session) {
      throw new Error('No active break-glass session found');
    }

    // Extend expiration by 1 hour
    const newExpiresAt = new Date(Date.now() + BREAKGLASS_DURATION_MS);

    // Update role assignment
    await this.assignTemporaryRole(rootAdminId, tenantId, newExpiresAt);

    // Update session
    const updatedSession: BreakglassSession = {
      ...status.session,
      expiresAt: newExpiresAt,
    };

    const sessionId = this.generateSessionId(rootAdminId, tenantId);
    this.activeSessions.set(sessionId, updatedSession);

    // Log audit event
    await this.audit?.logEvent({
      tenantId,
      actorUserId: rootAdminId,
      actorType: 'admin',
      action: 'breakglass.extended',
      resourceType: 'breakglass_session',
      resourceId: sessionId,
      result: 'success',
      metadata: {
        previousExpiresAt: status.session.expiresAt,
        newExpiresAt,
      },
    });

    return updatedSession;
  }

  // ==========================================================================
  // Notifications
  // ==========================================================================

  /**
   * T112 [US6] Break-glass notification creation
   */
  async createBreakglassNotification(session: BreakglassSession): Promise<string> {
    const notificationId = `bg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    if (this.notificationStore) {
      await this.notificationStore.create({
        id: notificationId,
        type: 'breakglass_activated',
        tenantId: session.tenantId,
        rootAdminId: session.rootAdminId,
        reason: session.reason,
        expiresAt: session.expiresAt,
        createdAt: session.activatedAt,
        isRead: false,
      });
    }

    return notificationId;
  }

  /**
   * T113 [P] Get break-glass notifications for tenant
   */
  async getBreakglassNotifications(tenantId: string): Promise<BreakglassNotification[]> {
    if (this.notificationStore) {
      return this.notificationStore.findByTenant(tenantId);
    }

    // Fallback: return notifications from in-memory store
    const notifications: BreakglassNotification[] = [];
    for (const session of this.activeSessions.values()) {
      if (session.tenantId === tenantId) {
        notifications.push({
          id: session.sessionId,
          type: 'breakglass_activated',
          tenantId: session.tenantId,
          rootAdminId: session.rootAdminId,
          reason: session.reason,
          expiresAt: session.expiresAt,
          createdAt: session.activatedAt,
          isRead: false,
        });
      }
    }

    return notifications;
  }

  // ==========================================================================
  // Revocation and Cleanup
  // ==========================================================================

  async revokeBreakglass(rootAdminId: string, tenantId: string): Promise<boolean> {
    const sessionId = this.generateSessionId(rootAdminId, tenantId);
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      return false;
    }

    // Remove from active sessions
    this.activeSessions.delete(sessionId);

    // Remove role assignment
    const tenantAdminRole = await this.db
      .select()
      .from(rbacRole)
      .where(eq(rbacRole.name, 'tenant_admin'))
      .limit(1);

    if (tenantAdminRole.length > 0) {
      await this.db
        .delete(rbacUserRole)
        .where(
          and(
            eq(rbacUserRole.userId, rootAdminId),
            eq(rbacUserRole.tenantId, tenantId),
            eq(rbacUserRole.roleId, tenantAdminRole[0].id)
          )
        );
    }

    // Log audit event
    await this.audit?.logEvent({
      tenantId,
      actorUserId: rootAdminId,
      actorType: 'admin',
      action: 'breakglass.revoked',
      resourceType: 'breakglass_session',
      resourceId: sessionId,
      result: 'success',
    });

    return true;
  }

  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    let cleaned = 0;

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.expiresAt < now) {
        // Remove expired role
        const tenantAdminRole = await this.db
          .select()
          .from(rbacRole)
          .where(eq(rbacRole.name, 'tenant_admin'))
          .limit(1);

        if (tenantAdminRole.length > 0) {
          await this.db
            .delete(rbacUserRole)
            .where(
              and(
                eq(rbacUserRole.userId, session.rootAdminId),
                eq(rbacUserRole.tenantId, session.tenantId),
                eq(rbacUserRole.roleId, tenantAdminRole[0].id)
              )
            );
        }

        // Log expiration (T118)
        await this.logBreakglassExpired(session);

        this.activeSessions.delete(sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private validateActivateInput(input: ActivateBreakglassInput): void {
    if (!input.rootAdminId || typeof input.rootAdminId !== 'string') {
      throw new Error('Invalid rootAdminId');
    }

    if (!input.tenantId || typeof input.tenantId !== 'string') {
      throw new Error('Invalid tenantId');
    }

    if (!input.reason || typeof input.reason !== 'string') {
      throw new Error('Invalid reason');
    }

    if (input.reason.trim().length < MIN_REASON_LENGTH) {
      throw new Error(`Reason must be at least ${MIN_REASON_LENGTH} characters`);
    }

    if (input.reason.length > MAX_REASON_LENGTH) {
      throw new Error(`Reason cannot exceed ${MAX_REASON_LENGTH} characters`);
    }
  }

  private generateSessionId(rootAdminId: string, tenantId: string): string {
    return `bg_${rootAdminId}_${tenantId}`;
  }

  private async getSessionFromDb(rootAdminId: string, tenantId: string): Promise<BreakglassSession | null> {
    // Check if user has temporary tenant_admin role that hasn't expired
    const now = new Date();

    const result = await this.db
      .select({
        userId: rbacUserRole.userId,
        tenantId: rbacUserRole.tenantId,
        expiresAt: rbacUserRole.expiresAt,
        createdAt: rbacUserRole.createdAt,
      })
      .from(rbacUserRole)
      .innerJoin(rbacRole, eq(rbacUserRole.roleId, rbacRole.id))
      .where(
        and(
          eq(rbacUserRole.userId, rootAdminId),
          eq(rbacUserRole.tenantId, tenantId),
          eq(rbacRole.name, 'tenant_admin'),
          sql`${rbacUserRole.expiresAt} IS NOT NULL`,
          sql`${rbacUserRole.expiresAt} > ${now}`
        )
      )
      .orderBy(desc(rbacUserRole.createdAt))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const tenantRecord = await this.db
      .select({ name: tenant.name })
      .from(tenant)
      .where(eq(tenant.id, tenantId))
      .limit(1);

    return {
      sessionId: this.generateSessionId(rootAdminId, tenantId),
      rootAdminId,
      tenantId,
      tenantName: tenantRecord[0]?.name,
      expiresAt: result[0].expiresAt!,
      reason: 'Break-glass session restored from database',
      activatedAt: result[0].createdAt,
    };
  }

  private async logBreakglassActivated(session: BreakglassSession, traceId?: string): Promise<void> {
    if (!this.audit) {
      return;
    }

    await this.audit.logEvent({
      tenantId: session.tenantId,
      actorUserId: session.rootAdminId,
      actorType: 'admin',
      action: 'breakglass.activated',
      resourceType: 'breakglass_session',
      resourceId: session.sessionId,
      result: 'success',
      traceId,
      metadata: {
        reason: session.reason,
        expiresAt: session.expiresAt,
        duration: BREAKGLASS_DURATION_MS,
      },
    });
  }

  private async logBreakglassExpired(session: BreakglassSession): Promise<void> {
    if (!this.audit) {
      return;
    }

    await this.audit.logEvent({
      tenantId: session.tenantId,
      actorUserId: session.rootAdminId,
      actorType: 'system',
      action: 'breakglass.expired',
      resourceType: 'breakglass_session',
      resourceId: session.sessionId,
      result: 'success',
      metadata: {
        expiredAt: new Date(),
        originalReason: session.reason,
      },
    });
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createBreakglassService(
  db: PostgresJsDatabase,
  audit?: BreakglassService['audit'],
  notificationStore?: BreakglassService['notificationStore']
): BreakglassService {
  return new BreakglassService(db, audit, notificationStore);
}
