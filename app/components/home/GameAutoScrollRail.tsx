"use client";

/**
 * N-col game batch carousel (default 3×3 pages).
 * Advances one full page at a time (no half-cut tiles).
 * Partial pages only render real tiles — height collapses to used rows.
 * Supports controlled page + slow auto-advance.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { GameDef } from "../../lib/home-catalog";
import GameTile from "./GameTile";

const ROWS = 3;
const COLS = 3;
/** Dwell time on each full batch (ms) */
const AUTO_MS = 4200;

interface Props {
  games: GameDef[];
  onOpen: (g: GameDef) => void;
  launchingId: string | null;
  paused?: boolean;
  cols?: number;
  rows?: number;
  /** Controlled page index (0-based) */
  page: number;
  onPageChange: (page: number) => void;
}

export default function GameAutoScrollRail({
  games,
  onOpen,
  launchingId,
  paused = false,
  cols = COLS,
  rows = ROWS,
  page,
  onPageChange,
}: Props) {
  const pageSize = rows * cols;
  const pages = useMemo(() => {
    if (!games.length) return [] as GameDef[][];
    const out: GameDef[][] = [];
    for (let i = 0; i < games.length; i += pageSize) {
      out.push(games.slice(i, i + pageSize));
    }
    return out;
  }, [games, pageSize]);

  const totalPages = Math.max(1, pages.length);
  const [userPaused, setUserPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  const safePage = Math.min(Math.max(0, page), totalPages - 1);

  const goTo = useCallback(
    (next: number) => {
      const target = ((next % totalPages) + totalPages) % totalPages;
      if (target === safePage) return;
      if (reduceMotion) {
        onPageChange(target);
        return;
      }
      setFade(false);
      window.setTimeout(() => {
        onPageChange(target);
        setFade(true);
      }, 160);
    },
    [safePage, totalPages, reduceMotion, onPageChange]
  );

  // Auto-advance whole batches
  useEffect(() => {
    if (totalPages <= 1 || paused || userPaused || reduceMotion) return;
    const id = window.setInterval(() => {
      goTo(safePage + 1);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [safePage, totalPages, paused, userPaused, reduceMotion, goTo]);

  if (!games.length) return null;

  const batch = pages[safePage] ?? [];
  // Only as many rows as this page actually needs (e.g. 3 games → 1 row, not 3 empty rows)
  const usedRows = Math.max(1, Math.ceil(batch.length / cols));

  return (
    <div
      className="home-game-batch"
      onMouseEnter={() => setUserPaused(true)}
      onMouseLeave={() => setUserPaused(false)}
      onTouchStart={() => setUserPaused(true)}
      onTouchEnd={() => {
        window.setTimeout(() => setUserPaused(false), 2200);
      }}
    >
      <div
        className={`grid gap-2 transition-opacity duration-200 ease-out ${
          cols === 2 ? "grid-cols-2" : "grid-cols-3"
        } ${fade ? "opacity-100" : "opacity-0"}`}
        style={{
          gridTemplateRows: `repeat(${usedRows}, minmax(0, auto))`,
        }}
      >
        {batch.map((g, i) => (
          <GameTile
            key={`${g.id}-p${safePage}-${i}`}
            game={g}
            onOpen={onOpen}
            loading={launchingId === g.id}
            variant="poster"
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-2.5 flex items-center justify-center gap-1.5">
          {pages.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Page ${i + 1}`}
              aria-current={i === safePage ? "true" : undefined}
              onClick={() => goTo(i)}
              className="h-1.5 rounded-full transition-all duration-200"
              style={{
                width: i === safePage ? 16 : 6,
                background:
                  i === safePage
                    ? "linear-gradient(90deg,#FED358,#E8A84A)"
                    : "rgba(255,255,255,0.18)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function gameBatchPageCount(gameCount: number, pageSize = ROWS * COLS) {
  return Math.max(1, Math.ceil(gameCount / pageSize));
}

export const GAME_BATCH_ROWS = ROWS;
export const GAME_BATCH_COLS = COLS;
export const GAME_BATCH_PAGE_SIZE = ROWS * COLS;
