"use client";

/**
 * Lucky Spin — wired to /user/activity/lucky-spin (rupee prizes only).
 * iPhone slice is visual only; BE never awards physical prizes.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IoChevronBack,
  IoHelpCircleOutline,
  IoDocumentTextOutline,
  IoStarOutline,
  IoRefresh,
  IoClose,
} from "react-icons/io5";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./ui/Toast";
import * as api from "../lib/api";
import type { SpinDepositRule, SpinHistoryItem } from "../lib/api";
import { formatINR } from "../lib/format";

interface Props {
  onBack: () => void;
  onNavigate?: (screen: string) => void;
}

const ASSET = {
  banner: "/assets/luckyspin/banner.png",
  wheel: "/assets/luckyspin/wheel.png",
  go: "/assets/luckyspin/go.png",
  iphone: "/assets/png/iphone14-a3ffcac4.png",
} as const;

/**
 * Clockwise from top under GO pointer.
 * Index 0 = iPhone (show only). Cash slices match BE LUCKY_CASH sliceIndex.
 */
type FacePrize =
  | { kind: "phone"; label: string }
  | { kind: "cash"; amount: number; label: string };

const FACE: readonly FacePrize[] = [
  { kind: "phone", label: "iPhone 17 Pro" },
  { kind: "cash", amount: 50, label: "₹50" },
  { kind: "cash", amount: 5000, label: "₹5,000" },
  { kind: "cash", amount: 10, label: "₹10" },
  { kind: "cash", amount: 2, label: "₹2" },
  { kind: "cash", amount: 100, label: "₹100" },
  { kind: "cash", amount: 1000, label: "₹1,000" },
  { kind: "cash", amount: 5, label: "₹5" },
];

const SPIN_MS = 4800;

type View = "main" | "rules" | "details" | "description";

function formatBalance(n: number | undefined | null): string {
  if (n == null || Number.isNaN(Number(n))) return "₹0.000";
  return `₹${Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}`;
}

function rotationForIndex(
  index: number,
  fullTurns: number,
  current: number
): number {
  const n = FACE.length;
  const slice = 360 / n;
  const centerFromTop = index * slice;
  const targetMod = (360 - centerFromTop) % 360;
  const base = Math.ceil(current / 360) * 360;
  return base + fullTurns * 360 + targetMod;
}

