import type { FastifyInstance } from "fastify";
import { quotaRoutes } from "./quota.routes.js";

export async function registerQuotaRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(quotaRoutes);
}
