import { describe, expect, it } from "vitest";
import { createQuotaAlertService } from "../../src/modules/quota/services/quota-alert.service";

class InMemoryAlertRepository {
  public readonly eventKeys = new Set<string>();

  async insertAlertEventIfAbsent(input: {
    policyId: string;
    periodStart: Date;
    threshold: number;
  }) {
    const key = `${input.policyId}:${input.periodStart.toISOString()}:${input.threshold}`;
    if (this.eventKeys.has(key)) {
      return false;
    }
    this.eventKeys.add(key);
    return true;
  }
}

class InMemoryDedupeStore {
  public readonly keys = new Map<string, number>();

  async setIfAbsent(key: string, ttlSeconds: number): Promise<boolean> {
    if (this.keys.has(key)) {
      return false;
    }
    this.keys.set(key, ttlSeconds);
    return true;
  }
}

describe("T037 [US3] quota alert dedupe and latency", () => {
  it("triggers 80/90 thresholds once and dedupes repeated evaluations", async () => {
    const repository = new InMemoryAlertRepository();
    const dedupeStore = new InMemoryDedupeStore();
    const notificationEvents: Array<{ threshold: number; at: number }> = [];
    const auditEvents: number[] = [];

    const startedAt = Date.now();

    const service = createQuotaAlertService(repository as any, {
      dedupeStore,
      notificationDispatcher: {
        dispatch: async (event) => {
          notificationEvents.push({ threshold: event.threshold, at: Date.now() });
        },
      },
      auditLogger: {
        log: async (event) => {
          auditEvents.push(event.threshold);
        },
      },
      now: () => new Date("2026-02-14T00:00:00.000Z"),
    });

    const first = await service.evaluateAndRecord({
      tenantId: "tenant-1",
      policyId: "policy-1",
      scope: "group",
      scopeId: "group-1",
      periodStart: new Date("2026-02-01T00:00:00.000Z"),
      periodEnd: new Date("2026-03-01T00:00:00.000Z"),
      usedValue: 95,
      limitValue: 100,
      alertThresholds: [80, 90, 100],
      userId: "user-1",
      groupId: "group-1",
      appId: "app-1",
      traceId: "trace-1",
    });

    const second = await service.evaluateAndRecord({
      tenantId: "tenant-1",
      policyId: "policy-1",
      scope: "group",
      scopeId: "group-1",
      periodStart: new Date("2026-02-01T00:00:00.000Z"),
      periodEnd: new Date("2026-03-01T00:00:00.000Z"),
      usedValue: 95,
      limitValue: 100,
      alertThresholds: [80, 90, 100],
      userId: "user-1",
      groupId: "group-1",
      appId: "app-1",
      traceId: "trace-2",
    });

    expect(first).toEqual([80, 90]);
    expect(second).toEqual([]);
    expect(notificationEvents.map((event) => event.threshold)).toEqual([80, 90]);
    expect(auditEvents).toEqual([80, 90]);

    // Alert dispatch in this flow is synchronous, far below 5 minutes.
    for (const event of notificationEvents) {
      expect(event.at - startedAt).toBeLessThan(300_000);
    }

    expect([...dedupeStore.keys.keys()]).toContain("quota:alert:policy-1:2026-02-01T00:00:00.000Z:80");
    expect([...dedupeStore.keys.keys()]).toContain("quota:alert:policy-1:2026-02-01T00:00:00.000Z:90");
  });
});

