/**
 * Quota Alert Service
 *
 * Evaluates threshold crossings and records deduped alert events.
 */

import type { QuotaRepository } from "../repositories/quota.repository";
import type { QuotaAlertDedupeStore } from "./quota-alert-dedupe.store";

type QuotaScopeType = "tenant" | "group" | "user";

export interface EvaluateQuotaAlertsInput {
  tenantId: string;
  policyId: string;
  scope: QuotaScopeType;
  scopeId?: string;
  periodStart: Date;
  periodEnd?: Date;
  usedValue: number;
  limitValue: number;
  alertThresholds: number[];
  userId?: string;
  groupId?: string | null;
  appId?: string;
  traceId?: string;
}

export interface TriggeredQuotaAlertEvent {
  tenantId: string;
  policyId: string;
  scope: QuotaScopeType;
  scopeId?: string;
  threshold: number;
  usedValue: number;
  limitValue: number;
  periodStart: Date;
  periodEnd?: Date;
  userId?: string;
  groupId?: string | null;
  appId?: string;
  traceId?: string;
}

export interface QuotaAlertNotificationDispatcher {
  dispatch(event: TriggeredQuotaAlertEvent): Promise<void>;
}

export interface QuotaAlertAuditLogger {
  log(event: TriggeredQuotaAlertEvent): Promise<void>;
}

export interface QuotaAlertServiceOptions {
  dedupeStore?: QuotaAlertDedupeStore;
  notificationDispatcher?: QuotaAlertNotificationDispatcher;
  auditLogger?: QuotaAlertAuditLogger;
  now?: () => Date;
}

export class QuotaAlertService {
  constructor(
    private readonly quotaRepository: QuotaRepository,
    private readonly options: QuotaAlertServiceOptions = {}
  ) {}

  async evaluateAndRecord(input: EvaluateQuotaAlertsInput): Promise<number[]> {
    if (input.limitValue <= 0) {
      return [];
    }

    const now = this.options.now ? this.options.now() : new Date();
    const usagePercent = (input.usedValue / input.limitValue) * 100;
    const thresholds = this.normalizeThresholds(input.alertThresholds);
    const triggered: number[] = [];
    const periodEnd = this.resolvePeriodEnd(input, now);

    for (const threshold of thresholds) {
      if (usagePercent < threshold) {
        continue;
      }

      if (this.options.dedupeStore) {
        const dedupeKey = this.buildDedupeKey(input.policyId, input.periodStart, threshold);
        const dedupeTtl = this.computeDedupeTtlSeconds(periodEnd, now);
        const isFirstHit = await this.options.dedupeStore.setIfAbsent(dedupeKey, dedupeTtl);
        if (!isFirstHit) {
          continue;
        }
      }

      const eventInput: {
        tenantId: string;
        policyId: string;
        periodStart: Date;
        threshold: number;
        usedValue: number;
        limitValue: number;
        traceId?: string;
      } = {
        tenantId: input.tenantId,
        policyId: input.policyId,
        periodStart: input.periodStart,
        threshold,
        usedValue: input.usedValue,
        limitValue: input.limitValue,
      };

      if (input.traceId) {
        eventInput.traceId = input.traceId;
      }

      const inserted = await this.quotaRepository.insertAlertEventIfAbsent(eventInput);

      if (inserted) {
        triggered.push(threshold);

        const alertEvent: TriggeredQuotaAlertEvent = {
          tenantId: input.tenantId,
          policyId: input.policyId,
          scope: input.scope,
          scopeId: input.scopeId,
          threshold,
          usedValue: input.usedValue,
          limitValue: input.limitValue,
          periodStart: input.periodStart,
          periodEnd,
          userId: input.userId,
          groupId: input.groupId,
          appId: input.appId,
          traceId: input.traceId,
        };

        if (this.options.notificationDispatcher) {
          try {
            await this.options.notificationDispatcher.dispatch(alertEvent);
          } catch {
            // Do not fail quota deduction if alert notification dispatch fails.
          }
        }

        if (this.options.auditLogger) {
          try {
            await this.options.auditLogger.log(alertEvent);
          } catch {
            // Do not fail quota deduction if audit write fails.
          }
        }
      }
    }

    return triggered;
  }

  private normalizeThresholds(thresholds: number[]): number[] {
    const safeThresholds = thresholds
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v) && v > 0 && v <= 100);

    const fallback = safeThresholds.length > 0 ? safeThresholds : [80, 90, 100];
    return [...new Set(fallback)].sort((a, b) => a - b);
  }

  private resolvePeriodEnd(input: EvaluateQuotaAlertsInput, now: Date): Date {
    if (input.periodEnd) {
      return input.periodEnd;
    }

    const fallback = new Date(now);
    fallback.setUTCMinutes(fallback.getUTCMinutes() + 5);
    return fallback;
  }

  private computeDedupeTtlSeconds(periodEnd: Date, now: Date): number {
    const diffMs = periodEnd.getTime() - now.getTime();
    const rawTtl = Math.ceil(diffMs / 1000);
    return Math.max(60, rawTtl);
  }

  private buildDedupeKey(policyId: string, periodStart: Date, threshold: number): string {
    return `quota:alert:${policyId}:${periodStart.toISOString()}:${threshold}`;
  }
}

export function createQuotaAlertService(
  quotaRepository: QuotaRepository,
  options: QuotaAlertServiceOptions = {}
): QuotaAlertService {
  return new QuotaAlertService(quotaRepository, options);
}
