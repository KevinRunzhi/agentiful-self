/**
 * Quota Repository
 *
 * Data access helpers for S1-3 quota policy, counters, usage ledger, and alerts.
 */

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, asc, eq, or, sql } from "drizzle-orm";
import {
  appGrant,
  group,
  groupMember,
  quotaPolicy,
  quotaCounter,
  quotaUsageLedger,
  quotaAlertEvent,
  rbacRole,
  rbacUserRole,
  tenant,
} from "@agentifui/db/schema";

type QuotaScopeType = "tenant" | "group" | "user";
type QuotaMeteringMode = "token" | "request";

export interface QuotaPolicyRecord {
  id: string;
  tenantId: string;
  scopeType: QuotaScopeType;
  scopeId: string;
  metricType: QuotaMeteringMode;
  periodType: "month" | "week";
  limitValue: number;
  alertThresholds: number[];
  isActive: boolean;
}

export interface QuotaCounterRecord {
  id: string;
  policyId: string;
  periodStart: Date;
  periodEnd: Date;
  usedValue: number;
  version: number;
}

export interface InsertQuotaUsageLedgerInput {
  tenantId: string;
  groupId?: string | null;
  userId: string;
  appId: string;
  runId?: string | null;
  model?: string | null;
  meteringMode: QuotaMeteringMode;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  traceId?: string;
}

export interface UpsertQuotaPolicyInput {
  tenantId: string;
  scopeType: QuotaScopeType;
  scopeId: string;
  meteringMode: QuotaMeteringMode;
  periodType: "month" | "week";
  limitValue: number;
  alertThresholds?: number[];
  isActive?: boolean;
}

export interface InsertQuotaAlertEventInput {
  tenantId: string;
  policyId: string;
  periodStart: Date;
  threshold: number;
  usedValue: number;
  limitValue: number;
  traceId?: string;
  channel?: string;
}

export class QuotaRepository {
  constructor(private readonly db: PostgresJsDatabase) {}

  async scopeBelongsToTenant(
    tenantId: string,
    scopeType: QuotaScopeType,
    scopeId: string
  ): Promise<boolean> {
    if (scopeType === "tenant") {
      const rows = await this.db
        .select({ id: tenant.id })
        .from(tenant)
        .where(and(eq(tenant.id, tenantId), eq(tenant.id, scopeId)))
        .limit(1);
      return rows.length > 0;
    }

    if (scopeType === "group") {
      const rows = await this.db
        .select({ id: group.id })
        .from(group)
        .where(and(eq(group.id, scopeId), eq(group.tenantId, tenantId)))
        .limit(1);
      return rows.length > 0;
    }

    const activeGroupMembership = await this.db
      .select({ id: groupMember.id })
      .from(groupMember)
      .innerJoin(group, eq(groupMember.groupId, group.id))
      .where(
        and(
          eq(groupMember.userId, scopeId),
          eq(group.tenantId, tenantId),
          sql`${groupMember.removedAt} IS NULL`
        )
      )
      .limit(1);

    if (activeGroupMembership.length > 0) {
      return true;
    }

    const tenantRoles = await this.db
      .select({ userId: rbacUserRole.userId })
      .from(rbacUserRole)
      .where(and(eq(rbacUserRole.userId, scopeId), eq(rbacUserRole.tenantId, tenantId)))
      .limit(1);

    return tenantRoles.length > 0;
  }

  async upsertPolicy(input: UpsertQuotaPolicyInput): Promise<QuotaPolicyRecord> {
    const rows = await this.db
      .insert(quotaPolicy)
      .values({
        tenantId: input.tenantId,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        metricType: input.meteringMode,
        periodType: input.periodType,
        limitValue: input.limitValue,
        alertThresholds: input.alertThresholds ?? [80, 90, 100],
        isActive: input.isActive ?? true,
      })
      .onConflictDoUpdate({
        target: [
          quotaPolicy.tenantId,
          quotaPolicy.scopeType,
          quotaPolicy.scopeId,
          quotaPolicy.metricType,
          quotaPolicy.periodType,
        ],
        set: {
          limitValue: input.limitValue,
          alertThresholds: input.alertThresholds ?? [80, 90, 100],
          isActive: input.isActive ?? true,
          updatedAt: new Date(),
        },
      })
      .returning();

    const first = rows[0];
    if (!first) {
      throw new Error("Failed to upsert quota policy");
    }

    return {
      id: first.id,
      tenantId: first.tenantId,
      scopeType: first.scopeType as QuotaScopeType,
      scopeId: first.scopeId,
      metricType: first.metricType as QuotaMeteringMode,
      periodType: first.periodType as "month" | "week",
      limitValue: Number(first.limitValue),
      alertThresholds: Array.isArray(first.alertThresholds)
        ? first.alertThresholds.map((value) => Number(value))
        : [80, 90, 100],
      isActive: first.isActive,
    };
  }

