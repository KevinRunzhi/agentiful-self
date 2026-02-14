import { describe, expect, it, vi } from "vitest";
import {
  InvalidActiveGroupError,
  resolveQuotaAttributionGroupId,
} from "../../src/modules/quota/services/quota-attribution.service";

describe("T030 [US2] quota attribution with X-Active-Group-ID", () => {
  it("uses requested group when membership is valid", async () => {
    const quotaRepository = {
      hasActiveGroupMembership: vi.fn().mockResolvedValue(true),
      findDefaultGroupId: vi.fn().mockResolvedValue("group-default"),
    };

    const result = await resolveQuotaAttributionGroupId(quotaRepository as any, {
      tenantId: "tenant-1",
      userId: "user-1",
      requestedGroupId: "group-header",
    });

    expect(result).toEqual({
      groupId: "group-header",
      source: "requested",
    });
    expect(quotaRepository.hasActiveGroupMembership).toHaveBeenCalledWith(
      "tenant-1",
      "user-1",
      "group-header"
    );
  });

  it("throws when requested group is invalid for tenant/user", async () => {
    const quotaRepository = {
      hasActiveGroupMembership: vi.fn().mockResolvedValue(false),
      findDefaultGroupId: vi.fn(),
    };

    await expect(
      resolveQuotaAttributionGroupId(quotaRepository as any, {
        tenantId: "tenant-1",
        userId: "user-1",
        requestedGroupId: "group-invalid",
      })
    ).rejects.toBeInstanceOf(InvalidActiveGroupError);
  });

  it("falls back to default group when no requested group provided", async () => {
    const quotaRepository = {
      hasActiveGroupMembership: vi.fn(),
      findDefaultGroupId: vi.fn().mockResolvedValue("group-default"),
    };

    const result = await resolveQuotaAttributionGroupId(quotaRepository as any, {
      tenantId: "tenant-1",
      userId: "user-1",
      requestedGroupId: null,
    });

    expect(result).toEqual({
      groupId: "group-default",
      source: "default",
    });
  });

  it("returns none when no requested/default group exists", async () => {
    const quotaRepository = {
      hasActiveGroupMembership: vi.fn(),
      findDefaultGroupId: vi.fn().mockResolvedValue(null),
    };

    const result = await resolveQuotaAttributionGroupId(quotaRepository as any, {
      tenantId: "tenant-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      groupId: null,
      source: "none",
    });
  });

  it("uses direct attribution when app is user-directly granted", async () => {
    const quotaRepository = {
      getUserAppGrantPermission: vi.fn().mockResolvedValue("use"),
      hasActiveGroupMembership: vi.fn(),
      hasGroupAppGrant: vi.fn(),
      findDefaultGroupIdForApp: vi.fn().mockResolvedValue(null),
      findDefaultGroupId: vi.fn().mockResolvedValue("group-default"),
    };

    const result = await resolveQuotaAttributionGroupId(quotaRepository as any, {
      tenantId: "tenant-1",
      userId: "user-1",
      appId: "app-1",
    });

    expect(result).toEqual({
      groupId: null,
      source: "direct",
    });
  });
});
