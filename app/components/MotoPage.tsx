"use client";

/**
 * Moto Racing — period flow:
 *   open betting → at 7s left lock + high-speed race → at 00 result + podium top-3
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./ui/Toast";
import * as api from "../lib/api";
import type { MotoPeriod, MotoBet } from "../lib/api";
import { formatCountdown, formatINR, secondsUntil } from "../lib/format";
import { gameWs } from "../lib/ws";
import {
  BetConfirmSheet,
  DurationTabs,
  GameHeader,
  GameNoticeBar,
  GameWalletCard,
  HistoryTabBar,
  ResultPopup,
} from "./game/shared";
import BetHistoryCard from "./game/BetHistoryCard";
import {
  samePeriodId,
  useSettledResultPopup,
} from "./game/useSettledResultPopup";
import { motoResultChips, RESULT_HEADINGS } from "./game/resultChips";
import { createOncePerKey, setCountdownIfChanged } from "../lib/game-refresh";
import { createStuckZeroRecovery, pickLivePeriod } from "../lib/period-live";
import {
  MOTO_TABS,
  MOTO_RACE_END_SECONDS,
  isMotoBettingLocked,
  motoBetLockSeconds,
  bikeColor,
  type MotoTabId,
  type TargetPos,
} from "./moto/constants";
import type { PodiumResult, RaceCanvasHandle } from "./moto/types";
import { HistoryStrip } from "./moto/HistoryStrip";
import { BetPanel, type MotoBetOpen } from "./moto/BetPanel";
import { useLotteryBetDepositGate } from "../hooks/useLotteryBetDepositGate";
import "./moto/moto-feel.css";

const RaceCanvas = lazy(() =>
  import("./moto/race/RaceCanvas").then((m) => ({ default: m.RaceCanvas }))
);

type PendingBet = MotoBetOpen;

export default function MotoPage({
  onBack,
  onNavigate,
}: {
  onBack?: () => void;
  onNavigate?: (screen: string) => void;
}) {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [activeGame, setActiveGame] = useState<MotoTabId>("30s");
  const [target, setTarget] = useState<TargetPos>("FIRST");
  const [period, setPeriod] = useState<MotoPeriod | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [periods, setPeriods] = useState<MotoPeriod[]>([]);
  const [myBets, setMyBets] = useState<MotoBet[]>([]);
  const [tab, setTab] = useState<"game" | "my">("game");
  const [racing, setRacing] = useState(false);
  const [lastPodium, setLastPodium] = useState<PodiumResult | null>(null);
  const [pending, setPending] = useState<PendingBet | null>(null);

  const { ensureCanBet, depositModal } = useLotteryBetDepositGate(
    "Moto Race",
    onNavigate,
    () => setPending(null)
  );

  const endRef = useRef<string | null>(null);
  const activePeriodIdRef = useRef<string | null>(null);
  const zeroRefreshOnce = useRef(createOncePerKey());
  const stuckZero = useRef(createStuckZeroRecovery());
  const raceStartOnce = useRef(createOncePerKey());
  const raceCanvasRef = useRef<RaceCanvasHandle | null>(null);
  const finishLockRef = useRef(false);
  const lastFinishKey = useRef<string | null>(null);
  const durationRef = useRef(30);

  const duration =
    MOTO_TABS.find((t) => t.id === activeGame)?.seconds ?? 30;
  durationRef.current = duration;

  const {
    resultPopup,
    closeResultPopup,
    resetResultPopupTracking,
    trackPendingBet,
    maybeShowResultPopup,
  } = useSettledResultPopup();

  const applyPodiumFinish = useCallback(async (podium: PodiumResult) => {
    if (
      podium.firstPlace == null ||
      podium.secondPlace == null ||
      podium.thirdPlace == null
    ) {
      return;
    }
    const key = `${podium.periodId ?? podium.periodNumber}-${podium.firstPlace}-${podium.secondPlace}-${podium.thirdPlace}`;
    if (lastFinishKey.current === key || finishLockRef.current) return;

    finishLockRef.current = true;
    setRacing(true);
    setLastPodium(podium);

    try {
      for (let i = 0; i < 8; i++) {
        if (raceCanvasRef.current?.isReady()) break;
        await new Promise((r) => setTimeout(r, 100));
      }

      // NEVER startRacing/GO here — that caused GO on new period after 00.
      // finishWithPodium alone: bikes run to fixed finish line → podium.
      const ok =
        (await raceCanvasRef.current?.finishWithPodium(podium)) === true;
      if (ok) lastFinishKey.current = key;
    } catch (e) {
      console.warn("[MotoPage] finish animation", e);
    } finally {
      finishLockRef.current = false;
      // Hold winners on podium, then calm idle for next period (no GO)
      window.setTimeout(() => {
        setRacing(false);
        // Only idle if we haven't already started next race lock window
        const phase = raceCanvasRef.current?.getPhase?.();
        if (phase === "podium" || phase === "finishing") {
          raceCanvasRef.current?.setIdle();
        }
      }, 4200);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [pRes, bRes] = await Promise.all([
        api.getGamePeriods<MotoPeriod>("moto", { duration, limit: 30 }),
        api.getGameBets<MotoBet>("moto", { duration, page: 1, limit: 30 }),
      ]);
      const live = pickLivePeriod(pRes.currentPeriod, pRes.periods);
      const cur = live ?? pRes.currentPeriod ?? null;

      setPeriod(cur);
      activePeriodIdRef.current = cur?.id ?? null;
      const nextEnd = live?.endTime ?? null;
      if (nextEnd && nextEnd !== endRef.current) {
        zeroRefreshOnce.current.clear();
        raceStartOnce.current.clear();
        stuckZero.current.reset();
        // New period: back to calm grid — never auto GO
        if (live && live.status === "ACTIVE" && !live.firstPlace) {
          lastFinishKey.current = null;
          const left = secondsUntil(nextEnd);
          // Only force idle if not already in the lock/race window of this period
          if (left > motoBetLockSeconds(durationRef.current)) {
            raceCanvasRef.current?.setIdle();
            setRacing(false);
            setLastPodium(null);
          }
        }
      }
      if (nextEnd) {
        endRef.current = nextEnd;
        setCountdownIfChanged(setCountdown, secondsUntil(nextEnd));
      } else {
        setCountdownIfChanged(setCountdown, 0);
      }
      const periodList = pRes.periods ?? [];
      const betList = bRes.bets ?? [];
      setPeriods(periodList);
      setMyBets(betList);

      // Win/loss popup — only when podium for THIS bet's period is ready
      const resolved = periodList.filter((p) => p.firstPlace != null);
      const latest = resolved[0];
      const matchPeriod = (b: {
        periodNumber?: string | null;
        periodId?: string | null;
      }) =>
        resolved.find(
          (p) =>
            samePeriodId(p.periodNumber, b.periodNumber) ||
            samePeriodId(p.id, b.periodId)
        );

      maybeShowResultPopup(betList, {
        isOnLatest: (b) =>
          !!latest &&
          (samePeriodId(b.periodNumber, latest.periodNumber) ||
            samePeriodId(b.periodId, latest.id)),
        hasPeriodResult: (b) => !!matchPeriod(b),
        enrich: (b) => {
          const matched = matchPeriod(b)!;
          return {
            periodNumber: b.periodNumber ?? matched.periodNumber,
            resultsHeading: RESULT_HEADINGS.moto,
            chips: motoResultChips({
              firstPlace: matched.firstPlace,
              secondPlace: matched.secondPlace,
              thirdPlace: matched.thirdPlace,
              bikeBg: (n) => bikeColor(n).primary,
            }),
          };
        },
      });
    } catch (e) {
      console.warn("[MotoPage] load failed", e);
    }
  }, [duration, maybeShowResultPopup]);

  const loadRef = useRef(load);
  const refreshUserRef = useRef(refreshUser);
  const applyFinishRef = useRef(applyPodiumFinish);
  loadRef.current = load;
  refreshUserRef.current = refreshUser;
  applyFinishRef.current = applyPodiumFinish;

  /** Clock-only: unstick 00 without cutting an in-flight podium. */
  const recoverLivePeriod = useCallback(async () => {
    try {
      const res = await api.getGamePeriods<MotoPeriod>("moto", {
        duration: durationRef.current,
        limit: 5,
      });
      const live = pickLivePeriod(res.currentPeriod, res.periods);
      if (!live?.endTime) return;
      const left = secondsUntil(live.endTime);
      if (left <= 0) return;
      setPeriod(live);
      activePeriodIdRef.current = live.id ?? null;
      if (live.endTime !== endRef.current) {
        zeroRefreshOnce.current.clear();
        raceStartOnce.current.clear();
      }
      endRef.current = live.endTime;
      setCountdownIfChanged(setCountdown, left);
    } catch {
      /* keep previous */
    }
  }, []);
  const recoverLivePeriodRef = useRef(recoverLivePeriod);
  recoverLivePeriodRef.current = recoverLivePeriod;

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    raceCanvasRef.current?.setIdle();
    lastFinishKey.current = null;
    zeroRefreshOnce.current.clear();
    stuckZero.current.reset();
    raceStartOnce.current.clear();
    setRacing(false);
    setLastPodium(null);
    resetResultPopupTracking();
  }, [duration, resetResultPopupTracking]);

  // Tick: lock (5s on 30s · 10s on longer) → race; near 2s/00 → podium
  useEffect(() => {
    const t = setInterval(() => {
      if (!endRef.current) {
        setCountdownIfChanged(setCountdown, 0);
        stuckZero.current.note(0, Date.now(), () => {
          void recoverLivePeriodRef.current();
        });
        return;
      }
      const left = secondsUntil(endRef.current);
      setCountdownIfChanged(setCountdown, left);
      const lockAt = motoBetLockSeconds(durationRef.current);

      // ── lock window: stop bets + start race sequence (once per period) ──
      if (left > 0 && left <= lockAt) {
        raceStartOnce.current.run(endRef.current, () => {
          setRacing(true);
          setLastPodium(null);
          void raceCanvasRef.current?.startRacing();
        });
      }

      if (left > 0) {
        stuckZero.current.note(left, Date.now(), () => {});
        return;
      }

      // ── 00: fetch result → finish order + top-3 reward podium ──
      zeroRefreshOnce.current.run(endRef.current, async () => {
        const endedPeriodId = activePeriodIdRef.current;
        const dur = durationRef.current;

        // If user missed the race window, don't start a full race spam —
        // finishWithPodium will seed mid-pack then celebrate
        for (let i = 0; i < 16; i++) {
          try {
            const res = await api.getGamePeriods<MotoPeriod>("moto", {
              duration: dur,
              limit: 15,
            });
            const withPodium =
              (endedPeriodId
                ? res.periods?.find(
                    (p) =>
                      p.id === endedPeriodId &&
                      p.firstPlace != null &&
                      p.secondPlace != null &&
                      p.thirdPlace != null
                  )
                : null) ??
              res.periods?.find(
                (p) =>
                  p.firstPlace != null &&
                  p.secondPlace != null &&
                  p.thirdPlace != null
              );

            if (
              withPodium?.firstPlace != null &&
              withPodium.secondPlace != null &&
              withPodium.thirdPlace != null
            ) {
              await applyFinishRef.current({
                firstPlace: withPodium.firstPlace,
                secondPlace: withPodium.secondPlace,
                thirdPlace: withPodium.thirdPlace,
                periodNumber: withPodium.periodNumber,
                periodId: withPodium.id,
              });
              break;
            }
          } catch {
            /* retry */
          }
          await new Promise((r) => setTimeout(r, 700));
        }

        void loadRef.current();
        void refreshUserRef.current();
      });

      stuckZero.current.note(left, Date.now(), () => {
        void recoverLivePeriodRef.current();
      });
    }, 200);
    return () => clearInterval(t);
  }, []);

  // WebSocket
  useEffect(() => {
    gameWs.connect();
    const u1 = gameWs.subscribe("moto-period-creation", (data) => {
      const d = data as { durationSeconds?: number; endTime?: string };
      if (d?.durationSeconds && d.durationSeconds !== durationRef.current)
        return;
      raceStartOnce.current.clear();
      zeroRefreshOnce.current.clear();
      lastFinishKey.current = null;
      // New period = grid only. Do NOT call startRacing (no GO).
      // Skip reset only while mid-race so we don't cut an in-flight finish.
      const phase = raceCanvasRef.current?.getPhase?.();
      if (
        phase !== "racing" &&
        phase !== "countdown" &&
        phase !== "finishing"
      ) {
        raceCanvasRef.current?.setIdle();
        setRacing(false);
      }
      void loadRef.current();
    });
    const u2 = gameWs.subscribe("moto-results", (data) => {
      const d = data as {
        periodId?: string;
        periodNumber?: string;
        durationSeconds?: number;
        firstPlace?: number;
        secondPlace?: number;
        thirdPlace?: number;
      };
      if (d?.durationSeconds && d.durationSeconds !== durationRef.current)
        return;
      if (
        d?.firstPlace != null &&
        d?.secondPlace != null &&
        d?.thirdPlace != null
      ) {
        void applyFinishRef.current({
          firstPlace: d.firstPlace,
          secondPlace: d.secondPlace,
          thirdPlace: d.thirdPlace,
          periodNumber: d.periodNumber,
          periodId: d.periodId,
        });
      }
      void loadRef.current();
      void refreshUserRef.current();
    });
    const u3 = gameWs.subscribe("bet-settlement", () => {
      void loadRef.current();
      void refreshUserRef.current();
    });
    const poll = setInterval(() => loadRef.current(), 8_000);
    return () => {
      u1();
      u2();
      u3();
      clearInterval(poll);
    };
  }, []);

  const openBet = (bet: MotoBetOpen) => {
    if (isMotoBettingLocked(countdown, duration) || racing) {
      toast("Betting locked", "error");
      return;
    }
    if (!period?.id || period.status !== "ACTIVE") {
      toast("No active race", "error");
      return;
    }
    setTarget(bet.targetPosition);
    setPending(bet);
  };

  const confirm = async (total?: number) => {
    if (!pending || !period?.id) return;
    if (!(await ensureCanBet())) return;
    const betAmount = total ?? 10;
    if (betAmount < 1) {
      toast("Invalid amount", "error");
      return;
    }
    if (user && betAmount > user.balance) {
      toast("Insufficient balance", "error");
      return;
    }
    if (isMotoBettingLocked(countdown, duration)) {
      toast("Betting locked", "error");
      setPending(null);
      return;
    }
    const slip = pending;
    const periodId = period.id;
    setPending(null);
    try {
      const res = await api.placeMotoBet({
        periodId,
        betType: slip.betType,
        betChoice: slip.betChoice.toLowerCase(),
        targetPosition: slip.targetPosition,
        betAmount,
      });
      trackPendingBet(res.bet?.id);
      toast("Bet placed!", "success");
      await refreshUser();
      await load();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Bet failed", "error");
    }
  };

  const cd = formatCountdown(countdown);
  const lockAt = motoBetLockSeconds(duration);
  const locked =
    isMotoBettingLocked(countdown, duration) ||
    racing ||
    period?.status !== "ACTIVE";
  const resolved = periods.filter((p) => p.firstPlace != null).slice(0, 20);
  const inRaceWindow =
    countdown > 0 &&
    countdown <= lockAt &&
    countdown > MOTO_RACE_END_SECONDS;

  return (
    <div
      className="moto-feel flex flex-col min-h-screen pb-10"
      style={{ background: "#110D14" }}
    >
      <GameHeader
        title="Moto Racing"
        onBack={onBack}
        right={
          <span
            className={`text-[15px] font-black tabular-nums ${
              countdown <= lockAt
                ? "text-[#DA3735] animate-countdown"
                : "text-[#FED358]"
            }`}
          >
            {cd}
          </span>
        }
      />

      <HistoryStrip items={periods} />

      <GameWalletCard
        balance={user?.balance}
        onRefresh={() => refreshUser()}
        onWithdraw={() => onNavigate?.("withdraw")}
        onDeposit={() => onNavigate?.("deposit")}
      />

      <GameNoticeBar
        text={`Bet until ${lockAt}s left · race · top 3 podium · next period`}
      />

      <DurationTabs
        tabs={[...MOTO_TABS]}
        activeId={activeGame}
        onChange={(id) => setActiveGame(id as MotoTabId)}
      />

      <div
        className="mx-3 mt-2 rounded-[14px] overflow-hidden relative"
        style={{
          border: "1px solid rgba(162,132,34,0.5)",
          boxShadow:
            "0 0 24px rgba(254,211,88,0.12), 0 8px 28px rgba(0,0,0,0.55)",
          height: "min(42vh, 320px)",
          minHeight: 200,
        }}
      >
        <Suspense
          fallback={
            <div className="w-full h-full flex items-center justify-center bg-[#151015]">
              <p className="text-[#FED358] text-sm font-bold animate-pulse">
                Loading track…
              </p>
            </div>
          }
        >
          <RaceCanvas
            ref={raceCanvasRef}
            className="absolute inset-0 w-full h-full"
          />
        </Suspense>

        <div
          className="absolute top-2 left-2 z-10 rounded-[8px] px-2 py-1"
          style={{
            background: "rgba(17,13,20,0.75)",
            border: "1px solid rgba(254,211,88,0.35)",
            backdropFilter: "blur(6px)",
          }}
        >
          <p className="text-[10px] text-[#837064] uppercase tracking-wider">
            Period
          </p>
          <p className="text-[13px] font-mono font-bold text-[#FDE4BC]">
            {period?.periodNumber ?? "—"}
          </p>
        </div>

        {/* Podium top-3 — shown after result */}
        <div
          className="absolute top-2 right-2 z-10 flex gap-1.5"
          style={{
            background: "rgba(17,13,20,0.8)",
            border: "1px solid rgba(254,211,88,0.3)",
            borderRadius: 10,
            padding: "4px 6px",
            backdropFilter: "blur(6px)",
          }}
        >
          {(
            [
              ["1st", lastPodium?.firstPlace],
              ["2nd", lastPodium?.secondPlace],
              ["3rd", lastPodium?.thirdPlace],
            ] as const
          ).map(([label, n]) => {
            const c = n != null ? bikeColor(n) : null;
            return (
              <div
                key={label}
                className="flex flex-col items-center min-w-[28px]"
              >
                <span className="text-[9px] text-white/40 font-bold">
                  {label}
                </span>
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-black${
                    c ? " moto-podium-live" : ""
                  }`}
                  style={{
                    background: c
                      ? `linear-gradient(160deg,${c.glow},${c.primary})`
                      : "rgba(56,46,53,0.9)",
                    color: c ? "#110D14" : "#837064",
                    boxShadow: c ? `0 0 8px ${c.primary}66` : "none",
                  }}
                >
                  {n ?? "?"}
                </span>
              </div>
            );
          })}
        </div>

        {(racing || inRaceWindow) && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
            <span
              className="text-[12px] font-black tracking-[0.2em] text-[#FED358] px-3 py-1 rounded-full"
              style={{
                background: "rgba(17,13,20,0.85)",
                border: "1px solid rgba(254,211,88,0.5)",
                boxShadow: "0 0 16px rgba(254,211,88,0.35)",
              }}
            >
              {lastPodium
              ? "WINNERS"
              : countdown <= MOTO_RACE_END_SECONDS
                ? "FINISH"
                : "RACING"}
            </span>
          </div>
        )}

        {isMotoBettingLocked(countdown, duration) && countdown > 0 && (
          <div className="absolute bottom-2 right-2 z-10">
            <span className="text-[11px] font-bold text-[#DA3735]/90 bg-black/50 px-2 py-0.5 rounded">
              Betting closed
            </span>
          </div>
        )}
      </div>

      <BetPanel
        target={target}
        onTarget={setTarget}
        locked={locked}
        onBet={openBet}
      />

      <HistoryTabBar
        tabs={[
          { id: "game", label: "Game history" },
          { id: "my", label: "My history" },
        ]}
        active={tab}
        onChange={(id) => setTab(id as "game" | "my")}
      />

      <div
        className="mx-3 mt-2 mb-4 rounded-[12px] overflow-hidden"
        style={{
          background: "#1a1519",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {tab === "game" ? (
          resolved.length === 0 ? (
            <p className="text-center text-white/30 text-xs py-10">
              No race results yet
            </p>
          ) : (
            <>
              <div
                className="grid grid-cols-[1.4fr_1fr] gap-1 px-3 py-2.5"
                style={{
                  background: "linear-gradient(90deg,#C8922A,#E8A84A)",
                }}
              >
                <span className="text-[13px] font-bold text-[#110D14] text-center">
                  Period
                </span>
                <span className="text-[13px] font-bold text-[#110D14] text-center">
                  Podium
                </span>
              </div>
              {resolved.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between items-center px-3 py-2.5 border-b border-white/5 text-[13px]"
                >
                  <span className="font-mono text-white/50 truncate max-w-[42%]">
                    {p.periodNumber}
                  </span>
                  <div className="flex gap-1.5">
                    {[p.firstPlace, p.secondPlace, p.thirdPlace].map(
                      (v, i) => {
                        const c = bikeColor(v ?? 1);
                        return (
                          <span
                            key={i}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-black text-[#110D14]"
                            style={{
                              background: `linear-gradient(160deg,${c.glow},${c.primary})`,
                            }}
                          >
                            {v}
                          </span>
                        );
                      }
                    )}
                  </div>
                </div>
              ))}
            </>
          )
        ) : myBets.length === 0 ? (
          <p className="text-center text-white/30 text-xs py-10">No bets yet</p>
        ) : (
          myBets.map((b) => {
            const selectLabel = [
              b.betType,
              b.betChoice,
              b.targetPosition ? b.targetPosition : null,
            ]
              .filter(Boolean)
              .join(" · ");
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
                  orderPrefix: "MOTO",
                  extraRows: b.targetPosition
                    ? [
                        {
                          label: "Target place",
                          value: String(b.targetPosition),
                        },
                      ]
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
        gameTitle="Moto Race"
        theme="orange"
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
        resultsHeading={resultPopup?.resultsHeading ?? RESULT_HEADINGS.moto}
        winAmount={resultPopup?.winAmount ?? 0}
        periodLabel={`Moto ${
          MOTO_TABS.find((t) => t.id === activeGame)?.subLabel ?? ""
        }`.trim()}
        periodNumber={resultPopup?.periodNumber}
        onClose={closeResultPopup}
      />
      {depositModal}
    </div>
  );
}
