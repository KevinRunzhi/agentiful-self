/**
 * Pino Structured Logger
 *
 * JSON-based logging with trace ID support
 */

import pino from "pino";

/**
 * Log levels
 */
export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

/**
 * Create Pino logger instance
 */
export const logger = pino({
  level: (process.env.LOG_LEVEL as LogLevel) || "info",
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  base: {
    env: process.env.NODE_ENV || "development",
  },
  // Pretty print in development
  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss.l",
            ignore: "pid,hostname,env",
          },
        }
      : undefined,
});

/**
 * Create child logger with trace context
 */
export function createLoggerWithTrace(traceId: string, context?: Record<string, unknown>) {
  return logger.child({ traceId, ...context });
}

/**
 * Create child logger with tenant context
 */
export function createLoggerWithTenant(traceId: string, tenantId: string, userId?: string) {
  return logger.child({
    traceId,
    tenantId,
    ...(userId && { userId }),
  });
}
