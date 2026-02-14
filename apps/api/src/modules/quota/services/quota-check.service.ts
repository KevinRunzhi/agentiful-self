/**
 * Quota Check Service
 *
 * Applies three-level quota checks in fixed order:
 * user -> group -> tenant
 */

import type { QuotaRepository } from "../repositories/quota.repository";

type QuotaScopeType = "tenant" | "group" | "user";
type QuotaMeteringMode = "token" | "request";

export interface QuotaLimitStateDto {
  scope: QuotaScopeType;
  scopeId: string;
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
}

export interface QuotaCheckRequestDto {
  tenantId: string;
  groupId?: string | null;
  userId: string;
  appId?: string | null;
  meteringMode: QuotaMeteringMode;
  estimatedUsage: number;
  traceId?: string;
}

export interface QuotaCheckResponseDto {
  allowed: boolean;
  exceededScope?: QuotaScopeType;
  exceededDetail?: QuotaLimitStateDto;
  limits: QuotaLimitStateDto[];
}

interface PeriodRange {
  periodStart: Date;
  periodEnd: Date;
}

export class QuotaCheckService {
  constructor(private readonly quotaRepository: QuotaRepository) {}

  async check(input: QuotaCheckRequestDto): Promise<QuotaCheckResponseDto> {
    const levels = this.buildLevels(input);
    const limits: QuotaLimitStateDto[] = [];

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
      const counter = await this.quotaRepository.getCounter(policy.id, range.periodStart);

      const used = counter ? Number(counter.usedValue) : 0;
      const limit = Number(policy.limitValue);
      const remaining = Math.max(0, limit - used);

      limits.push({
        scope: level.scope,
        scopeId: level.scopeId,
        used,
        limit,
        remaining,
        resetsAt: range.periodEnd.toISOString(),
      });

      if (remaining < input.estimatedUsage) {
        return {
          allowed: false,
          exceededScope: level.scope,
          exceededDetail: {
            scope: level.scope,
            scopeId: level.scopeId,
            used,
            limit,
            remaining,
            resetsAt: range.periodEnd.toISOString(),
          },
          limits,
        };
      }
    }

    return {
      allowed: true,
      limits,
    };
  }

  private buildLevels(input: QuotaCheckRequestDto): Array<{ scope: QuotaScopeType; scopeId: string }> {
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

export function createQuotaCheckService(quotaRepository: QuotaRepository): QuotaCheckService {
  return new QuotaCheckService(quotaRepository);
}
