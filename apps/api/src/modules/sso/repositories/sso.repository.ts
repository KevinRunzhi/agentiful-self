/**
 * SSO Config Repository
 *
 * Data access layer for SSO configuration
 */

import { eq, and } from "drizzle-orm";
import { getDatabase } from "@agentifui/db/client";
import { ssoConfig } from "@agentifui/db/schema";
import type { SSOConfig, NewSSOConfig } from "@agentifui/db/schema";

/**
 * SSO Config repository
 */
export class SSOConfigRepository {
  /**
   * Get SSO config by ID
   */
  async findById(id: string): Promise<SSOConfig | null> {
    const db = getDatabase();
    const [result] = await db
      .select()
      .from(ssoConfig)
      .where(eq(ssoConfig.id, id))
      .limit(1);
    return result || null;
  }

  /**
   * Get all SSO configs for a tenant
   */
  async findByTenantId(tenantId: string): Promise<SSOConfig[]> {
    const db = getDatabase();
    return db
      .select()
      .from(ssoConfig)
      .where(eq(ssoConfig.tenantId, tenantId));
  }

  /**
   * Get enabled SSO configs for a tenant
   */
  async findEnabledByTenant(tenantId: string): Promise<SSOConfig[]> {
    const db = getDatabase();
    return db
      .select()
      .from(ssoConfig)
      .where(
        and(
          eq(ssoConfig.tenantId, tenantId),
          eq(ssoConfig.enabled, true)
        )
      );
  }

  /**
   * Get SSO config by tenant and provider
   */
  async findByTenantAndProvider(tenantId: string, provider: string): Promise<SSOConfig | null> {
    const db = getDatabase();
    const [result] = await db
      .select()
      .from(ssoConfig)
      .where(
        and(
          eq(ssoConfig.tenantId, tenantId),
          eq(ssoConfig.provider, provider)
        )
      )
      .limit(1);
    return result || null;
  }

  /**
   * Find SSO config by email domain
   * Searches across all tenants for matching domain
   */
  async findByEmailDomain(domain: string): Promise<SSOConfig[]> {
    const db = getDatabase();
    const configs = await db
      .select()
      .from(ssoConfig)
      .where(eq(ssoConfig.enabled, true));

    // Filter by domain in application layer (since domains is JSONB)
    return configs.filter((config) => {
      const domains = config.domains as string[] | null;
      return domains?.some((d) => d.toLowerCase() === domain.toLowerCase());
    });
  }

  /**
   * Create SSO config
   */
  async create(data: NewSSOConfig): Promise<SSOConfig> {
    const db = getDatabase();
    const [result] = await db.insert(ssoConfig).values(data).returning();
    return result;
  }

  /**
   * Update SSO config
   */
  async update(id: string, data: Partial<NewSSOConfig>): Promise<SSOConfig | null> {
    const db = getDatabase();
    const [result] = await db
      .update(ssoConfig)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(ssoConfig.id, id))
      .returning();
    return result || null;
  }

  /**
   * Delete SSO config
   */
  async delete(id: string): Promise<boolean> {
    const db = getDatabase();
    const result = await db.delete(ssoConfig).where(eq(ssoConfig.id, id));
    return result.rowCount > 0;
  }

  /**
   * Enable/disable SSO config
   */
  async setEnabled(id: string, enabled: boolean): Promise<SSOConfig | null> {
    return this.update(id, { enabled });
  }
}

// Singleton instance
export const ssoConfigRepository = new SSOConfigRepository();
