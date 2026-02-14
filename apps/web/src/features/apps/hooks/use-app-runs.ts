import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchRunDetail, fetchRuns } from "../api";
import type { RunDetail, RunSummary } from "../types";

const RUN_POLL_INTERVAL_MS = 3000;

export interface UseAppRunsResult {
  runs: RunSummary[];
  selectedRun: RunDetail | null;
  isLoading: boolean;
  isDetailLoading: boolean;
  error: string | null;
  selectRun: (runId: string) => void;
  refresh: () => void;
}

export function useAppRuns(appId: string | null, enabled: boolean): UseAppRunsResult {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => {
    setRefreshToken((prev) => prev + 1);
  }, []);

  const selectRun = useCallback((runId: string) => {
    setIsDetailLoading(true);
    setError(null);

    void fetchRunDetail(runId)
      .then((detail) => {
        setSelectedRun(detail);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load run detail");
      })
      .finally(() => {
        setIsDetailLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!appId || !enabled) {
      setRuns([]);
      setSelectedRun(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const runItems = await fetchRuns({
          appId,
          signal: controller.signal,
        });
        if (!cancelled) {
          setRuns(runItems);
        }
      } catch (err) {
        if (!cancelled && !controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to load runs");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    const timer = setInterval(() => {
      void load();
    }, RUN_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [appId, enabled, refreshToken]);

  useEffect(() => {
    if (!selectedRun) {
      return;
    }

    const updated = runs.find((runItem) => runItem.id === selectedRun.id);
    if (!updated) {
      return;
    }

    if (updated.updatedAt !== selectedRun.updatedAt || updated.status !== selectedRun.status) {
      void fetchRunDetail(selectedRun.id)
        .then((detail) => {
          setSelectedRun(detail);
        })
        .catch(() => {
          // Keep current details if refresh fails.
        });
    }
  }, [runs, selectedRun]);

  return useMemo(
    () => ({
      runs,
      selectedRun,
      isLoading,
      isDetailLoading,
      error,
      selectRun,
      refresh,
    }),
    [error, isDetailLoading, isLoading, refresh, runs, selectRun, selectedRun]
  );
}
