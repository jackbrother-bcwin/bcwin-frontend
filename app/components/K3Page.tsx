"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./ui/Toast";
import * as api from "../lib/api";
import type { K3Period, K3Result, WingoBet } from "../lib/api";
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
  isBettingLocked,
  Pagination,
  PeriodBanner,
  ResultPopup,
  SIZE_STYLE,
  type DurationTab,
} from "./game/shared";
import K3DiceStage, { K3MiniDice } from "./game/K3DiceStage";
import BetHistoryCard from "./game/BetHistoryCard";
import {
  samePeriodId,
  useSettledResultPopup,
} from "./game/useSettledResultPopup";
import { k3ResultChips, RESULT_HEADINGS } from "./game/resultChips";
import { createOncePerKey, setCountdownIfChanged } from "../lib/game-refresh";
import { initCountdownAudioMute } from "../lib/countdown-audio";
import { pickLivePeriod } from "../lib/period-live";
import { useLotteryBetDepositGate } from "../hooks/useLotteryBetDepositGate";
import {
  HISTORY_MAX_PAGES,
  capHistoryPage,
  capHistoryPages,
} from "../lib/history-pages";

type GameTab = "30s" | "1min" | "3min" | "5min";
type HistoryTab = "game" | "my";

const TABS: DurationTab[] = [
  { id: "30s", label: "K3", subLabel: "30sec", seconds: 30 },
  { id: "1min", label: "K3", subLabel: "1 Min", seconds: 60 },
  { id: "3min", label: "K3", subLabel: "3 Min", seconds: 180 },
  { id: "5min", label: "K3", subLabel: "5 Min", seconds: 300 },
];

const MULTIPLIERS = [1, 5, 10, 20, 50, 100];
const BASE_AMOUNTS = [1, 10, 100, 1000];

interface Props {
  onBack?: () => void;
  onNavigate?: (screen: string) => void;
}

