/**
 * SSO Domain Detection Service
 *
 * Detects SSO provider based on email domain with Redis caching
 */

import Redis from "ioredis";
import { ssoConfigRepository } from "../repositories/sso.repository";

/**
 * Cache key for SSO domain detection
 */
const DOMAIN_CACHE_KEY_PREFIX = "sso:domain:";
const DOMAIN_CACHE_TTL = 3600; // 1 hour

/**
 * Get Redis client
 */
function getRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  if (!(global as any).ssoRedisClient) {
    (global as any).ssoRedisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
    });
  }

  return (global as any).ssoRedisClient as Redis;
}

/**
 * Extract domain from email
 */
export function extractDomain(email: string): string | null {
  const match = email.toLowerCase().match(/@([^@]+)$/);
  return match ? match[1] : null;
}

/**
 * Detection result
 */
export interface SSODetectionResult {
  provider: string | null;
  tenantId: string | null;
  configId: string | null;
  jitProvisioning: boolean;
  jitAutoActivate: boolean;
}

/**
 * Detect SSO provider for email domain
 */
export async function detectSSOForEmail(email: string): Promise<SSODetectionResult> {
  const domain = extractDomain(email);
  if (!domain) {
    return {
      provider: null,
      tenantId: null,
      configId: null,
      jitProvisioning: false,
      jitAutoActivate: false,
    };
  }

  // Try Redis cache first
  const redis = getRedisClient();
  const cacheKey = `${DOMAIN_CACHE_KEY_PREFIX}${domain}`;

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Ignore cache errors
    }
  }

  // Query database for matching SSO configs
  const configs = await ssoConfigRepository.findByEmailDomain(domain);

  // Use first matching config
  const config = configs[0] || null;

  const result: SSODetectionResult = config
    ? {
        provider: config.provider,
        tenantId: config.tenantId,
        configId: config.id,
        jitProvisioning: config.jitProvisioning,
        jitAutoActivate: config.jitAutoActivate,
      }
    : {
        provider: null,
        tenantId: null,
        configId: null,
        jitProvisioning: false,
        jitAutoActivate: false,
      };

  // Cache the result
  if (redis && config) {
    try {
      await redis.set(cacheKey, JSON.stringify(result), "EX", DOMAIN_CACHE_TTL);
    } catch {
      // Ignore cache errors
    }
  }

  return result;
}

/**
 * Clear SSO domain cache for a specific domain
 */
export async function clearDomainCache(domain: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  const cacheKey = `${DOMAIN_CACHE_KEY_PREFIX}${domain}`;
  try {
    await redis.del(cacheKey);
  } catch {
    // Ignore errors
  }
}

/**
 * Invalidate all SSO domain caches
 */
export async function invalidateAllDomainCache(): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const keys = await redis.keys(`${DOMAIN_CACHE_KEY_PREFIX}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Ignore errors
  }
}
