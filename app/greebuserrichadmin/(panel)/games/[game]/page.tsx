"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  IoFlashOutline,
  IoShieldCheckmarkOutline,
  IoWarningOutline,
  IoTimeOutline,
  IoTrendingUpOutline,
  IoTrendingDownOutline,
  IoDiceOutline,
  IoRefreshOutline,
  IoSettingsOutline,
  IoCheckmarkCircle,
} from "react-icons/io5";
import * as admin from "../../../../lib/admin-api";
import { getGamePeriods, getGameResults } from "../../../../lib/api";
import { useToast } from "../../../../components/ui/Toast";
import { formatIstDateTime } from "../../../../lib/ist-day";
import { AdminUserCell } from "../../../components/AdminUserCell";
import {
  EmptyBlock,
  LoadingBlock,
  PageTitle,
  RefreshBtn,
  Surface,
} from "../../../components/ui";
import { AdminBarChart } from "../../../components/Charts";
import type { SetResultBody } from "../../../../lib/admin-api";
import {
  analyzeK3Bets,
  analyzeWingoBets,
  BALL_SRC,
  DICE_SRC,
  formatCd,
  NUM_COLOR,
  secondsUntil,
  type LiveBet,
} from "../../../components/game-analysis";

type GameApi = "wingo" | "k3" | "5d" | "trxwingo" | "moto";

const GAME_META: Record<
  string,
  {
    title: string;
    durations: number[];
    api: GameApi;
    canSetResult: boolean;
    accent: string;
    blurb: string;
  }
> = {
  wingo: {
    title: "WinGo Manager",
    durations: [30, 60, 180, 300],
    api: "wingo",
    canSetResult: true,
    accent: "#2563eb",
    blurb: "Pick the next winning number 0–9 with live liability heat map.",
  },
  trxwingo: {
    title: "TRX WinGo Manager",
    durations: [30, 60, 180, 300],
    api: "trxwingo",
    canSetResult: false,
    accent: "#7c3aed",
    blurb: "TRX hash results — live book only (setResults not supported).",
  },
  k3: {
    title: "K3 Manager",
    durations: [30, 60, 180, 300],
    api: "k3",
    canSetResult: true,
    accent: "#059669",
    blurb: "Set three dice (1–6) for the next draw with sum exposure.",
  },
  "5d": {
    title: "5D Manager",
    durations: [30, 60, 180, 300],
    api: "5d",
    canSetResult: true,
    accent: "#d97706",
    blurb: "Choose A–E digits interactively for the next 5D outcome.",
  },
  moto: {
    title: "Moto Manager",
    durations: [30, 60, 180, 300],
    api: "moto",
    canSetResult: false,
    accent: "#ea580c",
    blurb: "Live race book — manual podium set not exposed by API.",
  },
};

type PeriodRow = {
  id?: string;
  periodNumber?: string;
  status?: string;
  endTime?: string;
  startTime?: string;
  resultNumber?: number | string | null;
  dice1?: number | null;
  dice2?: number | null;
  dice3?: number | null;
  sum?: number | null;
  firstPlace?: number | null;
  secondPlace?: number | null;
  thirdPlace?: number | null;
};

