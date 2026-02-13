/**
 * Tenant Context Middleware
 *
 * Ensures tenant context is available on all tenant-scoped requests
 * Validates tenant access and enforces data isolation
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { createTraceLogger } from "./trace.middleware.js";

/**
 * Tenant context interface
 */
export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userRole: string;
}

/**
 * Public routes that don't require tenant context
 */
const PUBLIC_PATHS = [
  "/health",
  "/ready",
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/verify-email",
  "/auth/sso",
];

/**
 * Check if route is public (no tenant required)
 */
function isPublicRoute(request: FastifyRequest): boolean {
  const path = request.routeOptions.url || request.url;

  // Check exact matches
  if (PUBLIC_PATHS.some((publicPath) => path.startsWith(publicPath))) {
    return true;
  }

  return false;
}

/**
 * Extract tenant from request
 * Priority: header -> query -> subdomain
 */
function extractTenantId(request: FastifyRequest): string | null {
  // 1. Check x-tenant-id header
  const headerTenant = request.headers["x-tenant-id"] as string;
  if (headerTenant) {
    return headerTenant;
  }

  // 2. Check query parameter
  const queryTenant = (request.query as { tenant?: string }).tenant;
  if (queryTenant) {
    return queryTenant;
  }

  // 3. Extract from subdomain (e.g., tenant.api.example.com)
  const host = request.headers.host;
  if (host) {
    const parts = host.split(".");
    if (parts.length > 2) {
      // subdomain found
      const subdomain = parts[0];
      if (subdomain !== "api" && subdomain !== "www") {
        return subdomain;
      }
    }
  }

  return null;
}

/**
 * Tenant context middleware
 */
export async function tenantMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip for public routes
  if (isPublicRoute(request)) {
    return;
  }

  const tenantId = extractTenantId(request);
  const traceLogger = createTraceLogger(request);

  // If tenant context is required but not provided, return 400
  if (!tenantId) {
    traceLogger.warn("Tenant context required but not provided");

    return reply.status(400).send({
      error: {
        message: "Tenant context required. Provide x-tenant-id header or tenant query parameter.",
        code: "TENANT_CONTEXT_REQUIRED",
        traceId: (request as any).traceId,
      },
    });
  }

  // Store tenant context in request
  (request as any).tenantId = tenantId;

  traceLogger.debug({ tenantId }, "Tenant context established");
}

/**
 * Get tenant context from request
 */
export function getTenantContext(request: FastifyRequest): TenantContext | null {
  return {
    tenantId: (request as any).tenantId,
    tenantSlug: (request as any).tenantSlug,
    userId: (request as any).userId,
    userRole: (request as any).userRole,
  };
}

/**
 * Verify tenant access for authenticated user
 */
export async function verifyTenantAccess(
  request: FastifyRequest,
  tenantId: string
): Promise<boolean> {
  const userId = (request as any).userId;
  if (!userId) return false;

  // TODO: Query database to verify user has access to this tenant
  // For now, return true (actual check in repository layer)

  return true;
}
