/**
 * Helmet Security Headers Plugin
 *
 * Security headers for HTTP responses
 */

import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import helmet from "@fastify/helmet";

/**
 * Helmet plugin for Fastify
 */
export const helmetPlugin: FastifyPluginAsync = fp(async (app) => {
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: null,
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    noSniff: true,
    xssFilter: true,
    // Disable cross-origin embedding protection for API
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });
});

export default helmetPlugin;
