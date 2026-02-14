import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/modules/quota/services/execution-persistence.service", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../src/modules/quota/services/execution-persistence.service")
    >();
  return {
    ...actual,
    createExecutionPersistenceService: vi.fn(),
  };
});

import { registerRunRoutes } from "../../src/modules/quota/routes/run.routes";
import {
  createExecutionPersistenceService,
  ExecutionHttpError,
} from "../../src/modules/quota/services/execution-persistence.service";

function createServiceMock(overrides: Record<string, unknown> = {}) {
  return {
    listRuns: vi.fn().mockResolvedValue([]),
    getRunDetail: vi.fn().mockResolvedValue(null),
    stopExecution: vi.fn().mockResolvedValue(true),
    syncConversation: vi.fn().mockResolvedValue({
      id: "sync-1",
      status: "completed",
      degraded: false,
      updatedAt: "2026-02-14T00:00:00.000Z",
    }),
    ...overrides,
  };
}

describe("run routes", () => {
  const mockedCreateExecutionPersistenceService = vi.mocked(createExecutionPersistenceService);
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    mockedCreateExecutionPersistenceService.mockReset();
    app = Fastify();
    (app as { db?: Record<string, never> }).db = {};
    await app.register(registerRunRoutes, { prefix: "/v1" });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  it("returns 400 when tenantId/userId are missing", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/runs",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "invalid_request",
        }),
      })
    );
  });

  it("lists runs for current tenant user", async () => {
    const listRuns = vi.fn().mockResolvedValue([
      {
        id: "run-1",
        status: "completed",
        type: "generation",
      },
    ]);
    mockedCreateExecutionPersistenceService.mockReturnValue(
      createServiceMock({ listRuns }) as any
    );

    const response = await app.inject({
      method: "GET",
      url: "/v1/runs?appId=app-1&limit=10",
      headers: {
        "x-tenant-id": "tenant-1",
        "x-user-id": "user-1",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(listRuns).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        userId: "user-1",
        appId: "app-1",
        limit: 10,
      })
    );

    expect(response.json().data.items).toEqual([
      expect.objectContaining({
        id: "run-1",
      }),
    ]);
  });

  it("returns 404 when run detail does not exist", async () => {
    const getRunDetail = vi.fn().mockResolvedValue(null);
    mockedCreateExecutionPersistenceService.mockReturnValue(
      createServiceMock({ getRunDetail }) as any
    );

    const response = await app.inject({
      method: "GET",
      url: "/v1/runs/run-missing",
      headers: {
        "x-tenant-id": "tenant-1",
        "x-user-id": "user-1",
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "run_not_found",
        }),
      })
    );
  });

  it("maps execution http errors from conversation sync", async () => {
    const syncConversation = vi
      .fn()
      .mockRejectedValue(
        new ExecutionHttpError(404, "conversation_not_found", "Conversation not found")
      );
    mockedCreateExecutionPersistenceService.mockReturnValue(
      createServiceMock({ syncConversation }) as any
    );

    const response = await app.inject({
      method: "POST",
      url: "/v1/conversations/conv-1/sync",
      headers: {
        "x-tenant-id": "tenant-1",
        "x-user-id": "user-1",
      },
      payload: {
        trigger: "user",
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "conversation_not_found",
        }),
      })
    );
  });
});
