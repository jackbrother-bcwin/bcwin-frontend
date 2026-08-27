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
  shiftYmd,
  ymdIst,
  ymdLocal,
} from "./dateRange";
import { sessionCachePeek, sessionCacheSet } from "../../lib/session-cache";

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

/** Today (and ranges that include today) show live unsettled. Past days stay settled-only. */
function rebateSettledParam(
  preset: DatePreset,
  customYmd?: string
): true | "all" {
  if (preset === "yesterday" || preset === "day_before") return true;
  if (preset === "custom") {
    return customYmd && customYmd === ymdIst() ? "all" : true;
  }
  return "all";
}

function CopyUidButton({ uid }: { uid: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(uid);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1 text-[#FED358] hover:text-[#FFE9A8] transition-colors flex items-center gap-1 cursor-pointer"
      title="Copy UID"
    >
      {copied ? (
        <span className="text-[12px] text-green-400 font-semibold">Copied!</span>
      ) : (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current stroke-2">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}

export default function AgentCommissionPage({ onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [daily, setDaily] = useState<DailyCommissionRow[]>([]);
  const [rates, setRates] = useState<CommissionRateRow[]>([]);
  /** Agency rebate tier (not XP VIP) — keys lottery L1–L6 rates */
  const [rebateLevel, setRebateLevel] = useState(0);
  const [teamSize, setTeamSize] = useState(0);
  /** L1–L6 stake since IST 00:00 today (live, includes unsettled) */
  const [teamBetting, setTeamBetting] = useState(0);
  const [lifetime, setLifetime] = useState(0);
  /** Today IST: settled vs accrued (not in wallet / TX) */
  const [todayCredited, setTodayCredited] = useState(0);
  const [todayByLayer, setTodayByLayer] = useState<
    Record<string, { commission: number; bet: number; users: number }>
  >({});

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
  const [people, setPeople] = useState<api.RebatePersonRow[]>([]);
  const [listByDay, setListByDay] = useState<
    Array<{ date: string; commission: number }>
  >([]);
  const [listSummary, setListSummary] = useState({
    commission: 0,
    betVolume: 0,
    bets: 0,
    bettors: 0,
  });
  const [listLoading, setListLoading] = useState(false);
  const [subs, setSubs] = useState<TeamMember[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [subsLayerFilter, setSubsLayerFilter] = useState<number | "all">("all");
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

  type OverviewSnap = {
    daily: DailyCommissionRow[];
    rates: CommissionRateRow[];
    rebateLevel: number;
    teamSize: number;
    teamBetting: number;
    lifetime: number;
    todayCredited: number;
    todayByLayer: Record<
      string,
      { commission: number; bet: number; users: number }
    >;
  };

  const applyOverview = useCallback((s: OverviewSnap) => {
    setDaily(s.daily);
    setRates(s.rates);
    setRebateLevel(s.rebateLevel);
    setTeamSize(s.teamSize);
    setTeamBetting(s.teamBetting);
    setLifetime(s.lifetime);
    setTodayCredited(s.todayCredited);
    setTodayByLayer(s.todayByLayer ?? {});
  }, []);

  const loadOverview = useCallback(async (signal?: AbortSignal) => {
    const hit = sessionCachePeek<OverviewSnap>("agent-commission");
    if (hit) {
      applyOverview(hit.data);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const todayYmd = ymdIst();
      const [dayTotals, ratesRes, overview, dayPreview] = await Promise.all([
        api.getRebateDayTotals({ settled: "true" }).catch(() => null),
        api.getRebateRates().catch(() => null),
        api.getTeamOverview().catch(() => null),
        api.getRebateDayPreview({ date: todayYmd }).catch(() => null),
      ]);
      if (signal?.aborted) return;

      const byDay = new Map<string, number>();
      for (const row of dayTotals?.data ?? []) {
        byDay.set(row.date, roundMoney(Number(row.total || 0), 3));
      }
      const credited = byDay.get(todayYmd) ?? 0;
      if (dayPreview?.data) {
        byDay.set(
          todayYmd,
          roundMoney(Number(dayPreview.data.totalCommission || 0), 3)
        );
      }
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

      const lottery = ratesRes?.data?.lottery ?? [];
      const nextRates = lottery.map((row) => ({
        vipLevel: row.vipLevel,
        layer1: row.layer1,
        layer2: row.layer2,
        layer3: row.layer3,
        layer4: row.layer4,
        layer5: row.layer5,
        layer6: row.layer6,
      })) as CommissionRateRow[];

      const previewLvl = Number(dayPreview?.data?.rebateLevel);
      const snap: OverviewSnap = {
        daily: dailyRows,
        rates: nextRates,
        rebateLevel: Number.isFinite(previewLvl) ? previewLvl : 0,
        teamSize: Number(overview?.data?.totalTeamSize ?? 0),
        teamBetting: Number(dayPreview?.data?.teamBetting ?? 0),
        lifetime: Number(overview?.data?.totalCommissionEarned ?? 0),
        todayCredited: roundMoney(credited, 3),
        todayByLayer: dayPreview?.data?.byLayer ?? {},
      };
      applyOverview(snap);
      sessionCacheSet("agent-commission", snap);
    } catch {
      if (!signal?.aborted && !hit) {
        setDaily([]);
        setRates([]);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [applyOverview]);

  useEffect(() => {
    const ac = new AbortController();
    void loadOverview(ac.signal);
    return () => ac.abort();
  }, [loadOverview]);

  // Commission by level: today reuses overview preview; past days GROUP BY layer
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const range =
        levelPreset === "custom"
          ? rangeForPreset("custom", { start: levelCustom, end: levelCustom })
          : rangeForPreset(levelPreset);
      const usePreview =
        (levelPreset === "today" ||
          (levelPreset === "custom" && levelCustom === ymdIst())) &&
        range.startDate === ymdIst();
      if (usePreview) {
        const out: typeof levelSummary = {};
        for (let i = 1; i <= 6; i++) {
          const row = todayByLayer[`L${i}`];
          out[`L${i}`] = {
            commission: Number(row?.commission ?? 0),
            bet: Number(row?.bet ?? 0),
            users: Number(row?.users ?? 0),
          };
        }
        setLevelSummary(out);
        return;
      }
      try {
        const res = await api.getRebatePeople({
          startDate: range.startDate,
          endDate: range.endDate,
          settled: rebateSettledParam(levelPreset, levelCustom),
        });
        if (cancelled) return;
        const layers = res.data?.byLayer ?? {};
        const out: typeof levelSummary = {};
        for (let i = 1; i <= 6; i++) {
          const row = layers[`L${i}`];
          out[`L${i}`] = {
            commission: Number(row?.commission ?? 0),
            bet: Number(row?.bet ?? 0),
            users: Number(row?.users ?? 0),
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
  }, [levelPreset, levelCustom, todayByLayer]);

  // List / subordinate loaders
  const loadList = useCallback(async () => {
    const range =
      listPreset === "custom"
        ? rangeForPreset("custom", { start: listCustom, end: listCustom })
        : rangeForPreset(listPreset);
    const cacheKey = `agent-commission-list:${listPreset}:${listCustom}:${layerFilter}`;
    type ListSnap = {
      people: api.RebatePersonRow[];
      byDay: Array<{ date: string; commission: number }>;
      summary: typeof listSummary;
    };
    const hit = sessionCachePeek<ListSnap>(cacheKey);
    if (hit) {
      setPeople(hit.data.people);
      setListByDay(hit.data.byDay);
      setListSummary(hit.data.summary);
      setListLoading(false);
    } else {
      setListLoading(true);
    }
    try {
      const res = await api.getRebatePeople({
        startDate: range.startDate,
        endDate: range.endDate,
        settled: rebateSettledParam(listPreset, listCustom),
        layer: layerFilter === "all" ? undefined : layerFilter,
      });
      const nextPeople = res.data?.people ?? [];
      const nextByDay = res.data?.byDay ?? [];
      const s = res.data?.summary;
      const nextSummary = {
        commission: roundMoney(Number(s?.commission ?? 0), 3),
        betVolume: roundMoney(Number(s?.betVolume ?? 0), 3),
        bets: Number(s?.bets ?? 0),
        bettors: Number(s?.bettors ?? 0),
      };
      const snap: ListSnap = {
        people: nextPeople,
        byDay: nextByDay,
        summary: nextSummary,
      };
      sessionCacheSet(cacheKey, snap);
      setPeople(nextPeople);
      setListByDay(nextByDay);
      setListSummary(nextSummary);
    } catch {
      if (!hit) {
        setPeople([]);
        setListByDay([]);
        setListSummary({ commission: 0, betVolume: 0, bets: 0, bettors: 0 });
      }
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
        const todayStr = ymdIst();
        const res = await api.getTeamMembers({
          date: todayStr,
          page: 1,
          limit: 100,
        });
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

  const todayDepositors = useMemo(() => {
    return subs.filter((m) => Number(m.totalDeposit ?? 0) > 0);
  }, [subs]);

  const filteredDepositors = useMemo(() => {
    if (subsLayerFilter === "all") return todayDepositors;
    return todayDepositors.filter((m) => Number(m.layer) === subsLayerFilter);
  }, [todayDepositors, subsLayerFilter]);

  const totalTodayDepositSum = useMemo(() => {
    return roundMoney(
      filteredDepositors.reduce(
        (sum, m) => sum + Number(m.totalDeposit ?? 0),
        0
      ),
      2
    );
  }, [filteredDepositors]);

  const totalTodayBetSum = useMemo(() => {
    return roundMoney(
      filteredDepositors.reduce(
        (sum, m) => sum + Number(m.totalBetting ?? 0),
        0
      ),
      2
    );
  }, [filteredDepositors]);

  const today = ymdIst();
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
      const ymd = shiftYmd(ymdIst(), -i);
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

  const exportCsv = async () => {
    const range =
      listPreset === "custom"
        ? rangeForPreset("custom", { start: listCustom, end: listCustom })
        : rangeForPreset(listPreset);
    try {
      const res = await api.getRebateHistory({
        startDate: range.startDate,
        endDate: range.endDate,
        settled: rebateSettledParam(listPreset, listCustom),
        page: 1,
        limit: 100,
        ...(layerFilter !== "all" ? { layer: layerFilter } : {}),
      });
      const header = "date,from,layer,bet,commission,rate\n";
      const body = (res.data ?? [])
        .map((r) =>
          [
            r.createdAt ?? "",
            r.fromUser?.username ?? "",
            r.layer ?? "",
            r.betAmount ?? "",
            r.amount ?? "",
            r.rate ?? "",
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
    } catch {
      /* keep current file */
    }
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
    return people.map((p) => ({
      key: p.fromUserId || `${p.username}|L${p.layer}`,
      fromUserId: p.fromUserId,
      username: p.username,
      layer: Number(p.layer ?? 0),
      betVolume: Number(p.betVolume ?? 0),
      commission: Number(p.commission ?? 0),
      bets: Number(p.bets ?? 0),
    }));
  }, [people, groupMode]);

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
          settled: rebateSettledParam(listPreset, listCustom),
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
    for (const r of listByDay) {
      const raw = r.date || "unknown";
      let key = raw;
      if (groupMode === "weekly" && raw.length === 10) {
        const d = new Date(`${raw}T12:00:00+05:30`);
        const day = d.getDay();
        const monOff = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + monOff);
        key = `W ${ymdIst(d)}`;
      } else if (groupMode === "monthly" && raw.length === 10) {
        key = raw.slice(0, 7);
      }
      buckets.set(
        key,
        (buckets.get(key) ?? 0) + Number(r.commission ?? 0)
      );
    }
    return [...buckets.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [listByDay, groupMode]);

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
                  <span className="text-[12px] font-black tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-black/20 text-amber-200 border border-white/10 backdrop-blur-sm">
                    Today
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <p className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight drop-shadow-sm my-1">
                  {formatINR(todayLive)}
                </p>
                <p className="text-xs font-medium text-amber-100/90 flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {formatINR(todayCredited)} credited
                </p>
                <p className="text-[12px] text-amber-100/70 mt-1">
                  Live today (not in wallet yet). Credits at 24:00 IST. Yesterday matches Transaction history.
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
                <p className="text-[12px] font-bold text-gray-400 tracking-wider uppercase mt-0.5">
                  Total Downline (L1–L6)
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-white font-mono">{formatINR(teamBetting)}</p>
                <p className="text-[12px] font-medium text-gray-400 mt-0.5">Today's Bet Volume</p>
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
              <p className="text-[12px] text-white/35 mb-2">
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
                Subordinates{todayDepositors.length > 0 ? ` (${todayDepositors.length})` : ""}
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
                    onClick={() => void exportCsv()}
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
                              <p className="text-[12px] font-bold text-amber-400/70 uppercase tracking-wider mb-1">
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
                                      <span className="bg-amber-500/10 border border-amber-500/20 text-amber-300 font-semibold px-1.5 py-0.5 rounded text-[12px]">
                                        {r.betType ? String(r.betType) : "Bet"}
                                      </span>
                                      {r.settled === false && (
                                        <span className="bg-white/10 border border-white/15 text-white/60 font-semibold px-1.5 py-0.5 rounded text-[12px]">
                                          Pending
                                        </span>
                                      )}
                                      <span className="text-white font-medium text-xs">{formatINR(Number(r.betAmount ?? 0))}</span>
                                      {r.commissionRate != null && Number(r.commissionRate) > 0 && (
                                        <span className="text-gray-400 text-[13px]">({Number(r.commissionRate)}%)</span>
                                      )}
                                    </div>
                                    <p className="text-[12px] text-gray-400 mt-1">
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
                                      className="px-3 py-1.5 rounded-lg text-[13px] font-bold bg-white/5 text-gray-300 disabled:opacity-40 border border-white/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void loadPersonDetail(g, d.page - 1);
                                      }}
                                    >
                                      Prev
                                    </button>
                                    <span className="text-[13px] text-gray-400 font-medium tabular-nums">
                                      Page {d.page} / {d.totalPages}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={
                                        d.page >= d.totalPages || d.loading
                                      }
                                      className="px-3 py-1.5 rounded-lg text-[13px] font-bold bg-amber-500/15 text-amber-300 disabled:opacity-40 border border-amber-500/30"
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
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <h2 className="dash-card-title">Live Subordinates Today</h2>
                    <p className="text-[13px] text-gray-400 mt-0.5">
                      Subordinates with successful deposits today (IST)
                    </p>
                  </div>
                  {filteredDepositors.length > 0 && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      {filteredDepositors.length} {filteredDepositors.length === 1 ? "depositor" : "depositors"}
                    </span>
                  )}
                </div>

                {/* Subordinate Level Filters */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none mb-3">
                  <button
                    type="button"
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      subsLayerFilter === "all"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                        : "bg-white/[0.04] text-gray-400 hover:text-white border border-transparent"
                    }`}
                    onClick={() => setSubsLayerFilter("all")}
                  >
                    All levels ({todayDepositors.length})
                  </button>
                  {[1, 2, 3, 4, 5, 6].map((L) => {
                    const countInTier = todayDepositors.filter((m) => Number(m.layer) === L).length;
                    return (
                      <button
                        key={L}
                        type="button"
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                          subsLayerFilter === L
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                            : "bg-white/[0.04] text-gray-400 hover:text-white border border-transparent"
                        }`}
                        onClick={() => setSubsLayerFilter(L)}
                      >
                        L{L} {countInTier > 0 ? `(${countInTier})` : ""}
                      </button>
                    );
                  })}
                </div>

                {/* Summary Strip if we have depositors */}
                {filteredDepositors.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 p-2.5 mb-3 bg-[#1e181c] rounded-xl border border-white/5">
                    <div className="flex flex-col">
                      <span className="text-[12px] uppercase font-bold text-gray-400 tracking-wider">
                        Today's Depositors
                      </span>
                      <span className="text-sm font-extrabold text-white font-mono mt-0.5">
                        {filteredDepositors.length}
                      </span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[12px] uppercase font-bold text-gray-400 tracking-wider">
                        Total Deposit (Today)
                      </span>
                      <span className="text-sm font-extrabold text-amber-300 font-mono mt-0.5">
                        {formatINR(totalTodayDepositSum)}
                      </span>
                    </div>
                    <div className="flex flex-col col-span-2">
                      <span className="text-[12px] uppercase font-bold text-gray-400 tracking-wider">
                        Total bet (Today)
                      </span>
                      <span className="text-sm font-extrabold text-amber-300 font-mono mt-0.5">
                        {formatINR(totalTodayBetSum)}
                      </span>
                    </div>
                  </div>
                )}

                {subsLoading ? (
                  <div className="flex items-center justify-center py-10 text-amber-400/60 gap-2">
                    <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-semibold">Loading live subordinates…</span>
                  </div>
                ) : filteredDepositors.length === 0 ? (
                  <EmptyState
                    label={
                      subsLayerFilter === "all"
                        ? "No downline deposits today"
                        : `No Tier ${subsLayerFilter} deposits today`
                    }
                  />
                ) : (
                  <div className="space-y-2.5">
                    {filteredDepositors.map((m) => {
                      const uid = String(m.serialNumber ?? m.id);
                      const nickname = String(m.username ?? "—").trim() || "—";
                      return (
                        <div
                          key={m.id}
                          className="bg-[#1c161a] border border-white/5 hover:border-amber-500/20 rounded-xl p-3.5 flex flex-col gap-2.5 shadow-sm transition-colors"
                        >
                          {/* Card Header: UID + Copy Button (left), Username (right) */}
                          <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/5">
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="text-xs font-bold text-gray-300 tracking-wide tabular-nums font-mono">
                                UID: {uid}
                              </span>
                              <CopyUidButton uid={uid} />
                            </div>
                            <span
                              className="text-xs font-bold text-[#FED358] truncate max-w-[50%] text-right"
                              title={nickname}
                            >
                              {nickname}
                            </span>
                          </div>

                          {/* Card Body Details */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center justify-between bg-black/20 px-2.5 py-1.5 rounded-lg">
                              <span className="text-[13px] text-gray-400 font-medium">Level</span>
                              <span className="px-1.5 py-0.5 rounded text-[12px] font-extrabold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                L{m.layer}
                              </span>
                            </div>
                            <div className="flex items-center justify-between bg-black/20 px-2.5 py-1.5 rounded-lg">
                              <span className="text-[13px] text-gray-400 font-medium">Deposit (Today)</span>
                              <span className="font-extrabold text-amber-300 font-mono">
                                {formatINR(m.totalDeposit ?? 0)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between bg-black/20 px-2.5 py-1.5 rounded-lg col-span-2">
                              <span className="text-[13px] text-gray-400 font-medium">Total bet (Today)</span>
                              <span className="font-extrabold text-amber-300 font-mono">
                                {formatINR(m.totalBetting ?? 0)}
                              </span>
                            </div>
                          </div>

                          {/* User ID Row */}
                          <div className="flex items-center justify-between text-[13px] px-1 text-gray-400">
                            <span className="font-medium text-gray-500">User ID</span>
                            <span className="font-mono text-gray-400 truncate max-w-[70%]" title={m.id}>
                              {m.id}
                            </span>
                          </div>
                        </div>
                      );
                    })}
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
      <p className="text-[12px] font-bold text-gray-400 tracking-wider uppercase mt-1">
        {label}
      </p>
    </div>
  );
}

function SumCell({ label, value, isGreen, isGold }: { label: string; value: string; isGreen?: boolean; isGold?: boolean }) {
  const len = value.length;
  let fontSizeClass = "text-xs sm:text-sm";
  if (len > 16) {
    fontSizeClass = "text-[9.5px] sm:text-[11px]";
  } else if (len > 13) {
    fontSizeClass = "text-[10.5px] sm:text-[12px]";
  } else if (len > 10) {
    fontSizeClass = "text-[11.5px] sm:text-[13px]";
  } else if (len > 7) {
    fontSizeClass = "text-[13px] sm:text-xs";
  }

  return (
    <div className="min-w-0 overflow-hidden">
      <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider truncate" title={label}>
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
