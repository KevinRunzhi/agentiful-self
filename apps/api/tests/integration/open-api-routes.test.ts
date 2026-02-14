import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { registerOpenApiRoutes } from "../../src/modules/openapi/routes/open-api.routes";

describe("open api routes", () => {
  const apps: Array<Awaited<ReturnType<typeof Fastify>>> = [];

  afterEach(async () => {
    while (apps.length > 0) {
      const app = apps.pop();
      if (app) {
        await app.close();
      }
    }
  });

  it("rejects request when API key is missing", async () => {
    const app = Fastify();
    apps.push(app);

    await app.register(registerOpenApiRoutes, {
      apiKeyAuthenticator: {
        authenticate: async () => null,
      },
      dataService: {
        listUsers: async () => [],
        listGroups: async () => [],
        listConversations: async () => [],
        getQuotaSummary: async () => ({}),
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/open-api/v1/users",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "OPEN_API_AUTH_REQUIRED" }),
      })
    );
  });

  it("returns users for valid API key", async () => {
    const app = Fastify();
    apps.push(app);

    await app.register(registerOpenApiRoutes, {
      apiKeyAuthenticator: {
        authenticate: async (rawKey) =>
          rawKey === "ak_valid"
            ? {
                keyId: "key-1",
                tenantId: "tenant-1",
                principalId: "key-1",
                rateLimitRpm: 60,
              }
            : null,
      },
      dataService: {
        listUsers: async (input) => [{ id: "user-1", tenantId: input.tenantId }],
        listGroups: async () => [],
        listConversations: async () => [],
        getQuotaSummary: async () => ({ used: 1 }),
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/open-api/v1/users?limit=20",
      headers: {
        "x-api-key": "ak_valid",
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as { data: Array<{ tenantId: string }>; meta: { tenantId: string; authType: string } };
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0].tenantId).toBe("tenant-1");
    expect(payload.meta).toEqual({ tenantId: "tenant-1", authType: "api_key" });
  });

  it("accepts OAuth bearer token when authenticator is configured", async () => {
    const app = Fastify();
    apps.push(app);

    await app.register(registerOpenApiRoutes, {
      apiKeyAuthenticator: {
        authenticate: async () => null,
      },
      oauthAuthenticator: {
        authenticate: async (token) =>
          token === "oauth_ok"
            ? {
                tenantId: "tenant-2",
                principalId: "oauth-user-1",
              }
            : null,
      },
      dataService: {
        listUsers: async () => [],
        listGroups: async () => [],
        listConversations: async () => [],
        getQuotaSummary: async (input) => ({ tenantId: input.tenantId, used: 42 }),
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/open-api/v1/quota/summary",
      headers: {
        authorization: "Bearer oauth_ok",
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as { data: { tenantId: string }; meta: { authType: string } };
    expect(payload.data.tenantId).toBe("tenant-2");
    expect(payload.meta.authType).toBe("oauth2");
  });
});
