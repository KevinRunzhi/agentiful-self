/**
 * Rate Limiting Plugin
 *
 * Redis-backed rate limiting for API endpoints
 */

import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import rateLimit from "@fastify/rate-limit";
import Redis from "ioredis";

/**
 * Redis client singleton
 */
let redisClient: Redis | null = null;

/**
 * Get or create Redis client
 */
function getRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });

    redisClient.on("error", (err) => {
      console.error("Redis connection error:", err);
    });
  }

  return redisClient;
}

/**
 * Rate limiting configuration for different endpoint types
 */
export interface RateLimitConfig {
  max: number;
  timeWindow: string; // Duration string like "1 minute"
  continueExceeding?: boolean;
  skipOnError?: boolean;
}

/**
 * Default rate limit configs
 */
export const RateLimitPresets: Record<string, RateLimitConfig> = {
  // Authentication endpoints - stricter limits
  auth: {
    max: 5,
    timeWindow: "1 minute",
  },
  // Password reset
  passwordReset: {
    max: 3,
    timeWindow: "15 minutes",
  },
  // Invitation endpoints
  invitation: {
    max: 10,
    timeWindow: "1 hour",
  },
  // General API endpoints
  api: {
    max: 100,
    timeWindow: "1 minute",
  },
  // Sensitive operations
  sensitive: {
    max: 10,
    timeWindow: "5 minutes",
  },
  // Public endpoints
  public: {
    max: 20,
    timeWindow: "1 minute",
  },
};

/**
 * Rate limiting plugin for Fastify
 */
export const rateLimitPlugin: FastifyPluginAsync = fp(async (app) => {
  const redis = getRedisClient();

  await app.register(rateLimit, {
    redis,
    max: 100, // Default: 100 requests
    timeWindow: "1 minute",
    cache: 10000, // Cache 10000 request counters
    allowList: ["127.0.0.1", "::1"], // Allow localhost
    continueExceeding: true,
    skipOnError: true, // Don't block if Redis fails
    keyGenerator: (request) => {
      // Use user ID if authenticated, otherwise IP
      return (request.user as any)?.userId || request.ip;
    },
    errorResponseBuilder: (request, context) => ({
      error: {
        message: "Too many requests",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter: context.after,
      },
    }),
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
    },
  });
});

/**
 * Create a rate limiter for specific routes
 */
export function createRateLimiter(config: RateLimitConfig) {
  return {
    config: {
      rateLimit: {
        max: config.max,
        timeWindow: config.timeWindow,
        continueExceeding: config.continueExceeding ?? true,
        skipOnError: config.skipOnError ?? true,
      },
    },
  };
}

export default rateLimitPlugin;
