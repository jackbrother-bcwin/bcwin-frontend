"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "../../lib/api";
import type {
  CommissionBreakdownItem,
  CommissionRateRow,
  DailyCommissionRow,
  TeamMember,
} from "../../lib/api";
import { formatDateTime, formatINR, roundMoney } from "../../lib/format";
import AgencyHeader from "./shared/AgencyHeader";
import DatePickerSheet from "./shared/DatePickerSheet";
import EmptyState from "./shared/EmptyState";
import {
  type DatePreset,
  formatRatePct,
  rangeForPreset,
  ymdLocal,
} from "./dateRange";

interface Props {
  onBack: () => void;
}

type BottomTab = "commissions" | "subordinate";
type GroupMode = "list" | "daily" | "weekly" | "monthly";

const LEVEL_PRESETS: { id: DatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "day_before", label: "Day before" },
];

const LIST_PRESETS: { id: DatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "day_before", label: "Day before" },
  { id: "this_week", label: "This week" },
  { id: "this_month", label: "This month" },
  { id: "all", label: "All" },
];

function sumDaily(
  rows: DailyCommissionRow[],
  pred: (ymd: string) => boolean
): number {
  return rows
    .filter((r) => pred(r.date))
    .reduce((a, r) => a + Number(r.totalCommission || 0), 0);
}

function inRange(ymd: string, start?: string, end?: string): boolean {
  if (start && ymd < start) return false;
  if (end && ymd > end) return false;
  return true;
}

