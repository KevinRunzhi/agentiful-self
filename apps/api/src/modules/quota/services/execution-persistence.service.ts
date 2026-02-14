import { and, asc, desc, eq, gt } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  app,
  conversation,
  dataSyncLog,
  message,
  promptInjectionLog,
  run,
  runStep,
  tenant,
} from "@agentifui/db/schema";
import { createNotificationService } from "../../notifications/services/notification.service";
import { createQuotaRepository } from "../repositories/quota.repository";

type PromptInjectionAction = "log" | "alert" | "block";
type RunType = "workflow" | "agent" | "generation";

export interface CitationPayload {
  id: string;
  title: string;
  snippet: string;
  url?: string;
  score?: number;
  documentName?: string;
}

export interface ExecutionStartInput {
  tenantId: string;
  userId: string;
  appId: string;
  activeGroupId: string | null;
  traceId: string;
  conversationId?: string;
  conversationClientId?: string;
  messageClientId?: string;
  promptText: string;
  payload: Record<string, unknown>;
}

export interface ExecutionStartResult {
  runId: string;
  conversationId: string;
  runType: RunType;
}

export interface ExecutionCompleteInput {
  runId: string;
  tenantId: string;
  userId: string;
  appId: string;
  conversationId: string;
  traceId: string;
  model: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  citations?: CitationPayload[];
}

interface PromptDetectionResult {
  matched: boolean;
  score: number;
  riskType: string;
}

export class ExecutionHttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ExecutionHttpError";
  }
}

const INJECTION_RULES: Array<{ type: string; pattern: RegExp; score: number }> = [
  { type: "ignore_previous_instructions", pattern: /ignore\s+previous\s+instructions/i, score: 0.5 },
  { type: "system_prompt_probe", pattern: /system\s+prompt/i, score: 0.35 },
  { type: "role_hijack", pattern: /\bact\s+as\b/i, score: 0.25 },
  { type: "encoded_payload", pattern: /[A-Za-z0-9+/]{28,}={0,2}/, score: 0.25 },
];

export function detectPromptInjection(input: string): PromptDetectionResult {
  if (!input.trim()) {
    return { matched: false, score: 0, riskType: "none" };
  }

  const matchedRules = INJECTION_RULES.filter((rule) => rule.pattern.test(input));
  if (matchedRules.length === 0) {
    return { matched: false, score: 0, riskType: "none" };
  }

  const score = Math.min(
    1,
    matchedRules.reduce((sum, rule) => sum + rule.score, 0)
  );

  return {
    matched: true,
    score,
    riskType: matchedRules.map((rule) => rule.type).join(","),
  };
}

function deriveRunType(mode: string | null | undefined): RunType {
  if (mode === "workflow") {
    return "workflow";
  }
  if (mode === "agent") {
    return "agent";
  }
  return "generation";
}

function createConversationTitle(promptText: string): string {
  const normalized = promptText.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "New conversation";
  }
  return normalized.slice(0, 80);
}

function normalizePromptAction(value: unknown): PromptInjectionAction {
  if (value === "log" || value === "alert" || value === "block") {
    return value;
  }
  return "alert";
}

export class ExecutionPersistenceService {
  constructor(private readonly db: PostgresJsDatabase) {}

