import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { registerPlatformRoutes } from "../../src/modules/platform/routes/platform.routes";

describe("platform routes", () => {
  const apps: Array<Awaited<ReturnType<typeof Fastify>>> = [];

  afterEach(async () => {
    while (apps.length > 0) {
      const app = apps.pop();
      if (app) {
        await app.close();
      }
    }
  });

  function createRouteOptions() {
    const settingsState = {
      config: {
        i18n: { defaultLanguage: "zh-CN" },
      },
      configVersion: 1,
    };

    const apiKeys: Array<{ id: string; keyName: string; tenantId: string }> = [];

    return {
      tenantLifecycleService: {
        createTenant: async (input: { slug: string }) => ({
          tenantId: "tenant-1",
          slug: input.slug,
          status: "active",
          readyInMs: 2500,
        }),
        disableTenant: async () => undefined,
        enableTenant: async () => undefined,
        deleteTenant: async () => ({ scheduledPurgeAt: new Date("2026-05-15T00:00:00.000Z") }),
      },
      tenantSettingsService: {
        getEffectiveSettings: async () => ({
          config: settingsState.config,
          configVersion: settingsState.configVersion,
        }),
        updateSettings: async ({ patch }: { patch: Record<string, unknown> }) => {
          settingsState.config = {
            ...settingsState.config,
            ...patch,
          };
          settingsState.configVersion += 1;
          return {
            config: settingsState.config,
            configVersion: settingsState.configVersion,
            changedKeys: Object.keys(patch),
          };
        },
      },
      apiKeyService: {
        listKeys: async () => apiKeys,
        createKey: async ({ keyName, tenantId }: { keyName: string; tenantId: string }) => {
          const created = {
            id: `key-${apiKeys.length + 1}`,
            tenantId,
            keyName,
            keyPrefix: "ak_abcdef123",
            plainTextKey: "ak_abcdef12345",
            expiresAt: null,
            createdAt: new Date("2026-02-14T00:00:00.000Z"),
          };
          apiKeys.push({ id: created.id, keyName, tenantId });
          return created;
        },
        revokeKey: async (_tenantId: string, keyId: string) => {
          const index = apiKeys.findIndex((item) => item.id === keyId);
          if (index < 0) {
            return false;
          }
          apiKeys.splice(index, 1);
          return true;
        },
      },
      announcementService: {
        createDraft: async (input: { title: string }) => ({
          id: "ann-1",
          scopeType: "tenant",
          tenantId: "tenant-1",
          title: input.title,
          content: "content",
          displayType: "banner",
          status: "draft",
          isPinned: false,
          publishedAt: null,
          expiresAt: null,
          createdAt: new Date("2026-02-14T00:00:00.000Z"),
          updatedAt: new Date("2026-02-14T00:00:00.000Z"),
        }),
        publishAnnouncement: async () => ({
          id: "ann-1",
        }),
        endAnnouncement: async () => ({
          id: "ann-1",
        }),
        dismissAnnouncement: async () => undefined,
        listVisibleAnnouncements: async () => [],
      },
    };
  }

  it("requires root_admin role for tenant creation", async () => {
    const app = Fastify();
    apps.push(app);
    await app.register(registerPlatformRoutes, createRouteOptions() as any);

    const response = await app.inject({
      method: "POST",
      url: "/platform-admin/tenants",
      payload: {
        name: "Acme",
        slug: "acme",
        adminEmail: "admin@acme.com",
      },
      headers: {
        "x-user-role": "tenant_admin",
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it("creates tenant for root_admin", async () => {
    const app = Fastify();
    apps.push(app);
    await app.register(registerPlatformRoutes, createRouteOptions() as any);

    const response = await app.inject({
      method: "POST",
      url: "/platform-admin/tenants",
      payload: {
        name: "Acme",
        slug: "acme",
        adminEmail: "admin@acme.com",
      },
      headers: {
        "x-user-role": "root_admin",
      },
    });

    expect(response.statusCode).toBe(201);
    const payload = response.json() as { data: { tenantId: string; readyInMs: number } };
    expect(payload.data.tenantId).toBe("tenant-1");
    expect(payload.data.readyInMs).toBeLessThanOrEqual(30_000);
  });

  it("updates tenant settings and manages API keys for tenant_admin", async () => {
    const app = Fastify();
    apps.push(app);
    await app.register(registerPlatformRoutes, createRouteOptions() as any);

    const patchResponse = await app.inject({
      method: "PATCH",
      url: "/tenant-admin/settings",
      payload: {
        i18n: { defaultLanguage: "en-US" },
      },
      headers: {
        "x-user-role": "tenant_admin",
        "x-tenant-id": "tenant-1",
        "x-user-id": "admin-1",
      },
    });
    expect(patchResponse.statusCode).toBe(200);
    expect((patchResponse.json() as any).data.configVersion).toBe(2);

    const createKeyResponse = await app.inject({
      method: "POST",
      url: "/tenant-admin/api-keys",
      payload: {
        keyName: "integration",
      },
      headers: {
        "x-user-role": "tenant_admin",
        "x-tenant-id": "tenant-1",
        "x-user-id": "admin-1",
      },
    });
    expect(createKeyResponse.statusCode).toBe(201);

    const listResponse = await app.inject({
      method: "GET",
      url: "/tenant-admin/api-keys",
      headers: {
        "x-user-role": "tenant_admin",
        "x-tenant-id": "tenant-1",
      },
    });
    expect(listResponse.statusCode).toBe(200);
    expect((listResponse.json() as any).data).toHaveLength(1);
  });
});
