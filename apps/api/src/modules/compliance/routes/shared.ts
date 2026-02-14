import { getDatabase } from "@agentifui/db/client";
import type { FastifyReply, FastifyRequest } from "fastify";

export type AdminRole = "tenant_admin" | "root_admin";

export function getRequestDb(request: FastifyRequest): unknown {
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

export function resolveTenantId(request: FastifyRequest): string | null {
  const value = request.headers["x-tenant-id"];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function resolveActorUserId(request: FastifyRequest): string | null {
  const fromContext = (request as { user?: { id?: string } }).user?.id;
  if (typeof fromContext === "string" && fromContext.trim()) {
    return fromContext.trim();
  }
  const value = request.headers["x-user-id"];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function resolveActorRole(request: FastifyRequest): AdminRole {
  const fromHeader = request.headers["x-actor-role"] ?? request.headers["x-role"];
  if (fromHeader === "root_admin") {
    return "root_admin";
  }
  return "tenant_admin";
}

export function requireAdminRole(reply: FastifyReply, role: AdminRole, breakglassReason?: string): boolean {
  if (role === "tenant_admin") {
    return true;
  }

  if (role === "root_admin" && breakglassReason?.trim()) {
    return true;
  }

  reply.status(403).send({
    error: {
      type: "forbidden",
      code: "breakglass_reason_required",
      message: "ROOT ADMIN must provide break-glass reason for audit access",
    },
  });
  return false;
}

export function badRequest(reply: FastifyReply, traceId: string, message: string) {
  return reply.status(400).send({
    error: {
      type: "invalid_request_error",
      code: "invalid_request",
      message,
      trace_id: traceId,
    },
  });
}
