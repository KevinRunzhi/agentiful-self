/**
 * Trace ID Propagation Middleware
 *
 * Ensures trace ID is present on all requests for observability
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { randomBytes } from "node:crypto";

/**
 * Extract or generate trace ID from request
 */
function randomHex(byteLength: number): string {
  return randomBytes(byteLength).toString("hex");
}

const TRACEPARENT_REGEX = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

function normalizeTraceId(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (/^[0-9a-f]{32}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^[0-9a-f-]{36}$/.test(trimmed)) {
    const noDash = trimmed.replaceAll("-", "");
    if (/^[0-9a-f]{32}$/.test(noDash)) {
      return noDash;
    }
  }
  return null;
}

function parseIncomingTraceparent(request: FastifyRequest): { traceId: string; traceparent: string } | null {
  const header = request.headers.traceparent;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  const matches = normalized.match(TRACEPARENT_REGEX);
  if (!matches) {
    return null;
  }

  const traceId = matches[1];
  const traceFlags = matches[3];
  const spanId = randomHex(8);

  return {
    traceId,
    traceparent: `00-${traceId}-${spanId}-${traceFlags}`,
  };
}

function resolveTraceIdFromHeaders(request: FastifyRequest): string | null {
  const headerValues = [
    request.headers["x-trace-id"],
    request.headers["x-request-id"],
  ];

  for (const headerValue of headerValues) {
    const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (!value || value === "undefined" || value === "unknown") {
      continue;
    }
    const normalized = normalizeTraceId(value);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function getTraceId(request: FastifyRequest): string {
  const incoming = parseIncomingTraceparent(request);
  if (incoming) {
    return incoming.traceId;
  }

  const headerTraceId = resolveTraceIdFromHeaders(request);
  if (headerTraceId) {
    return headerTraceId;
  }

  return randomHex(16);
}

function buildTraceparent(request: FastifyRequest, traceId: string): string {
  const incoming = parseIncomingTraceparent(request);
  if (incoming) {
    return incoming.traceparent;
  }

  const spanId = randomHex(8);
  return `00-${traceId}-${spanId}-01`;
}

/**
 * Trace ID propagation middleware
 */
export async function traceMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const traceId = getTraceId(request);
  const traceparent = buildTraceparent(request, traceId);

  // Set trace ID in headers for response
  reply.header("x-trace-id", traceId);
  reply.header("traceparent", traceparent);

  // Store in request context
  (request as any).traceId = traceId;
  (request as any).traceparent = traceparent;

  // Ensure downstream handlers always observe normalized trace headers.
  request.headers["x-trace-id"] = traceId;
  request.headers.traceparent = traceparent;

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
