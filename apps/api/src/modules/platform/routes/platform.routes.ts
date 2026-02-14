import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ApiKeyService } from "../services/api-key.service.js";
import type { SystemAnnouncementService } from "../services/system-announcement.service.js";
import type { TenantLifecycleService } from "../services/tenant-lifecycle.service.js";
import type { TenantSettingsService } from "../services/tenant-settings.service.js";

type Role = "root_admin" | "tenant_admin" | "manager" | "user";

function getRole(request: FastifyRequest): Role | null {
  const fromHeader = request.headers["x-user-role"];
  if (typeof fromHeader === "string" && fromHeader.trim()) {
    return fromHeader.trim().toLowerCase() as Role;
  }

  const fromContext = (request as any).user?.role;
  if (typeof fromContext === "string" && fromContext.trim()) {
    return fromContext.trim().toLowerCase() as Role;
  }

  return null;
}

function getActorId(request: FastifyRequest): string | undefined {
  const fromHeader = request.headers["x-user-id"];
  if (typeof fromHeader === "string" && fromHeader.trim()) {
    return fromHeader.trim();
  }

  const fromContext = (request as any).user?.id;
  if (typeof fromContext === "string" && fromContext.trim()) {
    return fromContext.trim();
  }

  return undefined;
}

function requireRole(
  request: FastifyRequest,
  reply: FastifyReply,
  allowed: Role[]
): boolean {
  const role = getRole(request);
  if (!role || !allowed.includes(role)) {
    reply.status(403).send({
      error: {
        code: "FORBIDDEN",
        message: "Insufficient role",
      },
    });
    return false;
  }
  return true;
}

function requireTenantId(request: FastifyRequest, reply: FastifyReply): string | null {
  const raw = request.headers["x-tenant-id"];
  const tenantId = typeof raw === "string" ? raw.trim() : "";
  if (!tenantId) {
    reply.status(400).send({
      error: {
        code: "TENANT_CONTEXT_REQUIRED",
        message: "x-tenant-id header is required",
      },
    });
    return null;
  }
  return tenantId;
}

export interface PlatformRoutesOptions {
  tenantLifecycleService: TenantLifecycleService;
  tenantSettingsService: TenantSettingsService;
  apiKeyService: ApiKeyService;
  announcementService: SystemAnnouncementService;
}

