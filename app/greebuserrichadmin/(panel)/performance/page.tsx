"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IoTrophyOutline,
  IoSearchOutline,
  IoFlameOutline,
  IoPeopleOutline,
  IoPersonOutline,
  IoLayersOutline,
} from "react-icons/io5";

import * as admin from "../../../lib/admin-api";
import { useToast } from "../../../components/ui/Toast";
import {
  Badge,
  EmptyBlock,
  LoadingBlock,
  PageTitle,
  RefreshBtn,
  StatCard,
  Surface,
  TableWrap,
} from "../../components/ui";
import { AdminBarChart, AdminPieChart } from "../../components/Charts";

const TIME_FILTERS = [
  { key: "all_time", label: "All Time" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This Week" },
  { key: "this_month", label: "This Month" },
  { key: "this_year", label: "This Year" },
] as const;

const MODES = [
  { key: "all", label: "All Leaders (Combined)", icon: IoLayersOutline },
  { key: "players", label: "Top Players (Personal)", icon: IoPersonOutline },
  { key: "teams", label: "Top Teams / Agents (Downlinks)", icon: IoPeopleOutline },
] as const;

const GAME_NAMES: Record<string, string> = {
  wingo: "Win Go",
  trx: "TRX Win Go",
  "5d": "5D Lotre",
  k3: "K3 Lotre",
  moto: "Moto Racing",
  inout: "InOut Games",
};

export default function TopPerformancePage() {
  const { toast } = useToast();
  const [timeFilter, setTimeFilter] = useState<string>("all_time");
  const [mode, setMode] = useState<string>("all");
  const [data, setData] = useState<admin.TopPerformanceResponse | null>(null);
  const [gameStats, setGameStats] = useState<unknown>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [topRes, gsRes] = await Promise.all([
        admin.getTopPerformance({ timeFilter, mode }),
        admin.getGameStatistics({}).catch(() => null),
      ]);
      setData(topRes.data ?? null);
      setGameStats(gsRes?.data ?? null);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load performance data", "error");
    } finally {
      setLoading(false);
    }
  }, [timeFilter, mode, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const cards = data?.cardItems;

  // Filter and prepare performers
  const allPerformers = data?.topPerformers ?? [];
  const filteredPerformers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allPerformers;
    return allPerformers.filter(
      (p) =>
        p.username.toLowerCase().includes(q) ||
        p.mobile.toLowerCase().includes(q)
    );
  }, [allPerformers, search]);

  // Chart data for performers
  const performersChartData = useMemo(() => {
    return allPerformers.slice(0, 10).map((p, i): Record<string, string | number> => {
      const name = p.username || `#${i + 1}`;
      if (mode === "players") {
        return {
          name,
          Turnover: Number(p.totalBetAmount ?? 0),
          Deposits: Number(p.totalDeposits ?? 0),
        };
      }
      return {
        name,
        "Personal Turnover": Number(p.totalBetAmount ?? 0),
        "Team Turnover": Number(p.teamTurnover ?? 0),
      };
    });
  }, [allPerformers, mode]);

  // Chart data for game distribution
  const gameChart: Array<Record<string, string | number>> = useMemo(() => {
    if (!gameStats) return [];
    if (Array.isArray(gameStats)) {
      return (gameStats as Array<Record<string, unknown>>)
        .map((g) => {
          const rawName = String(g.gameName ?? g.game ?? g.name ?? "Game");
          const displayName = GAME_NAMES[rawName.toLowerCase()] ?? rawName;
          const val = Number(g.totalInvested ?? g.totalBets ?? g.amount ?? 0);
          return {
            name: displayName,
            value: val,
          };
        })
        .filter((g) => g.value > 0);
    }
    if (typeof gameStats === "object") {
      return Object.entries(gameStats as Record<string, unknown>)
        .filter(([, v]) => typeof v === "number" && (v as number) > 0)
        .map(([name, value]) => ({
          name: GAME_NAMES[name.toLowerCase()] ?? name,
          value: Number(value),
        }));
    }
    return [];
  }, [gameStats]);

  const formatCurrency = (val: number | undefined | null) => {
    const num = Number(val ?? 0);
    return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getRankBadge = (index: number) => {
    if (index === 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-700">
          <IoTrophyOutline className="text-amber-500" size={14} /> #1
        </span>
      );
    }
    if (index === 1) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-400/10 px-2 py-0.5 text-xs font-bold text-slate-700">
          <IoTrophyOutline className="text-slate-400" size={14} /> #2
        </span>
      );
    }
    if (index === 2) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-700/10 px-2 py-0.5 text-xs font-bold text-amber-800">
          <IoTrophyOutline className="text-amber-700" size={14} /> #3
        </span>
      );
    }
    return <span className="text-xs font-medium text-slate-400">#{index + 1}</span>;
  };

  return (
    <div className="space-y-5">
      <PageTitle
        title="Top Performance"
        subtitle="Rankings, personal gaming volume, downlink network turnover & game distribution"
        action={<RefreshBtn onClick={load} loading={loading} />}
      />

      {/* Mode & Time Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Mode Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100 p-1">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                disabled={loading}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  active
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon size={14} />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Time Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {TIME_FILTERS.map((f) => {
            const active = timeFilter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setTimeFilter(f.key)}
                disabled={loading}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  active
                    ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/30"
                    : "bg-white text-slate-600 hover:bg-slate-50 shadow-sm border border-slate-200/80"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Metric Cards */}
      {loading && !data ? (
        <LoadingBlock label="Calculating top performance & downlink network metrics…" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 admin-stagger">
            <StatCard
              label="Personal Turnover"
              value={formatCurrency(cards?.totalTurnover)}
              hint="Top performers volume"
            />
            <StatCard
              label="Team Turnover"
              value={formatCurrency(cards?.totalTeamTurnover)}
              hint="Downlink volume (L1–6)"
            />
            <StatCard
              label="Personal Deposits"
              value={formatCurrency(cards?.totalDeposits)}
              hint="Success deposits"
            />
            <StatCard
              label="Team Deposits"
              value={formatCurrency(cards?.totalTeamDeposits)}
              hint="Downlink recharge"
            />
            <StatCard
              label="Total Bets"
              value={(cards?.totalBets ?? 0).toLocaleString("en-IN")}
              hint="Bets placed"
            />
            <StatCard
              label="Avg Win Rate"
              value={`${(cards?.avgWinRate ?? 0).toFixed(1)}%`}
              hint="Winning rounds"
            />
            <StatCard
              label="Platform Profit"
              value={formatCurrency(cards?.netProfit)}
              hint="Net house revenue"
            />
          </div>

          {/* Charts Section */}
          <div className="grid gap-4 lg:grid-cols-2">
            <AdminBarChart
              data={performersChartData}
              xKey="name"
              yKey={mode === "players" ? "Turnover" : "Personal Turnover"}
              yKey2={mode === "players" ? "Deposits" : "Team Turnover"}
              title={
                mode === "players"
                  ? "Top 10 Performers: Turnover vs Deposits (₹)"
                  : "Top 10 Performers: Personal vs Team Turnover (₹)"
              }
              height={320}
            />
            <AdminPieChart
              data={gameChart.length > 0 ? gameChart : [{ name: "No bet activity", value: 1 }]}
              title="Game Turnover Breakdown"
              height={320}
            />
          </div>

          {/* Performers Table */}
          <Surface
            title={`Top Performers & Teams (${filteredPerformers.length})`}
            action={
              <div className="relative flex items-center">
                <IoSearchOutline className="absolute left-3 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Search user or mobile…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            }
          >
            {filteredPerformers.length === 0 ? (
              <EmptyBlock label="No performers found for the selected time filter." />
            ) : (
              <TableWrap>
                <table className="admin-table text-left">
                  <thead>
                    <tr>
                      <th className="w-16 text-center">Rank</th>
                      <th>Player / Leader</th>
                      <th>Status</th>
                      <th className="text-right">Personal Turnover</th>
                      <th className="text-right">Team Turnover (L1-6)</th>
                      <th className="text-right">Combined Volume</th>
                      <th className="text-center">Team Size</th>
                      <th className="text-right">Deposits (Self / Team)</th>
                      <th className="text-right">Win Rate</th>
                      <th className="text-right">House Net</th>
                      <th className="text-right">Balance</th>
                      <th className="text-center">Activity Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPerformers.map((p, idx) => {
                      const netProfit = p.netProfit ?? 0;
                      const isProfit = netProfit >= 0;
                      const userHref = p.userId ? `/greebuserrichadmin/users/${p.userId}` : null;
                      const teamSize = p.totalTeamSize ?? 0;
                      const directCount = p.directDownlinksCount ?? 0;

                      return (
                        <tr key={p.userId ?? p.username ?? idx} className="hover:bg-slate-50/80">
                          <td className="text-center font-bold">{getRankBadge(idx)}</td>
                          <td>
                            {userHref ? (
                              <Link
                                href={userHref}
                                className="group flex flex-col hover:underline"
                              >
                                <span className="font-semibold text-blue-600 group-hover:text-blue-700">
                                  {p.username}
                                </span>
                                <span className="text-[11px] text-slate-400">{p.mobile}</span>
                              </Link>
                            ) : (
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-700">{p.username}</span>
                                <span className="text-[11px] text-slate-400">{p.mobile}</span>
                              </div>
                            )}
                          </td>
                          <td>
                            <Badge status={p.status || "active"} />
                          </td>
                          <td className="text-right font-semibold text-slate-800">
                            {formatCurrency(p.totalBetAmount)}
                          </td>
                          <td className="text-right font-semibold text-indigo-600">
                            {formatCurrency(p.teamTurnover)}
                          </td>
                          <td className="text-right font-bold text-slate-900">
                            {formatCurrency(p.totalCombinedTurnover ?? p.totalBetAmount)}
                          </td>
                          <td className="text-center">
                            {teamSize > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                <IoPeopleOutline size={13} />
                                {directCount} / {teamSize}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">0</span>
                            )}
                          </td>
                          <td className="text-right text-xs">
                            <div className="font-medium text-emerald-600">
                              {formatCurrency(p.totalDeposits)}
                            </div>
                            {p.teamDeposits ? (
                              <div className="text-[11px] text-slate-400">
                                Team: {formatCurrency(p.teamDeposits)}
                              </div>
                            ) : null}
                          </td>
                          <td className="text-right font-medium">
                            <span
                              className={
                                (p.winRate ?? 0) > 50
                                  ? "text-emerald-600 font-semibold"
                                  : "text-slate-600"
                              }
                            >
                              {(p.winRate ?? 0).toFixed(1)}%
                            </span>
                          </td>
                          <td
                            className={`text-right font-semibold ${
                              isProfit ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {formatCurrency(netProfit)}
                          </td>
                          <td className="text-right font-mono text-xs font-semibold text-slate-700">
                            {formatCurrency(p.currentBalance)}
                          </td>
                          <td className="text-center">
                            <div className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                              <IoFlameOutline
                                className={
                                  (p.activityScore ?? 0) > 50
                                    ? "text-orange-500"
                                    : "text-slate-400"
                                }
                                size={13}
                              />
                              {(p.activityScore ?? 0).toFixed(0)}/100
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Surface>
        </>
      )}
    </div>
  );
}
