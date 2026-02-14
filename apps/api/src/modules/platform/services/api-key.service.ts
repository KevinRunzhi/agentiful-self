import { createHash, randomBytes } from "node:crypto";

export interface TenantApiKeyRecord {
  id: string;
  tenantId: string;
  keyName: string;
  keyPrefix: string;
  keyHash: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  usageCount: number;
  createdAt: Date;
}

export interface TenantApiKeyRepository {
  countActiveByTenant(tenantId: string): Promise<number>;
  create(input: {
    tenantId: string;
    keyName: string;
    keyPrefix: string;
    keyHash: string;
    createdBy?: string;
    expiresAt?: Date | null;
    createdAt: Date;
  }): Promise<TenantApiKeyRecord>;
  listByTenant(tenantId: string): Promise<TenantApiKeyRecord[]>;
  findByHash(keyHash: string, tenantId?: string): Promise<TenantApiKeyRecord | null>;
  revoke(tenantId: string, keyId: string, revokedAt: Date): Promise<boolean>;
  revokeAllByTenant(tenantId: string, revokedAt: Date): Promise<number>;
  touchUsage(keyId: string, usedAt: Date): Promise<void>;
}

export interface CreatedApiKey {
  id: string;
  tenantId: string;
  keyName: string;
  keyPrefix: string;
  plainTextKey: string;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface ApiKeyAuthResult {
  keyId: string;
  tenantId: string;
  principalId: string;
  rateLimitRpm: number;
}

export const MAX_ACTIVE_API_KEYS = 10;
export const API_KEY_RATE_LIMIT_RPM = 60;

export class ApiKeyLimitExceededError extends Error {
  constructor() {
    super(`Active API key limit reached (${MAX_ACTIVE_API_KEYS})`);
    this.name = "ApiKeyLimitExceededError";
  }
}

export class ApiKeyService {
  constructor(
    private readonly repository: TenantApiKeyRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  static hashKey(plainTextKey: string): string {
    return createHash("sha256").update(plainTextKey).digest("hex");
  }

  static generatePlainTextKey(): string {
    return `ak_${randomBytes(24).toString("base64url")}`;
  }

  static toKeyPrefix(plainTextKey: string): string {
    return plainTextKey.slice(0, 12);
  }

  async createKey(input: {
    tenantId: string;
    keyName: string;
    createdBy?: string;
    expiresAt?: Date | null;
  }): Promise<CreatedApiKey> {
    const activeCount = await this.repository.countActiveByTenant(input.tenantId);
    if (activeCount >= MAX_ACTIVE_API_KEYS) {
      throw new ApiKeyLimitExceededError();
    }

    const createdAt = this.now();
    const plainTextKey = ApiKeyService.generatePlainTextKey();
    const keyHash = ApiKeyService.hashKey(plainTextKey);
    const keyPrefix = ApiKeyService.toKeyPrefix(plainTextKey);

    const record = await this.repository.create({
      tenantId: input.tenantId,
      keyName: input.keyName,
      keyPrefix,
      keyHash,
      createdBy: input.createdBy,
      expiresAt: input.expiresAt ?? null,
      createdAt,
    });

    return {
      id: record.id,
      tenantId: record.tenantId,
      keyName: record.keyName,
      keyPrefix: record.keyPrefix,
      plainTextKey,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
    };
  }

  async listKeys(tenantId: string): Promise<TenantApiKeyRecord[]> {
    return this.repository.listByTenant(tenantId);
  }

  async revokeKey(tenantId: string, keyId: string): Promise<boolean> {
    return this.repository.revoke(tenantId, keyId, this.now());
  }

  async revokeAllForTenant(tenantId: string): Promise<number> {
    return this.repository.revokeAllByTenant(tenantId, this.now());
  }

  async authenticate(rawKey: string, tenantId?: string): Promise<ApiKeyAuthResult | null> {
    if (!rawKey || !rawKey.startsWith("ak_")) {
      return null;
    }

    const keyHash = ApiKeyService.hashKey(rawKey);
    const record = await this.repository.findByHash(keyHash, tenantId);
    if (!record) {
      return null;
    }

    const now = this.now();
    if (record.revokedAt) {
      return null;
    }
    if (record.expiresAt && record.expiresAt.getTime() <= now.getTime()) {
      return null;
    }

    await this.repository.touchUsage(record.id, now);

    return {
      keyId: record.id,
      tenantId: record.tenantId,
      principalId: record.id,
      rateLimitRpm: API_KEY_RATE_LIMIT_RPM,
    };
  }
}
