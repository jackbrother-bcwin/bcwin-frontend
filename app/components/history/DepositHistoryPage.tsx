"use client";

import React, { useCallback, useEffect, useState } from "react";
import PageHeader from "../ui/PageHeader";
import LoadingSpinner from "../ui/LoadingSpinner";
import EmptyState from "../ui/EmptyState";
import StatusBadge from "../ui/StatusBadge";
import * as api from "../../lib/api";
import type { Deposit } from "../../lib/api";
import {
  formatDateTime,
  formatDepositAmount,
  formatDepositInrHint,
} from "../../lib/format";
import { Pagination } from "../game/shared";
import {
  HISTORY_MAX_PAGES,
  capHistoryPage,
  capHistoryPages,
} from "../../lib/history-pages";

interface Props {
  onBack: () => void;
}

export default function DepositHistoryPage({ onBack }: Props) {
  const [items, setItems] = useState<Deposit[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const page = capHistoryPage(p);
      const res = await api.getDeposits({ page, limit: 20 });
      setItems(res.deposits ?? []);
      setTotalPages(capHistoryPages(res.totalPages));
      setPage(capHistoryPage(res.currentPage ?? page));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  return (
    <div className="flex-1 flex flex-col min-h-screen pb-8" style={{ background: "#110D14" }}>
      <PageHeader title="Deposit history" onBack={onBack} />
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="p-4 text-center text-[#FD565C] text-xs">{error}</div>
      ) : items.length === 0 ? (
        <EmptyState title="No deposits yet" subtitle="Your deposit orders will appear here" />
      ) : (
        <div className="px-3 mt-2 space-y-2">
          {items.map((d) => {
            const inrHint = formatDepositInrHint(d);
            return (
            <div key={d.id} className="rounded-[10px] p-3"
              style={{ background: "#241E22", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between mb-1 gap-2">
                <div className="min-w-0">
                  <span className="text-sm font-bold text-white">
                    {formatDepositAmount(d)}
                  </span>
                  {inrHint ? (
                    <p className="text-[10px] font-medium text-white/35 tabular-nums mt-0.5">
                      {inrHint}
                    </p>
                  ) : null}
                </div>
                <StatusBadge status={d.status} />
              </div>
              <div className="flex justify-between text-[10px] text-white/40">
                <span>{d.method}</span>
                <span>{formatDateTime(d.createdAt)}</span>
              </div>
              <p className="text-[10px] text-white/30 mt-1 font-mono truncate">{d.orderId}</p>
            </div>
            );
          })}
          <Pagination
            page={page}
            totalPages={totalPages}
            maxPages={HISTORY_MAX_PAGES}
            onChange={(p) => {
              void load(p);
              if (typeof window !== "undefined") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
