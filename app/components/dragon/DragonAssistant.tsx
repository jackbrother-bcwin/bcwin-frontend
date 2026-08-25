"use client";

import { asset } from "../../lib/cdn";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import DraggableFloat from "../DraggableFloat";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import BetSlip, {
  type BetSlipConfirmPayload,
  type BetSlipTheme,
} from "../game/BetSlip";
import BetHistoryCard from "../game/BetHistoryCard";
import { useAuthState, useAuthActions } from "../../context/AuthContext";
import { useToast } from "../ui/Toast";
import * as api from "../../lib/api";
import type { GameHistoryItem, WingoPeriod } from "../../lib/api";
import { formatINR, secondsUntil } from "../../lib/format";
import {
  DRAGON_SOURCES,
  buildStreaks,
  type DragonBetPayload,
  type DragonGame,
  type StreakItem,
} from "./streaks";
import { useSpaBackClose } from "../../hooks/useSpaBackClose";

type PanelTab = "lottery" | "history";

const THEME_BG: Record<BetSlipTheme, string> = {
  red: "linear-gradient(180deg,#ff6b6b 0%,#e11d48 100%)",
  green: "linear-gradient(180deg,#4ade80 0%,#16a34a 100%)",
  violet: "linear-gradient(180deg,#c084fc 0%,#7e22ce 100%)",
  orange: "linear-gradient(180deg,#fdba74 0%,#ea580c 100%)",
  blue: "linear-gradient(180deg,#7dd3fc 0%,#2563eb 100%)",
};

interface PeriodMeta {
  periodId: string;
  periodNumber: string | null;
  endTime: string | null;
}

interface PendingBet {
  game: DragonGame;
  gameTitle: string;
  choiceLabel: string;
  theme: BetSlipTheme;
  periodId: string;
  periodNumber: string | null;
  payload: DragonBetPayload;
}

function periodKey(game: string, duration: number) {
  return `${game}:${duration}`;
}

