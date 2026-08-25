"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "../../lib/api";
import type {
  AutoSalaryClaimItem,
  SalaryDashboardData,
} from "../../lib/api";
import { formatDateTime, formatINR } from "../../lib/format";
import DatePickerSheet from "./shared/DatePickerSheet";
import { type DatePreset, rangeForPreset, ymdLocal } from "./dateRange";
import { AUTO_SALARY_LIVE, SALARY_DASHBOARD_NOTICE } from "../../lib/auto-salary";

interface Props {
  onBack: () => void;
  onOpenDepositGenealogy?: () => void;
}

function SalaryDashboardMaintenance({ onBack }: { onBack: () => void }) {
  return (
    <div className="sal-page">
      <header className="sal-topbar">
        <button type="button" className="sal-topbar-btn" onClick={onBack} aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="sal-topbar-title">Salary Dashboard</h1>
        <div className="sal-topbar-right">
          <span className="sal-topbar-spacer" />
        </div>
      </header>
      <div className="sal-topbar-spacer-flow" aria-hidden />
      <div className="sal-body">
        <div
          className="rounded-[14px] px-4 py-8 text-center"
          style={{
            background: "#201c26",
            border: "1px solid rgba(254,211,88,0.35)",
          }}
        >
          <p className="text-[15px] font-bold text-[#FED358] mb-2">Under maintenance</p>
          <p className="text-[14px] text-[#FDE4BC] leading-relaxed">{SALARY_DASHBOARD_NOTICE}</p>
        </div>
      </div>
    </div>
  );
}

export default function SalaryDashboardPage(props: Props) {
  if (!AUTO_SALARY_LIVE) {
    return <SalaryDashboardMaintenance onBack={props.onBack} />;
  }
  return <SalaryDashboardLive {...props} />;
}

const HISTORY_PRESETS: { id: DatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "day_before", label: "Day before" },
  { id: "this_week", label: "This week" },
  { id: "last_week", label: "Last week" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
];

/**
 * Fallback slabs (Highest Slab Fully Met Is Paid).
 * Keep in sync with backend AUTO_SALARY_SLABS.
 */
const FALLBACK_SLAB_DEFS = [
  { reward: 300, direct: 2, active: 3, teamDeposit: 6_000 },
  { reward: 500, direct: 3, active: 6, teamDeposit: 10_000 },
  { reward: 800, direct: 3, active: 10, teamDeposit: 18_000 },
  { reward: 1_200, direct: 4, active: 14, teamDeposit: 30_000 },
  { reward: 2_000, direct: 5, active: 22, teamDeposit: 50_000 },
  { reward: 3_000, direct: 6, active: 52, teamDeposit: 80_000 },
  { reward: 4_500, direct: 6, active: 84, teamDeposit: 150_000 },
  { reward: 6_000, direct: 6, active: 124, teamDeposit: 200_000 },
  { reward: 10_000, direct: 6, active: 206, teamDeposit: 400_000 },
  { reward: 20_000, direct: 6, active: 406, teamDeposit: 1_000_000 },
  { reward: 50_000, direct: 6, active: 759, teamDeposit: 1_800_000 },
  { reward: 100_000, direct: 6, active: 1_509, teamDeposit: 3_000_000 },
] as const;

const FALLBACK_SLABS = FALLBACK_SLAB_DEFS.map((s, index) => ({
  index,
  reward: s.reward,
  direct: s.direct,
  active: s.active,
  teamDeposit: s.teamDeposit,
  unlocked: false,
}));

const FIRST_SLAB = FALLBACK_SLAB_DEFS[0]!;

