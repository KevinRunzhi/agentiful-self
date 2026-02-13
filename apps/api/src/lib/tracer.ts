/**
 * Tracer Singleton
 *
 * OpenTelemetry tracer initialization
 */

import { trace } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";

let isInitialized = false;

/**
 * Get or create tracer instance
 */
export const tracer = trace.getTracer("agentiful-api");

/**
 * Initialize OpenTelemetry tracing
 */
export function initializeTracing() {
  if (isInitialized) return;

  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]:
        process.env.OTEL_SERVICE_NAME || "agentiful-api",
      [SemanticResourceAttributes.SERVICE_VERSION]:
        process.env.npm_package_version || "0.1.0",
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
        process.env.NODE_ENV || "development",
    }),
  });

  // Add OTLP exporter if endpoint is configured
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (otlpEndpoint) {
    provider.addSpanProcessor(
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: otlpEndpoint,
        })
      )
    );
  } else {
    // In development, use console exporter
    import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";
    provider.addSpanProcessor(new BatchSpanProcessor(new ConsoleSpanExporter()));
  }

  provider.register();
  isInitialized = true;
}
