import { randomBytes, createCipheriv, createHash } from "node:crypto";
import { getDatabase } from "@agentifui/db/client";
import {
  app,
  appGrant,
  group,
  groupMember,
  invitation,
  quotaPolicy,
  quotaUsageLedger,
  rbacRole,
  rbacUserRole,
  session,
  user,
  userRole,
} from "@agentifui/db/schema";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createQuotaRepository } from "../quota/repositories/quota.repository.js";

type ScopeType = "tenant" | "group" | "user";
type MeteringMode = "token" | "request";
type PeriodType = "month" | "week";

interface RouteContext {
  db: any;
  tenantId: string;
  userId: string;
  isTenantAdmin: boolean;
  managedGroupIds: string[];
}

function getRequestDb(request: FastifyRequest): unknown {
  const dbFromRequest = (request as { db?: unknown }).db;
  const dbFromServer = (request.server as { db?: unknown }).db;
  if (dbFromRequest || dbFromServer) {
    return dbFromRequest ?? dbFromServer;
  }

  try {
    return getDatabase();
  } catch {
    return undefined;
  }
}

function getRequestUserId(request: FastifyRequest): string | undefined {
  const userFromRequest = (request as { user?: { id?: string } }).user?.id;
  if (userFromRequest) {
    return userFromRequest;
  }
  const headerUser = request.headers["x-user-id"];
  if (typeof headerUser === "string" && headerUser.trim()) {
    return headerUser.trim();
  }
  return undefined;
}

function getRequestTenantId(request: FastifyRequest): string | undefined {
  const userTenantId = (request as { user?: { tenantId?: string } }).user?.tenantId;
  if (userTenantId) {
    return userTenantId;
  }
  const headerTenant = request.headers["x-tenant-id"];
  if (typeof headerTenant === "string" && headerTenant.trim()) {
    return headerTenant.trim();
  }
  return undefined;
}

function badRequest(reply: FastifyReply, code: string, message: string) {
  return reply.status(400).send({
    errors: [{ code, message }],
  });
}

function unauthorized(reply: FastifyReply) {
  return reply.status(401).send({
    errors: [{ code: "UNAUTHORIZED", message: "Authentication required" }],
  });
}

function forbidden(reply: FastifyReply, message = "Insufficient permissions") {
  return reply.status(403).send({
    errors: [{ code: "FORBIDDEN", message }],
  });
}

function serviceUnavailable(reply: FastifyReply, message = "Database context unavailable") {
  return reply.status(503).send({
    errors: [{ code: "SERVICE_UNAVAILABLE", message }],
  });
}

function normalizePageSize(input: unknown): number {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return 20;
  }
  return Math.min(100, Math.max(1, Math.floor(input)));
}

function normalizeOffset(input: unknown): number {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return 0;
  }
  return Math.max(0, Math.floor(input));
}

function toIsoDate(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseDateMaybe(input: unknown): Date | null {
  if (!input || typeof input !== "string") {
    return null;
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function createToken(): string {
  return randomBytes(24).toString("base64url");
}

function deriveCredentialKey(): Buffer {
  const raw = process.env["APP_CREDENTIAL_ENCRYPTION_KEY"] || "agentiful-s3-1-default-key";
  return createHash("sha256").update(raw).digest();
}

function encryptApiKey(plain: string): {
  version: number;
  algorithm: string;
  iv: string;
  tag: string;
  ciphertext: string;
} {
  const key = deriveCredentialKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: encrypted.toString("base64"),
  };
}

function parseAppTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0)
    .slice(0, 20);
}

function buildAppConfig(body: Record<string, unknown>, existing?: Record<string, unknown>): Record<string, unknown> {
  const previous = existing ?? {};
  const previousConnection = (previous["connection"] as Record<string, unknown>) ?? {};
  const previousModel = (previous["model"] as Record<string, unknown>) ?? {};
  const previousCredentials = (previous["credentials"] as Record<string, unknown>) ?? {};

  const nextConnection = {
    externalPlatform:
      typeof body["externalPlatform"] === "string"
        ? body["externalPlatform"]
        : previousConnection["externalPlatform"] ?? "dify",
    baseUrl:
      typeof body["baseUrl"] === "string"
        ? body["baseUrl"]
        : previousConnection["baseUrl"] ?? null,
    appId:
      typeof body["externalAppId"] === "string"
        ? body["externalAppId"]
        : previousConnection["appId"] ?? null,
    verifyOnSave: body["verifyOnSave"] !== false,
  };

  const nextModel = {
    defaultModel:
      typeof body["defaultModel"] === "string"
        ? body["defaultModel"]
        : previousModel["defaultModel"] ?? null,
    maxTokens:
      typeof body["maxTokens"] === "number" && Number.isFinite(body["maxTokens"])
        ? Math.max(0, Math.floor(body["maxTokens"]))
        : previousModel["maxTokens"] ?? null,
    temperature:
      typeof body["temperature"] === "number" && Number.isFinite(body["temperature"])
        ? Math.max(0, Math.min(2, body["temperature"]))
        : previousModel["temperature"] ?? null,
    systemPrompt:
      typeof body["systemPrompt"] === "string"
        ? body["systemPrompt"]
        : previousModel["systemPrompt"] ?? null,
  };

  const nextCredentials: Record<string, unknown> = {
    ...previousCredentials,
  };

  if (typeof body["apiKey"] === "string" && body["apiKey"].trim()) {
    nextCredentials["apiKey"] = encryptApiKey(body["apiKey"].trim());
    nextCredentials["updatedAt"] = new Date().toISOString();
  }

  if (body["clearApiKey"] === true) {
    delete nextCredentials["apiKey"];
    nextCredentials["updatedAt"] = new Date().toISOString();
  }

  return {
    ...previous,
    connection: nextConnection,
    model: nextModel,
    credentials: nextCredentials,
  };
}

function sanitizeAppRecord(record: {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  mode: string;
  icon: string | null;
  iconType: string;
  tags: unknown;
  status: string;
  externalId: string | null;
  externalPlatform: string | null;
  config: unknown;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}) {
  const config = (record.config as Record<string, unknown>) ?? {};
  const credentials = (config["credentials"] as Record<string, unknown>) ?? {};
  const hasApiKey = Boolean((credentials["apiKey"] as Record<string, unknown>)?.["ciphertext"]);

  return {
    id: record.id,
    tenantId: record.tenantId,
    name: record.name,
    description: record.description,
    mode: record.mode,
    icon: record.icon,
    iconType: record.iconType,
    tags: parseAppTags(record.tags),
    status: record.status,
    externalId: record.externalId,
    externalPlatform: record.externalPlatform,
    config: {
      ...config,
      credentials: {
        hasApiKey,
        masked: hasApiKey ? "***" : null,
      },
    },
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deletedAt: toIsoDate(record.deletedAt),
  };
}

async function checkTenantAdmin(db: any, userId: string, tenantId: string): Promise<boolean> {
  const now = new Date();

  const rbacAdmin = await db
    .select({ roleName: rbacRole.name })
    .from(rbacUserRole)
    .innerJoin(rbacRole, eq(rbacUserRole.roleId, rbacRole.id))
    .where(
      and(
        eq(rbacUserRole.userId, userId),
        eq(rbacUserRole.tenantId, tenantId),
        inArray(rbacRole.name, ["tenant_admin", "root_admin"]),
        eq(rbacRole.isActive, true),
        or(sql`${rbacUserRole.expiresAt} IS NULL`, sql`${rbacUserRole.expiresAt} > ${now}`)
      )
    )
    .limit(1);

  if (rbacAdmin.length > 0) {
    return true;
  }

  const legacyAdmin = await db
    .select({ role: userRole.role })
    .from(userRole)
    .where(and(eq(userRole.userId, userId), eq(userRole.tenantId, tenantId)))
    .limit(1);

  const role = String(legacyAdmin[0]?.role ?? "").toLowerCase();
  return role === "tenant_admin" || role === "root_admin" || role === "admin";
}

async function resolveManagedGroupIds(db: any, userId: string, tenantId: string): Promise<string[]> {
  const rows = await db
    .select({ groupId: groupMember.groupId })
    .from(groupMember)
    .innerJoin(group, eq(groupMember.groupId, group.id))
    .where(
      and(
        eq(groupMember.userId, userId),
        eq(group.tenantId, tenantId),
        inArray(groupMember.role, ["manager", "admin"]),
        sql`${groupMember.removedAt} IS NULL`
      )
    );

  const groupIds = rows
    .map((row: Record<string, unknown>) => {
      const groupId = row["groupId"];
      return typeof groupId === "string" ? groupId : null;
    })
    .filter((value: string | null): value is string => value !== null);

  const uniqueIds = Array.from(new Set<string>(groupIds));
  return uniqueIds;
}

