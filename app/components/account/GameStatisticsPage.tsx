"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { IoChevronForward } from "react-icons/io5";
import PageHeader from "../ui/PageHeader";
import LoadingSpinner from "../ui/LoadingSpinner";
import BetHistoryCard, {
  type BetHistoryDetail,
} from "../game/BetHistoryCard";
import * as api from "../../lib/api";
import type { GameHistoryItem } from "../../lib/api";
import { formatINR } from "../../lib/format";
import {
  CATEGORIES,
  type CategoryId,
} from "../../lib/home-catalog";
import { homeCategoriesForInout } from "../../lib/inout-catalog";

interface Props {
  onBack: () => void;
}

type RangeId = "today" | "yesterday" | "7d" | "30d" | "all";
/** All = every category (same idea as Lobby overview) */
type StatsCategory = "all" | CategoryId;

const LOTTERY_TYPES = new Set([
  "WINGO",
  "TRX_WINGO",
  "K3",
  "FIVE_D",
  "5D",
  "MOTO",
]);

const LOTTERY_GAME_LABELS: Record<string, string> = {
  WINGO: "Win Go",
  TRX_WINGO: "TRX WinGo",
  K3: "K3",
  FIVE_D: "5D",
  "5D": "5D",
  MOTO: "Moto Racing",
};

/** Same category set as home game grids (skip pure Lobby — use All) */
const STATS_CATEGORIES: { id: StatsCategory; name: string }[] = [
  { id: "all", name: "All" },
  ...CATEGORIES.filter((c) => c.id !== "lobby").map((c) => ({
    id: c.id as StatsCategory,
    name: c.name,
  })),
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function rangeBounds(id: RangeId): { from: number | null; to: number | null } {
  const now = new Date();
  const today = startOfDay(now).getTime();
  if (id === "today") return { from: today, to: null };
  if (id === "yesterday") {
    const y = today - 24 * 60 * 60 * 1000;
    return { from: y, to: today };
  }
  if (id === "7d") return { from: today - 6 * 24 * 60 * 60 * 1000, to: null };
  if (id === "30d") return { from: today - 29 * 24 * 60 * 60 * 1000, to: null };
  return { from: null, to: null };
}

function inRange(iso: string, from: number | null, to: number | null): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  if (from != null && t < from) return false;
  if (to != null && t >= to) return false;
  return true;
}

/** Map a history row → home categories (same as game grids). */
function categoriesForBet(g: GameHistoryItem): CategoryId[] {
  const major = String(g.majorGameType || "").toUpperCase();
  if (LOTTERY_TYPES.has(major)) {
    return ["lottery", "popular"];
  }
  if (major === "INOUT" || major === "GREYTOP") {
    const mode = String(g.gameName || "").trim();
    const meta = (g.metadata ?? {}) as Record<string, unknown>;
    const slug =
      mode ||
      (meta.gameMode != null ? String(meta.gameMode) : "") ||
      (meta.inoutGameMode != null ? String(meta.inoutGameMode) : "");
    return homeCategoriesForInout(slug);
  }
  return ["mini"];
}

function primaryCategory(g: GameHistoryItem): CategoryId {
  const cats = categoriesForBet(g);
  const main = cats.find((c) => c !== "popular") ?? cats[0] ?? "mini";
  return main;
}

function betMatchesCategory(g: GameHistoryItem, cat: StatsCategory): boolean {
  if (cat === "all") return true;
  return categoriesForBet(g).includes(cat);
}

/** Pretty lottery name: "Wingo 0.5Min" → "Win Go 30s" */
function formatLotteryGameName(name: string, major: string): string {
  const base = LOTTERY_GAME_LABELS[major] ?? name.split(/\s/)[0] ?? major;
  const m = name.match(/([\d.]+)\s*Min/i);
  const rawMins = m?.[1];
  if (rawMins != null) {
    const mins = parseFloat(rawMins);
    if (!Number.isNaN(mins) && mins > 0) {
      if (mins < 1) return `${base} ${Math.round(mins * 60)}s`;
      if (mins === 1) return `${base} 1 min`;
      return `${base} ${mins} min`;
    }
  }
  return name || base;
}

