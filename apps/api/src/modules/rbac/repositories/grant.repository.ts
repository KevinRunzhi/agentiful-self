/**
 * Grant Repository
 *
 * Data access layer for AppGrant entities.
 * Handles group and user application access grants.
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, or, sql, inArray } from 'drizzle-orm';
import { appGrant, app, user, group } from '@agentifui/db/schema';
import { appGrant as rbacAppGrant } from '@agentifui/db/schema/rbac';
import type { AppGrant } from '@agentifui/db/schema/rbac';

// =============================================================================
// Types
// =============================================================================

export interface GrantWithDetails extends AppGrant {
  appName?: string;
  granteeName?: string;
  grantedByName?: string;
}

export interface CreateGrantInput {
  appId: string;
  granteeType: 'group' | 'user';
  granteeId: string;
  permission: 'use' | 'deny';
  reason?: string;
  grantedBy: string;
  expiresAt?: Date;
}

// =============================================================================
// Repository Interface
// =============================================================================

export interface IGrantRepository {
  findById(id: string): Promise<AppGrant | null>;
  findByApp(appId: string): Promise<AppGrant[]>;
  findByGrantee(granteeType: 'group' | 'user', granteeId: string): Promise<AppGrant[]>;
  findByGranteeWithApp(
    granteeType: 'group' | 'user',
    granteeId: string
  ): Promise<GrantWithDetails[]>;
  findAll(filters?: {
    appId?: string;
    granteeType?: 'group' | 'user';
    granteeId?: string;
    permission?: 'use' | 'deny';
  }): Promise<GrantWithDetails[]>;
  create(input: CreateGrantInput): Promise<AppGrant>;
  revoke(id: string): Promise<boolean>;
  revokeExpired(): Promise<number>;
  countByTenant(tenantId: string): Promise<number>;
}

// =============================================================================
// Repository Implementation
// =============================================================================

export class GrantRepository implements IGrantRepository {
  constructor(private db: PostgresJsDatabase) {}

  async findById(id: string): Promise<AppGrant | null> {
    const result = await this.db
      .select()
      .from(rbacAppGrant)
      .where(eq(rbacAppGrant.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findByApp(appId: string): Promise<AppGrant[]> {
    return this.db
      .select()
      .from(rbacAppGrant)
      .where(eq(rbacAppGrant.appId, appId));
  }

  async findByGrantee(
    granteeType: 'group' | 'user',
    granteeId: string
  ): Promise<AppGrant[]> {
    return this.db
      .select()
      .from(rbacAppGrant)
      .where(
        and(
          eq(rbacAppGrant.granteeType, granteeType),
          eq(rbacAppGrant.granteeId, granteeId)
        )
      );
  }

  async findByGranteeWithApp(
    granteeType: 'group' | 'user',
    granteeId: string
  ): Promise<GrantWithDetails[]> {
    if (granteeType === 'user') {
      return this.db
        .select({
          id: rbacAppGrant.id,
          appId: rbacAppGrant.appId,
          granteeType: rbacAppGrant.granteeType,
          granteeId: rbacAppGrant.granteeId,
          permission: rbacAppGrant.permission,
          reason: rbacAppGrant.reason,
          grantedBy: rbacAppGrant.grantedBy,
          expiresAt: rbacAppGrant.expiresAt,
          createdAt: rbacAppGrant.createdAt,
          appName: app.name,
          granteeName: user.name,
          grantedByName: sql<string>`grantor.name`.as('grantedByName'),
        })
        .from(rbacAppGrant)
        .innerJoin(app, eq(rbacAppGrant.appId, app.id))
        .innerJoin(user, eq(rbacAppGrant.granteeId, user.id))
        .leftJoin(user as any, sql`${rbacAppGrant.grantedBy} = ${sql.placeholder('grantedBy')}`)
        .where(
          and(
            eq(rbacAppGrant.granteeType, 'user'),
            eq(rbacAppGrant.granteeId, granteeId)
          )
        ) as any;
    } else {
      return this.db
        .select({
          id: rbacAppGrant.id,
          appId: rbacAppGrant.appId,
          granteeType: rbacAppGrant.granteeType,
          granteeId: rbacAppGrant.granteeId,
          permission: rbacAppGrant.permission,
          reason: rbacAppGrant.reason,
          grantedBy: rbacAppGrant.grantedBy,
          expiresAt: rbacAppGrant.expiresAt,
          createdAt: rbacAppGrant.createdAt,
          appName: app.name,
          granteeName: group.name,
        })
        .from(rbacAppGrant)
        .innerJoin(app, eq(rbacAppGrant.appId, app.id))
        .innerJoin(group, eq(rbacAppGrant.granteeId, group.id))
        .where(
          and(
            eq(rbacAppGrant.granteeType, 'group'),
            eq(rbacAppGrant.granteeId, granteeId)
          )
        ) as any;
    }
  }

  async findAll(filters?: {
    appId?: string;
    granteeType?: 'group' | 'user';
    granteeId?: string;
    permission?: 'use' | 'deny';
  }): Promise<GrantWithDetails[]> {
    let query = this.db
      .select({
        id: rbacAppGrant.id,
        appId: rbacAppGrant.appId,
        granteeType: rbacAppGrant.granteeType,
        granteeId: rbacAppGrant.granteeId,
        permission: rbacAppGrant.permission,
        reason: rbacAppGrant.reason,
        grantedBy: rbacAppGrant.grantedBy,
        expiresAt: rbacAppGrant.expiresAt,
        createdAt: rbacAppGrant.createdAt,
        appName: app.name,
      })
      .from(rbacAppGrant)
      .innerJoin(app, eq(rbacAppGrant.appId, app.id));

    const conditions: any[] = [];

    if (filters?.appId) {
      conditions.push(eq(rbacAppGrant.appId, filters.appId));
    }
    if (filters?.granteeType) {
      conditions.push(eq(rbacAppGrant.granteeType, filters.granteeType));
    }
    if (filters?.granteeId) {
      conditions.push(eq(rbacAppGrant.granteeId, filters.granteeId));
    }
    if (filters?.permission) {
      conditions.push(eq(rbacAppGrant.permission, filters.permission));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return query as any;
  }

  async create(input: CreateGrantInput): Promise<AppGrant> {
    const result = await this.db
      .insert(rbacAppGrant)
      .values({
        id: crypto.randomUUID(),
        appId: input.appId,
        granteeType: input.granteeType,
        granteeId: input.granteeId,
        permission: input.permission,
        reason: input.reason || null,
        grantedBy: input.grantedBy,
        expiresAt: input.expiresAt || null,
      })
      .returning();

    return result[0];
  }

  async revoke(id: string): Promise<boolean> {
    const result = await this.db
      .delete(rbacAppGrant)
      .where(eq(rbacAppGrant.id, id))
      .returning();

    return result.length > 0;
  }

  async revokeExpired(): Promise<number> {
    const now = new Date();

    const result = await this.db
      .delete(rbacAppGrant)
      .where(
        and(
          sql`${rbacAppGrant.expiresAt} IS NOT NULL`,
          sql`${rbacAppGrant.expiresAt} < ${now}`
        )
      )
      .returning();

    return result.length;
  }

  async countByTenant(tenantId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(rbacAppGrant)
      .innerJoin(app, eq(rbacAppGrant.appId, app.id))
      .where(eq(app.tenantId, tenantId));

    return Number(result[0]?.count || 0);
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createGrantRepository(db: PostgresJsDatabase): GrantRepository {
  return new GrantRepository(db);
}