async function countTenantAdmins(db: any, tenantId: string): Promise<number> {
  const now = new Date();

  const rows = await db
    .select({ count: sql<number>`count(*)` })
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

  const rbacCount = Number(rows[0]?.count ?? 0);
  if (rbacCount > 0) {
    return rbacCount;
  }

  const legacyRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(userRole)
    .where(
      and(
        eq(userRole.tenantId, tenantId),
        or(
          eq(userRole.role, "TENANT_ADMIN"),
          eq(userRole.role, "tenant_admin"),
          eq(userRole.role, "admin")
        )
      )
    );

  return Number(legacyRows[0]?.count ?? 0);
}

async function userBelongsToTenant(
  db: any,
  tenantId: string,
  userId: string
): Promise<boolean> {
  const rows = await db
    .select({ id: userRole.id })
    .from(userRole)
    .where(and(eq(userRole.tenantId, tenantId), eq(userRole.userId, userId)))
    .limit(1);

  return rows.length > 0;
}

async function groupBelongsToTenant(
  db: any,
  tenantId: string,
  groupId: string
): Promise<boolean> {
  const rows = await db
    .select({ id: group.id })
    .from(group)
    .where(and(eq(group.tenantId, tenantId), eq(group.id, groupId)))
    .limit(1);

  return rows.length > 0;
}

async function appBelongsToTenant(
  db: any,
  tenantId: string,
  appId: string
): Promise<boolean> {
  const rows = await db
    .select({ id: app.id })
    .from(app)
    .where(and(eq(app.tenantId, tenantId), eq(app.id, appId)))
    .limit(1);

  return rows.length > 0;
}

async function isUserInGroup(
  db: any,
  groupId: string,
  userId: string
): Promise<boolean> {
  const rows = await db
    .select({ id: groupMember.id })
    .from(groupMember)
    .where(
      and(
        eq(groupMember.groupId, groupId),
        eq(groupMember.userId, userId),
        sql`${groupMember.removedAt} IS NULL`
      )
    )
    .limit(1);

  return rows.length > 0;
}

async function buildRouteContext(
  request: FastifyRequest,
  reply: FastifyReply,
  options?: { requireTenantAdmin?: boolean }
): Promise<RouteContext | null> {
  const db = getRequestDb(request);
  if (!db) {
    serviceUnavailable(reply);
    return null;
  }

  const userId = getRequestUserId(request);
  const tenantId = getRequestTenantId(request);
  if (!userId || !tenantId) {
    unauthorized(reply);
    return null;
  }

  const isTenantAdmin = await checkTenantAdmin(db, userId, tenantId);
  if (options?.requireTenantAdmin && !isTenantAdmin) {
    forbidden(reply, "Tenant admin permission required");
    return null;
  }

  const managedGroupIds = await resolveManagedGroupIds(db, userId, tenantId);

  return {
    db,
    tenantId,
    userId,
    isTenantAdmin,
    managedGroupIds,
  };
}

function ensureManagerScope(
  reply: FastifyReply,
  context: RouteContext,
  groupId: string
): boolean {
  if (context.isTenantAdmin) {
    return true;
  }
  if (!context.managedGroupIds.includes(groupId)) {
    forbidden(reply, "Manager scope exceeded");
    return false;
  }
  return true;
}