function gameKeyLabel(g: GameHistoryItem): { key: string; label: string } {
  const major = String(g.majorGameType || "").toUpperCase();
  if (LOTTERY_TYPES.has(major)) {
    const name = String(g.gameName || "").trim();
    if (name) {
      return {
        key: `${major}:${name}`,
        label: formatLotteryGameName(name, major),
      };
    }
    return { key: major, label: LOTTERY_GAME_LABELS[major] ?? major };
  }
  const name = String(g.gameName || major || "Game").trim();
  const pretty = name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { key: name.toLowerCase(), label: pretty || "Game" };
}

function orderPrefixFor(major: string): string {
  const m = major.toUpperCase();
  if (m === "K3") return "K3";
  if (m === "FIVE_D" || m === "5D") return "5D";
  if (m === "MOTO") return "MOTO";
  if (m === "TRX_WINGO") return "TRX";
  if (m === "INOUT" || m === "GREYTOP") return "IO";
  return "WG";
}

/** Map history item → expandable BetHistoryCard detail (first-party full, third-party best-effort). */
function toBetDetail(g: GameHistoryItem): BetHistoryDetail {
  const major = String(g.majorGameType || "").toUpperCase();
  const meta = (g.metadata ?? {}) as Record<string, unknown>;
  const isThirdParty = major === "INOUT" || major === "GREYTOP";

  const select =
    meta.betChoice != null
      ? String(meta.betChoice)
      : meta.betType != null
        ? String(meta.betType)
        : isThirdParty
          ? String(g.gameName || "Play")
              .replace(/[-_]+/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase())
          : g.gameName || major || "Bet";

  const extraRows: BetHistoryDetail["extraRows"] = [
    {
      label: "Game",
      value: isThirdParty
        ? String(g.gameName || "Third-party")
            .replace(/[-_]+/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase())
        : g.gameName || LOTTERY_GAME_LABELS[major] || major || "—",
    },
    {
      label: "Type",
      value: isThirdParty ? "Third-party" : "Lottery",
    },
  ];

  if (meta.position != null) {
    extraRows.push({ label: "Position", value: String(meta.position) });
  }
  if (meta.betNumbers != null) {
    extraRows.push({
      label: "Numbers",
      value: Array.isArray(meta.betNumbers)
        ? meta.betNumbers.join(", ")
        : String(meta.betNumbers),
    });
  }
  if (meta.targetPosition != null) {
    extraRows.push({
      label: "Target",
      value: String(meta.targetPosition),
    });
  }

  return {
    id: g.id,
    selectLabel: select,
    periodNumber:
      meta.periodNumber != null ? String(meta.periodNumber) : undefined,
    betAmount: g.betAmount,
    contractAmount:
      meta.contractAmount != null ? Number(meta.contractAmount) : undefined,
    status: g.status,
    winAmount: g.winAmount,
    isWin: Number(g.winAmount) > 0,
    createdAt: g.createdAt,
    orderPrefix: orderPrefixFor(major),
    resultText:
      meta.resultText != null
        ? String(meta.resultText)
        : meta.resultNumber != null
          ? String(meta.resultNumber)
          : undefined,
    extraRows,
  };
}

interface RowAgg {
  key: string;
  label: string;
  category: CategoryId;
  bets: number;
  totalBet: number;
  totalWin: number;
  profit: number;
}

interface Aggregates {
  bets: number;
  totalBet: number;
  totalWin: number;
  wins: number;
  losses: number;
  rows: RowAgg[];
  byCategory: Array<{
    key: CategoryId;
    label: string;
    bets: number;
    totalBet: number;
    totalWin: number;
    profit: number;
  }>;
}

