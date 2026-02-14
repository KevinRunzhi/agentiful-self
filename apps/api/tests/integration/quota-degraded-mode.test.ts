import { afterEach, describe, expect, it, vi } from "vitest";
import { auditService } from "../../src/modules/auth/services/audit.service.js";
import {
  markQuotaServiceDegraded,
  markQuotaServiceHealthy,
  quotaGuardMiddleware,
} from "../../src/middleware/quota-guard.js";

function createReply() {
  return {
    statusCode: 200,
    payload: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(body: unknown) {
      this.payload = body;
      return this;
    },
  };
}

describe("T043 [US4] degraded mode guard behavior", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows app list read path when quota service is degraded", async () => {
    const server = {} as any;
    markQuotaServiceDegraded(server, "simulated timeout", "test");

    const reply = createReply();
    const request = {
      id: "trace-list",
      method: "GET",
      url: "/api/rbac/apps/accessible",
      headers: {},
      server,
    } as any;

    await quotaGuardMiddleware(request, reply as any);

    expect(reply.statusCode).toBe(200);
    expect(reply.payload).toBeUndefined();
  });

  it("allows app context options read path when quota service is degraded", async () => {
    const server = {} as any;
    markQuotaServiceDegraded(server, "simulated timeout", "test");

    const reply = createReply();
    const request = {
      id: "trace-context",
      method: "GET",
      url: "/api/rbac/apps/app-1/context-options",
      headers: {},
      server,
    } as any;

    await quotaGuardMiddleware(request, reply as any);

    expect(reply.statusCode).toBe(200);
    expect(reply.payload).toBeUndefined();
  });

  it("denies new chat execution when quota service is degraded", async () => {
    const server = {} as any;
    markQuotaServiceDegraded(server, "quota redis unavailable", "test");

    const reply = createReply();
    const request = {
      id: "trace-chat",
      method: "POST",
      url: "/v1/chat/completions",
      headers: {
        "x-tenant-id": "tenant-1",
      },
      server,
    } as any;

    await quotaGuardMiddleware(request, reply as any);

    expect(reply.statusCode).toBe(503);
    expect(reply.payload).toEqual({
      error: {
        type: "service_unavailable",
        code: "service_degraded",
        message: "quota redis unavailable",
      },
      traceId: "trace-chat",
      degraded: true,
    });
  });

  it("emits gov.degradation.triggered only once per degradation episode", async () => {
    const server = {} as any;
    markQuotaServiceHealthy(server, "test");
    markQuotaServiceDegraded(server, "degraded once", "test");

    const logFailureSpy = vi.spyOn(auditService, "logFailure").mockResolvedValue({
      id: "audit-1",
    } as any);

    const requestA = {
      id: "trace-1",
      method: "POST",
      url: "/v1/chat/completions",
      headers: {
        "x-tenant-id": "tenant-1",
      },
      server,
    } as any;
    const requestB = {
      id: "trace-2",
      method: "POST",
      url: "/v1/chat/completions",
      headers: {
        "x-tenant-id": "tenant-1",
      },
      server,
    } as any;

    await quotaGuardMiddleware(requestA, createReply() as any);
    await quotaGuardMiddleware(requestB, createReply() as any);

    expect(logFailureSpy).toHaveBeenCalledTimes(1);
    expect(logFailureSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "gov.degradation.triggered",
        resourceType: "quota_service",
      }),
      "degraded once"
    );
  });
});