export default function AgentCommissionPage({ onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [daily, setDaily] = useState<DailyCommissionRow[]>([]);
  const [rates, setRates] = useState<CommissionRateRow[]>([]);
  /** Agency rebate tier (not XP VIP) — keys lottery L1–L6 rates */
  const [rebateLevel, setRebateLevel] = useState(0);
  const [teamSize, setTeamSize] = useState(0);
  const [teamBetting, setTeamBetting] = useState(0);
  const [lifetime, setLifetime] = useState(0);
  /** Today IST: settled vs accrued (not in wallet / TX) */
  const [todayCredited, setTodayCredited] = useState(0);
  const [todayPending, setTodayPending] = useState(0);

  const [levelPreset, setLevelPreset] = useState<DatePreset>("today");
  const [levelCustom, setLevelCustom] = useState(ymdLocal());
  const [levelDateOpen, setLevelDateOpen] = useState(false);
  const [levelSummary, setLevelSummary] = useState<
    Record<string, { commission: number; bet: number; users: number }>
  >({});

  const [bottomTab, setBottomTab] = useState<BottomTab>("commissions");
  const [listPreset, setListPreset] = useState<DatePreset>("today");
  const [listCustom, setListCustom] = useState(ymdLocal());
  const [listDateOpen, setListDateOpen] = useState(false);
  const [groupMode, setGroupMode] = useState<GroupMode>("list");
  const [layerFilter, setLayerFilter] = useState<number | "all">("all");
  const [rows, setRows] = useState<CommissionBreakdownItem[]>([]);
  const [listSummary, setListSummary] = useState({
    commission: 0,
    betVolume: 0,
    bets: 0,
    bettors: 0,
  });
  const [listLoading, setListLoading] = useState(false);
  const [subs, setSubs] = useState<TeamMember[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  /** Expanded person keys in list mode (fromUserId or username|layer) */
  const [expandedPeople, setExpandedPeople] = useState<Set<string>>(
    () => new Set()
  );
  /** Per-person bet detail pages (API paginated on expand) */
  const DETAIL_PAGE_SIZE = 10;
  type PersonDetailState = {
    page: number;
    totalPages: number;
    total: number;
    items: CommissionBreakdownItem[];
    loading: boolean;
  };
  const [personDetails, setPersonDetails] = useState<
    Record<string, PersonDetailState>
  >({});

  const loadOverview = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      // ADR-0011: agency “commission” = team rebate (accrual + 01:30 IST settle)
      const [rebateHist, ratesRes, overview, vipRes] = await Promise.all([
        // Include unsettled so Today/list show incoming rebate (not wallet/TX)
        api.getRebateHistory({ page: 1, limit: 500, settled: "all" }),
        api.getRebateRates().catch(() => null),
        api.getTeamOverview().catch(() => null),
        api.getVipStatus().catch(() => null),
      ]);
      if (signal?.aborted) return;

      // Build daily totals from rebate rows (createdAt IST day)
      const byDay = new Map<string, number>();
      const todayYmd = ymdLocal();
      let credited = 0;
      let pending = 0;
      for (const r of rebateHist.data ?? []) {
        const d = String(r.createdAt ?? "").slice(0, 10);
        if (!d) continue;
        const amt = Number(r.amount ?? 0);
        byDay.set(d, roundMoney((byDay.get(d) ?? 0) + amt, 3));
        if (d === todayYmd) {
          if (r.settled) credited += amt;
          else pending += amt;
        }
      }
      setTodayCredited(roundMoney(credited, 3));
      setTodayPending(roundMoney(pending, 3));
      const dailyRows: DailyCommissionRow[] = [...byDay.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([date, totalCommission]) => ({
          date,
          totalCommission: roundMoney(totalCommission, 3),
          layer1Commission: 0,
          layer2Commission: 0,
          layer3Commission: 0,
          layer4Commission: 0,
          layer5Commission: 0,
          layer6Commission: 0,
        }));
      setDaily(dailyRows);

      // Map lottery rates → CommissionRateRow shape for existing UI
      const lottery = ratesRes?.data?.lottery ?? [];
      setRates(
        lottery.map((row) => ({
          vipLevel: row.vipLevel,
          layer1: row.layer1,
          layer2: row.layer2,
          layer3: row.layer3,
          layer4: row.layer4,
          layer5: row.layer5,
          layer6: row.layer6,
        })) as CommissionRateRow[]
      );

      if (overview?.data) {
        setTeamSize(Number(overview.data.totalTeamSize ?? 0));
        setTeamBetting(Number(overview.data.totalTeamBetting ?? 0));
        // Settled rebates (lifetime) from team overview after ADR-0011
        setLifetime(Number(overview.data.totalCommissionEarned ?? 0));
      }
      // ADR-0012: tier for rates = rebateLevel (team ladder), not XP currentLevel
      const rl = Number(
        (vipRes?.data as { rebateLevel?: number } | undefined)?.rebateLevel ??
          vipRes?.data?.currentLevel ??
          0
      );
      if (Number.isFinite(rl)) setRebateLevel(rl);
    } catch {
      if (!signal?.aborted) {
        setDaily([]);
        setRates([]);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void loadOverview(ac.signal);
    return () => ac.abort();
  }, [loadOverview]);

  // Commission by level for selected day
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const range =
        levelPreset === "custom"
          ? rangeForPreset("custom", { start: levelCustom, end: levelCustom })
          : rangeForPreset(levelPreset);
      try {
        const res = await api.getRebateHistory({
          startDate: range.startDate,
          endDate: range.endDate,
          settled: "all",
          page: 1,
          limit: 500,
        });
        if (cancelled) return;
        const data = res.data ?? [];
        const map: Record<
          string,
          { commission: number; bet: number; users: Set<string> }
        > = {};
        for (let i = 1; i <= 6; i++) {
          map[`L${i}`] = { commission: 0, bet: 0, users: new Set() };
        }
        for (const r of data) {
          const L = `L${r.layer ?? 0}`;
          if (!map[L]) continue;
          map[L]!.commission = roundMoney(
            map[L]!.commission + Number(r.amount ?? 0),
            3
          );
          map[L]!.bet = roundMoney(map[L]!.bet + Number(r.betAmount ?? 0), 3);
          if (r.fromUser?.id) map[L]!.users.add(r.fromUser.id);
        }
        const out: typeof levelSummary = {};
        for (const [k, v] of Object.entries(map)) {
          out[k] = {
            commission: v.commission,
            bet: v.bet,
            users: v.users.size,
          };
        }
        setLevelSummary(out);
      } catch {
        if (!cancelled) setLevelSummary({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [levelPreset, levelCustom]);

  // List / subordinate loaders
  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const range =
        listPreset === "custom"
          ? rangeForPreset("custom", { start: listCustom, end: listCustom })
          : rangeForPreset(listPreset);
      // Accrued + settled (pending today visible; wallet/TX still settled-only)
      const res = await api.getRebateHistory({
        startDate: range.startDate,
        endDate: range.endDate,
        settled: "all",
        page: 1,
        limit: 100,
      });
      let data = (res.data ?? []).map(
        (r): CommissionBreakdownItem => ({
          id: r.id,
          layer: r.layer ?? 0,
          commissionAmount: Number(r.amount ?? 0),
          amount: Number(r.amount ?? 0),
          betAmount: Number(r.betAmount ?? 0),
          commissionRate: Number(r.rate ?? 0),
          fromUser: r.fromUser
            ? {
                id: String(r.fromUser.id ?? ""),
                username: String(r.fromUser.username ?? ""),
                ...(r.fromUser.serialNumber != null
                  ? { serialNumber: Number(r.fromUser.serialNumber) }
                  : {}),
              }
            : undefined,
          createdAt: r.createdAt,
          betType: r.game,
          settled: r.settled,
        })
      );
      if (layerFilter !== "all") {
        data = data.filter((r) => Number(r.layer) === layerFilter);
      }
      setRows(data);
      const bettors = new Set<string>();
      let betVolume = 0;
      let commission = 0;
      for (const r of data) {
        commission = roundMoney(
          commission + Number(r.commissionAmount ?? r.amount ?? 0),
          3
        );
        betVolume = roundMoney(betVolume + Number(r.betAmount ?? 0), 3);
        if (r.fromUser?.id) bettors.add(r.fromUser.id);
      }
      setListSummary({
        commission,
        betVolume,
        bets: data.length,
        bettors: bettors.size,
      });
    } catch {
      setRows([]);
      setListSummary({ commission: 0, betVolume: 0, bets: 0, bettors: 0 });
    } finally {
      setListLoading(false);
    }
  }, [listPreset, listCustom, layerFilter]);

  useEffect(() => {
    if (bottomTab === "commissions") void loadList();
  }, [bottomTab, loadList]);

  useEffect(() => {
    if (bottomTab !== "subordinate") return;
    let cancelled = false;
    setSubsLoading(true);
    (async () => {
      try {
        const res = await api.getTeamMembers({ page: 1, limit: 50 });
        if (cancelled) return;
        setSubs(res.data ?? []);
      } catch {
        if (!cancelled) setSubs([]);
      } finally {
        if (!cancelled) setSubsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bottomTab]);

  const today = ymdLocal();
  const yesterday = rangeForPreset("yesterday").startDate!;
  const week = rangeForPreset("this_week");
  const month = rangeForPreset("this_month");

  const todayLive = useMemo(
    () => sumDaily(daily, (d) => d === today),
    [daily, today]
  );
  const yestTotal = useMemo(
    () => sumDaily(daily, (d) => d === yesterday),
    [daily, yesterday]
  );
  const weekTotal = useMemo(
    () =>
      sumDaily(daily, (d) => inRange(d, week.startDate, week.endDate)),
    [daily, week.startDate, week.endDate]
  );
  const monthTotal = useMemo(
    () =>
      sumDaily(daily, (d) => inRange(d, month.startDate, month.endDate)),
    [daily, month.startDate, month.endDate]
  );

  // Chart points last 30 days
  const chart = useMemo(() => {
    const map = new Map(daily.map((r) => [r.date, r.totalCommission]));
    const pts: { date: string; v: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ymd = ymdLocal(d);
      pts.push({ date: ymd, v: Number(map.get(ymd) ?? 0) });
    }
    return pts;
  }, [daily]);

  const maxChart = Math.max(1, ...chart.map((p) => p.v));

  const myRates = useMemo(() => {
    // Real lottery RebateRateConfig row for this user's rebate tier
    const row =
      rates.find((r) => r.vipLevel === rebateLevel) ??
      rates.find((r) => r.vipLevel === 0) ??
      rates[0];
    if (!row) {
      // Lottery VIP0 from seed (percent points) if rates API empty
      return [0.5, 0.15, 0.0512, 0.0162, 0.00486, 0.001458];
    }
    return [
      row.layer1,
      row.layer2,
      row.layer3,
      row.layer4,
      row.layer5,
      row.layer6,
    ];
  }, [rates, rebateLevel]);

  const exportCsv = () => {
    const header = "date,from,layer,bet,commission,rate\n";
    const body = rows
      .map((r) =>
        [
          r.createdAt ?? "",
          r.fromUser?.username ?? "",
          r.layer ?? "",
          r.betAmount ?? "",
          r.commissionAmount ?? r.amount ?? "",
          r.commissionRate ?? "",
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commission-${ymdLocal()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * List mode: one row per downline.
   * Collapsed totals from list batch; expand loads paginated bets via fromUserId.
   */
  type PersonGroup = {
    key: string;
    fromUserId: string;
    username: string;
    layer: number;
    betVolume: number;
    commission: number;
    bets: number;
  };

  const personGroups = useMemo((): PersonGroup[] => {
    if (groupMode !== "list") return [];
    const map = new Map<string, PersonGroup>();
    for (const r of rows) {
      const uid = String(r.fromUser?.id ?? "").trim();
      const username = String(r.fromUser?.username ?? "—");
      const layer = Number(r.layer ?? 0);
      const key = uid || `${username}|L${layer}`;
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          fromUserId: uid,
          username,
          layer,
          betVolume: 0,
          commission: 0,
          bets: 0,
        };
        map.set(key, g);
      }
      g.betVolume = roundMoney(g.betVolume + Number(r.betAmount ?? 0), 3);
      g.commission = roundMoney(
        g.commission + Number(r.commissionAmount ?? r.amount ?? 0),
        3
      );
      g.bets += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.commission - a.commission);
  }, [rows, groupMode]);

  const mapRebateToItem = (r: api.RebateRecord): CommissionBreakdownItem => ({
    id: r.id,
    layer: r.layer ?? 0,
    commissionAmount: Number(r.amount ?? 0),
    amount: Number(r.amount ?? 0),
    betAmount: Number(r.betAmount ?? 0),
    commissionRate: Number(r.rate ?? 0),
    fromUser: r.fromUser
      ? {
          id: String(r.fromUser.id ?? ""),
          username: String(r.fromUser.username ?? ""),
          ...(r.fromUser.serialNumber != null
            ? { serialNumber: Number(r.fromUser.serialNumber) }
            : {}),
        }
      : undefined,
    createdAt: r.createdAt,
    betType: r.game,
    settled: r.settled,
  });

  const loadPersonDetail = useCallback(
    async (g: PersonGroup, page: number) => {
      if (!g.fromUserId) {
        // No UUID — cannot page via API; empty detail
        setPersonDetails((prev) => ({
          ...prev,
          [g.key]: {
            page: 1,
            totalPages: 1,
            total: 0,
            items: [],
            loading: false,
          },
        }));
        return;
      }
      setPersonDetails((prev) => ({
        ...prev,
        [g.key]: {
          page,
          totalPages: prev[g.key]?.totalPages ?? 1,
          total: prev[g.key]?.total ?? 0,
          items: prev[g.key]?.items ?? [],
          loading: true,
        },
      }));
      try {
        const range =
          listPreset === "custom"
            ? rangeForPreset("custom", {
                start: listCustom,
                end: listCustom,
              })
            : rangeForPreset(listPreset);
        const res = await api.getRebateHistory({
          startDate: range.startDate,
          endDate: range.endDate,
          settled: "all",
          fromUserId: g.fromUserId,
          layer: g.layer > 0 ? g.layer : undefined,
          page,
          limit: DETAIL_PAGE_SIZE,
        });
        const items = (res.data ?? []).map(mapRebateToItem);
        setPersonDetails((prev) => ({
          ...prev,
          [g.key]: {
            page: Number(res.currentPage ?? page),
            totalPages: Math.max(1, Number(res.totalPages ?? 1)),
            total: Number(res.total ?? items.length),
            items,
            loading: false,
          },
        }));
      } catch {
        setPersonDetails((prev) => ({
          ...prev,
          [g.key]: {
            page,
            totalPages: 1,
            total: 0,
            items: [],
            loading: false,
          },
        }));
      }
    },
    [listPreset, listCustom]
  );

  const togglePerson = (g: PersonGroup) => {
    setExpandedPeople((prev) => {
      const next = new Set(prev);
      if (next.has(g.key)) {
        next.delete(g.key);
      } else {
        next.add(g.key);
        // Fetch page 1 when opening (always refresh for current filters)
        void loadPersonDetail(g, 1);
      }
      return next;
    });
  };

  // Clear detail cache when list filters change
  useEffect(() => {
    setPersonDetails({});
    setExpandedPeople(new Set());
  }, [listPreset, listCustom, layerFilter]);

  // group display for daily/weekly/monthly modes
  const grouped = useMemo(() => {
    if (groupMode === "list") return null;
    const buckets = new Map<string, number>();
    for (const r of rows) {
      const raw = r.createdAt ? r.createdAt.slice(0, 10) : "unknown";
      let key = raw;
      if (groupMode === "weekly" && raw.length === 10) {
        const d = new Date(raw + "T12:00:00");
        const day = d.getDay();
        const monOff = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + monOff);
        key = `W ${ymdLocal(d)}`;
      } else if (groupMode === "monthly" && raw.length === 10) {
        key = raw.slice(0, 7);
      }
      buckets.set(
        key,
        (buckets.get(key) ?? 0) + Number(r.commissionAmount ?? r.amount ?? 0)
      );
    }
    return [...buckets.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [rows, groupMode]);

  return (
    <div className="agency-page">
      <AgencyHeader title="Agent Commission" onBack={onBack} />

      <div className="agency-scroll dash-scroll">
        {loading && daily.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-amber-400/70 gap-3">
            <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold">Loading commission data...</p>
          </div>
        ) : (
          <>
            {/* Today hero */}
            <div className="relative overflow-hidden rounded-2xl p-5 mx-3 mt-3 bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/15 border border-amber-400/20">
              <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-black/20 text-amber-200 border border-white/10 backdrop-blur-sm">
                    Today (Live)
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <p className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight drop-shadow-sm my-1">
                  {formatINR(todayLive)}
                </p>
                <p className="text-xs font-medium text-amber-100/90 flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {formatINR(todayCredited)} credited
                  <span className="opacity-50">·</span>
                  <span className="opacity-80">
                    {formatINR(todayPending)} pending
                  </span>
                </p>
                <p className="text-[10px] text-amber-100/70 mt-1">
                  Pending settles ~01:30 IST — not in wallet or TX yet
                </p>
              </div>
            </div>

            {/* Stat grid */}
            <div className="grid grid-cols-2 gap-2.5 mx-3 mt-3">
              <StatCard label="YESTERDAY" value={formatINR(yestTotal)} />
              <StatCard label="THIS WEEK" value={formatINR(weekTotal)} />
              <StatCard label="THIS MONTH" value={formatINR(monthTotal)} />
              <StatCard label="TOTAL INCOME" value={formatINR(lifetime)} highlight />
            </div>

            {/* Downline banner */}
            <div className="mx-3 mt-3 p-4 rounded-xl bg-[#1e181c] border border-white/5 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-2xl font-black text-amber-300 font-mono tracking-tight">{teamSize}</p>
                <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase mt-0.5">
                  Total Downline (L1–L6)
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-white font-mono">{formatINR(teamBetting)}</p>
                <p className="text-[10px] font-medium text-gray-400 mt-0.5">Total Bet Volume</p>
              </div>
            </div>

            {/* Trend chart */}
            <section className="dash-card">
              <h2 className="dash-card-title">Earnings trend (30 days)</h2>
              <div className="comm-chart" role="img" aria-label="30 day earnings">
                {chart.map((p) => (
                  <div key={p.date} className="comm-chart-col" title={`${p.date}: ${formatINR(p.v)}`}>
                    <div
                      className="comm-chart-bar"
                      style={{
                        height: `${Math.max(2, (p.v / maxChart) * 100)}%`,
                        opacity: p.v > 0 ? 1 : 0.25,
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="comm-chart-axis">
                <span>{chart[0]?.date.slice(5)}</span>
                <span>{chart[Math.floor(chart.length / 2)]?.date.slice(5)}</span>
                <span>{chart[chart.length - 1]?.date.slice(5)}</span>
              </div>
            </section>

            {/* Tier & rates — rebateLevel + lottery L1–L6 (ADR-0012) */}
            <section className="dash-card">
              <h2 className="dash-card-title">Your tier & rates</h2>
              <p className="comm-tier-line">
                Rebate tier L{rebateLevel}
                {rebateLevel < 10 ? (
                  <span className="text-white/40">
                    {" "}
                    · next: L{rebateLevel + 1}
                  </span>
                ) : null}
              </p>
              <p className="text-[10px] text-white/35 mb-2">
                Lottery team-rebate rates for your rebate tier (not XP VIP)
              </p>
              <div className="comm-rate-grid">
                {myRates.map((r, i) => (
                  <span key={i} className="comm-rate-pill">
                    L{i + 1}: {formatRatePct(r)}
                  </span>
                ))}
              </div>
            </section>

            {/* Commission by level */}
            <section className="dash-card">
              <h2 className="dash-card-title">Commission by level</h2>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none mb-3">
                {LEVEL_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                      levelPreset === p.id
                        ? "bg-gradient-to-r from-amber-400 to-yellow-400 text-black shadow-sm shadow-amber-500/20"
                        : "bg-[#231b21] text-gray-300 hover:text-white border border-white/5"
                    }`}
                    onClick={() => setLevelPreset(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1 ${
                    levelPreset === "custom"
                      ? "bg-gradient-to-r from-amber-400 to-yellow-400 text-black shadow-sm shadow-amber-500/20"
                      : "bg-[#231b21] text-gray-300 hover:text-white border border-white/5"
                  }`}
                  onClick={() => {
                    setLevelPreset("custom");
                    setLevelDateOpen(true);
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Pick date
                </button>
              </div>

              <ul className="comm-level-list">
                {Array.from({ length: 6 }, (_, i) => {
                  const key = `L${i + 1}`;
                  const row = levelSummary[key] ?? {
                    commission: 0,
                    bet: 0,
                    users: 0,
                  };
                  return (
                    <li key={key} className="comm-level-row">
                      <span className="comm-level-badge">{key}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-emerald-400 font-extrabold text-sm font-mono">
                          {formatINR(row.commission)}
                        </p>
                        <p className="comm-level-meta">
                          {row.users} users · {formatINR(row.bet)} bets
                        </p>
                        <div className="comm-level-bar">
                          <div
                            className="comm-level-bar-fill"
                            style={{
                              width: `${Math.min(
                                100,
                                row.commission > 0
                                  ? 20 +
                                      (row.commission /
                                        Math.max(
                                          1,
                                          ...Object.values(levelSummary).map(
                                            (x) => x.commission
                                          )
                                        )) *
                                        80
                                  : 0
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Bottom main tabs */}
            <div className="flex gap-2 mx-3 mt-4 p-1 rounded-full bg-[#1b1519] border border-white/10">
              <button
                type="button"
                className={`flex-1 py-2.5 rounded-full text-xs sm:text-sm font-black transition-all ${
                  bottomTab === "commissions"
                    ? "bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-md shadow-amber-500/20"
                    : "text-gray-400 hover:text-white"
                }`}
                onClick={() => setBottomTab("commissions")}
              >
                Commissions
              </button>
              <button
                type="button"
                className={`flex-1 py-2.5 rounded-full text-xs sm:text-sm font-black transition-all ${
                  bottomTab === "subordinate"
                    ? "bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-md shadow-amber-500/20"
                    : "text-gray-400 hover:text-white"
                }`}
                onClick={() => setBottomTab("subordinate")}
              >
                Subordinates
              </button>
            </div>

            {bottomTab === "commissions" && (
              <section className="dash-card mt-3">
                {/* Date presets slider */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none mb-2.5">
                  {LIST_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                        listPreset === p.id
                          ? "bg-gradient-to-r from-amber-400 to-yellow-400 text-black shadow-sm shadow-amber-500/20"
                          : "bg-[#231b21] text-gray-300 hover:text-white border border-white/5"
                      }`}
                      onClick={() => setListPreset(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1 ${
                      listPreset === "custom"
                        ? "bg-gradient-to-r from-amber-400 to-yellow-400 text-black shadow-sm shadow-amber-500/20"
                        : "bg-[#231b21] text-gray-300 hover:text-white border border-white/5"
                    }`}
                    onClick={() => {
                      setListPreset("custom");
                      setListDateOpen(true);
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </button>
                </div>

                {/* View modes & Level filters */}
                <div className="space-y-2 mb-3">
                  {/* Group Mode */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {(
                      [
                        ["list", "By person"],
                        ["daily", "Daily"],
                        ["weekly", "Weekly"],
                        ["monthly", "Monthly"],
                      ] as const
                    ).map(([id, lab]) => (
                      <button
                        key={id}
                        type="button"
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                          groupMode === id
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                            : "bg-white/[0.04] text-gray-400 hover:text-white border border-transparent"
                        }`}
                        onClick={() => setGroupMode(id)}
                      >
                        {lab}
                      </button>
                    ))}
                  </div>

                  {/* Level Filter */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    <button
                      type="button"
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                        layerFilter === "all"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                          : "bg-white/[0.04] text-gray-400 hover:text-white border border-transparent"
                      }`}
                      onClick={() => setLayerFilter("all")}
                    >
                      All levels
                    </button>
                    {[1, 2, 3, 4, 5, 6].map((L) => (
                      <button
                        key={L}
                        type="button"
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                          layerFilter === L
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                            : "bg-white/[0.04] text-gray-400 hover:text-white border border-transparent"
                        }`}
                        onClick={() => setLayerFilter(L)}
                      >
                        L{L}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Export & Summary header */}
                <div className="flex justify-end mb-2">
                  <button
                    type="button"
                    className="bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-semibold text-xs rounded-full px-3.5 py-1.5 flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                    onClick={exportCsv}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Excel
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1.5 p-2.5 sm:p-3 rounded-xl bg-[#161014]/90 border border-amber-500/15 shadow-inner mb-3 overflow-hidden">
                  <SumCell label="Commission" value={formatINR(listSummary.commission)} isGreen />
                  <SumCell label="Bet volume" value={formatINR(listSummary.betVolume)} isGold />
                  <SumCell label="Bets" value={String(listSummary.bets)} />
                  <SumCell label="Bettors" value={String(listSummary.bettors)} />
                </div>

                {listLoading ? (
                  <div className="flex items-center justify-center py-10 text-amber-400/60 gap-2">
                    <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-semibold">Loading data…</span>
                  </div>
                ) : groupMode !== "list" && grouped ? (
                  grouped.length === 0 ? (
                    <p className="dash-empty">No commission in range.</p>
                  ) : (
                    <ul className="sal-pay-list space-y-2">
                      {grouped.map(([k, v]) => (
                        <li key={k} className="p-3 rounded-xl bg-[#1c161a] border border-white/5 flex items-center justify-between">
                          <p className="text-xs text-gray-300 font-medium">{k}</p>
                          <p className="text-emerald-400 font-extrabold text-sm font-mono">
                            {formatINR(v)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )
                ) : personGroups.length === 0 ? (
                  <p className="dash-empty">No commission in range.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {personGroups.map((g) => {
                      const open = expandedPeople.has(g.key);
                      return (
                        <li key={g.key} className="bg-[#1c161a] hover:bg-[#231b21] border border-white/10 hover:border-amber-500/30 rounded-xl transition-all duration-200 overflow-hidden shadow-sm">
                          <button
                            type="button"
                            className="w-full p-3.5 flex items-center justify-between gap-3 text-left transition-colors active:bg-[#281f26]"
                            onClick={() => togglePerson(g)}
                            aria-expanded={open}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 font-black text-xs flex items-center justify-center flex-shrink-0 shadow-inner">
                                L{g.layer || "—"}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white text-sm truncate tracking-tight">{g.username}</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5 font-normal truncate">
                                  Bet <span className="text-amber-200/80 font-medium">{formatINR(g.betVolume)}</span> · {g.bets} {g.bets === 1 ? "bet" : "bets"}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="text-right">
                                <p className="text-[#17b15e] font-extrabold text-sm sm:text-base font-mono tracking-tight drop-shadow-sm">
                                  {formatINR(g.commission)}
                                </p>
                              </div>
                              <div className={`w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-gray-400 transition-transform duration-200 ${open ? "rotate-180 text-amber-400 bg-amber-500/10" : ""}`}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                            </div>
                          </button>

                          {open && (
                            <div className="bg-[#140e12]/95 border-t border-white/5 p-3 space-y-2">
                              <p className="text-[10px] font-bold text-amber-400/70 uppercase tracking-wider mb-1">
                                Bet details
                                {personDetails[g.key]?.total != null
                                  ? ` · ${personDetails[g.key]!.total} total`
                                  : ""}
                              </p>
                              {personDetails[g.key]?.loading && (
                                <p className="text-xs text-amber-400/70 py-2">
                                  Loading bets…
                                </p>
                              )}
                              {!personDetails[g.key]?.loading &&
                                (personDetails[g.key]?.items.length ?? 0) ===
                                  0 && (
                                  <p className="text-xs text-gray-500 py-2">
                                    {g.fromUserId
                                      ? "No bets in this range"
                                      : "Cannot load details (missing user id)"}
                                  </p>
                                )}
                              {(personDetails[g.key]?.items ?? []).map((r) => (
                                <div key={r.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="bg-amber-500/10 border border-amber-500/20 text-amber-300 font-semibold px-1.5 py-0.5 rounded text-[10px]">
                                        {r.betType ? String(r.betType) : "Bet"}
                                      </span>
                                      {r.settled === false && (
                                        <span className="bg-white/10 border border-white/15 text-white/60 font-semibold px-1.5 py-0.5 rounded text-[10px]">
                                          Pending
                                        </span>
                                      )}
                                      <span className="text-white font-medium text-xs">{formatINR(Number(r.betAmount ?? 0))}</span>
                                      {r.commissionRate != null && Number(r.commissionRate) > 0 && (
                                        <span className="text-gray-400 text-[11px]">({Number(r.commissionRate)}%)</span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                      {r.createdAt ? formatDateTime(r.createdAt) : "—"}
                                    </p>
                                  </div>
                                  <span className="text-emerald-400 font-bold font-mono text-xs flex-shrink-0">
                                    {formatINR(Number(r.commissionAmount ?? r.amount ?? 0))}
                                  </span>
                                </div>
                              ))}
                              {(() => {
                                const d = personDetails[g.key];
                                if (!d || d.totalPages <= 1 || d.loading) {
                                  return null;
                                }
                                return (
                                  <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-white/5">
                                    <button
                                      type="button"
                                      disabled={d.page <= 1 || d.loading}
                                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-300 disabled:opacity-40 border border-white/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void loadPersonDetail(g, d.page - 1);
                                      }}
                                    >
                                      Prev
                                    </button>
                                    <span className="text-[11px] text-gray-400 font-medium tabular-nums">
                                      Page {d.page} / {d.totalPages}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={
                                        d.page >= d.totalPages || d.loading
                                      }
                                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500/15 text-amber-300 disabled:opacity-40 border border-amber-500/30"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void loadPersonDetail(g, d.page + 1);
                                      }}
                                    >
                                      Next
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}

            {bottomTab === "subordinate" && (
              <section className="dash-card mt-3">
                <h2 className="dash-card-title mb-3">Subordinates</h2>
                {subsLoading ? (
                  <div className="flex items-center justify-center py-10 text-amber-400/60 gap-2">
                    <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-semibold">Loading data…</span>
                  </div>
                ) : subs.length === 0 ? (
                  <EmptyState label="No downline yet — share your invite link" />
                ) : (
                  <div className="space-y-2.5">
                    {subs.map((m) => (
                      <div key={m.id} className="bg-[#1c161a] border border-white/5 hover:border-amber-500/20 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-sm">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                            L{m.layer}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white font-bold text-sm tracking-tight truncate">{m.username}</p>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              Bet <span className="text-amber-200/80 font-medium">{formatINR(m.totalBetting)}</span> · Dep <span className="text-gray-300 font-medium">{formatINR(m.totalDeposit)}</span>
                            </p>
                          </div>
                        </div>
                        <p className="text-amber-400 font-extrabold text-sm font-mono flex-shrink-0">
                          {formatINR(m.commissionGenerated)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      <DatePickerSheet
        open={levelDateOpen}
        value={levelCustom}
        onCancel={() => setLevelDateOpen(false)}
        onConfirm={(d) => {
          setLevelCustom(d);
          setLevelPreset("custom");
          setLevelDateOpen(false);
        }}
      />
      <DatePickerSheet
        open={listDateOpen}
        value={listCustom}
        onCancel={() => setListDateOpen(false)}
        onConfirm={(d) => {
          setListCustom(d);
          setListPreset("custom");
          setListDateOpen(false);
        }}
      />
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-xl border flex flex-col justify-between shadow-sm ${
      highlight
        ? "bg-gradient-to-br from-[#292026] to-[#1e171c] border-amber-500/30"
        : "bg-[#1e181c] border-white/5"
    }`}>
      <p className={`font-black text-sm sm:text-base tracking-tight font-mono ${highlight ? "text-amber-300" : "text-[#fde4bc]"}`}>
        {value}
      </p>
      <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase mt-1">
        {label}
      </p>
    </div>
  );
}

function SumCell({ label, value, isGreen, isGold }: { label: string; value: string; isGreen?: boolean; isGold?: boolean }) {
  const len = value.length;
  let fontSizeClass = "text-xs sm:text-sm";
  if (len > 16) {
    fontSizeClass = "text-[7.5px] sm:text-[9px]";
  } else if (len > 13) {
    fontSizeClass = "text-[8.5px] sm:text-[10px]";
  } else if (len > 10) {
    fontSizeClass = "text-[9.5px] sm:text-[11px]";
  } else if (len > 7) {
    fontSizeClass = "text-[11px] sm:text-xs";
  }

  return (
    <div className="min-w-0 overflow-hidden">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate" title={label}>
        {label}
      </p>
      <p
        className={`${fontSizeClass} font-extrabold font-mono mt-0.5 truncate tracking-tight ${
          isGreen ? "text-[#17b15e]" : isGold ? "text-amber-200" : "text-white"
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
