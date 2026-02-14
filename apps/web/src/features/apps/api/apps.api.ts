import type {
  AccessibleApp,
  AccessibleAppsResponsePayload,
  AppsCategory,
  RunDetail,
  RunDetailResponsePayload,
  RunsResponsePayload,
  RunSummary,
  WorkbenchView,
} from "../types";

export interface FetchAccessibleAppsInput {
  view: WorkbenchView;
  query?: string;
  category?: AppsCategory;
  signal?: AbortSignal;
}

export interface FetchAccessibleAppsResult {
  items: AccessibleApp[];
  nextCursor: string | null;
}

export interface MarkRecentUseResult {
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface FetchRunsInput {
  appId: string;
  signal?: AbortSignal;
}

interface ApiErrorPayload {
  errors?: Array<{
    code?: string;
    message?: string;
  }>;
  error?: {
    code?: string;
    message?: string;
  };
}

function normalizeItems(payload: AccessibleAppsResponsePayload): AccessibleApp[] {
  return payload.data?.items ?? payload.data?.apps ?? [];
}

function normalizeRunItems(payload: RunsResponsePayload): RunSummary[] {
  return payload.data?.items ?? [];
}

function normalizeError(payload: ApiErrorPayload): {
  code: string;
  message: string;
} {
  const firstError = payload.errors?.[0];
  const code = firstError?.code ?? payload.error?.code ?? "APP_WORKBENCH_ERROR";
  const message = firstError?.message ?? payload.error?.message ?? "Request failed";
  return { code, message };
}

export async function fetchAccessibleApps(
  input: FetchAccessibleAppsInput
): Promise<FetchAccessibleAppsResult> {
  const params = new URLSearchParams({
    view: input.view,
  });

  if (input.query?.trim()) {
    params.set("q", input.query.trim());
  }

  if (input.category && input.category !== "all") {
    params.set("category", input.category);
  }

  const response = await fetch(`/api/rbac/apps/accessible?${params.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    ...(input.signal ? { signal: input.signal } : {}),
  });

  const payload = (await response.json()) as AccessibleAppsResponsePayload;
  if (!response.ok) {
    const error = normalizeError(payload);
    throw new Error(error.message);
  }

  return {
    items: normalizeItems(payload),
    nextCursor: payload.data?.nextCursor ?? null,
  };
}

export async function toggleFavorite(appId: string, isFavorite: boolean): Promise<void> {
  const method = isFavorite ? "DELETE" : "POST";
  const response = await fetch(`/api/rbac/apps/${appId}/favorite`, { method });

  if (response.ok) {
    return;
  }

  let message = "Failed to update favorite";
  try {
    const payload = (await response.json()) as AccessibleAppsResponsePayload;
    message = normalizeError(payload).message;
  } catch {
    // Keep fallback message when payload is not JSON.
  }

  throw new Error(message);
}

export async function markRecentUse(appId: string): Promise<MarkRecentUseResult> {
  const response = await fetch(`/api/rbac/apps/${appId}/recent-use`, {
    method: "POST",
  });

  if (response.ok) {
    return { ok: true };
  }

  try {
    const payload = (await response.json()) as AccessibleAppsResponsePayload;
    const normalized = normalizeError(payload);
    return {
      ok: false,
      errorCode: normalized.code,
      errorMessage: normalized.message,
    };
  } catch {
    return {
      ok: false,
      errorCode: "APP_WORKBENCH_ERROR",
      errorMessage: "Failed to start conversation",
    };
  }
}

export async function fetchRuns(input: FetchRunsInput): Promise<RunSummary[]> {
  const params = new URLSearchParams({ appId: input.appId });
  const response = await fetch(`/v1/runs?${params.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    ...(input.signal ? { signal: input.signal } : {}),
  });

  const payload = (await response.json()) as RunsResponsePayload;
  if (!response.ok) {
    const error = normalizeError(payload);
    throw new Error(error.message);
  }

  return normalizeRunItems(payload);
}

export async function fetchRunDetail(runId: string, signal?: AbortSignal): Promise<RunDetail> {
  const response = await fetch(`/v1/runs/${runId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    ...(signal ? { signal } : {}),
  });

  const payload = (await response.json()) as RunDetailResponsePayload;
  if (!response.ok || !payload.data) {
    const error = normalizeError(payload);
    throw new Error(error.message);
  }

  return payload.data;
}
