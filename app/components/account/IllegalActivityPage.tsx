"use client";

import React, { useEffect, useRef, useState } from "react";
import { MdRefresh } from "react-icons/md";
import PageHeader from "../ui/PageHeader";
import LoadingSpinner from "../ui/LoadingSpinner";
import EmptyState from "../ui/EmptyState";
import { Pagination } from "../game/shared";
import { getIllegalActivity, type PenaltyHistoryEntry, type PenaltyHistoryResponse } from "../../lib/api";
import { formatIstDateTime, shiftYmd, ymdIst } from "../../lib/ist-day";

const money = (value: number | null) => value == null ? "Not recorded"
  : `INR ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const factor = (value: number | null) => value == null ? "Not recorded" : `${value.toLocaleString("en-IN")}x`;
const difference = (before: number | null, after: number | null) =>
  before == null || after == null ? null : after - before;
const actions: Record<string, string> = {
  APPLIED: "Penalty applied", ADJUSTED: "Penalty adjusted", CLEARED: "Penalty cleared",
  EXTRA_WAGERS_CLEARED: "Extra wagers cleared", DETECTED: "Older detection record",
};
const reasons: Record<string, string> = {
  ILLEGAL_BETS: "Illegal bets", SAME_IP: "Same-IP activity", ADMIN: "Admin action",
};
const games: Record<string, string> = { WINGO: "WinGo", TRXWINGO: "TRX WinGo", "5D": "5D", K3: "K3", MOTO: "Moto" };
const control = "min-w-0 w-full rounded-md border border-white/15 bg-bg-level-3 px-3 py-2 text-xs text-white [color-scheme:dark]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-1.5">
    <dt className="text-white/55">{label}</dt>
    <dd className="min-w-0 break-words text-right font-medium tabular-nums">{children}</dd>
  </div>;
}

function HistoryEntry({ entry }: { entry: PenaltyHistoryEntry }) {
  const change = difference(entry.beforeNeedToBet, entry.afterNeedToBet);
  const penaltyChange = difference(entry.beforePenaltyWager, entry.afterPenaltyWager);
  const rewardChange = difference(entry.beforeRewardWager, entry.afterRewardWager);
  return <details className="rounded-lg border border-white/10 bg-bg-level-3 text-white">
    <summary className="cursor-pointer p-3 text-xs marker:text-white/50">
      <span className="font-semibold">{actions[entry.action] ?? "Penalty record"}</span>
      <span className="mt-1 block pl-3 text-white/55">{reasons[entry.reason] ?? "Unknown reason"}{entry.game ? ` / ${games[entry.game] ?? entry.game}` : ""}</span>
      <span className="mt-2 flex flex-wrap justify-between gap-2 pl-3 text-[11px]">
        <span className="text-white/50">{formatIstDateTime(entry.createdAt)} IST</span>
        <span className={change != null && change < 0 ? "text-emerald-400" : "text-amber-300"}>
          {change == null ? "Not recorded" : `${change < 0 ? "Reduced" : "Added"}: ${money(Math.abs(change))}`}
        </span>
      </span>
    </summary>
    <div className="border-t border-white/10 px-3 pb-3 text-xs">
      <dl className="py-2">
        {entry.legacy && <Field label="Record">Older record</Field>}
        {entry.game && <Field label="Period">{entry.periodNumber ?? "Not recorded"}</Field>}
        <Field label="Previous penalty factor">{factor(entry.previousFactor)}</Field>
        <Field label="Resulting penalty factor">{factor(entry.resultingFactor)}</Field>
        <Field label="Need to bet before">{money(entry.beforeNeedToBet)}</Field>
        <Field label="Need to bet after">{money(entry.afterNeedToBet)}</Field>
        <Field label={change != null && change < 0 ? "Wager reduced" : "Additional need to bet"}>
          {money(change == null ? null : Math.abs(change))}
        </Field>
        {entry.action === "EXTRA_WAGERS_CLEARED" && <>
          <Field label="Penalty wager cleared">{money(penaltyChange == null ? null : Math.max(0, -penaltyChange))}</Field>
          <Field label="Reward wager cleared">{money(rewardChange == null ? null : Math.max(0, -rewardChange))}</Field>
        </>}
      </dl>
      {entry.evidence.length ? <div className="border-t border-white/10 pt-2">
        <h3 className="mb-1 font-semibold">{entry.legacy ? "Recorded bet details" : "Triggering bets"}</h3>
        <ul className="divide-y divide-white/10">
          {entry.evidence.map((bet) => <li key={bet.id} className="flex flex-wrap justify-between gap-2 py-2">
            <span className="min-w-0 break-all">{[bet.scope, bet.betType, bet.selection].filter(Boolean).join(" / ")}</span>
            <span className="text-white/65">{bet.recordedStakeOnly ? "Recorded stake: " : ""}{money(bet.amount)}</span>
          </li>)}
        </ul>
      </div> : <dl><Field label="Bet amount">Not applicable</Field></dl>}
    </div>
  </details>;
}

export default function IllegalActivityPage({ onBack }: { onBack: () => void }) {
  const [result, setResult] = useState<PenaltyHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [reason, setReason] = useState("ALL");
  const [range, setRange] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [revision, setRevision] = useState(0);
  const asOf = useRef<string | undefined>(undefined);
  const reset = () => { asOf.current = undefined; setPage(1); };
  const refresh = () => { reset(); setRevision((value) => value + 1); };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      if (range === "CUSTOM" && (!startDate || !endDate || startDate > endDate)) {
        setError("Choose a valid start and end date.");
        setLoading(false);
        return;
      }
      const day = range === "YESTERDAY" ? shiftYmd(ymdIst(), -1) : ymdIst();
      try {
        const data = await getIllegalActivity({
          page, reason, asOf: asOf.current,
          startDate: range === "ALL" ? undefined : range === "CUSTOM" ? startDate : day,
          endDate: range === "ALL" ? undefined : range === "CUSTOM" ? endDate : day,
        });
        if (!cancelled) { setResult(data); asOf.current = data.asOf; }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load activity");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [page, reason, range, startDate, endDate, revision]);

  return <div className="min-h-screen flex-1 bg-bg-level-1 pb-8 text-white">
    <PageHeader title="Illegal activity" onBack={onBack} />
    <section className="border-b border-white/10 px-4 py-3" aria-label="Current wager">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold text-white/60">Current wager</h2>
        <button type="button" onClick={refresh} disabled={loading} title="Refresh history" aria-label="Refresh history"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-white/10 disabled:opacity-40">
          <MdRefresh size={20} />
        </button>
      </div>
      <dl className="text-sm">
        <Field label="Remaining penalty wager">{result ? money(result.current.penaltyWagerNeeded) : loading ? "Loading..." : "Unavailable"}</Field>
        <Field label="Total need to bet">{result ? money(result.current.totalNeedToBet) : loading ? "Loading..." : "Unavailable"}</Field>
      </dl>
    </section>
    <div className="grid grid-cols-2 gap-3 px-4 py-3">
      <label className="min-w-0 text-xs text-white/60">Activity
        <select className={`${control} mt-1`} value={reason} onChange={(e) => { reset(); setReason(e.target.value); }}>
          <option value="ALL">All activity</option><option value="ILLEGAL_BETS">Illegal bets</option>
          <option value="SAME_IP">Same-IP activity</option><option value="ADMIN">Admin actions</option>
        </select>
      </label>
      <label className="min-w-0 text-xs text-white/60">Date (IST)
        <select className={`${control} mt-1`} value={range} onChange={(e) => { reset(); setRange(e.target.value); }}>
          <option value="ALL">All dates</option><option value="TODAY">Today</option>
          <option value="YESTERDAY">Yesterday</option><option value="CUSTOM">Custom range</option>
        </select>
      </label>
      {range === "CUSTOM" && <>
        <label className="min-w-0 text-xs text-white/60">From
          <input aria-label="From date" className={`${control} mt-1`} type="date" value={startDate} max={endDate || undefined}
            onChange={(e) => { reset(); setStartDate(e.target.value); }} />
        </label>
        <label className="min-w-0 text-xs text-white/60">To
          <input aria-label="To date" className={`${control} mt-1`} type="date" value={endDate} min={startDate || undefined}
            onChange={(e) => { reset(); setEndDate(e.target.value); }} />
        </label>
      </>}
    </div>
    {loading ? <LoadingSpinner /> : error ? <div role="alert" className="px-4 py-6 text-center text-sm text-red-300">
      <p>{error}</p><button type="button" onClick={refresh} className="mt-3 underline">Retry</button>
    </div> : result && <>
      {!result.items.length ? <EmptyState title="No activity records" />
        : <div className="space-y-2 px-4">{result.items.map((entry) => <HistoryEntry key={entry.id} entry={entry} />)}</div>}
      <Pagination page={page} totalPages={result.totalPages} maxPages={50} onChange={(value) => {
        setPage(value); window.scrollTo({ top: 0, behavior: "smooth" });
      }} />
    </>}
  </div>;
}
