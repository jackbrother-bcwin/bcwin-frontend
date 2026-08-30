"use client";

import Link from "next/link";

import type {
  TeamDayAnalysis,
  TeamDayLeg,
  TeamDayMetric,
  TeamDayMetricSet,
} from "../../lib/admin-api";
import { AdminHorizontalPercentChart } from "./Charts";
import { EmptyBlock, Pagination } from "./ui";

type SortMetric = "deposit" | "withdrawal" | "bet";

const SORT_OPTIONS: Array<{ id: SortMetric; label: string }> = [
  { id: "deposit", label: "Deposit share" },
  { id: "withdrawal", label: "Withdrawal share" },
  { id: "bet", label: "Bet share" },
];

function money(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}`;
}

function percent(value: number) {
  if (value > 0 && value < 0.01) return "<0.01%";
  return `${value.toFixed(2)}%`;
}

function MetricTile({
  label,
  metric,
  color,
}: {
  label: string;
  metric: TeamDayMetric;
  color: "emerald" | "amber" | "violet";
}) {
  const styles = {
    emerald: "border-emerald-100 bg-emerald-50/70 text-emerald-800",
    amber: "border-amber-100 bg-amber-50/70 text-amber-800",
    violet: "border-violet-100 bg-violet-50/70 text-violet-800",
  }[color];

  return (
    <div className={`rounded-xl border p-3 ${styles}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-lg font-black tabular-nums">{money(metric.amount)}</p>
      <p className="text-[11px] font-semibold opacity-75">
        {metric.count.toLocaleString("en-IN")} transactions
      </p>
    </div>
  );
}

function SummaryCard({
  title,
  badge,
  metrics,
  tone,
}: {
  title: string;
  badge: string;
  metrics: TeamDayMetricSet;
  tone: "indigo" | "purple";
}) {
  const shell =
    tone === "indigo"
      ? "border-indigo-300 bg-gradient-to-br from-blue-100 via-indigo-100/90 to-sky-100"
      : "border-purple-300 bg-gradient-to-br from-purple-100 via-fuchsia-100/90 to-violet-100 ring-2 ring-purple-200/50";
  const badgeClass = tone === "indigo" ? "bg-indigo-600" : "bg-purple-600";

  return (
    <section className={`rounded-xl border-2 p-4 shadow-md ${shell}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-black text-slate-900">{title}</h4>
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white ${badgeClass}`}
        >
          {badge}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricTile label="Deposits" metric={metrics.deposit} color="emerald" />
        <MetricTile label="Withdrawals" metric={metrics.withdrawal} color="amber" />
        <MetricTile label="Bets" metric={metrics.bet} color="violet" />
      </div>
    </section>
  );
}

