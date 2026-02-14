import Fastify from "fastify";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { traceMiddleware } from "../../src/middleware/trace.middleware";
const mockResolveQuotaAttributionGroupId = vi.fn();
const mockQuotaCheck = vi.fn();
const mockQuotaDeduct = vi.fn();
const mockCreateNotification = vi.fn();
const mockStartExecution = vi.fn();
const mockCompleteExecution = vi.fn();
const mockFailExecution = vi.fn();

vi.mock("../../src/modules/quota/repositories/quota.repository", () => ({
  createQuotaRepository: vi.fn(() => ({
    listGroupManagerUserIds: vi.fn().mockResolvedValue([]),
    listTenantAdminUserIds: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("../../src/modules/quota/services/quota-attribution.service", () => {
  class MockInvalidActiveGroupError extends Error {}
  return {
    InvalidActiveGroupError: MockInvalidActiveGroupError,
    resolveQuotaAttributionGroupId: mockResolveQuotaAttributionGroupId,
  };
});

vi.mock("../../src/modules/quota/services/quota-check.service", () => ({
  createQuotaCheckService: vi.fn(() => ({
    check: mockQuotaCheck,
  })),
}));

vi.mock("../../src/modules/quota/services/quota-deduct.service", () => {
  class MockQuotaDeductExceededError extends Error {}
  return {
    QuotaDeductExceededError: MockQuotaDeductExceededError,
    createQuotaDeductService: vi.fn(() => ({
      deduct: mockQuotaDeduct,
    })),
  };
});

vi.mock("../../src/modules/quota/services/quota-alert.service", () => ({
  createQuotaAlertService: vi.fn(() => ({
    evaluateAndRecord: vi.fn(),
  })),
}));

vi.mock("../../src/modules/notifications/services/notification.service", () => ({
  createNotificationService: vi.fn(() => ({
    create: mockCreateNotification,
  })),
}));

vi.mock("../../src/modules/auth/services/audit.service.js", () => ({
  auditService: {
    logFailure: vi.fn().mockResolvedValue({ id: "audit-failure" }),
    logSuccess: vi.fn().mockResolvedValue({ id: "audit-success" }),
  },
}));

vi.mock("../../src/modules/quota/services/execution-persistence.service", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../src/modules/quota/services/execution-persistence.service")
    >();

  return {
    ...actual,
    createExecutionPersistenceService: vi.fn(() => ({
      startExecution: mockStartExecution,
      completeExecution: mockCompleteExecution,
      failExecution: mockFailExecution,
    })),
  };
});

describe("gateway /v1/chat/completions", () => {
  let registerChatExecutionRoutes: typeof import("../../src/modules/quota/routes/chat-execution.routes").registerChatExecutionRoutes;

  beforeAll(async () => {
    ({ registerChatExecutionRoutes } = await import("../../src/modules/quota/routes/chat-execution.routes"));
  });

  beforeEach(() => {
    mockResolveQuotaAttributionGroupId.mockReset();
    mockQuotaCheck.mockReset();
    mockQuotaDeduct.mockReset();
    mockCreateNotification.mockReset();
    mockStartExecution.mockReset();
    mockCompleteExecution.mockReset();
    mockFailExecution.mockReset();

    mockResolveQuotaAttributionGroupId.mockResolvedValue({
      groupId: "group-1",
      source: "requested",
    });
    mockQuotaCheck.mockResolvedValue({
      allowed: true,
      limits: [],
    });
    mockQuotaDeduct.mockResolvedValue(undefined);
    mockStartExecution.mockResolvedValue({
      runId: "run-1",
      conversationId: "conv-1",
      runType: "generation",
    });
    mockCompleteExecution.mockResolvedValue(undefined);
    mockFailExecution.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns OpenAI-compatible completion payload", async () => {
    const app = Fastify();
    app.decorate("db", {} as any);
    app.addHook("onRequest", traceMiddleware);
    await app.register(registerChatExecutionRoutes, { prefix: "/v1" });

    const response = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      payload: {
        tenantId: "tenant-1",
        userId: "user-1",
        model: "app-1",
        messages: [{ role: "user", content: "hello" }],
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      object: string;
      model: string;
      conversation_id: string;
      trace_id: string;
      usage: { total_tokens: number };
      quota: { attribution: { groupId: string } };
      run: { traceId: string };
    };
    expect(payload.object).toBe("chat.completion");
    expect(payload.model).toBe("app-1");
    expect(payload.conversation_id).toBe("conv-1");
    expect(payload.trace_id).toBeTruthy();
    expect(payload.run.traceId).toBe(payload.trace_id);
    expect(payload.usage.total_tokens).toBeGreaterThan(0);
    expect(payload.quota.attribution.groupId).toBe("group-1");
    expect(mockStartExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: "app-1",
      })
    );
    expect(mockCompleteExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-1",
        model: "app-1",
      })
    );

    await app.close();
  });

  it("returns unified quota_exceeded response", async () => {
    mockQuotaCheck.mockResolvedValue({
      allowed: false,
      exceededScope: "tenant",
      exceededDetail: {
        scope: "tenant",
        used: 100,
        limit: 100,
        resetsAt: "2026-03-01T00:00:00.000Z",
      },
      limits: [],
    });

    const app = Fastify();
    app.decorate("db", {} as any);
    app.addHook("onRequest", traceMiddleware);
    await app.register(registerChatExecutionRoutes, { prefix: "/v1" });

    const response = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      payload: {
        tenantId: "tenant-1",
        userId: "user-1",
        model: "app-1",
        messages: [{ role: "user", content: "hello" }],
      },
    });

    expect(response.statusCode).toBe(403);
    const payload = response.json() as {
      error: { code: string; trace_id: string };
      traceId: string;
      degraded: boolean;
    };
    expect(payload.error.code).toBe("quota_exceeded");
    expect(payload.error.trace_id).toBeTruthy();
    expect(payload.traceId).toBeTruthy();
    expect(payload.degraded).toBe(false);

    await app.close();
  });

  it("returns degraded error when execution start fails", async () => {
    mockStartExecution.mockRejectedValueOnce(new Error("platform adapter unavailable"));

    const app = Fastify();
    app.decorate("db", {} as any);
    app.addHook("onRequest", traceMiddleware);
    await app.register(registerChatExecutionRoutes, { prefix: "/v1" });

    const response = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      payload: {
        tenantId: "tenant-1",
        userId: "user-1",
        model: "app-1",
        messages: [{ role: "user", content: "hello" }],
      },
    });

    expect(response.statusCode).toBe(503);
    const payload = response.json() as {
      error: { code: string; trace_id: string };
      traceId: string;
      degraded: boolean;
    };
    expect(payload.error.code).toBe("quota_service_unavailable");
    expect(payload.error.trace_id).toBeTruthy();
    expect(payload.traceId).toBeTruthy();
    expect(payload.degraded).toBe(true);

    await app.close();
  });
});
