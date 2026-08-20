"use client";

import React, { useCallback, useEffect, useState } from "react";
import PageHeader from "../ui/PageHeader";
import LoadingSpinner from "../ui/LoadingSpinner";
import EmptyState from "../ui/EmptyState";
import * as api from "../../lib/api";
import type { GameHistoryItem } from "../../lib/api";
import BetHistoryCard from "../game/BetHistoryCard";
import { capHistoryPage, capHistoryPages } from "../../lib/history-pages";

interface Props {
  onBack: () => void;
}

const FILTERS = [
  { id: "", label: "All" },
  { id: "WINGO", label: "WinGo" },
  { id: "TRX_WINGO", label: "TRX" },
  { id: "K3", label: "K3" },
  { id: "FIVE_D", label: "5D" },
  { id: "MOTO", label: "Moto" },
  // Backend majorGameType enum is INOUT (third-party), not GREYTOP
  { id: "INOUT", label: "Other" },
];

export default function GameHistoryPage({ onBack }: Props) {
  const [items, setItems] = useState<GameHistoryItem[]>([]);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: number, major?: string) => {
    setLoading(true);
    try {
      const page = capHistoryPage(p);
      const res = await api.getGameHistory({
        page,
        limit: 20,
        majorGameType: major || undefined,
      });
      setItems(res.data ?? []);
      setTotalPages(capHistoryPages(res.totalPages));
      setPage(capHistoryPage(res.currentPage ?? page));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1, filter);
  }, [load, filter]);

  return (
    <div className="flex-1 flex flex-col min-h-screen pb-8" style={{ background: "#110D14" }}>
      <PageHeader title="Game history" onBack={onBack} />

      <div className="px-3 py-2 flex gap-1.5 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f.id || "all"}
            onClick={() => setFilter(f.id)}
            className="shrink-0 px-3 h-7 rounded-full text-[10px] font-bold"
            style={{
              background: filter === f.id
                ? "linear-gradient(180deg, #FED358 0%, #FFB472 100%)"
                : "#382E35",
              color: filter === f.id ? "#110D14" : "rgba(255,255,255,0.55)",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState title="No game history" subtitle="Place a bet to see it here" />
      ) : (
        <div
          className="mx-3 rounded-[12px] overflow-hidden"
          style={{
            background: "#1a1519",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {items.map((g) => {
            const meta = (g.metadata ?? {}) as Record<string, unknown>;
            const prefix =
              g.majorGameType === "K3"
                ? "K3"
                : g.majorGameType === "FIVE_D" || g.majorGameType === "5D"
                  ? "5D"
                  : g.majorGameType === "MOTO"
                    ? "MOTO"
                    : g.majorGameType === "TRX_WINGO"
                      ? "TRX"
                      : g.majorGameType === "INOUT"
                        ? "IO"
                        : "WG";
            const select =
              meta.betChoice != null
                ? String(meta.betChoice)
                : meta.betType != null
                  ? String(meta.betType)
                  : g.gameName || g.majorGameType || "Bet";
            const st = String(g.status ?? "").toUpperCase();
            const isWin =
              st === "WON" ||
              (st === "SETTLED" && Number(g.winAmount) > 0) ||
              (st !== "LOST" &&
                st !== "PENDING" &&
                Number(g.winAmount) > 0);
            return (
              <BetHistoryCard
                key={g.id}
                detail={{
                  id: g.id,
                  selectLabel: select,
                  periodNumber:
                    meta.periodNumber != null
                      ? String(meta.periodNumber)
                      : undefined,
                  betAmount: g.betAmount,
                  contractAmount:
                    meta.contractAmount != null
                      ? Number(meta.contractAmount)
                      : undefined,
                  status: g.status,
                  winAmount: g.winAmount,
                  isWin,
                  createdAt: g.createdAt,
                  orderPrefix: prefix,
                  resultText:
                    meta.resultText != null
                      ? String(meta.resultText)
                      : meta.resultNumber != null
                        ? String(meta.resultNumber)
                        : undefined,
                  extraRows: [
                    {
                      label: "Game",
                      value: String(g.gameName || g.majorGameType || "—").replace(
                        /\b0\.5\s*Min\b/gi,
                        "30sec"
                      ),
                    },
                  ],
                }}
              />
            );
          })}
          {totalPages > 1 && (
            <div className="flex justify-center gap-3 py-4">
              <button disabled={page <= 1} onClick={() => load(page - 1, filter)}
                className="px-4 py-1.5 rounded-full text-[11px] font-bold text-white/70 disabled:opacity-30"
                style={{ background: "#382E35" }}>Prev</button>
              <span className="text-[11px] text-white/40 self-center">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => load(page + 1, filter)}
                className="px-4 py-1.5 rounded-full text-[11px] font-bold text-white/70 disabled:opacity-30"
                style={{ background: "#382E35" }}>Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
