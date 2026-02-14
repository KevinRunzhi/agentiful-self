import { createHmac } from "node:crypto";

export const SUPPORTED_WEBHOOK_EVENTS = [
  "user.created",
  "user.deleted",
  "user.status_changed",
  "conversation.created",
  "conversation.completed",
  "run.completed",
  "run.failed",
  "quota.threshold_reached",
  "quota.exceeded",
  "security.injection_detected",
  "security.compliance_blocked",
] as const;

export type SupportedWebhookEvent = (typeof SUPPORTED_WEBHOOK_EVENTS)[number];

export interface TenantWebhookConfig {
  enabled: boolean;
  url: string;
  signingSecret: string;
  subscribedEvents: string[];
}

export interface WebhookDeliveryLogRepository {
  insert(input: {
    tenantId: string;
    eventType: string;
    endpoint: string;
    payload: Record<string, unknown>;
    signature: string;
    attempt: number;
    status: "delivered" | "failed";
    responseCode?: number;
    responseTimeMs?: number;
    errorMessage?: string;
    scheduledAt: Date;
    deliveredAt?: Date;
    traceId?: string;
  }): Promise<void>;
}

export interface WebhookHttpClient {
  post(
    url: string,
    body: string,
    headers: Record<string, string>
  ): Promise<{ statusCode: number; responseTimeMs?: number }>;
}

export interface WebhookFailureNotifier {
  notifyAdmin(input: {
    tenantId: string;
    eventType: string;
    endpoint: string;
    attempts: number;
    traceId?: string;
  }): Promise<void>;
}

export interface WebhookDispatchResult {
  delivered: boolean;
  attempts: number;
  firstAttemptLatencyMs: number;
  lastStatusCode?: number;
}

const RETRY_DELAYS_MS = [0, 10_000, 30_000, 90_000];

export function buildWebhookSignature(secret: string, timestamp: string, payload: string): string {
  const digest = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `sha256=${digest}`;
}

export class WebhookEngine {
  constructor(
    private readonly deliveryLogRepository: WebhookDeliveryLogRepository,
    private readonly httpClient: WebhookHttpClient,
    private readonly notifier?: WebhookFailureNotifier,
    private readonly now: () => Date = () => new Date()
  ) {}

  async dispatch(input: {
    tenantId: string;
    eventType: string;
    payload: Record<string, unknown>;
    config: TenantWebhookConfig;
    traceId?: string;
    occurredAt?: Date;
  }): Promise<WebhookDispatchResult> {
    if (!input.config.enabled || !input.config.url) {
      return {
        delivered: false,
        attempts: 0,
        firstAttemptLatencyMs: 0,
      };
    }

    if (!input.config.subscribedEvents.includes(input.eventType)) {
      return {
        delivered: false,
        attempts: 0,
        firstAttemptLatencyMs: 0,
      };
    }

    const occurredAt = input.occurredAt ?? this.now();
    const payloadText = JSON.stringify(input.payload);
    const firstAttemptLatencyMs = RETRY_DELAYS_MS[0];

    let attempts = 0;
    let lastStatusCode: number | undefined;

    for (let index = 0; index < RETRY_DELAYS_MS.length; index += 1) {
      const delayMs = RETRY_DELAYS_MS[index];
      const scheduledAt = new Date(occurredAt.getTime() + delayMs);
      const timestamp = scheduledAt.toISOString();
      const signature = buildWebhookSignature(input.config.signingSecret, timestamp, payloadText);

      attempts += 1;

      try {
        const response = await this.httpClient.post(input.config.url, payloadText, {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Timestamp": timestamp,
          "X-Webhook-Event": input.eventType,
          "X-Webhook-Attempt": String(attempts),
        });

        lastStatusCode = response.statusCode;
        const isSuccess = response.statusCode >= 200 && response.statusCode < 300;

        await this.deliveryLogRepository.insert({
          tenantId: input.tenantId,
          eventType: input.eventType,
          endpoint: input.config.url,
          payload: input.payload,
          signature,
          attempt: attempts,
          status: isSuccess ? "delivered" : "failed",
          responseCode: response.statusCode,
          responseTimeMs: response.responseTimeMs,
          scheduledAt,
          deliveredAt: isSuccess ? this.now() : undefined,
          traceId: input.traceId,
        });

        if (isSuccess) {
          return {
            delivered: true,
            attempts,
            firstAttemptLatencyMs,
            lastStatusCode,
          };
        }
      } catch (error) {
        await this.deliveryLogRepository.insert({
          tenantId: input.tenantId,
          eventType: input.eventType,
          endpoint: input.config.url,
          payload: input.payload,
          signature,
          attempt: attempts,
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "unknown_error",
          scheduledAt,
          traceId: input.traceId,
        });
      }
    }

    if (this.notifier) {
      await this.notifier.notifyAdmin({
        tenantId: input.tenantId,
        eventType: input.eventType,
        endpoint: input.config.url,
        attempts,
        traceId: input.traceId,
      });
    }

    return {
      delivered: false,
      attempts,
      firstAttemptLatencyMs,
      lastStatusCode,
    };
  }
}
