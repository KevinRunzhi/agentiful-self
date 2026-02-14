import { useCallback, useEffect, useState } from "react";
import { fetchAccessibleApps } from "../api";
import type { AccessibleApp, AppsCategory, WorkbenchView } from "../types";

export interface UseAppsWorkbenchResult {
  view: WorkbenchView;
  setView: (next: WorkbenchView) => void;
  query: string;
  setQuery: (next: string) => void;
  category: AppsCategory;
  setCategory: (next: AppsCategory) => void;
  apps: AccessibleApp[];
  isLoading: boolean;
  error: string | null;
  patchApp: (appId: string, updates: Partial<AccessibleApp>) => void;
  refresh: () => void;
}

export function useAppsWorkbench(): UseAppsWorkbenchResult {
  const [view, setView] = useState<WorkbenchView>("all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<AppsCategory>("all");
  const [apps, setApps] = useState<AccessibleApp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => {
    setRefreshToken((prev) => prev + 1);
  }, []);

  const patchApp = useCallback((appId: string, updates: Partial<AccessibleApp>) => {
    setApps((prev) =>
      prev.map((appItem) =>
        appItem.id === appId
          ? {
              ...appItem,
              ...updates,
            }
          : appItem
      )
    );
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchAccessibleApps({
          view,
          query,
          category,
          signal: abortController.signal,
        });
        setApps(result.items);
      } catch (err) {
        if (abortController.signal.aborted) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load apps");
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [category, query, refreshToken, view]);

  return {
    view,
    setView,
    query,
    setQuery,
    category,
    setCategory,
    apps,
    isLoading,
    error,
    patchApp,
    refresh,
  };
}
