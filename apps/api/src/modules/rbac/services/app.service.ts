/**
 * App Service
 *
 * S1-3 workbench service for:
 * - Accessible app listing (all/recent/favorites)
 * - Context options
 * - Favorite and recent usage operations
 */

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, asc, desc, eq, ilike, inArray, lt, or, sql } from "drizzle-orm";
import {
  app,
  appGrant,
  permission,
  rbacRole,
  rbacUserRole,
  rolePermission,
  group,
  groupMember,
  appFavorite,
  appRecentUse,
} from "@agentifui/db/schema";

// =============================================================================
// Types
// =============================================================================

export interface AppContextOption {
  groupId: string;
  groupName: string;
  hasAccess: boolean;
}

export interface AppWithContext {
  id: string;
  name: string;
  description?: string | null;
  mode?: string;
  icon?: string | null;
  iconType?: string | null;
  tags?: string[];
  isFeatured?: boolean;
  sortOrder?: number;
  isFavorite?: boolean;
  lastUsedAt?: string | null;
  currentGroup?: {
    groupId: string;
    groupName: string;
    hasAccess: boolean;
  };
  availableGroups: AppContextOption[];
  requiresSwitch: boolean;
}

export interface AccessibleAppsResult {
  // Keep `apps` for current S1-2/S1-3 E2E compatibility.
  apps: AppWithContext[];
  // Add `items` for S1-3 API contract alignment.
  items: AppWithContext[];
  nextCursor: string | null;
}

export interface AccessibleAppsQuery {
  view?: "all" | "recent" | "favorites";
  q?: string;
  category?: string;
  limit?: number;
  cursor?: string;
}

interface UserGroupMembership {
  groupId: string;
  groupName: string;
}

interface AccessMaps {
  userAllow: Set<string>;
  userDeny: Set<string>;
  groupAllow: Map<string, Set<string>>;
  groupDeny: Map<string, Set<string>>;
}

export class DuplicateFavoriteError extends Error {
  constructor() {
    super("Application is already favorited");
    this.name = "DuplicateFavoriteError";
  }
}

export class FavoriteLimitExceededError extends Error {
  constructor(limit: number) {
    super(`Favorite limit exceeded (max ${limit})`);
    this.name = "FavoriteLimitExceededError";
  }
}

export class AppNotAccessibleError extends Error {
  constructor() {
    super("Application is not accessible");
    this.name = "AppNotAccessibleError";
  }
}

export class AppNotFoundError extends Error {
  constructor() {
    super("Application not found");
    this.name = "AppNotFoundError";
  }
}

// =============================================================================
// App Service Interface
// =============================================================================

export interface IAppService {
  getAccessibleApps(
    userId: string,
    tenantId: string,
    activeGroupId?: string | null,
    query?: AccessibleAppsQuery
  ): Promise<AccessibleAppsResult>;

  getAppContextOptions(
    userId: string,
    tenantId: string,
    appId: string
  ): Promise<{
    currentGroup?: AppContextOption;
    availableGroups: AppContextOption[];
  }>;

  hasAppAccess(
    userId: string,
    tenantId: string,
    appId: string,
    activeGroupId?: string | null
  ): Promise<boolean>;

  getAppsForGroup(
    userId: string,
    tenantId: string,
    groupId: string
  ): Promise<AppWithContext[]>;

  addFavorite(userId: string, tenantId: string, appId: string): Promise<void>;
  removeFavorite(userId: string, tenantId: string, appId: string): Promise<void>;
  markRecentUse(userId: string, tenantId: string, appId: string): Promise<void>;
}

// =============================================================================
// App Service Implementation
// =============================================================================

export class AppService implements IAppService {
  constructor(private readonly db: PostgresJsDatabase) {}