const EMPTY_DASH: SalaryDashboardData = {
  timezone: "Asia/Kolkata",
  todayYmd: ymdLocal(),
  willReceive: 0,
  totalReceived: 0,
  pendingTotal: 0,
  pendingCount: 0,
  approvedCount: 0,
  status: "on_hold",
  statusLabel: "On hold — complete the steps below",
  metrics: {
    direct: 0,
    teamL1to6: 0,
    active: 0,
    yesterdaySalary: 0,
    yesterdaySalaryStatus: null,
    todayTeamDeposit: 0,
    yesterdayTeamDeposit: 0,
    dayBeforeTeamDeposit: 0,
  },
  slabs: FALLBACK_SLABS,
  matchedSlab: null,
  nextSlab: {
    reward: FIRST_SLAB.reward,
    directNeed: FIRST_SLAB.direct,
    activeNeed: FIRST_SLAB.direct + FIRST_SLAB.active,
    depositNeed: FIRST_SLAB.teamDeposit,
  },
  eligibility: [
    {
      id: "business_report",
      title: "Business report positive",
      ok: true,
      detail: "Your team business report is healthy.",
    },
    {
      id: "business_balanced",
      title: "Business balanced (top leg ≤ 80%)",
      ok: false,
      detail: "Needs at least 2 direct legs — start building your second leg.",
    },
    {
      id: "active_members",
      title: "Active members (direct/indirect)",
      ok: false,
      detail: "0 active (need ≥5 total, ≥2 active L1). Bet ≥₹150 in last 24h.",
    },
    {
      id: "shared_ip",
      title: "Shared-IP accounts",
      ok: true,
      detail: "No shared-IP accounts in your team.",
    },
    {
      id: "shared_bank",
      title: "Shared bank accounts",
      ok: true,
      detail: "No shared bank accounts in your team.",
    },
    {
      id: "cross_trading",
      title: "Cross-trading",
      ok: true,
      detail: "No cross-trading flags on your team.",
    },
  ],
  howto: [
    {
      id: "direct",
      title: `Get ${FIRST_SLAB.direct} more active directs`,
      body: `${FIRST_SLAB.direct} Level-1 members must bet at least ₹150 in the last 24 hours. Empty invites do not count.`,
    },
    {
      id: "active",
      title: `Get ${FIRST_SLAB.direct + FIRST_SLAB.active} active members`,
      body: `Need ${FIRST_SLAB.direct + FIRST_SLAB.active} actives in total (≥${FIRST_SLAB.direct} L1). Extra can be more directs or L2–L6.`,
    },
    {
      id: "deposit",
      title: `Bring ₹${FIRST_SLAB.teamDeposit.toLocaleString("en-IN")} more team deposit`,
      body: `Your team needs ₹${FIRST_SLAB.teamDeposit.toLocaleString("en-IN")} more in deposits in a single day. Only one day’s deposits are counted.`,
    },
  ],
  claim: null,
  yesterdayClaim: null,
};

function shortInr(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
  }
  return String(n);
}

