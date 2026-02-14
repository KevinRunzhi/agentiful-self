/**
 * Shared DTOs for S2-3 execution tracking and persistence views.
 */

export type RunType = "workflow" | "agent" | "generation";
export type RunStatus = "pending" | "running" | "completed" | "failed" | "stopped";
export type DataSyncStatus = "pending" | "syncing" | "completed" | "failed";
export type DataSyncTrigger = "auto" | "user" | "admin";
export type PromptInjectionAction = "log" | "alert" | "block";

export interface CitationPayloadDto {
  id: string;
  title: string;
  snippet: string;
  url?: string;
  score?: number;
  documentName?: string;
}

export interface RunSummaryDto {
  id: string;
  tenantId: string;
  userId: string;
  appId: string;
  appName?: string | null;
  appStatus?: string | null;
  conversationId?: string | null;
  type: RunType;
  status: RunStatus;
  traceId: string;
  model?: string | null;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  error?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  updatedAt: string;
}

export interface RunStepDto {
  id: string;
  runId: string;
  stepIndex: number;
  nodeId: string;
  nodeType: string;
  title?: string | null;
  status: RunStatus | "pending";
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  error?: string | null;
  startedAt: string;
  finishedAt?: string | null;
}

export interface RunDetailDto extends RunSummaryDto {
  steps: RunStepDto[];
}

export interface DataSyncResultDto {
  id: string;
  status: DataSyncStatus;
  triggeredBy: DataSyncTrigger;
  degraded: boolean;
  message?: string;
  updatedAt: string;
}
