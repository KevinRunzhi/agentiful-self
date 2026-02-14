import {
  and,
  desc,
  eq,
  gte,
  lte,
  lt,
  or,
  type SQL,
} from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { getDatabase } from "@agentifui/db/client";
import { auditEvent } from "@agentifui/db/schema";
import type {
  AuditQueryCursor,
  AuditQueryInput,
  AuditQueryOutput,
  AuditEventCategory,
  PIIMaskStrategy,
} from "@agentifui/shared/types";
import { createSecurityPolicyConfigService, type SecurityPolicyConfigService } from "./security-policy-config.service.js";
import { piiMasker, type PIIMasker } from "./pii-masker.service.js";

function inferCategory(action: string, fallback?: string | null): AuditEventCategory {
  if (fallback === "authentication" || fallback === "authorization" || fallback === "data_access" || fallback === "management_change" || fallback === "security_event") {
    return fallback;
  }

  if (action.startsWith("auth.")) return "authentication";
  if (action.startsWith("authz.")) return "authorization";
  if (action.startsWith("access.")) return "data_access";
  if (action.startsWith("admin.")) return "management_change";
  return "security_event";
}

function encodeCursor(cursor: AuditQueryCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64");
}

function decodeCursor(cursor: string | undefined): AuditQueryCursor | null {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8")) as AuditQueryCursor;
    if (
      typeof parsed.createdAt === "string" &&
      parsed.createdAt &&
      typeof parsed.id === "string" &&
      parsed.id
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function resolveDateRange(input: AuditQueryInput): { startAt?: Date; endAt?: Date } {
  const endAt = input.endAt ? new Date(input.endAt) : undefined;
  if (input.startAt) {
    return {
      startAt: new Date(input.startAt),
      endAt,
    };
  }

  if (endAt) {
    return {
      startAt: new Date(endAt.getTime() - 30 * 24 * 60 * 60 * 1000),
      endAt,
    };
  }

  return {
    startAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endAt: new Date(),
  };
}

function toMaskStrategy(raw: unknown): PIIMaskStrategy {
  if (raw === "hash" || raw === "remove" || raw === "mask") {
    return raw;
  }
  return "mask";
}

type AuditRow = typeof auditEvent.$inferSelect;

function normalizeRow(row: AuditRow): Record<string, unknown> {
  return {
    id: row.id,
    tenantId: row.tenantId,
    actorUserId: row.actorUserId,
    actorType: row.actorType,
    actorRole: row.actorRole ?? null,
    eventCategory: inferCategory(row.action, row.eventCategory),
    eventType: row.eventType ?? row.action,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    targetType: row.targetType,
    targetId: row.targetId,
    result: row.result,
    severity: row.severity ?? null,
    reason: row.reason ?? null,
    errorMessage: row.errorMessage,
    traceId: row.traceId,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    metadata: row.metadata ?? {},
    createdAt: row.createdAt?.toISOString?.() ?? null,
  };
}

export class AuditQueryService {
  private readonly db: PostgresJsDatabase;
  private readonly policyService: SecurityPolicyConfigService;
  private readonly masker: PIIMasker;

  constructor(
    db: PostgresJsDatabase = getDatabase() as PostgresJsDatabase,
    policyService?: SecurityPolicyConfigService,
    masker: PIIMasker = piiMasker
  ) {
    this.db = db;
    this.policyService = policyService ?? createSecurityPolicyConfigService(db);
    this.masker = masker;
  }

  async query(input: AuditQueryInput): Promise<AuditQueryOutput<Record<string, unknown>>> {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 500);
    const cursor = decodeCursor(input.cursor);
    const { startAt, endAt } = resolveDateRange(input);
    const conditions: SQL[] = [eq(auditEvent.tenantId, input.tenantId)];

    if (startAt) {
      conditions.push(gte(auditEvent.createdAt, startAt));
    }
    if (endAt) {
      conditions.push(lte(auditEvent.createdAt, endAt));
    }
    if (input.actorUserId) {
      conditions.push(eq(auditEvent.actorUserId, input.actorUserId));
    }
    if (input.eventType) {
      conditions.push(eq(auditEvent.eventType, input.eventType));
    }
    if (input.targetType) {
      conditions.push(eq(auditEvent.targetType, input.targetType));
    }
    if (input.targetId) {
      conditions.push(eq(auditEvent.targetId, input.targetId));
    }
    if (input.result) {
      conditions.push(eq(auditEvent.result, input.result));
    }
    if (input.severity) {
      conditions.push(eq(auditEvent.severity, input.severity));
    }
    if (input.eventCategory) {
      conditions.push(eq(auditEvent.eventCategory, input.eventCategory));
    }
    if (cursor) {
      conditions.push(
        or(
          lt(auditEvent.createdAt, new Date(cursor.createdAt)),
          and(eq(auditEvent.createdAt, new Date(cursor.createdAt)), lt(auditEvent.id, cursor.id))
        ) as SQL
      );
    }

    const rows = await this.db
      .select()
      .from(auditEvent)
      .where(and(...conditions))
      .orderBy(desc(auditEvent.createdAt), desc(auditEvent.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const mapped = items.map((item) => normalizeRow(item));
    const masked = await this.applyMasking(input.tenantId, mapped);

    const last = items[items.length - 1];
    return {
      items: masked,
      hasMore,
      nextCursor:
        hasMore && last?.createdAt
          ? encodeCursor({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  async getDetail(tenantId: string, eventId: string): Promise<Record<string, unknown> | null> {
    const [row] = await this.db
      .select()
      .from(auditEvent)
      .where(and(eq(auditEvent.tenantId, tenantId), eq(auditEvent.id, eventId)))
      .limit(1);

    if (!row) {
      return null;
    }

    const [masked] = await this.applyMasking(tenantId, [normalizeRow(row)]);
    return masked ?? null;
  }

  private async applyMasking(
    tenantId: string,
    rows: Record<string, unknown>[]
  ): Promise<Record<string, unknown>[]> {
    const policy = await this.policyService.getPolicy(tenantId);
    if (!policy.pii?.enabled) {
      return rows;
    }

    const strategy = toMaskStrategy(policy.pii.strategy);
    return rows.map((row) => ({
      ...row,
      reason:
        typeof row.reason === "string"
          ? this.masker.mask({ text: row.reason, strategy }).maskedText
          : row.reason,
      errorMessage:
        typeof row.errorMessage === "string"
          ? this.masker.mask({ text: row.errorMessage, strategy }).maskedText
          : row.errorMessage,
      metadata: this.masker.maskObject(row.metadata, strategy),
    }));
  }
}

export function createAuditQueryService(db?: PostgresJsDatabase): AuditQueryService {
  const safeDb = db ?? (getDatabase() as PostgresJsDatabase);
  return new AuditQueryService(safeDb, createSecurityPolicyConfigService(safeDb), piiMasker);
}
