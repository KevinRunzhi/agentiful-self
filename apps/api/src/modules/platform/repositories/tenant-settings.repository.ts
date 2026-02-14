import { getDatabase } from "@agentifui/db/client";
import { tenant } from "@agentifui/db/schema";
import { eq } from "drizzle-orm";
import type { TenantSettingsRepository } from "../services/tenant-settings.service.js";

export class DrizzleTenantSettingsRepository implements TenantSettingsRepository {
  async findById(tenantId: string): Promise<{ id: string; customConfig: any; configVersion: number } | null> {
    const db = getDatabase();
    const [row] = await db
      .select({
        id: tenant.id,
        customConfig: tenant.customConfig,
        configVersion: tenant.configVersion,
      })
      .from(tenant)
      .where(eq(tenant.id, tenantId))
      .limit(1);

    return row ?? null;
  }

  async updateConfig(input: { tenantId: string; customConfig: any; configVersion: number }): Promise<void> {
    const db = getDatabase();
    await db
      .update(tenant)
      .set({
        customConfig: input.customConfig,
        configVersion: input.configVersion,
        updatedAt: new Date(),
      })
      .where(eq(tenant.id, input.tenantId));
  }
}

export function createTenantSettingsRepository(): TenantSettingsRepository {
  return new DrizzleTenantSettingsRepository();
}