  async getAccessibleApps(
    userId: string,
    tenantId: string,
    activeGroupId?: string | null,
    query: AccessibleAppsQuery = {}
  ): Promise<AccessibleAppsResult> {
    const normalizedView = query.view ?? "all";
    const normalizedLimit = this.normalizeLimit(query.limit);
    const keyword = this.normalizeKeyword(query.q);
    const apps = await this.findTenantApps(tenantId, query);

    if (apps.length === 0) {
      return { apps: [], items: [], nextCursor: null };
    }

    const userGroups = await this.getUserGroups(userId, tenantId);
    const hasGlobalAccess = await this.hasGlobalAppUsePermission(userId, tenantId);
    const appIds = apps.map((a) => a.id);
    const groupIds = userGroups.map((g) => g.groupId);
    const accessMaps = await this.loadAccessMaps(appIds, groupIds, userId);
    const favoriteMap = await this.getFavoriteMap(tenantId, userId, appIds);
    const recentMap = await this.getRecentUseMap(tenantId, userId, appIds);

    const appContexts: AppWithContext[] = [];

    for (const appRecord of apps) {
      const userDenied = accessMaps.userDeny.has(appRecord.id);
      if (userDenied) {
        continue;
      }

      const availableGroups = userGroups
        .map((member) => {
          const groupDenied = accessMaps.groupDeny.get(appRecord.id)?.has(member.groupId) ?? false;
          const groupAllowed = accessMaps.groupAllow.get(appRecord.id)?.has(member.groupId) ?? false;
          const hasAccess = !groupDenied && (groupAllowed || accessMaps.userAllow.has(appRecord.id) || hasGlobalAccess);

          return {
            groupId: member.groupId,
            groupName: member.groupName,
            hasAccess,
          };
        })
        .filter((groupOption) => groupOption.hasAccess);

      if (availableGroups.length === 0 && (accessMaps.userAllow.has(appRecord.id) || hasGlobalAccess)) {
        availableGroups.push({
          groupId: `user:${userId}`,
          groupName: "Personal Access",
          hasAccess: true,
        });
      }

      if (availableGroups.length === 0) {
        continue;
      }

      let currentGroupContext: AppContextOption | undefined;
      if (activeGroupId) {
        currentGroupContext = availableGroups.find((groupOption) => groupOption.groupId === activeGroupId);
      }
      if (!currentGroupContext && availableGroups.length === 1) {
        currentGroupContext = availableGroups[0];
      }

      const requiresSwitch = availableGroups.length > 1 && !currentGroupContext;

      const appItem: AppWithContext = {
        id: appRecord.id,
        name: appRecord.name,
        description: appRecord.description ?? null,
        mode: appRecord.mode,
        icon: appRecord.icon ?? null,
        iconType: appRecord.iconType ?? null,
        tags: this.toStringArray(appRecord.tags),
        isFeatured: appRecord.isFeatured,
        sortOrder: appRecord.sortOrder,
        isFavorite: favoriteMap.has(appRecord.id),
        lastUsedAt: recentMap.get(appRecord.id) ?? null,
        availableGroups,
        requiresSwitch,
      };

      if (currentGroupContext) {
        appItem.currentGroup = currentGroupContext;
      }

      appContexts.push(appItem);
    }

    let filtered = appContexts;

    if (normalizedView === "favorites") {
      filtered = filtered
        .filter((appItem) => appItem.isFavorite)
        .sort((a, b) => {
          const t1 = favoriteMap.get(a.id)?.getTime() ?? 0;
          const t2 = favoriteMap.get(b.id)?.getTime() ?? 0;
          return t2 - t1;
        });
    } else if (normalizedView === "recent") {
      filtered = filtered
        .filter((appItem) => Boolean(appItem.lastUsedAt))
        .sort((a, b) => {
          const t1 = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
          const t2 = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
          return t2 - t1;
        })
        .slice(0, 10);
    } else {
      filtered = [...filtered].sort((a, b) => {
        if (keyword) {
          const scoreDelta = this.computeSearchScore(b, keyword) - this.computeSearchScore(a, keyword);
          if (scoreDelta !== 0) {
            return scoreDelta;
          }
          const lastUsedDelta =
            (b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0) -
            (a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0);
          if (lastUsedDelta !== 0) {
            return lastUsedDelta;
          }
        }

        const featuredDelta = Number(b.isFeatured ?? false) - Number(a.isFeatured ?? false);
        if (featuredDelta !== 0) {
          return featuredDelta;
        }

        const sortOrderDelta = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        if (sortOrderDelta !== 0) {
          return sortOrderDelta;
        }

        return a.name.localeCompare(b.name);
      });
    }

    const startIndex = this.resolveCursorIndex(filtered, query.cursor);
    const effectiveLimit = normalizedView === "recent" ? Math.min(normalizedLimit, 10) : normalizedLimit;
    const items = filtered.slice(startIndex, startIndex + effectiveLimit);
    const hasMore = filtered.length > startIndex + effectiveLimit;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    return {
      apps: items,
      items,
      nextCursor,
    };
  }

