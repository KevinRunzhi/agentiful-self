/**
 * Quota Alert Dedupe Store
 *
 * Provides a Redis-first dedupe strategy with in-memory fallback.
 */

import Redis from "ioredis";

export interface QuotaAlertDedupeStore {
  setIfAbsent(key: string, ttlSeconds: number): Promise<boolean>;
}

class InMemoryQuotaAlertDedupeStore implements QuotaAlertDedupeStore {
  private readonly records = new Map<string, number>();

  async setIfAbsent(key: string, ttlSeconds: number): Promise<boolean> {
    const now = Date.now();
    const expiresAt = this.records.get(key);
    if (typeof expiresAt === "number" && expiresAt > now) {
      return false;
    }

    const ttl = Math.max(1, ttlSeconds);
    this.records.set(key, now + ttl * 1000);
    return true;
  }
}

class RedisQuotaAlertDedupeStore implements QuotaAlertDedupeStore {
  private readonly memoryFallback = new InMemoryQuotaAlertDedupeStore();
  private readonly client: Redis;

  constructor(url: string) {
    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
  }

  async setIfAbsent(key: string, ttlSeconds: number): Promise<boolean> {
    const ttl = Math.max(1, ttlSeconds);

    try {
      if (this.client.status === "wait") {
        await this.client.connect();
      }

      const response = await this.client.set(key, "1", "EX", ttl, "NX");
      return response === "OK";
    } catch {
      return this.memoryFallback.setIfAbsent(key, ttl);
    }
  }
}

let dedupeStoreSingleton: QuotaAlertDedupeStore | null = null;

export function createQuotaAlertDedupeStore(): QuotaAlertDedupeStore {
  if (dedupeStoreSingleton) {
    return dedupeStoreSingleton;
  }

  const redisUrl = process.env["REDIS_URL"];
  if (redisUrl) {
    dedupeStoreSingleton = new RedisQuotaAlertDedupeStore(redisUrl);
    return dedupeStoreSingleton;
  }

  dedupeStoreSingleton = new InMemoryQuotaAlertDedupeStore();
  return dedupeStoreSingleton;
}
