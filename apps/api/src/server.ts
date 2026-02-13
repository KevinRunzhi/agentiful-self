/**
 * API Server Entry Point
 *
 * Main server file with plugin and route registration
 */

import { createApp, startServer, gracefulShutdown } from "./app.js";
import { registerTracingPlugin } from "./plugins/tracing.plugin.js";
import { registerCorsPlugin } from "./plugins/cors.plugin.js";
import { registerHelmetPlugin } from "./plugins/helmet.plugin.js";
import { registerRateLimitPlugin } from "./plugins/rate-limit.plugin.js";
import { traceMiddleware } from "./middleware/trace.middleware.js";
import { tenantMiddleware } from "./middleware/tenant.middleware.js";
import { auditMiddleware } from "./middleware/audit.middleware.js";
import { registerAuthRoutes } from "./modules/auth/routes/index.js";
import { registerTenantRoutes } from "./modules/tenant/routes/index.js";
import { registerGroupRoutes } from "./modules/group/routes/index.js";
import { registerSSORoutes } from "./modules/sso/routes/index.js";
import { registerUserRoutes } from "./modules/user/routes/index.js";

/**
 * Bootstrap and start the application
 */
async function main() {
  const app = await createApp();

  // ========================================
  // Register Plugins
  // ========================================

  await registerTracingPlugin(app);
  await registerCorsPlugin(app);
  await registerHelmetPlugin(app);
  await registerRateLimitPlugin(app);

  // ========================================
  // Register Global Middleware
  // ========================================

  // Trace ID generation and propagation
  app.addHook("onRequest", traceMiddleware);

  // Tenant context extraction
  app.addHook("onRequest", tenantMiddleware);

  // Audit logging for auth events
  app.addHook("onRequest", auditMiddleware);

  // ========================================
  // Register Routes
  // ========================================

  // Authentication routes
  await registerAuthRoutes(app);

  // Tenant management routes
  await registerTenantRoutes(app);

  // Group management routes
  await registerGroupRoutes(app);

  // SSO management routes
  await registerSSORoutes(app);

  // User management routes
  await registerUserRoutes(app);

  // ========================================
  // Start Server
  // ========================================

  await startServer(app);

  // ========================================
  // Graceful Shutdown
  // ========================================

  const shutdown = async () => {
    await gracefulShutdown(app);
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