function resolveSlice(amount: number, sliceIndex?: number): number {
  if (
    typeof sliceIndex === "number" &&
    sliceIndex >= 0 &&
    sliceIndex < FACE.length
  ) {
    const face = FACE[sliceIndex];
    if (face?.kind === "cash" && face.amount === amount) return sliceIndex;
  }
  const idx = FACE.findIndex(
    (p) => p.kind === "cash" && p.amount === Number(amount)
  );
  return idx >= 0 ? idx : 4; // fallback ₹2
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function LuckySpinPage({ onBack, onNavigate }: Props) {
  const { user, applyBalance, refreshUser } = useAuth();
  const { toast } = useToast();

  const [view, setView] = useState<View>("main");
  const [spinsLeft, setSpinsLeft] = useState(0);
  const [totalRecharge, setTotalRecharge] = useState(0);
  const [rules, setRules] = useState<SpinDepositRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [winAmount, setWinAmount] = useState<number | null>(null);
  const [showWin, setShowWin] = useState(false);
  const [history, setHistory] = useState<SpinHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const rotationRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.getLuckySpinStatus();
      setSpinsLeft(Number(res.data?.availableSpins ?? 0));
      setTotalRecharge(Number(res.data?.dailyCumulativeDeposit ?? 0));
      setRules(Array.isArray(res.data?.rules) ? res.data.rules : []);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load spin status", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.getLuckySpinHistory({ page: 1, limit: 30 });
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    void loadHistory();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [loadStatus, loadHistory]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
  }, [view]);

  const handleSpin = useCallback(async () => {
    if (spinning || loading) return;
    if (spinsLeft <= 0) {
      toast("No spins left — recharge to earn more", "info");
      return;
    }

    setSpinning(true);
    setShowWin(false);
    setWinAmount(null);
    setHighlight(null);

    try {
      const res = await api.luckySpinWheel();
      const amount = Number(res.data.amount ?? 0);
      const idx = resolveSlice(amount, res.data.sliceIndex);
      const fullTurns = 5 + Math.floor(Math.random() * 3);
      const next = rotationForIndex(idx, fullTurns, rotationRef.current);
      rotationRef.current = next;
      setRotation(next);
      setHighlight(idx);

      if (typeof res.data.availableSpins === "number") {
        setSpinsLeft(res.data.availableSpins);
      } else {
        setSpinsLeft((s) => Math.max(0, s - 1));
      }

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setSpinning(false);
        setWinAmount(amount);
        setShowWin(true);
        if (typeof res.data.newBalance === "number") {
          applyBalance(res.data.newBalance);
        } else {
          void refreshUser();
        }
        toast(`You won ${formatINR(amount)}!`, "success");
        void loadHistory();
      }, SPIN_MS);
    } catch (e: unknown) {
      setSpinning(false);
      toast(e instanceof Error ? e.message : "Spin failed", "error");
      void loadStatus();
    }
  }, [
    spinning,
    loading,
    spinsLeft,
    toast,
    applyBalance,
    refreshUser,
    loadHistory,
    loadStatus,
  ]);

  const rulesWithRunning = rules.reduce<
    Array<SpinDepositRule & { totalExtra: number }>
  >((acc, r) => {
    const prev = acc.length ? acc[acc.length - 1]!.totalExtra : 0;
    acc.push({ ...r, totalExtra: prev + r.spinChances });
    return acc;
  }, []);

  const rulesBody = useMemo(
    () => (
      <div className="ls-doc">
        <h3>How to get spins</h3>
        <ul>
          <li>Recharge during the event to unlock lucky spins.</li>
          <li>Today&apos;s total recharge is tracked above — tiers stack.</li>
          <li>Unused spins reset with the event day.</li>
        </ul>
        <h3>Prizes</h3>
        <ul>
          <li>All real prizes are <strong>cash (₹)</strong> credited to your wallet.</li>
          <li>
            The iPhone on the wheel is <strong>decorative only</strong> — not awarded.
          </li>
          {FACE.filter((p) => p.kind === "cash").map((p) => (
            <li key={p.label}>{p.label}</li>
          ))}
        </ul>
        {rulesWithRunning.length > 0 && (
          <>
            <h3>Recharge → spins</h3>
            <ul>
              {rulesWithRunning.map((r) => (
                <li key={r.minDeposit}>
                  Deposit ≥ {formatINR(r.minDeposit, 0)} → +{r.spinChances} spin
                  {r.spinChances === 1 ? "" : "s"} (total extras {r.totalExtra})
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    ),
    [rulesWithRunning]
  );

  if (view === "description") {
    return (
      <div className="ls-page">
        <header className="ls-nav">
          <div className="ls-nav__inner">
            <button
              type="button"
              className="ls-nav__back"
              onClick={() => setView("main")}
              aria-label="Back"
            >
              <IoChevronBack size={22} />
            </button>
            <h1 className="ls-nav__title">Event Description</h1>
            <div className="ls-nav__spacer" />
          </div>
        </header>

        <div className="ls-page__scroll flex flex-col gap-3.5 p-3.5 max-w-[430px] mx-auto w-full">
          {/* Card 1: Activity time */}
          <div className="rounded-xl bg-[#221b22] border border-white/5 overflow-hidden shadow-md">
            <div className="flex items-center gap-2 px-4 py-3 bg-[#2f242e] border-b border-white/5">
              <span className="text-[#fed358] text-[12px] font-black">▶</span>
              <h2 className="text-[15px] font-bold text-[#fed358]">Activity time</h2>
            </div>
            <div className="p-4 text-[13px] text-[#fde4bc] font-medium">
              From now on
            </div>
          </div>

          {/* Card 2: Validity period */}
          <div className="rounded-xl bg-[#221b22] border border-white/5 overflow-hidden shadow-md">
            <div className="flex items-center gap-2 px-4 py-3 bg-[#2f242e] border-b border-white/5">
              <span className="text-[#fed358] text-[12px] font-black">▶</span>
              <h2 className="text-[15px] font-bold text-[#fed358]">Validity period</h2>
            </div>
            <div className="p-4 text-[13px] text-[#fde4bc] font-medium">
              Official website notification shall prevail
            </div>
          </div>

          {/* Card 3: Red Notice */}
          <div className="rounded-xl bg-[#221b22] border border-white/5 p-4 shadow-md">
            <p className="text-[13px] font-bold text-[#f44336] leading-relaxed">
              Members whose single deposit amount or accumulated deposit amount reaches the set amount can participate in the lottery..
            </p>
          </div>

          {/* Card 4: Conditions of participation */}
          <div className="rounded-xl bg-[#221b22] border border-white/5 overflow-hidden shadow-md">
            <div className="flex items-center gap-2 px-4 py-3 bg-[#2f242e] border-b border-white/5">
              <span className="text-[#fed358] text-[12px] font-black">▶</span>
              <h2 className="text-[15px] font-bold text-[#fed358]">Conditions of participation</h2>
            </div>
            <div className="p-4 text-[13px] text-[#b79c8b] leading-relaxed font-medium">
              Members who meet the requirements for{" "}
              <span className="text-[#f44336] font-bold">
                Vip0, Vip1, Vip2, Vip3, Vip4, Vip5, Vip6, Vip7, Vip8, Vip9, Vip10
              </span>{" "}
              are eligible to participate in the Wheel Spin event. Members must bind a bank card before joining. Stand a chance to win hundreds of millions in cash and many other exciting prizes. Get ready for daily surprises and amazing rewards!
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "details") {
    return (
      <ActivityDetailsView
        onBack={() => setView("main")}
        rules={rules}
      />
    );
  }

  if (view === "rules") {
    return (
      <ActivityRulesView
        onBack={() => setView("main")}
      />
    );
  }

  return (
    <div className="ls">
      <header className="ls-nav">
        <div className="ls-nav__inner">
          <button type="button" className="ls-nav__back" onClick={onBack} aria-label="Back">
            <IoChevronBack size={22} />
          </button>
          <h1 className="ls-nav__title">Lucky Spin</h1>
          <div className="ls-nav__actions">
            <span className="ls-nav__bal">{formatBalance(user?.balance)}</span>
          </div>
        </div>
      </header>

      <div className="ls__scroll">
        <div className="ls-banner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ASSET.banner} alt="" className="ls-banner__img" draggable={false} />
          <div className="ls-banner__shine" aria-hidden />
        </div>

        <section className="ls-today">
          <h2 className="ls-today__title">Today</h2>
          <div className="ls-today__row">
            <span className="ls-today__label">Total Recharge</span>
            <div className="ls-today__value-wrap">
              <span className="ls-today__pill">{formatINR(totalRecharge)}</span>
              <button
                type="button"
                className="ls-today__refresh"
                onClick={() => void loadStatus()}
                aria-label="Refresh"
              >
                <IoRefresh size={16} />
              </button>
            </div>
          </div>
          <div className="ls-today__row">
            <span className="ls-today__label">Number of spins</span>
            <span className="ls-today__spins">
              <em>{loading ? "…" : spinsLeft}</em>
            </span>
          </div>
        </section>

        <section className="ls-arena">
          <div className="ls-wheel">
            <div
              className="ls-wheel__disk"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning
                  ? `transform ${SPIN_MS}ms cubic-bezier(0.08, 0.82, 0.12, 1)`
                  : "none",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ASSET.wheel} alt="" className="ls-wheel__bg" draggable={false} />
              {FACE.map((prize, i) => {
                const mid = i * (360 / FACE.length);
                const isWin = highlight === i && !spinning;
                return (
                  <div
                    key={`${prize.label}-${i}`}
                    className={`ls-wedge${isWin ? " is-win" : ""}`}
                    style={{ transform: `rotate(${mid}deg)` }}
                  >
                    <div
                      className="ls-prize"
                      style={{ transform: `rotate(${-mid}deg)` }}
                    >
                      {prize.kind === "phone" ? (
                        <>
                          <span className="ls-prize__phone-label">{prize.label}</span>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={ASSET.iphone}
                            alt=""
                            className="ls-prize__phone"
                            draggable={false}
                          />
                        </>
                      ) : (
                        <>
                          <span className="ls-prize__cash">{prize.label}</span>
                          <span className="ls-prize__coin" aria-hidden>
                            ₹
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className={`ls-go${spinning ? " is-spinning" : ""}`}
              onClick={() => void handleSpin()}
              disabled={spinning || loading}
              aria-label={spinning ? "Spinning" : "Spin the wheel"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ASSET.go} alt="GO" className="ls-go__img" draggable={false} />
            </button>
          </div>
        </section>

        <nav className="ls-links" aria-label="Event links">
          <button type="button" className="ls-link" onClick={() => setView("description")}>
            <span className="ls-link__icon">
              <IoHelpCircleOutline size={22} />
            </span>
            <span>Event Description</span>
          </button>
          <button type="button" className="ls-link" onClick={() => setView("details")}>
            <span className="ls-link__icon">
              <IoDocumentTextOutline size={22} />
            </span>
            <span>Event Details</span>
          </button>
          <button type="button" className="ls-link" onClick={() => setView("rules")}>
            <span className="ls-link__icon">
              <IoStarOutline size={22} />
            </span>
            <span>Activity Rules</span>
          </button>
        </nav>

        <section className="ls-hist">
          <h2 className="ls-hist__title">
            <span className="ls-hist__mark" aria-hidden />
            History
          </h2>
          <div className="ls-hist__table">
            <div className="ls-hist__head">
              <span>Spin time</span>
              <span>Reward type</span>
              <span>Prize</span>
            </div>
            {historyLoading ? (
              <div className="ls-hist__empty">
                <p>Loading…</p>
              </div>
            ) : history.length === 0 ? (
              <div className="ls-hist__empty">
                <p>No data</p>
                <span>Spin the wheel to see wins here</span>
              </div>
            ) : (
              <ul className="ls-hist__list">
                {history.map((h) => (
                  <li key={h.id} className="ls-hist__row">
                    <span>{formatWhen(h.claimAt ?? h.createdAt)}</span>
                    <span>Cash</span>
                    <span className="ls-hist__prize">{formatINR(h.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* ── Win modal ── */}
      {showWin && winAmount != null && (
        <div
          className="iw__modal"
          role="dialog"
          aria-modal="true"
          aria-label="Spin result"
          onClick={() => setShowWin(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/invitewheel/animate.gif"
            alt=""
            className="iw__modal-fx"
            draggable={false}
            aria-hidden
          />
          <div className="iw__modal-card" onClick={(e) => e.stopPropagation()}>
            <p className="iw__modal-kicker">Congratulations</p>
            <p className="iw__modal-title">You won!</p>
            <p className="iw__modal-amt">{formatINR(winAmount)}</p>
            <p className="iw__modal-sub">Credited to your balance</p>
            <button
              type="button"
              className="iw__modal-btn"
              onClick={() => setShowWin(false)}
            >
              Collect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityDetailsView({
  onBack,
  rules,
}: {
  onBack: () => void;
  rules: SpinDepositRule[];
}) {
  const tiers = useMemo(() => {
    if (rules && rules.length > 0) {
      return rules;
    }
    return [
      { minDeposit: 200, spinChances: 1 },
      { minDeposit: 500, spinChances: 1 },
      { minDeposit: 1000, spinChances: 1 },
      { minDeposit: 2000, spinChances: 1 },
      { minDeposit: 5000, spinChances: 1 },
      { minDeposit: 10000, spinChances: 2 },
      { minDeposit: 30000, spinChances: 3 },
      { minDeposit: 50000, spinChances: 5 },
      { minDeposit: 100000, spinChances: 5 },
    ];
  }, [rules]);

  return (
    <div className="ls-page">
      <header className="ls-nav">
        <div className="ls-nav__inner">
          <button
            type="button"
            className="ls-nav__back"
            onClick={onBack}
            aria-label="Back"
          >
            <IoChevronBack size={22} />
          </button>
          <h1 className="ls-nav__title">Activity details</h1>
          <div className="ls-nav__spacer" />
        </div>
      </header>

      <div className="ls-page__scroll flex flex-col gap-4 p-3.5 max-w-[430px] mx-auto w-full pb-10">
        {/* Table Container */}
        <div className="rounded-xl overflow-hidden border border-white/10 shadow-lg bg-[#181318]">
          {/* Header */}
          <div className="grid grid-cols-3 text-center py-2.5 px-2 bg-gradient-to-b from-[#d97706] to-[#b45309] text-white text-[13px] font-extrabold tracking-wide">
            <div>Task</div>
            <div>Number of spins</div>
            <div>Spin time</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/5">
            {tiers.map((row, idx) => (
              <div
                key={row.minDeposit}
                className={`grid grid-cols-3 items-center text-center py-2.5 px-2 text-[12px] ${
                  idx % 2 === 0 ? "bg-[#1d181c]" : "bg-[#251c19]"
                }`}
              >
                <div className="flex flex-col items-center">
                  <span className="text-[#f44336] font-extrabold">
                    {formatINR(row.minDeposit)}
                  </span>
                  <span className="text-[10px] text-[#b79c8b] font-medium">
                    Total Deposit
                  </span>
                </div>
                <div className="font-extrabold text-white text-[13px]">
                  +{row.spinChances}
                </div>
                <div className="text-[#b79c8b] font-medium text-[11px]">
                  00:00-23:59
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rules Card */}
        <div className="rounded-xl bg-[#221b22] border border-white/10 overflow-hidden shadow-lg relative pt-4 pb-5 px-4 flex flex-col gap-3.5">
          {/* Rules Header Badge */}
          <div className="w-[140px] h-7 mx-auto rounded-full bg-gradient-to-b from-[#d97706] to-[#b45309] flex items-center justify-center text-white text-[13px] font-black tracking-wide shadow-md">
            Rules
          </div>

          {/* Rule Items */}
          <div className="flex flex-col gap-3 text-[12px] text-[#b79c8b] leading-relaxed font-medium">
            <div className="flex items-start gap-1.5">
              <span className="text-[#fed358] text-[10px] mt-0.5">◆</span>
              <p>
                Members must reach the single deposit amount and cumulative deposit amount to be eligible to participate in the Wheel Spin
              </p>
            </div>

            <div className="flex items-start gap-1.5">
              <span className="text-[#fed358] text-[10px] mt-0.5">◆</span>
              <p>
                Conditions for withdrawal of wheel rewards:{" "}
                <span className="text-[#f44336] font-bold">
                  1 times turnover required.
                </span>
              </p>
            </div>

            <div className="flex items-start gap-1.5">
              <span className="text-[#fed358] text-[10px] mt-0.5">◆</span>
              <p>
                If you receive monetary rewards, there is no need to apply, the system will automatically add them to your member ID (please contact customer service to receive physical rewards)
              </p>
            </div>

            <div className="flex items-start gap-1.5">
              <span className="text-[#fed358] text-[10px] mt-0.5">◆</span>
              <p>
                The Wheel Spin round starts every morning at{" "}
                <span className="text-[#f44336] font-bold">00:00</span>. After making your deposit, you need to wait 5 minutes before the draw wheel starts.
              </p>
            </div>
          </div>

          {/* For Example Box */}
          <div className="rounded-lg bg-[#181318] p-3 border border-white/5 text-[11px] text-[#b79c8b] leading-relaxed">
            <p className="font-bold text-white mb-1">For example:</p>
            <p>
              If a member makes cumulative deposits reaching{" "}
              <span className="text-[#f44336] font-bold">₹100,000.00</span> on the same day, they will receive{" "}
              <span className="text-[#f44336] font-bold">5</span> lucky draw opportunities. The draw is valid for the same day and cannot be rolled over to the next day!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityRulesView({ onBack }: { onBack: () => void }) {
  return (
    <div className="ls-page">
      <header className="ls-nav">
        <div className="ls-nav__inner">
          <button
            type="button"
            className="ls-nav__back"
            onClick={onBack}
            aria-label="Back"
          >
            <IoChevronBack size={22} />
          </button>
          <h1 className="ls-nav__title">Activity Rules</h1>
          <div className="ls-nav__spacer" />
        </div>
      </header>

      <div className="ls-page__scroll flex flex-col gap-6 p-4 pt-6 max-w-[430px] mx-auto w-full pb-10">
        {/* Card 01 */}
        <div className="rounded-xl bg-[#221b22] border border-white/5 relative pt-7 pb-5 px-4 shadow-md">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#2d242c] border border-white/10 text-[#fed358] text-[12px] font-black px-4 py-0.5 rounded-full shadow">
            01
          </div>
          <p className="text-[13px] font-bold text-[#fde4bc] leading-relaxed mb-2">
            The event is effective from now on. The reward can only be claimed once per address, per email address, per phone number and for the same payment method (debit/credit card/bank account) and IP address;
          </p>
          <p className="text-[12px] text-[#b79c8b] leading-relaxed">
            If a member applies repeatedly, the company reserves the right to cancel or withdraw member bonuses.
          </p>
        </div>

        {/* Card 02 */}
        <div className="rounded-xl bg-[#221b22] border border-white/5 relative pt-7 pb-5 px-4 shadow-md">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#2d242c] border border-white/10 text-[#fed358] text-[12px] font-black px-4 py-0.5 rounded-full shadow">
            02
          </div>
          <p className="text-[13px] font-bold text-[#fde4bc] leading-relaxed mb-2">
            All offers are specially designed for players.
          </p>
          <p className="text-[12px] text-[#b79c8b] leading-relaxed">
            If any group or individual is found to be dishonestly withdrawing bonuses or threatening or abusing company offers, the company reserves the right to freeze or cancel the account and account balance of that group or individual.
          </p>
        </div>

        {/* Card 03 */}
        <div className="rounded-xl bg-[#221b22] border border-white/5 relative pt-7 pb-5 px-4 shadow-md">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#2d242c] border border-white/10 text-[#fed358] text-[12px] font-black px-4 py-0.5 rounded-full shadow">
            03
          </div>
          <p className="text-[13px] font-bold text-[#fde4bc] leading-relaxed mb-2">
            The platform reserves the right of final outcome of this event;
          </p>
          <p className="text-[12px] text-[#b79c8b] leading-relaxed">
            and the right to modify or terminate the campaign without prior notice; these terms apply to all offers.
          </p>
        </div>
      </div>
    </div>
  );
}
