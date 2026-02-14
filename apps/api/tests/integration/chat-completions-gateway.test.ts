import Fastify from "fastify";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { traceMiddleware } from "../../src/middleware/trace.middleware";
import { platformHealthStore } from "../../src/modules/gateway/services/platform-health.store";

const mockHasAppAccess = vi.fn();
const mockGetAccessibleApps = vi.fn();
const mockResolveQuotaAttributionGroupId = vi.fn();
const mockQuotaCheck = vi.fn();
const mockQuotaDeduct = vi.fn();
const mockCreateNotification = vi.fn();

vi.mock("../../src/modules/rbac/services/app.service.js", () => ({
  createAppService: vi.fn(() => ({
    hasAppAccess: mockHasAppAccess,
    getAccessibleApps: mockGetAccessibleApps,
  })),
}));

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

function createMockDb(appRecord: Record<string, unknown>) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([appRecord]),
        })),
      })),
    })),
  };
}

function buildAppRecord(platform: "dify" | "coze" | "n8n" = "dify") {
  return {
    id: "app-1",
    tenantId: "tenant-1",
    name: "Gateway App",
    mode: "chat",
    status: "active",
    enableApi: true,
    externalPlatform: platform,
    config: {
      baseUrl: "https://dify.example.com",
      apiKey: "plain-api-key",
    },
  };
}

describe("gateway /v1/chat/completions", () => {
  let registerChatExecutionRoutes: typeof import("../../src/modules/quota/routes/chat-execution.routes").registerChatExecutionRoutes;

  beforeAll(async () => {
    ({ registerChatExecutionRoutes } = await import("../../src/modules/quota/routes/chat-execution.routes"));
  });

  beforeEach(() => {
    mockHasAppAccess.mockReset();
    mockGetAccessibleApps.mockReset();
    mockResolveQuotaAttributionGroupId.mockReset();
    mockQuotaCheck.mockReset();
    mockQuotaDeduct.mockReset();
    mockCreateNotification.mockReset();

    mockHasAppAccess.mockResolvedValue(true);
    mockResolveQuotaAttributionGroupId.mockResolvedValue({
      groupId: "group-1",
      source: "requested",
    });
    mockQuotaCheck.mockResolvedValue({
      allowed: true,
      limits: [],
    });
    mockQuotaDeduct.mockResolvedValue(undefined);

    platformHealthStore.recordSuccess("dify");
    platformHealthStore.recordSuccess("coze");
    platformHealthStore.recordSuccess("n8n");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns OpenAI-compatible completion payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          answer: "hello from dify",
          message_id: "msg-1",
          conversation_id: "ext-conv-1",
          task_id: "task-1",
          created_at: 1739510400,
          metadata: {
            usage: {
              prompt_tokens: 10,
              completion_tokens: 15,
              total_tokens: 25,
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const app = Fastify();
    app.decorate("db", createMockDb(buildAppRecord()) as any);
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
    const payload = response.json() as Record<string, unknown>;
    expect(payload.object).toBe("chat.completion");
    expect(payload.model).toBe("app-1");
    expect(payload).toHaveProperty("conversation_id");
    expect(payload).toHaveProperty("trace_id");
    expect((payload.usage as Record<string, unknown>).total_tokens).toBe(25);

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
      },
      limits: [],
    });

    const app = Fastify();
    app.decorate("db", createMockDb(buildAppRecord()) as any);
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

    expect(response.statusCode).toBe(429);
    const payload = response.json() as {
      error: { code: string };
      traceId: string;
      degraded: boolean;
    };
    expect(payload.error.code).toBe("quota_exceeded");
    expect(payload.traceId).toBeTruthy();
    expect(payload.degraded).toBe(false);

    await app.close();
  });

  it("returns degraded error for unsupported platform adapters", async () => {
    const app = Fastify();
    app.decorate("db", createMockDb(buildAppRecord("coze")) as any);
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
      error: { code: string };
      degraded: boolean;
    };
    expect(payload.error.code).toBe("service_degraded");
    expect(payload.degraded).toBe(true);

    await app.close();
  });
});
