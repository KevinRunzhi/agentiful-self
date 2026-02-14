
/**
 * S2-2 Conversation Service
 *
 * Provides:
 * - Conversation/session management
 * - Message generation helpers
 * - Streaming stop control (hard/soft)
 * - Share links
 * - File upload/download metadata
 * - Artifact draft/version lifecycle
 * - HITL response persistence
 */

import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDatabase } from "@agentifui/db/client";
import {
  artifact,
  conversation,
  conversationShare,
  fileAttachment,
  message,
  messageFeedback,
  type MessageContentPayload,
} from "@agentifui/db/schema/conversation";
import { app } from "@agentifui/db/schema/rbac";
import { and, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { auditService } from "../../auth/services/audit.service.js";

type Database = ReturnType<typeof getDatabase>;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DEFAULT_FILE_LIMIT_BYTES = 50 * 1024 * 1024;
const DEFAULT_MAX_FILES_PER_REQUEST = 10;
const DEFAULT_FILE_RETENTION_DAYS = 90;

const ALLOWED_FILE_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/json",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/gif",
  "audio/mpeg",
  "audio/mp3",
  "video/mp4",
]);

interface StreamRunState {
  messageId: string;
  supportsAbort: boolean;
  hardStopped: boolean;
  softStopped: boolean;
}

const streamRunState = new Map<string, StreamRunState>();

export interface ConversationUserContext {
  userId: string;
  tenantId: string;
  activeGroupId: string | null;
  traceId: string;
}

export interface ListConversationsInput {
  q?: string;
  status?: "active" | "archived";
  cursor?: string;
  limit?: number;
}

export interface CreateConversationInput {
  appId: string;
  title?: string;
  clientId?: string;
  inputs?: Record<string, unknown>;
}

export interface UpdateConversationInput {
  title?: string;
  pinned?: boolean;
  status?: "active" | "archived" | "deleted";
}

export interface SendMessageInput {
  content: string;
  clientId?: string;
  parentId?: string;
  model?: string;
  provider?: string;
  attachmentIds?: string[];
}

export interface UploadConversationFileInput {
  fileName: string;
  fileType: string;
  contentBase64: string;
}

export interface ShareConversationInput {
  requireLogin?: boolean;
  expiresAt?: string | null;
}

export interface MessageFeedbackInput {
  rating: "like" | "dislike";
  comment?: string;
}

export interface HitlResponseInput {
  action: "confirm" | "select" | "approve" | "input";
  value: string | string[] | boolean;
}

export interface GeneratedMessagePayload {
  assistantMessageId: string;
  content: string;
  contentParts: MessageContentPayload;
  suggestions: string[];
  chunks: string[];
  hitlPrompt: MessageContentPayload["parts"][number] | null;
  artifactId: string | null;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 180);
}

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url");
}

function decodeCursor(cursor: string | undefined): number {
  if (!cursor) {
    return 0;
  }

  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      offset?: number;
    };
    if (typeof decoded.offset === "number" && decoded.offset >= 0) {
      return decoded.offset;
    }
    return 0;
  } catch {
    return 0;
  }
}

function nowIsoString(): string {
  return new Date().toISOString();
}

function splitToChunks(content: string, chunkSize = 24): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < content.length; index += chunkSize) {
    chunks.push(content.slice(index, index + chunkSize));
  }
  return chunks.length > 0 ? chunks : [""];
}

function generateFollowupQuestions(content: string): string[] {
  const trimmed = content.trim();
  if (!trimmed) {
    return ["你希望我先做哪一步？", "要不要给你一个可执行清单？"];
  }

  return [
    `要不要我把「${trimmed.slice(0, 20)}」拆成分步骤？`,
    "你想让我给出风险点和回滚方案吗？",
    "需要我生成可直接执行的命令或代码吗？",
  ];
}