function LegMetric({
  label,
  metric,
  active,
}: {
  label: string;
  metric: TeamDayMetric & { share: number };
  active: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-2.5 ${
        active ? "border-blue-200 bg-blue-50" : "border-slate-100 bg-slate-50/70"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="font-black tabular-nums text-slate-900">{money(metric.amount)}</p>
        <p className={`font-black tabular-nums ${active ? "text-blue-700" : "text-slate-600"}`}>
          {percent(metric.share)}
        </p>
      </div>
      <p className="mt-0.5 text-[10px] text-slate-500">
        {metric.count.toLocaleString("en-IN")} transactions
      </p>
    </div>
  );
}

function LegCards({
  legs,
  sortBy,
  page,
}: {
  legs: TeamDayLeg[];
  sortBy: SortMetric;
  page: number;
}) {
  return (
    <div className="space-y-3 lg:hidden">
      {legs.map((leg, index) => (
        <article key={leg.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                Rank {(page - 1) * 25 + index + 1}
              </p>
              <p className="truncate text-sm font-black text-slate-900">
                #{leg.serialNumber} {leg.username}
              </p>
              <p className="truncate text-[11px] text-slate-500">{leg.mobileNumber}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] text-slate-500">Leg size</p>
              <p className="font-black tabular-nums text-slate-800">{leg.memberCount}</p>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            <LegMetric label="Deposits" metric={leg.deposit} active={sortBy === "deposit"} />
            <LegMetric
              label="Withdrawals"
              metric={leg.withdrawal}
              active={sortBy === "withdrawal"}
            />
            <LegMetric label="Bets" metric={leg.bet} active={sortBy === "bet"} />
          </div>
          <Link
            href={`/greebuserrichadmin/users/${leg.id}?tab=userhub`}
            className="mt-3 inline-flex text-xs font-bold text-blue-600 hover:underline"
          >
            Open Hub →
          </Link>
        </article>
      ))}
    </div>
  );
}

function LegTable({
  legs,
  sortBy,
  page,
}: {
  legs: TeamDayLeg[];
  sortBy: SortMetric;
  page: number;
}) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="admin-table text-xs">
        <thead>
          <tr>
            <th>Rank / Direct</th>
            <th>Leg size</th>
            <th>Deposits</th>
            <th>Withdrawals</th>
            <th>Bets</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {legs.map((leg, index) => (
            <tr key={leg.id}>
              <td>
                <p className="font-black text-slate-900">
                  <span className="mr-2 text-blue-600">#{(page - 1) * 25 + index + 1}</span>
                  #{leg.serialNumber} {leg.username}
                </p>
                <p className="text-[10px] text-slate-400">{leg.mobileNumber}</p>
              </td>
              <td className="font-black tabular-nums">{leg.memberCount}</td>
              {(["deposit", "withdrawal", "bet"] as const).map((key) => (
                <td key={key} className={sortBy === key ? "bg-blue-50/70" : ""}>
                  <p className="font-black tabular-nums text-slate-900">
                    {money(leg[key].amount)}
                  </p>
                  <p className={sortBy === key ? "font-bold text-blue-700" : "text-slate-500"}>
                    {percent(leg[key].share)} · {leg[key].count} tx
                  </p>
                </td>
              ))}
              <td>
                <Link
                  href={`/greebuserrichadmin/users/${leg.id}?tab=userhub`}
                  className="whitespace-nowrap font-bold text-blue-600 hover:underline"
                >
                  Open Hub →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TeamDayAnalysisPanel({
  analysis,
  selectedDate,
  maxDate,
  sortBy,
  onDate,
  onSort,
  onPage,
}: {
  analysis: TeamDayAnalysis;
  selectedDate: string;
  maxDate: string;
  sortBy: SortMetric;
  onDate: (date: string) => void;
  onSort: (sort: SortMetric) => void;
  onPage: (page: number) => void;
}) {
  const selectedTeamMetric = analysis.team[sortBy];

  return (
    <div className="space-y-4">
      <div className="admin-surface flex flex-wrap items-end justify-between gap-3 p-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Team Performance</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            One completed IST day · 00:00–24:00
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            onClick={() => onDate(maxDate)}
            className={selectedDate === maxDate ? "admin-btn-primary text-xs" : "admin-btn-ghost text-xs"}
          >
            Yesterday
          </button>
          <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Reporting date
            <input
              type="date"
              value={selectedDate}
              max={maxDate}
              onChange={(event) => {
                if (event.target.value) onDate(event.target.value);
              }}
              className="admin-input mt-1 min-w-40 text-xs"
            />
          </label>
        </div>
      </div>

      <SummaryCard title="Self Performance" badge="Direct user" metrics={analysis.self} tone="indigo" />
      <SummaryCard
        title="Total Team Summary (Levels 1–6)"
        badge={`${analysis.team.memberCount} total members`}
        metrics={analysis.team}
        tone="purple"
      />

      {analysis.concentration.isConcentrated && analysis.concentration.leader && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-amber-700">
                Concentrated business
              </p>
              <p className="mt-1 text-sm font-bold">
                #{analysis.concentration.leader.serialNumber} {analysis.concentration.leader.username}
                {" holds "}
                {percent(analysis.concentration.leader.share)} of team deposits.
              </p>
            </div>
            <span className="rounded-full bg-amber-600 px-3 py-1 text-xs font-black text-white">
              Above {analysis.concentration.threshold}%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-amber-700">
            Informational only—this does not change salary, commission, or payouts.
          </p>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h4 className="text-sm font-black text-slate-900">L1 Business Contribution</h4>
            <p className="text-xs text-slate-500">
              Each direct includes their branch through this user&apos;s L6.
            </p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onSort(option.id)}
                className={`rounded-lg px-3 py-2 text-[11px] font-bold transition-colors ${
                  sortBy === option.id
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {analysis.pagination.total === 0 ? (
          <div className="admin-surface">
            <EmptyBlock label="No direct team for this user" />
          </div>
        ) : (
          <>
            {selectedTeamMetric.amount > 0 ? (
              <AdminHorizontalPercentChart
                title={`Top ${SORT_OPTIONS.find((item) => item.id === sortBy)?.label ?? "contribution"}`}
                data={analysis.chart}
              />
            ) : (
              <div className="admin-surface">
                <EmptyBlock label={`No ${sortBy} activity on this reporting day`} />
              </div>
            )}

            <div className="admin-surface p-3 sm:p-4">
              <LegCards legs={analysis.legs} sortBy={sortBy} page={analysis.pagination.page} />
              <LegTable legs={analysis.legs} sortBy={sortBy} page={analysis.pagination.page} />
              <Pagination
                page={analysis.pagination.page}
                totalPages={analysis.pagination.totalPages}
                onPage={onPage}
              />
            </div>
          </>
        )}
      </section>

      <section className="space-y-3 pt-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Downline Level Breakdown
        </h4>
        {analysis.levels.map((level) => (
          <div key={level.level} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h5 className="text-sm font-bold text-slate-800">Level {level.level}</h5>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                {level.memberCount} {level.memberCount === 1 ? "member" : "members"}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile label="Deposits" metric={level.deposit} color="emerald" />
              <MetricTile label="Withdrawals" metric={level.withdrawal} color="amber" />
              <MetricTile label="Bets" metric={level.bet} color="violet" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
