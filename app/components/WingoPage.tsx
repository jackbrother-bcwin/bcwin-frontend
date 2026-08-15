"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./ui/Toast";
import * as api from "../lib/api";
import type { WingoBet, WingoPeriod, WingoResult } from "../lib/api";
import { formatINR, formatTime, secondsUntil } from "../lib/format";
import { gameWs } from "../lib/ws";
import { openSafeUrl } from "../lib/safe";
import {
  BetConfirmSheet,
  ColorDots,
  CountdownPopout,
  DurationTabs,
  GameHeader,
  GameNoticeBar,
  GameSoundToggle,
  GameWalletCard,
  HistoryTabBar,
  NumberBall,
  Pagination,
  PeriodBanner,
  ResultPopup,
  WingoTrendChart,
  computeWingoChartStats,
  isBig,
  isBettingLocked,
  numberBackground,
  numberPrimaryColor,
  sizeStyle,
  type DurationTab,
  type BetSlipConfirmPayload,
} from "./game/shared";
import { themeFromBet } from "./game/BetSlip";
import BetHistoryCard from "./game/BetHistoryCard";
import { createOncePerKey, setCountdownIfChanged } from "../lib/game-refresh";
import {
  useSettledResultPopup,
  samePeriodId,
} from "./game/useSettledResultPopup";

/** Tronscan block explorer — matches product deep-link */
function tronscanBlockUrl(blockNumber: number): string {
  return `https://tronscan.org/block/${blockNumber}/transactions`;
}

function openTronBlock(blockNumber: number | null | undefined) {
  if (blockNumber == null || !Number.isFinite(Number(blockNumber))) return;
  openSafeUrl(tronscanBlockUrl(Number(blockNumber)));
}

type GameTab = "30s" | "1min" | "3min" | "5min" | "10min";
type HistoryTab = "game" | "chart" | "my";

const WINGO_TABS: DurationTab[] = [
  { id: "30s", label: "WinGo", subLabel: "30sec", seconds: 30 },
  { id: "1min", label: "WinGo", subLabel: "1 Min", seconds: 60 },
  { id: "3min", label: "WinGo", subLabel: "3 Min", seconds: 180 },
  { id: "5min", label: "WinGo", subLabel: "5 Min", seconds: 300 },
];

/** TRX WinGo — BE periods: 60 / 180 / 300 / 600 (no 30s) */
const TRX_TABS: DurationTab[] = [
  { id: "1min", label: "TrxWinGo", subLabel: "1 Min", seconds: 60 },
  { id: "3min", label: "TrxWinGo", subLabel: "3 Min", seconds: 180 },
  { id: "5min", label: "TrxWinGo", subLabel: "5 Min", seconds: 300 },
  { id: "10min", label: "TrxWinGo", subLabel: "10 Min", seconds: 600 },
];

const HISTORY_TABS = [
  { id: "game", label: "Game history" },
  { id: "chart", label: "Chart" },
  { id: "my", label: "My history" },
];

interface Props {
  onBack?: () => void;
  onNavigate?: (screen: string) => void;
  variant?: "wingo" | "trxwingo";
}