  async listPolicies(
    tenantId: string,
    filters?: {
      scopeType?: QuotaScopeType;
      scopeId?: string;
      meteringMode?: QuotaMeteringMode;
      periodType?: "month" | "week";
      isActive?: boolean;
    }
  ): Promise<QuotaPolicyRecord[]> {
    const conditions = [eq(quotaPolicy.tenantId, tenantId)];

    if (filters?.scopeType) {
      conditions.push(eq(quotaPolicy.scopeType, filters.scopeType));
    }
    if (filters?.scopeId) {
      conditions.push(eq(quotaPolicy.scopeId, filters.scopeId));
    }
    if (filters?.meteringMode) {
      conditions.push(eq(quotaPolicy.metricType, filters.meteringMode));
    }
    if (filters?.periodType) {
      conditions.push(eq(quotaPolicy.periodType, filters.periodType));
    }
    if (typeof filters?.isActive === "boolean") {
      conditions.push(eq(quotaPolicy.isActive, filters.isActive));
    }

    const rows = await this.db
      .select()
      .from(quotaPolicy)
      .where(and(...conditions))
      .orderBy(
        asc(quotaPolicy.scopeType),
        asc(quotaPolicy.scopeId),
        asc(quotaPolicy.metricType),
        asc(quotaPolicy.periodType)
      );

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      scopeType: row.scopeType as QuotaScopeType,
      scopeId: row.scopeId,
      metricType: row.metricType as QuotaMeteringMode,
      periodType: row.periodType as "month" | "week",
      limitValue: Number(row.limitValue),
      alertThresholds: Array.isArray(row.alertThresholds)
        ? row.alertThresholds.map((value) => Number(value))
        : [80, 90, 100],
      isActive: row.isActive,
    }));
  }

  async listTenantAdminUserIds(tenantId: string): Promise<string[]> {
    const now = new Date();
    const rows = await this.db
      .select({ userId: rbacUserRole.userId })
      .from(rbacUserRole)
      .innerJoin(rbacRole, eq(rbacUserRole.roleId, rbacRole.id))
      .where(
        and(
          eq(rbacUserRole.tenantId, tenantId),
          eq(rbacRole.name, "tenant_admin"),
          eq(rbacRole.isActive, true),
          or(sql`${rbacUserRole.expiresAt} IS NULL`, sql`${rbacUserRole.expiresAt} > ${now}`)
        )
      );

    return [...new Set(rows.map((row) => row.userId))];
  }

  async listGroupManagerUserIds(tenantId: string, groupId: string): Promise<string[]> {
    const rows = await this.db
      .select({ userId: groupMember.userId })
      .from(groupMember)
      .innerJoin(group, eq(groupMember.groupId, group.id))
      .where(
        and(
          eq(group.id, groupId),
          eq(group.tenantId, tenantId),
          eq(groupMember.role, "manager"),
          sql`${groupMember.removedAt} IS NULL`
        )
      );

    return [...new Set(rows.map((row) => row.userId))];
  }

  async hasActiveGroupMembership(
    tenantId: string,
    userId: string,
    groupId: string
  ): Promise<boolean> {
    const rows = await this.db
      .select({ id: groupMember.id })
      .from(groupMember)
      .innerJoin(group, eq(groupMember.groupId, group.id))
      .where(
        and(
          eq(groupMember.userId, userId),
          eq(groupMember.groupId, groupId),
          eq(group.tenantId, tenantId),
          sql`${groupMember.removedAt} IS NULL`
        )
      )
      .limit(1);

    return rows.length > 0;
  }

  async findDefaultGroupId(tenantId: string, userId: string): Promise<string | null> {
    const rows = await this.db
      .select({ groupId: groupMember.groupId })
      .from(groupMember)
      .innerJoin(group, eq(groupMember.groupId, group.id))
      .where(
        and(
          eq(groupMember.userId, userId),
          eq(group.tenantId, tenantId),
          sql`${groupMember.removedAt} IS NULL`
        )
      )
      .orderBy(
        asc(group.sortOrder),
        asc(group.name),
        asc(groupMember.addedAt)
      )
      .limit(1);

    return rows[0]?.groupId ?? null;
  }

  async getUserAppGrantPermission(
    userId: string,
    appId: string
  ): Promise<"use" | "deny" | null> {
    const now = new Date();
    const rows = await this.db
      .select({
        permission: appGrant.permission,
      })
      .from(appGrant)
      .where(
        and(
          eq(appGrant.appId, appId),
          eq(appGrant.granteeType, "user"),
          eq(appGrant.granteeId, userId),
          or(sql`${appGrant.expiresAt} IS NULL`, sql`${appGrant.expiresAt} > ${now}`)
        )
      );

    if (rows.some((row) => row.permission === "deny")) {
      return "deny";
    }
    if (rows.some((row) => row.permission === "use")) {
      return "use";
    }

    return null;
  }

  async hasGroupAppGrant(groupId: string, appId: string): Promise<boolean> {
    const now = new Date();
    const rows = await this.db
      .select({
        permission: appGrant.permission,
      })
      .from(appGrant)
      .where(
        and(
          eq(appGrant.appId, appId),
          eq(appGrant.granteeType, "group"),
          eq(appGrant.granteeId, groupId),
          or(sql`${appGrant.expiresAt} IS NULL`, sql`${appGrant.expiresAt} > ${now}`)
        )
      );

    if (rows.some((row) => row.permission === "deny")) {
      return false;
    }

    return rows.some((row) => row.permission === "use");
  }

  async findDefaultGroupIdForApp(
    tenantId: string,
    userId: string,
    appId: string
  ): Promise<string | null> {
    const memberships = await this.db
      .select({ groupId: groupMember.groupId })
      .from(groupMember)
      .innerJoin(group, eq(groupMember.groupId, group.id))
      .where(
        and(
          eq(groupMember.userId, userId),
          eq(group.tenantId, tenantId),
          sql`${groupMember.removedAt} IS NULL`
        )
      )
      .orderBy(asc(group.sortOrder), asc(group.name), asc(groupMember.addedAt));

    for (const membership of memberships) {
      const hasGrant = await this.hasGroupAppGrant(membership.groupId, appId);
      if (hasGrant) {
        return membership.groupId;
      }
    }

    return null;
  }

  async findActivePolicy(
    tenantId: string,
    scopeType: QuotaScopeType,
    scopeId: string,
    meteringMode: QuotaMeteringMode
  ): Promise<QuotaPolicyRecord | null> {
    const rows = await this.db
      .select()
      .from(quotaPolicy)
      .where(
        and(
          eq(quotaPolicy.tenantId, tenantId),
          eq(quotaPolicy.scopeType, scopeType),
          eq(quotaPolicy.scopeId, scopeId),
          eq(quotaPolicy.metricType, meteringMode),
          eq(quotaPolicy.isActive, true)
        )
      )
      .limit(1);

    const first = rows[0];
    if (!first) {
      return null;
    }

    return {
      id: first["id"],
      tenantId: first["tenantId"],
      scopeType: first["scopeType"] as QuotaScopeType,
      scopeId: first["scopeId"],
      metricType: first["metricType"] as QuotaMeteringMode,
      periodType: first["periodType"] as "month" | "week",
      limitValue: Number(first["limitValue"]),
      alertThresholds: Array.isArray(first["alertThresholds"])
        ? first["alertThresholds"].map((n) => Number(n))
        : [80, 90, 100],
      isActive: first["isActive"],
    };
  }

  async getCounter(policyId: string, periodStart: Date): Promise<QuotaCounterRecord | null> {
    const rows = await this.db
      .select()
      .from(quotaCounter)
      .where(
        and(
          eq(quotaCounter.policyId, policyId),
          eq(quotaCounter.periodStart, periodStart)
        )
      )
      .limit(1);

    const first = rows[0];
    if (!first) {
      return null;
    }

    return {
      id: first["id"],
      policyId: first["policyId"],
      periodStart: first["periodStart"],
      periodEnd: first["periodEnd"],
      usedValue: Number(first["usedValue"]),
      version: first["version"],
    };
  }

  async incrementCounter(
    policyId: string,
    periodStart: Date,
    periodEnd: Date,
    incrementBy: number
  ): Promise<QuotaCounterRecord> {
    const rows = await this.db
      .insert(quotaCounter)
      .values({
        policyId,
        periodStart,
        periodEnd,
        usedValue: incrementBy,
        version: 1,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [quotaCounter.policyId, quotaCounter.periodStart],
        set: {
          usedValue: sql`${quotaCounter.usedValue} + ${incrementBy}`,
          version: sql`${quotaCounter.version} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning();

    const first = rows[0];
    if (!first) {
      throw new Error("Failed to increment quota counter");
    }

    return {
      id: first["id"],
      policyId: first["policyId"],
      periodStart: first["periodStart"],
      periodEnd: first["periodEnd"],
      usedValue: Number(first["usedValue"]),
      version: first["version"],
    };
  }

  async incrementCounterCapped(
    policyId: string,
    periodStart: Date,
    periodEnd: Date,
    incrementBy: number,
    limitValue: number
  ): Promise<QuotaCounterRecord | null> {
    const rows = await this.db.execute(sql`
      INSERT INTO quota_counter (policy_id, period_start, period_end, used_value, version, updated_at)
      SELECT ${policyId}, ${periodStart}, ${periodEnd}, ${incrementBy}, 1, NOW()
      WHERE ${incrementBy} <= ${limitValue}
      ON CONFLICT (policy_id, period_start)
      DO UPDATE SET
        used_value = quota_counter.used_value + ${incrementBy},
        version = quota_counter.version + 1,
        updated_at = NOW()
      WHERE quota_counter.used_value + ${incrementBy} <= ${limitValue}
      RETURNING id, policy_id, period_start, period_end, used_value, version
    `);

    const rowList = Array.isArray(rows) ? rows : ((rows as any).rows ?? []);
    const first = rowList[0] as
      | {
          id: string;
          policy_id: string;
          period_start: Date;
          period_end: Date;
          used_value: number;
          version: number;
        }
      | undefined;

    if (!first) {
      return null;
    }

    return {
      id: first.id,
      policyId: first.policy_id,
      periodStart: first.period_start,
      periodEnd: first.period_end,
      usedValue: Number(first.used_value),
      version: first.version,
    };
  }

  async insertUsageLedger(input: InsertQuotaUsageLedgerInput): Promise<void> {
    const values: {
      tenantId: string;
      groupId: string | null;
      userId: string;
      appId: string;
      runId: string | null;
      model: string | null;
      meteringMode: QuotaMeteringMode;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      traceId?: string;
    } = {
      tenantId: input.tenantId,
      groupId: input.groupId ?? null,
      userId: input.userId,
      appId: input.appId,
      runId: input.runId ?? null,
      model: input.model ?? null,
      meteringMode: input.meteringMode,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens: input.totalTokens,
    };

    if (input.traceId) {
      values.traceId = input.traceId;
    }

    await this.db.insert(quotaUsageLedger).values(values);
  }

  async insertAlertEventIfAbsent(input: InsertQuotaAlertEventInput): Promise<boolean> {
    const values: {
      tenantId: string;
      policyId: string;
      periodStart: Date;
      threshold: number;
      usedValue: number;
      limitValue: number;
      channel: string;
      status: string;
      traceId?: string;
    } = {
      tenantId: input.tenantId,
      policyId: input.policyId,
      periodStart: input.periodStart,
      threshold: input.threshold,
      usedValue: input.usedValue,
      limitValue: input.limitValue,
      channel: input.channel ?? "in_app",
      status: "sent",
    };

    if (input.traceId) {
      values.traceId = input.traceId;
    }

    const rows = await this.db
      .insert(quotaAlertEvent)
      .values(values)
      .onConflictDoNothing({
        target: [
          quotaAlertEvent.policyId,
          quotaAlertEvent.periodStart,
          quotaAlertEvent.threshold,
          quotaAlertEvent.channel,
        ],
      })
      .returning({ id: quotaAlertEvent.id });

    return rows.length > 0;
  }

  async cleanupExpiredCounters(now: Date): Promise<number> {
    const rows = await this.db
      .delete(quotaCounter)
      .where(sql`${quotaCounter.periodEnd} <= ${now}`)
      .returning({ id: quotaCounter.id });

    return rows.length;
  }
}

export function createQuotaRepository(db: PostgresJsDatabase): QuotaRepository {
  return new QuotaRepository(db);
}
