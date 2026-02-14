import { describe, expect, it, vi } from "vitest";
import { AppService } from "../../src/modules/rbac/services/app.service";

describe("AppService default ordering", () => {
  it("prioritizes featured apps in all view", async () => {
    const service = new AppService({} as any) as any;

    service.findTenantApps = vi.fn().mockResolvedValue([
      {
        id: "app-normal",
        name: "Normal App",
        description: "regular",
        mode: "chat",
        icon: null,
        iconType: "image",
        isFeatured: false,
        sortOrder: 0,
        tags: [],
      },
      {
        id: "app-featured",
        name: "Featured App",
        description: "featured",
        mode: "chat",
        icon: null,
        iconType: "image",
        isFeatured: true,
        sortOrder: 999,
        tags: [],
      },
    ]);
    service.getUserGroups = vi.fn().mockResolvedValue([{ groupId: "group-1", groupName: "Group 1" }]);
    service.hasGlobalAppUsePermission = vi.fn().mockResolvedValue(true);
    service.loadAccessMaps = vi.fn().mockResolvedValue({
      userAllow: new Set<string>(),
      userDeny: new Set<string>(),
      groupAllow: new Map<string, Set<string>>(),
      groupDeny: new Map<string, Set<string>>(),
    });
    service.getFavoriteMap = vi.fn().mockResolvedValue(new Map<string, Date>());
    service.getRecentUseMap = vi.fn().mockResolvedValue(new Map<string, string>());

    const result = await service.getAccessibleApps("user-1", "tenant-1", null, {
      view: "all",
      limit: 20,
    });

    expect(result.items[0]?.id).toBe("app-featured");
    expect(result.items[1]?.id).toBe("app-normal");
  });
});
