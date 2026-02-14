/**
 * Apps Routes
 *
 * S1-3 workbench routes for accessible apps, context options, favorites, and recent usage.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  AppNotAccessibleError,
  AppNotFoundError,
  DuplicateFavoriteError,
  FavoriteLimitExceededError,
  createAppService,
} from "../services/app.service";

interface AuthUser {
  id: string;
  tenantId?: string;
}

interface AccessibleAppsQuerystring {
  view?: "all" | "recent" | "favorites";
  q?: string;
  category?: string;
  limit?: number;
  cursor?: string;
}

function getCurrentUser(request: FastifyRequest): AuthUser | undefined {
  return (request as unknown as { user?: AuthUser }).user;
}

function getTenantId(request: FastifyRequest, currentUser?: AuthUser): string | undefined {
  return (request.headers["x-tenant-id"] as string | undefined) ?? currentUser?.tenantId;
}

function getDb(request: FastifyRequest): unknown {
  return (request as { db?: unknown }).db;
}

async function getAccessibleApps(
  request: FastifyRequest<{ Querystring: AccessibleAppsQuerystring }>,
  reply: FastifyReply
): Promise<void> {
  const currentUser = getCurrentUser(request);
  if (!currentUser) {
    return reply.status(401).send({
      errors: [{ code: "UNAUTHORIZED", message: "Authentication required" }],
    });
  }

  const tenantId = getTenantId(request, currentUser);
  if (!tenantId) {
    return reply.status(400).send({
      errors: [{ code: "BAD_REQUEST", message: "Tenant ID required" }],
    });
  }

  const db = getDb(request);
  if (!db) {
    return reply.status(503).send({
      errors: [{ code: "SERVICE_UNAVAILABLE", message: "Database context unavailable" }],
    });
  }

  const activeGroupId = request.headers["x-active-group-id"] as string | null;

  const appService = createAppService(db as any);
  const queryInput: {
    view?: "all" | "recent" | "favorites";
    q?: string;
    category?: string;
    limit?: number;
    cursor?: string;
  } = {};

  if (request.query.view) {
    queryInput.view = request.query.view;
  }
  if (request.query.q) {
    queryInput.q = request.query.q;
  }
  if (request.query.category) {
    queryInput.category = request.query.category;
  }
  if (typeof request.query.limit === "number") {
    queryInput.limit = request.query.limit;
  }
  if (request.query.cursor) {
    queryInput.cursor = request.query.cursor;
  }

  const result = await appService.getAccessibleApps(currentUser.id, tenantId, activeGroupId, {
    ...queryInput,
  });

  reply.status(200).send({
    data: result,
    meta: {
      traceId: request.id,
      timestamp: new Date().toISOString(),
    },
  });
}

async function getAppContextOptions(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const currentUser = getCurrentUser(request);
  if (!currentUser) {
    return reply.status(401).send({
      errors: [{ code: "UNAUTHORIZED", message: "Authentication required" }],
    });
  }

  const tenantId = getTenantId(request, currentUser);
  if (!tenantId) {
    return reply.status(400).send({
      errors: [{ code: "BAD_REQUEST", message: "Tenant ID required" }],
    });
  }

  const db = getDb(request);
  if (!db) {
    return reply.status(503).send({
      errors: [{ code: "SERVICE_UNAVAILABLE", message: "Database context unavailable" }],
    });
  }

  const appService = createAppService(db as any);
  const options = await appService.getAppContextOptions(currentUser.id, tenantId, request.params.id);

  reply.status(200).send({
    data: options,
    meta: {
      traceId: request.id,
      timestamp: new Date().toISOString(),
    },
  });
}

async function addFavorite(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const currentUser = getCurrentUser(request);
  if (!currentUser) {
    return reply.status(401).send({
      errors: [{ code: "UNAUTHORIZED", message: "Authentication required" }],
    });
  }

  const tenantId = getTenantId(request, currentUser);
  if (!tenantId) {
    return reply.status(400).send({
      errors: [{ code: "BAD_REQUEST", message: "Tenant ID required" }],
    });
  }

  const db = getDb(request);
  if (!db) {
    return reply.status(503).send({
      errors: [{ code: "SERVICE_UNAVAILABLE", message: "Database context unavailable" }],
    });
  }

  const appService = createAppService(db as any);
  try {
    await appService.addFavorite(currentUser.id, tenantId, request.params.id);
    reply.status(204).send();
  } catch (error) {
    if (error instanceof DuplicateFavoriteError) {
      return reply.status(409).send({
        errors: [{ code: "CONFLICT", message: error.message }],
      });
    }
    if (error instanceof FavoriteLimitExceededError) {
      return reply.status(409).send({
        errors: [{ code: "CONFLICT", message: error.message }],
      });
    }
    if (error instanceof AppNotAccessibleError) {
      return reply.status(403).send({
        errors: [{ code: "FORBIDDEN", message: error.message }],
      });
    }
    if (error instanceof AppNotFoundError) {
      return reply.status(404).send({
        errors: [{ code: "NOT_FOUND", message: error.message }],
      });
    }
    throw error;
  }
}

async function removeFavorite(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const currentUser = getCurrentUser(request);
  if (!currentUser) {
    return reply.status(401).send({
      errors: [{ code: "UNAUTHORIZED", message: "Authentication required" }],
    });
  }

  const tenantId = getTenantId(request, currentUser);
  if (!tenantId) {
    return reply.status(400).send({
      errors: [{ code: "BAD_REQUEST", message: "Tenant ID required" }],
    });
  }

  const db = getDb(request);
  if (!db) {
    return reply.status(503).send({
      errors: [{ code: "SERVICE_UNAVAILABLE", message: "Database context unavailable" }],
    });
  }

  const appService = createAppService(db as any);
  await appService.removeFavorite(currentUser.id, tenantId, request.params.id);

  reply.status(204).send();
}

async function markRecentUse(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const currentUser = getCurrentUser(request);
  if (!currentUser) {
    return reply.status(401).send({
      errors: [{ code: "UNAUTHORIZED", message: "Authentication required" }],
    });
  }

  const tenantId = getTenantId(request, currentUser);
  if (!tenantId) {
    return reply.status(400).send({
      errors: [{ code: "BAD_REQUEST", message: "Tenant ID required" }],
    });
  }

  const db = getDb(request);
  if (!db) {
    return reply.status(503).send({
      errors: [{ code: "SERVICE_UNAVAILABLE", message: "Database context unavailable" }],
    });
  }

  const appService = createAppService(db as any);
  try {
    await appService.markRecentUse(currentUser.id, tenantId, request.params.id);
    reply.status(204).send();
  } catch (error) {
    if (error instanceof AppNotAccessibleError) {
      return reply.status(403).send({
        errors: [{ code: "FORBIDDEN", message: error.message }],
      });
    }
    if (error instanceof AppNotFoundError) {
      return reply.status(404).send({
        errors: [{ code: "NOT_FOUND", message: error.message }],
      });
    }
    throw error;
  }
}

export async function appsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{
    Querystring: AccessibleAppsQuerystring;
  }>("/apps/accessible", {
    schema: {
      description: "Get accessible apps with workbench filters",
      tags: ["Apps", "Workbench"],
      querystring: {
        type: "object",
        properties: {
          view: { type: "string", enum: ["all", "recent", "favorites"] },
          q: { type: "string", maxLength: 100 },
          category: { type: "string" },
          limit: { type: "number", minimum: 1, maximum: 100 },
          cursor: { type: "string" },
        },
      },
      headers: {
        type: "object",
        properties: {
          "x-active-group-id": { type: "string" },
        },
      },
    },
  }, getAccessibleApps);

  fastify.get<{
    Params: { id: string };
  }>("/apps/:id/context-options", {
    schema: {
      description: "Get context options for a specific app",
      tags: ["Apps", "Context Switching"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" },
        },
      },
    },
  }, getAppContextOptions);

  fastify.post<{
    Params: { id: string };
  }>("/apps/:id/favorite", {
    schema: {
      description: "Mark app as favorite",
      tags: ["Apps", "Workbench"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" },
        },
      },
    },
  }, addFavorite);

  fastify.delete<{
    Params: { id: string };
  }>("/apps/:id/favorite", {
    schema: {
      description: "Remove app from favorites",
      tags: ["Apps", "Workbench"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" },
        },
      },
    },
  }, removeFavorite);

  fastify.post<{
    Params: { id: string };
  }>("/apps/:id/recent-use", {
    schema: {
      description: "Record app recent usage for current user",
      tags: ["Apps", "Workbench"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" },
        },
      },
    },
  }, markRecentUse);
}