export default function GameManagerPage() {
  const params = useParams();
  const gameKey = String(params.game ?? "wingo");
  const meta = GAME_META[gameKey] ?? GAME_META.wingo!;
  const { toast } = useToast();

  const [duration, setDuration] = useState(meta.durations[0] ?? 60);
  const [period, setPeriod] = useState<PeriodRow | null>(null);
  const [recent, setRecent] = useState<PeriodRow[]>([]);
  const [results, setResults] = useState<Array<Record<string, unknown>>>([]);
  const [liveBook, setLiveBook] = useState<admin.AdminGameLiveBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Wingo / TRX selection
  const [number, setNumber] = useState(0);
  // K3
  const [dice, setDice] = useState<[number, number, number]>([1, 1, 1]);
  // 5D
  const [digits, setDigits] = useState<[number, number, number, number, number]>([0, 0, 0, 0, 0]);
  const [activeDigit, setActiveDigit] = useState(0);
  /** Admin-locked prediction for current period (from Redis) */
  const [fixed, setFixed] = useState<
    | { kind: "wingo"; number: number }
    | { kind: "k3"; dice1: number; dice2: number; dice3: number }
    | { kind: "5d"; resultNumber: string }
    | null
  >(null);

  /** Platform config: Wingo result algorithm (RANDOM | WINNING | TRX) */
  const [wingoAlgorithm, setWingoAlgorithm] = useState<
    "RANDOM" | "WINNING" | "TRX"
  >("RANDOM");
  const [algoSaving, setAlgoSaving] = useState(false);
  const livePeriodIdRef = useRef<string | null>(null);

  // Reset duration when switching game route
  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      setDuration(meta.durations[0] ?? 60);
      setNumber(0);
      setDice([1, 1, 1]);
      setDigits([0, 0, 0, 0, 0]);
      setFixed(null);
      setLiveBook(null);
    }, 0);
    return () => window.clearTimeout(resetTimer);
  }, [gameKey, meta.durations]);

  const applyFixedToUi = useCallback(
    (raw: unknown) => {
      if (!raw || typeof raw !== "object") {
        setFixed(null);
        return;
      }
      const r = raw as Record<string, unknown>;
      if (meta.api === "wingo" && typeof r.number === "number") {
        setFixed({ kind: "wingo", number: r.number });
        setNumber(r.number);
        return;
      }
      if (
        meta.api === "k3" &&
        typeof r.dice1 === "number" &&
        typeof r.dice2 === "number" &&
        typeof r.dice3 === "number"
      ) {
        setFixed({
          kind: "k3",
          dice1: r.dice1,
          dice2: r.dice2,
          dice3: r.dice3,
        });
        setDice([r.dice1, r.dice2, r.dice3]);
        return;
      }
      if (meta.api === "5d" && typeof r.resultNumber === "string") {
        const s = r.resultNumber;
        if (/^\d{5}$/.test(s)) {
          setFixed({ kind: "5d", resultNumber: s });
          setDigits([
            Number(s[0]),
            Number(s[1]),
            Number(s[2]),
            Number(s[3]),
            Number(s[4]),
          ]);
        }
        return;
      }
      setFixed(null);
    },
    [meta.api]
  );

  const refreshLiveBets = useCallback(
    async (periodId: string) => {
      try {
        const response = await admin.getAdminGameLiveBets(meta.api, periodId);
        if (livePeriodIdRef.current === periodId) {
          setLiveBook(response);
        }
      } catch {
        // Keep the last good snapshot; the next 2-second poll retries.
      }
    },
    [meta.api]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, rRes] = await Promise.all([
        getGamePeriods(meta.api, { duration, limit: 12 }),
        getGameResults(meta.api, { duration, page: 1, limit: 20 }).catch(() => ({
          results: [],
        })),
      ]);
      const periods = (pRes.periods ?? []) as PeriodRow[];
      const cur =
        (pRes as { currentPeriod?: PeriodRow }).currentPeriod ??
        periods.find((p) => p.status === "ACTIVE") ??
        periods[0] ??
        null;
      setPeriod(cur);
      setRecent(periods);
      setResults((rRes.results as Array<Record<string, unknown>>) ?? []);
      if (cur?.endTime) setCountdown(secondsUntil(cur.endTime));

      if (cur?.id) {
        const periodId = String(cur.id);
        livePeriodIdRef.current = periodId;
        const [liveResponse, fixedRes] = await Promise.all([
          admin.getAdminGameLiveBets(meta.api, periodId).catch(() => null),
          meta.canSetResult &&
          (meta.api === "wingo" || meta.api === "k3" || meta.api === "5d")
            ? admin
                .getFixedResult(meta.api, periodId)
                .catch(() => ({ fixed: null }))
            : Promise.resolve({ fixed: null }),
        ]);
        if (livePeriodIdRef.current === periodId && liveResponse) {
          setLiveBook(liveResponse);
        }
        applyFixedToUi(fixedRes.fixed);
      } else {
        livePeriodIdRef.current = null;
        setLiveBook(null);
        setFixed(null);
      }
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load period", "error");
    } finally {
      setLoading(false);
    }
  }, [meta.api, meta.canSetResult, duration, toast, applyFixedToUi]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void load(), 0);
    const t = setInterval(load, 6000);
    return () => {
      window.clearTimeout(initialTimer);
      clearInterval(t);
    };
  }, [load]);

  useEffect(() => {
    const periodId = String(period?.id ?? "");
    if (!periodId) return;
    livePeriodIdRef.current = periodId;
    const timer = window.setInterval(
      () => void refreshLiveBets(periodId),
      2_000
    );
    return () => window.clearInterval(timer);
  }, [period?.id, refreshLiveBets]);

  // Load wingo algorithm from platform config (wingo / trxwingo managers)
  const loadAlgo = useCallback(async () => {
    if (meta.api !== "wingo" && meta.api !== "trxwingo") return;
    try {
      const res = await admin.getConfig();
      const algo = String(res.config?.wingoAlgorithm ?? "RANDOM").toUpperCase();
      if (algo === "WINNING" || algo === "TRX" || algo === "RANDOM") {
        setWingoAlgorithm(algo);
      }
    } catch {
      /* non-blocking */
    }
  }, [meta.api]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void loadAlgo(), 0);
    return () => window.clearTimeout(initialTimer);
  }, [loadAlgo]);

  const saveWingoAlgorithm = async (next: "RANDOM" | "WINNING" | "TRX") => {
    if (next === wingoAlgorithm) return;
    setAlgoSaving(true);
    try {
      await admin.updateConfig({ wingoAlgorithm: next });
      setWingoAlgorithm(next);
      toast(`Wingo result mode → ${next}`, "success");
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to update algorithm", "error");
    } finally {
      setAlgoSaving(false);
    }
  };

  // 1s countdown (MM:SS display) — refresh once when period ends (no 250ms storm)
  const zeroLoadedFor = useRef<string | null>(null);
  useEffect(() => {
    zeroLoadedFor.current = null;
    const t = setInterval(() => {
      if (!period?.endTime) return;
      const left = secondsUntil(period.endTime);
      setCountdown((prev) => (prev === left ? prev : left));
      if (left === 0 && zeroLoadedFor.current !== period.endTime) {
        zeroLoadedFor.current = period.endTime;
        load();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [period?.endTime, load]);

  const activeLiveBook =
    liveBook && liveBook.periodId === String(period?.id ?? "") ? liveBook : null;
  const liveDistribution = useMemo(
    () => activeLiveBook?.distribution ?? [],
    [activeLiveBook]
  );
  const bets = useMemo<LiveBet[]>(
    () =>
      liveDistribution.map((row) => ({
        betType: row.betType,
        betChoice: row.betChoice,
        betAmount: row.amount,
        betCount: row.betCount,
        status: "PENDING",
      })),
    [liveDistribution]
  );
  const liveRows = activeLiveBook?.bets ?? [];
  const liveBetCount = activeLiveBook?.total ?? 0;
  const wingoAnalysis = useMemo(() => analyzeWingoBets(bets), [bets]);
  const k3Analysis = useMemo(() => analyzeK3Bets(bets), [bets]);
  const maxLiab = Math.max(1, ...wingoAnalysis.byNumber.map((r) => r.liability));

  const totalBet = activeLiveBook?.totalBetAmount ?? 0;
  const cdParts = formatCd(countdown).split(":");
  const urgent = countdown > 0 && countdown <= 10;
  const wingoResultFrozen = meta.api === "wingo" && countdown <= 3;

  const confirmPrediction = async () => {
    if (!meta.canSetResult) {
      toast("Manual result set is not supported for this game via API", "error");
      return;
    }
    if (!period?.id) {
      toast("No active period", "error");
      return;
    }
    if (meta.api === "wingo" && countdown <= 3) {
      toast("Result is frozen for this period", "error");
      return;
    }
    let body: SetResultBody;
    if (meta.api === "wingo") {
      body = { game: "wingo", periodId: String(period.id), result: { number } };
    } else if (meta.api === "k3") {
      body = {
        game: "k3",
        periodId: String(period.id),
        result: { dice1: dice[0], dice2: dice[1], dice3: dice[2] },
      };
    } else if (meta.api === "5d") {
      body = {
        game: "5d",
        periodId: String(period.id),
        result: { resultNumber: digits.join("") },
      };
    } else {
      toast("Unsupported", "error");
      return;
    }

    setSaving(true);
    try {
      await admin.setResults(body);
      toast("Next outcome locked in successfully", "success");
      // Reflect lock immediately in UI
      if (meta.api === "wingo") {
        setFixed({ kind: "wingo", number });
      } else if (meta.api === "k3") {
        setFixed({
          kind: "k3",
          dice1: dice[0],
          dice2: dice[1],
          dice3: dice[2],
        });
      } else if (meta.api === "5d") {
        setFixed({ kind: "5d", resultNumber: digits.join("") });
      }
      load();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to set result", "error");
    } finally {
      setSaving(false);
    }
  };

  const fixedLabel = useMemo(() => {
    if (!fixed) return null;
    if (fixed.kind === "wingo") return `#${fixed.number}`;
    if (fixed.kind === "k3")
      return `${fixed.dice1}–${fixed.dice2}–${fixed.dice3} (sum ${
        fixed.dice1 + fixed.dice2 + fixed.dice3
      })`;
    return fixed.resultNumber;
  }, [fixed]);

  const pickSafestWingo = () => {
    setNumber(wingoAnalysis.safest);
    toast(`Suggested safest #${wingoAnalysis.safest} (lowest liability)`, "info");
  };

  if (loading && !period) return <LoadingBlock />;

  return (
    <div className="gm-page">
      <PageTitle
        title={meta.title}
        subtitle={meta.blurb}
        action={<RefreshBtn onClick={load} loading={loading} />}
      />

      {/* Duration tabs — horizontal scroll on narrow screens */}
      <div className="gm-duration-tabs mb-4 flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-0.5 px-0.5">
        {meta.durations.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDuration(d)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition-all active:scale-[0.98] sm:px-4 ${
              duration === d
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "bg-white text-slate-600 shadow-sm border border-slate-100 active:bg-slate-50"
            }`}
          >
            {d < 60 ? `${d} sec` : `${d / 60} Min`}
          </button>
        ))}
      </div>

      {/* Wingo result mode (platform config) — same field as Config → wingoAlgorithm */}
      {(meta.api === "wingo" || meta.api === "trxwingo") && (
        <Surface
          className="mb-4 admin-fade-up"
          title="Result mode"
          action={
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              <IoSettingsOutline size={12} />
              Config
            </span>
          }
        >
          <p className="mb-3 text-[12px] leading-relaxed text-slate-500">
            Default settlement for periods{" "}
            <b>without</b> a manual fixed prediction. Manual set always wins for
            that period until 3 seconds remain. Same setting as Platform config.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(
              [
                {
                  id: "RANDOM" as const,
                  label: "Random",
                  desc: "Pure random 0–9",
                },
                {
                  id: "WINNING" as const,
                  label: "Winning",
                  desc: "House edge — lowest liability number",
                },
                {
                  id: "TRX" as const,
                  label: "TRX result",
                  desc: "Last digit of latest Tron block hash",
                },
              ] as const
            ).map((opt) => {
              const active = wingoAlgorithm === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={algoSaving}
                  onClick={() => void saveWingoAlgorithm(opt.id)}
                  className={`relative rounded-xl border px-3 py-3 text-left transition-all active:scale-[0.99] disabled:opacity-60 ${
                    active
                      ? "border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-500/30"
                      : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
                  }`}
                >
                  {active && (
                    <IoCheckmarkCircle
                      className="absolute right-2 top-2 text-blue-600"
                      size={18}
                    />
                  )}
                  <p
                    className={`text-sm font-black ${
                      active ? "text-blue-800" : "text-slate-800"
                    }`}
                  >
                    {opt.label}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                    {opt.desc}
                  </p>
                  <p
                    className={`mt-2 font-mono text-[10px] font-bold ${
                      active ? "text-blue-600" : "text-slate-400"
                    }`}
                  >
                    {opt.id}
                    {active ? " · ACTIVE" : ""}
                  </p>
                </button>
              );
            })}
          </div>
          {algoSaving && (
            <p className="mt-2 text-[11px] font-semibold text-blue-600">
              Saving…
            </p>
          )}
        </Surface>
      )}

      {/* Hero: period + countdown */}
      <div
        className="gm-hero mb-4 admin-fade-up"
        style={{
          background: `linear-gradient(135deg, ${meta.accent} 0%, #1e3a8a 100%)`,
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
              Active period
            </p>
            <p className="mt-1 break-all font-mono text-base font-bold tracking-wide text-white sm:text-lg">
              {period?.periodNumber ?? "—"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold text-white sm:text-[11px]">
                {period?.status ?? "—"}
              </span>
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold text-white sm:text-[11px]">
                {liveBetCount} live bets
              </span>
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold text-white sm:text-[11px]">
                ₹{totalBet.toLocaleString("en-IN")} stake
              </span>
              {fixedLabel && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/95 px-2.5 py-0.5 text-[10px] font-black text-emerald-950 sm:text-[11px]">
                  <IoShieldCheckmarkOutline size={12} />
                  Fixed · {fixedLabel}
                </span>
              )}
              {(meta.api === "wingo" || meta.api === "trxwingo") && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold text-white sm:text-[11px]">
                  <IoSettingsOutline size={11} />
                  Mode · {wingoAlgorithm}
                </span>
              )}
            </div>
          </div>

          <div
            className={`gm-countdown w-full sm:w-auto sm:min-w-[160px] ${
              urgent ? "gm-countdown-urgent" : ""
            }`}
          >
            <div className="mb-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-white/80">
              <IoTimeOutline size={14} />
              Time remaining
            </div>
            <div className="flex items-center justify-center gap-1 sm:gap-1.5">
              {(cdParts[0] ?? "00").split("").map((d, i) => (
                <span key={`m${i}`} className="gm-cd-digit">
                  {d}
                </span>
              ))}
              <span className="px-0.5 text-xl font-black text-white/90 sm:text-2xl">:</span>
              {(cdParts[1] ?? "00").split("").map((d, i) => (
                <span key={`s${i}`} className="gm-cd-digit">
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* ── Prediction console ── */}
        <Surface
          title="Set next outcome"
          className="admin-fade-up min-w-0"
          action={
            meta.canSetResult && meta.api === "wingo" ? (
              <button
                type="button"
                onClick={pickSafestWingo}
                className="admin-btn-ghost !min-h-9 whitespace-nowrap text-[11px] !py-1.5 !px-2.5"
              >
                <IoShieldCheckmarkOutline className="inline mr-1" />
                Auto safest
              </button>
            ) : undefined
          }
        >
          {!meta.canSetResult && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
              <IoWarningOutline size={16} className="shrink-0 mt-0.5" />
              <span>
                Live book view only — <code className="font-mono">POST /admin/setResults</code> supports{" "}
                <b>wingo</b>, <b>k3</b>, and <b>5d</b>.
              </span>
            </div>
          )}

          {fixedLabel && meta.canSetResult && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900">
              <IoShieldCheckmarkOutline size={18} className="shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="font-black text-emerald-800">
                  Prediction locked for this period
                </p>
                <p className="mt-0.5 text-emerald-800/90">
                  Fixed result:{" "}
                  <span className="font-mono text-base font-black text-emerald-950">
                    {fixedLabel}
                  </span>
                  {" · "}
                  will be used when the period settles. You can change it until
                  3 seconds remain.
                </p>
              </div>
              {fixed?.kind === "wingo" && (
                <div className="relative h-12 w-12 shrink-0">
                  <Image
                    src={BALL_SRC[fixed.number] ?? BALL_SRC[0]!}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-contain"
                  />
                </div>
              )}
            </div>
          )}

          {/* WINGO ball grid */}
          {(meta.api === "wingo" || meta.api === "trxwingo") && (
            <>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Tap a ball · heat = liability
                {fixed?.kind === "wingo" ? " · green ring = fixed" : ""}
              </p>
              <div className="gm-wingo-grid mb-4 grid grid-cols-5 gap-1.5 sm:gap-3">
                {wingoAnalysis.byNumber.map((row) => {
                  const selected = number === row.n;
                  const isFixed = fixed?.kind === "wingo" && fixed.number === row.n;
                  const heat = row.liability / maxLiab;
                  return (
                    <button
                      key={row.n}
                      type="button"
                      disabled={!meta.canSetResult}
                      onClick={() => setNumber(row.n)}
                      className={`gm-ball-btn group relative ${selected ? "gm-ball-selected" : ""} ${
                        isFixed ? "gm-ball-fixed" : ""
                      }`}
                      style={{
                        boxShadow: isFixed
                          ? "0 0 0 2px #059669, 0 6px 16px rgba(5,150,105,0.35)"
                          : selected
                            ? `0 0 0 2px ${meta.accent}, 0 6px 16px rgba(37,99,235,0.3)`
                            : heat > 0.6
                              ? "0 0 0 2px rgba(239,68,68,0.45)"
                              : undefined,
                      }}
                    >
                      {isFixed && (
                        <span className="absolute -right-0.5 -top-0.5 z-10 rounded bg-emerald-600 px-1 text-[8px] font-black uppercase leading-4 text-white">
                          fix
                        </span>
                      )}
                      <div className="relative mx-auto h-9 w-9 sm:h-12 sm:w-12 md:h-14 md:w-14">
                        <Image
                          src={BALL_SRC[row.n] ?? BALL_SRC[0]!}
                          alt={`Ball ${row.n}`}
                          fill
                          sizes="56px"
                          className="object-contain drop-shadow-md transition-transform group-active:scale-95"
                        />
                      </div>
                      <span className="mt-0.5 block truncate px-0.5 text-[9px] font-bold tabular-nums text-slate-600 sm:mt-1 sm:text-[10px]">
                        ₹{Math.round(row.liability).toLocaleString("en-IN")}
                      </span>
                      <span
                        className="mx-1 mt-0.5 block h-1 rounded-full sm:mx-2"
                        style={{
                          background: `linear-gradient(90deg, #22c55e 0%, #ef4444 100%)`,
                          opacity: 0.25 + heat * 0.75,
                          transform: `scaleX(${0.15 + heat * 0.85})`,
                        }}
                      />
                    </button>
                  );
                })}
              </div>

              <div className="mb-4 flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
                {[
                  { label: "Green side", action: () => setNumber([1, 3, 7, 9][Math.floor(Math.random() * 4)]!) },
                  { label: "Red side", action: () => setNumber([2, 4, 6, 8][Math.floor(Math.random() * 4)]!) },
                  { label: "Violet 0/5", action: () => setNumber(Math.random() > 0.5 ? 0 : 5) },
                  { label: "Big 5–9", action: () => setNumber(5 + Math.floor(Math.random() * 5)) },
                  { label: "Small 0–4", action: () => setNumber(Math.floor(Math.random() * 5)) },
                ].map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    disabled={!meta.canSetResult}
                    onClick={q.action}
                    className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-600 transition-colors active:bg-blue-50 disabled:opacity-40 sm:py-1.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    {q.label}
                  </button>
                ))}
              </div>

              <div
                className={`mb-4 flex flex-col gap-3 rounded-xl border px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4 ${
                  fixed?.kind === "wingo" && fixed.number === number
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-slate-100 bg-slate-50"
                }`}
              >
                <div className="relative mx-auto h-12 w-12 shrink-0 sm:mx-0 sm:h-14 sm:w-14">
                  <Image
                    src={BALL_SRC[number]!}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-contain"
                  />
                </div>
                <div className="min-w-0 text-center sm:text-left">
                  <p className="text-xs font-semibold text-slate-500">
                    {fixed?.kind === "wingo" && fixed.number === number
                      ? "Locked outcome"
                      : "Selected outcome"}
                  </p>
                  <p className="text-2xl font-black text-slate-800">
                    #{number}
                    {fixed?.kind === "wingo" && fixed.number === number && (
                      <span className="ml-2 align-middle text-[11px] font-bold text-emerald-700">
                        FIXED
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    Liability ≈ ₹
                    {Math.round(
                      wingoAnalysis.byNumber[number]?.liability ?? 0
                    ).toLocaleString("en-IN")}
                    <span className="hidden sm:inline">
                      {" · "}
                      Safest:{" "}
                      <b className="text-emerald-600">#{wingoAnalysis.safest}</b>
                      {" · "}
                      Riskiest:{" "}
                      <b className="text-red-600">#{wingoAnalysis.riskiest}</b>
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 sm:hidden">
                    Safest <b className="text-emerald-600">#{wingoAnalysis.safest}</b>
                    {" · "}
                    Riskiest <b className="text-red-600">#{wingoAnalysis.riskiest}</b>
                  </p>
                </div>
              </div>
            </>
          )}

          {/* K3 dice */}
          {meta.api === "k3" && (
            <>
              <p className="mb-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                Select dice 1 · 2 · 3
              </p>
              <div className="grid gap-4 sm:grid-cols-3 mb-4">
                {([0, 1, 2] as const).map((slot) => (
                  <div key={slot} className="rounded-2xl border border-slate-100 bg-gradient-to-b from-white to-slate-50 p-3">
                    <p className="mb-2 text-center text-[11px] font-bold text-slate-500">Dice {slot + 1}</p>
                    <div className="relative mx-auto mb-2 h-16 w-16">
                      <Image
                        src={DICE_SRC[dice[slot]] ?? DICE_SRC[1]!}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-contain drop-shadow"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[1, 2, 3, 4, 5, 6].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => {
                            const next = [...dice] as [number, number, number];
                            next[slot] = v;
                            setDice(next);
                          }}
                          className={`rounded-lg py-1.5 text-xs font-bold transition-all ${
                            dice[slot] === v
                              ? "bg-emerald-600 text-white shadow"
                              : "bg-white border border-slate-200 text-slate-600 hover:border-emerald-300"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mb-4 text-sm text-slate-600">
                Sum = <b className="text-slate-900">{dice[0] + dice[1] + dice[2]}</b>
                {" · "}
                {dice[0] + dice[1] + dice[2] >= 11 ? "Big" : "Small"}
                {" / "}
                {(dice[0] + dice[1] + dice[2]) % 2 === 0 ? "Even" : "Odd"}
                {" · "}
                Safest sum band: <b className="text-emerald-600">{k3Analysis.safest}</b>
              </p>
            </>
          )}

          {/* 5D digits */}
          {meta.api === "5d" && (
            <>
              <div className="mb-3 flex justify-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 sm:gap-2">
                {(["A", "B", "C", "D", "E"] as const).map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setActiveDigit(i)}
                    className={`flex shrink-0 flex-col items-center rounded-xl border px-2.5 py-2 transition-all sm:px-3 ${
                      activeDigit === i
                        ? "border-amber-400 bg-amber-50 shadow-sm"
                        : "border-slate-100 bg-white"
                    }`}
                  >
                    <span className="text-[10px] font-bold text-slate-400">{label}</span>
                    <div className="relative mt-1 h-8 w-8 sm:h-9 sm:w-9">
                      <Image
                        src={BALL_SRC[digits[i]!]!}
                        alt=""
                        fill
                        sizes="36px"
                        className="object-contain"
                      />
                    </div>
                  </button>
                ))}
              </div>
              <p className="mb-2 text-center text-[11px] font-semibold text-slate-500">
                Editing position {["A", "B", "C", "D", "E"][activeDigit]} — pick 0–9
              </p>
              <div className="gm-wingo-grid mx-auto mb-4 grid max-w-md grid-cols-5 gap-1.5 sm:gap-2">
                {Array.from({ length: 10 }, (_, n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      const next = [...digits] as typeof digits;
                      next[activeDigit] = n;
                      setDigits(next);
                    }}
                    className={`gm-ball-btn ${digits[activeDigit] === n ? "gm-ball-selected" : ""}`}
                  >
                    <div className="relative mx-auto h-9 w-9 sm:h-11 sm:w-11">
                      <Image
                        src={BALL_SRC[n]!}
                        alt=""
                        fill
                        sizes="44px"
                        className="object-contain"
                      />
                    </div>
                  </button>
                ))}
              </div>
              <p className="mb-4 text-center font-mono text-base font-black tracking-[0.25em] text-slate-800 sm:text-lg sm:tracking-[0.3em]">
                {digits.join("")}
              </p>
            </>
          )}

          {meta.api === "moto" && (
            <div className="rounded-xl bg-orange-50 border border-orange-100 px-4 py-6 text-center text-sm text-orange-900">
              <IoDiceOutline className="mx-auto mb-2 text-orange-500" size={28} />
              Moto podium is resolved by the race engine. Use live bets table below for monitoring.
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              disabled={saving || !meta.canSetResult || wingoResultFrozen}
              onClick={confirmPrediction}
              className="admin-btn-primary inline-flex w-full items-center justify-center gap-2 !px-5 !py-2.5 disabled:opacity-50 sm:w-auto"
            >
              <IoFlashOutline size={16} />
              {saving
                ? "Locking…"
                : wingoResultFrozen
                  ? "Frozen at 3s"
                  : fixed
                    ? "Update fixed prediction"
                    : "Confirm next prediction"}
            </button>
            <button
              type="button"
              onClick={() => {
                setNumber(0);
                setDice([1, 1, 1]);
                setDigits([0, 0, 0, 0, 0]);
              }}
              className="admin-btn-ghost inline-flex w-full items-center justify-center gap-1.5 sm:w-auto"
            >
              <IoRefreshOutline size={15} />
              Reset pick
            </button>
          </div>
        </Surface>

        {/* ── Analysis column ── */}
        <div className="min-w-0 space-y-4">
          <Surface title="Book analysis" className="admin-fade-up min-w-0">
            {(meta.api === "wingo" || meta.api === "trxwingo") && (
              <>
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-2.5 py-2.5 sm:px-3">
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700">
                      <IoTrendingDownOutline /> Safest
                    </div>
                    <p className="text-lg font-black text-emerald-800 sm:text-xl">
                      #{wingoAnalysis.safest}
                    </p>
                    <p className="truncate text-[10px] text-emerald-700/80">
                      ₹
                      {Math.round(
                        wingoAnalysis.byNumber[wingoAnalysis.safest]?.liability ?? 0
                      ).toLocaleString("en-IN")}{" "}
                      risk
                    </p>
                  </div>
                  <div className="rounded-xl border border-red-100 bg-red-50 px-2.5 py-2.5 sm:px-3">
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-red-700">
                      <IoTrendingUpOutline /> Riskiest
                    </div>
                    <p className="text-lg font-black text-red-800 sm:text-xl">
                      #{wingoAnalysis.riskiest}
                    </p>
                    <p className="truncate text-[10px] text-red-700/80">
                      ₹
                      {Math.round(
                        wingoAnalysis.byNumber[wingoAnalysis.riskiest]?.liability ?? 0
                      ).toLocaleString("en-IN")}{" "}
                      risk
                    </p>
                  </div>
                </div>
                <AdminBarChart
                  title="Liability by number"
                  data={wingoAnalysis.byNumber.map((r) => ({
                    name: String(r.n),
                    liability: Math.round(r.liability),
                  }))}
                  xKey="name"
                  yKey="liability"
                  height={200}
                />
                {(wingoAnalysis.byColor.length > 0 ||
                  wingoAnalysis.bySize.length > 0) && (
                  <div className="mt-3 grid grid-cols-1 gap-3 text-[11px] sm:grid-cols-2 sm:gap-2">
                    <div className="min-w-0">
                      <p className="mb-1 font-bold text-slate-500">Colors</p>
                      {wingoAnalysis.byColor.map((c) => (
                        <div
                          key={c.name}
                          className="flex justify-between gap-2 border-b border-slate-50 py-0.5"
                        >
                          <span className="font-semibold">{c.name}</span>
                          <span className="shrink-0 tabular-nums">
                            ₹{c.amount.toLocaleString("en-IN")} · {c.count}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1 font-bold text-slate-500">Size</p>
                      {wingoAnalysis.bySize.map((c) => (
                        <div
                          key={c.name}
                          className="flex justify-between gap-2 border-b border-slate-50 py-0.5"
                        >
                          <span className="font-semibold">{c.name}</span>
                          <span className="shrink-0 tabular-nums">
                            ₹{c.amount.toLocaleString("en-IN")} · {c.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {meta.api === "k3" && (
              <AdminBarChart
                title="Stake exposure by sum"
                data={Array.from({ length: 16 }, (_, i) => {
                  const s = i + 3;
                  return { name: String(s), liability: Math.round(k3Analysis.sumLiab[s] ?? 0) };
                })}
                xKey="name"
                yKey="liability"
                height={220}
              />
            )}
            {(meta.api === "5d" || meta.api === "moto") && (
              <p className="text-xs text-slate-500 leading-relaxed">
                Total open stake <b>₹{totalBet.toLocaleString("en-IN")}</b> across {liveBetCount} bets.
                Use the live table for granular monitoring.
              </p>
            )}
          </Surface>

          <Surface title="Recent draws" className="admin-fade-up">
            {results.length === 0 && recent.filter((p) => p.resultNumber != null || p.dice1 != null).length === 0 ? (
              <EmptyBlock label="No results yet" />
            ) : (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {(results.length
                  ? results.slice(0, 12)
                  : recent.filter((p) => p.resultNumber != null || p.dice1 != null)
                ).map((r, idx) => {
                  const num =
                    typeof (r as PeriodRow).resultNumber === "number"
                      ? Number((r as PeriodRow).resultNumber)
                      : typeof (r as { resultNumber?: unknown }).resultNumber === "string"
                        ? Number(String((r as { resultNumber?: string }).resultNumber).slice(-1))
                        : (r as PeriodRow).dice1 ?? null;
                  return (
                    <div
                      key={String((r as { id?: string }).id ?? idx)}
                      className="shrink-0 w-[72px] rounded-xl border border-slate-100 bg-white p-2 text-center shadow-sm"
                    >
                      {num != null && !Number.isNaN(num) && meta.api !== "k3" ? (
                        <div className="relative mx-auto h-10 w-10">
                          <Image
                            src={BALL_SRC[Number(num) % 10] ?? BALL_SRC[0]!}
                            alt=""
                            fill
                            sizes="40px"
                            className="object-contain"
                          />
                        </div>
                      ) : meta.api === "k3" && (r as PeriodRow).dice1 ? (
                        <div className="flex justify-center gap-0.5">
                          {[
                            (r as PeriodRow).dice1,
                            (r as PeriodRow).dice2,
                            (r as PeriodRow).dice3,
                          ].map((d, i) =>
                            d ? (
                              <div key={i} className="relative h-5 w-5">
                                <Image src={DICE_SRC[d]!} alt="" fill sizes="20px" className="object-contain" />
                              </div>
                            ) : null
                          )}
                        </div>
                      ) : (
                        <div
                          className="mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white"
                          style={{ background: NUM_COLOR[Number(num) % 10] ?? "#64748b" }}
                        >
                          {String(num ?? "?")}
                        </div>
                      )}
                      <p className="mt-1 truncate font-mono text-[8px] text-slate-400">
                        {String((r as PeriodRow).periodNumber ?? "").slice(-6)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Surface>
        </div>
      </div>

      {/* Distribution table */}
      <Surface
        title="Bet distribution"
        className="mt-4"
        action={
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Live · 2 sec
          </span>
        }
      >
        {liveDistribution.length === 0 ? (
          <EmptyBlock />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Choice / type</th>
                  <th>Bets</th>
                  <th>Stake</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {liveDistribution
                  .map((row) => ({
                    choice: `${row.betType} · ${row.betChoice}`,
                    count: row.betCount,
                    amount: row.amount,
                  }))
                  .map((r) => (
                    <tr key={r.choice}>
                      <td className="font-semibold">{r.choice}</td>
                      <td>{r.count}</td>
                      <td>₹{r.amount.toLocaleString("en-IN")}</td>
                      <td>
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{
                                width: `${totalBet ? Math.min(100, (r.amount / totalBet) * 100) : 0}%`,
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500 w-10 text-right">
                            {totalBet ? Math.round((r.amount / totalBet) * 100) : 0}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>

      <Surface
        title="Live bets"
        className="mt-4"
        action={
          liveBetCount > liveRows.length ? (
            <span className="text-[10px] font-semibold text-slate-400">
              Newest {liveRows.length} of {liveBetCount}
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-emerald-600">
              Refreshing every 2 sec
            </span>
          )
        }
      >
        {liveRows.length === 0 ? (
          <EmptyBlock label="No open bets this period" />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Bet ID</th>
                  <th>Type</th>
                  <th>Choice</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Placed</th>
                </tr>
              </thead>
              <tbody>
                {liveRows.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <AdminUserCell user={b.user} bank={b.user.bank} showHub />
                    </td>
                    <td className="font-mono text-[11px]">
                      {b.id.slice(0, 8)}…
                    </td>
                    <td>{String(b.betType ?? "—")}</td>
                    <td className="font-bold">{String(b.betChoice ?? "—")}</td>
                    <td>₹{Number(b.betAmount ?? 0).toLocaleString("en-IN")}</td>
                    <td>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        {String(b.status ?? "OPEN")}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-[11px] text-slate-500">
                      {formatIstDateTime(b.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
    </div>
  );
}
