"use client";

import { useCallback, useEffect, useState } from "react";
import * as admin from "../../lib/admin-api";
import { formatIstDateTime } from "../../lib/ist-day";
import { LoadingBlock, PageTitle, RefreshBtn, StatCard } from "./ui";

const LABELS = { wingo: "WinGo", trxwingo: "TRX", thirdparty: "Third-party" };
const money = (value: number) => value.toLocaleString("en-IN", {
  style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2,
});

// One request at a time, pause hidden tabs, and ignore responses after navigation.
function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    async function load() {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const result = await fetcher();
        if (!cancelled) { setData(result); setError(""); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load dashboard");
      } finally {
        inFlight = false;
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), intervalMs);
    document.addEventListener("visibilitychange", load);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [fetcher, intervalMs, revision]);
  const refresh = () => { setLoading(true); setRevision(value => value + 1); };
  return { data, error, loading, refresh };
}

function Totals({ title, totals, tone }: {
  title: string; totals: admin.GameDashboardTotals; tone: "today" | "allTime";
}) {
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="text-base font-bold text-slate-800">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone={tone} label="Bets" value={money(totals.betAmount)} hint={`${totals.betCount.toLocaleString("en-IN")} bets placed`} />
        <StatCard tone={tone} label="Users won" value={money(totals.userWinnings)} hint="Net winnings above stakes" />
        <StatCard tone={tone} label="Users lost" value={money(totals.userLosses)} hint="Stakes lost after any returns" />
        <StatCard tone={tone} label="Company profit" value={money(totals.companyProfit)} hint="Settled stakes minus payouts" />
      </div>
      <p className="text-xs leading-relaxed text-slate-500">
        Settled stakes: {money(totals.settledBetAmount)} · Payouts including stakes: {money(totals.payouts)} · Pending stakes: {money(totals.pendingBetAmount)}
      </p>
    </section>
  );
}

function LiveLotteryPeriods({ game }: { game: Exclude<admin.DashboardGame, "thirdparty"> }) {
  const fetcher = useCallback(async () => (await admin.getDashboardLotteryLive(game)).periods, [game]);
  const live = usePolling(fetcher, 2_000);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <section aria-label={`Live ${LABELS[game]} bets`} className="admin-surface p-3 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold text-slate-800">Live {LABELS[game]} bets</h2>
          <p className="text-xs text-slate-500">Current periods · updates every 2 seconds</p>
        </div>
        <RefreshBtn onClick={live.refresh} loading={live.loading} />
      </div>
      {live.error && <p role="alert" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{live.error}. {live.data ? "Showing the last received bets." : "Retry to load live bets."}</p>}
      {!live.data ? (live.loading && <LoadingBlock label="Loading live bets…" />) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {[30, 60, 180, 300].map(duration => {
            const period = live.data?.find(item => item.durationSeconds === duration);
            const remaining = period ? Math.max(0, Math.ceil((Date.parse(period.endTime) - now) / 1000)) : 0;
            const countdown = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
            return (
              <article key={duration} className="min-w-0 overflow-hidden rounded-xl border border-slate-200">
                <div className="flex items-center justify-between gap-3 bg-blue-600 px-4 py-3 text-white">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold">{LABELS[game]} · {duration < 60 ? `${duration}s` : `${duration / 60} min`}</h3>
                    <p className="mt-1 break-all text-xs text-blue-100">{period?.periodNumber ?? "No active period"}</p>
                  </div>
                  <span className="shrink-0 font-mono text-xl font-bold tabular-nums" aria-label="Time remaining">{period ? countdown : "—"}</span>
                </div>
                {period ? (
                  <div className="space-y-3 p-4">
                    {remaining === 0 && <p className="text-xs text-amber-700">Period ended · waiting for the next update</p>}
                    <dl className="grid grid-cols-2 gap-3">
                      <div><dt className="text-xs text-slate-500">Bets placed</dt><dd className="mt-1 font-bold text-slate-800">{period.betCount.toLocaleString("en-IN")}</dd></div>
                      <div><dt className="text-xs text-slate-500">Total bet amount</dt><dd className="mt-1 break-all font-bold text-slate-800">{money(period.totalBetAmount)}</dd></div>
                    </dl>
                    <div className="border-t border-slate-100 pt-3">
                      <p className="mb-2 text-xs font-semibold text-slate-500">Top choices by stake</p>
                      {period.selections.length ? <ul className="space-y-2">
                        {period.selections.slice(0, 6).map(selection => (
                          <li key={`${selection.betType}:${selection.betChoice}`} className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs">
                            <span className="text-slate-600">{selection.betType} · {selection.betChoice} <span className="text-slate-400">({selection.betCount} bets)</span></span>
                            <span className="font-semibold tabular-nums text-slate-800">{money(selection.amount)}</span>
                          </li>
                        ))}
                      </ul> : <p className="text-xs text-slate-400">No bets placed yet.</p>}
                    </div>
                  </div>
                ) : <p className="p-4 text-sm text-slate-400">Waiting for an active period.</p>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function GameDashboard({ game }: { game: admin.DashboardGame }) {
  const fetcher = useCallback(async () => (await admin.getGameDashboardSummary(game)).data, [game]);
  const summary = usePolling(fetcher, 30_000);
  return (
    <div>
      <PageTitle title={`${LABELS[game]} Dashboard`} subtitle="Real-player betting and settled results · Indian Standard Time" action={<RefreshBtn onClick={summary.refresh} loading={summary.loading} />} />
      {summary.error && <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{summary.error}. {summary.data ? "Showing the last received totals." : "Retry to load totals."}</p>}
      {!summary.data ? (summary.loading && <LoadingBlock label="Loading game totals…" />) : (
        <div className="space-y-6">
          <p className="text-xs text-slate-500">Updated {formatIstDateTime(summary.data.updatedAt)} IST · Totals refresh every minute</p>
          <Totals title={`Today · ${summary.data.day} (IST)`} totals={summary.data.today} tone="today" />
          <Totals title="All time" totals={summary.data.allTime} tone="allTime" />
          <p className="rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-500">
            Totals use the bet placement date. Pending bets count toward bets placed; winnings, losses and profit include settled bets only.
            Company profit is before commissions, bonuses and operating costs. Demo and staff bets are excluded{game === "thirdparty" ? ", along with refunded bets" : ""}.
          </p>
        </div>
      )}
      {game !== "thirdparty" && <div className="mt-6"><LiveLotteryPeriods game={game} /></div>}
    </div>
  );
}
