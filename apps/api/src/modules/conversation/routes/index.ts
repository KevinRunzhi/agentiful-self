/**
 * S2-2 Conversation Routes
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { setTimeout as delay } from "node:timers/promises";
import {
  ConversationService,
  createConversationService,
  type ConversationUserContext,
  type SendMessageInput,
} from "../services/conversation.service.js";

interface RequestUser {
  id?: string;
  tenantId?: string;
}

interface StreamBody extends SendMessageInput {
  stream?: boolean;
  supportsAbort?: boolean;
}

function getContext(
  request: FastifyRequest
): ConversationUserContext | null {
  const requestUser = (request as unknown as { user?: RequestUser }).user;
  const userId =
    requestUser?.id ??
    (typeof request.headers["x-user-id"] === "string"
      ? request.headers["x-user-id"]
      : undefined);
  const tenantId =
    (typeof request.headers["x-tenant-id"] === "string"
      ? request.headers["x-tenant-id"]
      : undefined) ?? requestUser?.tenantId;

  if (!userId || !tenantId) {
    return null;
  }

  return {
    userId,
    tenantId,
    activeGroupId:
      typeof request.headers["x-active-group-id"] === "string"
        ? request.headers["x-active-group-id"]
        : null,
    traceId: request.id,
  };
}

function getService(request: FastifyRequest): ConversationService {
  const db = (request as { db?: unknown }).db;
  return createConversationService(db as never);
}

function sendUnauthorized(reply: FastifyReply) {
  return reply.status(401).send({
    error: {
      code: "UNAUTHORIZED",
      message: "Authentication required",
    },
  });
}

function sendBadRequest(reply: FastifyReply, message: string) {
  return reply.status(400).send({
    error: {
      code: "BAD_REQUEST",
      message,
    },
  });
}

function mapErrorToStatus(error: unknown): number {
  if (!(error instanceof Error)) {
    return 500;
  }
  if (
    error.message.includes("not found") ||
    error.message.includes("Not found")
  ) {
    return 404;
  }
  if (error.message.includes("Authentication required")) {
    return 401;
  }
  if (error.message.includes("Forbidden")) {
    return 403;
  }
  if (
    error.message.includes("Unsupported file type") ||
    error.message.includes("Too many files") ||
    error.message.includes("cannot be empty") ||
    error.message.includes("exceeds")
  ) {
    return 400;
  }
  return 500;
}

async function streamAssistantResponse(
  request: FastifyRequest<{
    Params: { conversationId: string };
    Body: StreamBody;
  }>,
  reply: FastifyReply
) {
  const context = getContext(request);
  if (!context) {
    return sendUnauthorized(reply);
  }

  const service = getService(request);
  const supportsAbort =
    request.body.supportsAbort ??
    process.env.S2_ABORT_SUPPORTED !== "false";

  try {
    const generated = await service.sendMessage(
      context,
      request.params.conversationId,
      request.body
    );

    service.registerStreamRun(generated.assistantMessageId, supportsAbort);

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Trace-ID": context.traceId,
    });

    const writeEvent = (event: string, data: Record<string, unknown>) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    writeEvent("agentif.metadata", {
      conversationId: request.params.conversationId,
      messageId: generated.assistantMessageId,
      traceId: context.traceId,
      createdAt: Date.now(),
    });

    let rendered = "";
    let hardStopped = false;
    let softStopped = false;

    for (const chunk of generated.chunks) {
      if (service.isHardStopped(generated.assistantMessageId)) {
        hardStopped = true;
        break;
      }
      if (service.isSoftStopped(generated.assistantMessageId)) {
        softStopped = true;
        break;
      }

      rendered += chunk;
      writeEvent("message.delta", {
        messageId: generated.assistantMessageId,
        chunk,
      });
      await delay(40);
    }

    const finalContent = hardStopped ? rendered : generated.content;
    const finalParts = hardStopped
      ? ({ parts: [{ type: "text", text: rendered }] } as const)
      : generated.contentParts;

    await service.finalizeAssistantMessage(
      context,
      request.params.conversationId,
      generated.assistantMessageId,
      finalContent,
      finalParts
    );

    if (!hardStopped) {
      writeEvent("agentif.suggestions", {
        suggestions: generated.suggestions,
      });
    }

    writeEvent("message.done", {
      messageId: generated.assistantMessageId,
      stopType: hardStopped ? "hard" : softStopped ? "soft" : "completed",
      content: finalContent,
    });

    reply.raw.write("data: [DONE]\n\n");
    reply.raw.end();
    service.completeStreamRun(generated.assistantMessageId);
  } catch (error) {
    const statusCode = mapErrorToStatus(error);
    if (!reply.sent) {
      return reply.status(statusCode).send({
        error: {
          code: statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to stream message",
        },
      });
    }
  }
}

export async function registerConversationRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.post<{
    Body: { appId: string; title?: string; clientId?: string; inputs?: Record<string, unknown> };
  }>("/conversations", async (request, reply) => {
    const context = getContext(request);
    if (!context) {
      return sendUnauthorized(reply);
    }

    if (!request.body?.appId) {
      return sendBadRequest(reply, "appId is required");
    }

    try {
      const service = getService(request);
      const created = await service.createConversation(context, request.body);
      return reply.status(201).send({ data: created });
    } catch (error) {
      const statusCode = mapErrorToStatus(error);
      return reply.status(statusCode).send({
        error: {
          code: "CONVERSATION_CREATE_FAILED",
          message: error instanceof Error ? error.message : "Create failed",
        },
      });
    }
  });

  fastify.get<{
    Querystring: {
      q?: string;
      status?: "active" | "archived";
      cursor?: string;
      limit?: number;
    };
  }>("/conversations", async (request, reply) => {
    const context = getContext(request);
    if (!context) {
      return sendUnauthorized(reply);
    }

    try {
      const service = getService(request);
      const data = await service.listConversations(context, request.query);
      return reply.send({ data });
    } catch (error) {
      const statusCode = mapErrorToStatus(error);
      return reply.status(statusCode).send({
        error: {
          code: "CONVERSATION_LIST_FAILED",
          message: error instanceof Error ? error.message : "List failed",
        },
      });
    }
  });

  fastify.patch<{
    Params: { conversationId: string };
    Body: { title?: string; pinned?: boolean; status?: "active" | "archived" | "deleted" };
  }>("/conversations/:conversationId", async (request, reply) => {
    const context = getContext(request);
    if (!context) {
      return sendUnauthorized(reply);
    }

    try {
      const service = getService(request);
      const updated = await service.updateConversation(
        context,
        request.params.conversationId,
        request.body ?? {}
      );
      return reply.send({ data: updated });
    } catch (error) {
      const statusCode = mapErrorToStatus(error);
      return reply.status(statusCode).send({
        error: {
          code: "CONVERSATION_UPDATE_FAILED",
          message: error instanceof Error ? error.message : "Update failed",
        },
      });
    }
  });

  fastify.delete<{
    Params: { conversationId: string };
  }>("/conversations/:conversationId", async (request, reply) => {
    const context = getContext(request);
    if (!context) {
      return sendUnauthorized(reply);
    }

    try {
      const service = getService(request);
      await service.updateConversation(context, request.params.conversationId, {
        status: "deleted",
      });
      return reply.status(204).send();
    } catch (error) {
      const statusCode = mapErrorToStatus(error);
      return reply.status(statusCode).send({
        error: {
          code: "CONVERSATION_DELETE_FAILED",
          message: error instanceof Error ? error.message : "Delete failed",
        },
      });
    }
  });

  fastify.get<{
    Params: { conversationId: string };
  }>("/conversations/:conversationId/messages", async (request, reply) => {
    const context = getContext(request);
    if (!context) {
      return sendUnauthorized(reply);
    }

    try {
      const service = getService(request);
      const data = await service.listMessages(context, request.params.conversationId);
      return reply.send({ data });
    } catch (error) {
      const statusCode = mapErrorToStatus(error);
      return reply.status(statusCode).send({
        error: {
          code: "MESSAGE_LIST_FAILED",
          message: error instanceof Error ? error.message : "Message list failed",
        },
      });
    }
  });

  fastify.post<{
    Params: { conversationId: string };
    Body: StreamBody;
  }>("/conversations/:conversationId/messages", async (request, reply) => {
    const stream = request.body?.stream === true;
    if (stream) {
      return streamAssistantResponse(request, reply);
    }

    const context = getContext(request);
    if (!context) {
      return sendUnauthorized(reply);
    }

    try {
      const service = getService(request);
      const generated = await service.sendMessage(
        context,
        request.params.conversationId,
        request.body
      );
      await service.finalizeAssistantMessage(
        context,
        request.params.conversationId,
        generated.assistantMessageId,
        generated.content,
        generated.contentParts
      );

      return reply.status(201).send({
        data: {
          messageId: generated.assistantMessageId,
          content: generated.content,
          suggestions: generated.suggestions,
          artifactId: generated.artifactId,
          hitlPrompt: generated.hitlPrompt,
        },
      });
    } catch (error) {
      const statusCode = mapErrorToStatus(error);
      return reply.status(statusCode).send({
        error: {
          code: "MESSAGE_CREATE_FAILED",
          message: error instanceof Error ? error.message : "Message create failed",
        },
      });
    }
  });

  fastify.post<{
    Params: { conversationId: string; messageId: string };
    Body: { content: string; clientId?: string };
  }>("/conversations/:conversationId/messages/:messageId/edit-resend", async (request, reply) => {
    const context = getContext(request);
    if (!context) {
      return sendUnauthorized(reply);
    }

    try {
      const service = getService(request);
      const generated = await service.editAndResend(
        context,
        request.params.conversationId,
        request.params.messageId,
        request.body
      );
      await service.finalizeAssistantMessage(
        context,
        request.params.conversationId,
        generated.assistantMessageId,
        generated.content,
        generated.contentParts
      );
      return reply.status(201).send({ data: generated });
    } catch (error) {
      const statusCode = mapErrorToStatus(error);
      return reply.status(statusCode).send({
        error: {
          code: "MESSAGE_EDIT_RESEND_FAILED",
          message: error instanceof Error ? error.message : "Edit resend failed",
        },
      });
    }
  });

  fastify.post<{
    Params: { conversationId: string; messageId: string };
  }>("/conversations/:conversationId/messages/:messageId/regenerate", async (request, reply) => {
    const context = getContext(request);
    if (!context) {
      return sendUnauthorized(reply);
    }

    try {
      const service = getService(request);
      const generated = await service.regenerate(
        context,
        request.params.conversationId,
        request.params.messageId
      );
      await service.finalizeAssistantMessage(
        context,
        request.params.conversationId,
        generated.assistantMessageId,
        generated.content,
        generated.contentParts
      );
      return reply.status(201).send({ data: generated });
    } catch (error) {
      const statusCode = mapErrorToStatus(error);
      return reply.status(statusCode).send({
        error: {
          code: "MESSAGE_REGENERATE_FAILED",
          message: error instanceof Error ? error.message : "Regenerate failed",
        },
      });
    }
  });

  fastify.post<{
    Params: { conversationId: string; messageId: string };
  }>("/conversations/:conversationId/messages/:messageId/stop", async (request, reply) => {
    const context = getContext(request);
    if (!context) {
      return sendUnauthorized(reply);
    }

    try {
      const service = getService(request);
      const result = service.requestStop(request.params.messageId);
      if (result.stopType === "none") {
        return reply.status(404).send({
          error: {
            code: "RUN_NOT_FOUND",
            message: "No active streaming run found for this message",
          },
        });
      }
      return reply.send({
        result: "success",
        stop_type: result.stopType,
      });
    } catch (error) {
      const statusCode = mapErrorToStatus(error);
      return reply.status(statusCode).send({
        error: {
          code: "STOP_FAILED",
          message: error instanceof Error ? error.message : "Stop failed",
        },
      });
    }
  });

  fastify.post<{
    Params: { messageId: string };
    Body: { rating: "like" | "dislike"; comment?: string };
  }>("/messages/:messageId/feedback", async (request, reply) => {
    const context = getContext(request);
    if (!context) {
      return sendUnauthorized(reply);
    }

    try {
      const service = getService(request);
      const data = await service.upsertFeedback(
        context,
        request.params.messageId,
        request.body
      );
      return reply.send({ data });
    } catch (error) {
      const statusCode = mapErrorToStatus(error);
      return reply.status(statusCode).send({
        error: {
          code: "FEEDBACK_FAILED",
          message: error instanceof Error ? error.message : "Feedback failed",
        },
      });
    }
  });

  fastify.post<{
    Params: { conversationId: string };
    Body: { requireLogin?: boolean; expiresAt?: string | null };
  }>("/conversations/:conversationId/share", async (request, reply) => {
    const context = getContext(request);
    if (!context) {
      return sendUnauthorized(reply);
    }
    try {
      const service = getService(request);
      const data = await service.createShare(
        context,
        request.params.conversationId,
        request.body ?? {}
      );
      return reply.status(201).send({
        data: {
          ...data,
          shareUrl: `/api/v1/share/${data.shareCode}`,
        },
      });
    } catch (error) {
      const statusCode = mapErrorToStatus(error);
      return reply.status(statusCode).send({
        error: {
          code: "SHARE_CREATE_FAILED",
          message: error instanceof Error ? error.message : "Create share failed",
        },
      });
    }
  });

  fastify.delete<{
    Params: { shareCode: string };
  }>("/shares/:shareCode", async (request, reply) => {
    const context = getContext(request);
    if (!context) {
      return sendUnauthorized(reply);
    }
    try {
      const service = getService(request);
      await service.revokeShare(context, request.params.shareCode);
      return reply.status(204).send();
    } catch (error) {
      const statusCode = mapErrorToStatus(error);
      return reply.status(statusCode).send({
        error: {
          code: "SHARE_REVOKE_FAILED",
          message: error instanceof Error ? error.message : "Revoke share failed",
        },
      });
    }
  });

  fastify.get<{
    Params: { shareCode: string };
  }>("/share/:shareCode", async (request, reply) => {
    const context = getContext(request);
    try {
      const service = getService(request);
      const data = await service.getSharedConversation(context, request.params.shareCode);
      return reply.send({ data });
    } catch (error) {
      const statusCode = mapErrorToStatus(error);
      return reply.status(statusCode).send({
        error: {
          code: "SHARE_ACCESS_FAILED",
          message: error instanceof Error ? error.message : "Share access failed",
        },
      });
    }
  });

  fastify.post<{
    Params: { conversationId: string };
    Body: { files: Array<{ fileName: string; fileType: string; contentBase64: string }> };
  }>("/conversations/:conversationId/files", async (request, reply) => {
    const context = getContext(request);
    if (!context) {
      return sendUnauthorized(reply);
    }
    try {
      const service = getService(request);
      const data = await service.uploadFiles(
        context,
        request.params.conversationId,
        request.body?.files ?? []
      );
      return reply.status(201).send({ data });
    } catch (error) {
      const statusCode = mapErrorToStatus(error);
      return reply.status(statusCode).send({
        error: {
          code: "FILE_UPLOAD_FAILED",
          message: error instanceof Error ? error.message : "File upload failed",
        },
      });
    }
  });

  fastify.get<{
    Params: { fileId: string };
  }>("/files/:fileId/download", async (request, reply) => {
    const context = getContext(request);
    if (!context) {
      return sendUnauthorized(reply);
    }
    try {
      const service = getService(request);
      const file = await service.getFileForDownload(context, request.params.fileId);
      reply
        .header("Content-Type", file.fileType)
        .header(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(file.fileName)}"`
        );
      return reply.send(file.content);
    } catch (error) {
      const statusCode = mapErrorToStatus(error);
      return reply.status(statusCode).send({
        error: {
          code: "FILE_DOWNLOAD_FAILED",
          message: error instanceof Error ? error.message : "File download failed",
        },
      });
    }
  });

  fastify.get<{
    Params: { fileId: string };
  }>("/files/:fileId/preview", async (request, reply) => {
    const context = getContext(request);
    if (!context) {
      return sendUnauthorized(reply);
    }
    try {
      const service = getService(request);
      const file = await service.getFileForDownload(context, request.params.fileId);
      reply.header("Content-Type", file.fileType);
      return reply.send(file.content);
    } catch (error) {
      const statusCode = mapErrorToStatus(error);
      return reply.status(statusCode).send({
        error: {
          code: "FILE_PREVIEW_FAILED",
          message: error instanceof Error ? error.message : "File preview failed",
        },
      });
    }
  });

  fastify.get<{
    Params: { conversationId: string };
  }>("/conversations/:conversationId/artifacts", async (request, reply) => {
    const context = getContext(request);
    if (!context) {
      return sendUnauthorized(reply);
    }
    try {
      const service = getService(request);
      const data = await service.listArtifacts(context, request.params.conversationId);
      return reply.send({ data });
    } catch (error) {
      const statusCode = mapErrorToStatus(error);
      return reply.status(statusCode).send({
        error: {
          code: "ARTIFACT_LIST_FAILED",
          message: error instanceof Error ? error.message : "Artifact list failed",
        },
      });
    }
  });

  fastify.post<{
    Params: { artifactId: string };
  }>("/artifacts/:artifactId/save", async (request, reply) => {
    const context = getContext(request);
    if (!context) {
      return sendUnauthorized(reply);
    }
    try {
      const service = getService(request);
      const data = await service.saveArtifactVersion(context, request.params.artifactId);
      return reply.status(201).send({ data });
    } catch (error) {
      const statusCode = mapErrorToStatus(error);
      return reply.status(statusCode).send({
        error: {
          code: "ARTIFACT_SAVE_FAILED",
          message: error instanceof Error ? error.message : "Artifact save failed",
        },
      });
    }
  });

  fastify.get<{
    Params: { artifactId: string };
  }>("/artifacts/:artifactId/download", async (request, reply) => {
    const context = getContext(request);
    if (!context) {
      return sendUnauthorized(reply);
    }
    try {
      const service = getService(request);
      const data = await service.downloadArtifact(context, request.params.artifactId);
      const extension = data.type === "code" ? "ts" : data.type === "document" ? "md" : "txt";
      reply
        .header("Content-Type", "text/plain; charset=utf-8")
        .header(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(data.title)}.${extension}"`
        );
      return reply.send(data.content);
    } catch (error) {
      const statusCode = mapErrorToStatus(error);
      return reply.status(statusCode).send({
        error: {
          code: "ARTIFACT_DOWNLOAD_FAILED",
          message: error instanceof Error ? error.message : "Artifact download failed",
        },
      });
    }
  });

  fastify.post<{
    Params: { conversationId: string; messageId: string };
    Body: { action: "confirm" | "select" | "approve" | "input"; value: string | string[] | boolean };
  }>("/conversations/:conversationId/messages/:messageId/hitl-response", async (request, reply) => {
    const context = getContext(request);
    if (!context) {
      return sendUnauthorized(reply);
    }
    try {
      const service = getService(request);
      const data = await service.recordHitlResponse(
        context,
        request.params.conversationId,
        request.params.messageId,
        request.body
      );
      return reply.status(201).send({ data });
    } catch (error) {
      const statusCode = mapErrorToStatus(error);
      return reply.status(statusCode).send({
        error: {
          code: "HITL_RESPONSE_FAILED",
          message: error instanceof Error ? error.message : "HITL response failed",
        },
      });
    }
  });
}