function aggregate(items: GameHistoryItem[]): Aggregates {
  let bets = 0;
  let totalBet = 0;
  let totalWin = 0;
  let wins = 0;
  let losses = 0;
  const gameMap = new Map<
    string,
    {
      label: string;
      category: CategoryId;
      bets: number;
      totalBet: number;
      totalWin: number;
    }
  >();
  const catMap = new Map<
    CategoryId,
    { bets: number; totalBet: number; totalWin: number }
  >();

  for (const g of items) {
    const bet = Number(g.betAmount) || 0;
    const win = Number(g.winAmount) || 0;
    bets += 1;
    totalBet += bet;
    totalWin += win;
    if (win > 0) wins += 1;
    else losses += 1;

    const { key, label } = gameKeyLabel(g);
    const category = primaryCategory(g);
    const cur = gameMap.get(key) ?? {
      label,
      category,
      bets: 0,
      totalBet: 0,
      totalWin: 0,
    };
    cur.bets += 1;
    cur.totalBet += bet;
    cur.totalWin += win;
    gameMap.set(key, cur);

    const cc = catMap.get(category) ?? { bets: 0, totalBet: 0, totalWin: 0 };
    cc.bets += 1;
    cc.totalBet += bet;
    cc.totalWin += win;
    catMap.set(category, cc);
  }

  const catName = (id: CategoryId) =>
    CATEGORIES.find((c) => c.id === id)?.name ?? id;

  const rows = Array.from(gameMap.entries())
    .map(([key, v]) => ({
      key,
      label: v.label,
      category: v.category,
      bets: v.bets,
      totalBet: v.totalBet,
      totalWin: v.totalWin,
      profit: v.totalWin - v.totalBet,
    }))
    .sort((a, b) => b.totalBet - a.totalBet);

  const byCategory = Array.from(catMap.entries())
    .map(([key, v]) => ({
      key,
      label: catName(key),
      bets: v.bets,
      totalBet: v.totalBet,
      totalWin: v.totalWin,
      profit: v.totalWin - v.totalBet,
    }))
    .sort((a, b) => b.totalBet - a.totalBet);

  return { bets, totalBet, totalWin, wins, losses, rows, byCategory };
}

