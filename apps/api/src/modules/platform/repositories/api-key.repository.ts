import { getDatabase } from "@agentifui/db/client";
import { tenantApiKey } from "@agentifui/db/schema";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { TenantApiKeyRecord, TenantApiKeyRepository } from "../services/api-key.service.js";

export class DrizzleApiKeyRepository implements TenantApiKeyRepository {
  async countActiveByTenant(tenantId: string): Promise<number> {
    const db = getDatabase();
    const now = new Date();
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenantApiKey)
      .where(
        and(
          eq(tenantApiKey.tenantId, tenantId),
          isNull(tenantApiKey.revokedAt),
          or(isNull(tenantApiKey.expiresAt), gt(tenantApiKey.expiresAt, now))
        )
      );
    return Number(row?.count ?? 0);
  }

  async create(input: {
    tenantId: string;
    keyName: string;
    keyPrefix: string;
    keyHash: string;
    createdBy?: string;
    expiresAt?: Date | null;
    createdAt: Date;
  }): Promise<TenantApiKeyRecord> {
    const db = getDatabase();
    const [created] = await db
      .insert(tenantApiKey)
      .values({
        tenantId: input.tenantId,
        keyName: input.keyName,
        keyPrefix: input.keyPrefix,
        keyHash: input.keyHash,
        createdBy: input.createdBy,
        expiresAt: input.expiresAt ?? null,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create API key");
    }

    return created;
  }

  async listByTenant(tenantId: string): Promise<TenantApiKeyRecord[]> {
    const db = getDatabase();
    return db
      .select()
      .from(tenantApiKey)
      .where(eq(tenantApiKey.tenantId, tenantId))
      .orderBy(tenantApiKey.createdAt);
  }

  async findByHash(keyHash: string, tenantId?: string): Promise<TenantApiKeyRecord | null> {
    const db = getDatabase();

    const whereClause = tenantId
      ? and(eq(tenantApiKey.keyHash, keyHash), eq(tenantApiKey.tenantId, tenantId))
      : eq(tenantApiKey.keyHash, keyHash);

    const [row] = await db.select().from(tenantApiKey).where(whereClause).limit(1);
    return row ?? null;
  }

  async revoke(tenantId: string, keyId: string, revokedAt: Date): Promise<boolean> {
    const db = getDatabase();
    const rows = await db
      .update(tenantApiKey)
      .set({
        revokedAt,
        updatedAt: revokedAt,
      })
      .where(and(eq(tenantApiKey.tenantId, tenantId), eq(tenantApiKey.id, keyId)))
      .returning({ id: tenantApiKey.id });

    return rows.length > 0;
  }

  async revokeAllByTenant(tenantId: string, revokedAt: Date): Promise<number> {
    const db = getDatabase();
    const rows = await db
      .update(tenantApiKey)
      .set({
        revokedAt,
        updatedAt: revokedAt,
      })
      .where(and(eq(tenantApiKey.tenantId, tenantId), isNull(tenantApiKey.revokedAt)))
      .returning({ id: tenantApiKey.id });

    return rows.length;
  }

  async touchUsage(keyId: string, usedAt: Date): Promise<void> {
    const db = getDatabase();
    await db
      .update(tenantApiKey)
      .set({
        lastUsedAt: usedAt,
        usageCount: sql`${tenantApiKey.usageCount} + 1`,
        updatedAt: usedAt,
      })
      .where(eq(tenantApiKey.id, keyId));
  }
}

export function createApiKeyRepository(): TenantApiKeyRepository {
  return new DrizzleApiKeyRepository();
}
