import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { getDatabase } from "@agentifui/db/client";
import { analyticsHourly, app, conversation, run, userRole } from "@agentifui/db/schema";
import type {
  AnalyticsDashboard,
  AnalyticsRankItem,
  AnalyticsTrendPoint,
} from "@agentifui/shared/types";
import { createCostEstimator, type CostEstimator } from "./cost-estimator.service.js";

function clampWindowDays(value: number | undefined): number {
  const safe = Math.floor(value ?? 30);
  if (!Number.isFinite(safe) || safe <= 0) {
    return 30;
  }
  if (safe > 90) {
    return 90;
  }
  return safe;
}

function startOfHour(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), 0, 0, 0));
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toSortedTopN(map: Map<string, AnalyticsRankItem>, n = 20): AnalyticsRankItem[] {
  return [...map.values()]
    .sort((a, b) => b.tokenCount - a.tokenCount || b.costUsd - a.costUsd || b.requestCount - a.requestCount)
    .slice(0, n);
}

export interface AnalyticsDashboardInput {
  tenantId: string;
  windowDays?: number;
  groupId?: string;
}

export class AnalyticsAggregator {
  private readonly db: PostgresJsDatabase;
  private readonly costEstimator: CostEstimator;

  constructor(
    db: PostgresJsDatabase = getDatabase() as PostgresJsDatabase,
    costEstimator?: CostEstimator
  ) {
    this.db = db;
    this.costEstimator = costEstimator ?? createCostEstimator(db);
  }

  async getDashboard(input: AnalyticsDashboardInput): Promise<AnalyticsDashboard> {
    const now = new Date();
    const windowDays = clampWindowDays(input.windowDays);
    const startAt = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
    const dayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const baseConditions = [eq(run.tenantId, input.tenantId), gte(run.createdAt, startAt)];
    if (input.groupId) {
      baseConditions.push(eq(run.activeGroupId, input.groupId));
    }

    const runs = await this.db
      .select({
        id: run.id,
        userId: run.userId,
        appId: run.appId,
        model: run.model,
        totalTokens: run.totalTokens,
        createdAt: run.createdAt,
      })
      .from(run)
      .where(and(...baseConditions))
      .orderBy(desc(run.createdAt))
      .limit(50_000);

    const runCosts = await this.costEstimator.estimateForRuns({
      tenantId: input.tenantId,
      startAt,
      endAt: now,
      groupId: input.groupId,
    });

    const [totalUsersRow] = await this.db
      .select({ total: sql<number>`count(distinct ${userRole.userId})` })
      .from(userRole)
      .where(eq(userRole.tenantId, input.tenantId));

    const [totalConversationRow] = await this.db
      .select({ total: sql<number>`count(*)` })
      .from(conversation)
      .where(eq(conversation.tenantId, input.tenantId));

    const [dauRow] = await this.db
      .select({ total: sql<number>`count(distinct ${run.userId})` })
      .from(run)
      .where(and(eq(run.tenantId, input.tenantId), gte(run.createdAt, dayStart)));

    const [mauRow] = await this.db
      .select({ total: sql<number>`count(distinct ${run.userId})` })
      .from(run)
      .where(and(eq(run.tenantId, input.tenantId), gte(run.createdAt, monthStart)));

    const appRows = await this.db
      .select({ id: app.id, name: app.name })
      .from(app)
      .where(eq(app.tenantId, input.tenantId));
    const appNameById = new Map(appRows.map((row) => [row.id, row.name]));

    const topUsersMap = new Map<string, AnalyticsRankItem>();
    const appUsageMap = new Map<string, AnalyticsRankItem>();
    const modelUsageMap = new Map<string, AnalyticsRankItem>();
    const trendMap = new Map<string, AnalyticsTrendPoint>();

    let totalTokens = 0;
    for (const row of runs) {
      totalTokens += row.totalTokens;
    }

    let totalCostUsd = 0;
    for (const row of runCosts) {
      totalCostUsd += row.costUsd;

      const userKey = row.userId;
      const userItem = topUsersMap.get(userKey) ?? {
        id: row.userId,
        label: row.userId,
        requestCount: 0,
        tokenCount: 0,
        costUsd: 0,
      };
      userItem.requestCount += 1;
      userItem.tokenCount += row.totalTokens;
      userItem.costUsd = Number((userItem.costUsd + row.costUsd).toFixed(8));
      topUsersMap.set(userKey, userItem);

      const appKey = row.appId;
      const appItem = appUsageMap.get(appKey) ?? {
        id: row.appId,
        label: appNameById.get(row.appId) ?? row.appId,
        requestCount: 0,
        tokenCount: 0,
        costUsd: 0,
      };
      appItem.requestCount += 1;
      appItem.tokenCount += row.totalTokens;
      appItem.costUsd = Number((appItem.costUsd + row.costUsd).toFixed(8));
      appUsageMap.set(appKey, appItem);

      const modelKey = row.model;
      const modelItem = modelUsageMap.get(modelKey) ?? {
        id: modelKey,
        label: modelKey,
        requestCount: 0,
        tokenCount: 0,
        costUsd: 0,
      };
      modelItem.requestCount += 1;
      modelItem.tokenCount += row.totalTokens;
      modelItem.costUsd = Number((modelItem.costUsd + row.costUsd).toFixed(8));
      modelUsageMap.set(modelKey, modelItem);

      const bucket = dayKey(row.createdAt);
      const trendItem = trendMap.get(bucket) ?? {
        at: `${bucket}T00:00:00.000Z`,
        requestCount: 0,
        tokenCount: 0,
        costUsd: 0,
      };
      trendItem.requestCount += 1;
      trendItem.tokenCount += row.totalTokens;
      trendItem.costUsd = Number((trendItem.costUsd + row.costUsd).toFixed(8));
      trendMap.set(bucket, trendItem);
    }

    return {
      overview: {
        totalUsers: Number(totalUsersRow?.total ?? 0),
        activeUsersDau: Number(dauRow?.total ?? 0),
        activeUsersMau: Number(mauRow?.total ?? 0),
        totalConversations: Number(totalConversationRow?.total ?? 0),
        totalRuns: runs.length,
        totalTokens,
        totalCostUsd: Number(totalCostUsd.toFixed(8)),
      },
      topUsers: toSortedTopN(topUsersMap, 20),
      appUsage: toSortedTopN(appUsageMap, 50),
      modelUsage: toSortedTopN(modelUsageMap, 20),
      trend: [...trendMap.values()].sort((a, b) => a.at.localeCompare(b.at)),
      refreshedAt: now.toISOString(),
    };
  }

