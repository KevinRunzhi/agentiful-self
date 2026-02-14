/**
 * API Server Entry Point
 *
 * Main server file with plugin and route registration
 */

import { createApp, startServer, gracefulShutdown } from "./app.js";
import { getDatabase } from "@agentifui/db/client";
import { registerTracingPlugin } from "./plugins/tracing.plugin.js";
import { registerCorsPlugin } from "./plugins/cors.plugin.js";
import { registerHelmetPlugin } from "./plugins/helmet.plugin.js";
import { registerRateLimitPlugin } from "./plugins/rate-limit.plugin.js";
import { traceMiddleware } from "./middleware/trace.middleware.js";
import { tenantMiddleware } from "./middleware/tenant.middleware.js";
import { auditMiddleware } from "./middleware/audit.middleware.js";
import { quotaGuardMiddleware } from "./middleware/quota-guard.js";
import { registerAuthRoutes } from "./modules/auth/routes/index.js";
import { registerTenantRoutes } from "./modules/tenant/routes/index.js";
import { registerGroupRoutes } from "./modules/group/routes/index.js";
import { registerSSORoutes } from "./modules/sso/routes/index.js";
import { registerUserRoutes } from "./modules/user/routes/index.js";
import { rbacRoutes } from "./modules/rbac/routes/index.js";
import { registerNotificationRoutes } from "./modules/notifications/routes/index.js";
import { createNotificationService } from "./modules/notifications/services/notification.service.js";
import { registerQuotaRoutes } from "./modules/quota/routes/index.js";
import { registerChatExecutionRoutes } from "./modules/quota/routes/chat-execution.routes.js";
import { createQuotaRepository } from "./modules/quota/repositories/quota.repository.js";
import { registerConversationRoutes } from "./modules/conversation/routes/index.js";

/**
 * Bootstrap and start the application
 */
async function main() {
  const app = await createApp();
  let notificationCleanupTimer: NodeJS.Timeout | null = null;
  let quotaCounterCleanupTimer: NodeJS.Timeout | null = null;

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

  // Quota degradation guard for execution entrypoints
  app.addHook("preHandler", quotaGuardMiddleware);

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

  // RBAC & app access routes
  await app.register(rbacRoutes, { prefix: "/api/rbac" });

  // In-app notifications
  await app.register(registerNotificationRoutes, { prefix: "/api" });

  // Internal quota routes
  await app.register(registerQuotaRoutes, { prefix: "/internal/quota" });

  // OpenAI-compatible execution entry
  await app.register(registerChatExecutionRoutes, { prefix: "/v1" });

  // S2-2 conversation routes
  await app.register(registerConversationRoutes, { prefix: "/api/v1" });

  // Notification retention cleanup (90 days)
  try {
    const notificationService = createNotificationService(getDatabase() as any);
    notificationCleanupTimer = setInterval(() => {
      const cutoff = new Date();
      cutoff.setUTCDate(cutoff.getUTCDate() - 90);
      void notificationService.deleteOld(cutoff).catch(() => {
        // Ignore cleanup failures.
      });
    }, 6 * 60 * 60 * 1000);
  } catch {
    // Ignore cleanup scheduler bootstrap failures.
  }

  // Quota period rollover maintenance (hourly)
  try {
    const quotaRepository = createQuotaRepository(getDatabase() as any);
    const runQuotaCounterCleanup = () => {
      void quotaRepository.cleanupExpiredCounters(new Date()).catch(() => {
        // Ignore maintenance cleanup failures.
      });
    };

    runQuotaCounterCleanup();
    quotaCounterCleanupTimer = setInterval(runQuotaCounterCleanup, 60 * 60 * 1000);
  } catch {
    // Ignore quota maintenance scheduler bootstrap failures.
  }

  // ========================================
  // Start Server
  // ========================================

  await startServer(app);

  // ========================================
  // Graceful Shutdown
  // ========================================

  const shutdown = async () => {
    if (notificationCleanupTimer) {
      clearInterval(notificationCleanupTimer);
    }
    if (quotaCounterCleanupTimer) {
      clearInterval(quotaCounterCleanupTimer);
    }
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
