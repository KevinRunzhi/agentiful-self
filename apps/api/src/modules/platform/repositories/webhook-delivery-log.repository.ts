import { getDatabase } from "@agentifui/db/client";
import { webhookDeliveryLog } from "@agentifui/db/schema";
import type { WebhookDeliveryLogRepository } from "../services/webhook-engine.service.js";

export class DrizzleWebhookDeliveryLogRepository implements WebhookDeliveryLogRepository {
  async insert(input: {
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
  }): Promise<void> {
    const db = getDatabase();
    await db.insert(webhookDeliveryLog).values({
      tenantId: input.tenantId,
      eventType: input.eventType,
      endpoint: input.endpoint,
      payload: input.payload,
      signature: input.signature,
      attempt: input.attempt,
      status: input.status,
      responseCode: input.responseCode,
      responseTimeMs: input.responseTimeMs,
      errorMessage: input.errorMessage,
      scheduledAt: input.scheduledAt,
      deliveredAt: input.deliveredAt,
      traceId: input.traceId,
      createdAt: new Date(),
    });
  }
}

export function createWebhookDeliveryLogRepository(): WebhookDeliveryLogRepository {
  return new DrizzleWebhookDeliveryLogRepository();
}
