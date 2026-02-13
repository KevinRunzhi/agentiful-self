/**
 * Redis Client
 *
 * Redis connection and utilities for caching and Pub/Sub.
 * Used by RBAC permission service for caching (TTL 5s) and cache invalidation.
 */

import { createClient, type RedisClientType } from 'redis';

// =============================================================================
// Configuration
// =============================================================================

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const PERMISSION_CACHE_TTL = parseInt(
  process.env.PERMISSION_CACHE_TTL || '5000',
  10
);

// =============================================================================
// Redis Client
// =============================================================================

let redisClient: RedisClientType | null = null;
let isConnected = false;

export async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient && isConnected) {
    return redisClient;
  }

  if (!redisClient) {
    redisClient = createClient({
      url: REDIS_URL,
      password: REDIS_PASSWORD,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Redis reconnection failed after 10 attempts');
            return new Error('Redis reconnection failed');
          }
          return retries * 100; // Exponential backoff
        },
      },
    }) as RedisClientType;

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
      isConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('Redis Client connected');
      isConnected = true;
    });

    redisClient.on('disconnect', () => {
      console.log('Redis Client disconnected');
      isConnected = false;
    });
  }

  if (!isConnected) {
    await redisClient.connect();
  }

  return redisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (redisClient && isConnected) {
    await redisClient.quit();
    isConnected = false;
    redisClient = null;
  }
}

// =============================================================================
// Permission Cache Operations
// =============================================================================

/**
 * Cache key format for permission cache: perm:{userId}:{tenantId}
 */
export function getPermissionCacheKey(userId: string, tenantId: string): string {
  return `perm:${userId}:${tenantId}`;
}

/**
 * Get cached permission data for a user.
 */
export async function getCachedPermissions(
  userId: string,
  tenantId: string
): Promise<any | null> {
  try {
    const client = await getRedisClient();
    const key = getPermissionCacheKey(userId, tenantId);
    const data = await client.get(key);

    if (data) {
      return JSON.parse(data);
    }

    return null;
  } catch (error) {
    console.error('Error getting cached permissions:', error);
    return null;
  }
}

/**
 * Cache permission data for a user with TTL.
 */
export async function setCachedPermissions(
  userId: string,
  tenantId: string,
  data: any
): Promise<void> {
  try {
    const client = await getRedisClient();
    const key = getPermissionCacheKey(userId, tenantId);
    const value = JSON.stringify(data);

    await client.setEx(key, PERMISSION_CACHE_TTL / 1000, value);
  } catch (error) {
    console.error('Error setting cached permissions:', error);
  }
}

/**
 * Invalidate cached permission data for a user.
 */
export async function invalidateCachedPermissions(
  userId: string,
  tenantId: string
): Promise<void> {
  try {
    const client = await getRedisClient();
    const key = getPermissionCacheKey(userId, tenantId);
    await client.del(key);

    // Publish invalidation event for other instances
    await client.publish(
      'permission:invalidate',
      JSON.stringify({ userId, tenantId, timestamp: Date.now() })
    );
  } catch (error) {
    console.error('Error invalidating cached permissions:', error);
  }
}

/**
 * Invalidate all cached permissions for a user (all tenants).
 */
export async function invalidateAllUserPermissions(userId: string): Promise<void> {
  try {
    const client = await getRedisClient();
    const pattern = `perm:${userId}:*`;
    const keys = await client.keys(pattern);

    if (keys.length > 0) {
      await client.del(...keys);

      // Publish invalidation event
      await client.publish(
        'permission:invalidate:all',
        JSON.stringify({ userId, timestamp: Date.now() })
      );
    }
  } catch (error) {
    console.error('Error invalidating all user permissions:', error);
  }
}

// =============================================================================
// Pub/Sub for Cache Invalidation
// =============================================================================

/**
 * Subscribe to permission cache invalidation events.
 * This should be called once per application instance.
 */
export async function subscribeToInvalidationEvents(
  callback: (userId: string, tenantId: string) => void
): Promise<void> {
  try {
    const client = await getRedisClient();

    // Create a dedicated subscriber connection
    const subscriber = client.duplicate();

    await subscriber.connect();

    await subscriber.subscribe('permission:invalidate', (message) => {
      try {
        const data = JSON.parse(message);
        callback(data.userId, data.tenantId);
      } catch (error) {
        console.error('Error parsing invalidation message:', error);
      }
    });

    await subscriber.subscribe('permission:invalidate:all', (message) => {
      try {
        const data = JSON.parse(message);
        // Invalidate all permissions for this user from local cache
        const pattern = `perm:${data.userId}:*`;
        // Note: Redis keys() should not be used in production, but this is for pub/sub cleanup
        callback(data.userId, '*');
      } catch (error) {
        console.error('Error parsing invalidation:all message:', error);
      }
    });

    console.log('Subscribed to permission invalidation events');
  } catch (error) {
    console.error('Error subscribing to invalidation events:', error);
  }
}

// =============================================================================
// Health Check
// =============================================================================

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = await getRedisClient();
    await client.ping();
    return true;
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}

// =============================================================================
// Cache Stats
// =============================================================================

export async function getCacheStats(): Promise<{
  isConnected: boolean;
  permissionCacheKeys: number;
}> {
  try {
    const client = await getRedisClient();
    const keys = await client.keys('perm:*');

    return {
      isConnected,
      permissionCacheKeys: keys.length,
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return {
      isConnected: false,
      permissionCacheKeys: 0,
    };
  }
}

// =============================================================================
// Configuration Export
// =============================================================================

export const REDIS_CONFIG = {
  url: REDIS_URL,
  permissionCacheTTL: PERMISSION_CACHE_TTL,
} as const;