  async startExecution(input: ExecutionStartInput): Promise<ExecutionStartResult> {
    const appRecord = await this.getAccessibleApp(input.tenantId, input.appId);
    const conversationId = await this.ensureConversation({
      tenantId: input.tenantId,
      userId: input.userId,
      appId: input.appId,
      activeGroupId: input.activeGroupId,
      conversationId: input.conversationId,
      conversationClientId: input.conversationClientId,
      title: createConversationTitle(input.promptText),
    });

    const userMessageId = await this.insertUserMessage({
      tenantId: input.tenantId,
      userId: input.userId,
      appId: input.appId,
      conversationId,
      traceId: input.traceId,
      promptText: input.promptText,
      clientId: input.messageClientId,
    });

    const detection = detectPromptInjection(input.promptText);
    if (detection.matched) {
      const action = await this.resolvePromptInjectionAction(input.tenantId);

      await this.db.insert(promptInjectionLog).values({
        tenantId: input.tenantId,
        userId: input.userId,
        conversationId,
        messageId: userMessageId,
        riskScore: detection.score,
        riskType: detection.riskType,
        action,
        raw: input.promptText.slice(0, 4_000),
        traceId: input.traceId,
      });

      if (action === "alert" || action === "block") {
        await this.dispatchPromptInjectionAlert({
          tenantId: input.tenantId,
          userId: input.userId,
          conversationId,
          riskType: detection.riskType,
          riskScore: detection.score,
          traceId: input.traceId,
        });
      }

      if (action === "block") {
        throw new ExecutionHttpError(
          400,
          "prompt_injection_blocked",
          "Potential prompt injection detected"
        );
      }
    }

    const runType = deriveRunType(appRecord.mode);
    const [createdRun] = await this.db
      .insert(run)
      .values({
        tenantId: input.tenantId,
        conversationId,
        appId: input.appId,
        userId: input.userId,
        activeGroupId: input.activeGroupId,
        type: runType,
        triggeredBy: "user",
        status: "pending",
        inputs: input.payload,
        traceId: input.traceId,
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: run.id });

    await this.db
      .update(run)
      .set({
        status: "running",
        updatedAt: new Date(),
      })
      .where(eq(run.id, createdRun.id));

    return {
      runId: createdRun.id,
      conversationId,
      runType,
    };
  }

  async completeExecution(input: ExecutionCompleteInput): Promise<void> {
    const [existingRun] = await this.db
      .select({
        id: run.id,
        type: run.type,
        startedAt: run.startedAt,
      })
      .from(run)
      .where(eq(run.id, input.runId))
      .limit(1);

    if (!existingRun) {
      return;
    }

    const finishedAt = new Date();
    const durationMs = Math.max(0, finishedAt.getTime() - existingRun.startedAt.getTime());
    const totalTokens = Math.max(0, input.inputTokens + input.outputTokens);
    const contentParts: Array<Record<string, unknown>> = [];

    if (input.content.trim()) {
      contentParts.push({
        type: "text",
        text: input.content,
      });
    }

    for (const citation of input.citations ?? []) {
      contentParts.push({
        type: "citation",
        citation,
      });
    }

    await this.db.transaction(async (tx) => {
      await tx.insert(message).values({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        appId: input.appId,
        runId: input.runId,
        userId: input.userId,
        role: "assistant",
        content: input.content,
        contentParts,
        metadata: {
          citationsCount: input.citations?.length ?? 0,
        },
        model: input.model,
        provider: "agentifui",
        traceId: input.traceId,
        clientId: `assistant:${input.runId}`,
      });

      if (existingRun.type === "agent" || existingRun.type === "workflow") {
        await tx
          .insert(runStep)
          .values({
            runId: input.runId,
            stepIndex: 0,
            nodeId: "final-output",
            nodeType: "response",
            title: "Final response",
            status: "completed",
            outputs: {
              preview: input.content.slice(0, 200),
            },
            durationMs,
            inputTokens: input.inputTokens,
            outputTokens: input.outputTokens,
            totalTokens,
            startedAt: existingRun.startedAt,
            finishedAt,
            updatedAt: finishedAt,
          })
          .onConflictDoUpdate({
            target: [runStep.runId, runStep.stepIndex],
            set: {
              status: "completed",
              outputs: {
                preview: input.content.slice(0, 200),
              },
              durationMs,
              inputTokens: input.inputTokens,
              outputTokens: input.outputTokens,
              totalTokens,
              finishedAt,
              updatedAt: finishedAt,
            },
          });
      }

      await tx
        .update(run)
        .set({
          status: "completed",
          outputs: {
            content: input.content,
            citations: input.citations ?? [],
          },
          error: null,
          durationMs,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          totalTokens,
          model: input.model,
          finishedAt,
          updatedAt: finishedAt,
        })
        .where(eq(run.id, input.runId));

      await tx
        .update(conversation)
        .set({
          updatedAt: finishedAt,
        })
        .where(eq(conversation.id, input.conversationId));
    });
  }

