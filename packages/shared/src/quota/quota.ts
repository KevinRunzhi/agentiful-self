/**
 * Shared DTOs for S1-3 quota check, deduction, and alerts.
 */

export type QuotaScopeType = "tenant" | "group" | "user";
export type QuotaMeteringMode = "token" | "request";
export type QuotaPeriodType = "month" | "week";

export interface QuotaLimitStateDto {
  scope: QuotaScopeType;
  scopeId: string;
  limit: number;
  used: number;
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

export interface QuotaAlertEventDto {
  tenantId: string;
  policyId: string;
  scope: QuotaScopeType;
  threshold: number;
  usedValue: number;
  limitValue: number;
  periodStart: string;
  traceId?: string;
}

export interface QuotaExceededErrorDto {
  type: "permission_denied";
  code: "quota_exceeded";
  message: string;
  trace_id?: string;
  level?: QuotaScopeType | "unknown";
  current?: number | null;
  limit?: number | null;
  resetsAt?: string | null;
}
