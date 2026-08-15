"use client";

/**
 * React binding for the shared Inout catalog store.
 * All home sections call this — one fetch, shared state.
 * Retries when auth finishes / when previous load failed.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  ensureInoutCatalog,
  getInoutCatalogSnapshot,
  subscribeInoutCatalog,
} from "../lib/inout-catalog-store";
import {
  filterInoutForHomeCategory,
  mergeGameLists,
} from "../lib/inout-catalog";
import type { CategoryId, GameDef, HomeSectionDef } from "../lib/home-catalog";
import { getGame, resolveGames } from "../lib/home-catalog";
import { useAuthState } from "../context/AuthContext";

export function useInoutCatalog() {
  const { isLoggedIn, isLoading: authLoading } = useAuthState();

  const snap = useSyncExternalStore(
    subscribeInoutCatalog,
    getInoutCatalogSnapshot,
    getInoutCatalogSnapshot
  );

  // Load once auth bootstrap settles; re-run when login flips true
  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const run = (force = false) => {
      void ensureInoutCatalog(force).then((s) => {
        if (cancelled) return;
        // Auto-retry empty / error after short delay (public list should work)
        if (s.games.length === 0 && (s.status === "error" || s.status === "ready")) {
          retryTimer = setTimeout(() => {
            if (!cancelled) void ensureInoutCatalog(true);
          }, 4_000);
        }
      });
    };

    run(false);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [authLoading, isLoggedIn]);

  // Eager kick even before auth finishes (list is public now)
  useEffect(() => {
    void ensureInoutCatalog(false);
  }, []);

  const refresh = useCallback(async () => {
    await ensureInoutCatalog(true);
  }, []);

  const gamesForCategory = useCallback(
    (category: CategoryId, maxItems?: number) =>
      filterInoutForHomeCategory(snap.games, category, maxItems),
    [snap.games]
  );

  const resolveSectionGames = useCallback(
    (section: HomeSectionDef): GameDef[] => {
      const staticList = resolveGames({
        ...section,
        maxItems: undefined,
      });

      // First-party lottery only — never Inout
      if (section.kind === "lottery-grid" || section.gameCategory === "lottery") {
        return staticList;
      }

      /**
       * Full catalog in grids (no maxItems cap).
       * - Recommended: Win Go always first, then all popular Inout
       * - gameCategory: SPA tiles first, then all Inout for that rail
       * UI pages 3×3 batches via GameGridSection.
       */
      // Recommended / popular showcase — pin Win Go top-left (first tile)
      if (section.id === "recommended") {
        const wingo = getGame("wingo");
        const popular = filterInoutForHomeCategory(snap.games, "popular");
        const rest = popular.filter((g) => g.id !== "wingo" && g.id !== "lottery-wingo");
        const ordered = wingo ? [wingo, ...rest] : rest;
        if (section.maxItems != null && section.maxItems > 0) {
          return ordered.slice(0, section.maxItems);
        }
        return ordered;
      }

      const homeCat: CategoryId | undefined =
        section.gameCategory ??
        (section.gameIds?.length ? "popular" : undefined);

      if (!homeCat && !section.gameIds?.length) {
        return staticList;
      }

      const spa = staticList.filter((g) => g.action.type === "spa");
      const cat = homeCat ?? "popular";
      // All matching Inout games — no slice
      const apiList = filterInoutForHomeCategory(snap.games, cat);
      // Keep SPA (e.g. Win Go) ahead of third-party tiles
      const merged = mergeGameLists(spa, apiList);

      // Optional soft cap only if section explicitly sets maxItems
      if (section.maxItems != null && section.maxItems > 0) {
        return merged.slice(0, section.maxItems);
      }
      return merged;
    },
    [snap.games]
  );

  const loading =
    snap.status === "loading" ||
    (snap.status === "idle" && snap.games.length === 0) ||
    (authLoading && snap.games.length === 0);

  return useMemo(
    () => ({
      games: snap.games,
      raw: snap.raw,
      error: snap.error,
      status: snap.status,
      loading: loading && snap.games.length === 0,
      refreshing: snap.status === "loading" && snap.games.length > 0,
      gamesForCategory,
      resolveSectionGames,
      refresh,
    }),
    [
      snap.games,
      snap.raw,
      snap.error,
      snap.status,
      loading,
      gamesForCategory,
      resolveSectionGames,
      refresh,
    ]
  );
}
