import type { FastifyInstance } from "fastify";
import { registerAdminAuditRoutes } from "./admin-audit.routes.js";
import { registerAdminSecurityRoutes } from "./admin-security.routes.js";
import { registerAdminAnalyticsRoutes } from "./admin-analytics.routes.js";
import { registerAdminCostRoutes } from "./admin-cost.routes.js";

export async function registerComplianceRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(registerAdminAuditRoutes, { prefix: "/admin" });
  await fastify.register(registerAdminSecurityRoutes, { prefix: "/admin" });
  await fastify.register(registerAdminAnalyticsRoutes, { prefix: "/admin" });
  await fastify.register(registerAdminCostRoutes, { prefix: "/admin" });
}

export {
  registerAdminAuditRoutes,
  registerAdminSecurityRoutes,
  registerAdminAnalyticsRoutes,
  registerAdminCostRoutes,
};
