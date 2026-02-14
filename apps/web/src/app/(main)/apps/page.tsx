"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AppWorkbenchCard,
  AppsSearchFilters,
  AppsViewTabs,
} from "../../../features/apps/components";
import {
  useAppFavorites,
  useAppRecent,
  useAppsWorkbench,
} from "../../../features/apps/hooks";

const DEGRADED_CODES = new Set([
  "quota_guard_degraded_deny_new",
  "quota_service_unavailable",
]);

export default function AppsPage() {
  const [degraded, setDegraded] = useState(false);
  const {
    view,
    setView,
    query,
    setQuery,
    category,
    setCategory,
    apps,
    isLoading,
    error: loadError,
    patchApp,
  } = useAppsWorkbench();
  const {
    toggleFavorite,
    isPending: isFavoritePending,
    error: favoriteError,
  } = useAppFavorites();
  const {
    markRecentUse,
    isPending: isRecentPending,
    error: recentError,
  } = useAppRecent();

  const onToggleFavorite = useCallback(
    (appId: string, isFavorite: boolean | undefined) => {
      void toggleFavorite(appId, isFavorite, (nextValue) => {
        patchApp(appId, { isFavorite: nextValue });
      });
    },
    [patchApp, toggleFavorite]
  );

  const onNewConversation = useCallback(
    async (appId: string) => {
      if (degraded) {
        return;
      }

      const result = await markRecentUse(appId, () => {
        patchApp(appId, { lastUsedAt: new Date().toISOString() });
      });

      if (!result.ok && result.errorCode && DEGRADED_CODES.has(result.errorCode)) {
        setDegraded(true);
      }
    },
    [degraded, markRecentUse, patchApp]
  );

  const error = useMemo(
    () => loadError ?? favoriteError ?? recentError,
    [favoriteError, loadError, recentError]
  );

  return (
    <main className="container mx-auto py-8 space-y-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold">Apps</h1>
        <p className="text-sm text-muted-foreground">
          Discover authorized apps, manage favorites, and continue recent work.
        </p>
      </section>

      {degraded ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Quota service is degraded. App browsing remains available, but new conversations are disabled.
        </section>
      ) : null}

      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <AppsViewTabs value={view} onChange={setView} />
        <AppsSearchFilters
          query={query}
          onQueryChange={setQuery}
          category={category}
          onCategoryChange={setCategory}
        />
      </section>

      {isLoading ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-36 rounded-lg border bg-muted/40 animate-pulse" />
          ))}
        </section>
      ) : null}

      {!isLoading && error ? (
        <section className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </section>
      ) : null}

      {!isLoading && !error && apps.length === 0 ? (
        <section className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No apps found for this view.
        </section>
      ) : null}

      {!isLoading && !error && apps.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {apps.map((app) => (
            <AppWorkbenchCard
              key={app.id}
              app={app}
              degraded={degraded}
              favoritePending={isFavoritePending(app.id)}
              recentPending={isRecentPending(app.id)}
              onToggleFavorite={onToggleFavorite}
              onNewConversation={(appId) => void onNewConversation(appId)}
            />
          ))}
        </section>
      ) : null}
    </main>
  );
}
