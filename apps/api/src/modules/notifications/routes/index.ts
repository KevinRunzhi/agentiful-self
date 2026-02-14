import type { FastifyInstance } from "fastify";
import { notificationRoutes } from "./notifications.routes.js";

export async function registerNotificationRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(notificationRoutes);
}
