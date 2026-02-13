/**
 * CORS Plugin
 *
 * Cross-Origin Resource Sharing configuration
 */

import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import cors from "@fastify/cors";

/**
 * CORS plugin for Fastify
 */
export const corsPlugin: FastifyPluginAsync = fp(async (app) => {
  await app.register(cors, {
    origin: (origin, callback) => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(",")
        : [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
          ];

      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      if (process.env.NODE_ENV === "production") {
        // In production, check against allowed origins
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"), false);
        }
      } else {
        // In development, allow all origins
        callback(null, true);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-request-id",
      "x-trace-id",
      "x-tenant-id",
    ],
    exposedHeaders: ["x-request-id", "x-trace-id"],
    maxAge: 86400, // 24 hours
  });
});

export default corsPlugin;