function formatCountdown(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

interface DragonAssistantProps {
  showFloatingButton?: boolean;
}

export default function DragonAssistant({ showFloatingButton = true }: DragonAssistantProps) {
  const { user, isLoggedIn } = useAuthState();
  const { refreshUser } = useAuthActions();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const closeDragon = useCallback(() => setOpen(false), []);
  useSpaBackClose(open, closeDragon, "dragon-assistant");
  useBodyScrollLock(open);
  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("open-dragon-assistant", handleOpen);
    return () => window.removeEventListener("open-dragon-assistant", handleOpen);
  }, []);
  const [tab, setTab] = useState<PanelTab>("lottery");
  const [streaks, setStreaks] = useState<StreakItem[]>([]);
  const [periods, setPeriods] = useState<Record<string, PeriodMeta>>({});
  const [loadingStreaks, setLoadingStreaks] = useState(false);
  const [history, setHistory] = useState<GameHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [pending, setPending] = useState<PendingBet | null>(null);

  /** Tick every second so countdowns re-render */
  const [nowTick, setNowTick] = useState(0);

  const loadStreaks = useCallback(async (signal?: AbortSignal) => {
    setLoadingStreaks(true);
    try {
      const jobs: Promise<{
        streaks: StreakItem[];
        key: string;
        period: PeriodMeta | null;
      }>[] = [];

      for (const src of DRAGON_SOURCES) {
        for (const duration of src.durations) {
          const key = periodKey(src.game, duration);
          jobs.push(
            (async () => {
              try {
                const [resultsRes, periodsRes] = await Promise.all([
                  api.getGameResults(src.game, {
                    duration,
                    limit: 40,
                    page: 1,
                  }),
                  api.getGamePeriods<WingoPeriod>(src.game, {
                    duration,
                    limit: 1,
                  }),
                ]);
                if (signal?.aborted) {
                  return { streaks: [], key, period: null };
                }
                const rows = (resultsRes.results ?? []) as unknown as Record<
                  string,
                  unknown
                >[];
                const list = buildStreaks(
                  src.game,
                  src.gameLabel,
                  duration,
                  rows
                );
                const period =
                  periodsRes.currentPeriod ??
                  periodsRes.periods?.find((p) => p.status === "ACTIVE") ??
                  periodsRes.periods?.[0] ??
                  null;
                return {
                  streaks: list,
                  key,
                  period: period
                    ? {
                        periodId: period.id,
                        periodNumber: period.periodNumber ?? null,
                        endTime: period.endTime ?? null,
                      }
                    : null,
                };
              } catch {
                return { streaks: [], key, period: null };
              }
            })()
          );
        }
      }

      const nested = await Promise.all(jobs);
      if (signal?.aborted) return;

      const nextPeriods: Record<string, PeriodMeta> = {};
      const flat: StreakItem[] = [];
      for (const item of nested) {
        if (item.period) nextPeriods[item.key] = item.period;
        flat.push(...item.streaks);
      }
      flat.sort((a, b) => b.count - a.count);
      setPeriods(nextPeriods);
      setStreaks(flat);
    } finally {
      if (!signal?.aborted) setLoadingStreaks(false);
    }
  }, []);

  const loadHistory = useCallback(
    async (signal?: AbortSignal) => {
      if (!isLoggedIn) {
        setHistory([]);
        return;
      }
      setLoadingHistory(true);
      try {
        const res = await api.getGameHistory({ page: 1, limit: 30 });
        if (signal?.aborted) return;
        setHistory(res.data ?? []);
      } catch {
        if (!signal?.aborted) setHistory([]);
      } finally {
        if (!signal?.aborted) setLoadingHistory(false);
      }
    },
    [isLoggedIn]
  );

  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    if (tab === "lottery") loadStreaks(ac.signal);
    else loadHistory(ac.signal);
    return () => ac.abort();
  }, [open, tab, loadStreaks, loadHistory]);

  // Soft refresh streaks + periods every 15s while open
  useEffect(() => {
    if (!open || tab !== "lottery") return;
    const t = window.setInterval(() => loadStreaks(), 15_000);
    return () => window.clearInterval(t);
  }, [open, tab, loadStreaks]);

  // 1s clock for countdown labels
  useEffect(() => {
    if (!open || tab !== "lottery") return;
    const t = window.setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [open, tab]);

  const openBet = async (streak: StreakItem, side: "same" | "opposite") => {
    if (!isLoggedIn) {
      toast("Please log in to place a bet", "error");
      return;
    }
    const payload = side === "same" ? streak.sameBet : streak.oppositeBet;
    const label = side === "same" ? streak.marketLabel : streak.oppositeLabel;
    const theme = (
      side === "same" ? streak.theme : streak.oppositeTheme
    ) as BetSlipTheme;

    try {
      const key = periodKey(streak.game, streak.duration);
      let meta = periods[key] ?? null;

      // Always refresh period so we bet the live issue
      const res = await api.getGamePeriods<WingoPeriod>(streak.game, {
        duration: streak.duration,
        limit: 1,
      });
      const period =
        res.currentPeriod ??
        res.periods?.find((p) => p.status === "ACTIVE") ??
        res.periods?.[0] ??
        null;
      if (!period?.id) {
        toast("No active period", "error");
        return;
      }
      meta = {
        periodId: period.id,
        periodNumber: period.periodNumber ?? null,
        endTime: period.endTime ?? null,
      };
      setPeriods((prev) => ({ ...prev, [key]: meta! }));

      const left = secondsUntil(meta.endTime);
      if (left <= 0) {
        toast("Period ending — try again in a moment", "error");
        return;
      }

      let betPayload = payload;
      if (
        (payload.game === "wingo" || payload.game === "trxwingo") &&
        streak.game !== payload.game
      ) {
        betPayload = { ...payload, game: streak.game as "wingo" | "trxwingo" };
      }

      setPending({
        game: streak.game,
        gameTitle: `${streak.gameLabel} ${streak.durationLabel}`,
        choiceLabel: `Choose ${label}`,
        theme,
        periodId: meta.periodId,
        periodNumber: meta.periodNumber,
        payload: betPayload,
      });
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Could not open period", "error");
    }
  };

  const confirmBet = async (slip: BetSlipConfirmPayload) => {
    if (!pending) return;
    const amount = slip.total;
    if (user && amount > user.balance) {
      toast("Insufficient balance", "error");
      return;
    }
    if (amount <= 0) {
      toast("Invalid amount", "error");
      return;
    }
    const job = pending;
    setPending(null);
    try {
      const p = job.payload;
      if (p.game === "wingo") {
        await api.placeWingoBet({
          periodId: job.periodId,
          betType: p.betType,
          betChoice: p.betChoice,
          betAmount: amount,
        });
      } else if (p.game === "trxwingo") {
        await api.placeTrxWingoBet({
          periodId: job.periodId,
          betType: p.betType,
          betChoice: p.betChoice,
          betAmount: amount,
        });
      } else if (p.game === "k3") {
        await api.placeK3Bet({
          periodId: job.periodId,
          betType: p.betType,
          betChoice: p.betChoice,
          betAmount: amount,
        });
      } else if (p.game === "5d") {
        await api.place5dBet({
          periodId: job.periodId,
          betCategory: p.betCategory,
          betType: p.betType,
          betChoice: p.betChoice,
          betAmount: amount,
        });
      }
      toast(
        `Bet placed: ${job.choiceLabel} · ${formatINR(amount)}`,
        "success"
      );
      await refreshUser();
      if (tab === "history") loadHistory();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Bet failed", "error");
    }
  };

  const historyCards = useMemo(
    () =>
      history.map((g) => {
        const meta = (g.metadata ?? {}) as Record<string, unknown>;
        const prefix =
          g.majorGameType === "K3"
            ? "K3"
            : g.majorGameType === "FIVE_D" || g.majorGameType === "5D"
              ? "5D"
              : g.majorGameType === "MOTO"
                ? "MOTO"
                : g.majorGameType === "TRX_WINGO"
                  ? "TRX"
                  : "WG";
        const select =
          meta.betChoice != null
            ? String(meta.betChoice)
            : meta.betType != null
              ? String(meta.betType)
              : g.gameName || g.majorGameType || "Bet";
        return (
          <BetHistoryCard
            key={g.id}
            detail={{
              id: g.id,
              selectLabel: select,
              periodNumber:
                meta.periodNumber != null
                  ? String(meta.periodNumber)
                  : undefined,
              betAmount: g.betAmount,
              contractAmount:
                meta.contractAmount != null
                  ? Number(meta.contractAmount)
                  : undefined,
              status: g.status,
              winAmount: g.winAmount,
              isWin: Number(g.winAmount) > 0,
              createdAt: g.createdAt,
              orderPrefix: prefix,
              resultText:
                meta.resultText != null
                  ? String(meta.resultText)
                  : meta.resultNumber != null
                    ? String(meta.resultNumber)
                    : undefined,
              extraRows: [
                {
                  label: "Game",
                  value: g.gameName || g.majorGameType || "—",
                },
              ],
            }}
          />
        );
      }),
    [history]
  );

  return (
    <>
      {showFloatingButton && isLoggedIn && (
        <DraggableFloat
          id="dragon"
          size={56}
          defaultBottom={160}
          defaultRight={10}
          zIndex={41}
          aria-label="Dragon Assistant"
          onClick={() => setOpen(true)}
          className="rounded-full overflow-hidden"
          style={{
            boxShadow:
              "0 4px 18px rgba(155,72,219,0.45), 0 0 0 2px rgba(17,13,20,0.75)",
            background:
              "radial-gradient(circle at 35% 30%, #f5e6ff 0%, #c084fc 35%, #7e22ce 100%)",
          }}
        >
          <span className="relative flex h-full w-full items-center justify-center">
            {/* plain img: next/image blocks local SVG when dangerouslyAllowSVG is false */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset("/assets/svg/dragon.svg")}
              alt=""
              width={48}
              height={48}
              className="pointer-events-none select-none"
              draggable={false}
            />
          </span>
        </DraggableFloat>
      )}

      {open &&
        portalReady &&
        createPortal(
        <div
          className="spa-fullscreen-overlay"
          style={{
            background:
              "linear-gradient(180deg,#2a2228 0%,#110D14 40%,#110D14 100%)",
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Dragon Assistant"
          // Block touch from leaking to page underneath (iOS/Android browsers)
          onTouchMove={(e) => {
            // allow only scrollable body to handle vertical pan
            const t = e.target as HTMLElement | null;
            if (t?.closest?.(".spa-fullscreen-overlay__scroll")) return;
            e.preventDefault();
          }}
        >
          {/* Full-screen shell — opaque layer above nav / grids */}
          <div className="mx-auto flex h-full w-full max-w-[480px] flex-col min-h-0">
            {/* Header + banner */}
            <div className="relative shrink-0">
              <div
                className="relative h-[100px] w-full overflow-hidden"
                style={{
                  background:
                    "linear-gradient(110deg,#7c3aed 0%,#a855f7 40%,#c084fc 70%,#e9d5ff 100%)",
                }}
              >
                <Image
                  src={asset("/assets/png/changlong_bg-22ec113c.png")}
                  alt=""
                  fill
                  className="object-cover object-center opacity-95"
                  sizes="480px"
                  priority
                />
                <button
                  type="button"
                  onClick={closeDragon}
                  className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-[22px] font-bold text-white active:scale-95"
                  style={{
                    background: "rgba(0,0,0,0.45)",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
                    border: "1px solid rgba(255,255,255,0.15)",
                  }}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <p className="px-3 pt-2.5 pb-1 text-center text-[13px] text-white/45">
                5 consecutive strikes with the same result · quick bets
              </p>
            </div>

            {/* Tabs */}
            <div className="mx-3 mt-1 flex shrink-0 gap-2">
              {(
                [
                  { id: "lottery" as const, label: "Lottery" },
                  { id: "history" as const, label: "History" },
                ] as const
              ).map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className="flex-1 h-9 rounded-[10px] text-[14px] font-bold transition-all active:scale-[0.98]"
                    style={{
                      background: active
                        ? "linear-gradient(180deg, #FED358 0%, #E8A84A 100%)"
                        : "#2a2428",
                      color: active ? "#110D14" : "rgba(255,255,255,0.45)",
                      border: active
                        ? "none"
                        : "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Scrollable body — only this region scrolls */}
            <div className="spa-fullscreen-overlay__scroll px-3 py-3">
              {tab === "lottery" && (
                <>
                  {loadingStreaks && streaks.length === 0 ? (
                    <p className="py-16 text-center text-[14px] text-white/35">
                      Scanning streaks…
                    </p>
                  ) : streaks.length === 0 ? (
                    <p className="py-16 text-center text-[14px] text-white/35">
                      No hot streaks right now (need 5+ consecutive)
                    </p>
                  ) : (
                    <ul className="space-y-2.5">
                      {streaks.map((s) => {
                        const meta = periods[periodKey(s.game, s.duration)];
                        // nowTick drives re-render every second
                        const left = secondsUntil(meta?.endTime) + nowTick * 0;
                        const urgent = left > 0 && left <= 12;
                        const locked = left <= 0;
                        return (
                          <li
                            key={`${s.game}-${s.duration}-${s.marketId}`}
                            className="rounded-[12px] px-3 py-2.5"
                            style={{
                              background: "#241E22",
                              border: "1px solid rgba(255,255,255,0.06)",
                            }}
                          >
                            <div className="mb-1.5 flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="truncate text-[14px] font-bold text-[#FDE4BC]">
                                    {s.gameLabel}{" "}
                                    <span className="text-white/45 font-semibold">
                                      {s.durationLabel}
                                    </span>
                                  </p>
                                  {/* Countdown */}
                                  <div
                                    className="shrink-0 flex flex-col items-end"
                                    title={
                                      meta?.periodNumber
                                        ? `Period ${meta.periodNumber}`
                                        : undefined
                                    }
                                  >
                                    <span
                                      className="font-mono text-[15px] font-black tabular-nums leading-none tracking-wide"
                                      style={{
                                        color: locked
                                          ? "rgba(255,255,255,0.35)"
                                          : urgent
                                            ? "#FD565C"
                                            : "#FED358",
                                      }}
                                    >
                                      {locked ? "00:00" : formatCountdown(left)}
                                    </span>
                                    <span className="mt-0.5 text-[11px] text-white/35 leading-none">
                                      {locked ? "settling…" : "time left"}
                                    </span>
                                  </div>
                                </div>
                                <p className="mt-1 text-[13px] text-white/55">
                                  <span
                                    className="font-bold"
                                    style={{
                                      color:
                                        s.theme === "green"
                                          ? "#17B15E"
                                          : s.theme === "red"
                                            ? "#DA3735"
                                            : s.theme === "orange"
                                              ? "#DD9138"
                                              : s.theme === "blue"
                                                ? "#5088D3"
                                                : "#c084fc",
                                    }}
                                  >
                                    {s.marketLabel}
                                  </span>
                                  {" · "}
                                  continuous{" "}
                                  <span className="font-black text-[#FED358]">
                                    {s.count}
                                  </span>{" "}
                                  periods
                                  {meta?.periodNumber ? (
                                    <span className="text-white/30">
                                      {" "}
                                      · #{String(meta.periodNumber).slice(-6)}
                                    </span>
                                  ) : null}
                                </p>
                              </div>
                            </div>

                            <div className="mb-2 flex items-center gap-0.5">
                              {s.trail.slice(0, 8).map((t, i) => (
                                <span
                                  key={i}
                                  className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] font-black text-white"
                                  style={{ background: THEME_BG[s.theme] }}
                                >
                                  {t}
                                </span>
                              ))}
                            </div>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={locked}
                                onClick={() => openBet(s, "same")}
                                className="flex-1 h-9 rounded-[8px] text-[14px] font-black text-white active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
                                style={{ background: THEME_BG[s.theme] }}
                              >
                                {s.marketLabel}
                              </button>
                              <button
                                type="button"
                                disabled={locked}
                                onClick={() => openBet(s, "opposite")}
                                className="flex-1 h-9 rounded-[8px] text-[14px] font-black text-white active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
                                style={{
                                  background: THEME_BG[s.oppositeTheme],
                                }}
                              >
                                {s.oppositeLabel}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}

              {tab === "history" && (
                <>
                  {!isLoggedIn ? (
                    <p className="py-16 text-center text-[14px] text-white/35">
                      Log in to see bet history
                    </p>
                  ) : loadingHistory && history.length === 0 ? (
                    <p className="py-16 text-center text-[14px] text-white/35">
                      Loading history…
                    </p>
                  ) : history.length === 0 ? (
                    <p className="py-16 text-center text-[14px] text-white/35">
                      No bets yet
                    </p>
                  ) : (
                    <div
                      className="overflow-hidden rounded-[12px]"
                      style={{
                        background: "#1a1519",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      {historyCards}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <BetSlip
        open={!!pending}
        gameTitle={pending?.gameTitle ?? "Dragon"}
        choiceLabel={pending?.choiceLabel ?? ""}
        theme={pending?.theme ?? "orange"}
        balance={user?.balance}
        periodNumber={pending?.periodNumber}
        onCancel={() => setPending(null)}
        onConfirm={confirmBet}
      />
    </>
  );
}
