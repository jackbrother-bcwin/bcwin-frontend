"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as admin from "../../../lib/admin-api";
import { useToast } from "../../../components/ui/Toast";
import { LoadingBlock, PageTitle, RefreshBtn, StatCard, Surface } from "../../components/ui";
import { AdminBarChart, AdminPieChart } from "../../components/Charts";

export default function TopPerformancePage() {
  const { toast } = useToast();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [gameStats, setGameStats] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [top, gs] = await Promise.all([
        admin.getTopPerformance({}),
        admin.getGameStatistics({}).catch(() => null),
      ]);
      setData((top.data as Record<string, unknown>) ?? null);
      setGameStats(gs?.data ?? null);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const cards = (data?.cardItems as Record<string, unknown>) ?? {};
  const performers = useMemo(() => {
    const list =
      (data?.performers as unknown[]) ??
      (data?.topPerformers as unknown[]) ??
      (data?.users as unknown[]) ??
      [];
    if (!Array.isArray(list)) return [];
    return list.slice(0, 15).map((p, i) => {
      const r = p as Record<string, unknown>;
      return {
        name: String(r.username ?? r.serialNumber ?? `#${i + 1}`).slice(0, 12),
        deposits: Number(r.totalDeposits ?? r.deposits ?? r.amount ?? 0),
        bets: Number(r.totalBets ?? r.bets ?? 0),
        roi: Number(r.roi ?? r.averageROI ?? 0),
      };
    });
  }, [data]);

  const gameChart = useMemo(() => {
    if (!gameStats) return [];
    if (Array.isArray(gameStats)) {
      return (gameStats as Array<Record<string, unknown>>).map((g) => ({
        name: String(g.game ?? g.name ?? "game"),
        value: Number(g.totalBets ?? g.amount ?? g.profit ?? 0),
      }));
    }
    if (typeof gameStats === "object") {
      return Object.entries(gameStats as Record<string, unknown>)
        .filter(([, v]) => typeof v === "number")
        .map(([name, value]) => ({ name, value: Number(value) }));
    }
    return [];
  }, [gameStats]);

  if (loading) return <LoadingBlock />;

  return (
    <div>
      <PageTitle title="Top performance" subtitle="Leaders + game statistics" action={<RefreshBtn onClick={load} />} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 admin-stagger">
        {Object.entries(cards)
          .filter(([, v]) => typeof v === "number" || typeof v === "string")
          .slice(0, 8)
          .map(([k, v]) => (
            <StatCard key={k} label={k} value={typeof v === "number" ? v : String(v)} />
          ))}
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <AdminBarChart data={performers} xKey="name" yKey="deposits" yKey2="bets" title="Top performers" height={300} />
        <AdminPieChart data={gameChart} title="Game statistics mix" height={300} />
      </div>
      <Surface title="Raw performers table">
        {performers.length === 0 ? (
          <p className="text-sm text-slate-400">No ranked performers returned for this filter.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Deposits</th>
                <th>Bets</th>
                <th>ROI</th>
              </tr>
            </thead>
            <tbody>
              {performers.map((p) => (
                <tr key={p.name}>
                  <td className="font-semibold">{p.name}</td>
                  <td>{p.deposits.toLocaleString()}</td>
                  <td>{p.bets.toLocaleString()}</td>
                  <td>{p.roi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Surface>
    </div>
  );
}