export default function WingoPage({ onBack, onNavigate, variant = "wingo" }: Props) {
  const isTrx = variant === "trxwingo";
  const tabs = isTrx ? TRX_TABS : WINGO_TABS;
  const gameApi = isTrx ? "trxwingo" : "wingo";
  const wsPeriodTopic = isTrx ? "trx-wingo-period-creation" : "wingo-period-creation";
  const wsResultTopic = isTrx ? "trx-wingo-results" : "wingo-results";

  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  // TRX has no 30s periods on backend — default to 1 Min
  const [activeGame, setActiveGame] = useState<GameTab>(isTrx ? "1min" : "30s");
  const [historyTab, setHistoryTab] = useState<HistoryTab>("game");
  const [selectedMultiplier, setSelectedMultiplier] = useState<number>(1);
  const [countdown, setCountdown] = useState(0);
  const [period, setPeriod] = useState<WingoPeriod | null>(null);
  const [results, setResults] = useState<WingoResult[]>([]);
  const [chartResults, setChartResults] = useState<WingoResult[]>([]);
  const [myBets, setMyBets] = useState<WingoBet[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [myBetsPage, setMyBetsPage] = useState(1);
  const [myBetsTotalPages, setMyBetsTotalPages] = useState(1);
  const [betting, setBetting] = useState(false);
  const [betSheet, setBetSheet] = useState<{
    betType: "COLOR" | "NUMBER" | "SIZE";
    betChoice: string;
    label: string;
  } | null>(null);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [loading, setLoading] = useState(true);
  /** Random picker highlight key e.g. "NUMBER:7" · "COLOR:RED" · "SIZE:BIG" */
  const [randomHighlight, setRandomHighlight] = useState<string | null>(null);
  const [randomSpinning, setRandomSpinning] = useState(false);
  const randomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimeRef = useRef<string | null>(null);
  /** Prevents 1s interval from re-firing full refresh while left stays 0 */
  const zeroRefreshOnce = useRef(createOncePerKey());
  const {
    resultPopup,
    closeResultPopup,
    resetResultPopupTracking,
    trackPendingBet,
    maybeShowResultPopup: maybeShowSettledPopup,
  } = useSettledResultPopup();

  const duration = tabs.find((t) => t.id === activeGame)?.seconds ?? 30;
  const activeTabMeta = tabs.find((t) => t.id === activeGame);
  const gameLabel = isTrx
    ? `TrxWinGo ${activeTabMeta?.subLabel ?? ""}`
    : `WinGo ${activeTabMeta?.subLabel ?? ""}`;

  const loadPeriod = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await api.getGamePeriods<WingoPeriod>(gameApi, {
        duration,
        limit: 5,
      });
      if (signal?.aborted) return;
      const current =
        res.currentPeriod ??
        res.periods?.find((p) => p.status === "ACTIVE") ??
        res.periods?.[0] ??
        null;
      setPeriod(current);
      const nextEnd = current?.endTime ?? null;
      if (nextEnd && nextEnd !== endTimeRef.current) {
        zeroRefreshOnce.current.clear();
      }
      endTimeRef.current = nextEnd;
      if (nextEnd) {
        setCountdownIfChanged(setCountdown, secondsUntil(nextEnd));
      }
    } catch {
      /* keep previous */
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [gameApi, duration]);

  const loadResults = useCallback(
    async (p = 1, signal?: AbortSignal) => {
      try {
        const res = await api.getGameResults<WingoResult>(gameApi, {
          duration,
          page: p,
          limit: 10,
        });
        if (signal?.aborted) return;
        setResults(res.results ?? []);
        setTotalPages(res.totalPages ?? 1);
        setPage(res.currentPage ?? p);
      } catch {
        /* ignore */
      }
    },
    [gameApi, duration]
  );

  const loadChartData = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await api.getGameResults<WingoResult>(gameApi, {
        duration,
        page: 1,
        limit: 100,
      });
      if (signal?.aborted) return;
      setChartResults(res.results ?? []);
    } catch {
      if (!signal?.aborted) setChartResults([]);
    }
  }, [gameApi, duration]);

  const maybeShowResultPopup = useCallback(
    (bets: WingoBet[], latestResults: WingoResult[]) => {
      const latest = latestResults[0];
      const matchResult = (b: {
        periodNumber?: string | null;
        periodId?: string | null;
      }) =>
        latestResults.find(
          (r) =>
            samePeriodId(r.periodNumber, b.periodNumber) ||
            samePeriodId((r as { id?: string }).id, b.periodId)
        );

      maybeShowSettledPopup(bets, {
        isOnLatest: (b) =>
          !!latest &&
          (samePeriodId(b.periodNumber, latest.periodNumber) ||
            samePeriodId(b.periodId, (latest as { id?: string }).id)),
        hasPeriodResult: (b) => !!matchResult(b),
        enrich: (b) => {
          const periodResult = matchResult(b)!;
          return {
            periodNumber: b.periodNumber ?? periodResult.periodNumber,
            resultNumber: periodResult.resultNumber ?? undefined,
            resultColor: periodResult.resultColor ?? undefined,
            resultSize: periodResult.resultSize ?? undefined,
            resultsHeading: "Lottery results",
          };
        },
      });
    },
    [maybeShowSettledPopup]
  );

  const loadMyBets = useCallback(async (p = 1, signal?: AbortSignal) => {
    try {
      const res = await api.getGameBets<WingoBet>(gameApi, {
        duration,
        page: p,
        limit: 10,
      });
      if (signal?.aborted) return;
      const list = res.bets ?? [];
      setMyBets(list);
      setMyBetsPage(res.currentPage ?? p);
      setMyBetsTotalPages(res.totalPages ?? 1);
      // Only check for result popup on page 1 (latest bets)
      if (p === 1) {
        setResults((prev) => {
          maybeShowResultPopup(list, prev);
          return prev;
        });
      }
    } catch {
      if (!signal?.aborted) setMyBets([]);
    }
  }, [gameApi, duration, maybeShowResultPopup]);

  // Stable refs so intervals/WS don't re-bind every render and thrash network
  const loadPeriodRef = useRef(loadPeriod);
  const loadResultsRef = useRef(loadResults);
  const loadMyBetsRef = useRef(loadMyBets);
  const loadChartDataRef = useRef(loadChartData);
  const refreshUserRef = useRef(refreshUser);
  const historyTabRef = useRef(historyTab);
  loadPeriodRef.current = loadPeriod;
  loadResultsRef.current = loadResults;
  loadMyBetsRef.current = loadMyBets;
  loadChartDataRef.current = loadChartData;
  refreshUserRef.current = refreshUser;
  historyTabRef.current = historyTab;

  const refreshAfterSettle = useCallback(() => {
    loadPeriodRef.current();
    loadResultsRef.current(1);
    loadMyBetsRef.current(1);
    if (historyTabRef.current === "chart") {
      loadChartDataRef.current();
    }
    refreshUserRef.current();
  }, []);

  /** Burst reloads so history/period catch up even if WS is late or settle lags. */
  const burstRefresh = useCallback(() => {
    refreshAfterSettle();
    const delays = isTrx ? [800, 2000, 4000, 7000] : [1000, 2500];
    for (const ms of delays) {
      window.setTimeout(() => refreshAfterSettle(), ms);
    }
  }, [refreshAfterSettle, isTrx]);

  // Reset popup tracking when duration/game changes
  useEffect(() => {
    resetResultPopupTracking();
    zeroRefreshOnce.current.clear();
  }, [duration, gameApi, resetResultPopupTracking]);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    loadPeriod(ac.signal);
    loadResults(1, ac.signal);
    loadMyBets(1, ac.signal);
    return () => ac.abort();
  }, [loadPeriod, loadResults, loadMyBets]);

  // Chart is heavy (limit 100) — only when Chart tab is open
  useEffect(() => {
    if (historyTab !== "chart") return;
    const ac = new AbortController();
    loadChartData(ac.signal);
    return () => ac.abort();
  }, [historyTab, loadChartData]);

  // Isolated 1s tick: countdown + boundary refresh; TRX polls draw window tightly
  useEffect(() => {
    const t = setInterval(() => {
      if (!endTimeRef.current) return;
      const left = secondsUntil(endTimeRef.current);
      setCountdownIfChanged(setCountdown, left);
      if (left <= 0) {
        // Once per endTime: full burst so next period + history appear without manual refresh
        zeroRefreshOnce.current.run(endTimeRef.current, burstRefresh);
      }
      // TRX: poll period near draw (:54) so blockHash/result land in banner + history
      if (isTrx && left <= 12 && left >= 0) {
        void loadPeriodRef.current();
        // After draw window, pull results list (API now returns drawn, not only RESOLVED)
        if (left <= 6) {
          void loadResultsRef.current(1);
        }
      }
    }, 1000);
    return () => clearInterval(t);
  }, [burstRefresh, isTrx]);

  useEffect(() => {
    gameWs.connect();
    const u1 = gameWs.subscribe(wsPeriodTopic, (data) => {
      const d = data as WingoPeriod;
      if (d?.durationSeconds && d.durationSeconds !== duration) return;
      if (d?.status === "ACTIVE" || d?.periodNumber) {
        setPeriod((prev) => ({ ...(prev ?? ({} as WingoPeriod)), ...d }));
        if (d.endTime) {
          endTimeRef.current = d.endTime;
          zeroRefreshOnce.current.clear();
          setCountdownIfChanged(setCountdown, secondsUntil(d.endTime));
        }
        // New period → reload history so previous result is visible
        void loadResultsRef.current(1);
        void loadMyBetsRef.current(1);
        if (historyTabRef.current === "chart") {
          void loadChartDataRef.current();
        }
      }
    });
    const u2 = gameWs.subscribe(wsResultTopic, (data) => {
      const d = data as {
        durationSeconds?: number;
        periodNumber?: string;
        number?: number;
        color?: string;
        size?: string;
        blockNumber?: number;
        blockHash?: string;
        periodId?: string;
        startTime?: string;
        endTime?: string;
      };
      if (d?.durationSeconds && d.durationSeconds !== duration) return;

      // Optimistic insert so game history updates immediately on draw
      if (d?.periodNumber != null && d?.number != null) {
        const optimistic: WingoResult = {
          id: d.periodId ?? d.periodNumber,
          periodNumber: d.periodNumber,
          durationSeconds: d.durationSeconds ?? duration,
          startTime: d.startTime ?? "",
          endTime: d.endTime ?? "",
          resultNumber: d.number,
          resultColor: (d.color as WingoResult["resultColor"]) ?? "RED",
          resultSize: (d.size as WingoResult["resultSize"]) ?? "SMALL",
          blockNumber: d.blockNumber ?? null,
          blockHash: d.blockHash ?? null,
        } as WingoResult;
        setResults((prev) => {
          if (prev.some((r) => r.periodNumber === d.periodNumber)) return prev;
          return [optimistic, ...prev].slice(0, 10);
        });
        setPeriod((prev) => {
          if (!prev || prev.periodNumber !== d.periodNumber) return prev;
          return {
            ...prev,
            resultNumber: d.number,
            resultColor: d.color as WingoPeriod["resultColor"],
            resultSize: d.size as WingoPeriod["resultSize"],
            blockNumber: d.blockNumber ?? prev.blockNumber,
            blockHash: d.blockHash ?? prev.blockHash,
          };
        });
      }

      burstRefresh();
    });
    const u3 = gameWs.subscribe("bet-settlement", () => {
      loadMyBetsRef.current(1);
      refreshUserRef.current();
    });
    // TRX needs tighter backup poll (period + results) so UI rolls without WS
    const pollMs = isTrx ? 3000 : 8000;
    const poll = setInterval(() => {
      void loadPeriodRef.current();
      if (isTrx) {
        void loadResultsRef.current(1);
      }
    }, pollMs);
    return () => {
      u1();
      u2();
      u3();
      clearInterval(poll);
    };
  }, [wsPeriodTopic, wsResultTopic, duration, burstRefresh, isTrx]);

  const openBet = (betType: "COLOR" | "NUMBER" | "SIZE", betChoice: string, label: string) => {
    if (randomSpinning) return;
    if (isBettingLocked(countdown, duration)) {
      toast("Betting is locked", "error");
      return;
    }
    if (!period?.id) {
      toast("No active period", "error");
      return;
    }
    setBetSheet({ betType, betChoice, label });
  };

  /** All board options — random spin cycles these then opens the normal bet sheet */
  const RANDOM_POOL = useMemo(
    () =>
      [
        { betType: "COLOR" as const, betChoice: "GREEN", label: "Green", key: "COLOR:GREEN" },
        { betType: "COLOR" as const, betChoice: "VIOLET", label: "Violet", key: "COLOR:VIOLET" },
        { betType: "COLOR" as const, betChoice: "RED", label: "Red", key: "COLOR:RED" },
        ...Array.from({ length: 10 }, (_, i) => ({
          betType: "NUMBER" as const,
          betChoice: String(i),
          label: `Number ${i}`,
          key: `NUMBER:${i}`,
        })),
        { betType: "SIZE" as const, betChoice: "BIG", label: "Big", key: "SIZE:BIG" },
        { betType: "SIZE" as const, betChoice: "SMALL", label: "Small", key: "SIZE:SMALL" },
      ] as const,
    []
  );

  const clearRandomTimer = useCallback(() => {
    if (randomTimerRef.current) {
      clearTimeout(randomTimerRef.current);
      randomTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearRandomTimer(), [clearRandomTimer]);

  // Abort spin if lock hits mid-animation
  useEffect(() => {
    if (randomSpinning && isBettingLocked(countdown, duration)) {
      clearRandomTimer();
      setRandomSpinning(false);
      setRandomHighlight(null);
      toast("Betting locked — random cancelled", "error");
    }
  }, [countdown, duration, randomSpinning, clearRandomTimer, toast]);

  const pickRandom = useCallback(() => {
    if (randomSpinning) return;
    if (isBettingLocked(countdown, duration)) {
      toast("Betting is locked", "error");
      return;
    }
    if (!period?.id) {
      toast("No active period", "error");
      return;
    }

    const pool = RANDOM_POOL;
    const winnerIdx = Math.floor(Math.random() * pool.length);
    const hops = 18 + Math.floor(Math.random() * 6); // 18–23 hops
    const seq: number[] = [];
    let cur = Math.floor(Math.random() * pool.length);
    for (let h = 0; h < hops - 1; h++) {
      let next = Math.floor(Math.random() * pool.length);
      // Avoid immediate repeat for snappier visual
      if (next === cur) next = (next + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length;
      cur = next;
      seq.push(cur);
    }
    seq.push(winnerIdx);

    setRandomSpinning(true);
    setBetSheet(null);

    let step = 0;
    const runStep = () => {
      if (step >= seq.length) return;
      const idx = seq[step]!;
      setRandomHighlight(pool[idx]!.key);
      step += 1;
      if (step >= seq.length) {
        // Final settle pulse, then open slip
        randomTimerRef.current = setTimeout(() => {
          const win = pool[winnerIdx]!;
          setRandomSpinning(false);
          // Keep glow briefly while sheet opens
          randomTimerRef.current = setTimeout(() => setRandomHighlight(null), 420);
          setBetSheet({
            betType: win.betType,
            betChoice: win.betChoice,
            label: win.label,
          });
        }, 280);
        return;
      }
      // Ease-out: fast early → slow late (~2.0–2.3s total)
      const t = step / seq.length;
      const delay = 42 + t * t * 195;
      randomTimerRef.current = setTimeout(runStep, delay);
    };
    runStep();
  }, [
    randomSpinning,
    countdown,
    duration,
    period?.id,
    RANDOM_POOL,
    toast,
  ]);

  const isRandomHl = (key: string) => randomHighlight === key;

  const confirmBet = async (payload: BetSlipConfirmPayload) => {
    if (!betSheet || !period?.id) return;
    const betAmount = payload.total;
    if (user && betAmount > user.balance) {
      toast("Insufficient balance", "error");
      return;
    }
    if (betAmount <= 0) {
      toast("Invalid amount", "error");
      return;
    }
    setBetting(true);
    try {
      const place = isTrx ? api.placeTrxWingoBet : api.placeWingoBet;
      const res = await place({
        periodId: period.id,
        betType: betSheet.betType,
        betChoice: betSheet.betChoice,
        betAmount,
      });
      const betId = (res as { bet?: { id?: string } })?.bet?.id;
      trackPendingBet(betId);
      toast(`Bet placed: ${betSheet.label} · ${formatINR(betAmount)}`, "success");
      setBetSheet(null);
      await refreshUser();
      loadMyBets();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Bet failed", "error");
    } finally {
      setBetting(false);
    }
  };

  // Lock window depends on duration (30s→5s, longer→10s)
  const isLocked = isBettingLocked(countdown, duration);

  // Close slip if period enters lock while sheet is open
  useEffect(() => {
    if (isLocked && betSheet) setBetSheet(null);
  }, [isLocked, betSheet]);

  const recentBalls = useMemo(
    () => results.slice(0, 5).map((r) => r.resultNumber),
    [results]
  );
  const chartStats = useMemo(() => computeWingoChartStats(chartResults, 100), [chartResults]);
  /** More rows = clearer red thread path across outcomes */
  const trendRows = chartResults.slice(0, 20);

  return (
    <div className="flex flex-col min-h-screen pb-8" style={{ background: "#110D14" }}>
      <GameHeader
        title={isTrx ? "TRX" : "WinGo"}
        onBack={onBack}
        right={<GameSoundToggle />}
      />

      <GameWalletCard
        balance={user?.balance}
        onRefresh={() => refreshUser()}
        onWithdraw={() => onNavigate?.("withdraw")}
        onDeposit={() => onNavigate?.("deposit")}
      />

      <GameNoticeBar />

      <DurationTabs
        tabs={tabs}
        activeId={activeGame}
        onChange={(id) => setActiveGame(id as GameTab)}
      />

      <PeriodBanner
        gameLabel={gameLabel}
        periodNumber={period?.periodNumber ?? (loading ? "…" : "—")}
        countdown={countdown}
        recentBalls={recentBalls}
        onHowToPlay={() => setShowHowTo(true)}
        blockHashSuffix={
          isTrx && period?.blockHash
            ? period.blockHash.slice(-5)
            : isTrx
              ? null
              : undefined
        }
      />

      {/* Betting board + 3-2-1 overlay */}
      <div
        className="mx-3 mt-3 relative rounded-[14px] p-3"
        style={{
          background: "#201c26",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {/* Color bets: Green, Violet, Red */}
        <div className="grid grid-cols-3 gap-2.5 mb-3">
          {(
            [
              { choice: "GREEN", label: "Green", bg: "#17B15E", shadow: "rgba(23,177,94,0.35)", key: "COLOR:GREEN" },
              { choice: "VIOLET", label: "Violet", bg: "#9B48DB", shadow: "rgba(155,72,219,0.35)", key: "COLOR:VIOLET" },
              { choice: "RED", label: "Red", bg: "#DA3735", shadow: "rgba(218,55,53,0.35)", key: "COLOR:RED" },
            ] as const
          ).map((c) => {
            const hl = isRandomHl(c.key);
            return (
              <button
                key={c.key}
                type="button"
                disabled={randomSpinning}
                onClick={() => openBet("COLOR", c.choice, c.label)}
                className={`h-[44px] rounded-[10px] font-extrabold text-[16px] text-white active:scale-95 transition-all duration-100 ${
                  hl ? "scale-105 z-[2]" : ""
                }`}
                style={{
                  background: c.bg,
                  boxShadow: hl
                    ? `0 0 0 2.5px #FED358, 0 0 22px rgba(254,211,88,0.75), 0 3px 10px ${c.shadow}`
                    : `0 3px 10px ${c.shadow}`,
                  filter: hl ? "brightness(1.15)" : undefined,
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Number balls 0–9 in dark card container */}
        <div
          className="p-3 mb-3 rounded-[14px]"
          style={{
            background: "#17141d",
            border: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <div className="grid grid-cols-5 gap-y-3 gap-x-2 justify-items-center">
            {Array.from({ length: 10 }, (_, i) => {
              const key = `NUMBER:${i}`;
              const hl = isRandomHl(key);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={randomSpinning}
                  onClick={() => openBet("NUMBER", String(i), `Number ${i}`)}
                  className={`relative active:scale-90 transition-all duration-100 rounded-full ${
                    hl ? "scale-110 z-[2]" : ""
                  }`}
                  style={{
                    boxShadow: hl
                      ? "0 0 0 2.5px #FED358, 0 0 20px rgba(254,211,88,0.8)"
                      : undefined,
                    filter: hl ? "brightness(1.2)" : undefined,
                  }}
                >
                  <NumberBall num={i} size={52} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Multiplier / Random bar */}
        <div className="flex items-center gap-1.5 mb-3">
          <button
            type="button"
            disabled={randomSpinning || isLocked}
            onClick={pickRandom}
            className="h-[34px] px-3.5 rounded-[8px] text-[12px] font-extrabold text-[#DA3735] active:scale-95 transition-all disabled:opacity-50"
            style={{
              border: "1.5px solid #DA3735",
              background: randomSpinning
                ? "linear-gradient(90deg, rgba(254,211,88,0.2), rgba(218,55,53,0.25))"
                : "#17141d",
              boxShadow: randomSpinning
                ? "0 0 12px rgba(254,211,88,0.45)"
                : undefined,
              color: randomSpinning ? "#FED358" : "#DA3735",
            }}
          >
            {randomSpinning ? "…" : "Random"}
          </button>
          <div className="flex flex-1 items-center justify-between gap-1 overflow-x-auto no-scrollbar">
            {[1, 5, 10, 20, 50, 100].map((m) => {
              const isSelected = selectedMultiplier === m;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={randomSpinning}
                  onClick={() => setSelectedMultiplier(m)}
                  className="flex-1 min-w-[36px] h-[34px] rounded-[8px] text-[12px] font-extrabold transition-all active:scale-95"
                  style={{
                    background: isSelected ? "#17B15E" : "#17141d",
                    color: isSelected ? "#FFFFFF" : "#A195A8",
                    border: isSelected
                      ? "none"
                      : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  X{m}
                </button>
              );
            })}
          </div>
        </div>

        {/* Big / Small connected rounded button strip */}
        <div className="flex gap-0 overflow-hidden rounded-full h-[44px] shadow-md">
          <button
            type="button"
            disabled={randomSpinning}
            onClick={() => openBet("SIZE", "BIG", "Big")}
            className={`flex-1 font-black text-[17px] text-white active:opacity-90 transition-all duration-100 ${
              isRandomHl("SIZE:BIG") ? "scale-[1.03] z-[2] brightness-110" : ""
            }`}
            style={{
              background: "linear-gradient(180deg, #FFB472 0%, #DD9138 100%)",
              boxShadow: isRandomHl("SIZE:BIG")
                ? "inset 0 0 0 2.5px #FED358, 0 0 18px rgba(254,211,88,0.65)"
                : undefined,
            }}
          >
            Big
          </button>
          <button
            type="button"
            disabled={randomSpinning}
            onClick={() => openBet("SIZE", "SMALL", "Small")}
            className={`flex-1 font-black text-[17px] text-white active:opacity-90 transition-all duration-100 ${
              isRandomHl("SIZE:SMALL") ? "scale-[1.03] z-[2] brightness-110" : ""
            }`}
            style={{
              background: "linear-gradient(180deg, #6ba3e8 0%, #5088D3 100%)",
              boxShadow: isRandomHl("SIZE:SMALL")
                ? "inset 0 0 0 2.5px #FED358, 0 0 18px rgba(254,211,88,0.65)"
                : undefined,
            }}
          >
            Small
          </button>
        </div>

        {/* 3-2-1 overlay only in final 5s */}
        {countdown <= 5 && <CountdownPopout seconds={countdown} />}
      </div>

      {/* History tabs */}
      <HistoryTabBar
        tabs={HISTORY_TABS}
        active={historyTab}
        onChange={(id) => setHistoryTab(id as HistoryTab)}
      />

      <div
        className="mx-3 mt-2 rounded-[12px] overflow-hidden mb-4"
        style={{
          background: "#1a1519",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* ── Game history ── */}
        {historyTab === "game" && (
          <>
            {isTrx ? (
              <>
                {/* TRX history — screenshot: Period · Block height · Block time · Hash value · Result */}
                <div
                  className="grid grid-cols-[1.05fr_1fr_0.85fr_0.85fr_0.85fr] gap-0.5 px-1.5 py-2.5 sm:px-2.5"
                  style={{ background: "linear-gradient(90deg,#C8922A,#E8A84A)" }}
                >
                  {(
                    [
                      "Period",
                      "Block height",
                      "Block time",
                      "Hash value",
                      "Result",
                    ] as const
                  ).map((h) => (
                    <span
                      key={h}
                      className="text-[9px] sm:text-[10px] font-bold text-[#110D14] text-center leading-tight"
                    >
                      {h}
                    </span>
                  ))}
                </div>
                {results.length === 0 ? (
                  <p className="text-center text-white/30 text-[12px] py-10">
                    No results yet
                  </p>
                ) : (
                  results.map((row) => {
                    const big = isBig(row.resultNumber);
                    const size = sizeStyle(big);
                    const n = row.resultNumber;
                    const hashTail = row.blockHash
                      ? `**${row.blockHash.slice(-4)}`
                      : "**—";
                    return (
                      <div
                        key={row.id}
                        className="grid grid-cols-[1.05fr_1fr_0.85fr_0.85fr_0.85fr] gap-0.5 items-center px-1.5 py-2 sm:px-2.5 border-b border-white/[0.06]"
                      >
                        {/* Period */}
                        <span className="text-[10px] sm:text-[11px] text-[#f5d78e] text-center font-mono leading-tight tabular-nums">
                          {maskPeriodMiddle(row.periodNumber)}
                        </span>

                        {/* Block height + Tronscan ? */}
                        <div className="flex flex-col items-center justify-center gap-0.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => openTronBlock(row.blockNumber)}
                            disabled={row.blockNumber == null}
                            className="flex h-[15px] w-[15px] items-center justify-center rounded-full text-[10px] font-black leading-none text-white disabled:opacity-30 active:scale-90"
                            style={{
                              background:
                                "linear-gradient(180deg,#ff6b6b 0%,#e11d48 100%)",
                              boxShadow: "0 1px 4px rgba(225,29,72,0.45)",
                            }}
                            aria-label={
                              row.blockNumber != null
                                ? `Open Tronscan block ${row.blockNumber}`
                                : "Block unavailable"
                            }
                            title={
                              row.blockNumber != null
                                ? `View block ${row.blockNumber} on Tronscan`
                                : undefined
                            }
                          >
                            ?
                          </button>
                          <span className="text-[10px] sm:text-[11px] text-[#f5d78e] text-center font-mono tabular-nums leading-tight">
                            {row.blockNumber != null ? row.blockNumber : "—"}
                          </span>
                        </div>

                        {/* Block time */}
                        <span className="text-[10px] sm:text-[11px] text-[#f5d78e] text-center font-mono tabular-nums leading-tight">
                          {formatBlockTime(row.blockTimestamp ?? row.endTime)}
                        </span>

                        {/* Hash value (last 4) */}
                        <span className="text-[10px] sm:text-[11px] text-[#f5d78e] text-center font-mono leading-tight">
                          {hashTail}
                        </span>

                        {/* Result: colored digit + B/S */}
                        <div className="flex items-center justify-center gap-1 min-w-0">
                          <span
                            className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full text-[12px] font-black tabular-nums text-white"
                            style={{
                              background: numberBackground(n),
                              boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                            }}
                          >
                            {n}
                          </span>
                          <span
                            className="text-[12px] font-black"
                            style={{ color: size.solid }}
                          >
                            {big ? "B" : "S"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            ) : (
              <>
                <div
                  className="grid grid-cols-[1.5fr_0.7fr_0.8fr_0.7fr] gap-1 px-3 py-2.5"
                  style={{ background: "linear-gradient(90deg,#C8922A,#E8A84A)" }}
                >
                  {["Period", "Number", "Big Small", "Color"].map((h) => (
                    <span key={h} className="text-[11px] font-bold text-[#110D14] text-center">
                      {h}
                    </span>
                  ))}
                </div>
                {results.length === 0 ? (
                  <p className="text-center text-white/30 text-[12px] py-10">No results yet</p>
                ) : (
                  results.map((row) => {
                    const big = isBig(row.resultNumber);
                    const size = sizeStyle(big);
                    return (
                      <div
                        key={row.id}
                        className="grid grid-cols-[1.5fr_0.7fr_0.8fr_0.7fr] gap-1 items-center px-3 py-2.5 border-b border-white/5"
                      >
                        <span className="text-[15px] text-[#fde4bc] text-center truncate font-mono">
                          {row.periodNumber}
                        </span>
                        <span
                          className="text-[30px] font-black text-center tabular-nums"
                          style={{ color: numberPrimaryColor(row.resultNumber) }}
                        >
                          {row.resultNumber}
                        </span>
                        <span
                          className="text-[13px] font-bold text-center text-[#fde4bc]"
                          // style={{ color: size.solid }}
                        >
                          {big ? "Big" : "Small"}
                        </span>
                        <div className="flex justify-center">
                          <ColorDots num={row.resultNumber} size={11} />
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}
            <Pagination page={page} totalPages={totalPages} onChange={loadResults} />
          </>
        )}

        {/* ── Chart ── */}
        {historyTab === "chart" && (
          <div className="p-3">
            <div
              className="grid grid-cols-2 gap-1 px-2 py-2 rounded-t-[8px] mb-2"
              style={{ background: "linear-gradient(90deg,#C8922A,#E8A84A)" }}
            >
              <span className="text-[11px] font-bold text-[#110D14]">Period</span>
              <span className="text-[11px] font-bold text-[#110D14] text-right">Number</span>
            </div>

            <div className="mb-3 space-y-1.5 text-[11px]">
              <div className="flex justify-between text-white/50 px-1">
                <span>Statistic</span>
                <span>(last {chartStats.count || 100} Periods)</span>
              </div>

              <StatRow
                label="Winning Numbers"
                values={Array.from({ length: 10 }, (_, i) => i)}
                render={(n) => (
                  <span
                    className="mx-auto flex aspect-square w-full max-w-[22px] items-center justify-center rounded-full text-[9px] font-bold text-white sm:text-[10px]"
                    style={{ background: numberBackground(n) }}
                  >
                    {n}
                  </span>
                )}
              />
              <StatRow label="Missing" values={chartStats.missing} />
              <StatRow label="Avg missing" values={chartStats.avgMissing} />
              <StatRow label="Frequency" values={chartStats.frequency} />
              <StatRow label="Max consecutive" values={chartStats.maxConsecutive} />
            </div>

            {/* Trend: red thread connecting winning numbers (measured ball centers) */}
            <p className="mb-1.5 px-1 text-[10px] font-semibold text-white/40">
              Trend · red thread links each period&apos;s result
            </p>
            <WingoTrendChart rows={trendRows} />
          </div>
        )}

        {/* ── My history ── */}
        {historyTab === "my" && (
          <>
            {myBets.length === 0 ? (
              <p className="text-center text-white/30 text-[12px] py-10">No bets yet</p>
            ) : (
              myBets.map((b) => {
                const matched = results.find(
                  (r) => r.periodNumber === b.periodNumber
                );
                const selectLabel =
                  b.betType === "COLOR"
                    ? b.betChoice
                    : b.betType === "SIZE"
                      ? b.betChoice === "BIG"
                        ? "Big"
                        : "Small"
                      : b.betType === "NUMBER"
                        ? String(b.betChoice)
                        : `${b.betType} ${b.betChoice}`;
                const selectColor =
                  b.betType === "COLOR"
                    ? b.betChoice.toUpperCase() === "GREEN"
                      ? "#17B15E"
                      : b.betChoice.toUpperCase() === "VIOLET"
                        ? "#9B48DB"
                        : "#DA3735"
                    : b.betType === "SIZE"
                      ? b.betChoice.toUpperCase() === "BIG"
                        ? "#DD9138"
                        : "#5088D3"
                      : "#3B82F6";
                let resultText: string | null = null;
                if (matched) {
                  const n = matched.resultNumber;
                  const colors = matched.resultColor
                    ? String(matched.resultColor)
                        .split(/[|,/\s]+/)
                        .filter(Boolean)
                        .map((c) => c.charAt(0) + c.slice(1).toLowerCase())
                        .join(" ")
                    : "";
                  const size = matched.resultSize
                    ? matched.resultSize.charAt(0) +
                      matched.resultSize.slice(1).toLowerCase()
                    : isBig(n)
                      ? "Big"
                      : "Small";
                  resultText = [n, colors, size].filter(Boolean).join(" ");
                }
                return (
                  <BetHistoryCard
                    key={b.id}
                    detail={{
                      id: b.id,
                      selectLabel,
                      selectColor,
                      periodNumber: b.periodNumber,
                      betAmount: b.betAmount,
                      contractAmount: b.contractAmount,
                      status: b.status,
                      winAmount: b.result?.winAmount,
                      isWin: b.result?.isWin,
                      createdAt: b.createdAt,
                      resultText,
                      orderPrefix: isTrx ? "TRX" : "WG",
                    }}
                  />
                );
              })
            )}
            <Pagination
              page={myBetsPage}
              totalPages={myBetsTotalPages}
              onChange={(p) => loadMyBets(p)}
              alwaysShow={myBets.length > 0}
            />
          </>
        )}
      </div>

      <BetConfirmSheet
        open={!!betSheet}
        label={
          betSheet?.betType === "COLOR"
            ? `Choose ${betSheet.label}`
            : betSheet?.betType === "SIZE"
              ? `Choose ${betSheet.label}`
              : betSheet?.label ?? ""
        }
        gameTitle={gameLabel.replace(/\s+/g, "")}
        ballNumber={
          betSheet?.betType === "NUMBER" ? Number(betSheet.betChoice) : null
        }
        theme={
          betSheet
            ? themeFromBet(betSheet.betType, betSheet.betChoice)
            : "red"
        }
        periodNumber={period?.periodNumber}
        betting={betting}
        balance={user?.balance}
        initialMultiplier={selectedMultiplier}
        onCancel={() => setBetSheet(null)}
        onConfirm={() => {}}
        onConfirmTotal={confirmBet}
        onRules={() => setShowRules(true)}
      />

      <ResultPopup
        open={!!resultPopup}
        isWin={resultPopup?.isWin ?? false}
        resultNumber={resultPopup?.resultNumber}
        resultColor={resultPopup?.resultColor}
        resultSize={resultPopup?.resultSize}
        resultsHeading={resultPopup?.resultsHeading ?? "Lottery results"}
        winAmount={resultPopup?.winAmount ?? 0}
        periodLabel={gameLabel.trim()}
        periodNumber={resultPopup?.periodNumber}
        onClose={closeResultPopup}
      />

      {/* Pre-sale rules */}
      {showRules && (
        <div
          className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60"
          onClick={() => setShowRules(false)}
        >
          <div
            className="w-full rounded-t-2xl bg-white p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center font-black text-slate-800 text-base mb-3">Pre-sale rules</p>
            <ul className="text-[12px] text-slate-600 space-y-2 leading-relaxed">
              <li>• After placing a bet you cannot cancel it.</li>
              <li>• Betting closes: last 5s (30sec), last 10s (1/3/5 Min).</li>
              <li>• Odd green · Even red · 0 Violet+Red · 5 Violet+Green.</li>
              <li>• Big = 5–9 (orange) · Small = 0–4 (blue).</li>
              <li>• Total amount = Amount × Quantity (X1/X3/… set quantity).</li>
            </ul>
            <button
              type="button"
              onClick={() => setShowRules(false)}
              className="mt-5 w-full h-11 rounded-full font-bold text-white"
              style={{ background: "linear-gradient(180deg,#ff5a5f,#e11d48)" }}
            >
              I understand
            </button>
          </div>
        </div>
      )}

      {/* How to play modal */}
      {showHowTo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-5"
          onClick={() => setShowHowTo(false)}
        >
          <div
            className="w-full max-w-[340px] rounded-2xl p-5"
            style={{ background: "#241E22", border: "1px solid rgba(254,211,88,0.25)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center text-[#FED358] font-black text-base mb-3">How to play</p>
            <ul className="text-[12px] text-white/70 space-y-2 leading-relaxed">
              <li>• Select a duration: 30sec / 1Min / 3Min / 5Min.</li>
              <li>• Bet Green, Violet, Red, a number 0–9, or Big / Small.</li>
              <li>• Odd green (1,3,7,9) · Even red (2,4,6,8) · 0=Violet+Red · 5=Violet+Green.</li>
              <li>• Big = 5–9 (orange) · Small = 0–4 (blue).</li>
              <li>• Betting locks: last 5s (30sec), last 10s (1/3/5 Min).</li>
            </ul>
            <button
              type="button"
              onClick={() => setShowHowTo(false)}
              className="mt-5 w-full h-10 rounded-full font-bold text-[#110D14]"
              style={{ background: "linear-gradient(180deg,#FED358,#FFB472)" }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Mask middle of period id so it fits: 202607171234 → 2026**1234 */
function maskPeriodMiddle(periodNumber: string | null | undefined): string {
  const s = String(periodNumber ?? "");
  if (s.length <= 8) return s || "—";
  const head = 4;
  const tail = 4;
  if (s.length <= head + tail) return s;
  return `${s.slice(0, head)}**${s.slice(-tail)}`;
}

/** Block time as h:mm:ss (screenshot style, e.g. 1:36:54) */
function formatBlockTime(ts: string | number | null | undefined): string {
  if (ts == null || ts === "") return "—";
  let d: Date | null = null;
  const n = Number(ts);
  if (Number.isFinite(n) && n > 1e11) {
    d = new Date(n); // epoch ms
  } else if (Number.isFinite(n) && n > 1e9 && n < 1e11) {
    d = new Date(n * 1000); // epoch seconds
  } else {
    const parsed = new Date(String(ts));
    if (!Number.isNaN(parsed.getTime())) d = parsed;
  }
  if (!d || Number.isNaN(d.getTime())) {
    // last resort: existing helper
    try {
      return formatTime(String(ts));
    } catch {
      return "—";
    }
  }
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  // 12h-ish single digit hour like screenshot "1:36:54" when hour < 10
  return `${h}:${m}:${s}`;
}

function StatRow({
  label,
  values,
  render,
}: {
  label: string;
  values: number[];
  render?: (n: number, i: number) => React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className="w-[72px] shrink-0 text-[10px] text-white/55 sm:w-[88px]">{label}</span>
      <div className="grid min-w-0 flex-1 grid-cols-10 gap-px">
        {values.map((v, i) =>
          render ? (
            <div key={i} className="flex min-w-0 items-center justify-center">
              {render(v, i)}
            </div>
          ) : (
            <span
              key={i}
              className="min-w-0 text-center text-[9px] tabular-nums text-white/70 sm:text-[10px]"
            >
              {v}
            </span>
          )
        )}
      </div>
    </div>
  );
}