export default function K3Page({ onBack, onNavigate }: Props) {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [activeGame, setActiveGame] = useState<GameTab>("30s");
  const [historyTab, setHistoryTab] = useState<HistoryTab>("game");
  const [period, setPeriod] = useState<K3Period | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [results, setResults] = useState<K3Result[]>([]);
  const [myBets, setMyBets] = useState<WingoBet[]>([]);
  const [baseAmount, setBaseAmount] = useState(10);
  const [mult, setMult] = useState(1);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pending, setPending] = useState<{
    type: string;
    choice: string;
    label: string;
  } | null>(null);
  const { ensureCanBet, depositModal } = useLotteryBetDepositGate(
    "K3",
    onNavigate,
    () => setPending(null)
  );
  /** Wall-clock end of the live period — source of truth for the timer */
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
    (bets: WingoBet[], resultList: K3Result[]) => {
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
        // Wait for this bet's period result — never fall back to period N-1
        hasPeriodResult: (b) => !!matchResult(b),
        enrich: (b) => {
          const matched = matchResult(b)!;
          return {
            periodNumber: b.periodNumber ?? matched.periodNumber,
            resultsHeading: RESULT_HEADINGS.k3,
            chips: k3ResultChips(matched),
          };
        },
      });
    },
    [maybeShowResultPopup]
  );

  const applyPeriod = useCallback((next: K3Period | null) => {
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
      const pRes = await api.getGamePeriods<K3Period>("k3", {
        duration,
        limit: 5,
      });
      const live = pickLivePeriod(
        (pRes as { currentPeriod?: K3Period | null }).currentPeriod,
        pRes.periods
      );
      if (live) {
        applyPeriod(live);
      } else {
        // Gap between periods: keep clock at 0, do NOT adopt expired periods[0]
        setCountdownIfChanged(setCountdown, 0);
      }
    } catch {
      /* keep previous */
    }
  }, [duration, applyPeriod]);

  const loadResults = useCallback(
    async (p = 1) => {
      try {
        const page = capHistoryPage(p);
        const rRes = await api.getGameResults<K3Result>("k3", {
          duration,
          page,
          limit: 10,
        });
        const list = rRes.results ?? [];
        setResults(list);
        setTotalPages(capHistoryPages(rRes.totalPages));
        setPage(capHistoryPage(rRes.currentPage ?? page));
        if (p === 1) tryResultPopup(myBetsRef.current, list);
      } catch {
        /* ignore */
      }
    },
    [duration, tryResultPopup]
  );

  const loadMyBets = useCallback(async () => {
    try {
      const bRes = await api.getGameBets<WingoBet>("k3", {
        duration,
        page: 1,
        limit: 20,
      });
      const list = bRes.bets ?? [];
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

  /** Burst reloads after settle so next period + dice land even if WS is late */
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

  // Reset when duration tab changes
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

  /**
   * Production timer: wall-clock based, 250ms tick for snappy UI.
   * Does not depend on React re-renders of period for the tick itself.
   */
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
        // First zero for this endTime → burst fetch next period + result
        zeroRefreshOnce.current.run(end, burstRefresh);
      } else if (left <= 3 && !gameWs.isOpen()) {
        // Tight HTTP poll only when WS is down — same catch-up, no extra load if live
        void loadPeriodRef.current();
        if (left <= 1) void loadResultsRef.current(1);
      }
    };

    tick();
    const t = window.setInterval(tick, 250);
    return () => window.clearInterval(t);
  }, [burstRefresh]);

  // WebSocket: apply new period immediately (don't wait for full load)
  useEffect(() => {
    gameWs.connect();

    const onPeriod = (data: unknown) => {
      const d = data as Partial<K3Period> & {
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
      // Only adopt if still live
      if (secondsUntil(end) <= 0) return;

      const merged = {
        id: d.id ?? d.periodId ?? periodIdRef.current ?? "",
        periodNumber: d.periodNumber ?? "",
        durationSeconds: d.durationSeconds ?? duration,
        startTime: d.startTime ?? new Date().toISOString(),
        endTime: end,
        status: (d.status as K3Period["status"]) ?? "ACTIVE",
      } as K3Period;

      applyPeriod(merged);
      void loadResultsRef.current(1);
      void loadMyBetsRef.current();
    };

    const onResults = (data: unknown) => {
      const d = data as {
        durationSeconds?: number;
        periodNumber?: string;
        dice1?: number;
        dice2?: number;
        dice3?: number;
        sum?: number;
        id?: string;
        periodId?: string;
      };
      if (
        d?.durationSeconds != null &&
        Number(d.durationSeconds) !== duration
      ) {
        return;
      }
      void loadResultsRef.current(1);
      void loadMyBetsRef.current();
      void refreshUserRef.current();
      // Period may already have rolled forward
      void loadPeriodRef.current();
    };

    const u1 = gameWs.subscribe("k3-period-creation", onPeriod);
    const u2 = gameWs.subscribe("k3-results", onResults);

    // Background poll — light; boundary uses burst
    const poll = window.setInterval(() => {
      void loadPeriodRef.current();
    }, 8_000);

    return () => {
      u1();
      u2();
      window.clearInterval(poll);
    };
  }, [duration, applyPeriod]);

  const open = (type: string, choice: string, label: string) => {
    if (isBettingLocked(countdown, duration))
      return toast("Betting locked", "error");
    if (!period?.id) return toast("No active period", "error");
    setPending({ type, choice, label });
  };

  const confirm = async (total?: number) => {
    if (!pending || !period?.id) return;
    if (!(await ensureCanBet())) return;
    const betAmount = total ?? baseAmount * mult;
    if (user && betAmount > user.balance) {
      toast("Insufficient balance", "error");
      return;
    }
    const slip = pending;
    const periodId = period.id;
    setPending(null);
    try {
      const res = await api.placeK3Bet({
        periodId,
        betType: slip.type,
        betChoice: slip.choice,
        betAmount,
      });
      trackPendingBet(res.bet?.id);
      toast(`Bet placed: ${slip.label}`, "success");
      await refreshUser();
      void loadMyBets();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Bet failed", "error");
    }
  };

  const last = results[0];
  const isLocked = isBettingLocked(countdown, duration);
  const recentDice = results.slice(0, 5).map((r) => r.sum % 10);

  // Result identity for dice land — prefer server period id
  const resultKey = last
    ? String(
        (last as { id?: string }).id ??
          `${last.periodNumber}-${last.dice1}-${last.dice2}-${last.dice3}-${last.sum}`
      )
    : null;

  return (
    <div
      className="flex flex-col min-h-screen min-w-0 w-full max-w-full overflow-x-clip pb-[max(2rem,env(safe-area-inset-bottom))]"
      style={{ background: "#110D14" }}
    >
      <GameHeader title="K3" onBack={onBack} />

      <GameWalletCard
        balance={user?.balance}
        onRefresh={() => refreshUser()}
        onWithdraw={() => onNavigate?.("withdraw")}
        onDeposit={() => onNavigate?.("deposit")}
      />

      <GameNoticeBar text="Welcome to K3 Lottery — roll the dice and win!" />

      <DurationTabs
        tabs={TABS}
        activeId={activeGame}
        onChange={(id) => setActiveGame(id as GameTab)}
      />

      <PeriodBanner
        gameLabel={`K3 ${tabMeta?.subLabel ?? ""}`}
        periodNumber={period?.periodNumber}
        countdown={countdown}
        recentBalls={recentDice}
      />

      <K3DiceStage
        dice1={last?.dice1}
        dice2={last?.dice2}
        dice3={last?.dice3}
        resultKey={resultKey}
        countdown={countdown}
        periodId={period?.id ?? null}
        sum={last?.sum}
        metaLine={
          last ? (
            <p className="text-center text-[12px] text-white/50">
              <span
                style={{
                  color: last.isBig
                    ? SIZE_STYLE.big.solid
                    : SIZE_STYLE.small.solid,
                }}
                className="font-bold"
              >
                {last.isBig ? "Big" : "Small"}
              </span>
              {" · "}
              {last.isOdd ? "Odd" : "Even"}
              {last.isTriple ? " · Triple" : last.isDouble ? " · Double" : ""}
            </p>
          ) : undefined
        }
      >
        {countdown <= 5 && countdown >= 0 && (
          <CountdownPopout seconds={countdown} />
        )}
      </K3DiceStage>

      <div
        className="mx-3 mt-3 rounded-[12px] p-3 space-y-2.5"
        style={{
          background: "#1a1519",
          border: "1px solid rgba(255,255,255,0.06)",
          opacity: isLocked ? 0.72 : 1,
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              t: "BIG",
              c: "BIG",
              l: "Big",
              bg: "linear-gradient(180deg,#FFB472,#DD9138)",
            },
            {
              t: "SMALL",
              c: "SMALL",
              l: "Small",
              bg: "linear-gradient(180deg,#6ba3e8,#5088D3)",
            },
            {
              t: "ODD",
              c: "ODD",
              l: "Odd",
              bg: "linear-gradient(180deg,#2dd46f,#17B15E)",
            },
            {
              t: "EVEN",
              c: "EVEN",
              l: "Even",
              bg: "linear-gradient(180deg,#f05555,#DA3735)",
            },
          ].map((b) => (
            <button
              key={b.t}
              type="button"
              onClick={() => open(b.t, b.c, b.l)}
              className="h-11 rounded-[10px] font-black text-white text-[14px] active:scale-95"
              style={{ background: b.bg }}
            >
              {b.l}
            </button>
          ))}
        </div>

        <p className="text-[10px] text-white/35 font-bold uppercase tracking-wider pt-1">
          Sum
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(
            (s) => (
              <button
                key={s}
                type="button"
                onClick={() => open("SUM", String(s), `Sum ${s}`)}
                className="h-9 rounded-lg text-[12px] font-bold text-white/80 active:scale-95"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {s}
              </button>
            )
          )}
        </div>

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
              className="grid grid-cols-[1.3fr_1.1fr_0.55fr_0.7fr] gap-1 px-3 py-2.5"
              style={{
                background: "linear-gradient(90deg,#C8922A,#E8A84A)",
              }}
            >
              {["Period", "Dice", "Sum", "B/S"].map((h) => (
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
                  className="grid grid-cols-[1.3fr_1.1fr_0.55fr_0.7fr] gap-1 items-center px-3 py-2.5 border-b border-white/5 text-[11px]"
                >
                  <span className="font-mono text-white/55 truncate text-center text-[10px]">
                    {r.periodNumber}
                  </span>
                  <span className="flex justify-center">
                    <K3MiniDice
                      d1={r.dice1}
                      d2={r.dice2}
                      d3={r.dice3}
                      size={20}
                    />
                  </span>
                  <span className="text-[#FED358] font-bold text-center">
                    {r.sum}
                  </span>
                  <span className="text-center text-[10px] font-bold">
                    <span
                      style={{
                        color: r.isBig
                          ? SIZE_STYLE.big.solid
                          : SIZE_STYLE.small.solid,
                      }}
                    >
                      {r.isBig ? "B" : "S"}
                    </span>
                    <span className="text-white/40">/</span>
                    <span
                      className={
                        r.isOdd ? "text-[#17B15E]" : "text-[#DA3735]"
                      }
                    >
                      {r.isOdd ? "O" : "E"}
                    </span>
                  </span>
                </div>
              ))
            )}
            <Pagination
              page={page}
              totalPages={totalPages}
              onChange={(p) => void loadResults(p)}
              maxPages={HISTORY_MAX_PAGES}
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
              b.betType === "SUM"
                ? `Sum ${b.betChoice}`
                : b.betChoice || b.betType;
            const selectColor =
              String(b.betChoice).toUpperCase() === "BIG" ||
              String(b.betType).toUpperCase() === "BIG"
                ? "#DD9138"
                : String(b.betChoice).toUpperCase() === "SMALL" ||
                    String(b.betType).toUpperCase() === "SMALL"
                  ? "#5088D3"
                  : String(b.betChoice).toUpperCase() === "ODD" ||
                      String(b.betType).toUpperCase() === "ODD"
                    ? "#17B15E"
                    : String(b.betChoice).toUpperCase() === "EVEN" ||
                        String(b.betType).toUpperCase() === "EVEN"
                      ? "#DA3735"
                      : undefined;
            const resultText = matched
              ? `${matched.dice1}-${matched.dice2}-${matched.dice3} Σ${matched.sum}`
              : null;
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
                  orderPrefix: "K3",
                }}
              />
            );
          })
        )}
      </div>

      <BetConfirmSheet
        open={!!pending}
        label={pending?.label ?? ""}
        gameTitle={`K3 ${tabMeta?.subLabel ?? ""}`}
        theme={
          pending?.type === "BIG" || pending?.choice === "BIG"
            ? "orange"
            : pending?.type === "SMALL" || pending?.choice === "SMALL"
              ? "blue"
              : pending?.type === "ODD"
                ? "green"
                : pending?.type === "EVEN"
                  ? "red"
                  : "violet"
        }
        periodNumber={period?.periodNumber}
        balance={user?.balance}
        onCancel={() => setPending(null)}
        onConfirm={() => confirm()}
        onConfirmTotal={(p) => confirm(p.total)}
      />

      <ResultPopup
        open={!!resultPopup}
        isWin={resultPopup?.isWin ?? false}
        chips={resultPopup?.chips}
        resultsHeading={resultPopup?.resultsHeading ?? RESULT_HEADINGS.k3}
        winAmount={resultPopup?.winAmount ?? 0}
        periodLabel={`K3 ${tabMeta?.subLabel ?? ""}`.trim()}
        periodNumber={resultPopup?.periodNumber}
        onClose={closeResultPopup}
      />
      {depositModal}
    </div>
  );
}
