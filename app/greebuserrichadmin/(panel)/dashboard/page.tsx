"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as admin from "../../../lib/admin-api";
import { useAuthState } from "../../../context/AuthContext";
import { useToast } from "../../../components/ui/Toast";
import { LoadingBlock, PageTitle, RefreshBtn, StatCard } from "../../components/ui";
import { formatIstDateLong } from "../../../lib/ist-day";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmt(v: unknown): string {
  const n = num(v);
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function durationLabel(seconds: number): string {
  return seconds < 60 ? `${seconds}s` : `${seconds / 60} min`;
}

function countdown(endTime: string, nowMs: number): string {
  const endMs = new Date(endTime).getTime();
  if (!Number.isFinite(endMs)) return "00:00";
  const remaining = Math.max(0, Math.ceil((endMs - nowMs) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

type WingoAlgorithm = "RANDOM" | "WINNING" | "TRX";

const WINGO_ALGORITHMS: ReadonlyArray<{
  id: WingoAlgorithm;
  label: string;
  description: string;
}> = [
  { id: "RANDOM", label: "Random", description: "Pure random 0–9" },
  {
    id: "WINNING",
    label: "Winning",
    description: "House edge — lowest liability number",
  },
  {
    id: "TRX",
    label: "TRX result",
    description: "Last digit of latest Tron block hash",
  },
];

export default function AdminDashboardPage() {
  const { user } = useAuthState();
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [pl, setPl] = useState<Record<string, unknown> | null>(null);
  const [livePeriods, setLivePeriods] = useState<admin.DashboardWingoPeriod[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState("");
  const [clockMs, setClockMs] = useState(() => Date.now());
  const [wingoAlgorithm, setWingoAlgorithm] = useState<WingoAlgorithm | null>(null);
  const [algorithmSaving, setAlgorithmSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, profit, configResponse] = await Promise.all([
        admin.getOverview(),
        admin.getProfitLoss("today").catch(() => null),
        admin.getConfig().catch(() => null),
      ]);
      setData((ov.data as Record<string, unknown>) ?? null);
      setPl((profit?.data as Record<string, unknown>) ?? null);
      const algorithm = String(
        configResponse?.config?.wingoAlgorithm ?? ""
      ).toUpperCase();
      if (algorithm === "RANDOM" || algorithm === "WINNING" || algorithm === "TRX") {
        setWingoAlgorithm(algorithm);
      }
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load overview", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initialTimer);
  }, [load]);

  const loadLive = useCallback(async () => {
    try {
      const response = await admin.getDashboardWingoLive();
      setLivePeriods(response.periods);
      setLiveError("");
    } catch (error: unknown) {
      setLiveError(
        error instanceof Error ? error.message : "Live WinGo data unavailable"
      );
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void loadLive(), 0);
    const refreshTimer = window.setInterval(() => void loadLive(), 2_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
    };
  }, [loadLive]);

  useEffect(() => {
    const clockTimer = window.setInterval(() => setClockMs(Date.now()), 1_000);
    return () => window.clearInterval(clockTimer);
  }, []);

  const saveWingoAlgorithm = async (next: WingoAlgorithm) => {
    if (!wingoAlgorithm || next === wingoAlgorithm || algorithmSaving) return;
    setAlgorithmSaving(true);
    try {
      await admin.updateConfig({ wingoAlgorithm: next });
      setWingoAlgorithm(next);
      toast(`Wingo result mode → ${next}`, "success");
    } catch (error: unknown) {
      toast(
        error instanceof Error ? error.message : "Failed to update Wingo result mode",
        "error"
      );
    } finally {
      setAlgorithmSaving(false);
    }
  };

  const users = (data?.users as Record<string, unknown>) ?? {};
  const deposits = (data?.deposits as Record<string, unknown>) ?? {};
  const withdrawals = (data?.withdrawals as Record<string, unknown>) ?? {};
  const bets = (data?.bets as Record<string, unknown>) ?? {};
  const cards = (pl?.cardItems as Record<string, unknown>) ?? {};

  const today = formatIstDateLong();

  if (loading && !data) return <LoadingBlock label="Loading dashboard…" />;

  return (
    <div>
      <PageTitle
        title={`Hi, ${user?.username ?? "Admin"}!`}
        subtitle={`${today} · real USERs · SUCCESS recharge / withdraw`}
        action={<RefreshBtn onClick={load} loading={loading} />}
      />

      <section className="mb-6 admin-fade-up" aria-label="Current WinGo periods">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-700">Current WinGo periods</h2>
            <p className="text-[11px] text-slate-400">
              Real-user pending bets · refreshes every 2 seconds
            </p>
          </div>
          {liveError ? (
            <span className="text-[11px] font-semibold text-red-500">{liveError}</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Live
            </span>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {[30, 60].map((duration) => {
            const period = livePeriods.find(
              (item) => item.durationSeconds === duration
            );
            return (
              <article
                key={duration}
                className="admin-surface overflow-hidden border border-blue-100"
              >
                <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-white/75">
                      WinGo {durationLabel(duration)}
                    </p>
                    <p className="truncate font-mono text-[12px] font-bold sm:text-sm">
                      {period?.periodNumber ?? (liveLoading ? "Loading…" : "Waiting for period")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-semibold uppercase text-white/70">
                      Time left
                    </p>
                    <p className="font-mono text-xl font-black tabular-nums">
                      {period ? countdown(period.endTime, clockMs) : "00:00"}
                    </p>
                  </div>
                </div>

                <div className="p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Bets placed
                      </p>
                      <p className="mt-1 text-xl font-black tabular-nums text-slate-800">
                        {period?.betCount.toLocaleString("en-IN") ?? 0}
                      </p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600/70">
                        Total bet amount
                      </p>
                      <p className="mt-1 text-xl font-black tabular-nums text-emerald-700">
                        ₹{fmt(period?.totalBetAmount ?? 0)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Top bet choices
                    </p>
                    {!period || period.selections.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-200 py-3 text-center text-xs text-slate-400">
                        No bets in this period yet
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {period.selections.slice(0, 6).map((selection) => (
                          <div
                            key={`${selection.betType}:${selection.betChoice}`}
                            className="rounded-lg border border-slate-100 bg-white px-2.5 py-2 shadow-sm"
                          >
                            <p className="truncate text-[11px] font-black text-slate-700">
                              {selection.betChoice}
                            </p>
                            <p className="truncate text-[9px] font-semibold text-slate-400">
                              {selection.betType} · {selection.betCount} bets
                            </p>
                            <p className="mt-0.5 text-[11px] font-bold tabular-nums text-blue-600">
                              ₹{fmt(selection.amount)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-700">WinGo result mode</h3>
              <p className="text-[11px] text-slate-400">
                Same global setting as Manage WinGo
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 font-mono text-[10px] font-black text-blue-700">
              {wingoAlgorithm ? `${wingoAlgorithm} · ACTIVE` : "LOADING…"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {WINGO_ALGORITHMS.map((option) => {
              const active = wingoAlgorithm === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={!wingoAlgorithm || algorithmSaving}
                  onClick={() => void saveWingoAlgorithm(option.id)}
                  className={`rounded-xl border px-3 py-3 text-left transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${
                    active
                      ? "border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-500/30"
                      : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-sm font-black ${
                        active ? "text-blue-800" : "text-slate-800"
                      }`}
                    >
                      {option.label}
                    </p>
                    {active ? (
                      <span className="text-[10px] font-black uppercase text-blue-600">
                        Active
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="admin-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Today User Join" value={num(users.todayCount)} />
        <StatCard
          label="Today's Recharge"
          value={fmt(deposits.todayAmount)}
          hint="SUCCESS only"
          onClick={() => router.push("/greebuserrichadmin/finance/deposits?status=SUCCESS")}
        />
        <StatCard
          label="Today's Withdrawal"
          value={fmt(withdrawals.todayAmount)}
          hint="SUCCESS only"
          onClick={() => router.push("/greebuserrichadmin/finance/withdrawals?status=SUCCESS")}
        />
        <StatCard
          label="User Balance"
          value={fmt(users.totalBalance)}
          hint="See in Detail"
          onClick={() => router.push("/greebuserrichadmin/users")}
        />
        <StatCard
          label="Total Users"
          value={num(users.totalCount)}
          hint="See in Detail"
          onClick={() => router.push("/greebuserrichadmin/users")}
        />
        <StatCard
          label="Pending Recharge"
          value={fmt(deposits.pendingAmount ?? deposits.processingAmount)}
          hint="See in Detail"
          onClick={() => router.push("/greebuserrichadmin/finance/deposits?status=PROCESSING")}
        />
        <StatCard
          label="Success Recharge"
          value={fmt(deposits.successAmount ?? deposits.totalSuccessAmount)}
          hint="See in Detail"
          onClick={() => router.push("/greebuserrichadmin/finance/deposits?status=SUCCESS")}
        />
        <StatCard
          label="Total Withdrawal"
          value={fmt(withdrawals.successAmount ?? withdrawals.totalSuccessAmount)}
          hint="See in Detail"
          onClick={() => router.push("/greebuserrichadmin/finance/withdrawals")}
        />
        <StatCard
          label="Withdrawal Requests"
          value={fmt(withdrawals.pendingAmount ?? withdrawals.processingAmount)}
          hint="See in Detail"
          onClick={() => router.push("/greebuserrichadmin/finance/withdrawals?status=PROCESSING")}
        />
        <StatCard
          label="Today's total bet"
          value={fmt(bets.todayTotalBet ?? cards.totalInvested)}
        />
        <StatCard
          label="Today's total win"
          value={fmt(bets.todayTotalWin ?? cards.totalWon)}
        />
        <StatCard
          label="Today's profit"
          value={fmt(bets.todayProfit ?? cards.netPL)}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="admin-surface p-5 admin-fade-up">
          <h3 className="mb-3 text-sm font-bold text-slate-700">Quick actions</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { href: "/greebuserrichadmin/games/wingo", label: "Set WinGo result" },
              {
                href: "/greebuserrichadmin/recent-wingo-bets",
                label: "Last 50 WinGo bets",
              },
              {
                href: "/greebuserrichadmin/top-users",
                label: "Top 100 users",
              },
              { href: "/greebuserrichadmin/finance/deposits", label: "Approve deposits" },
              { href: "/greebuserrichadmin/finance/withdrawals", label: "Process withdrawals" },
              { href: "/greebuserrichadmin/support/queries", label: "Support tickets" },
              { href: "/greebuserrichadmin/gifts", label: "Create gift" },
              { href: "/greebuserrichadmin/config", label: "Platform config" },
            ].map((a) => (
              <button
                key={a.href}
                type="button"
                onClick={() => router.push(a.href)}
                className="admin-btn-primary text-xs"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <div className="admin-surface p-5 admin-fade-up">
          <h3 className="mb-3 text-sm font-bold text-slate-700">Platform snapshot</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex justify-between">
              <span>Active users (7d)</span>
              <strong>{fmt(users.activeCount)}</strong>
            </li>
            <li className="flex justify-between">
              <span>Total bets (today P/L)</span>
              <strong>{fmt(cards.totalBets)}</strong>
            </li>
            <li className="flex justify-between">
              <span>Wins / Losses</span>
              <strong>
                {fmt(cards.totalWins)} / {fmt(cards.totalLosses)}
              </strong>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
