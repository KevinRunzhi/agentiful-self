import { useCallback, useState } from "react";
import { toggleFavorite as toggleFavoriteApi } from "../api";

export interface UseAppFavoritesResult {
  toggleFavorite: (
    appId: string,
    isFavorite: boolean | undefined,
    onApplied?: (nextValue: boolean) => void
  ) => Promise<boolean>;
  isPending: (appId: string) => boolean;
  error: string | null;
}

export function useAppFavorites(): UseAppFavoritesResult {
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const isPending = useCallback((appId: string) => pendingIds.has(appId), [pendingIds]);

  const toggleFavorite = useCallback(
    async (
      appId: string,
      isFavorite: boolean | undefined,
      onApplied?: (nextValue: boolean) => void
    ): Promise<boolean> => {
      setError(null);
      setPendingIds((prev) => new Set(prev).add(appId));

      try {
        const currentValue = Boolean(isFavorite);
        await toggleFavoriteApi(appId, currentValue);
        onApplied?.(!currentValue);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update favorite");
        return false;
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
    toggleFavorite,
    isPending,
    error,
  };
}
