/**
 * Module-level Inout catalog store.
 * - One network load for the full catalog (paginated under the hood)
 * - Concurrent callers share the same inflight Promise (no stampede)
 * - Soft-refresh after TTL without blocking UI
 * - Failed / empty loads are NOT sticky — next ensure() retries
 */

import * as api from "./api";
import type { InoutGame } from "./api";
import { inoutToGameDef } from "./inout-catalog";
import type { GameDef } from "./home-catalog";

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const ERROR_RETRY_MS = 8_000; // retry sooner after failure
const PAGE_LIMIT = 100;
const MAX_PAGES = 30;

export type InoutCatalogStatus = "idle" | "loading" | "ready" | "error";

export type InoutCatalogSnapshot = {
  raw: InoutGame[];
  games: GameDef[];
  fetchedAt: number;
  error: string | null;
  status: InoutCatalogStatus;
};

/** Stable empty snapshot — useSyncExternalStore requires stable getSnapshot refs */
const EMPTY_SNAPSHOT: InoutCatalogSnapshot = Object.freeze({
  raw: [],
  games: [],
  fetchedAt: 0,
  error: null,
  status: "idle" as const,
});

let snapshot: InoutCatalogSnapshot | null = null;
let inflight: Promise<InoutCatalogSnapshot> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function setSnapshot(next: InoutCatalogSnapshot) {
  snapshot = next;
  emit();
}

async function fetchAllPages(): Promise<InoutGame[]> {
  const all: InoutGame[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= MAX_PAGES) {
    const res = await api.getInoutGames({ page, limit: PAGE_LIMIT });
    const batch = Array.isArray(res.data) ? res.data : [];
    all.push(...batch);
    totalPages = Math.max(1, Number(res.totalPages ?? 1));
    if (batch.length === 0) break;
    page += 1;
  }

  return all;
}

function isFresh(s: InoutCatalogSnapshot): boolean {
  if (s.games.length === 0) return false;
  return Date.now() - s.fetchedAt < TTL_MS;
}

function canRetryAfterError(s: InoutCatalogSnapshot): boolean {
  if (s.status !== "error" && !(s.status === "ready" && s.games.length === 0)) {
    return false;
  }
  return Date.now() - s.fetchedAt >= ERROR_RETRY_MS;
}

async function load(force = false): Promise<InoutCatalogSnapshot> {
  if (!force && snapshot && isFresh(snapshot)) {
    return snapshot;
  }

  // After a recent error, wait a short backoff unless forced
  if (
    !force &&
    snapshot &&
    snapshot.status === "error" &&
    !canRetryAfterError(snapshot) &&
    inflight == null
  ) {
    return snapshot;
  }

  if (inflight) return inflight;

  // Mark loading (stable new object so subscribers re-render)
  setSnapshot({
    raw: snapshot?.raw ?? [],
    games: snapshot?.games ?? [],
    fetchedAt: snapshot?.fetchedAt ?? 0,
    error: null,
    status: "loading",
  });

  inflight = (async () => {
    try {
      const raw = await fetchAllPages();
      const games = raw.map(inoutToGameDef);
      const next: InoutCatalogSnapshot = {
        raw,
        games,
        fetchedAt: Date.now(),
        error: null,
        status: games.length > 0 ? "ready" : "error",
      };
      if (games.length === 0) {
        next.error = "No Inout games returned";
      }
      setSnapshot(next);
      return next;
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Failed to load Inout games";
      // Preserve previous good games if we had them before this attempt
      if (snapshot && snapshot.games.length > 0) {
        const kept: InoutCatalogSnapshot = {
          raw: snapshot.raw,
          games: snapshot.games,
          fetchedAt: Date.now(),
          error: message,
          status: "ready",
        };
        setSnapshot(kept);
        return kept;
      }
      const failed: InoutCatalogSnapshot = {
        raw: [],
        games: [],
        fetchedAt: Date.now(),
        error: message,
        status: "error",
      };
      setSnapshot(failed);
      return failed;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function subscribeInoutCatalog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getInoutCatalogSnapshot(): InoutCatalogSnapshot {
  return snapshot ?? EMPTY_SNAPSHOT;
}

/** Ensure catalog is loading / loaded. Safe to call many times. */
export function ensureInoutCatalog(force = false): Promise<InoutCatalogSnapshot> {
  return load(force);
}

export function invalidateInoutCatalog(): void {
  snapshot = null;
  inflight = null;
  emit();
}