  /**
   * Refreshes the hourly pre-aggregation table.
   * This is designed to be triggered every 5 minutes by a scheduler.
   */
  async refreshHourly(tenantId: string, anchor = new Date()): Promise<void> {
    const hour = startOfHour(anchor);
    const nextHour = new Date(hour.getTime() + 60 * 60 * 1000);

    const rows = await this.db
      .select({
        userId: run.userId,
        appId: run.appId,
        model: run.model,
        groupId: run.activeGroupId,
        totalTokens: run.totalTokens,
      })
      .from(run)
      .where(and(eq(run.tenantId, tenantId), gte(run.createdAt, hour), sql`${run.createdAt} < ${nextHour}`));

    const stats = new Map<string, { requestCount: number; tokenCount: number }>();
    for (const row of rows) {
      const dimensions = [
        `user:${row.userId}`,
        `app:${row.appId}`,
        `model:${row.model ?? "unknown"}`,
      ];
      for (const dimension of dimensions) {
        const current = stats.get(dimension) ?? { requestCount: 0, tokenCount: 0 };
        current.requestCount += 1;
        current.tokenCount += row.totalTokens;
        stats.set(dimension, current);
      }
    }

    for (const [dimensionKey, value] of stats) {
      const [dimension, dimensionValue] = dimensionKey.split(":");
      if (!dimension || !dimensionValue) {
        continue;
      }

      await this.db
        .insert(analyticsHourly)
        .values({
          tenantId,
          hour,
          dimension,
          dimensionValue,
          requestCount: value.requestCount,
          tokenCount: value.tokenCount,
          costUsd: 0,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            analyticsHourly.tenantId,
            analyticsHourly.groupId,
            analyticsHourly.appId,
            analyticsHourly.hour,
            analyticsHourly.dimension,
            analyticsHourly.dimensionValue,
          ],
          set: {
            requestCount: value.requestCount,
            tokenCount: value.tokenCount,
            updatedAt: new Date(),
          },
        });
    }
  }
}

export function createAnalyticsAggregator(db?: PostgresJsDatabase): AnalyticsAggregator {
  const safeDb = db ?? (getDatabase() as PostgresJsDatabase);
  return new AnalyticsAggregator(safeDb, createCostEstimator(safeDb));
}
