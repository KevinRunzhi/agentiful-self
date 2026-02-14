import { describe, expect, it } from "vitest";
import { ApiKeyLimitExceededError, ApiKeyService, MAX_ACTIVE_API_KEYS } from "../../src/modules/platform/services/api-key.service";

class InMemoryApiKeyRepository {
  private readonly rows: Array<any> = [];

  async countActiveByTenant(tenantId: string): Promise<number> {
    return this.rows.filter((row) => row.tenantId === tenantId && !row.revokedAt).length;
  }

  async create(input: {
    tenantId: string;
    keyName: string;
    keyPrefix: string;
    keyHash: string;
    createdAt: Date;
    expiresAt?: Date | null;
  }): Promise<any> {
    const row = {
      id: `key-${this.rows.length + 1}`,
      tenantId: input.tenantId,
      keyName: input.keyName,
      keyPrefix: input.keyPrefix,
      keyHash: input.keyHash,
      createdAt: input.createdAt,
      expiresAt: input.expiresAt ?? null,
      revokedAt: null,
      lastUsedAt: null,
      usageCount: 0,
    };
    this.rows.push(row);
    return row;
  }

  async listByTenant(tenantId: string): Promise<any[]> {
    return this.rows.filter((row) => row.tenantId === tenantId);
  }

  async findByHash(keyHash: string, tenantId?: string): Promise<any | null> {
    return (
      this.rows.find((row) => row.keyHash === keyHash && (!tenantId || row.tenantId === tenantId)) ?? null
    );
  }

  async revoke(tenantId: string, keyId: string, revokedAt: Date): Promise<boolean> {
    const row = this.rows.find((item) => item.tenantId === tenantId && item.id === keyId);
    if (!row) {
      return false;
    }
    row.revokedAt = revokedAt;
    return true;
  }

  async revokeAllByTenant(tenantId: string, revokedAt: Date): Promise<number> {
    let count = 0;
    for (const row of this.rows) {
      if (row.tenantId === tenantId && !row.revokedAt) {
        row.revokedAt = revokedAt;
        count += 1;
      }
    }
    return count;
  }

  async touchUsage(keyId: string, usedAt: Date): Promise<void> {
    const row = this.rows.find((item) => item.id === keyId);
    if (!row) {
      return;
    }
    row.lastUsedAt = usedAt;
    row.usageCount += 1;
  }
}

describe("ApiKeyService", () => {
  it("creates API key and stores only hash", async () => {
    const repository = new InMemoryApiKeyRepository();
    const service = new ApiKeyService(repository as any, () => new Date("2026-02-14T00:00:00.000Z"));

    const created = await service.createKey({
      tenantId: "tenant-1",
      keyName: "integration",
    });

    expect(created.plainTextKey.startsWith("ak_")).toBe(true);
    expect(created.keyPrefix).toBe(created.plainTextKey.slice(0, 12));

    const rows = await repository.listByTenant("tenant-1");
    expect(rows).toHaveLength(1);
    expect(rows[0].keyHash).toBe(ApiKeyService.hashKey(created.plainTextKey));
    expect(rows[0].keyHash).not.toContain(created.plainTextKey);
  });

  it("enforces per-tenant active key limit", async () => {
    const repository = new InMemoryApiKeyRepository();
    const service = new ApiKeyService(repository as any);

    for (let index = 0; index < MAX_ACTIVE_API_KEYS; index += 1) {
      await service.createKey({
        tenantId: "tenant-1",
        keyName: `key-${index}`,
      });
    }

    await expect(() =>
      service.createKey({
        tenantId: "tenant-1",
        keyName: "overflow",
      })
    ).rejects.toBeInstanceOf(ApiKeyLimitExceededError);
  });

  it("authenticates active key and updates usage metadata", async () => {
    const repository = new InMemoryApiKeyRepository();
    const now = new Date("2026-02-14T01:00:00.000Z");
    const service = new ApiKeyService(repository as any, () => now);

    const created = await service.createKey({
      tenantId: "tenant-1",
      keyName: "reporting",
    });

    const auth = await service.authenticate(created.plainTextKey);
    expect(auth).toEqual(
      expect.objectContaining({
        tenantId: "tenant-1",
      })
    );

    const rows = await repository.listByTenant("tenant-1");
    expect(rows[0].usageCount).toBe(1);
    expect(rows[0].lastUsedAt).toEqual(now);
  });

  it("rejects revoked and expired keys", async () => {
    const repository = new InMemoryApiKeyRepository();
    const now = new Date("2026-02-14T02:00:00.000Z");
    const service = new ApiKeyService(repository as any, () => now);

    const expired = await service.createKey({
      tenantId: "tenant-1",
      keyName: "expired",
      expiresAt: new Date("2026-02-13T23:59:59.000Z"),
    });
    const revoked = await service.createKey({
      tenantId: "tenant-1",
      keyName: "revoked",
    });
    await service.revokeKey("tenant-1", revoked.id);

    expect(await service.authenticate(expired.plainTextKey)).toBeNull();
    expect(await service.authenticate(revoked.plainTextKey)).toBeNull();
  });
});