function buildAssistantText(content: string): string {
  const normalized = content.trim();
  const mathRelated = /\$|数学|公式|equation|theorem/i.test(normalized);
  const codeRelated = /code|代码|script|函数|function|sql|query/i.test(normalized);

  const lines = [
    `已收到你的输入：${normalized || "（空内容）"}`,
    "我已完成初步分析，并整理了可执行建议。",
  ];

  if (mathRelated) {
    lines.push("你也可以在对话里直接输入数学表达式，例如：$$a^2 + b^2 = c^2$$。");
  }

  if (codeRelated) {
    lines.push("我检测到你在询问代码相关内容，已生成一个可编辑草稿 Artifact。");
    lines.push("```ts\nexport function runTask(input: string) {\n  return `processed:${input}`;\n}\n```");
  }

  return lines.join("\n\n");
}

function maybeBuildHitlPart(content: string): MessageContentPayload["parts"][number] | null {
  if (!/确认|approve|审批|select|选择/i.test(content)) {
    return null;
  }

  return {
    type: "hitl",
    hitl: {
      action: /select|选择/i.test(content) ? "select" : "confirm",
      title: "请确认下一步操作",
      description: "该步骤需要你确认后继续执行。",
      options: [
        { id: "yes", label: "继续" },
        { id: "no", label: "取消" },
      ],
      required: true,
      timeoutMs: 120000,
    },
  };
}

function extractCodeBlock(content: string): string | null {
  const match = content.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  if (!match?.[1]) {
    return null;
  }

  return match[1].trim();
}

function randomShareCode(): string {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const bytes = randomBytes(12);
  let code = "";
  for (const byte of bytes) {
    code += alphabet[byte % alphabet.length];
  }
  return code;
}

export class ConversationService {
  private readonly db: Database;

  constructor(db?: Database) {
    this.db = db ?? getDatabase();
  }

  registerStreamRun(messageId: string, supportsAbort: boolean): void {
    streamRunState.set(messageId, {
      messageId,
      supportsAbort,
      hardStopped: false,
      softStopped: false,
    });
  }

  requestStop(messageId: string): { stopType: "hard" | "soft" | "none" } {
    const run = streamRunState.get(messageId);
    if (!run) {
      return { stopType: "none" };
    }

    if (run.supportsAbort) {
      run.hardStopped = true;
      return { stopType: "hard" };
    }

    run.softStopped = true;
    return { stopType: "soft" };
  }

  isHardStopped(messageId: string): boolean {
    return streamRunState.get(messageId)?.hardStopped ?? false;
  }

  isSoftStopped(messageId: string): boolean {
    return streamRunState.get(messageId)?.softStopped ?? false;
  }

  completeStreamRun(messageId: string): void {
    streamRunState.delete(messageId);
  }

  async createConversation(
    context: ConversationUserContext,
    input: CreateConversationInput
  ) {
    const existingApp = await this.db
      .select({ id: app.id })
      .from(app)
      .where(
        and(
          eq(app.id, input.appId),
          eq(app.tenantId, context.tenantId),
          eq(app.status, "active")
        )
      )
      .limit(1);

    if (!existingApp[0]) {
      throw new Error("App not found or disabled");
    }

    if (input.clientId) {
      const existingConversation = await this.db
        .select()
        .from(conversation)
        .where(
          and(
            eq(conversation.tenantId, context.tenantId),
            eq(conversation.userId, context.userId),
            eq(conversation.clientId, input.clientId)
          )
        )
        .limit(1);
      if (existingConversation[0]) {
        return existingConversation[0];
      }
    }

    const [created] = await this.db
      .insert(conversation)
      .values({
        tenantId: context.tenantId,
        userId: context.userId,
        appId: input.appId,
        activeGroupId: context.activeGroupId ?? undefined,
        title: input.title?.trim() || "新对话",
        clientId: input.clientId,
        inputs: input.inputs ?? {},
      })
      .returning();

    return created;
  }

