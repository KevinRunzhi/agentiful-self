/**
 * OpenTelemetry Tracing Plugin
 *
 * Distributed tracing with W3C trace context propagation
 */

import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { trace, context } from "@opentelemetry/api";
import { tracer } from "../lib/tracer.js";

/**
 * OpenTelemetry tracing plugin for Fastify
 */
export const tracingPlugin: FastifyPluginAsync = fp(async (app) => {
  const tracerInstance = tracer.getTracer("agentiful-api");

  // Add tracing to each request
  app.addHook("onRequest", async (request, reply) => {
    const span = tracerInstance.startSpan("http_request", {
      kind: 1, // SPAN_KIND_SERVER
      attributes: {
        "http.method": request.method,
        "http.url": request.url,
        "http.target": request.url,
        "http.host": request.headers.host,
        "http.user_agent": request.headers["user-agent"],
        "http.remote_addr": request.ip,
      },
    });

    // Store span in request context for later access
    (request.raw as any).span = span;

    // Extract or generate trace ID
    const traceId = context.active().traceId || request.id;
    request.headers["x-trace-id"] = traceId;
  });

  // End span when request completes
  app.addHook("onResponse", async (request, reply) => {
    const span = (request.raw as any).span;
    if (span) {
      span.setAttribute("http.status_code", reply.statusCode);
      span.setStatus({
        code: reply.statusCode >= 400 ? 2 : 1, // ERROR vs OK
        message: reply.statusCode.toString(),
      });
      span.end();
    }
  });

  // End span on error
  app.addHook("onError", async (request, reply, error) => {
    const span = (request.raw as any).span;
    if (span) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
      span.end();
    }
  });
});

export default tracingPlugin;
