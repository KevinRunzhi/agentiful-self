import { beforeEach, describe, expect, it } from "vitest";
import { createQuotaAlertService } from "../../src/modules/quota/services/quota-alert.service";
import { createQuotaCheckService } from "../../src/modules/quota/services/quota-check.service";
import { createQuotaDeductService } from "../../src/modules/quota/services/quota-deduct.service";

type ScopeType = "tenant" | "group" | "user";
type MeteringMode = "token" | "request";

interface PolicyRecord {
  id: string;
  tenantId: string;
  scopeType: ScopeType;
  scopeId: string;
  metricType: MeteringMode;
  periodType: "month" | "week";
  limitValue: number;
  alertThresholds: number[];
  isActive: boolean;
}

function currentMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function nextMonthStart(from: Date): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
}

class InMemoryQuotaRepository {
  policies = new Map<string, PolicyRecord>();
  counters = new Map<string, { usedValue: number; version: number; periodEnd: Date }>();
  ledger: Array<{
    tenantId: string;
    groupId: string | null;
    userId: string;
    appId: string;
    totalTokens: number;
    meteringMode: MeteringMode;
  }> = [];
  alertEvents = new Set<string>();

  private counterKey(policyId: string, periodStart: Date): string {
    return `${policyId}:${periodStart.toISOString()}`;
  }

  async findActivePolicy(
    tenantId: string,
    scopeType: ScopeType,
    scopeId: string,
    meteringMode: MeteringMode
  ) {
    const match = [...this.policies.values()].find(
      (policy) =>
        policy.tenantId === tenantId &&
        policy.scopeType === scopeType &&
        policy.scopeId === scopeId &&
        policy.metricType === meteringMode &&
        policy.isActive
    );
    return match ?? null;
  }

  async getCounter(policyId: string, periodStart: Date) {
    const key = this.counterKey(policyId, periodStart);
    const counter = this.counters.get(key);
    if (!counter) {
      return null;
    }

    return {
      id: key,
      policyId,
      periodStart,
      periodEnd: counter.periodEnd,
      usedValue: counter.usedValue,
      version: counter.version,
    };
  }

  async incrementCounter(
    policyId: string,
    periodStart: Date,
    periodEnd: Date,
    incrementBy: number
  ) {
    const key = this.counterKey(policyId, periodStart);
    const current = this.counters.get(key) ?? {
      usedValue: 0,
      version: 0,
      periodEnd,
    };

    const next = {
      usedValue: current.usedValue + incrementBy,
      version: current.version + 1,
      periodEnd,
    };

    this.counters.set(key, next);

    return {
      id: key,
      policyId,
      periodStart,
      periodEnd,
      usedValue: next.usedValue,
      version: next.version,
    };
  }

  async incrementCounterCapped(
    policyId: string,
    periodStart: Date,
    periodEnd: Date,
    incrementBy: number,
    limitValue: number
  ) {
    const key = this.counterKey(policyId, periodStart);
    const current = this.counters.get(key) ?? {
      usedValue: 0,
      version: 0,
      periodEnd,
    };

    const nextUsed = current.usedValue + incrementBy;
    if (nextUsed > limitValue) {
      return null;
    }

    const next = {
      usedValue: nextUsed,
      version: current.version + 1,
      periodEnd,
    };

    this.counters.set(key, next);

    return {
      id: key,
      policyId,
      periodStart,
      periodEnd,
      usedValue: next.usedValue,
      version: next.version,
    };
  }

  async insertUsageLedger(input: {
    tenantId: string;
    groupId?: string | null;
    userId: string;
    appId: string;
    meteringMode: MeteringMode;
    totalTokens: number;
  }) {
    this.ledger.push({
      tenantId: input.tenantId,
      groupId: input.groupId ?? null,
      userId: input.userId,
      appId: input.appId,
      totalTokens: input.totalTokens,
      meteringMode: input.meteringMode,
    });
  }

  async insertAlertEventIfAbsent(input: {
    policyId: string;
    periodStart: Date;
    threshold: number;
  }) {
    const key = `${input.policyId}:${input.periodStart.toISOString()}:${input.threshold}`;
    if (this.alertEvents.has(key)) {
      return false;
    }

    this.alertEvents.add(key);
    return true;
  }
}