  async getAppContextOptions(
    userId: string,
    tenantId: string,
    appId: string
  ): Promise<{
    currentGroup?: AppContextOption;
    availableGroups: AppContextOption[];
  }> {
    const userGroups = await this.getUserGroups(userId, tenantId);
    const hasGlobalAccess = await this.hasGlobalAppUsePermission(userId, tenantId);
    const accessMaps = await this.loadAccessMaps(
      [appId],
      userGroups.map((groupMember) => groupMember.groupId),
      userId
    );

    if (accessMaps.userDeny.has(appId)) {
      return { availableGroups: [] };
    }

    const availableGroups: AppContextOption[] = userGroups.map((member) => {
      const denied = accessMaps.groupDeny.get(appId)?.has(member.groupId) ?? false;
      const allowed = accessMaps.groupAllow.get(appId)?.has(member.groupId) ?? false;
      const hasAccess = !denied && (allowed || accessMaps.userAllow.has(appId) || hasGlobalAccess);

      return {
        groupId: member.groupId,
        groupName: member.groupName,
        hasAccess,
      };
    });

    if (availableGroups.length === 0 && (accessMaps.userAllow.has(appId) || hasGlobalAccess)) {
      availableGroups.push({
        groupId: `user:${userId}`,
        groupName: "Personal Access",
        hasAccess: true,
      });
    }

    const currentGroup = availableGroups.find((groupOption) => groupOption.hasAccess);
    if (currentGroup) {
      return { currentGroup, availableGroups };
    }

    return { availableGroups };
  }

  async hasAppAccess(
    userId: string,
    tenantId: string,
    appId: string,
    activeGroupId?: string | null
  ): Promise<boolean> {
    const { availableGroups } = await this.getAppContextOptions(userId, tenantId, appId);

    if (activeGroupId) {
      const activeGroupOption = availableGroups.find((groupOption) => groupOption.groupId === activeGroupId);
      if (activeGroupOption) {
        return activeGroupOption.hasAccess;
      }
    }

    return availableGroups.some((groupOption) => groupOption.hasAccess);
  }

  async getAppsForGroup(
    userId: string,
    tenantId: string,
    groupId: string
  ): Promise<AppWithContext[]> {
    const result = await this.getAccessibleApps(userId, tenantId, groupId, { view: "all", limit: 100 });
    return result.apps.filter((appItem) => appItem.currentGroup?.groupId === groupId);
  }

