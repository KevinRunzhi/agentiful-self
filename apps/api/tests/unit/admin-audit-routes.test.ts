import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/modules/compliance/services/audit-query.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/modules/compliance/services/audit-query.service")>();
  return {
    ...actual,
    createAuditQueryService: vi.fn(),
  };
});

vi.mock("../../src/modules/compliance/services/audit-export.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/modules/compliance/services/audit-export.service")>();
  return {
    ...actual,
    createAuditExportService: vi.fn(),
  };
});

vi.mock("../../src/modules/compliance/services/security-policy-config.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/modules/compliance/services/security-policy-config.service")>();
  return {
    ...actual,
    createSecurityPolicyConfigService: vi.fn(),
  };
});

import { registerAdminAuditRoutes } from "../../src/modules/compliance/routes/admin-audit.routes";
import { createAuditQueryService } from "../../src/modules/compliance/services/audit-query.service";
import { createAuditExportService } from "../../src/modules/compliance/services/audit-export.service";
import { createSecurityPolicyConfigService } from "../../src/modules/compliance/services/security-policy-config.service";

function createAuditQueryMock(overrides: Record<string, unknown> = {}) {
  return {
    query: vi.fn().mockResolvedValue({
      items: [{ id: "evt-1", action: "auth.login.success" }],
      hasMore: false,
      nextCursor: null,
    }),
    getDetail: vi.fn().mockResolvedValue({
      id: "evt-1",
      action: "auth.login.success",
    }),
    ...overrides,
  };
}

function createAuditExportMock(overrides: Record<string, unknown> = {}) {
  return {
    export: vi.fn().mockResolvedValue({
      mode: "sync",
      format: "csv",
      itemCount: 1,
      content: "id,action\nevt-1,auth.login.success",
    }),
    getAsyncExport: vi.fn().mockResolvedValue({
      mode: "async",
      format: "csv",
      itemCount: 1,
      jobId: "job-1",
      content: "id,action\nevt-1,auth.login.success",
    }),
    ...overrides,
  };
}

function createPolicyServiceMock(overrides: Record<string, unknown> = {}) {
  return {
    updatePolicy: vi.fn().mockResolvedValue({
      audit: {
        retentionDays: 365,
      },
    }),
    ...overrides,
  };
}

describe("admin audit routes", () => {
  const mockedCreateAuditQueryService = vi.mocked(createAuditQueryService);
  const mockedCreateAuditExportService = vi.mocked(createAuditExportService);
  const mockedCreateSecurityPolicyConfigService = vi.mocked(createSecurityPolicyConfigService);
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    mockedCreateAuditQueryService.mockReset();
    mockedCreateAuditExportService.mockReset();
    mockedCreateSecurityPolicyConfigService.mockReset();

    mockedCreateAuditQueryService.mockReturnValue(createAuditQueryMock() as any);
    mockedCreateAuditExportService.mockReturnValue(createAuditExportMock() as any);
    mockedCreateSecurityPolicyConfigService.mockReturnValue(createPolicyServiceMock() as any);

    app = Fastify();
    (app as { db?: Record<string, never> }).db = {};
    await app.register(registerAdminAuditRoutes, { prefix: "/v1/admin" });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  it("returns 400 when tenant context is missing", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/audit/events",
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

  it("blocks root admin without breakglass reason", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/audit/events",
      headers: {
        "x-tenant-id": "tenant-1",
        "x-user-id": "user-1",
        "x-actor-role": "root_admin",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "breakglass_reason_required",
        }),
      })
    );
  });

  it("queries audit events for tenant admin", async () => {
    const query = vi.fn().mockResolvedValue({
      items: [{ id: "evt-1", action: "auth.login.success" }],
      hasMore: false,
      nextCursor: null,
    });
    mockedCreateAuditQueryService.mockReturnValue(createAuditQueryMock({ query }) as any);

    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/audit/events?limit=10",
      headers: {
        "x-tenant-id": "tenant-1",
        "x-user-id": "user-1",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(query).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-1" }));
    expect(response.json()).toEqual(
      expect.objectContaining({
        object: "list",
        data: expect.arrayContaining([expect.objectContaining({ id: "evt-1" })]),
      })
    );
  });

  it("exports audit events", async () => {
    const exportFn = vi.fn().mockResolvedValue({
      mode: "sync",
      format: "json",
      itemCount: 1,
      content: "[]",
    });
    mockedCreateAuditExportService.mockReturnValue(createAuditExportMock({ export: exportFn }) as any);

    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/audit/exports",
      headers: {
        "x-tenant-id": "tenant-1",
        "x-user-id": "user-1",
      },
      payload: {
        format: "json",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(exportFn).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        requesterUserId: "user-1",
      })
    );
  });
});
