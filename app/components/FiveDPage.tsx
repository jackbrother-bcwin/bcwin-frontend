"use client";

/**
 * 5D Lottery — production page (mirrors K3 lifecycle).
 *
 * Backend contract (apps/api + engine/5d):
 * - Durations: 30 / 60 / 180 / 300
 * - Result: 5 digits A–E (0–9) + sum (0–45)
 * - POSITION bets: EXACT_NUMBER | LOW | HIGH | ODD | EVEN on A–E
 *   LOW=0–4, HIGH=5–9 · 9x exact · 1.95x side
 * - SUM bets: SUM_EXACT | LOW | HIGH | ODD | EVEN
 *   LOW=0–22, HIGH=23–45 · 45x exact · 1.95x side
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./ui/Toast";
import * as api from "../lib/api";
import type { FiveDBet, FiveDPeriod, FiveDResult } from "../lib/api";
import { formatINR, secondsUntil } from "../lib/format";
import { gameWs } from "../lib/ws";
import {
  BetConfirmSheet,
  CountdownPopout,
  DurationTabs,
  GameHeader,
  GameNoticeBar,
  GameWalletCard,
  HistoryTabBar,
  NumberBall,
  Pagination,
  PeriodBanner,
  ResultPopup,
  isBettingLocked,
  type DurationTab,
} from "./game/shared";
import FiveDStage, { FiveDMiniDigits } from "./game/FiveDStage";
import BetHistoryCard from "./game/BetHistoryCard";
import {
  samePeriodId,
  useSettledResultPopup,
} from "./game/useSettledResultPopup";
import { fiveDResultChips, RESULT_HEADINGS } from "./game/resultChips";
import { createOncePerKey, setCountdownIfChanged } from "../lib/game-refresh";
import { initCountdownAudioMute } from "../lib/countdown-audio";
import { pickLivePeriod } from "../lib/period-live";
import { useLotteryBetDepositGate } from "../hooks/useLotteryBetDepositGate";

type GameTab = "30s" | "1min" | "3min" | "5min";
type HistoryTab = "game" | "my";
type Pos = "A" | "B" | "C" | "D" | "E" | "SUM";

const TABS: DurationTab[] = [
  { id: "30s", label: "5D", subLabel: "30sec", seconds: 30 },
  { id: "1min", label: "5D", subLabel: "1 Min", seconds: 60 },
  { id: "3min", label: "5D", subLabel: "3 Min", seconds: 180 },
  { id: "5min", label: "5D", subLabel: "5 Min", seconds: 300 },
];

const MULTIPLIERS = [1, 5, 10, 20, 50, 100];
const BASE_AMOUNTS = [1, 10, 100, 1000];

const SIDE_BTNS = [
  { t: "LOW" as const, l: "Low", sub: "0-4", bg: "linear-gradient(180deg,#6ba3e8,#5088D3)", odds: "1.95x" },
  { t: "HIGH" as const, l: "High", sub: "5-9", bg: "linear-gradient(180deg,#FFB472,#DD9138)", odds: "1.95x" },
  { t: "ODD" as const, l: "Odd", sub: "", bg: "linear-gradient(180deg,#2dd46f,#17B15E)", odds: "1.95x" },
  { t: "EVEN" as const, l: "Even", sub: "", bg: "linear-gradient(180deg,#f05555,#DA3735)", odds: "1.95x" },
];

const SUM_SIDE = [
  { t: "LOW" as const, l: "Low", sub: "0-22", bg: "linear-gradient(180deg,#6ba3e8,#5088D3)", odds: "1.95x" },
  { t: "HIGH" as const, l: "High", sub: "23-45", bg: "linear-gradient(180deg,#FFB472,#DD9138)", odds: "1.95x" },
  { t: "ODD" as const, l: "Odd", sub: "", bg: "linear-gradient(180deg,#2dd46f,#17B15E)", odds: "1.95x" },
  { t: "EVEN" as const, l: "Even", sub: "", bg: "linear-gradient(180deg,#f05555,#DA3735)", odds: "1.95x" },
];

interface Props {
  onBack?: () => void;
  onNavigate?: (screen: string) => void;
}

type PendingBet = {
  betCategory: "POSITION" | "SUM";
  betType: string;
  position?: string;
  betChoice: string;
  label: string;
  theme: "blue" | "orange" | "green" | "red" | "violet";
};

export default function FiveDPage({ onBack, onNavigate }: Props) {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [activeGame, setActiveGame] = useState<GameTab>("30s");
  const [pos, setPos] = useState<Pos>("A");
  const [period, setPeriod] = useState<FiveDPeriod | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [results, setResults] = useState<FiveDResult[]>([]);
  const [myBets, setMyBets] = useState<FiveDBet[]>([]);
  const [baseAmount, setBaseAmount] = useState(10);
  const [mult, setMult] = useState(1);
  const [historyTab, setHistoryTab] = useState<HistoryTab>("game");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pending, setPending] = useState<PendingBet | null>(null);
  const [betting, setBetting] = useState(false);
  const { ensureCanBet, depositModal } = useLotteryBetDepositGate(
    "5D",
    onNavigate,
    () => setPending(null)
  );

  const endTimeRef = useRef<string | null>(null);
  const periodIdRef = useRef<string | null>(null);
  const zeroRefreshOnce = useRef(createOncePerKey());
  const loadInFlight = useRef(false);

  const duration = TABS.find((t) => t.id === activeGame)?.seconds ?? 30;
  const tabMeta = TABS.find((t) => t.id === activeGame);
  const {
    resultPopup,
    closeResultPopup,
    resetResultPopupTracking,
    trackPendingBet,
    maybeShowResultPopup,
  } = useSettledResultPopup();
  const resultsRef = useRef(results);
  const myBetsRef = useRef(myBets);
  resultsRef.current = results;
  myBetsRef.current = myBets;

  const tryResultPopup = useCallback(
    (bets: FiveDBet[], resultList: FiveDResult[]) => {
      const latest = resultList[0];
      const matchResult = (b: { periodNumber?: string | null; periodId?: string | null }) =>
        resultList.find(
          (r) =>
            samePeriodId(r.periodNumber, b.periodNumber) ||
            samePeriodId((r as { id?: string }).id, b.periodId)
        );

      maybeShowResultPopup(bets, {
        isOnLatest: (b) =>
          !!latest &&
          (samePeriodId(b.periodNumber, latest.periodNumber) ||
            samePeriodId(b.periodId, (latest as { id?: string }).id)),
        hasPeriodResult: (b) => !!matchResult(b),
        enrich: (b) => {
          const matched = matchResult(b)!;
          return {
            periodNumber: b.periodNumber ?? matched.periodNumber,
            resultsHeading: RESULT_HEADINGS.fived,
            chips: fiveDResultChips(matched),
          };
        },
      });
    },
    [maybeShowResultPopup]
  );

  const applyPeriod = useCallback((next: FiveDPeriod | null) => {
    if (!next) return;
    setPeriod(next);
    periodIdRef.current = next.id ?? null;
    const end = next.endTime ?? null;
    if (end && end !== endTimeRef.current) {
      zeroRefreshOnce.current.clear();
    }
    if (end) {
      endTimeRef.current = end;
      setCountdownIfChanged(setCountdown, secondsUntil(end));
    }
  }, []);

  const loadPeriod = useCallback(async () => {
    try {
      const pRes = await api.getGamePeriods<FiveDPeriod>("5d", {
        duration,
        limit: 5,
      });
      const live = pickLivePeriod(
        (pRes as { currentPeriod?: FiveDPeriod | null }).currentPeriod,
        pRes.periods
      );
      if (live) {
        applyPeriod(live);
      } else {
        setCountdownIfChanged(setCountdown, 0);
      }
    } catch {
      /* keep previous */
    }
  }, [duration, applyPeriod]);

  const loadResults = useCallback(
    async (p = 1) => {
      try {
        const rRes = await api.getGameResults<FiveDResult>("5d", {
          duration,
          page: p,
          limit: 10,
        });
        const list = rRes.results ?? [];
        setResults(list);
        setTotalPages(rRes.totalPages ?? 1);
        setPage(rRes.currentPage ?? p);
        if (p === 1) tryResultPopup(myBetsRef.current, list);
      } catch {
        /* ignore */
      }
    },
    [duration, tryResultPopup]
  );

  const loadMyBets = useCallback(async () => {
    try {
      const bRes = await api.getGameBets<FiveDBet>("5d", {
        duration,
        page: 1,
        limit: 30,
      });
      const list = (bRes.bets as FiveDBet[]) ?? [];
      setMyBets(list);
      tryResultPopup(list, resultsRef.current);
    } catch {
      /* ignore */
    }
  }, [duration, tryResultPopup]);

  const loadAll = useCallback(
    async (p = 1) => {
      if (loadInFlight.current) return;
      loadInFlight.current = true;
      try {
        await Promise.all([loadPeriod(), loadResults(p), loadMyBets()]);
      } finally {
        loadInFlight.current = false;
      }
    },
    [loadPeriod, loadResults, loadMyBets]
  );

  const loadPeriodRef = useRef(loadPeriod);
  const loadResultsRef = useRef(loadResults);
  const loadMyBetsRef = useRef(loadMyBets);
  const loadAllRef = useRef(loadAll);
  const refreshUserRef = useRef(refreshUser);
  loadPeriodRef.current = loadPeriod;
  loadResultsRef.current = loadResults;
  loadMyBetsRef.current = loadMyBets;
  loadAllRef.current = loadAll;
  refreshUserRef.current = refreshUser;

  const burstRefresh = useCallback(() => {
    const run = () => {
      void loadPeriodRef.current();
      void loadResultsRef.current(1);
      void loadMyBetsRef.current();
      void refreshUserRef.current();
    };
    run();
    for (const ms of [400, 1000, 2000, 3500, 5500]) {
      window.setTimeout(run, ms);
    }
  }, []);

  useEffect(() => {
    endTimeRef.current = null;
    periodIdRef.current = null;
    zeroRefreshOnce.current.clear();
    setCountdown(0);
    setPeriod(null);
    resetResultPopupTracking();
    void loadAllRef.current(1);
  }, [duration, resetResultPopupTracking]);

  useEffect(() => {
    initCountdownAudioMute();
  }, []);

  // Wall-clock timer (250ms)
  useEffect(() => {
    const tick = () => {
      const end = endTimeRef.current;
      if (!end) {
        setCountdownIfChanged(setCountdown, 0);
        return;
      }
      const left = secondsUntil(end);
      setCountdownIfChanged(setCountdown, left);
      if (left <= 0) {
        zeroRefreshOnce.current.run(end, burstRefresh);
      } else if (left <= 3 && !gameWs.isOpen()) {
        void loadPeriodRef.current();
        if (left <= 1) void loadResultsRef.current(1);
      }
    };
    tick();
    const t = window.setInterval(tick, 250);
    return () => window.clearInterval(t);
  }, [burstRefresh]);

  // WebSocket
  useEffect(() => {
    gameWs.connect();

    const onPeriod = (data: unknown) => {
      const d = data as Partial<FiveDPeriod> & {
        periodId?: string;
        durationSeconds?: number;
      };
      if (
        d?.durationSeconds != null &&
        Number(d.durationSeconds) !== duration
      ) {
        return;
      }
      const end = d.endTime;
      if (!end) {
        void loadPeriodRef.current();
        return;
      }
      if (secondsUntil(end) <= 0) return;

      applyPeriod({
        id: d.id ?? d.periodId ?? periodIdRef.current ?? "",
        periodNumber: d.periodNumber ?? "",
        durationSeconds: d.durationSeconds ?? duration,
        startTime: d.startTime ?? new Date().toISOString(),
        endTime: end,
        status: (d.status as string) ?? "ACTIVE",
      });
      void loadResultsRef.current(1);
      void loadMyBetsRef.current();
    };

    const onResults = (data: unknown) => {
      const d = data as { durationSeconds?: number };
      if (
        d?.durationSeconds != null &&
        Number(d.durationSeconds) !== duration
      ) {
        return;
      }
      void loadResultsRef.current(1);
      void loadMyBetsRef.current();
      void refreshUserRef.current();
      void loadPeriodRef.current();
    };

    const u1 = gameWs.subscribe("5d-period-creation", onPeriod);
    const u2 = gameWs.subscribe("5d-results", onResults);
    const poll = window.setInterval(() => {
      void loadPeriodRef.current();
    }, 8_000);

    return () => {
      u1();
      u2();
      window.clearInterval(poll);
    };
  }, [duration, applyPeriod]);

  const guardBet = () => {
    if (isBettingLocked(countdown, duration)) {
      toast("Betting locked", "error");
      return false;
    }
    if (!period?.id) {
      toast("No active period", "error");
      return false;
    }
    return true;
  };

  const openNum = (n: number) => {
    if (!guardBet()) return;
    if (pos === "SUM") {
      setPending({
        betCategory: "SUM",
        betType: "SUM_EXACT",
        betChoice: String(n),
        label: `Sum = ${n} (45x)`,
        theme: "violet",
      });
    } else {
      setPending({
        betCategory: "POSITION",
        betType: "EXACT_NUMBER",
        position: pos,
        betChoice: String(n),
        label: `${pos} = ${n} (9x)`,
        theme: "blue",
      });
    }
  };

  const openSide = (
    betType: "LOW" | "HIGH" | "ODD" | "EVEN",
    label: string
  ) => {
    if (!guardBet()) return;
    const theme =
      betType === "LOW"
        ? "blue"
        : betType === "HIGH"
          ? "orange"
          : betType === "ODD"
            ? "green"
            : "red";
    if (pos === "SUM") {
      setPending({
        betCategory: "SUM",
        betType,
        betChoice: betType,
        label: `Sum ${label} (1.95x)`,
        theme,
      });
    } else {
      setPending({
        betCategory: "POSITION",
        betType,
        position: pos,
        betChoice: betType,
        label: `${pos} ${label} (1.95x)`,
        theme,
      });
    }
  };

  const confirm = async (total?: number) => {
    if (!pending || !period?.id) return;
    if (!(await ensureCanBet())) return;
    const betAmount = total ?? baseAmount * mult;
    if (user && betAmount > user.balance) {
      toast("Insufficient balance", "error");
      return;
    }
    setBetting(true);
    try {
      const res = await api.place5dBet({
        periodId: period.id,
        betCategory: pending.betCategory,
        betType: pending.betType,
        position: pending.position,
        betChoice: pending.betChoice,
        betAmount,
      });
      trackPendingBet(res.bet?.id);
      toast(`Bet placed: ${pending.label}`, "success");
      setPending(null);
      await refreshUser();
      void loadMyBets();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Bet failed", "error");
    } finally {
      setBetting(false);
    }
  };

  const last = results[0];
  const isLocked = isBettingLocked(countdown, duration);
  const recentBalls = results
    .slice(0, 5)
    .map((r) => r.resultDigitE ?? r.resultDigitA ?? 0);

  const resultKey = last
    ? String(
        last.id ??
          `${last.periodNumber}-${last.resultNumber}-${last.resultSum}`
      )
    : null;

  const sideButtons = pos === "SUM" ? SUM_SIDE : SIDE_BTNS;

  return (
    <div
      className="flex flex-col min-h-screen min-w-0 w-full max-w-full overflow-x-clip pb-[max(2rem,env(safe-area-inset-bottom))]"
      style={{ background: "#110D14" }}
    >
      <GameHeader title="5D" onBack={onBack} />

      <GameWalletCard
        balance={user?.balance}
        onRefresh={() => refreshUser()}
        onWithdraw={() => onNavigate?.("withdraw")}
        onDeposit={() => onNavigate?.("deposit")}
      />

      <GameNoticeBar text="Welcome to 5D Lottery — pick digits A–E or Sum!" />

      <DurationTabs
        tabs={TABS}
        activeId={activeGame}
        onChange={(id) => setActiveGame(id as GameTab)}
      />

      <PeriodBanner
        gameLabel={`5D ${tabMeta?.subLabel ?? ""}`}
        periodNumber={period?.periodNumber}
        countdown={countdown}
        recentBalls={recentBalls}
      />

      <FiveDStage
        digitA={last?.resultDigitA}
        digitB={last?.resultDigitB}
        digitC={last?.resultDigitC}
        digitD={last?.resultDigitD}
        digitE={last?.resultDigitE}
        sum={last?.resultSum}
        resultKey={resultKey}
        countdown={countdown}
        periodId={period?.id ?? null}
      >
        {countdown <= 5 && countdown >= 0 && (
          <CountdownPopout seconds={countdown} />
        )}
      </FiveDStage>

      {/* Position tabs A–E + SUM */}
      <div className="mx-3 mt-3 flex gap-1.5 overflow-x-auto no-scrollbar">
        {(["A", "B", "C", "D", "E", "SUM"] as Pos[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPos(p)}
            className="shrink-0 px-4 h-9 rounded-full text-[12px] font-bold active:scale-95"
            style={{
              background:
                pos === p
                  ? "linear-gradient(180deg,#FED358,#E8A84A)"
                  : "#2a2428",
              color: pos === p ? "#110D14" : "rgba(255,255,255,0.5)",
              border:
                pos === p ? "none" : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Betting board */}
      <div
        className="mx-3 mt-3 rounded-[12px] p-3 space-y-3"
        style={{
          background: "#1a1519",
          border: "1px solid rgba(255,255,255,0.06)",
          opacity: isLocked ? 0.72 : 1,
        }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-white/45 uppercase tracking-wider">
            {pos === "SUM" ? "Sum bet" : `Position ${pos}`}
          </p>
          <p className="text-[10px] text-white/30">
            {pos === "SUM"
              ? "Exact 45x · Side 1.95x"
              : "Exact 9x · Side 1.95x"}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {sideButtons.map((b) => (
            <button
              key={b.t}
              type="button"
              onClick={() => openSide(b.t, b.l)}
              className="h-11 rounded-[10px] text-white active:scale-95 flex flex-col items-center justify-center"
              style={{ background: b.bg }}
            >
              <span className="text-[13px] font-black leading-none">{b.l}</span>
              {b.sub ? (
                <span className="text-[9px] font-bold opacity-80 mt-0.5">
                  {b.sub}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {pos !== "SUM" ? (
          <>
            <p className="text-[10px] text-white/35 font-bold uppercase tracking-wider">
              Exact number · 9x
            </p>
            <div className="grid grid-cols-5 gap-y-2 sm:gap-y-3 gap-x-1.5 sm:gap-x-2 justify-items-center">
              {Array.from({ length: 10 }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => openNum(i)}
                  className="active:scale-90 transition-transform min-w-0 max-w-full"
                >
                  {/* 44px fits 5-col on ~320px widths without horizontal squeeze */}
                  <NumberBall num={i} size={44} />
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-[10px] text-white/35 font-bold uppercase tracking-wider">
              Exact sum · 45x (0–45)
            </p>
            <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto no-scrollbar pr-0.5">
              {Array.from({ length: 46 }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => openNum(i)}
                  className="h-8 rounded-lg text-[11px] font-bold text-white/80 active:scale-95"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {i}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="flex gap-1.5 flex-wrap items-center pt-1">
          <span className="text-[10px] text-white/35">Amt</span>
          {BASE_AMOUNTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setBaseAmount(a)}
              className="px-2.5 h-7 rounded text-[11px] font-bold"
              style={{
                background:
                  baseAmount === a
                    ? "rgba(254,211,88,0.2)"
                    : "rgba(255,255,255,0.06)",
                color:
                  baseAmount === a ? "#FED358" : "rgba(255,255,255,0.5)",
              }}
            >
              ₹{a}
            </button>
          ))}
          {MULTIPLIERS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMult(m)}
              className="px-2.5 h-7 rounded text-[11px] font-bold"
              style={{
                background:
                  mult === m
                    ? "linear-gradient(180deg,#40AD72,#17B15E)"
                    : "rgba(255,255,255,0.06)",
                color: mult === m ? "#fff" : "rgba(255,255,255,0.5)",
              }}
            >
              X{m}
            </button>
          ))}
          <span className="text-[10px] text-white/30 ml-auto">
            {formatINR(baseAmount * mult)}
          </span>
        </div>
      </div>

      <HistoryTabBar
        tabs={[
          { id: "game", label: "Game history" },
          { id: "my", label: "My history" },
        ]}
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
        {historyTab === "game" ? (
          <>
            <div
              className="grid grid-cols-[1.15fr_1.4fr_0.55fr] gap-1 px-3 py-2.5"
              style={{
                background: "linear-gradient(90deg,#C8922A,#E8A84A)",
              }}
            >
              {["Period", "Number", "Sum"].map((h) => (
                <span
                  key={h}
                  className="text-[11px] font-bold text-[#110D14] text-center"
                >
                  {h}
                </span>
              ))}
            </div>
            {results.length === 0 ? (
              <p className="text-center text-white/30 text-xs py-10">
                No results
              </p>
            ) : (
              results.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[1.15fr_1.4fr_0.55fr] gap-1 items-center px-3 py-2.5 border-b border-white/5 text-[11px]"
                >
                  <span className="font-mono text-white/50 truncate text-center text-[10px]">
                    {r.periodNumber}
                  </span>
                  <span className="flex justify-center">
                    <FiveDMiniDigits
                      a={r.resultDigitA}
                      b={r.resultDigitB}
                      c={r.resultDigitC}
                      d={r.resultDigitD}
                      e={r.resultDigitE}
                      size={18}
                    />
                  </span>
                  <span className="text-[#FED358] font-bold text-center">
                    {r.resultSum}
                  </span>
                </div>
              ))
            )}
            <Pagination
              page={page}
              totalPages={totalPages}
              onChange={(p) => void loadResults(p)}
            />
          </>
        ) : myBets.length === 0 ? (
          <p className="text-center text-white/30 text-xs py-10">No bets</p>
        ) : (
          myBets.map((b) => {
            const matched = results.find(
              (r) => r.periodNumber === b.periodNumber
            );
            const selectLabel =
              b.betCategory === "POSITION" && b.position
                ? `${b.position} · ${
                    b.betType === "EXACT_NUMBER" ? b.betChoice : b.betChoice
                  }`
                : b.betType === "SUM_EXACT"
                  ? `Sum ${b.betChoice}`
                  : `Sum · ${b.betChoice}`;
            const resultText = matched
              ? `${matched.resultDigitA}${matched.resultDigitB}${matched.resultDigitC}${matched.resultDigitD}${matched.resultDigitE} Σ${matched.resultSum}`
              : null;
            return (
              <BetHistoryCard
                key={b.id}
                detail={{
                  id: b.id,
                  selectLabel,
                  periodNumber: b.periodNumber,
                  betAmount: b.betAmount,
                  contractAmount: b.contractAmount,
                  status: b.status,
                  winAmount: b.result?.winAmount,
                  isWin: b.result?.isWin,
                  createdAt: b.createdAt,
                  resultText,
                  orderPrefix: "5D",
                  extraRows: b.position
                    ? [{ label: "Position", value: b.position }]
                    : undefined,
                }}
              />
            );
          })
        )}
      </div>

      <BetConfirmSheet
        open={!!pending}
        label={pending?.label ?? ""}
        gameTitle={`5D ${tabMeta?.subLabel ?? ""}`}
        theme={pending?.theme ?? "blue"}
        ballNumber={
          pending?.betType === "EXACT_NUMBER" ||
          pending?.betType === "SUM_EXACT"
            ? Number(pending.betChoice)
            : null
        }
        periodNumber={period?.periodNumber}
        betting={betting}
        balance={user?.balance}
        onCancel={() => setPending(null)}
        onConfirm={() => confirm()}
        onConfirmTotal={(p) => confirm(p.total)}
      />

      <ResultPopup
        open={!!resultPopup}
        isWin={resultPopup?.isWin ?? false}
        chips={resultPopup?.chips}
        resultsHeading={resultPopup?.resultsHeading ?? RESULT_HEADINGS.fived}
        winAmount={resultPopup?.winAmount ?? 0}
        periodLabel={`5D ${tabMeta?.subLabel ?? ""}`.trim()}
        periodNumber={resultPopup?.periodNumber}
        onClose={closeResultPopup}
      />
      {depositModal}
    </div>
  );
}
