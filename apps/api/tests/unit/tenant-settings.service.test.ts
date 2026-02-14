import { describe, expect, it } from "vitest";
import {
  TenantSettingsService,
  TenantSettingsValidationError,
  computeContrastRatio,
} from "../../src/modules/platform/services/tenant-settings.service";

class InMemoryTenantSettingsRepository {
  public row: any = {
    id: "tenant-1",
    customConfig: {},
    configVersion: 1,
  };

  async findById(tenantId: string): Promise<any | null> {
    if (tenantId !== this.row.id) {
      return null;
    }
    return this.row;
  }

  async updateConfig(input: { tenantId: string; customConfig: Record<string, unknown>; configVersion: number }): Promise<void> {
    this.row = {
      ...this.row,
      customConfig: input.customConfig,
      configVersion: input.configVersion,
    };
  }
}

describe("TenantSettingsService", () => {
  it("merges patch with defaults and increments config version", async () => {
    const repository = new InMemoryTenantSettingsRepository();
    const service = new TenantSettingsService(repository as any);

    const updated = await service.updateSettings({
      tenantId: "tenant-1",
      patch: {
        i18n: {
          defaultLanguage: "en-US",
        },
      },
    });

    expect(updated.config.i18n?.defaultLanguage).toBe("en-US");
    expect(updated.config.notification?.retentionDays).toBe(90);
    expect(updated.configVersion).toBe(2);
    expect(updated.changedKeys).toContain("i18n");
  });

  it("rejects invalid brand contrast", async () => {
    const repository = new InMemoryTenantSettingsRepository();
    const service = new TenantSettingsService(repository as any);

    await expect(() =>
      service.updateSettings({
        tenantId: "tenant-1",
        patch: {
          branding: {
            primaryColor: "#111111",
            secondaryColor: "#222222",
          },
        },
      })
    ).rejects.toBeInstanceOf(TenantSettingsValidationError);
  });

  it("computes WCAG contrast ratio", () => {
    const ratio = computeContrastRatio("#000000", "#ffffff");
    expect(ratio).not.toBeNull();
    expect(ratio).toBeGreaterThan(20);
  });
});
