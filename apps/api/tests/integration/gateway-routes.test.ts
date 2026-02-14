import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { traceMiddleware } from "../../src/middleware/trace.middleware";
import { registerGatewayRoutes } from "../../src/modules/gateway/routes";

describe("gateway routes", () => {
  const apps: Array<Awaited<ReturnType<typeof Fastify>>> = [];

  afterEach(async () => {
    while (apps.length > 0) {
      const app = apps.pop();
      if (app) {
        await app.close();
      }
    }
  });

  it("returns platform health snapshots", async () => {
    const app = Fastify();
    apps.push(app);
    app.addHook("onRequest", traceMiddleware);
    await app.register(registerGatewayRoutes, { prefix: "/api/v1" });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/gateway/health",
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as { platforms: Record<string, unknown> };
    expect(payload.platforms).toHaveProperty("dify");
  });

  it("returns null trace URL when template is not configured", async () => {
    const app = Fastify();
    apps.push(app);
    app.addHook("onRequest", traceMiddleware);
    await app.register(registerGatewayRoutes, { prefix: "/api/v1" });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/observability/trace-url?traceId=trace-1",
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as { traceId: string; url: string | null };
    expect(payload.traceId).toBe("trace-1");
    expect(payload.url).toBeNull();
  });
});