  async failExecution(runId: string, errorMessage: string): Promise<void> {
    await this.db
      .update(run)
      .set({
        status: "failed",
        error: errorMessage.slice(0, 2_000),
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(run.id, runId));
  }

  async stopExecution(runId: string, tenantId: string, userId: string): Promise<boolean> {
    const [existingRun] = await this.db
      .select({
        id: run.id,
        status: run.status,
      })
      .from(run)
      .where(and(eq(run.id, runId), eq(run.tenantId, tenantId), eq(run.userId, userId)))
      .limit(1);

    if (!existingRun) {
      return false;
    }

    if (existingRun.status === "completed" || existingRun.status === "failed" || existingRun.status === "stopped") {
      return true;
    }

    await this.db
      .update(run)
      .set({
        status: "stopped",
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(run.id, runId));

    return true;
  }

  async listRuns(input: {
    tenantId: string;
    userId: string;
    appId?: string;
    conversationId?: string;
    status?: string;
    limit?: number;
  }): Promise<Array<Record<string, unknown>>> {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
    const conditions = [eq(run.tenantId, input.tenantId), eq(run.userId, input.userId)];

    if (input.appId) {
      conditions.push(eq(run.appId, input.appId));
    }
    if (input.conversationId) {
      conditions.push(eq(run.conversationId, input.conversationId));
    }
    if (input.status) {
      conditions.push(eq(run.status, input.status));
    }

    const rows = await this.db
      .select({
        id: run.id,
        tenantId: run.tenantId,
        userId: run.userId,
        appId: run.appId,
        appName: app.name,
        appStatus: app.status,
        conversationId: run.conversationId,
        type: run.type,
        status: run.status,
        traceId: run.traceId,
        model: run.model,
        durationMs: run.durationMs,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        totalTokens: run.totalTokens,
        error: run.error,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        updatedAt: run.updatedAt,
      })
      .from(run)
      .leftJoin(app, eq(run.appId, app.id))
      .where(and(...conditions))
      .orderBy(desc(run.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      ...row,
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async getRunDetail(input: {
    runId: string;
    tenantId: string;
    userId: string;
  }): Promise<Record<string, unknown> | null> {
    const [runRow] = await this.db
      .select({
        id: run.id,
        tenantId: run.tenantId,
        userId: run.userId,
        appId: run.appId,
        appName: app.name,
        appStatus: app.status,
        conversationId: run.conversationId,
        type: run.type,
        status: run.status,
        traceId: run.traceId,
        model: run.model,
        durationMs: run.durationMs,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        totalTokens: run.totalTokens,
        error: run.error,
        outputs: run.outputs,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        updatedAt: run.updatedAt,
      })
      .from(run)
      .leftJoin(app, eq(run.appId, app.id))
      .where(and(eq(run.id, input.runId), eq(run.tenantId, input.tenantId), eq(run.userId, input.userId)))
      .limit(1);

    if (!runRow) {
      return null;
    }

    const steps = await this.db
      .select({
        id: runStep.id,
        runId: runStep.runId,
        stepIndex: runStep.stepIndex,
        nodeId: runStep.nodeId,
        nodeType: runStep.nodeType,
        title: runStep.title,
        status: runStep.status,
        durationMs: runStep.durationMs,
        inputTokens: runStep.inputTokens,
        outputTokens: runStep.outputTokens,
        totalTokens: runStep.totalTokens,
        error: runStep.error,
        startedAt: runStep.startedAt,
        finishedAt: runStep.finishedAt,
      })
      .from(runStep)
      .where(eq(runStep.runId, runRow.id))
      .orderBy(asc(runStep.stepIndex));

    return {
      ...runRow,
      startedAt: runRow.startedAt.toISOString(),
      finishedAt: runRow.finishedAt ? runRow.finishedAt.toISOString() : null,
      updatedAt: runRow.updatedAt.toISOString(),
      steps: steps.map((step) => ({
        ...step,
        startedAt: step.startedAt.toISOString(),
        finishedAt: step.finishedAt ? step.finishedAt.toISOString() : null,
      })),
    };
  }

  async syncConversation(input: {
    tenantId: string;
    userId: string;
    conversationId: string;
    trigger: "auto" | "user" | "admin";
    traceId: string;
    forceFailure?: boolean;
  }): Promise<{
    id: string;
    status: "completed" | "failed";
    degraded: boolean;
    message?: string;
    updatedAt: string;
  }> {
    const [targetConversation] = await this.db
      .select({
        id: conversation.id,
      })
      .from(conversation)
      .where(
        and(
          eq(conversation.id, input.conversationId),
          eq(conversation.tenantId, input.tenantId),
          eq(conversation.userId, input.userId)
        )
      )
      .limit(1);

    if (!targetConversation) {
      throw new ExecutionHttpError(404, "conversation_not_found", "Conversation not found");
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const [recent] = await this.db
      .select({
        id: dataSyncLog.id,
      })
      .from(dataSyncLog)
      .where(
        and(
          eq(dataSyncLog.conversationId, input.conversationId),
          gt(dataSyncLog.createdAt, fiveMinutesAgo)
        )
      )
      .orderBy(desc(dataSyncLog.createdAt))
      .limit(1);

    if (recent) {
      return {
        id: recent.id,
        status: "failed",
        degraded: true,
        message: "Sync rate limited: one sync per conversation every 5 minutes",
        updatedAt: new Date().toISOString(),
      };
    }

    const [created] = await this.db
      .insert(dataSyncLog)
      .values({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        syncType: "incremental",
        status: "pending",
        triggeredBy: input.trigger,
        traceId: input.traceId,
      })
      .returning({ id: dataSyncLog.id });

    await this.db
      .update(dataSyncLog)
      .set({
        status: "syncing",
        updatedAt: new Date(),
      })
      .where(eq(dataSyncLog.id, created.id));

    if (input.forceFailure) {
      await this.db
        .update(dataSyncLog)
        .set({
          status: "failed",
          error: "Upstream sync failed",
          updatedAt: new Date(),
        })
        .where(eq(dataSyncLog.id, created.id));

      return {
        id: created.id,
        status: "failed",
        degraded: true,
        message: "Data may be incomplete. Showing local data only.",
        updatedAt: new Date().toISOString(),
      };
    }

    const updatedAt = new Date();
    await this.db.transaction(async (tx) => {
      await tx
        .update(conversation)
        .set({
          updatedAt,
        })
        .where(eq(conversation.id, input.conversationId));

      await tx
        .update(dataSyncLog)
        .set({
          status: "completed",
          updatedAt,
        })
        .where(eq(dataSyncLog.id, created.id));
    });

    return {
      id: created.id,
      status: "completed",
      degraded: false,
      updatedAt: updatedAt.toISOString(),
    };
  }

  private async getAccessibleApp(tenantId: string, appId: string): Promise<{ mode: string | null }> {
    const [appRecord] = await this.db
      .select({
        id: app.id,
        mode: app.mode,
        status: app.status,
      })
      .from(app)
      .where(and(eq(app.tenantId, tenantId), eq(app.id, appId)))
      .limit(1);

    if (!appRecord) {
      throw new ExecutionHttpError(404, "app_not_found", "App not found in tenant");
    }

    if (appRecord.status !== "active") {
      throw new ExecutionHttpError(
        409,
        "app_unavailable",
        "App is unavailable for new executions"
      );
    }

    return {
      mode: appRecord.mode,
    };
  }

  private async ensureConversation(input: {
    tenantId: string;
    userId: string;
    appId: string;
    activeGroupId: string | null;
    conversationId?: string;
    conversationClientId?: string;
    title: string;
  }): Promise<string> {
    if (input.conversationId) {
      const [existingConversation] = await this.db
        .select({
          id: conversation.id,
          appId: conversation.appId,
          status: conversation.status,
        })
        .from(conversation)
        .where(
          and(
            eq(conversation.id, input.conversationId),
            eq(conversation.tenantId, input.tenantId),
            eq(conversation.userId, input.userId)
          )
        )
        .limit(1);

      if (!existingConversation) {
        throw new ExecutionHttpError(
          403,
          "conversation_forbidden",
          "Conversation is not accessible by current user"
        );
      }

      if (existingConversation.appId !== input.appId) {
        throw new ExecutionHttpError(
          403,
          "app_context_mismatch",
          "Cross-app conversation context is not allowed"
        );
      }

      if (existingConversation.status === "deleted") {
        throw new ExecutionHttpError(
          409,
          "conversation_deleted",
          "Conversation is deleted and read-only"
        );
      }

      return existingConversation.id;
    }

    const [createdConversation] = await this.db
      .insert(conversation)
      .values({
        tenantId: input.tenantId,
        userId: input.userId,
        appId: input.appId,
        activeGroupId: input.activeGroupId,
        title: input.title,
        status: "active",
        clientId: input.conversationClientId ?? null,
        inputs: {},
      })
      .returning({ id: conversation.id });

    return createdConversation.id;
  }

  private async insertUserMessage(input: {
    tenantId: string;
    userId: string;
    appId: string;
    conversationId: string;
    traceId: string;
    promptText: string;
    clientId?: string;
  }): Promise<string | null> {
    if (!input.promptText.trim()) {
      return null;
    }

    const clientId = input.clientId?.trim() || `user:${input.traceId}`;
    const [inserted] = await this.db
      .insert(message)
      .values({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        userId: input.userId,
        appId: input.appId,
        role: "user",
        content: input.promptText,
        contentParts: [{ type: "text", text: input.promptText }],
        traceId: input.traceId,
        clientId,
      })
      .onConflictDoNothing({
        target: message.clientId,
      })
      .returning({ id: message.id });

    if (inserted) {
      return inserted.id;
    }

    const [existing] = await this.db
      .select({ id: message.id })
      .from(message)
      .where(eq(message.clientId, clientId))
      .limit(1);

    return existing?.id ?? null;
  }

  private async resolvePromptInjectionAction(tenantId: string): Promise<PromptInjectionAction> {
    const [tenantRow] = await this.db
      .select({
        customConfig: tenant.customConfig,
      })
      .from(tenant)
      .where(eq(tenant.id, tenantId))
      .limit(1);

    const configured = (tenantRow?.customConfig as Record<string, unknown> | undefined)?.security as
      | { promptInjection?: { action?: unknown } }
      | undefined;

    return normalizePromptAction(configured?.promptInjection?.action);
  }

  private async dispatchPromptInjectionAlert(input: {
    tenantId: string;
    userId: string;
    conversationId: string;
    riskType: string;
    riskScore: number;
    traceId: string;
  }): Promise<void> {
    try {
      const quotaRepository = createQuotaRepository(this.db as any);
      const notificationService = createNotificationService(this.db as any);
      const adminIds = await quotaRepository.listTenantAdminUserIds(input.tenantId);

      for (const adminId of adminIds) {
        await notificationService.create({
          tenantId: input.tenantId,
          recipientId: adminId,
          type: "system",
          title: "Prompt injection detected",
          content: "A conversation triggered prompt injection detection.",
          traceId: input.traceId,
          createdAt: new Date(),
          metadata: {
            userId: input.userId,
            conversationId: input.conversationId,
            riskType: input.riskType,
            riskScore: input.riskScore,
          },
        });
      }
    } catch {
      // Notification dispatch should not block main request flow.
    }
  }
}

export function createExecutionPersistenceService(db: PostgresJsDatabase): ExecutionPersistenceService {
  return new ExecutionPersistenceService(db);
}
