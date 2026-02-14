/**
 * Shared Compliance and Governance Types (S3-2)
 */

import type {
  PIIMaskStrategy,
  SecurityAction,
  TenantSecurityPolicyConfig,
} from "./tenant.js";
import type { AuditEventCategory, AuditSeverity } from "./audit.js";

export interface AuditQueryInput {
  tenantId: string;
  actorUserId?: string;
  eventCategory?: AuditEventCategory;
  eventType?: string;
  targetType?: string;
  targetId?: string;
  result?: "success" | "failure" | "partial";
  severity?: AuditSeverity;
  startAt?: string;
  endAt?: string;
  limit?: number;
  cursor?: string;
}

export interface AuditQueryCursor {
  createdAt: string;
  id: string;
}

export interface AuditQueryOutput<TEvent = Record<string, unknown>> {
  items: TEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface AuditExportInput extends Omit<AuditQueryInput, "cursor" | "limit"> {
  format?: "csv" | "json";
  requesterUserId: string;
  requesterRole: "tenant_admin" | "root_admin";
  breakglassReason?: string;
}

export interface AuditExportResult {
  mode: "sync" | "async";
  format: "csv" | "json";
  itemCount: number;
  content?: string;
  jobId?: string;
  downloadPath?: string;
  expiresAt?: string;
}

export interface PIIDetection {
  type: "phone" | "email" | "id_card" | "bank_card" | "credit_card";
  value: string;
  start: number;
  end: number;
}

export interface PIIDetectionResult {
  detections: PIIDetection[];
  hitRate: number;
}

export interface PIIMaskingResult {
  strategy: PIIMaskStrategy;
  maskedText: string;
  maskedCount: number;
  detections: PIIDetection[];
}

export type OutputComplianceCategory =
  | "violence"
  | "hate"
  | "adult"
  | "political_cn"
  | "self_harm";

export interface OutputComplianceHit {
  category: OutputComplianceCategory;
  matchedKeyword: string;
}

export interface OutputComplianceResult {
  flagged: boolean;
  hits: OutputComplianceHit[];
  action: SecurityAction;
  blockedText?: string;
}

export interface SecurityPolicyPayload extends TenantSecurityPolicyConfig {}

export interface AnalyticsOverview {
  totalUsers: number;
  activeUsersDau: number;
  activeUsersMau: number;
  totalConversations: number;
  totalRuns: number;
  totalTokens: number;
  totalCostUsd: number;
}

export interface AnalyticsRankItem {
  id: string;
  label: string;
  requestCount: number;
  tokenCount: number;
  costUsd: number;
}

export interface AnalyticsTrendPoint {
  at: string;
  requestCount: number;
  tokenCount: number;
  costUsd: number;
}

export interface AnalyticsDashboard {
  overview: AnalyticsOverview;
  topUsers: AnalyticsRankItem[];
  appUsage: AnalyticsRankItem[];
  modelUsage: AnalyticsRankItem[];
  trend: AnalyticsTrendPoint[];
  refreshedAt: string;
}

export interface ModelPricingInput {
  tenantId: string;
  provider: string;
  model: string;
  inputPricePer1kUsd: number;
  outputPricePer1kUsd: number;
  effectiveFrom?: string;
}

export interface CostEstimateInput {
  tenantId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  usageAt?: string;
}

export interface CostEstimateResult {
  tenantId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  inputPricePer1kUsd: number;
  outputPricePer1kUsd: number;
  estimatedCostUsd: number;
  usageAt: string;
}