function SalaryDashboardLive({
  onBack,
  onOpenDepositGenealogy,
}: Props) {
  const [dash, setDash] = useState<SalaryDashboardData>(EMPTY_DASH);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [eligOpen, setEligOpen] = useState(true);
  const [histPreset, setHistPreset] = useState<DatePreset>("today");
  const [customOpen, setCustomOpen] = useState(false);
  const [customDate, setCustomDate] = useState(ymdLocal());
  const [claims, setClaims] = useState<AutoSalaryClaimItem[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  const loadDash = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.getSalaryDashboard();
      if (signal?.aborted) return;
      if (res?.data) {
        setDash({
          ...EMPTY_DASH,
          ...res.data,
          totalReceived: Number(res.data.totalReceived ?? 0),
          pendingTotal: Number(res.data.pendingTotal ?? 0),
          pendingCount: Number(res.data.pendingCount ?? 0),
          approvedCount: Number(res.data.approvedCount ?? 0),
          metrics: { ...EMPTY_DASH.metrics, ...res.data.metrics },
          slabs:
            res.data.slabs?.length > 0 ? res.data.slabs : EMPTY_DASH.slabs,
          eligibility:
            res.data.eligibility?.length > 0
              ? res.data.eligibility
              : EMPTY_DASH.eligibility,
          howto:
            res.data.howto?.length > 0 ? res.data.howto : EMPTY_DASH.howto,
        });
      }
    } catch (e: unknown) {
      if (signal?.aborted) return;
      setLoadError(
        e instanceof Error ? e.message : "Could not load live salary data"
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const range =
        histPreset === "custom"
          ? rangeForPreset("custom", { start: customDate, end: customDate })
          : rangeForPreset(histPreset);
      const res = await api.getSalary({
        page: 1,
        limit: 50,
        startDate: range.startDate,
        endDate: range.endDate,
        status: "ALL",
      });
      setClaims(res.claims ?? []);
    } catch {
      setClaims([]);
    } finally {
      setHistLoading(false);
    }
  }, [histPreset, customDate]);

  useEffect(() => {
    const ac = new AbortController();
    void loadDash(ac.signal);
    return () => ac.abort();
  }, [loadDash]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const m = dash.metrics;
  const failCount = useMemo(
    () => dash.eligibility.filter((e) => !e.ok).length,
    [dash.eligibility]
  );

  return (
    <div className="sal-page">
      {/* Orange header — matches screenshot */}
      <header className="sal-topbar">
        <button type="button" className="sal-topbar-btn" onClick={onBack} aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="sal-topbar-title">Salary Dashboard</h1>
        <div className="sal-topbar-right">
          {onOpenDepositGenealogy ? (
            <button
              type="button"
              className="sal-topbar-btn"
              onClick={onOpenDepositGenealogy}
              aria-label="Deposit genealogy"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="6" cy="6" r="2.2" />
                <circle cx="18" cy="6" r="2.2" />
                <circle cx="12" cy="18" r="2.2" />
                <path d="M8 7.5L11 16M16 7.5L13 16" strokeLinecap="round" />
              </svg>
            </button>
          ) : (
            <span className="sal-topbar-spacer" />
          )}
        </div>
      </header>
      <div className="sal-topbar-spacer-flow" aria-hidden />

      <div className="sal-body">
        {loading && (
          <p className="sal-loading-line">Updating live data…</p>
        )}
        {loadError && (
          <div className="sal-api-banner">
            <span>Live data unavailable — showing layout. {loadError}</span>
            <button type="button" onClick={() => void loadDash()}>
              Retry
            </button>
          </div>
        )}

        {/* Total salary received (career) */}
        <div className="sal-total-card">
          <p className="sal-total-lab">Total salary received</p>
          <p className="sal-total-amt">{formatINR(dash.totalReceived ?? 0)}</p>
        </div>

        <div className="sal-hero">
          <p className="sal-hero-label">
            {dash.status === "pending"
              ? "Pending approval"
              : dash.status === "paid"
                ? "Latest salary"
                : "I will receive"}
          </p>
          <p className="sal-hero-amount">{formatINR(dash.willReceive, 0)}</p>
          <div className="sal-hero-status">
            <span className="sal-hero-status-dot" data-status={dash.status} />
            {dash.statusLabel}
          </div>
        </div>

        {/* Stat chips */}
        <div className="sal-chip-grid">
          <div className="sal-chip">
            <p className="sal-chip-val">{m.direct}</p>
            <p className="sal-chip-lab">ACTIVE L1</p>
          </div>
          <div className="sal-chip">
            <p className="sal-chip-val">{m.teamL1to6}</p>
            <p className="sal-chip-lab">TEAM L1-6</p>
          </div>
          <div className="sal-chip">
            <p className="sal-chip-val">{m.active}</p>
            <p className="sal-chip-lab">ACTIVE</p>
          </div>
          <div className="sal-chip">
            <p className="sal-chip-val">{formatINR(m.yesterdaySalary, 0)}</p>
            <p className="sal-chip-lab">
              YDAY
              {m.yesterdaySalaryStatus
                ? ` · ${String(m.yesterdaySalaryStatus).slice(0, 4)}`
                : ""}
            </p>
          </div>
        </div>

        <div className="sal-dep-grid">
          <div className="sal-dep">
            <p className="sal-dep-val">{formatINR(m.todayTeamDeposit, 0)}</p>
            <p className="sal-dep-lab">TODAY&apos;S TEAM DEPOSIT</p>
          </div>
          <div className="sal-dep">
            <p className="sal-dep-val">{formatINR(m.yesterdayTeamDeposit, 0)}</p>
            <p className="sal-dep-lab">YESTERDAY&apos;S TEAM DEPOSIT</p>
          </div>
          <div className="sal-dep">
            <p className="sal-dep-val">{formatINR(m.dayBeforeTeamDeposit, 0)}</p>
            <p className="sal-dep-lab">DBY&apos;S TEAM DEPOSIT</p>
          </div>
        </div>

        {/* Levels */}
        <section className="sal-card">
          <h2 className="sal-card-title">Salary levels</h2>
          <div className="sal-levels">
            <div className="sal-levels-track" />
            {dash.slabs.map((s) => (
              <div
                key={s.index}
                className={[
                  "sal-level-node",
                  s.unlocked ? "is-on" : "",
                  dash.matchedSlab?.index === s.index ? "is-current" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="sal-level-dot" />
                <span className="sal-level-lab">{shortInr(s.reward)}</span>
              </div>
            ))}
          </div>
          <p className="sal-levels-hint">
            {dash.matchedSlab
              ? `Current level pays ${formatINR(dash.matchedSlab.reward, 0)}/day when eligibility is green.`
              : `Reach the first level to start earning ${formatINR(dash.slabs[0]?.reward ?? 300, 0)}/day.`}
          </p>
        </section>

        {/* Eligibility */}
        <section className="sal-card">
          <button
            type="button"
            className="sal-card-head-btn"
            onClick={() => setEligOpen((v) => !v)}
          >
            <h2 className="sal-card-title">Eligibility check</h2>
            <span className={`sal-badge ${failCount > 0 ? "is-warn" : "is-ok"}`}>
              {failCount > 0 ? "Action needed" : "All clear"}{" "}
              {eligOpen ? "▴" : "▾"}
            </span>
          </button>
          {eligOpen && (
            <ul className="sal-elig-list">
              {dash.eligibility.map((e) => (
                <li
                  key={e.id}
                  className={`sal-elig-row ${e.ok ? "is-ok" : "is-bad"}`}
                >
                  <span className="sal-elig-icon" aria-hidden>
                    {e.ok ? "✓" : "✕"}
                  </span>
                  <div>
                    <p className="sal-elig-title">{e.title}</p>
                    <p className="sal-elig-detail">{e.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {failCount > 0 && (
          <div className="sal-warn-banner">
            <span aria-hidden>⚠</span>
            Cover the missing points before 12:00 midnight to be eligible for
            tomorrow&apos;s salary.
          </div>
        )}

        {/* How to */}
        {dash.howto.length > 0 && (
          <section className="sal-card sal-howto">
            <div className="sal-howto-head">
              <span className="sal-howto-alert" aria-hidden>
                ⚠
              </span>
              <div>
                <h2 className="sal-card-title">How to receive salary</h2>
                <p className="sal-howto-sub">
                  Complete the steps below to become eligible.
                </p>
              </div>
            </div>
            <ul className="sal-howto-list">
              {dash.howto.map((h) => (
                <li key={h.id} className="sal-howto-item">
                  <p className="sal-howto-title">{h.title}</p>
                  <p className="sal-howto-body">{h.body}</p>
                </li>
              ))}
            </ul>
            <p className="sal-howto-foot">
              Cover these before 12:00 midnight so they count for tomorrow&apos;s
              salary.
            </p>
          </section>
        )}

        <section className="sal-card">
          <h2 className="sal-card-title">Salary history</h2>
          <div className="sal-chips">
            {HISTORY_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`sal-chip-btn ${histPreset === p.id ? "is-on" : ""}`}
                onClick={() => setHistPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              className={`sal-chip-btn ${histPreset === "custom" ? "is-on" : ""}`}
              onClick={() => {
                setHistPreset("custom");
                setCustomOpen(true);
              }}
            >
              📅 Pick date
            </button>
          </div>

          {histLoading ? (
            <p className="sal-empty">Loading…</p>
          ) : claims.length === 0 ? (
            <p className="sal-empty">No salary records in this period.</p>
          ) : (
            <ul className="sal-pay-list">
              {claims.map((c) => (
                <li key={c.id} className="sal-pay-row">
                  <div className="min-w-0">
                    <p className="sal-pay-amt">{formatINR(c.amount)}</p>
                    <p className="sal-pay-date">
                      {c.periodDate}
                      {" · "}
                      {formatDateTime(c.reviewedAt || c.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`sal-pay-tag sal-pay-tag--${c.status.toLowerCase()}`}
                  >
                    {c.status === "APPROVED"
                      ? "Salary received"
                      : c.status === "PENDING"
                        ? "Credit pending"
                        : "Rejected"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <DatePickerSheet
        open={customOpen}
        value={customDate}
        onCancel={() => setCustomOpen(false)}
        onConfirm={(d) => {
          setCustomDate(d);
          setHistPreset("custom");
          setCustomOpen(false);
        }}
      />
    </div>
  );
}
