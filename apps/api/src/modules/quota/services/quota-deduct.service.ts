/**
 * Quota Deduct Service
 *
 * Writes usage ledger and increments counters for tenant/group/user scopes.
 */

import type { QuotaRepository } from "../repositories/quota.repository";
import type { QuotaAlertService } from "./quota-alert.service";

type QuotaScopeType = "tenant" | "group" | "user";
type QuotaMeteringMode = "token" | "request";

export interface QuotaDeductRequestDto {
  tenantId: string;
  groupId?: string | null;
  userId: string;
  appId: string;
  runId?: string | null;
  model?: string | null;
  meteringMode: QuotaMeteringMode;
  promptTokens?: number;
  completionTokens?: number;
  traceId?: string;
}

export interface QuotaDeductResponseDto {
  success: boolean;
  deductedValue: number;
}

interface PeriodRange {
  periodStart: Date;
  periodEnd: Date;
}

export class QuotaDeductExceededError extends Error {
  constructor(
    public readonly scope: QuotaScopeType,
    public readonly used: number,
    public readonly limit: number,
    public readonly resetsAt: Date
  ) {
    super(`Quota exceeded at ${scope} scope`);
    this.name = "QuotaDeductExceededError";
  }
}

export class QuotaDeductService {
  constructor(
    private readonly quotaRepository: QuotaRepository,
    private readonly quotaAlertService: QuotaAlertService
  ) {}

  async deduct(input: QuotaDeductRequestDto): Promise<QuotaDeductResponseDto> {
    const promptTokens = input.promptTokens ?? 0;
    const completionTokens = input.completionTokens ?? 0;
    const tokenTotal = Math.max(0, promptTokens + completionTokens);
    const deductedValue = input.meteringMode === "request" ? 1 : tokenTotal;

    const usageInput: {
      tenantId: string;
      groupId?: string | null;
      userId: string;
      appId: string;
      runId?: string | null;
      model?: string | null;
      meteringMode: QuotaMeteringMode;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      traceId?: string;
    } = {
      tenantId: input.tenantId,
      groupId: input.groupId ?? null,
      userId: input.userId,
      appId: input.appId,
      runId: input.runId ?? null,
      model: input.model ?? null,
      meteringMode: input.meteringMode,
      promptTokens,
      completionTokens,
      totalTokens: tokenTotal,
    };

    if (input.traceId) {
      usageInput.traceId = input.traceId;
    }

    const levels = this.buildLevels(input);

    for (const level of levels) {
      const policy = await this.quotaRepository.findActivePolicy(
        input.tenantId,
        level.scope,
        level.scopeId,
        input.meteringMode
      );

      if (!policy) {
        continue;
      }

      const range = this.getPeriodRange(policy.periodType);
      const counter = await this.quotaRepository.incrementCounterCapped(
        policy.id,
        range.periodStart,
        range.periodEnd,
        deductedValue,
        Number(policy.limitValue)
      );

      if (!counter) {
        const currentCounter = await this.quotaRepository.getCounter(policy.id, range.periodStart);
        const used = currentCounter ? Number(currentCounter.usedValue) : 0;
        throw new QuotaDeductExceededError(level.scope, used, Number(policy.limitValue), range.periodEnd);
      }

      const evaluateInput: {
        tenantId: string;
        policyId: string;
        scope: QuotaScopeType;
        scopeId: string;
        periodStart: Date;
        periodEnd: Date;
        usedValue: number;
        limitValue: number;
        alertThresholds: number[];
        userId: string;
        groupId?: string | null;
        appId: string;
        traceId?: string;
      } = {
        tenantId: input.tenantId,
        policyId: policy.id,
        scope: level.scope,
        scopeId: level.scopeId,
        periodStart: range.periodStart,
        periodEnd: range.periodEnd,
        usedValue: Number(counter.usedValue),
        limitValue: Number(policy.limitValue),
        alertThresholds: policy.alertThresholds,
        userId: input.userId,
        groupId: input.groupId ?? null,
        appId: input.appId,
      };

      if (input.traceId) {
        evaluateInput.traceId = input.traceId;
      }

      await this.quotaAlertService.evaluateAndRecord(evaluateInput);
    }

    await this.quotaRepository.insertUsageLedger(usageInput);

    return {
      success: true,
      deductedValue,
    };
  }

  private buildLevels(input: QuotaDeductRequestDto): Array<{ scope: QuotaScopeType; scopeId: string }> {
    const levels: Array<{ scope: QuotaScopeType; scopeId: string }> = [
      { scope: "user", scopeId: input.userId },
    ];

    if (input.groupId) {
      levels.push({ scope: "group", scopeId: input.groupId });
    }

    levels.push({ scope: "tenant", scopeId: input.tenantId });
    return levels;
  }

  private getPeriodRange(periodType: "month" | "week"): PeriodRange {
    const now = new Date();

    if (periodType === "week") {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const day = start.getUTCDay() || 7;
      start.setUTCDate(start.getUTCDate() - day + 1);

      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 7);
      return { periodStart: start, periodEnd: end };
    }

    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { periodStart: monthStart, periodEnd: monthEnd };
  }
}

export function createQuotaDeductService(
  quotaRepository: QuotaRepository,
  quotaAlertService: QuotaAlertService
): QuotaDeductService {
  return new QuotaDeductService(quotaRepository, quotaAlertService);
}