export async function registerAdminManagerRoutes(fastify: FastifyInstance): Promise<void> {
  const ensureTenantUser = async (
    db: any,
    tenantId: string,
    targetUserId: string,
    reply: FastifyReply
  ): Promise<boolean> => {
    const belongs = await userBelongsToTenant(db, tenantId, targetUserId);
    if (!belongs) {
      reply.status(404).send({
        errors: [{ code: "NOT_FOUND", message: "User not found in tenant" }],
      });
      return false;
    }
    return true;
  };

  const ensureTenantGroup = async (
    db: any,
    tenantId: string,
    targetGroupId: string,
    reply: FastifyReply
  ): Promise<boolean> => {
    const belongs = await groupBelongsToTenant(db, tenantId, targetGroupId);
    if (!belongs) {
      reply.status(404).send({
        errors: [{ code: "NOT_FOUND", message: "Group not found in tenant" }],
      });
      return false;
    }
    return true;
  };

  const ensureTenantApp = async (
    db: any,
    tenantId: string,
    targetAppId: string,
    reply: FastifyReply
  ): Promise<boolean> => {
    const belongs = await appBelongsToTenant(db, tenantId, targetAppId);
    if (!belongs) {
      reply.status(404).send({
        errors: [{ code: "NOT_FOUND", message: "App not found in tenant" }],
      });
      return false;
    }
    return true;
  };

  fastify.get<{
    Querystring: {
      status?: string;
      role?: string;
      groupId?: string;
      keyword?: string;
      sortBy?: "createdAt" | "lastLoginAt" | "name";
      sortOrder?: "asc" | "desc";
      offset?: number;
      pageSize?: number;
    };
  }>("/admin/users", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }

    const query = request.query;
    const offset = normalizeOffset(query.offset);
    const pageSize = normalizePageSize(query.pageSize);
    const sortBy = query.sortBy ?? "createdAt";
    const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

    const conditions = [eq(userRole.tenantId, context.tenantId)];
    if (query.status) {
      conditions.push(eq(user.status, query.status));
    }
    if (query.role) {
      conditions.push(sql`LOWER(${userRole.role}) = ${query.role.toLowerCase()}`);
    }
    if (query.keyword && query.keyword.trim()) {
      const keyword = `%${query.keyword.trim()}%`;
      conditions.push(or(ilike(user.email, keyword), ilike(user.name, keyword)) as any);
    }
    if (query.groupId) {
      conditions.push(sql`EXISTS (
        SELECT 1
        FROM "group_member" gm
        WHERE gm.user_id = ${user.id}
          AND gm.group_id = ${query.groupId}
          AND gm.removed_at IS NULL
      )`);
    }

    const orderColumn =
      sortBy === "name" ? user.name : sortBy === "lastLoginAt" ? user.lastActiveAt : user.createdAt;
    const orderExpr = sortOrder === "asc" ? asc(orderColumn) : desc(orderColumn);

    const [{ count }] = await context.db
      .select({
        count: sql<number>`count(distinct ${user.id})`,
      })
      .from(userRole)
      .innerJoin(user, eq(userRole.userId, user.id))
      .where(and(...conditions));

    const rows = await context.db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        status: user.status,
        emailVerified: user.emailVerified,
        mfaEnabled: user.mfaEnabled,
        mfaForced: user.mfaForced,
        lastActiveAt: user.lastActiveAt,
        createdAt: user.createdAt,
        role: userRole.role,
      })
      .from(userRole)
      .innerJoin(user, eq(userRole.userId, user.id))
      .where(and(...conditions))
      .orderBy(orderExpr)
      .limit(pageSize)
      .offset(offset);

    const userIds = rows.map((row: { id: string }) => row.id);
    const groupCountMap = new Map<string, number>();
    if (userIds.length > 0) {
      const groupCounts = await context.db
        .select({
          userId: groupMember.userId,
          count: sql<number>`count(*)`,
        })
        .from(groupMember)
        .innerJoin(group, eq(groupMember.groupId, group.id))
        .where(
          and(
            inArray(groupMember.userId, userIds),
            eq(group.tenantId, context.tenantId),
            sql`${groupMember.removedAt} IS NULL`
          )
        )
        .groupBy(groupMember.userId);

      for (const item of groupCounts) {
        groupCountMap.set(item.userId, Number(item.count));
      }
    }

    return reply.status(200).send({
      data: {
        items: rows.map((row: any) => ({
          ...row,
          createdAt: toIsoDate(row.createdAt),
          lastLoginAt: toIsoDate(row.lastActiveAt),
          groupCount: groupCountMap.get(row.id) ?? 0,
        })),
        total: Number(count ?? 0),
        offset,
        pageSize,
      },
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  fastify.get<{
    Params: { userId: string };
  }>("/admin/users/:userId", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }
    const targetUserId = request.params.userId;
    if (!(await ensureTenantUser(context.db, context.tenantId, targetUserId, reply))) {
      return;
    }

    const rows = await context.db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        status: user.status,
        emailVerified: user.emailVerified,
        mfaEnabled: user.mfaEnabled,
        mfaForced: user.mfaForced,
        lastLoginAt: user.lastActiveAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(eq(user.id, targetUserId))
      .limit(1);
    const userRow = rows[0];
    if (!userRow) {
      return reply.status(404).send({ errors: [{ code: "NOT_FOUND", message: "User not found" }] });
    }

    const roles = await context.db
      .select({ role: userRole.role })
      .from(userRole)
      .where(and(eq(userRole.userId, targetUserId), eq(userRole.tenantId, context.tenantId)));

    const groups = await context.db
      .select({
        id: group.id,
        name: group.name,
        memberRole: groupMember.role,
      })
      .from(groupMember)
      .innerJoin(group, eq(groupMember.groupId, group.id))
      .where(
        and(
          eq(groupMember.userId, targetUserId),
          eq(group.tenantId, context.tenantId),
          sql`${groupMember.removedAt} IS NULL`
        )
      )
      .orderBy(asc(group.sortOrder), asc(group.name));

    return reply.status(200).send({
      data: {
        ...userRow,
        lastLoginAt: toIsoDate(userRow.lastLoginAt),
        createdAt: toIsoDate(userRow.createdAt),
        updatedAt: toIsoDate(userRow.updatedAt),
        roles: roles.map((item: { role: string }) => item.role),
        groups,
      },
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  fastify.patch<{
    Params: { userId: string };
    Body: {
      name?: string;
      status?: "active" | "pending" | "suspended" | "rejected" | "deleted";
      emailVerified?: boolean;
      mfaForced?: boolean;
    };
  }>("/admin/users/:userId", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }
    const targetUserId = request.params.userId;
    if (!(await ensureTenantUser(context.db, context.tenantId, targetUserId, reply))) {
      return;
    }

    const body = request.body ?? {};
    const updateSet: Record<string, unknown> = {};

    if (typeof body.name === "string") {
      const trimmed = body.name.trim();
      updateSet["name"] = trimmed.length > 0 ? trimmed : null;
    }

    if (typeof body.status === "string") {
      if (!["active", "pending", "suspended", "rejected", "deleted"].includes(body.status)) {
        return badRequest(reply, "INVALID_STATUS", "status must be active/pending/suspended/rejected/deleted");
      }

      if (body.status === "deleted") {
        const targetIsAdmin = await checkTenantAdmin(context.db, targetUserId, context.tenantId);
        if (targetIsAdmin) {
          const adminCount = await countTenantAdmins(context.db, context.tenantId);
          if (adminCount <= 1) {
            return badRequest(reply, "LAST_ADMIN_PROTECTION", "Cannot delete the last tenant admin");
          }
        }
      }

      updateSet["status"] = body.status;
    }

    if (typeof body.emailVerified === "boolean") {
      updateSet["emailVerified"] = body.emailVerified;
    }

    if (typeof body.mfaForced === "boolean") {
      updateSet["mfaForced"] = body.mfaForced;
    }

    if (Object.keys(updateSet).length === 0) {
      return badRequest(reply, "INVALID_REQUEST", "No mutable fields provided");
    }

    updateSet["updatedAt"] = new Date();
    const updated = await context.db
      .update(user)
      .set(updateSet)
      .where(eq(user.id, targetUserId))
      .returning({
        id: user.id,
        email: user.email,
        name: user.name,
        status: user.status,
        emailVerified: user.emailVerified,
        mfaEnabled: user.mfaEnabled,
        mfaForced: user.mfaForced,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    const updatedUser = updated[0];
    if (!updatedUser) {
      return reply.status(404).send({ errors: [{ code: "NOT_FOUND", message: "User not found" }] });
    }

    if (updatedUser.status === "suspended" || updatedUser.status === "deleted") {
      await context.db
        .delete(session)
        .where(and(eq(session.userId, targetUserId), eq(session.tenantId, context.tenantId)));
    }

    return reply.status(200).send({
      data: {
        ...updatedUser,
        createdAt: toIsoDate(updatedUser.createdAt),
        updatedAt: toIsoDate(updatedUser.updatedAt),
      },
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  const inviteUsersHandler = async (
    request: FastifyRequest<{
      Body: {
        email?: string;
        emails?: string[];
        role?: string;
        groupId?: string;
        expiresInDays?: number;
      };
    }>,
    reply: FastifyReply
  ) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }

    const body = request.body ?? {};
    const emails = [
      ...(typeof body.email === "string" ? [body.email] : []),
      ...(Array.isArray(body.emails) ? body.emails : []),
    ]
      .map(normalizeEmail)
      .filter(Boolean);

    if (emails.length === 0) {
      return badRequest(reply, "INVALID_REQUEST", "email/emails is required");
    }
    if (emails.length > 100) {
      return badRequest(reply, "BATCH_LIMIT_EXCEEDED", "Maximum 100 emails per request");
    }

    const expiresInDays =
      typeof body.expiresInDays === "number" && Number.isFinite(body.expiresInDays)
        ? Math.max(1, Math.min(30, Math.floor(body.expiresInDays)))
        : 7;

    const created: Array<{ email: string; invitationId: string; inviteLink: string }> = [];
    const skipped: Array<{ email: string; reason: string }> = [];
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    for (const email of emails) {
      if (!isValidEmail(email)) {
        skipped.push({ email, reason: "Invalid email format" });
        continue;
      }

      const existingUser = await context.db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, email))
        .limit(1);
      if (existingUser.length > 0) {
        skipped.push({ email, reason: "User already exists" });
        continue;
      }

      const existingInvite = await context.db
        .select({ id: invitation.id })
        .from(invitation)
        .where(
          and(
            eq(invitation.tenantId, context.tenantId),
            eq(invitation.email, email),
            eq(invitation.status, "pending")
          )
        )
        .limit(1);
      if (existingInvite.length > 0) {
        skipped.push({ email, reason: "Pending invitation already exists" });
        continue;
      }

      const token = createToken();
      const inserted = await context.db
        .insert(invitation)
        .values({
          tenantId: context.tenantId,
          token,
          email,
          role: body.role ?? "USER",
          groupId: body.groupId ?? null,
          expiresAt,
          status: "pending",
          createdBy: context.userId,
        })
        .returning({ id: invitation.id });

      const invitationId = inserted[0]?.id;
      if (!invitationId) {
        skipped.push({ email, reason: "Failed to create invitation" });
        continue;
      }

      created.push({
        email,
        invitationId,
        inviteLink: `${process.env["WEB_URL"] || "http://localhost:3000"}/invite?token=${token}`,
      });
    }

    return reply.status(200).send({
      data: {
        created,
        skipped,
        expiresAt: expiresAt.toISOString(),
      },
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  };

  fastify.post<{
    Body: {
      email?: string;
      emails?: string[];
      role?: string;
      groupId?: string;
      expiresInDays?: number;
    };
  }>("/admin/users", inviteUsersHandler);

  fastify.post<{
    Body: {
      email?: string;
      emails?: string[];
      role?: string;
      groupId?: string;
      expiresInDays?: number;
    };
  }>("/admin/users/invite", inviteUsersHandler);

  fastify.post<{
    Params: { userId: string };
  }>("/admin/users/:userId/approve", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }
    const targetUserId = request.params.userId;
    if (!(await ensureTenantUser(context.db, context.tenantId, targetUserId, reply))) {
      return;
    }
    await context.db
      .update(user)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(user.id, targetUserId));
    return reply.status(200).send({ data: { success: true } });
  });

  fastify.post<{
    Params: { userId: string };
  }>("/admin/users/:userId/reject", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }
    const targetUserId = request.params.userId;
    if (!(await ensureTenantUser(context.db, context.tenantId, targetUserId, reply))) {
      return;
    }
    await context.db
      .update(user)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(user.id, targetUserId));
    return reply.status(200).send({ data: { success: true } });
  });

  fastify.post<{
    Params: { userId: string };
  }>("/admin/users/:userId/suspend", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }
    const targetUserId = request.params.userId;
    if (!(await ensureTenantUser(context.db, context.tenantId, targetUserId, reply))) {
      return;
    }
    await context.db
      .update(user)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(user.id, targetUserId));
    await context.db
      .delete(session)
      .where(and(eq(session.userId, targetUserId), eq(session.tenantId, context.tenantId)));
    return reply.status(200).send({ data: { success: true } });
  });

  fastify.post<{
    Params: { userId: string };
  }>("/admin/users/:userId/activate", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }
    const targetUserId = request.params.userId;
    if (!(await ensureTenantUser(context.db, context.tenantId, targetUserId, reply))) {
      return;
    }
    await context.db
      .update(user)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(user.id, targetUserId));
    return reply.status(200).send({ data: { success: true } });
  });

  fastify.post<{
    Params: { userId: string };
  }>("/admin/users/:userId/reset-password", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }
    if (!(await ensureTenantUser(context.db, context.tenantId, request.params.userId, reply))) {
      return;
    }
    return reply.status(200).send({
      data: {
        success: true,
        resetRequestedAt: new Date().toISOString(),
      },
    });
  });

  fastify.post<{
    Params: { userId: string };
  }>("/admin/users/:userId/force-mfa", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }
    const targetUserId = request.params.userId;
    if (!(await ensureTenantUser(context.db, context.tenantId, targetUserId, reply))) {
      return;
    }
    await context.db
      .update(user)
      .set({ mfaForced: true, updatedAt: new Date() })
      .where(eq(user.id, targetUserId));
    return reply.status(200).send({ data: { success: true } });
  });

  fastify.delete<{
    Params: { userId: string };
  }>("/admin/users/:userId", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }

    const targetUserId = request.params.userId;
    if (!(await ensureTenantUser(context.db, context.tenantId, targetUserId, reply))) {
      return;
    }
    const targetIsAdmin = await checkTenantAdmin(context.db, targetUserId, context.tenantId);
    if (targetIsAdmin) {
      const adminCount = await countTenantAdmins(context.db, context.tenantId);
      if (adminCount <= 1) {
        return badRequest(reply, "LAST_ADMIN_PROTECTION", "Cannot delete the last tenant admin");
      }
    }

    await context.db
      .update(user)
      .set({ status: "deleted", name: "已删除用户", updatedAt: new Date() })
      .where(eq(user.id, targetUserId));
    await context.db
      .delete(session)
      .where(and(eq(session.userId, targetUserId), eq(session.tenantId, context.tenantId)));

    await context.db.execute(sql`
      UPDATE "group_member"
      SET removed_at = NOW(), removed_by = ${context.userId}
      WHERE user_id = ${targetUserId}
        AND removed_at IS NULL
        AND group_id IN (SELECT id FROM "group" WHERE tenant_id = ${context.tenantId})
    `);

    return reply.status(200).send({ data: { success: true } });
  });

  fastify.get("/admin/groups", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }

    const groups = await context.db
      .select({
        id: group.id,
        tenantId: group.tenantId,
        name: group.name,
        description: group.description,
        sortOrder: group.sortOrder,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        memberCount: sql<number>`count(${groupMember.id})`,
      })
      .from(group)
      .leftJoin(
        groupMember,
        and(eq(groupMember.groupId, group.id), sql`${groupMember.removedAt} IS NULL`)
      )
      .where(eq(group.tenantId, context.tenantId))
      .groupBy(group.id)
      .orderBy(asc(group.sortOrder), asc(group.name));

    return reply.status(200).send({ data: groups });
  });

  fastify.post<{
    Body: { name?: string; description?: string; sortOrder?: number };
  }>("/admin/groups", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }
    if (!request.body?.name || request.body.name.trim().length < 2) {
      return badRequest(reply, "INVALID_GROUP_NAME", "Group name must be at least 2 characters");
    }

    const inserted = await context.db
      .insert(group)
      .values({
        tenantId: context.tenantId,
        name: request.body.name.trim(),
        description: request.body.description?.trim() || null,
        sortOrder:
          typeof request.body.sortOrder === "number" && Number.isFinite(request.body.sortOrder)
            ? Math.floor(request.body.sortOrder)
            : 0,
      })
      .returning();

    return reply.status(201).send({ data: inserted[0] });
  });

  fastify.patch<{
    Params: { groupId: string };
    Body: { name?: string; description?: string; sortOrder?: number };
  }>("/admin/groups/:groupId", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }
    const updated = await context.db
      .update(group)
      .set({
        name: request.body?.name?.trim(),
        description: request.body?.description?.trim() ?? null,
        sortOrder:
          typeof request.body?.sortOrder === "number" && Number.isFinite(request.body.sortOrder)
            ? Math.floor(request.body.sortOrder)
            : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(group.id, request.params.groupId), eq(group.tenantId, context.tenantId)))
      .returning();

    if (!updated[0]) {
      return reply.status(404).send({ errors: [{ code: "NOT_FOUND", message: "Group not found" }] });
    }

    return reply.status(200).send({ data: updated[0] });
  });

  fastify.delete<{
    Params: { groupId: string };
    Body: { confirmName?: string };
  }>("/admin/groups/:groupId", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }

    const groupRows = await context.db
      .select()
      .from(group)
      .where(and(eq(group.id, request.params.groupId), eq(group.tenantId, context.tenantId)))
      .limit(1);
    const target = groupRows[0];
    if (!target) {
      return reply.status(404).send({ errors: [{ code: "NOT_FOUND", message: "Group not found" }] });
    }
    if (target.name.toLowerCase() === "unassigned") {
      return badRequest(reply, "PROTECTED_GROUP", "Unassigned group cannot be deleted");
    }
    if (!request.body?.confirmName || request.body.confirmName !== target.name) {
      return badRequest(reply, "CONFIRMATION_REQUIRED", "confirmName must exactly match the group name");
    }

    let unassigned = await context.db
      .select({ id: group.id })
      .from(group)
      .where(
        and(
          eq(group.tenantId, context.tenantId),
          sql`LOWER(${group.name}) = 'unassigned'`
        )
      )
      .limit(1);
    if (!unassigned[0]) {
      const created = await context.db
        .insert(group)
        .values({
          tenantId: context.tenantId,
          name: "Unassigned",
          description: "System default group for unassigned members",
          sortOrder: -1,
        })
        .returning({ id: group.id });
      unassigned = created;
    }
    const unassignedId = unassigned[0]?.id;
    if (!unassignedId) {
      return badRequest(reply, "UNASSIGNED_CREATE_FAILED", "Failed to prepare Unassigned group");
    }

    const activeMembers = await context.db
      .select({ id: groupMember.id, userId: groupMember.userId })
      .from(groupMember)
      .where(and(eq(groupMember.groupId, target.id), sql`${groupMember.removedAt} IS NULL`));

    for (const member of activeMembers) {
      const existingUnassigned = await context.db
        .select({ id: groupMember.id })
        .from(groupMember)
        .where(
          and(
            eq(groupMember.groupId, unassignedId),
            eq(groupMember.userId, member.userId),
            sql`${groupMember.removedAt} IS NULL`
          )
        )
        .limit(1);
      if (existingUnassigned[0]) {
        await context.db
          .update(groupMember)
          .set({ removedAt: new Date(), removedBy: context.userId })
          .where(eq(groupMember.id, member.id));
      } else {
        await context.db
          .update(groupMember)
          .set({ groupId: unassignedId })
          .where(eq(groupMember.id, member.id));
      }
    }

    await context.db
      .delete(appGrant)
      .where(and(eq(appGrant.granteeType, "group"), eq(appGrant.granteeId, target.id)));

    await context.db
      .delete(group)
      .where(and(eq(group.id, target.id), eq(group.tenantId, context.tenantId)));

    return reply.status(200).send({
      data: {
        success: true,
        movedMembers: activeMembers.length,
        unassignedGroupId: unassignedId,
      },
    });
  });

  fastify.get<{
    Params: { groupId: string };
  }>("/admin/groups/:groupId/members", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }
    if (!(await ensureTenantGroup(context.db, context.tenantId, request.params.groupId, reply))) {
      return;
    }
    const rows = await context.db
      .select({
        id: groupMember.id,
        groupId: groupMember.groupId,
        userId: groupMember.userId,
        role: groupMember.role,
        addedAt: groupMember.addedAt,
        userName: user.name,
        userEmail: user.email,
      })
      .from(groupMember)
      .innerJoin(user, eq(groupMember.userId, user.id))
      .innerJoin(group, eq(groupMember.groupId, group.id))
      .where(
        and(
          eq(groupMember.groupId, request.params.groupId),
          eq(group.tenantId, context.tenantId),
          sql`${groupMember.removedAt} IS NULL`
        )
      )
      .orderBy(asc(groupMember.addedAt));
    return reply.status(200).send({ data: rows });
  });

  fastify.post<{
    Params: { groupId: string };
    Body: { userId?: string; userIds?: string[]; role?: string };
  }>("/admin/groups/:groupId/members", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }
    if (!(await ensureTenantGroup(context.db, context.tenantId, request.params.groupId, reply))) {
      return;
    }

    const roleValue = request.body?.role ?? "member";
    if (!["member", "manager", "admin"].includes(roleValue)) {
      return badRequest(reply, "INVALID_ROLE", "role must be member/manager/admin");
    }

    const userIds = [
      ...(typeof request.body?.userId === "string" ? [request.body.userId] : []),
      ...(Array.isArray(request.body?.userIds) ? request.body.userIds : []),
    ];
    if (userIds.length === 0) {
      return badRequest(reply, "INVALID_REQUEST", "userId/userIds is required");
    }
    if (userIds.length > 100) {
      return badRequest(reply, "BATCH_LIMIT_EXCEEDED", "Maximum 100 users per request");
    }

    const created: string[] = [];
    const skipped: Array<{ userId: string; reason: string }> = [];

    for (const targetUserId of userIds) {
      const belongs = await userBelongsToTenant(context.db, context.tenantId, targetUserId);
      if (!belongs) {
        skipped.push({ userId: targetUserId, reason: "User not found in tenant" });
        continue;
      }

      const exists = await context.db
        .select({ id: groupMember.id, removedAt: groupMember.removedAt })
        .from(groupMember)
        .where(
          and(
            eq(groupMember.groupId, request.params.groupId),
            eq(groupMember.userId, targetUserId)
          )
        )
        .limit(1);

      if (exists[0] && !exists[0].removedAt) {
        skipped.push({ userId: targetUserId, reason: "User is already in group" });
        continue;
      }

      if (exists[0]?.removedAt) {
        await context.db
          .update(groupMember)
          .set({
            role: roleValue,
            addedAt: new Date(),
            addedBy: context.userId,
            removedAt: null,
            removedBy: null,
          })
          .where(eq(groupMember.id, exists[0].id));
        created.push(targetUserId);
        continue;
      }

      await context.db.insert(groupMember).values({
        groupId: request.params.groupId,
        userId: targetUserId,
        role: roleValue,
        addedBy: context.userId,
      });
      created.push(targetUserId);
    }

    return reply.status(200).send({
      data: {
        added: created.length,
        created,
        skipped,
      },
    });
  });

  fastify.patch<{
    Params: { groupId: string; memberId: string };
    Body: { role: string };
  }>("/admin/groups/:groupId/members/:memberId/role", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }
    if (!(await ensureTenantGroup(context.db, context.tenantId, request.params.groupId, reply))) {
      return;
    }
    if (!["member", "manager", "admin"].includes(request.body?.role ?? "")) {
      return badRequest(reply, "INVALID_ROLE", "role must be member/manager/admin");
    }
    const updated = await context.db
      .update(groupMember)
      .set({ role: request.body.role })
      .where(and(eq(groupMember.id, request.params.memberId), eq(groupMember.groupId, request.params.groupId)))
      .returning();
    if (!updated[0]) {
      return reply.status(404).send({ errors: [{ code: "NOT_FOUND", message: "Member not found" }] });
    }
    return reply.status(200).send({ data: updated[0] });
  });

  fastify.delete<{
    Params: { groupId: string; memberId: string };
  }>("/admin/groups/:groupId/members/:memberId", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }
    if (!(await ensureTenantGroup(context.db, context.tenantId, request.params.groupId, reply))) {
      return;
    }
    await context.db
      .update(groupMember)
      .set({ removedAt: new Date(), removedBy: context.userId })
      .where(and(eq(groupMember.id, request.params.memberId), eq(groupMember.groupId, request.params.groupId)));
    return reply.status(204).send();
  });

  fastify.get<{
    Querystring: { status?: string; q?: string };
  }>("/admin/apps", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }

    const conditions = [eq(app.tenantId, context.tenantId)];
    if (request.query.status) {
      conditions.push(eq(app.status, request.query.status));
    }
    if (request.query.q?.trim()) {
      conditions.push(ilike(app.name, `%${request.query.q.trim()}%`));
    }

    const rows = await context.db
      .select()
      .from(app)
      .where(and(...conditions))
      .orderBy(desc(app.updatedAt));

    return reply.status(200).send({
      data: rows.map((row: any) => sanitizeAppRecord(row)),
    });
  });

  fastify.post<{
    Body: Record<string, unknown>;
  }>("/admin/apps", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }

    const body = request.body ?? {};
    const name = typeof body["name"] === "string" ? body["name"].trim() : "";
    if (!name) {
      return badRequest(reply, "INVALID_REQUEST", "name is required");
    }

    const appConfig = buildAppConfig(body);
    const inserted = await context.db
      .insert(app)
      .values({
        tenantId: context.tenantId,
        name,
        description: typeof body["description"] === "string" ? body["description"] : null,
        mode: typeof body["mode"] === "string" ? body["mode"] : "chat",
        icon: typeof body["icon"] === "string" ? body["icon"] : null,
        iconType: typeof body["iconType"] === "string" ? body["iconType"] : "image",
        tags: parseAppTags(body["tags"]),
        externalId: typeof body["externalAppId"] === "string" ? body["externalAppId"] : null,
        externalPlatform: typeof body["externalPlatform"] === "string" ? body["externalPlatform"] : null,
        status: typeof body["status"] === "string" ? body["status"] : "active",
        config: appConfig,
        createdBy: context.userId,
      })
      .returning();

    return reply.status(201).send({
      data: sanitizeAppRecord(inserted[0]),
    });
  });

  fastify.patch<{
    Params: { appId: string };
    Body: Record<string, unknown>;
  }>("/admin/apps/:appId", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }

    const current = await context.db
      .select()
      .from(app)
      .where(and(eq(app.id, request.params.appId), eq(app.tenantId, context.tenantId)))
      .limit(1);
    if (!current[0]) {
      return reply.status(404).send({ errors: [{ code: "NOT_FOUND", message: "App not found" }] });
    }

    const body = request.body ?? {};
    const updated = await context.db
      .update(app)
      .set({
        name: typeof body["name"] === "string" ? body["name"].trim() : undefined,
        description: typeof body["description"] === "string" ? body["description"] : undefined,
        mode: typeof body["mode"] === "string" ? body["mode"] : undefined,
        icon: typeof body["icon"] === "string" ? body["icon"] : undefined,
        iconType: typeof body["iconType"] === "string" ? body["iconType"] : undefined,
        tags: Array.isArray(body["tags"]) ? parseAppTags(body["tags"]) : undefined,
        externalId: typeof body["externalAppId"] === "string" ? body["externalAppId"] : undefined,
        externalPlatform: typeof body["externalPlatform"] === "string" ? body["externalPlatform"] : undefined,
        status: typeof body["status"] === "string" ? body["status"] : undefined,
        config: buildAppConfig(body, current[0].config as Record<string, unknown>),
        updatedAt: new Date(),
      })
      .where(and(eq(app.id, request.params.appId), eq(app.tenantId, context.tenantId)))
      .returning();

    return reply.status(200).send({
      data: sanitizeAppRecord(updated[0]),
    });
  });

  fastify.post<{
    Params: { appId: string };
  }>("/admin/apps/:appId/suspend", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }
    const updated = await context.db
      .update(app)
      .set({ status: "disabled", updatedAt: new Date() })
      .where(and(eq(app.id, request.params.appId), eq(app.tenantId, context.tenantId)))
      .returning({ id: app.id });
    if (!updated[0]) {
      return reply.status(404).send({ errors: [{ code: "NOT_FOUND", message: "App not found" }] });
    }
    return reply.status(200).send({ data: { success: true } });
  });

  fastify.post<{
    Params: { appId: string };
  }>("/admin/apps/:appId/activate", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }
    const updated = await context.db
      .update(app)
      .set({ status: "active", updatedAt: new Date() })
      .where(and(eq(app.id, request.params.appId), eq(app.tenantId, context.tenantId)))
      .returning({ id: app.id });
    if (!updated[0]) {
      return reply.status(404).send({ errors: [{ code: "NOT_FOUND", message: "App not found" }] });
    }
    return reply.status(200).send({ data: { success: true } });
  });

  fastify.delete<{
    Params: { appId: string };
  }>("/admin/apps/:appId", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }
    const current = await context.db
      .select({ config: app.config })
      .from(app)
      .where(and(eq(app.id, request.params.appId), eq(app.tenantId, context.tenantId)))
      .limit(1);
    if (!current[0]) {
      return reply.status(404).send({ errors: [{ code: "NOT_FOUND", message: "App not found" }] });
    }
    const nextConfig = buildAppConfig({ clearApiKey: true }, current[0].config as Record<string, unknown>);
    await context.db
      .update(app)
      .set({
        status: "deleted",
        deletedAt: new Date(),
        config: nextConfig,
        updatedAt: new Date(),
      })
      .where(and(eq(app.id, request.params.appId), eq(app.tenantId, context.tenantId)));
    return reply.status(200).send({ data: { success: true } });
  });

  fastify.get<{
    Params: { appId: string };
  }>("/admin/apps/:appId/authorizations", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }
    const rows = await context.db
      .select()
      .from(appGrant)
      .innerJoin(app, eq(appGrant.appId, app.id))
      .where(and(eq(appGrant.appId, request.params.appId), eq(app.tenantId, context.tenantId)))
      .orderBy(desc(appGrant.createdAt));
    return reply.status(200).send({ data: rows.map((row: any) => row.app_grant ?? row) });
  });

  fastify.get<{
    Querystring: { appId?: string; granteeType?: "group" | "user"; granteeId?: string };
  }>("/admin/authorizations", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }
    const conditions = [eq(app.tenantId, context.tenantId)];
    if (request.query.appId) {
      conditions.push(eq(appGrant.appId, request.query.appId));
    }
    if (request.query.granteeType) {
      conditions.push(eq(appGrant.granteeType, request.query.granteeType));
    }
    if (request.query.granteeId) {
      conditions.push(eq(appGrant.granteeId, request.query.granteeId));
    }

    const rows = await context.db
      .select({
        id: appGrant.id,
        appId: appGrant.appId,
        granteeType: appGrant.granteeType,
        granteeId: appGrant.granteeId,
        permission: appGrant.permission,
        reason: appGrant.reason,
        grantedBy: appGrant.grantedBy,
        expiresAt: appGrant.expiresAt,
        createdAt: appGrant.createdAt,
      })
      .from(appGrant)
      .innerJoin(app, eq(appGrant.appId, app.id))
      .where(and(...conditions))
      .orderBy(desc(appGrant.createdAt));

    return reply.status(200).send({
      data: rows.map((row: any) => ({
        ...row,
        expiresAt: toIsoDate(row.expiresAt),
        createdAt: toIsoDate(row.createdAt),
      })),
    });
  });

  async function createAuthorizations(
    request: FastifyRequest<{ Body: Record<string, unknown> }>,
    reply: FastifyReply
  ) {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }

    const body = request.body ?? {};
    const rawItems = Array.isArray(body["items"])
      ? (body["items"] as Array<Record<string, unknown>>)
      : [body as Record<string, unknown>];

    if (rawItems.length === 0) {
      return badRequest(reply, "INVALID_REQUEST", "No authorization items provided");
    }
    if (rawItems.length > 100) {
      return badRequest(reply, "BATCH_LIMIT_EXCEEDED", "Maximum 100 items per request");
    }

    const created: string[] = [];
    const failed: Array<{ index: number; reason: string }> = [];
    const now = new Date();
    const maxExpiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    for (let index = 0; index < rawItems.length; index += 1) {
      const item = rawItems[index];
      if (!item) {
        failed.push({ index, reason: "Invalid authorization item" });
        continue;
      }
      const appId = typeof item["appId"] === "string" ? item["appId"] : "";
      const granteeType =
        item["granteeType"] === "group" || item["granteeType"] === "user" ? item["granteeType"] : null;
      const granteeId = typeof item["granteeId"] === "string" ? item["granteeId"] : "";
      const permissionValue = item["permission"] === "deny" ? "deny" : "use";
      const reason = typeof item["reason"] === "string" ? item["reason"].trim() : "";
      const expiresAt = parseDateMaybe(item["expiresAt"]);

      if (!appId || !granteeType || !granteeId) {
        failed.push({ index, reason: "appId/granteeType/granteeId is required" });
        continue;
      }
      const appRow = await context.db
        .select({ id: app.id })
        .from(app)
        .where(and(eq(app.id, appId), eq(app.tenantId, context.tenantId)))
        .limit(1);
      if (!appRow[0]) {
        failed.push({ index, reason: "App not found in tenant" });
        continue;
      }
      if (granteeType === "user") {
        if (!reason) {
          failed.push({ index, reason: "Reason is required for user direct grant" });
          continue;
        }
        if (!expiresAt) {
          failed.push({ index, reason: "expiresAt is required for user direct grant" });
          continue;
        }
        if (expiresAt > maxExpiresAt) {
          failed.push({ index, reason: "expiresAt exceeds 90 days limit" });
          continue;
        }
      }

      if (granteeType === "group") {
        const groupRow = await context.db
          .select({ id: group.id })
          .from(group)
          .where(and(eq(group.id, granteeId), eq(group.tenantId, context.tenantId)))
          .limit(1);
        if (!groupRow[0]) {
          failed.push({ index, reason: "Group not found in tenant" });
          continue;
        }
      }

      if (granteeType === "user") {
        const userTenantRow = await context.db
          .select({ id: userRole.id })
          .from(userRole)
          .where(and(eq(userRole.userId, granteeId), eq(userRole.tenantId, context.tenantId)))
          .limit(1);
        if (!userTenantRow[0]) {
          failed.push({ index, reason: "User not found in tenant" });
          continue;
        }
      }

      const inserted = await context.db
        .insert(appGrant)
        .values({
          appId,
          granteeType,
          granteeId,
          permission: permissionValue,
          reason: reason || null,
          expiresAt: expiresAt ?? null,
          grantedBy: context.userId,
        })
        .returning({ id: appGrant.id });

      if (inserted[0]?.id) {
        created.push(inserted[0].id);
      } else {
        failed.push({ index, reason: "Insert failed" });
      }
    }

    const statusCode = failed.length > 0 ? 207 : 201;
    return reply.status(statusCode).send({
      data: {
        createdCount: created.length,
        created,
        failed,
      },
    });
  }

  fastify.post<{
    Body: Record<string, unknown>;
  }>("/admin/authorizations", createAuthorizations);

  fastify.post<{
    Body: Record<string, unknown>;
  }>("/admin/authorizations/batch", createAuthorizations);

  fastify.delete<{
    Params: { authorizationId: string };
  }>("/admin/authorizations/:authorizationId", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }

    const row = await context.db
      .select({ appId: appGrant.appId })
      .from(appGrant)
      .where(eq(appGrant.id, request.params.authorizationId))
      .limit(1);
    if (!row[0]) {
      return reply.status(404).send({ errors: [{ code: "NOT_FOUND", message: "Authorization not found" }] });
    }

    const appRow = await context.db
      .select({ id: app.id })
      .from(app)
      .where(and(eq(app.id, row[0].appId), eq(app.tenantId, context.tenantId)))
      .limit(1);
    if (!appRow[0]) {
      return forbidden(reply, "Cross-tenant authorization access denied");
    }

    await context.db.delete(appGrant).where(eq(appGrant.id, request.params.authorizationId));
    return reply.status(204).send();
  });

  fastify.get("/admin/quotas", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }

    const repository = createQuotaRepository(context.db);
    const policies = await repository.listPolicies(context.tenantId);

    const usageRows = await context.db
      .select({
        totalTokens: sql<number>`coalesce(sum(${quotaUsageLedger.totalTokens}), 0)`,
      })
      .from(quotaUsageLedger)
      .where(eq(quotaUsageLedger.tenantId, context.tenantId));

    return reply.status(200).send({
      data: {
        policies: policies.map((policy) => ({
          id: policy.id,
          tenantId: policy.tenantId,
          scope: policy.scopeType,
          scopeId: policy.scopeId,
          meteringMode: policy.metricType,
          resetPeriod: policy.periodType === "week" ? "weekly" : "monthly",
          limitValue: policy.limitValue,
          alertThresholds: policy.alertThresholds,
          isActive: policy.isActive,
        })),
        usage: {
          totalTokens: Number(usageRows[0]?.totalTokens ?? 0),
        },
      },
    });
  });

  fastify.patch<{
    Body: {
      scope: ScopeType;
      scopeId: string;
      meteringMode: MeteringMode;
      resetPeriod?: "monthly" | "weekly";
      limitValue: number;
      alertThresholds?: number[];
      isActive?: boolean;
      parentGroupId?: string;
    };
  }>("/admin/quotas", async (request, reply) => {
    const context = await buildRouteContext(request, reply, { requireTenantAdmin: true });
    if (!context) {
      return;
    }

    const body = request.body;
    if (!body?.scope || !body.scopeId || !body.meteringMode) {
      return badRequest(reply, "INVALID_REQUEST", "scope/scopeId/meteringMode is required");
    }
    if (!["tenant", "group", "user"].includes(body.scope)) {
      return badRequest(reply, "INVALID_SCOPE", "scope must be tenant/group/user");
    }
    if (!["token", "request"].includes(body.meteringMode)) {
      return badRequest(reply, "INVALID_METERING_MODE", "meteringMode must be token/request");
    }
    if (!Number.isFinite(body.limitValue) || body.limitValue < 0) {
      return badRequest(reply, "INVALID_LIMIT", "limitValue must be a non-negative number");
    }

    const repository = createQuotaRepository(context.db);
    const belongs = await repository.scopeBelongsToTenant(context.tenantId, body.scope, body.scopeId);
    if (!belongs) {
      return badRequest(reply, "INVALID_SCOPE_ID", "scopeId does not belong to tenant");
    }

    const tenantPolicy = await repository.findActivePolicy(
      context.tenantId,
      "tenant",
      context.tenantId,
      body.meteringMode
    );

    if (body.scope === "tenant") {
      const groupPolicies = await repository.listPolicies(context.tenantId, {
        scopeType: "group",
        meteringMode: body.meteringMode,
        isActive: true,
      });
      const groupTotal = groupPolicies.reduce((sum, policy) => sum + Number(policy.limitValue), 0);
      if (groupTotal > body.limitValue) {
        return badRequest(reply, "HIERARCHY_VIOLATION", "Tenant quota must be >= total group quotas");
      }
    }

    if (body.scope === "group" && tenantPolicy && body.limitValue > Number(tenantPolicy.limitValue)) {
      return badRequest(reply, "HIERARCHY_VIOLATION", "Group quota cannot exceed tenant quota");
    }

    if (body.scope === "user") {
      if (tenantPolicy && body.limitValue > Number(tenantPolicy.limitValue)) {
        return badRequest(reply, "HIERARCHY_VIOLATION", "User quota cannot exceed tenant quota");
      }

      const parentGroupId = body.parentGroupId ?? (await repository.findDefaultGroupId(context.tenantId, body.scopeId));
      if (parentGroupId) {
        const groupPolicy = await repository.findActivePolicy(
          context.tenantId,
          "group",
          parentGroupId,
          body.meteringMode
        );
        if (groupPolicy && body.limitValue > Number(groupPolicy.limitValue)) {
          return badRequest(reply, "HIERARCHY_VIOLATION", "User quota cannot exceed group quota");
        }
      }
    }

    const periodType: PeriodType = body.resetPeriod === "weekly" ? "week" : "month";
    const upsertInput: Parameters<typeof repository.upsertPolicy>[0] = {
      tenantId: context.tenantId,
      scopeType: body.scope,
      scopeId: body.scopeId,
      meteringMode: body.meteringMode,
      periodType,
      limitValue: Math.floor(body.limitValue),
    };
    if (Array.isArray(body.alertThresholds)) {
      upsertInput.alertThresholds = body.alertThresholds;
    }
    if (typeof body.isActive === "boolean") {
      upsertInput.isActive = body.isActive;
    }

    const upserted = await repository.upsertPolicy(upsertInput);

    return reply.status(200).send({
      data: {
        id: upserted.id,
        tenantId: upserted.tenantId,
        scope: upserted.scopeType,
        scopeId: upserted.scopeId,
        meteringMode: upserted.metricType,
        resetPeriod: upserted.periodType === "week" ? "weekly" : "monthly",
        limitValue: upserted.limitValue,
        alertThresholds: upserted.alertThresholds,
        isActive: upserted.isActive,
      },
    });
  });

  fastify.get<{
    Params: { groupId: string };
  }>("/manager/groups/:groupId/members", async (request, reply) => {
    const context = await buildRouteContext(request, reply);
    if (!context) {
      return;
    }
    if (!(await ensureTenantGroup(context.db, context.tenantId, request.params.groupId, reply))) {
      return;
    }
    if (!ensureManagerScope(reply, context, request.params.groupId)) {
      return;
    }

    const members = await context.db
      .select({
        id: groupMember.id,
        userId: groupMember.userId,
        role: groupMember.role,
        addedAt: groupMember.addedAt,
        userName: user.name,
        userEmail: user.email,
      })
      .from(groupMember)
      .innerJoin(user, eq(groupMember.userId, user.id))
      .innerJoin(group, eq(groupMember.groupId, group.id))
      .where(
        and(
          eq(groupMember.groupId, request.params.groupId),
          eq(group.tenantId, context.tenantId),
          sql`${groupMember.removedAt} IS NULL`
        )
      )
      .orderBy(asc(groupMember.addedAt));

    return reply.status(200).send({ data: members });
  });

  fastify.post<{
    Params: { groupId: string };
    Body: { userId?: string; userIds?: string[] };
  }>("/manager/groups/:groupId/members", async (request, reply) => {
    const context = await buildRouteContext(request, reply);
    if (!context) {
      return;
    }
    if (!(await ensureTenantGroup(context.db, context.tenantId, request.params.groupId, reply))) {
      return;
    }
    if (!ensureManagerScope(reply, context, request.params.groupId)) {
      return;
    }

    const userIds = [
      ...(typeof request.body?.userId === "string" ? [request.body.userId] : []),
      ...(Array.isArray(request.body?.userIds) ? request.body.userIds : []),
    ];
    if (userIds.length === 0) {
      return badRequest(reply, "INVALID_REQUEST", "userId/userIds is required");
    }
    if (userIds.length > 100) {
      return badRequest(reply, "BATCH_LIMIT_EXCEEDED", "Maximum 100 users per request");
    }

    const created: string[] = [];
    const skipped: Array<{ userId: string; reason: string }> = [];

    for (const targetUserId of userIds) {
      const belongs = await userBelongsToTenant(context.db, context.tenantId, targetUserId);
      if (!belongs) {
        skipped.push({ userId: targetUserId, reason: "User not found in tenant" });
        continue;
      }

      const exists = await context.db
        .select({ id: groupMember.id, removedAt: groupMember.removedAt })
        .from(groupMember)
        .where(
          and(
            eq(groupMember.groupId, request.params.groupId),
            eq(groupMember.userId, targetUserId)
          )
        )
        .limit(1);

      if (exists[0] && !exists[0].removedAt) {
        skipped.push({ userId: targetUserId, reason: "User is already in group" });
        continue;
      }

      if (exists[0]?.removedAt) {
        await context.db
          .update(groupMember)
          .set({
            role: "member",
            addedAt: new Date(),
            addedBy: context.userId,
            removedAt: null,
            removedBy: null,
          })
          .where(eq(groupMember.id, exists[0].id));
        created.push(targetUserId);
        continue;
      }

      await context.db.insert(groupMember).values({
        groupId: request.params.groupId,
        userId: targetUserId,
        role: "member",
        addedBy: context.userId,
      });
      created.push(targetUserId);
    }

    return reply.status(200).send({
      data: {
        added: created.length,
        created,
        skipped,
      },
    });
  });

  fastify.delete<{
    Params: { groupId: string; memberId: string };
  }>("/manager/groups/:groupId/members/:memberId", async (request, reply) => {
    const context = await buildRouteContext(request, reply);
    if (!context) {
      return;
    }
    if (!(await ensureTenantGroup(context.db, context.tenantId, request.params.groupId, reply))) {
      return;
    }
    if (!ensureManagerScope(reply, context, request.params.groupId)) {
      return;
    }

    const memberRows = await context.db
      .select({ id: groupMember.id, userId: groupMember.userId })
      .from(groupMember)
      .where(
        and(
          eq(groupMember.id, request.params.memberId),
          eq(groupMember.groupId, request.params.groupId),
          sql`${groupMember.removedAt} IS NULL`
        )
      )
      .limit(1);
    const memberRow = memberRows[0];
    if (!memberRow) {
      return reply.status(404).send({ errors: [{ code: "NOT_FOUND", message: "Member not found" }] });
    }
    if (memberRow.userId === context.userId) {
      return badRequest(reply, "SELF_REMOVE_FORBIDDEN", "Manager cannot remove self from managed group");
    }

    await context.db
      .update(groupMember)
      .set({ removedAt: new Date(), removedBy: context.userId })
      .where(eq(groupMember.id, memberRow.id));

    return reply.status(204).send();
  });

  fastify.get<{
    Params: { groupId: string };
  }>("/manager/groups/:groupId/apps", async (request, reply) => {
    const context = await buildRouteContext(request, reply);
    if (!context) {
      return;
    }
    if (!(await ensureTenantGroup(context.db, context.tenantId, request.params.groupId, reply))) {
      return;
    }
    if (!ensureManagerScope(reply, context, request.params.groupId)) {
      return;
    }

    const rows = await context.db
      .select({
        id: app.id,
        name: app.name,
        status: app.status,
        mode: app.mode,
        permission: appGrant.permission,
        expiresAt: appGrant.expiresAt,
      })
      .from(appGrant)
      .innerJoin(app, eq(appGrant.appId, app.id))
      .where(
        and(
          eq(app.tenantId, context.tenantId),
          eq(appGrant.granteeType, "group"),
          eq(appGrant.granteeId, request.params.groupId)
        )
      )
      .orderBy(asc(app.name));

    return reply.status(200).send({
      data: rows.map((row: any) => ({
        ...row,
        expiresAt: toIsoDate(row.expiresAt),
      })),
    });
  });

  fastify.post<{
    Params: { groupId: string };
    Body: { appId?: string; permission?: "use" | "deny"; reason?: string };
  }>("/manager/groups/:groupId/apps", async (request, reply) => {
    const context = await buildRouteContext(request, reply);
    if (!context) {
      return;
    }
    const groupId = request.params.groupId;
    if (!(await ensureTenantGroup(context.db, context.tenantId, groupId, reply))) {
      return;
    }
    if (!ensureManagerScope(reply, context, groupId)) {
      return;
    }

    const appId = typeof request.body?.appId === "string" ? request.body.appId : "";
    if (!appId) {
      return badRequest(reply, "INVALID_REQUEST", "appId is required");
    }
    if (!(await ensureTenantApp(context.db, context.tenantId, appId, reply))) {
      return;
    }

    const hasTenantGrant = await context.db
      .select({ id: appGrant.id })
      .from(appGrant)
      .where(
        and(
          eq(appGrant.appId, appId),
          eq(appGrant.granteeType, "group"),
          eq(appGrant.granteeId, groupId),
          eq(appGrant.permission, "use")
        )
      )
      .limit(1);
    if (!hasTenantGrant[0]) {
      return forbidden(reply, "Manager can only manage apps already authorized to the group");
    }

    const permissionValue = request.body?.permission === "deny" ? "deny" : "use";
    const reason = typeof request.body?.reason === "string" ? request.body.reason.trim() : null;
    const inserted = await context.db
      .insert(appGrant)
      .values({
        appId,
        granteeType: "group",
        granteeId: groupId,
        permission: permissionValue,
        reason: reason || null,
        grantedBy: context.userId,
      })
      .returning({ id: appGrant.id });

    return reply.status(201).send({
      data: {
        id: inserted[0]?.id ?? null,
        appId,
        groupId,
        permission: permissionValue,
      },
    });
  });

  fastify.delete<{
    Params: { groupId: string; appId: string };
  }>("/manager/groups/:groupId/apps/:appId", async (request, reply) => {
    const context = await buildRouteContext(request, reply);
    if (!context) {
      return;
    }
    const groupId = request.params.groupId;
    const appId = request.params.appId;
    if (!(await ensureTenantGroup(context.db, context.tenantId, groupId, reply))) {
      return;
    }
    if (!ensureManagerScope(reply, context, groupId)) {
      return;
    }
    if (!(await ensureTenantApp(context.db, context.tenantId, appId, reply))) {
      return;
    }

    await context.db
      .delete(appGrant)
      .where(
        and(
          eq(appGrant.appId, appId),
          eq(appGrant.granteeType, "group"),
          eq(appGrant.granteeId, groupId),
          eq(appGrant.grantedBy, context.userId)
        )
      );

    return reply.status(204).send();
  });

  fastify.post<{
    Params: { groupId: string };
    Body: { userId?: string; appId?: string; permission?: "use" | "deny"; reason?: string };
  }>("/manager/groups/:groupId/authorizations", async (request, reply) => {
    const context = await buildRouteContext(request, reply);
    if (!context) {
      return;
    }
    const groupId = request.params.groupId;
    if (!(await ensureTenantGroup(context.db, context.tenantId, groupId, reply))) {
      return;
    }
    if (!ensureManagerScope(reply, context, groupId)) {
      return;
    }

    const userId = typeof request.body?.userId === "string" ? request.body.userId : "";
    const appId = typeof request.body?.appId === "string" ? request.body.appId : "";
    if (!userId || !appId) {
      return badRequest(reply, "INVALID_REQUEST", "userId and appId are required");
    }
    if (!(await ensureTenantApp(context.db, context.tenantId, appId, reply))) {
      return;
    }
    if (!(await ensureTenantUser(context.db, context.tenantId, userId, reply))) {
      return;
    }

    const memberInGroup = await isUserInGroup(context.db, groupId, userId);
    if (!memberInGroup) {
      return badRequest(reply, "INVALID_SCOPE", "User must be a member of the managed group");
    }

    const hasGroupGrant = await context.db
      .select({ id: appGrant.id })
      .from(appGrant)
      .where(
        and(
          eq(appGrant.appId, appId),
          eq(appGrant.granteeType, "group"),
          eq(appGrant.granteeId, groupId),
          eq(appGrant.permission, "use")
        )
      )
      .limit(1);
    if (!hasGroupGrant[0]) {
      return forbidden(reply, "App is not authorized for this group");
    }

    const inserted = await context.db
      .insert(appGrant)
      .values({
        appId,
        granteeType: "user",
        granteeId: userId,
        permission: request.body?.permission === "deny" ? "deny" : "use",
        reason: typeof request.body?.reason === "string" ? request.body.reason.trim() || null : null,
        grantedBy: context.userId,
      })
      .returning({ id: appGrant.id });

    return reply.status(201).send({
      data: {
        id: inserted[0]?.id ?? null,
        appId,
        userId,
        groupId,
      },
    });
  });

  fastify.delete<{
    Params: { groupId: string; authorizationId: string };
  }>("/manager/groups/:groupId/authorizations/:authorizationId", async (request, reply) => {
    const context = await buildRouteContext(request, reply);
    if (!context) {
      return;
    }
    const groupId = request.params.groupId;
    if (!(await ensureTenantGroup(context.db, context.tenantId, groupId, reply))) {
      return;
    }
    if (!ensureManagerScope(reply, context, groupId)) {
      return;
    }

    const targetRows = await context.db
      .select({
        id: appGrant.id,
        appId: appGrant.appId,
        granteeType: appGrant.granteeType,
        granteeId: appGrant.granteeId,
      })
      .from(appGrant)
      .where(eq(appGrant.id, request.params.authorizationId))
      .limit(1);
    const target = targetRows[0];
    if (!target) {
      return reply.status(404).send({ errors: [{ code: "NOT_FOUND", message: "Authorization not found" }] });
    }
    if (target.granteeType !== "user") {
      return forbidden(reply, "Manager can only revoke user-level authorizations");
    }

    const inGroup = await isUserInGroup(context.db, groupId, target.granteeId);
    if (!inGroup) {
      return forbidden(reply, "Authorization target is outside managed group");
    }

    await context.db
      .delete(appGrant)
      .where(and(eq(appGrant.id, target.id), eq(appGrant.grantedBy, context.userId)));

    return reply.status(204).send();
  });

  fastify.get<{
    Params: { groupId: string };
  }>("/manager/groups/:groupId/quota", async (request, reply) => {
    const context = await buildRouteContext(request, reply);
    if (!context) {
      return;
    }
    if (!(await ensureTenantGroup(context.db, context.tenantId, request.params.groupId, reply))) {
      return;
    }
    if (!ensureManagerScope(reply, context, request.params.groupId)) {
      return;
    }

    const policies = await context.db
      .select()
      .from(quotaPolicy)
      .where(
        and(
          eq(quotaPolicy.tenantId, context.tenantId),
          eq(quotaPolicy.scopeType, "group"),
          eq(quotaPolicy.scopeId, request.params.groupId)
        )
      );

    const usage = await context.db
      .select({
        totalTokens: sql<number>`coalesce(sum(${quotaUsageLedger.totalTokens}), 0)`,
        requests: sql<number>`count(*)`,
      })
      .from(quotaUsageLedger)
      .where(
        and(
          eq(quotaUsageLedger.tenantId, context.tenantId),
          eq(quotaUsageLedger.groupId, request.params.groupId)
        )
      );

    return reply.status(200).send({
      data: {
        policies,
        usage: {
          totalTokens: Number(usage[0]?.totalTokens ?? 0),
          requests: Number(usage[0]?.requests ?? 0),
        },
      },
    });
  });

  fastify.get<{
    Params: { groupId: string };
  }>("/manager/groups/:groupId/stats", async (request, reply) => {
    const context = await buildRouteContext(request, reply);
    if (!context) {
      return;
    }
    if (!(await ensureTenantGroup(context.db, context.tenantId, request.params.groupId, reply))) {
      return;
    }
    if (!ensureManagerScope(reply, context, request.params.groupId)) {
      return;
    }

    const memberUsage = await context.db
      .select({
        userId: quotaUsageLedger.userId,
        userName: user.name,
        totalTokens: sql<number>`coalesce(sum(${quotaUsageLedger.totalTokens}), 0)`,
        requests: sql<number>`count(*)`,
      })
      .from(quotaUsageLedger)
      .innerJoin(user, eq(quotaUsageLedger.userId, user.id))
      .where(
        and(
          eq(quotaUsageLedger.tenantId, context.tenantId),
          eq(quotaUsageLedger.groupId, request.params.groupId)
        )
      )
      .groupBy(quotaUsageLedger.userId, user.name)
      .orderBy(desc(sql`coalesce(sum(${quotaUsageLedger.totalTokens}), 0)`))
      .limit(50);

    const appUsage = await context.db
      .select({
        appId: quotaUsageLedger.appId,
        appName: app.name,
        totalTokens: sql<number>`coalesce(sum(${quotaUsageLedger.totalTokens}), 0)`,
        requests: sql<number>`count(*)`,
      })
      .from(quotaUsageLedger)
      .innerJoin(app, eq(quotaUsageLedger.appId, app.id))
      .where(
        and(
          eq(quotaUsageLedger.tenantId, context.tenantId),
          eq(quotaUsageLedger.groupId, request.params.groupId)
        )
      )
      .groupBy(quotaUsageLedger.appId, app.name)
      .orderBy(desc(sql`coalesce(sum(${quotaUsageLedger.totalTokens}), 0)`))
      .limit(50);

    return reply.status(200).send({
      data: {
        groupId: request.params.groupId,
        memberUsage: memberUsage.map((item: any) => ({
          ...item,
          totalTokens: Number(item.totalTokens ?? 0),
          requests: Number(item.requests ?? 0),
        })),
        appUsage: appUsage.map((item: any) => ({
          ...item,
          totalTokens: Number(item.totalTokens ?? 0),
          requests: Number(item.requests ?? 0),
        })),
      },
    });
  });
}
