/**
 * Shared platform-management types (S3-3)
 */

import type { TenantConfig, TenantStatus } from "./tenant.js";

export interface TenantLifecycleCreateInput {
  name: string;
  slug: string;
  adminEmail: string;
  plan?: "free" | "pro" | "enterprise";
  customConfig?: TenantConfig;
}

export interface TenantLifecycleResult {
  tenantId: string;
  slug: string;
  status: TenantStatus;
  readyInMs: number;
  scheduledPurgeAt?: Date;
}

export interface TenantApiKeySummary {
  id: string;
  tenantId: string;
  keyName: string;
  keyPrefix: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  usageCount: number;
  createdAt: Date;
}

export interface CreatedTenantApiKey {
  id: string;
  tenantId: string;
  keyName: string;
  keyPrefix: string;
  plainTextKey: string;
  expiresAt: Date | null;
  createdAt: Date;
}

export type SupportedWebhookEventType =
  | "user.created"
  | "user.deleted"
  | "user.status_changed"
  | "conversation.created"
  | "conversation.completed"
  | "run.completed"
  | "run.failed"
  | "quota.threshold_reached"
  | "quota.exceeded"
  | "security.injection_detected"
  | "security.compliance_blocked";

export interface WebhookDispatchResult {
  delivered: boolean;
  attempts: number;
  firstAttemptLatencyMs: number;
  lastStatusCode?: number;
}

export type AnnouncementScopeType = "platform" | "tenant";
export type AnnouncementDisplayType = "banner" | "modal";
export type AnnouncementStatus = "draft" | "published" | "ended";

export interface AnnouncementView {
  id: string;
  scopeType: AnnouncementScopeType;
  tenantId: string | null;
  title: string;
  content: string;
  displayType: AnnouncementDisplayType;
  status: AnnouncementStatus;
  isPinned: boolean;
  publishedAt: Date | null;
  expiresAt: Date | null;
}

export interface OpenApiAuthContext {
  tenantId: string;
  principalId: string;
  authType: "api_key" | "oauth2";
  rateLimitRpm: number;
}
