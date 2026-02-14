import { useCallback, useState } from "react";
import { markRecentUse as markRecentUseApi } from "../api";

const DEGRADE_ERROR_CODES = new Set([
  "quota_guard_degraded_deny_new",
  "quota_service_unavailable",
]);

export interface UseAppRecentResult {
  markRecentUse: (
    appId: string,
    onApplied?: () => void
  ) => Promise<{
    ok: boolean;
    errorCode?: string;
  }>;
  isPending: (appId: string) => boolean;
  error: string | null;
}

export function useAppRecent(): UseAppRecentResult {
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const isPending = useCallback((appId: string) => pendingIds.has(appId), [pendingIds]);

  const markRecentUse = useCallback(
    async (
      appId: string,
      onApplied?: () => void
    ): Promise<{
      ok: boolean;
      errorCode?: string;
    }> => {
      setError(null);
      setPendingIds((prev) => new Set(prev).add(appId));

      try {
        const result = await markRecentUseApi(appId);
        if (result.ok) {
          onApplied?.();
          return { ok: true };
        }

        if (!result.errorCode || !DEGRADE_ERROR_CODES.has(result.errorCode)) {
          setError(result.errorMessage ?? "Failed to start conversation");
        }

        if (result.errorCode) {
          return { ok: false, errorCode: result.errorCode };
        }
        return { ok: false };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start conversation");
        return { ok: false, errorCode: "APP_WORKBENCH_ERROR" };
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(appId);
          return next;
        });
      }
    },
    []
  );

  return {
    markRecentUse,
    isPending,
    error,
  };
}
