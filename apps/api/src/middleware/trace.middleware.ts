/**
 * Trace ID Propagation Middleware
 *
 * Ensures trace ID is present on all requests for observability
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { randomUUID } from "node:crypto";

/**
 * Extract or generate trace ID from request
 */
export function getTraceId(request: FastifyRequest): string {
  // Check x-trace-id header first
  let traceId = request.headers["x-trace-id"] as string;

  // Fall back to x-request-id
  if (!traceId) {
    traceId = request.headers["x-request-id"] as string;
  }

  // Generate new UUID if none exists
  if (!traceId || traceId === "undefined" || traceId === "unknown") {
    traceId = randomUUID();
  }

  return traceId;
}

/**
 * Trace ID propagation middleware
 */
export async function traceMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const traceId = getTraceId(request);

  // Set trace ID in headers for response
  reply.header("x-trace-id", traceId);

  // Store in request context
  (request as any).traceId = traceId;

  // Also set in request id for Fastify logger
  request.id = traceId;
}

/**
 * Create child logger with trace context
 */
export function createTraceLogger(request: FastifyRequest) {
  const traceId = (request as any).traceId || getTraceId(request);
  const tenantId = (request as any).tenantId;
  const userId = (request as any).userId;

  return request.log.child({ traceId, tenantId, userId });
}
