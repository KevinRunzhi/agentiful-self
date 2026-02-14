import { describe, expect, it } from "vitest";
import {
  WebhookEngine,
  buildWebhookSignature,
} from "../../src/modules/platform/services/webhook-engine.service";

class InMemoryWebhookLogRepository {
  public readonly rows: Array<Record<string, unknown>> = [];

  async insert(input: Record<string, unknown>): Promise<void> {
    this.rows.push(input);
  }
}

describe("WebhookEngine", () => {
  it("delivers on first attempt and records signature", async () => {
    const logRepository = new InMemoryWebhookLogRepository();
    const httpClient = {
      post: async () => ({ statusCode: 202, responseTimeMs: 120 }),
    };

    const engine = new WebhookEngine(logRepository as any, httpClient as any);
    const result = await engine.dispatch({
      tenantId: "tenant-1",
      eventType: "run.completed",
      payload: { runId: "run-1" },
      config: {
        enabled: true,
        url: "https://example.com/webhook",
        signingSecret: "secret",
        subscribedEvents: ["run.completed"],
      },
      occurredAt: new Date("2026-02-14T00:00:00.000Z"),
      traceId: "trace-1",
    });

    expect(result.delivered).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.firstAttemptLatencyMs).toBeLessThanOrEqual(30_000);
    expect(logRepository.rows).toHaveLength(1);
    expect(logRepository.rows[0]["status"]).toBe("delivered");
    expect(String(logRepository.rows[0]["signature"]).startsWith("sha256=")).toBe(true);
  });

  it("retries three times and notifies admin on total failure", async () => {
    const logRepository = new InMemoryWebhookLogRepository();
    const notified: Array<Record<string, unknown>> = [];
    const httpClient = {
      post: async () => ({ statusCode: 500, responseTimeMs: 50 }),
    };
    const notifier = {
      notifyAdmin: async (input: Record<string, unknown>) => {
        notified.push(input);
      },
    };

    const engine = new WebhookEngine(logRepository as any, httpClient as any, notifier as any);
    const result = await engine.dispatch({
      tenantId: "tenant-1",
      eventType: "quota.exceeded",
      payload: { threshold: 100 },
      config: {
        enabled: true,
        url: "https://example.com/webhook",
        signingSecret: "secret",
        subscribedEvents: ["quota.exceeded"],
      },
    });

    expect(result.delivered).toBe(false);
    expect(result.attempts).toBe(4);
    expect(logRepository.rows).toHaveLength(4);
    expect(logRepository.rows.every((row) => row["status"] === "failed")).toBe(true);
    expect(notified).toHaveLength(1);
  });

  it("generates deterministic HMAC signature", () => {
    const signature = buildWebhookSignature(
      "secret",
      "2026-02-14T00:00:00.000Z",
      JSON.stringify({ foo: "bar" })
    );
    expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(signature).toBe(
      "sha256=284be15431bc7a2cbc78c463ea99c99060ff2829e32e8c25548396e990337a87"
    );
  });
});
