"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./ui/Toast";
import * as api from "../lib/api";
import type { WingoBet, WingoPeriod, WingoResult } from "../lib/api";
import { formatINR, formatTime } from "../lib/format";
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
  countdownSecondsUntil,
  createStuckZeroRecovery,
  isLivePeriod,
  pickLivePeriod,
} from "../lib/period-live";
import {
  HISTORY_MAX_PAGES,
  capHistoryPage,
  capHistoryPages,
} from "../lib/history-pages";
import { useLotteryBetDepositGate } from "../hooks/useLotteryBetDepositGate";
import { useSpaBackClose } from "../hooks/useSpaBackClose";
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
  const [myBets, setMyBets] = useState<WingoBet[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [myBetsPage, setMyBetsPage] = useState(1);
  const [myBetsTotalPages, setMyBetsTotalPages] = useState(1);
  const pageRef = useRef(1);
  const myBetsPageRef = useRef(1);
  useEffect(() => {
    pageRef.current = page;
    myBetsPageRef.current = myBetsPage;
  }, [page, myBetsPage]);
  const [betSheet, setBetSheet] = useState<{
    betType: "COLOR" | "NUMBER" | "SIZE";
    betChoice: string;
    label: string;
  } | null>(null);
  /** A slip object may create at most one request; a new slip is a new object. */
  const submittedSlipRef = useRef<typeof betSheet>(null);
  const { ensureCanBet, depositModal } = useLotteryBetDepositGate(
    isTrx ? "Trx Win Go" : "Win Go",
    onNavigate,
    () => setBetSheet(null)
  );
  const [showHowTo, setShowHowTo] = useState(false);
  const [showRules, setShowRules] = useState(false);
  useSpaBackClose(showHowTo, () => setShowHowTo(false), "wingo-howto");
  useSpaBackClose(showRules, () => setShowRules(false), "wingo-rules");
  const [loading, setLoading] = useState(true);
  /** Random picker highlight key e.g. "NUMBER:7" · "COLOR:RED" · "SIZE:BIG" */
  const [randomHighlight, setRandomHighlight] = useState<string | null>(null);
  const [randomSpinning, setRandomSpinning] = useState(false);
  const randomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burstTimersRef = useRef<number[]>([]);
  const endTimeRef = useRef<string | null>(null);
  /** Only the newest period request may update the clock. */
  const periodRequestRef = useRef(0);
  const resultsRequestRef = useRef(0);
  const betsRequestRef = useRef(0);
  /** Prevents 1s interval from re-firing full refresh while left stays 0 */
  const zeroRefreshOnce = useRef(createOncePerKey());
  const stuckZero = useRef(createStuckZeroRecovery());
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
    const requestId = ++periodRequestRef.current;
    try {
      const res = await api.getGamePeriods<WingoPeriod>(gameApi, {
        duration,
        limit: 5,
      });
      if (signal?.aborted || requestId !== periodRequestRef.current) return;
      const current = pickLivePeriod(res.currentPeriod, res.periods);
      // During the sub-second handoff keep the last period label painted. The
      // zero countdown still locks betting until a genuinely live round lands.
      if (current) setPeriod(current);
      const nextEnd = current?.endTime ?? null;
      if (nextEnd && nextEnd !== endTimeRef.current) {
        zeroRefreshOnce.current.clear();
        stuckZero.current.reset();
      }
      endTimeRef.current = nextEnd;
      if (nextEnd) {
        setCountdownIfChanged(setCountdown, countdownSecondsUntil(nextEnd));
      } else {
        setCountdownIfChanged(setCountdown, 0);
      }
    } catch {
      /* keep previous */
    } finally {
      if (!signal?.aborted && requestId === periodRequestRef.current) {
        setLoading(false);
      }
    }
  }, [gameApi, duration]);

  const loadResults = useCallback(
    async (p = 1, signal?: AbortSignal) => {
      const requestId = ++resultsRequestRef.current;
      try {
        const page = capHistoryPage(p);
        const res = await api.getGameResults<WingoResult>(gameApi, {
          duration,
          page,
          limit: 10,
        });
        if (signal?.aborted || requestId !== resultsRequestRef.current) return;
        setResults(res.results ?? []);
        setTotalPages(capHistoryPages(res.totalPages));
        setPage(capHistoryPage(res.currentPage ?? page));
      } catch {
        /* ignore */
      }
    },
    [gameApi, duration]
  );

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
    const requestId = ++betsRequestRef.current;
    try {
      const page = capHistoryPage(p);
      const res = await api.getGameBets<WingoBet>(gameApi, {
        duration,
        page,
        limit: 10,
      });
      if (signal?.aborted || requestId !== betsRequestRef.current) return;
      const list = res.bets ?? [];
      setMyBets(list);
      setMyBetsPage(capHistoryPage(res.currentPage ?? page));
      setMyBetsTotalPages(capHistoryPages(res.totalPages));
      // Only check for result popup on page 1 (latest bets)
      if (p === 1) {
        setResults((prev) => {
          maybeShowResultPopup(list, prev);
          return prev;
        });
      }
    } catch {
      if (!signal?.aborted && requestId === betsRequestRef.current) {
        setMyBets([]);
      }
    }
  }, [gameApi, duration, maybeShowResultPopup]);

  // Stable refs so intervals/WS don't re-bind every render and thrash network
  const loadPeriodRef = useRef(loadPeriod);
  const loadResultsRef = useRef(loadResults);
  const loadMyBetsRef = useRef(loadMyBets);
  const refreshUserRef = useRef(refreshUser);
  useEffect(() => {
    loadPeriodRef.current = loadPeriod;
    loadResultsRef.current = loadResults;
    loadMyBetsRef.current = loadMyBets;
    refreshUserRef.current = refreshUser;
  }, [loadPeriod, loadResults, loadMyBets, refreshUser]);

  const refreshAfterSettle = useCallback(() => {
    loadPeriodRef.current();
    loadResultsRef.current(pageRef.current);
    loadMyBetsRef.current(myBetsPageRef.current);
    refreshUserRef.current();
  }, []);

  const clearBurstTimers = useCallback(() => {
    for (const timer of burstTimersRef.current) window.clearTimeout(timer);
    burstTimersRef.current = [];
  }, []);

  /** Burst reloads so history/period catch up even if WS is late or settle lags. */
  const burstRefresh = useCallback(() => {
    clearBurstTimers();
    refreshAfterSettle();
    const delays = isTrx ? [800, 2000, 4000, 7000] : [1000, 2500];
    burstTimersRef.current = delays.map((ms) =>
      window.setTimeout(() => refreshAfterSettle(), ms)
    );
  }, [clearBurstTimers, refreshAfterSettle, isTrx]);

  // Reset popup tracking when duration/game changes
  useEffect(() => {
    resetResultPopupTracking();
    zeroRefreshOnce.current.clear();
    stuckZero.current.reset();
    clearBurstTimers();
  }, [duration, gameApi, resetResultPopupTracking, clearBurstTimers]);

  useEffect(() => () => clearBurstTimers(), [clearBurstTimers]);

  useEffect(() => {
    const ac = new AbortController();
    const kickoff = window.setTimeout(() => {
      void loadPeriod(ac.signal);
      void loadResults(1, ac.signal);
      void loadMyBets(1, ac.signal);
    }, 0);
    return () => {
      window.clearTimeout(kickoff);
      ac.abort();
    };
  }, [loadPeriod, loadResults, loadMyBets]);

  // Fast wall-clock tick. State only changes once per displayed second.
  useEffect(() => {
    const t = setInterval(() => {
      const end = endTimeRef.current;
      if (!end) {
        setCountdownIfChanged(setCountdown, 0);
        stuckZero.current.note(0, Date.now(), () => loadPeriodRef.current());
        return;
      }
      const left = countdownSecondsUntil(end);
      setCountdownIfChanged(setCountdown, left);
      if (left <= 0) {
        // Once per endTime: full burst so next period + history appear without manual refresh
        zeroRefreshOnce.current.run(end, burstRefresh);
      }
      // TRX: HTTP backup near draw only if live socket is down (WS already pushes)
      if (isTrx && !gameWs.isOpen() && left <= 12 && left >= 0) {
        void loadPeriodRef.current();
        if (left <= 6) {
          void loadResultsRef.current(pageRef.current);
        }
      }
      // Stuck at 00 > ~2s (missed WS / expired slot): refetch live period. Lock 5s/10s unchanged.
      stuckZero.current.note(left, Date.now(), () => loadPeriodRef.current());
    }, 250);
    return () => clearInterval(t);
  }, [burstRefresh, isTrx]);

  useEffect(() => {
    gameWs.connect();
    const u1 = gameWs.subscribe(wsPeriodTopic, (data) => {
      const d = data as WingoPeriod;
      if (d?.durationSeconds && d.durationSeconds !== duration) return;
      if (!isLivePeriod(d)) return;

      const incomingEnd = new Date(d.endTime).getTime();
      const displayedEnd = endTimeRef.current
        ? new Date(endTimeRef.current).getTime()
        : 0;
      // A delayed socket packet must never roll the UI back to an older round.
      if (Number.isFinite(displayedEnd) && displayedEnd > incomingEnd) return;

      periodRequestRef.current += 1;
      setLoading(false);
      setPeriod((prev) => ({ ...(prev ?? ({} as WingoPeriod)), ...d }));
      endTimeRef.current = d.endTime;
      zeroRefreshOnce.current.clear();
      stuckZero.current.reset();
      setCountdownIfChanged(setCountdown, countdownSecondsUntil(d.endTime));
      // Reload the page they are on — do not yank 5/50 back to 1
      void loadResultsRef.current(pageRef.current);
      void loadMyBetsRef.current(myBetsPageRef.current);
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
          if (pageRef.current > 1) return prev;
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
      loadMyBetsRef.current(myBetsPageRef.current);
      refreshUserRef.current();
    });
    const u4 = gameWs.onConnectionChange((open) => {
      if (!open) return;
      // Catch up immediately after a reconnect instead of waiting for a poll.
      void loadPeriodRef.current();
      void loadResultsRef.current(pageRef.current);
      void loadMyBetsRef.current(myBetsPageRef.current);
    });
    // TRX needs tighter backup poll (period + results) so UI rolls without WS
    const pollMs = isTrx ? 3000 : 8000;
    const poll = setInterval(() => {
      void loadPeriodRef.current();
      if (isTrx) {
        void loadResultsRef.current(pageRef.current);
      }
    }, pollMs);
    return () => {
      u1();
      u2();
      u3();
      u4();
      clearInterval(poll);
    };
  }, [wsPeriodTopic, wsResultTopic, duration, burstRefresh, isTrx]);

  // Background tabs throttle timers. Resync immediately when the player returns.
  useEffect(() => {
    let lastSyncAt = 0;
    const sync = () => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastSyncAt < 500) return;
      lastSyncAt = now;
      gameWs.connect();
      void loadPeriodRef.current();
      void loadResultsRef.current(pageRef.current);
      void loadMyBetsRef.current(myBetsPageRef.current);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") sync();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", sync);
    window.addEventListener("online", sync);
    window.addEventListener("pageshow", sync);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", sync);
      window.removeEventListener("online", sync);
      window.removeEventListener("pageshow", sync);
    };
  }, []);

  const openBet = (betType: "COLOR" | "NUMBER" | "SIZE", betChoice: string, label: string) => {
    if (randomSpinning) return;
    if (isBettingLocked(countdown, duration)) return;
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
    if (!randomSpinning || !isBettingLocked(countdown, duration)) return;
    clearRandomTimer();
    const timer = window.setTimeout(() => {
      setRandomSpinning(false);
      setRandomHighlight(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [countdown, duration, randomSpinning, clearRandomTimer]);

  const pickRandom = useCallback(() => {
    if (randomSpinning) return;
    if (isBettingLocked(countdown, duration)) return;
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
    const sheet = betSheet;
    if (!sheet || !period?.id) return;
    if (submittedSlipRef.current === sheet) return;
    submittedSlipRef.current = sheet;
    const releaseRejectedSlip = () => {
      if (submittedSlipRef.current === sheet) submittedSlipRef.current = null;
    };
    let canBet = false;
    try {
      canBet = await ensureCanBet();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Bet check failed", "error");
      releaseRejectedSlip();
      return;
    }
    if (!canBet) {
      releaseRejectedSlip();
      return;
    }
    if (isBettingLocked(countdown, duration)) {
      toast("Betting closed for this period", "error");
      releaseRejectedSlip();
      setBetSheet(null);
      return;
    }
    const betAmount = payload.total;
    if (user && betAmount > user.balance) {
      toast("Insufficient balance", "error");
      releaseRejectedSlip();
      return;
    }
    if (betAmount <= 0) {
      toast("Invalid amount", "error");
      releaseRejectedSlip();
      return;
    }
    const periodId = period.id;
    setBetSheet(null);
    try {
      const place = isTrx ? api.placeTrxWingoBet : api.placeWingoBet;
      const res = await place({
        periodId,
        betType: sheet.betType,
        betChoice: sheet.betChoice,
        betAmount,
      });
      const betId = (res as { bet?: { id?: string } })?.bet?.id;
      trackPendingBet(betId);
      toast(`Bet placed: ${sheet.label} · ${formatINR(betAmount)}`, "success");
      await refreshUser();
      loadMyBets(myBetsPageRef.current);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Bet failed", "error");
    }
  };

  // Lock window depends on duration (30s→5s, longer→10s)
  const isLocked = isBettingLocked(countdown, duration);

  // Close slip if period enters lock while sheet is open
  useEffect(() => {
    if (!isLocked || !betSheet) return;
    const timer = window.setTimeout(() => setBetSheet(null), 0);
    return () => window.clearTimeout(timer);
  }, [isLocked, betSheet]);

  const recentBalls = useMemo(
    () => results.slice(0, 5).map((r) => r.resultNumber),
    [results]
  );
  const chartStats = useMemo(() => computeWingoChartStats(results, 100), [results]);
  const trendRows = results;

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
        onChange={(id) => {
          if (id === activeGame) return;
          periodRequestRef.current += 1;
          resultsRequestRef.current += 1;
          betsRequestRef.current += 1;
          setLoading(true);
          setPeriod(null);
          endTimeRef.current = null;
          setCountdown(0);
          setActiveGame(id as GameTab);
        }}
      />

      <PeriodBanner
        gameLabel={gameLabel}
        periodNumber={period?.periodNumber ?? (loading ? "Syncing…" : "Next round…")}
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
          opacity: isLocked ? 0.72 : 1,
          pointerEvents: isLocked ? "none" : "auto",
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
                disabled={randomSpinning || isLocked}
                onClick={() => openBet("COLOR", c.choice, c.label)}
                className={`h-[44px] rounded-[10px] font-extrabold text-[18px] text-white active:scale-95 transition-all duration-100 ${
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
                  disabled={randomSpinning || isLocked}
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
            className="h-[34px] px-3.5 rounded-[8px] text-[14px] font-extrabold text-[#DA3735] active:scale-95 transition-all disabled:opacity-50"
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
                  disabled={randomSpinning || isLocked}
                  onClick={() => setSelectedMultiplier(m)}
                  className="flex-1 min-w-[36px] h-[34px] rounded-[8px] text-[14px] font-extrabold transition-all active:scale-95"
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
            disabled={randomSpinning || isLocked}
            onClick={() => openBet("SIZE", "BIG", "Big")}
            className={`flex-1 font-black text-[19px] text-white active:opacity-90 transition-all duration-100 ${
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
            disabled={randomSpinning || isLocked}
            onClick={() => openBet("SIZE", "SMALL", "Small")}
            className={`flex-1 font-black text-[19px] text-white active:opacity-90 transition-all duration-100 ${
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
        {countdown > 0 && countdown <= 5 && (
          <CountdownPopout seconds={countdown} />
        )}
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
          background: "#18181f",
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
                      className="text-[11px] sm:text-[12px] font-bold text-[#110D14] text-center leading-tight"
                    >
                      {h}
                    </span>
                  ))}
                </div>
                {results.length === 0 ? (
                  <p className="text-center text-white/30 text-[14px] py-10">
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
                        <span className="text-[12px] sm:text-[13px] text-[#f5d78e] text-center font-mono leading-tight tabular-nums">
                          {maskPeriodMiddle(row.periodNumber)}
                        </span>

                        {/* Block height + Tronscan ? */}
                        <div className="flex flex-col items-center justify-center gap-0.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => openTronBlock(row.blockNumber)}
                            disabled={row.blockNumber == null}
                            className="flex h-[15px] w-[15px] items-center justify-center rounded-full text-[12px] font-black leading-none text-white disabled:opacity-30 active:scale-90"
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
                          <span className="text-[12px] sm:text-[13px] text-[#f5d78e] text-center font-mono tabular-nums leading-tight">
                            {row.blockNumber != null ? row.blockNumber : "—"}
                          </span>
                        </div>

                        {/* Block time */}
                        <span className="text-[12px] sm:text-[13px] text-[#f5d78e] text-center font-mono tabular-nums leading-tight">
                          {formatBlockTime(row.blockTimestamp ?? row.endTime)}
                        </span>

                        {/* Hash value (last 4) */}
                        <span className="text-[12px] sm:text-[13px] text-[#f5d78e] text-center font-mono leading-tight">
                          {hashTail}
                        </span>

                        {/* Result: colored digit + B/S */}
                        <div className="flex items-center justify-center gap-1 min-w-0">
                          <span
                            className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full text-[14px] font-black tabular-nums text-white"
                            style={{
                              background: numberBackground(n),
                              boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                            }}
                          >
                            {n}
                          </span>
                          <span
                            className="text-[14px] font-black"
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
                    <span key={h} className="text-[13px] font-bold text-[#110D14] text-center">
                      {h}
                    </span>
                  ))}
                </div>
                {results.length === 0 ? (
                  <p className="text-center text-white/30 text-[14px] py-10">No results yet</p>
                ) : (
                  results.map((row) => {
                    const big = isBig(row.resultNumber);
                    return (
                      <div
                        key={row.id}
                        className="grid grid-cols-[1.5fr_0.7fr_0.8fr_0.7fr] gap-1 items-center px-3 py-2.5 border-b border-white/5"
                      >
                        <span className="text-[17px] text-[#fde4bc] text-center truncate font-mono">
                          {row.periodNumber}
                        </span>
                        <span
                          className="text-[32px] font-black text-center tabular-nums"
                          style={{ color: numberPrimaryColor(row.resultNumber) }}
                        >
                          {row.resultNumber}
                        </span>
                        <span
                          className="text-[15px] font-bold text-center text-[#fde4bc]"
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
            <Pagination
              page={page}
              totalPages={totalPages}
              onChange={loadResults}
              maxPages={HISTORY_MAX_PAGES}
            />
          </>
        )}

        {/* ── Chart ── */}
        {historyTab === "chart" && (
          <>
            {/* Top Header Bar */}
            <div
              className="grid grid-cols-2 gap-1 px-3 py-2.5"
              style={{ background: "#E28100" }}
            >
              <span className="text-[14px] font-bold text-white tracking-wide sm:text-[15px]">Period</span>
              <span className="text-[14px] font-bold text-white tracking-wide text-right sm:text-[15px]">Number</span>
            </div>

            {/* Statistics Section */}
            <div className="p-2.5 space-y-1.5 border-b border-[#2d2d38]">
              <div className="flex justify-between items-center px-0.5 pb-1">
                <span className="text-[13px] font-bold text-white sm:text-[14px]">Statistic</span>
                <span className="text-[12px] font-medium text-[#FED358] sm:text-[13px]">
                  (last {chartStats.count || results.length} Periods)
                </span>
              </div>

              <StatRow
                label="Winning Numbers"
                values={Array.from({ length: 10 }, (_, i) => i)}
                render={(n) => (
                  <span
                    className="mx-auto flex aspect-square w-full max-w-[22px] sm:max-w-[24px] items-center justify-center rounded-full text-[12px] font-medium text-[#ef4444] sm:text-[13px]"
                    style={{
                      border: "1.5px solid #ef4444",
                      background: "transparent",
                    }}
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

            {/* Trend Chart */}
            <div className="p-2.5 pt-0">
              <WingoTrendChart rows={trendRows} />
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              onChange={loadResults}
              maxPages={HISTORY_MAX_PAGES}
            />
          </>
        )}

        {/* ── My history ── */}
        {historyTab === "my" && (
          <>
            {myBets.length === 0 ? (
              <p className="text-center text-white/30 text-[14px] py-10">No bets yet</p>
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
              maxPages={HISTORY_MAX_PAGES}
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
            <ul className="text-[14px] text-slate-600 space-y-2 leading-relaxed">
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
            <ul className="text-[14px] text-white/70 space-y-2 leading-relaxed">
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
      {depositModal}
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
    <div
      className="grid w-full min-w-0 items-center gap-x-1 py-1"
      style={{
        gridTemplateColumns: "minmax(64px, 34%) minmax(0, 1fr) 22px",
      }}
    >
      <span className="min-w-0 truncate text-[13px] font-medium text-[#cbd5e1] sm:text-[14px]">
        {label}
      </span>
      <div className="grid min-w-0 grid-cols-10 gap-px">
        {values.map((v, i) =>
          render ? (
            <div key={i} className="flex min-w-0 items-center justify-center">
              {render(v, i)}
            </div>
          ) : (
            <span
              key={i}
              className="min-w-0 text-center text-[13px] font-medium tabular-nums text-[#cbd5e1] sm:text-[14px]"
            >
              {v}
            </span>
          )
        )}
      </div>
      <span className="w-[22px]" aria-hidden />
    </div>
  );
}
