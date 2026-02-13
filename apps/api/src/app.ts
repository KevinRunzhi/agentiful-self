/**
 * Fastify Application Base
 *
 * Main application entry point with plugin registration
 */

import Fastify, { FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { logger } from "./lib/logger.js";

// Application instance type
export type AppInstance = FastifyInstance;

/**
 * Create and configure Fastify application
 */
export async function createApp(): Promise<AppInstance> {
  const app: AppInstance = Fastify({
    logger,
    validatorCompiler,
    serializerCompiler,
    disableRequestLogging: true, // We'll use custom logging middleware
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "traceId",
    trustProxy: true,
  });

  // Global error handler
  app.setErrorHandler(async (error, request, reply) => {
    const traceId = (request.headers["x-request-id"] as string) || "unknown";

    app.log.error({
      traceId,
      error: error.message,
      stack: error.stack,
    }, "Unhandled error");

    // Don't expose internal errors in production
    const isDevelopment = process.env.NODE_ENV === "development";
    const statusCode = (error as any).statusCode || 500;

    reply.status(statusCode).send({
      error: {
        message: isDevelopment ? error.message : "An error occurred",
        code: (error as any).code || "INTERNAL_ERROR",
        traceId,
      },
    });
  });

  // 404 handler
  app.setNotFoundHandler(async (request, reply) => {
    const traceId = (request.headers["x-request-id"] as string) || "unknown";

    reply.status(404).send({
      error: {
        message: "Not found",
        code: "NOT_FOUND",
        traceId,
      },
    });
  });

  // Health check endpoint (no auth required)
  app.get("/health", async (request, reply) => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  // Readiness check
  app.get("/ready", async (request, reply) => {
    // TODO: Add database and redis checks
    return { status: "ready", timestamp: new Date().toISOString() };
  });

  return app;
}

/**
 * Start the application server
 */
export async function startServer(app: AppInstance): Promise<void> {
  const port = Number.parseInt(process.env.API_PORT || "3001", 10);
  const host = process.env.API_HOST || "0.0.0.0";

  try {
    await app.listen({ port, host });
    app.log.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
export async function gracefulShutdown(app: AppInstance): Promise<void> {
  app.log.info("Shutting down gracefully...");

  try {
    await app.close();
    app.log.info("Server closed");
  } catch (err) {
    app.log.error("Error during shutdown", err);
    process.exit(1);
  }
}