  async listConversations(
    context: ConversationUserContext,
    input: ListConversationsInput
  ) {
    const limit = Math.min(Math.max(input.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const offset = decodeCursor(input.cursor);
    const q = input.q?.trim();

    const whereClauses = [
      eq(conversation.tenantId, context.tenantId),
      eq(conversation.userId, context.userId),
      ne(conversation.status, "deleted"),
    ];

    if (input.status) {
      whereClauses.push(eq(conversation.status, input.status));
    }

    if (q) {
      const likePattern = `%${q}%`;
      whereClauses.push(
        sql`(
          ${conversation.title} ILIKE ${likePattern}
          OR EXISTS (
            SELECT 1 FROM message m
            WHERE m.conversation_id = ${conversation.id}
              AND m.content ILIKE ${likePattern}
          )
        )`
      );
    }

    const rows = await this.db
      .select({
        id: conversation.id,
        title: conversation.title,
        status: conversation.status,
        pinned: conversation.pinned,
        appId: conversation.appId,
        activeGroupId: conversation.activeGroupId,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      })
      .from(conversation)
      .where(and(...whereClauses))
      .orderBy(desc(conversation.pinned), desc(conversation.updatedAt), desc(conversation.id))
      .offset(offset)
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? encodeCursor(offset + limit) : null;

    return {
      items,
      nextCursor,
    };
  }

  async updateConversation(
    context: ConversationUserContext,
    conversationId: string,
    input: UpdateConversationInput
  ) {
    await this.assertConversationOwnership(context, conversationId);

    const updateData: Partial<typeof conversation.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (typeof input.title === "string") {
      updateData.title = input.title.trim();
    }
    if (typeof input.pinned === "boolean") {
      updateData.pinned = input.pinned;
    }
    if (input.status) {
      updateData.status = input.status;
    }

    const [updated] = await this.db
      .update(conversation)
      .set(updateData)
      .where(
        and(
          eq(conversation.id, conversationId),
          eq(conversation.tenantId, context.tenantId),
          eq(conversation.userId, context.userId)
        )
      )
      .returning();

    if (!updated) {
      throw new Error("Conversation not found");
    }

    return updated;
  }

  async listMessages(context: ConversationUserContext, conversationId: string) {
    await this.assertConversationOwnership(context, conversationId);

    const rows = await this.db
      .select()
      .from(message)
      .where(eq(message.conversationId, conversationId))
      .orderBy(message.createdAt);

    return rows;
  }

  async sendMessage(
    context: ConversationUserContext,
    conversationId: string,
    input: SendMessageInput
  ): Promise<GeneratedMessagePayload> {
    if (!input.content.trim()) {
      throw new Error("Message content cannot be empty");
    }

    const targetConversation = await this.assertConversationOwnership(context, conversationId);
    if (targetConversation.status === "deleted") {
      throw new Error("Conversation has been deleted");
    }

    const userContent = input.content.trim();
    const assistantText = buildAssistantText(userContent);
    const hitlPart = maybeBuildHitlPart(userContent);
    const codeBlock = extractCodeBlock(assistantText);

    const [createdUserMessage] = await this.db
      .insert(message)
      .values({
        conversationId,
        userId: context.userId,
        parentId: input.parentId,
        role: "user",
        content: userContent,
        contentParts: {
          parts: [{ type: "text", text: userContent }],
        },
        traceId: context.traceId,
        clientId: input.clientId,
      })
      .returning();

    if (!targetConversation.title || targetConversation.title === "新对话") {
      const title = userContent.slice(0, 40);
      await this.db
        .update(conversation)
        .set({
          title,
          updatedAt: new Date(),
        })
        .where(eq(conversation.id, conversationId));
    } else {
      await this.db
        .update(conversation)
        .set({ updatedAt: new Date() })
        .where(eq(conversation.id, conversationId));
    }

    if (input.attachmentIds && input.attachmentIds.length > 0) {
      await this.db
        .update(fileAttachment)
        .set({
          messageId: createdUserMessage.id,
        })
        .where(
          and(
            eq(fileAttachment.tenantId, context.tenantId),
            eq(fileAttachment.conversationId, conversationId),
            inArray(fileAttachment.id, input.attachmentIds)
          )
        );
    }

    const [assistantMessage] = await this.db
      .insert(message)
      .values({
        conversationId,
        userId: context.userId,
        parentId: createdUserMessage.id,
        role: "assistant",
        content: "",
        contentParts: {
          parts: [],
        },
        model: input.model ?? "agentiful-s2-2",
        provider: input.provider ?? "agentiful",
        traceId: context.traceId,
      })
      .returning();

    const artifactId = codeBlock
      ? await this.createDraftArtifact(context, conversationId, assistantMessage.id, codeBlock)
      : null;

    const parts: MessageContentPayload["parts"] = [{ type: "text", text: assistantText }];
    if (artifactId) {
      parts.push({ type: "artifact", artifactId, title: "Generated code draft" });
    }
    if (hitlPart) {
      parts.push(hitlPart);
    }

    return {
      assistantMessageId: assistantMessage.id,
      content: assistantText,
      contentParts: { parts },
      suggestions: generateFollowupQuestions(userContent),
      chunks: splitToChunks(assistantText),
      hitlPrompt: hitlPart,
      artifactId,
    };
  }

  async finalizeAssistantMessage(
    context: ConversationUserContext,
    conversationId: string,
    assistantMessageId: string,
    content: string,
    contentParts: MessageContentPayload,
    status: "active" | "overridden" = "active"
  ) {
    await this.assertConversationOwnership(context, conversationId);

    const [updated] = await this.db
      .update(message)
      .set({
        content,
        contentParts,
        status,
      })
      .where(
        and(
          eq(message.id, assistantMessageId),
          eq(message.conversationId, conversationId),
          eq(message.userId, context.userId)
        )
      )
      .returning();

    if (!updated) {
      throw new Error("Assistant message not found");
    }

    await this.db
      .update(conversation)
      .set({ updatedAt: new Date() })
      .where(eq(conversation.id, conversationId));
  }

  async editAndResend(
    context: ConversationUserContext,
    conversationId: string,
    messageId: string,
    input: SendMessageInput
  ): Promise<GeneratedMessagePayload> {
    await this.assertConversationOwnership(context, conversationId);

    const [targetMessage] = await this.db
      .select()
      .from(message)
      .where(
        and(
          eq(message.id, messageId),
          eq(message.conversationId, conversationId),
          eq(message.userId, context.userId)
        )
      )
      .limit(1);

    if (!targetMessage) {
      throw new Error("Message not found");
    }

    await this.db
      .update(message)
      .set({ status: "overridden" })
      .where(
        and(
          eq(message.conversationId, conversationId),
          gt(message.createdAt, targetMessage.createdAt)
        )
      );

    return this.sendMessage(context, conversationId, {
      ...input,
      parentId: messageId,
    });
  }

  async regenerate(
    context: ConversationUserContext,
    conversationId: string,
    messageId: string
  ): Promise<GeneratedMessagePayload> {
    await this.assertConversationOwnership(context, conversationId);

    const [targetMessage] = await this.db
      .select()
      .from(message)
      .where(
        and(
          eq(message.id, messageId),
          eq(message.conversationId, conversationId),
          eq(message.userId, context.userId)
        )
      )
      .limit(1);

    if (!targetMessage) {
      throw new Error("Message not found");
    }

    const contentToRegenerate = targetMessage.content ?? "";

    return this.sendMessage(context, conversationId, {
      content: contentToRegenerate,
      parentId: messageId,
    });
  }

  async upsertFeedback(
    context: ConversationUserContext,
    messageId: string,
    input: MessageFeedbackInput
  ) {
    const [target] = await this.db
      .select({
        messageId: message.id,
      })
      .from(message)
      .innerJoin(conversation, eq(message.conversationId, conversation.id))
      .where(
        and(
          eq(message.id, messageId),
          eq(conversation.tenantId, context.tenantId),
          eq(conversation.userId, context.userId)
        )
      )
      .limit(1);

    if (!target) {
      throw new Error("Message not found");
    }

    const [saved] = await this.db
      .insert(messageFeedback)
      .values({
        tenantId: context.tenantId,
        messageId: target.messageId,
        userId: context.userId,
        rating: input.rating,
        comment: input.comment?.trim() || null,
      })
      .onConflictDoUpdate({
        target: [messageFeedback.messageId, messageFeedback.userId],
        set: {
          rating: input.rating,
          comment: input.comment?.trim() || null,
          createdAt: new Date(),
        },
      })
      .returning();

    return saved;
  }

  async createShare(
    context: ConversationUserContext,
    conversationId: string,
    input: ShareConversationInput
  ) {
    const targetConversation = await this.assertConversationOwnership(context, conversationId);

    const shareCode = randomShareCode();
    const expiresAt =
      input.expiresAt === null || input.expiresAt === undefined
        ? null
        : new Date(input.expiresAt);

    const [created] = await this.db
      .insert(conversationShare)
      .values({
        tenantId: context.tenantId,
        conversationId,
        groupId: targetConversation.activeGroupId ?? undefined,
        shareCode,
        permission: "read",
        requireLogin: input.requireLogin ?? true,
        expiresAt: expiresAt ?? undefined,
        createdBy: context.userId,
      })
      .returning();

    await this.logAudit(context, "conversation.share.create", conversationId, {
      shareCode,
      requireLogin: created.requireLogin,
      expiresAt: created.expiresAt?.toISOString() ?? null,
    });

    return created;
  }

  async revokeShare(
    context: ConversationUserContext,
    shareCode: string
  ) {
    const [target] = await this.db
      .select({
        id: conversationShare.id,
        conversationId: conversationShare.conversationId,
      })
      .from(conversationShare)
      .innerJoin(conversation, eq(conversationShare.conversationId, conversation.id))
      .where(
        and(
          eq(conversationShare.shareCode, shareCode),
          eq(conversation.tenantId, context.tenantId),
          eq(conversation.userId, context.userId),
          sql`${conversationShare.revokedAt} IS NULL`
        )
      )
      .limit(1);

    if (!target) {
      throw new Error("Share not found");
    }

    const [updated] = await this.db
      .update(conversationShare)
      .set({
        revokedAt: new Date(),
      })
      .where(eq(conversationShare.id, target.id))
      .returning();

    await this.logAudit(context, "conversation.share.revoke", target.conversationId, {
      shareCode,
    });

    return updated;
  }

  async getSharedConversation(
    context: ConversationUserContext | null,
    shareCode: string
  ) {
    const now = new Date();

    const [shareRecord] = await this.db
      .select({
        id: conversationShare.id,
        conversationId: conversationShare.conversationId,
        tenantId: conversationShare.tenantId,
        groupId: conversationShare.groupId,
        requireLogin: conversationShare.requireLogin,
        expiresAt: conversationShare.expiresAt,
        revokedAt: conversationShare.revokedAt,
      })
      .from(conversationShare)
      .where(eq(conversationShare.shareCode, shareCode))
      .limit(1);

    if (!shareRecord || shareRecord.revokedAt) {
      throw new Error("Share not found");
    }

    if (shareRecord.expiresAt && shareRecord.expiresAt <= now) {
      throw new Error("Share expired");
    }

    if (shareRecord.requireLogin) {
      if (!context) {
        throw new Error("Authentication required");
      }
      if (context.tenantId !== shareRecord.tenantId) {
        throw new Error("Forbidden");
      }
      if (shareRecord.groupId && context.activeGroupId !== shareRecord.groupId) {
        throw new Error("Forbidden");
      }
    }

    const [sharedConversation] = await this.db
      .select()
      .from(conversation)
      .where(eq(conversation.id, shareRecord.conversationId))
      .limit(1);

    if (!sharedConversation) {
      throw new Error("Conversation not found");
    }

    const messages = await this.db
      .select()
      .from(message)
      .where(eq(message.conversationId, sharedConversation.id))
      .orderBy(message.createdAt);

    if (context) {
      await this.logAudit(context, "conversation.share.access", sharedConversation.id, {
        shareCode,
      });
    }

    return {
      conversation: sharedConversation,
      messages,
    };
  }

  async uploadFiles(
    context: ConversationUserContext,
    conversationId: string,
    files: UploadConversationFileInput[]
  ) {
    await this.assertConversationOwnership(context, conversationId);

    if (files.length === 0) {
      return [];
    }
    if (files.length > DEFAULT_MAX_FILES_PER_REQUEST) {
      throw new Error(`Too many files. Max ${DEFAULT_MAX_FILES_PER_REQUEST} files each request.`);
    }

    const baseDir = path.resolve(process.cwd(), "storage", "uploads", context.tenantId, conversationId);
    await mkdir(baseDir, { recursive: true });

    const stored = [];
    for (const file of files) {
      const normalizedName = sanitizeFileName(file.fileName);
      const mimeType = file.fileType.trim().toLowerCase();
      if (!ALLOWED_FILE_TYPES.has(mimeType)) {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }

      const data = Buffer.from(file.contentBase64, "base64");
      if (data.byteLength > DEFAULT_FILE_LIMIT_BYTES) {
        throw new Error(`File ${normalizedName} exceeds 50MB limit`);
      }

      const fileId = cryptoRandomId();
      const storageFileName = `${fileId}-${normalizedName}`;
      const absolutePath = path.join(baseDir, storageFileName);
      await writeFile(absolutePath, data);

      const retainUntil = new Date(Date.now() + DEFAULT_FILE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

      const [saved] = await this.db
        .insert(fileAttachment)
        .values({
          tenantId: context.tenantId,
          conversationId,
          uploadedBy: context.userId,
          fileName: normalizedName,
          fileType: mimeType,
          fileSize: data.byteLength,
          storageUrl: absolutePath,
          scanStatus: "skipped",
          retainUntil,
          metadata: {},
        })
        .returning();

      stored.push({
        ...saved,
        downloadUrl: `/api/v1/files/${saved.id}/download`,
        previewUrl: `/api/v1/files/${saved.id}/preview`,
      });
    }

    return stored;
  }

  async getFileForDownload(
    context: ConversationUserContext,
    fileId: string
  ) {
    const [fileRecord] = await this.db
      .select({
        id: fileAttachment.id,
        fileName: fileAttachment.fileName,
        fileType: fileAttachment.fileType,
        storageUrl: fileAttachment.storageUrl,
      })
      .from(fileAttachment)
      .innerJoin(conversation, eq(fileAttachment.conversationId, conversation.id))
      .where(
        and(
          eq(fileAttachment.id, fileId),
          eq(conversation.tenantId, context.tenantId),
          eq(conversation.userId, context.userId)
        )
      )
      .limit(1);

    if (!fileRecord) {
      throw new Error("File not found");
    }

    const info = await stat(fileRecord.storageUrl);
    if (!info.isFile()) {
      throw new Error("File missing");
    }

    const content = await readFile(fileRecord.storageUrl);
    return {
      fileName: fileRecord.fileName,
      fileType: fileRecord.fileType,
      content,
    };
  }

  async listArtifacts(context: ConversationUserContext, conversationId: string) {
    await this.assertConversationOwnership(context, conversationId);

    return this.db
      .select()
      .from(artifact)
      .where(
        and(
          eq(artifact.tenantId, context.tenantId),
          eq(artifact.conversationId, conversationId)
        )
      )
      .orderBy(desc(artifact.createdAt));
  }

  async saveArtifactVersion(context: ConversationUserContext, artifactId: string) {
    const [target] = await this.db
      .select()
      .from(artifact)
      .where(
        and(
          eq(artifact.id, artifactId),
          eq(artifact.tenantId, context.tenantId)
        )
      )
      .limit(1);

    if (!target) {
      throw new Error("Artifact not found");
    }

    await this.assertConversationOwnership(context, target.conversationId);

    const [versionMeta] = await this.db
      .select({
        maxVersion: sql<number>`COALESCE(MAX(${artifact.version}), 0)`,
      })
      .from(artifact)
      .where(
        and(
          eq(artifact.tenantId, context.tenantId),
          eq(artifact.conversationId, target.conversationId),
          eq(artifact.type, target.type),
          eq(artifact.isDraft, false)
        )
      );

    const nextVersion = (versionMeta?.maxVersion ?? 0) + 1;

    const [saved] = await this.db
      .insert(artifact)
      .values({
        tenantId: target.tenantId,
        conversationId: target.conversationId,
        messageId: target.messageId ?? undefined,
        type: target.type,
        title: target.title,
        content: target.content,
        format: target.format ?? undefined,
        version: nextVersion,
        isDraft: false,
        createdBy: context.userId,
      })
      .returning();

    return saved;
  }

  async downloadArtifact(context: ConversationUserContext, artifactId: string) {
    const [target] = await this.db
      .select()
      .from(artifact)
      .where(
        and(
          eq(artifact.id, artifactId),
          eq(artifact.tenantId, context.tenantId)
        )
      )
      .limit(1);

    if (!target) {
      throw new Error("Artifact not found");
    }

    await this.assertConversationOwnership(context, target.conversationId);

    return target;
  }

  async recordHitlResponse(
    context: ConversationUserContext,
    conversationId: string,
    messageId: string,
    input: HitlResponseInput
  ) {
    await this.assertConversationOwnership(context, conversationId);

    const textValue = JSON.stringify(input.value);

    const [responseMessage] = await this.db
      .insert(message)
      .values({
        conversationId,
        userId: context.userId,
        parentId: messageId,
        role: "user",
        content: `HITL response: ${textValue}`,
        contentParts: {
          parts: [{ type: "text", text: `HITL response: ${textValue}` }],
        },
        metadata: {
          hitlResponse: {
            action: input.action,
            value: input.value,
            respondedAt: nowIsoString(),
          },
        },
        traceId: context.traceId,
      })
      .returning();

    return responseMessage;
  }

  async deleteExpiredFiles(now = new Date()) {
    const expiredRows = await this.db
      .select()
      .from(fileAttachment)
      .where(sql`${fileAttachment.retainUntil} < ${now}`);

    for (const row of expiredRows) {
      try {
        await rm(row.storageUrl, { force: true });
      } catch {
        // Ignore missing file.
      }
    }

    if (expiredRows.length > 0) {
      await this.db
        .delete(fileAttachment)
        .where(
          inArray(
            fileAttachment.id,
            expiredRows.map((row) => row.id)
          )
        );
    }
  }

  private async createDraftArtifact(
    context: ConversationUserContext,
    conversationId: string,
    messageId: string,
    code: string
  ): Promise<string> {
    const [versionMeta] = await this.db
      .select({
        maxVersion: sql<number>`COALESCE(MAX(${artifact.version}), 0)`,
      })
      .from(artifact)
      .where(
        and(
          eq(artifact.tenantId, context.tenantId),
          eq(artifact.conversationId, conversationId),
          eq(artifact.type, "code")
        )
      );

    const [draft] = await this.db
      .insert(artifact)
      .values({
        tenantId: context.tenantId,
        conversationId,
        messageId,
        type: "code",
        title: "Code draft",
        content: code,
        format: "ts",
        version: (versionMeta?.maxVersion ?? 0) + 1,
        isDraft: true,
        createdBy: context.userId,
      })
      .returning();

    const drafts = await this.db
      .select({ id: artifact.id })
      .from(artifact)
      .where(
        and(
          eq(artifact.tenantId, context.tenantId),
          eq(artifact.conversationId, conversationId),
          eq(artifact.isDraft, true)
        )
      )
      .orderBy(desc(artifact.createdAt));

    if (drafts.length > 10) {
      const toDelete = drafts.slice(10).map((item) => item.id);
      await this.db.delete(artifact).where(inArray(artifact.id, toDelete));
    }

    return draft.id;
  }

  private async assertConversationOwnership(
    context: ConversationUserContext,
    conversationId: string
  ) {
    const [found] = await this.db
      .select()
      .from(conversation)
      .where(
        and(
          eq(conversation.id, conversationId),
          eq(conversation.tenantId, context.tenantId),
          eq(conversation.userId, context.userId)
        )
      )
      .limit(1);

    if (!found) {
      throw new Error("Conversation not found");
    }

    return found;
  }

  private async logAudit(
    context: ConversationUserContext,
    action: string,
    resourceId: string,
    metadata: Record<string, unknown>
  ) {
    try {
      await auditService.logSuccess({
        tenantId: context.tenantId,
        actorUserId: context.userId,
        actorType: "user",
        action,
        resourceType: "conversation",
        resourceId,
        traceId: context.traceId,
        metadata,
      });
    } catch {
      // Keep conversation flow non-blocking on audit sink failures.
    }
  }
}

function cryptoRandomId(): string {
  return randomBytes(12).toString("hex");
}

export function createConversationService(db?: Database): ConversationService {
  return new ConversationService(db);
}

export const __conversationServiceTestUtils = {
  splitToChunks,
  buildAssistantText,
  maybeBuildHitlPart,
};