export default function GameStatisticsPage({ onBack }: Props) {
  const { t } = useTranslation();
  const [range, setRange] = useState<RangeId>("7d");
  const [category, setCategory] = useState<StatsCategory>("all");
  const [raw, setRaw] = useState<GameHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  /** Expanded "By game" row — shows bet list with Detail boxes */
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all: GameHistoryItem[] = [];
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages && page <= 3) {
        const res = await api.getGameHistory({ page, limit: 100 });
        all.push(...(res.data ?? []));
        totalPages = res.totalPages ?? 1;
        page += 1;
      }
      setRaw(all);
    } catch {
      setRaw([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Collapse open detail when filters change
  useEffect(() => {
    setExpandedKey(null);
  }, [range, category]);

  const timeFiltered = useMemo(() => {
    const { from, to } = rangeBounds(range);
    if (from == null && to == null) return raw;
    return raw.filter((g) => inRange(g.createdAt, from, to));
  }, [raw, range]);

  const filtered = useMemo(
    () => timeFiltered.filter((g) => betMatchesCategory(g, category)),
    [timeFiltered, category]
  );

  const stats = useMemo(() => aggregate(filtered), [filtered]);
  const profit = stats.totalWin - stats.totalBet;
  const winRate = stats.bets > 0 ? (stats.wins / stats.bets) * 100 : 0;

  const betsByGameKey = useMemo(() => {
    const map = new Map<string, GameHistoryItem[]>();
    for (const g of filtered) {
      const { key } = gameKeyLabel(g);
      const list = map.get(key) ?? [];
      list.push(g);
      map.set(key, list);
    }
    // Newest first within each game
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    return map;
  }, [filtered]);

  const ranges: { id: RangeId; label: string }[] = [
    { id: "today", label: t("profile.statsToday", "Today") },
    { id: "yesterday", label: t("profile.statsYesterday", "Yesterday") },
    { id: "7d", label: t("profile.stats7d", "7 days") },
    { id: "30d", label: t("profile.stats30d", "30 days") },
    { id: "all", label: t("profile.statsAll", "All") },
  ];

  const categoryLabel = (id: StatsCategory) => {
    if (id === "all") return t("profile.statsAll", "All");
    const c = CATEGORIES.find((x) => x.id === id);
    return c?.name ?? id;
  };

  return (
    <div
      className="flex-1 flex flex-col min-h-screen pb-8"
      style={{ background: "#110D14" }}
    >
      <PageHeader
        title={t("profile.gameStatistics", "Game statistics")}
        onBack={onBack}
      />

      {/* Game categories — same as home grids */}
      <div className="px-3 pt-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/35">
          {t("profile.statsCategory", "Category")}
        </p>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {STATS_CATEGORIES.map((c) => {
            const active = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className="shrink-0 px-3 h-8 rounded-full text-[11px] font-bold transition-all"
                style={{
                  background: active
                    ? "linear-gradient(180deg, #FED358 0%, #FFB472 100%)"
                    : "#241E22",
                  color: active ? "#110D14" : "rgba(255,255,255,0.55)",
                  border: active
                    ? "1px solid transparent"
                    : "1px solid rgba(254,211,88,0.18)",
                }}
              >
                {categoryLabel(c.id)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date range */}
      <div className="px-3 pt-3 flex gap-1.5 overflow-x-auto no-scrollbar">
        {ranges.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRange(r.id)}
            className="shrink-0 px-3 h-7 rounded-full text-[10px] font-bold"
            style={{
              background:
                range === r.id
                  ? "linear-gradient(180deg, #FED358 0%, #E8A84A 100%)"
                  : "#382E35",
              color: range === r.id ? "#110D14" : "rgba(255,255,255,0.55)",
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="px-3 mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard
              label={t("profile.statsTotalBet", "Total bet")}
              value={formatINR(stats.totalBet)}
            />
            <StatCard
              label={t("profile.statsTotalWin", "Total win")}
              value={formatINR(stats.totalWin)}
              accent="#4ADE80"
            />
            <StatCard
              label={t("profile.statsProfit", "Profit / Loss")}
              value={`${profit >= 0 ? "+" : ""}${formatINR(profit)}`}
              accent={profit >= 0 ? "#4ADE80" : "#FF6B6B"}
            />
            <StatCard
              label={t("profile.statsWinRate", "Win rate")}
              value={`${winRate.toFixed(1)}%`}
              accent="#FED358"
            />
          </div>

          <div
            className="rounded-xl p-3.5 grid grid-cols-3 gap-2"
            style={{
              background: "#241E22",
              border: "1px solid rgba(254,211,88,0.12)",
            }}
          >
            <MiniStat
              label={t("profile.statsBets", "Bets")}
              value={String(stats.bets)}
            />
            <MiniStat
              label={t("profile.statsWins", "Wins")}
              value={String(stats.wins)}
              color="#4ADE80"
            />
            <MiniStat
              label={t("profile.statsLosses", "Losses")}
              value={String(stats.losses)}
              color="#FF6B6B"
            />
          </div>

          {/* Category rollup when viewing All */}
          {category === "all" && stats.byCategory.length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: "#241E22",
                border: "1px solid rgba(254,211,88,0.12)",
              }}
            >
              <div className="px-3.5 py-3 border-b border-white/5">
                <p className="text-[12px] font-bold text-white">
                  {t("profile.statsByCategory", "By category")}
                </p>
              </div>
              <div className="divide-y divide-white/5">
                {stats.byCategory.map((row) => (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => setCategory(row.key)}
                    className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left active:bg-white/5"
                  >
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-white truncate">
                        {row.label}
                      </p>
                      <p className="text-[10px] text-white/45 mt-0.5">
                        {row.bets} {t("profile.statsBets", "Bets").toLowerCase()}{" "}
                        · {formatINR(row.totalBet)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className="text-[11px] font-bold tabular-nums"
                        style={{
                          color: row.profit >= 0 ? "#4ADE80" : "#FF6B6B",
                        }}
                      >
                        {row.profit >= 0 ? "+" : ""}
                        {formatINR(row.profit)}
                      </p>
                      <p className="text-[9px] text-[#FED358] mt-0.5">
                        {t("profile.statsView", "View")} ›
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Per-game breakdown — tap to open bet detail list */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: "#241E22",
              border: "1px solid rgba(254,211,88,0.12)",
            }}
          >
            <div className="px-3.5 py-3 border-b border-white/5 flex items-center justify-between gap-2">
              <p className="text-[12px] font-bold text-white">
                {t("profile.statsByGame", "By game")}
              </p>
              <span className="text-[10px] text-white/35 font-medium">
                {categoryLabel(category)} ·{" "}
                {t("profile.statsTapDetail", "Tap for details")}
              </span>
            </div>
            {stats.rows.length === 0 ? (
              <p className="px-3.5 py-8 text-center text-[12px] text-white/40">
                {t("profile.statsEmpty", "No bets in this period")}
              </p>
            ) : (
              <div className="divide-y divide-white/5">
                {stats.rows.map((g) => {
                  const open = expandedKey === g.key;
                  const betList = betsByGameKey.get(g.key) ?? [];
                  return (
                    <div key={g.key}>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedKey((k) => (k === g.key ? null : g.key))
                        }
                        className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left active:bg-white/[0.04]"
                        style={{
                          background: open ? "rgba(254,211,88,0.06)" : undefined,
                        }}
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <span
                            className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full"
                            style={{
                              border: "1px solid rgba(254,211,88,0.45)",
                              color: "#FED358",
                              background: open
                                ? "rgba(254,211,88,0.12)"
                                : "transparent",
                            }}
                          >
                            <IoChevronForward
                              size={12}
                              className="transition-transform"
                              style={{
                                transform: open
                                  ? "rotate(90deg)"
                                  : "rotate(0deg)",
                              }}
                            />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[12px] font-bold text-white truncate">
                              {g.label}
                            </p>
                            <p className="text-[10px] text-white/45 mt-0.5">
                              {category === "all" && (
                                <span className="text-[#FED358]/80">
                                  {CATEGORIES.find((c) => c.id === g.category)
                                    ?.name ?? g.category}{" "}
                                  ·{" "}
                                </span>
                              )}
                              {g.bets}{" "}
                              {t("profile.statsBets", "Bets").toLowerCase()} ·{" "}
                              {formatINR(g.totalBet)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[11px] font-bold text-white/80 tabular-nums">
                            {formatINR(g.totalWin)}
                          </p>
                          <p
                            className="text-[10px] font-bold tabular-nums mt-0.5"
                            style={{
                              color: g.profit >= 0 ? "#4ADE80" : "#FF6B6B",
                            }}
                          >
                            {g.profit >= 0 ? "+" : ""}
                            {formatINR(g.profit)}
                          </p>
                        </div>
                      </button>

                      {/* Expandable bet list — same Detail cards as WinGo history */}
                      {open && (
                        <div
                          className="border-t border-white/5"
                          style={{ background: "rgba(0,0,0,0.22)" }}
                        >
                          <div className="px-3 pt-2.5 pb-1 flex items-center justify-between">
                            <p className="text-[11px] font-bold text-white/55">
                              {t("profile.statsBetHistory", "Bet history")} ·{" "}
                              {g.label}
                            </p>
                            <span className="text-[10px] text-white/30">
                              {betList.length}{" "}
                              {t("profile.statsBets", "Bets").toLowerCase()}
                            </span>
                          </div>
                          {betList.length === 0 ? (
                            <p className="px-3 py-4 text-center text-[11px] text-white/35">
                              {t("profile.statsEmpty", "No bets in this period")}
                            </p>
                          ) : (
                            <div className="pb-1">
                              {betList.map((item) => (
                                <BetHistoryCard
                                  key={item.id}
                                  detail={toBetDetail(item)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="px-1 text-[10px] text-white/30 leading-relaxed">
            {t(
              "profile.statsNote",
              "Tap a game to open bet details (same as WinGo history). Third-party games show available fields only."
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      className="rounded-xl px-3 py-3"
      style={{
        background: "#241E22",
        border: "1px solid rgba(254,211,88,0.12)",
      }}
    >
      <p className="text-[10px] text-white/45 font-medium">{label}</p>
      <p
        className="mt-1 text-[15px] font-extrabold tabular-nums truncate"
        style={{ color: accent ?? "#FFE8D6" }}
      >
        {value}
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="text-center">
      <p
        className="text-[16px] font-extrabold tabular-nums"
        style={{ color: color ?? "#FFE8D6" }}
      >
        {value}
      </p>
      <p className="text-[9px] text-white/40 mt-0.5 font-medium">{label}</p>
    </div>
  );
}
