import { and, count, eq, gte, lte, type SQL } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { getDatabase } from "@agentifui/db/client";
import { auditEvent, auditExportJob } from "@agentifui/db/schema";
import type {
  AuditExportInput,
  AuditExportResult,
  AuditQueryInput,
} from "@agentifui/shared/types";
import { auditService } from "../../auth/services/audit.service.js";
import { createAuditQueryService, type AuditQueryService } from "./audit-query.service.js";

const MAX_SYNC_EXPORT = 100_000;

interface ExportArtifact {
  content: string;
  expiresAt: Date;
  format: "csv" | "json";
  itemCount: number;
}

const exportFileStore = new Map<string, ExportArtifact>();

function buildCountConditions(input: AuditQueryInput): SQL[] {
  const conditions: SQL[] = [eq(auditEvent.tenantId, input.tenantId)];

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
  if (input.startAt) {
    conditions.push(gte(auditEvent.createdAt, new Date(input.startAt)));
  }
  if (input.endAt) {
    conditions.push(lte(auditEvent.createdAt, new Date(input.endAt)));
  }

  return conditions;
}

function toCsv(items: Record<string, unknown>[]): string {
  if (items.length === 0) {
    return "";
  }

  const headers = Object.keys(items[0] ?? {});
  const lines = [headers.join(",")];

  for (const item of items) {
    const row = headers.map((header) => {
      const value = item[header];
      const raw =
        value === null || value === undefined
          ? ""
          : typeof value === "string"
            ? value
            : JSON.stringify(value);
      return `"${raw.replaceAll('"', '""')}"`;
    });
    lines.push(row.join(","));
  }

  return lines.join("\n");
}

export class AuditExportError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "AuditExportError";
  }
}

export class AuditExportService {
  private readonly db: PostgresJsDatabase;
  private readonly auditQueryService: AuditQueryService;

  constructor(
    db: PostgresJsDatabase = getDatabase() as PostgresJsDatabase,
    auditQueryService?: AuditQueryService
  ) {
    this.db = db;
    this.auditQueryService = auditQueryService ?? createAuditQueryService(db);
  }

  async export(input: AuditExportInput): Promise<AuditExportResult> {
    if (input.requesterRole === "root_admin" && !input.breakglassReason?.trim()) {
      throw new AuditExportError(400, "breakglass_reason_required", "Break-glass reason is required");
    }

    const total = await this.countMatches(input);
    const format = input.format === "json" ? "json" : "csv";

    const items = await this.collectItems({
      ...input,
      limit: Math.min(1_000, MAX_SYNC_EXPORT),
    });

    if (total <= MAX_SYNC_EXPORT) {
      const content = format === "json" ? JSON.stringify(items, null, 2) : toCsv(items);
      await this.logExportAudit(input, total, "sync");
      return {
        mode: "sync",
        format,
        itemCount: total,
        content,
      };
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const content = format === "json" ? JSON.stringify(items, null, 2) : toCsv(items);
    const [job] = await this.db
      .insert(auditExportJob)
      .values({
        tenantId: input.tenantId,
        requesterUserId: input.requesterUserId,
        format,
        status: "completed",
        filters: input as Record<string, unknown>,
        itemCount: total,
        filePath: `/v1/admin/audit/exports/${input.tenantId}`,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: auditExportJob.id });

    if (!job) {
      throw new AuditExportError(500, "export_job_create_failed", "Failed to create async export job");
    }

    exportFileStore.set(job.id, {
      content,
      expiresAt,
      format,
      itemCount: total,
    });

    await this.logExportAudit(input, total, "async");
    return {
      mode: "async",
      format,
      itemCount: total,
      jobId: job.id,
      downloadPath: `/v1/admin/audit/exports/${job.id}/download`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async getAsyncExport(jobId: string, tenantId?: string): Promise<AuditExportResult | null> {
    const [job] = await this.db
      .select()
      .from(auditExportJob)
      .where(
        tenantId
          ? and(eq(auditExportJob.id, jobId), eq(auditExportJob.tenantId, tenantId))
          : eq(auditExportJob.id, jobId)
      )
      .limit(1);

    if (!job) {
      return null;
    }

    const artifact = exportFileStore.get(jobId);
    const expired = !!artifact && artifact.expiresAt.getTime() <= Date.now();
    if (expired) {
      exportFileStore.delete(jobId);
    }

    return {
      mode: "async",
      format: job.format === "json" ? "json" : "csv",
      itemCount: job.itemCount,
      jobId: job.id,
      content: artifact && !expired ? artifact.content : undefined,
      downloadPath: `/v1/admin/audit/exports/${job.id}/download`,
      expiresAt: job.expiresAt?.toISOString(),
    };
  }

  private async countMatches(input: AuditQueryInput): Promise<number> {
    const conditions = buildCountConditions(input);
    const [row] = await this.db
      .select({ total: count() })
      .from(auditEvent)
      .where(and(...conditions));
    return Number(row?.total ?? 0);
  }

  private async collectItems(baseInput: AuditQueryInput): Promise<Record<string, unknown>[]> {
    const items: Record<string, unknown>[] = [];
    let cursor: string | undefined;

    while (true) {
      const page = await this.auditQueryService.query({
        ...baseInput,
        cursor,
      });
      items.push(...page.items);
      if (!page.hasMore || !page.nextCursor) {
        break;
      }
      cursor = page.nextCursor;
      if (items.length > MAX_SYNC_EXPORT) {
        break;
      }
    }

    return items;
  }

  private async logExportAudit(
    input: AuditExportInput,
    itemCount: number,
    mode: "sync" | "async"
  ): Promise<void> {
    await auditService.logSuccess({
      tenantId: input.tenantId,
      actorUserId: input.requesterUserId,
      actorType: "user",
      actorRole: input.requesterRole,
      action: "access.audit.exported",
      eventCategory: "data_access",
      eventType: "access.audit.exported",
      resourceType: "audit_event",
      resourceId: input.tenantId,
      severity: input.requesterRole === "root_admin" ? "critical" : "high",
      reason: input.breakglassReason,
      metadata: {
        format: input.format ?? "csv",
        itemCount,
        mode,
        filters: {
          actorUserId: input.actorUserId,
          eventCategory: input.eventCategory,
          eventType: input.eventType,
          startAt: input.startAt,
          endAt: input.endAt,
        },
      },
      traceId: `audit-export:${Date.now()}`,
    });
  }
}

export function createAuditExportService(db?: PostgresJsDatabase): AuditExportService {
  const safeDb = db ?? (getDatabase() as PostgresJsDatabase);
  return new AuditExportService(safeDb, createAuditQueryService(safeDb));
}