export async function registerPlatformRoutes(
  fastify: FastifyInstance,
  options: PlatformRoutesOptions
): Promise<void> {
  fastify.post<{
    Body: {
      name: string;
      slug: string;
      adminEmail: string;
      plan?: "free" | "pro" | "enterprise";
    };
  }>("/platform-admin/tenants", async (request, reply) => {
    if (!requireRole(request, reply, ["root_admin"])) {
      return;
    }

    const created = await options.tenantLifecycleService.createTenant({
      name: request.body.name,
      slug: request.body.slug,
      adminEmail: request.body.adminEmail,
      plan: request.body.plan,
    });
    reply.status(201).send({ data: created });
  });

  fastify.post<{ Params: { tenantId: string } }>(
    "/platform-admin/tenants/:tenantId/disable",
    async (request, reply) => {
      if (!requireRole(request, reply, ["root_admin"])) {
        return;
      }

      await options.tenantLifecycleService.disableTenant(request.params.tenantId);
      reply.status(204).send();
    }
  );

  fastify.post<{ Params: { tenantId: string } }>(
    "/platform-admin/tenants/:tenantId/enable",
    async (request, reply) => {
      if (!requireRole(request, reply, ["root_admin"])) {
        return;
      }

      await options.tenantLifecycleService.enableTenant(request.params.tenantId);
      reply.status(204).send();
    }
  );

  fastify.delete<{ Params: { tenantId: string } }>(
    "/platform-admin/tenants/:tenantId",
    async (request, reply) => {
      if (!requireRole(request, reply, ["root_admin"])) {
        return;
      }

      const result = await options.tenantLifecycleService.deleteTenant(request.params.tenantId);
      reply.status(200).send({ data: result });
    }
  );

  fastify.get("/tenant-admin/settings", async (request, reply) => {
    if (!requireRole(request, reply, ["tenant_admin", "root_admin"])) {
      return;
    }

    const tenantId = requireTenantId(request, reply);
    if (!tenantId) {
      return;
    }

    const settings = await options.tenantSettingsService.getEffectiveSettings(tenantId);
    reply.send({ data: settings });
  });

  fastify.patch<{ Body: Record<string, unknown> }>("/tenant-admin/settings", async (request, reply) => {
    if (!requireRole(request, reply, ["tenant_admin", "root_admin"])) {
      return;
    }

    const tenantId = requireTenantId(request, reply);
    if (!tenantId) {
      return;
    }

    const updated = await options.tenantSettingsService.updateSettings({
      tenantId,
      patch: request.body as any,
      actorUserId: getActorId(request),
    });
    reply.send({ data: updated });
  });

  fastify.get("/tenant-admin/api-keys", async (request, reply) => {
    if (!requireRole(request, reply, ["tenant_admin", "root_admin"])) {
      return;
    }

    const tenantId = requireTenantId(request, reply);
    if (!tenantId) {
      return;
    }

    const data = await options.apiKeyService.listKeys(tenantId);
    reply.send({ data });
  });

  fastify.post<{
    Body: {
      keyName: string;
      expiresAt?: string;
    };
  }>("/tenant-admin/api-keys", async (request, reply) => {
    if (!requireRole(request, reply, ["tenant_admin", "root_admin"])) {
      return;
    }

    const tenantId = requireTenantId(request, reply);
    if (!tenantId) {
      return;
    }

    const created = await options.apiKeyService.createKey({
      tenantId,
      keyName: request.body.keyName,
      createdBy: getActorId(request),
      expiresAt: request.body.expiresAt ? new Date(request.body.expiresAt) : null,
    });
    reply.status(201).send({ data: created });
  });

  fastify.delete<{ Params: { keyId: string } }>(
    "/tenant-admin/api-keys/:keyId",
    async (request, reply) => {
      if (!requireRole(request, reply, ["tenant_admin", "root_admin"])) {
        return;
      }

      const tenantId = requireTenantId(request, reply);
      if (!tenantId) {
        return;
      }

      const revoked = await options.apiKeyService.revokeKey(tenantId, request.params.keyId);
      if (!revoked) {
        reply.status(404).send({
          error: {
            code: "API_KEY_NOT_FOUND",
            message: "API key not found",
          },
        });
        return;
      }

      reply.status(204).send();
    }
  );

  fastify.get("/tenant-admin/announcements", async (request, reply) => {
    if (!requireRole(request, reply, ["tenant_admin", "root_admin", "manager", "user"])) {
      return;
    }

    const tenantId = requireTenantId(request, reply);
    if (!tenantId) {
      return;
    }

    const actorId = getActorId(request);
    if (!actorId) {
      reply.status(401).send({
        error: {
          code: "UNAUTHENTICATED",
          message: "x-user-id header is required",
        },
      });
      return;
    }

    const data = await options.announcementService.listVisibleAnnouncements({
      tenantId,
      userId: actorId,
    });
    reply.send({ data });
  });

  fastify.post<{
    Body: {
      title: string;
      content: string;
      displayType?: "banner" | "modal";
      isPinned?: boolean;
      expiresAt?: string;
    };
  }>("/tenant-admin/announcements", async (request, reply) => {
    if (!requireRole(request, reply, ["tenant_admin", "root_admin"])) {
      return;
    }

    const tenantId = requireTenantId(request, reply);
    if (!tenantId) {
      return;
    }

    const draft = await options.announcementService.createDraft({
      scopeType: "tenant",
      tenantId,
      title: request.body.title,
      content: request.body.content,
      displayType: request.body.displayType,
      isPinned: request.body.isPinned,
      expiresAt: request.body.expiresAt ? new Date(request.body.expiresAt) : null,
      createdBy: getActorId(request),
    });
    reply.status(201).send({ data: draft });
  });

  fastify.post<{ Params: { announcementId: string } }>(
    "/tenant-admin/announcements/:announcementId/publish",
    async (request, reply) => {
      if (!requireRole(request, reply, ["tenant_admin", "root_admin"])) {
        return;
      }

      const announcement = await options.announcementService.publishAnnouncement(request.params.announcementId);
      reply.send({ data: announcement });
    }
  );

  fastify.post<{ Params: { announcementId: string } }>(
    "/tenant-admin/announcements/:announcementId/end",
    async (request, reply) => {
      if (!requireRole(request, reply, ["tenant_admin", "root_admin"])) {
        return;
      }

      const announcement = await options.announcementService.endAnnouncement(request.params.announcementId);
      reply.send({ data: announcement });
    }
  );

  fastify.post<{ Params: { announcementId: string } }>(
    "/tenant-admin/announcements/:announcementId/dismiss",
    async (request, reply) => {
      if (!requireRole(request, reply, ["tenant_admin", "root_admin", "manager", "user"])) {
        return;
      }

      const tenantId = requireTenantId(request, reply);
      if (!tenantId) {
        return;
      }

      const actorId = getActorId(request);
      if (!actorId) {
        reply.status(401).send({
          error: {
            code: "UNAUTHENTICATED",
            message: "x-user-id header is required",
          },
        });
        return;
      }

      await options.announcementService.dismissAnnouncement({
        announcementId: request.params.announcementId,
        tenantId,
        userId: actorId,
      });
      reply.status(204).send();
    }
  );
}