  async addFavorite(userId: string, tenantId: string, appId: string): Promise<void> {
    const exists = await this.appExistsInTenant(tenantId, appId);
    if (!exists) {
      throw new AppNotFoundError();
    }

    const hasAccess = await this.hasAppAccess(userId, tenantId, appId);
    if (!hasAccess) {
      throw new AppNotAccessibleError();
    }

    const existing = await this.db
      .select({ id: appFavorite.id })
      .from(appFavorite)
      .where(
        and(
          eq(appFavorite.tenantId, tenantId),
          eq(appFavorite.userId, userId),
          eq(appFavorite.appId, appId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new DuplicateFavoriteError();
    }

    const favoriteCountRows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(appFavorite)
      .where(and(eq(appFavorite.tenantId, tenantId), eq(appFavorite.userId, userId)));
    const favoriteCount = Number(favoriteCountRows[0]?.count ?? 0);
    if (favoriteCount >= 50) {
      throw new FavoriteLimitExceededError(50);
    }

    await this.db.insert(appFavorite).values({
      tenantId,
      userId,
      appId,
    });
  }

  async removeFavorite(userId: string, tenantId: string, appId: string): Promise<void> {
    await this.db
      .delete(appFavorite)
      .where(
        and(
          eq(appFavorite.tenantId, tenantId),
          eq(appFavorite.userId, userId),
          eq(appFavorite.appId, appId)
        )
      );
  }

  async markRecentUse(userId: string, tenantId: string, appId: string): Promise<void> {
    const exists = await this.appExistsInTenant(tenantId, appId);
    if (!exists) {
      throw new AppNotFoundError();
    }

    const hasAccess = await this.hasAppAccess(userId, tenantId, appId);
    if (!hasAccess) {
      throw new AppNotAccessibleError();
    }

    await this.db
      .insert(appRecentUse)
      .values({
        tenantId,
        userId,
        appId,
        lastUsedAt: new Date(),
        useCount: 1,
      })
      .onConflictDoUpdate({
        target: [appRecentUse.tenantId, appRecentUse.userId, appRecentUse.appId],
        set: {
          lastUsedAt: new Date(),
          useCount: sql`${appRecentUse.useCount} + 1`,
        },
      });

    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 30);

    await this.db
      .delete(appRecentUse)
      .where(
        and(
          eq(appRecentUse.tenantId, tenantId),
          eq(appRecentUse.userId, userId),
          lt(appRecentUse.lastUsedAt, cutoff)
        )
      );

    const rows = await this.db
      .select({ id: appRecentUse.id })
      .from(appRecentUse)
      .where(and(eq(appRecentUse.tenantId, tenantId), eq(appRecentUse.userId, userId)))
      .orderBy(desc(appRecentUse.lastUsedAt))
      .limit(100);

    if (rows.length > 10) {
      const staleIds = rows.slice(10).map((row) => row.id);
      await this.db
        .delete(appRecentUse)
        .where(
          and(
            eq(appRecentUse.tenantId, tenantId),
            eq(appRecentUse.userId, userId),
            inArray(appRecentUse.id, staleIds)
          )
        );
    }
  }

  // =============================================================================
  // Internal helpers
  // =============================================================================

  private async findTenantApps(tenantId: string, query: AccessibleAppsQuery) {
    const conditions = [eq(app.tenantId, tenantId), eq(app.status, "active")];

    const keyword = this.normalizeKeyword(query.q);
    if (keyword) {
      conditions.push(
        or(
          ilike(app.name, `%${keyword}%`),
          ilike(app.description, `%${keyword}%`),
          sql`${app.tags}::text ILIKE ${`%${keyword}%`}`
        ) as any
      );
    }

    if (query.category) {
      conditions.push(eq(app.mode, query.category));
    }

    return this.db
      .select({
        id: app.id,
        name: app.name,
        description: app.description,
        mode: app.mode,
        icon: app.icon,
        iconType: app.iconType,
        isFeatured: app.isFeatured,
        sortOrder: app.sortOrder,
        tags: app.tags,
      })
      .from(app)
      .where(and(...conditions))
      .orderBy(desc(app.isFeatured), asc(app.sortOrder), asc(app.name));
  }

  private async appExistsInTenant(tenantId: string, appId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: app.id })
      .from(app)
      .where(and(eq(app.tenantId, tenantId), eq(app.id, appId)))
      .limit(1);