describe("T031 [US2] quota 3-level enforcement", () => {
  const tenantId = "tenant-1";
  const groupId = "group-1";
  const userId = "user-1";
  const monthStart = currentMonthStart();
  const monthEnd = nextMonthStart(monthStart);

  let repository: InMemoryQuotaRepository;

  beforeEach(() => {
    repository = new InMemoryQuotaRepository();

    repository.policies.set("tenant-policy", {
      id: "tenant-policy",
      tenantId,
      scopeType: "tenant",
      scopeId: tenantId,
      metricType: "token",
      periodType: "month",
      limitValue: 1000,
      alertThresholds: [80, 90, 100],
      isActive: true,
    });
    repository.policies.set("group-policy", {
      id: "group-policy",
      tenantId,
      scopeType: "group",
      scopeId: groupId,
      metricType: "token",
      periodType: "month",
      limitValue: 100,
      alertThresholds: [80, 90, 100],
      isActive: true,
    });
    repository.policies.set("user-policy", {
      id: "user-policy",
      tenantId,
      scopeType: "user",
      scopeId: userId,
      metricType: "token",
      periodType: "month",
      limitValue: 50,
      alertThresholds: [80, 90, 100],
      isActive: true,
    });
  });

  it("blocks request when group scope exceeds remaining quota", async () => {
    repository.counters.set(`tenant-policy:${monthStart.toISOString()}`, {
      usedValue: 400,
      version: 1,
      periodEnd: monthEnd,
    });
    repository.counters.set(`group-policy:${monthStart.toISOString()}`, {
      usedValue: 95,
      version: 1,
      periodEnd: monthEnd,
    });
    repository.counters.set(`user-policy:${monthStart.toISOString()}`, {
      usedValue: 10,
      version: 1,
      periodEnd: monthEnd,
    });

    const quotaCheckService = createQuotaCheckService(repository as any);

    const result = await quotaCheckService.check({
      tenantId,
      groupId,
      userId,
      appId: "app-1",
      meteringMode: "token",
      estimatedUsage: 10,
    });

    expect(result.allowed).toBe(false);
    expect(result.exceededScope).toBe("group");
  });

  it("blocks request when user scope exceeds remaining quota", async () => {
    repository.counters.set(`tenant-policy:${monthStart.toISOString()}`, {
      usedValue: 400,
      version: 1,
      periodEnd: monthEnd,
    });
    repository.counters.set(`group-policy:${monthStart.toISOString()}`, {
      usedValue: 60,
      version: 1,
      periodEnd: monthEnd,
    });
    repository.counters.set(`user-policy:${monthStart.toISOString()}`, {
      usedValue: 48,
      version: 1,
      periodEnd: monthEnd,
    });

    const quotaCheckService = createQuotaCheckService(repository as any);

    const result = await quotaCheckService.check({
      tenantId,
      groupId,
      userId,
      appId: "app-1",
      meteringMode: "token",
      estimatedUsage: 5,
    });

    expect(result.allowed).toBe(false);
    expect(result.exceededScope).toBe("user");
  });

  it("deducts usage across tenant/group/user counters and writes ledger", async () => {
    const quotaAlertService = createQuotaAlertService(repository as any);
    const quotaDeductService = createQuotaDeductService(repository as any, quotaAlertService);

    await quotaDeductService.deduct({
      tenantId,
      groupId,
      userId,
      appId: "app-1",
      meteringMode: "token",
      promptTokens: 20,
      completionTokens: 30,
      traceId: "trace-1",
    });

    const tenantCounter = repository.counters.get(`tenant-policy:${monthStart.toISOString()}`);
    const groupCounter = repository.counters.get(`group-policy:${monthStart.toISOString()}`);
    const userCounter = repository.counters.get(`user-policy:${monthStart.toISOString()}`);

    expect(tenantCounter?.usedValue).toBe(50);
    expect(groupCounter?.usedValue).toBe(50);
    expect(userCounter?.usedValue).toBe(50);
    expect(repository.ledger).toHaveLength(1);
    expect(repository.ledger[0]).toMatchObject({
      tenantId,
      groupId,
      userId,
      appId: "app-1",
      totalTokens: 50,
      meteringMode: "token",
    });
  });
});
