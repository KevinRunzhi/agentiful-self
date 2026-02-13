/**
 * Account Lockout Service
 *
 * Handles account lockout after too many failed login attempts
 */

import Redis from "ioredis";

/**
 * Lockout configuration
 */
const LOCKOUT_CONFIG = {
  maxAttempts: 5,
  lockoutDurationMinutes: 30,
  windowMinutes: 15, // Time window for counting attempts
};

/**
 * Redis key prefixes
 */
const REDIS_KEYS = {
  attempts: "login_attempts",
  lockout: "account_lockout",
};

/**
 * Get Redis client
 */
function getRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  // Singleton Redis client
  if (!(global as any).redisClient) {
    (global as any).redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
    });
  }

  return (global as any).redisClient as Redis;
}

/**
 * Get Redis key for login attempts
 */
function getAttemptsKey(email: string): string {
  // Normalize email for consistent keys
  const normalizedEmail = email.toLowerCase().trim();
  return `${REDIS_KEYS.attempts}:${normalizedEmail}`;
}

/**
 * Get Redis key for account lockout
 */
function getLockoutKey(email: string): string {
  const normalizedEmail = email.toLowerCase().trim();
  return `${REDIS_KEYS.lockout}:${normalizedEmail}`;
}

/**
 * Record failed login attempt
 */
export async function recordFailedAttempt(email: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    console.warn("Redis not available, skipping lockout tracking");
    return;
  }

  const key = getAttemptsKey(email);
  const ttl = LOCKOUT_CONFIG.windowMinutes * 60;

  // Increment counter
  const attempts = await redis.incr(key);

  // Set expiry on first attempt
  if (attempts === 1) {
    await redis.expire(key, ttl);
  }

  // Check if should lock out
  if (attempts >= LOCKOUT_CONFIG.maxAttempts) {
    await lockAccount(email);
  }
}

/**
 * Check if account is locked
 */
export async function isLocked(email: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;

  const key = getLockoutKey(email);
  const exists = await redis.exists(key);

  return exists === 1;
}

/**
 * Get remaining lockout time in seconds
 */
export async function getLockoutTimeRemaining(email: string): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return 0;

  const key = getLockoutKey(email);
  const ttl = await redis.ttl(key);

  return ttl > 0 ? ttl : 0;
}

/**
 * Lock account
 */
async function lockAccount(email: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  const key = getLockoutKey(email);
  const ttl = LOCKOUT_CONFIG.lockoutDurationMinutes * 60;

  await redis.set(key, "1", "EX", ttl);
}

/**
 * Clear lockout (e.g., after successful login or password reset)
 */
export async function clearLockout(email: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  // Clear attempts
  const attemptsKey = getAttemptsKey(email);
  await redis.del(attemptsKey);

  // Clear lockout
  const lockoutKey = getLockoutKey(email);
  await redis.del(lockoutKey);
}

/**
 * Get remaining attempts before lockout
 */
export async function getRemainingAttempts(email: string): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return LOCKOUT_CONFIG.maxAttempts;

  const key = getAttemptsKey(email);
  const attempts = await redis.get(key);

  const currentAttempts = attempts ? parseInt(attempts, 10) : 0;
  return Math.max(0, LOCKOUT_CONFIG.maxAttempts - currentAttempts);
}

/**
 * Reset account lockout (admin action)
 */
export async function resetLockout(email: string): Promise<void> {
  await clearLockout(email);
}