    return rows.length > 0;
  }

  private async getUserGroups(userId: string, tenantId: string): Promise<UserGroupMembership[]> {
    return this.db
      .select({
        groupId: group.id,
        groupName: group.name,
      })
      .from(groupMember)
      .innerJoin(group, eq(groupMember.groupId, group.id))
      .where(
        and(
          eq(groupMember.userId, userId),
          eq(group.tenantId, tenantId),
          sql`${groupMember.removedAt} IS NULL`
        )
      )
      .orderBy(asc(group.name));
  }

  private async hasGlobalAppUsePermission(userId: string, tenantId: string): Promise<boolean> {
    const now = new Date();

    const matches = await this.db
      .select({ permissionId: permission.id })
      .from(rbacUserRole)
      .innerJoin(rbacRole, eq(rbacUserRole.roleId, rbacRole.id))
      .innerJoin(rolePermission, eq(rolePermission.roleId, rbacRole.id))
      .innerJoin(permission, eq(permission.id, rolePermission.permissionId))
      .where(
        and(
          eq(rbacUserRole.userId, userId),
          eq(rbacUserRole.tenantId, tenantId),
          eq(rbacRole.isActive, true),
          eq(permission.code, "app:use"),
          eq(permission.isActive, true),
          or(
            sql`${rbacUserRole.expiresAt} IS NULL`,
            sql`${rbacUserRole.expiresAt} > ${now}`
          )
        )
      )
      .limit(1);

    return matches.length > 0;
  }

  private async loadAccessMaps(
    appIds: string[],
    groupIds: string[],
    userId: string
  ): Promise<AccessMaps> {
    if (appIds.length === 0) {
      return {
        userAllow: new Set(),
        userDeny: new Set(),
        groupAllow: new Map(),
        groupDeny: new Map(),
      };
    }

    const now = new Date();

    const userGrants = await this.db
      .select({
        appId: appGrant.appId,
        permission: appGrant.permission,
      })
      .from(appGrant)
      .where(
        and(
          inArray(appGrant.appId, appIds),
          eq(appGrant.granteeType, "user"),
          eq(appGrant.granteeId, userId),
          or(
            sql`${appGrant.expiresAt} IS NULL`,
            sql`${appGrant.expiresAt} > ${now}`
          )
        )
      );

    const groupGrants = groupIds.length
      ? await this.db
          .select({
            appId: appGrant.appId,
            groupId: appGrant.granteeId,
            permission: appGrant.permission,
          })
          .from(appGrant)
          .where(
            and(
              inArray(appGrant.appId, appIds),
              eq(appGrant.granteeType, "group"),
              inArray(appGrant.granteeId, groupIds),
              or(
                sql`${appGrant.expiresAt} IS NULL`,
                sql`${appGrant.expiresAt} > ${now}`
              )
            )
          )
      : [];

    const userAllow = new Set<string>();
    const userDeny = new Set<string>();
    const groupAllow = new Map<string, Set<string>>();
    const groupDeny = new Map<string, Set<string>>();

    for (const grant of userGrants) {
      if (grant.permission === "deny") {
        userDeny.add(grant.appId);
      } else {
        userAllow.add(grant.appId);
      }
    }

    for (const grant of groupGrants) {
      const target = grant.permission === "deny" ? groupDeny : groupAllow;
      if (!target.has(grant.appId)) {
        target.set(grant.appId, new Set<string>());
      }
      target.get(grant.appId)?.add(grant.groupId);
    }

    return { userAllow, userDeny, groupAllow, groupDeny };
  }

  private async getFavoriteMap(
    tenantId: string,
    userId: string,
    appIds: string[]
  ): Promise<Map<string, Date>> {
    if (appIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({
        appId: appFavorite.appId,
        createdAt: appFavorite.createdAt,
      })
      .from(appFavorite)
      .where(
        and(
          eq(appFavorite.tenantId, tenantId),
          eq(appFavorite.userId, userId),
          inArray(appFavorite.appId, appIds)
        )
      );

    const map = new Map<string, Date>();
    for (const row of rows) {
      map.set(row.appId, row.createdAt);
    }
    return map;
  }

  private async getRecentUseMap(
    tenantId: string,
    userId: string,
    appIds: string[]
  ): Promise<Map<string, string>> {
    if (appIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({
        appId: appRecentUse.appId,
        lastUsedAt: appRecentUse.lastUsedAt,
      })
      .from(appRecentUse)
      .where(
        and(
          eq(appRecentUse.tenantId, tenantId),
          eq(appRecentUse.userId, userId),
          inArray(appRecentUse.appId, appIds)
        )
      )
      .orderBy(desc(appRecentUse.lastUsedAt));

    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.appId, row.lastUsedAt.toISOString());
    }
    return map;
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || Number.isNaN(limit)) {
      return 20;
    }
    return Math.min(Math.max(limit, 1), 100);
  }

  private normalizeKeyword(keyword?: string): string {
    if (!keyword) {
      return "";
    }
    return keyword.trim().slice(0, 100);
  }

  private resolveCursorIndex(items: AppWithContext[], cursor?: string): number {
    if (!cursor) {
      return 0;
    }
    const index = items.findIndex((item) => item.id === cursor);
    return index >= 0 ? index + 1 : 0;
  }

  private computeSearchScore(item: AppWithContext, keyword: string): number {
    const normalized = keyword.toLowerCase();
    const name = item.name.toLowerCase();
    const description = (item.description ?? "").toLowerCase();
    const tags = (item.tags ?? []).map((tag) => tag.toLowerCase());

    let score = 0;
    if (name === normalized) {
      score += 200;
    } else if (name.startsWith(normalized)) {
      score += 120;
    } else if (name.includes(normalized)) {
      score += 80;
    }

    if (description.includes(normalized)) {
      score += 40;
    }

    if (tags.some((tag) => tag === normalized)) {
      score += 60;
    } else if (tags.some((tag) => tag.includes(normalized))) {
      score += 30;
    }

    return score;
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((item) => String(item));
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createAppService(db: PostgresJsDatabase): AppService {
  return new AppService(db);
}
