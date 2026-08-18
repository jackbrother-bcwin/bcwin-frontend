"use client";

import { asset } from "../lib/cdn";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  IoChevronBack,
  IoTimeOutline,
  IoDocumentTextOutline,
} from "react-icons/io5";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./ui/Toast";
import * as api from "../lib/api";
import type { SpinDepositRule, SpinHistoryItem } from "../lib/api";
import { formatINR } from "../lib/format";
import { useSpaBackClose } from "../hooks/useSpaBackClose";

interface Props {
  onBack: () => void;
  onNavigate?: (screen: string) => void;
  variant?: "daily" | "invite";
}

/**
 * Clockwise from top under the gold selector.
 * Amounts MUST match backend WHEEL_AMOUNTS / LuckySpinReward seed.
 * Win amount always equals the label on the stopped slice.
 */
const PRIZES: ReadonlyArray<{ amount: number; label: string; icon: "coin" | "money" }> = [
  { amount: 10, label: "₹10", icon: "coin" },
  { amount: 19, label: "₹19", icon: "coin" },
  { amount: 29, label: "₹29", icon: "coin" },
  { amount: 100, label: "₹100", icon: "money" },
  { amount: 299, label: "₹299", icon: "money" },
  { amount: 439, label: "₹439", icon: "coin" },
  { amount: 66, label: "₹66", icon: "coin" },
  { amount: 199, label: "₹199", icon: "money" },
];

const ASSET = {
  bg: asset("/assets/invitewheel/bg.webp"),
  turntable: asset("/assets/invitewheel/turntable.webp"),
  pointer: asset("/assets/invitewheel/pointer.webp"),
  startBtn: asset("/assets/invitewheel/start_btn.webp"),
  light: asset("/assets/invitewheel/light.webp"),
  money2: asset("/assets/invitewheel/money2.webp"),
  startGif: asset("/assets/invitewheel/start.gif"),
  animateGif: asset("/assets/invitewheel/animate.gif"),
} as const;

const SPIN_MS = 5200;

type SpinView = "main" | "rules" | "history";

/** Exact slice for a win amount (never nearest-guess). */
function prizeIndexExact(amount: number): number {
  const n = Number(amount);
  const idx = PRIZES.findIndex((p) => p.amount === n);
  return idx >= 0 ? idx : 0;
}

/**
 * Prefer server sliceIndex (source of truth); fall back to exact amount match.
 */
function resolveSliceIndex(amount: number, sliceIndex?: number): number {
  if (
    typeof sliceIndex === "number" &&
    Number.isInteger(sliceIndex) &&
    sliceIndex >= 0 &&
    sliceIndex < PRIZES.length &&
    PRIZES[sliceIndex]!.amount === Number(amount)
  ) {
    return sliceIndex;
  }
  return prizeIndexExact(amount);
}

function rotationForIndex(index: number, fullTurns: number, current: number): number {
  const n = PRIZES.length;
  const slice = 360 / n;
  // Slice i is centered at i * slice when disk rotation = 0
  const centerFromTop = index * slice;
  // Bring that center under the fixed top pointer
  const targetMod = (360 - centerFromTop) % 360;
  const base = Math.ceil(current / 360) * 360;
  return base + fullTurns * 360 + targetMod;
}

function formatBalance(n: number | undefined | null): string {
  if (n == null || Number.isNaN(Number(n))) return "₹0.000";
  return `₹${Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}`;
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function FloatCoin({ className }: { className: string }) {
  return (
    <span className={`iw-coin ${className}`} aria-hidden>
      <span className="iw-coin__face" />
      <span className="iw-coin__shine" />
    </span>
  );
}

/**
 * Production spin wheel — stage + navbar (rules / history) + live API.
 */
export default function SpinPage({
  onBack,
  onNavigate,
  variant = "invite",
}: Props) {
  const { user, refreshUser, applyBalance } = useAuth();
  const { toast } = useToast();

  const [availableSpins, setAvailableSpins] = useState(0);
  const [dailyDeposit, setDailyDeposit] = useState(0);
  const [freeSpinsPerDay, setFreeSpinsPerDay] = useState(0);
  const [rules, setRules] = useState<SpinDepositRule[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [showWin, setShowWin] = useState(false);
  useSpaBackClose(showWin, () => setShowWin(false), "spin-win");
  const [highlight, setHighlight] = useState<number | null>(null);

  const [view, setView] = useState<SpinView>("main");
  const [history, setHistory] = useState<SpinHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);

  const rotationRef = useRef(0);
  const spinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.getSpinStatus();
      const d = res.data;
      setAvailableSpins(Number(d?.availableSpins ?? 0));
      setDailyDeposit(Number(d?.dailyCumulativeDeposit ?? 0));
      setFreeSpinsPerDay(Number(d?.freeSpinsPerDay ?? 0));
      setRules(Array.isArray(d?.rules) ? d.rules : []);
    } catch {
      /* guest / offline */
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.getSpinHistory({ page: 1, limit: 50 });
      setHistory(Array.isArray(res.data) ? res.data : []);
      setHistoryTotal(Number(res.total ?? 0));
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load history", "error");
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadStatus();
    return () => {
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    };
  }, [loadStatus]);

  useEffect(() => {
    if (view === "history") void loadHistory();
  }, [view, loadHistory]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
  }, [view]);

  const handleSpin = useCallback(async () => {
    if (spinning || loadingStatus) return;
    if (availableSpins <= 0) {
      toast(
        variant === "invite"
          ? "Invite friends or deposit to get more spins"
          : "No spins left — deposit to unlock more",
        "info"
      );
      return;
    }

    setSpinning(true);
    setLastWin(null);
    setShowWin(false);
    setHighlight(null);

    try {
      const res = await api.spinWheel();
      const amount = Number(res.data.amount ?? 0);
      // Land exactly on the slice that shows this amount
      const idx = resolveSliceIndex(amount, res.data.sliceIndex);
      const fullTurns = 6 + Math.floor(Math.random() * 3);
      const next = rotationForIndex(idx, fullTurns, rotationRef.current);
      rotationRef.current = next;
      setRotation(next);
      setHighlight(idx);

      if (typeof res.data.availableSpins === "number") {
        setAvailableSpins(res.data.availableSpins);
      } else {
        setAvailableSpins((s) => Math.max(0, s - 1));
      }

      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
      spinTimerRef.current = setTimeout(() => {
        setLastWin(amount);
        setShowWin(true);
        setSpinning(false);
        if (typeof res.data.newBalance === "number") {
          applyBalance(res.data.newBalance);
        } else {
          void refreshUser();
        }
        toast(`You won ${formatINR(amount)}!`, "success");
        // refresh history cache quietly if sheet was opened before
        void loadHistory().catch(() => undefined);
      }, SPIN_MS);
    } catch (e: unknown) {
      setSpinning(false);
      toast(e instanceof Error ? e.message : "Spin failed", "error");
      void loadStatus();
    }
  }, [
    spinning,
    loadingStatus,
    availableSpins,
    variant,
    applyBalance,
    refreshUser,
    toast,
    loadStatus,
    loadHistory,
  ]);

  const goCashOut = () => onNavigate?.("withdraw") ?? onNavigate?.("wallet");
  const goBottomCta = () =>
    variant === "invite" ? onNavigate?.("promotion") : onNavigate?.("deposit");

  const spinsLabel = loadingStatus ? "…" : String(availableSpins);
  const title = "Invite Wheel";

  /** Cumulative extras for rules table display */
  const rulesWithRunning = rules.reduce<
    Array<SpinDepositRule & { totalExtra: number }>
  >((acc, r) => {
    const prev = acc.length ? acc[acc.length - 1]!.totalExtra : 0;
    acc.push({ ...r, totalExtra: prev + r.spinChances });
    return acc;
  }, []);

  /* ── Full-page: Rules ── */
  if (view === "rules") {
    return (
      <div className="iw-page">
        <header className="iw__nav">
          <div className="iw__nav-inner">
            <button
              type="button"
              className="iw__back"
              onClick={() => setView("main")}
              aria-label="Back"
            >
              <IoChevronBack size={22} />
            </button>
            <h1 className="iw__nav-title">Rules</h1>
            <div className="iw__nav-actions iw__nav-actions--end">
              <span className="iw__nav-balance" aria-hidden>
                {formatBalance(user?.balance)}
              </span>
            </div>
          </div>
        </header>
        <div className="iw-page__scroll">
          <ol className="iw-rules">
            <li>
              {freeSpinsPerDay > 0 ? (
                <>
                  You get <strong>{freeSpinsPerDay}</strong> free spin
                  {freeSpinsPerDay === 1 ? "" : "s"} every day.
                </>
              ) : (
                <>
                  There are <strong>no free daily spins</strong>. Spins unlock only
                  from deposits.
                </>
              )}
            </li>
            <li>
              Spins unlock from <strong>today&apos;s cumulative deposits</strong>.
              Tiers stack (each threshold adds more spins).
            </li>
            <li>Winnings are credited to your balance immediately after the spin.</li>
            <li>Spins and deposit progress reset daily — unused spins do not carry over.</li>
            {variant === "invite" && (
              <li>Invite friends to grow your team — more play means more deposit progress.</li>
            )}
          </ol>

          <div className="iw-rules__stat">
            <span>Today&apos;s deposits</span>
            <strong>{formatINR(dailyDeposit)}</strong>
          </div>
          <div className="iw-rules__stat">
            <span>Spins left</span>
            <strong>X{availableSpins}</strong>
          </div>

          <h3 className="iw-rules__h">Deposit → extra spins</h3>
          {rulesWithRunning.length === 0 ? (
            <p className="iw-rules__empty">No deposit rules configured yet.</p>
          ) : (
            <table className="iw-rules__table">
              <thead>
                <tr>
                  <th>Deposit ≥</th>
                  <th>+Spins</th>
                  <th>Total extras</th>
                </tr>
              </thead>
              <tbody>
                {rulesWithRunning.map((r) => (
                  <tr
                    key={r.minDeposit}
                    className={dailyDeposit >= r.minDeposit ? "is-met" : undefined}
                  >
                    <td>{formatINR(r.minDeposit, 0)}</td>
                    <td>+{r.spinChances}</td>
                    <td>{r.totalExtra}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 className="iw-rules__h">Prize pool</h3>
          <div className="iw-rules__prizes">
            {PRIZES.map((p) => (
              <span key={p.label} className="iw-rules__chip">
                {p.label}
              </span>
            ))}
          </div>

          <button
            type="button"
            className="iw-page__cta"
            onClick={() => {
              setView("main");
              onNavigate?.("deposit");
            }}
          >
            Deposit now
          </button>
        </div>
      </div>
    );
  }

  /* ── Full-page: History ── */
  if (view === "history") {
    return (
      <div className="iw-page">
        <header className="iw__nav">
          <div className="iw__nav-inner">
            <button
              type="button"
              className="iw__back"
              onClick={() => setView("main")}
              aria-label="Back"
            >
              <IoChevronBack size={22} />
            </button>
            <h1 className="iw__nav-title">History</h1>
            <div className="iw__nav-actions iw__nav-actions--end">
              <span className="iw__nav-balance" aria-hidden>
                {formatBalance(user?.balance)}
              </span>
            </div>
          </div>
        </header>
        <div className="iw-page__scroll">
          {historyLoading ? (
            <p className="iw-rules__empty">Loading…</p>
          ) : history.length === 0 ? (
            <div className="iw-hist-empty">
              <p>No spins yet</p>
              <span>Win history shows here after you spin.</span>
              <button
                type="button"
                className="iw-page__cta"
                style={{ marginTop: 20 }}
                onClick={() => setView("main")}
              >
                Go spin
              </button>
            </div>
          ) : (
            <>
              <p className="iw-hist-meta">
                {historyTotal} win{historyTotal === 1 ? "" : "s"}
              </p>
              <ul className="iw-hist">
                {history.map((h) => (
                  <li key={h.id} className="iw-hist__row">
                    <div className="iw-hist__row-left">
                      <span className="iw-hist__icon" aria-hidden>
                        ₹
                      </span>
                      <div>
                        <span className="iw-hist__label">Invite Wheel</span>
                        <time className="iw-hist__when">
                          {formatWhen(h.claimAt ?? h.createdAt)}
                        </time>
                      </div>
                    </div>
                    <span className="iw-hist__amt">+{formatINR(h.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ── Main wheel ── */
  return (
    <div className="iw">
      <div className="iw__bg" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ASSET.bg} alt="" className="iw__bg-asset" draggable={false} />
        <div className="iw__bg-wash" />
        <div className="iw__bg-vignette" />
      </div>

      {/* ── App-theme navbar ── */}
      <header className="iw__nav">
        <div className="iw__nav-inner">
          <button type="button" className="iw__back" onClick={onBack} aria-label="Back">
            <IoChevronBack size={22} />
          </button>
          <h1 className="iw__nav-title">{title}</h1>
          <div className="iw__nav-actions">
            <button
              type="button"
              className="iw__nav-balance"
              onClick={goCashOut}
              aria-label="Wallet balance"
            >
              {formatBalance(user?.balance)}
            </button>
            <button
              type="button"
              className="iw__nav-btn"
              onClick={() => setView("history")}
              aria-label="Spin history"
              title="History"
            >
              <IoTimeOutline size={18} />
            </button>
            <button
              type="button"
              className="iw__nav-btn"
              onClick={() => setView("rules")}
              aria-label="Spin rules"
              title="Rules"
            >
              <IoDocumentTextOutline size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="iw__body">
        <section className="iw__hero">
          <p className="iw__my-amount">
            Free spins<span className="iw__my-x"> (X{spinsLabel})</span>
          </p>
          <button type="button" className="iw__cashout" onClick={goCashOut}>
            <span>CASH OUT</span>
          </button>
        </section>

        <section className="iw__arena">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ASSET.light} alt="" className="iw__bloom" draggable={false} aria-hidden />

          <FloatCoin className="iw-coin--a" />
          <FloatCoin className="iw-coin--b" />
          <FloatCoin className="iw-coin--c" />
          <FloatCoin className="iw-coin--d" />
          <FloatCoin className="iw-coin--e" />
          <FloatCoin className="iw-coin--f" />

          <div className="iw__pedestal" aria-hidden />

          <div className="iw__wheel">
            <div
              className={`iw__disk${spinning ? " is-spinning" : ""}`}
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning
                  ? `transform ${SPIN_MS}ms cubic-bezier(0.08, 0.82, 0.12, 1)`
                  : "none",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ASSET.turntable}
                alt=""
                className="iw__turntable"
                draggable={false}
              />

              {PRIZES.map((prize, i) => {
                const slice = 360 / PRIZES.length;
                const mid = i * slice;
                const isWin = highlight === i && !spinning;
                return (
                  <div
                    key={prize.label}
                    className={`iw__wedge${isWin ? " is-win" : ""}`}
                    style={{ transform: `rotate(${mid}deg)` }}
                  >
                    <div className="iw__prize">
                      <span className="iw__prize-label">{prize.label}</span>
                      {prize.icon === "money" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={ASSET.money2}
                          alt=""
                          className="iw__prize-money"
                          draggable={false}
                        />
                      ) : (
                        <span className="iw__prize-coins" aria-hidden>
                          <i />
                          <i />
                          <i />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ASSET.pointer}
              alt=""
              className="iw__selector"
              draggable={false}
              aria-hidden
            />

            <button
              type="button"
              className={`iw__hub${spinning ? " is-spinning" : ""}`}
              onClick={handleSpin}
              disabled={spinning || loadingStatus}
              aria-label={
                spinning
                  ? "Spinning"
                  : availableSpins > 0
                    ? "Spin the wheel"
                    : "No spins left"
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={spinning ? ASSET.startGif : ASSET.startBtn}
                alt=""
                className="iw__hub-art"
                draggable={false}
              />
              <span className="iw__hub-copy">
                <strong className="iw__hub-x">X{spinsLabel}</strong>
                <em className="iw__hub-free">
                  {availableSpins > 0 ? "SPIN" : "NO SPIN"}
                </em>
              </span>
            </button>
          </div>
        </section>

        <div className="iw__footer">
          <button type="button" className="iw__invite" onClick={goBottomCta}>
            {variant === "invite"
              ? "INVITE FRIENDS TO GET SPIN"
              : "DEPOSIT TO GET MORE SPINS"}
          </button>
        </div>
      </div>

      {/* ── Win modal ── */}
      {showWin && lastWin != null && (
        <div
          className="iw__modal"
          role="dialog"
          aria-modal="true"
          aria-label="Spin result"
          onClick={() => setShowWin(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ASSET.animateGif}
            alt=""
            className="iw__modal-fx"
            draggable={false}
            aria-hidden
          />
          <div className="iw__modal-card" onClick={(e) => e.stopPropagation()}>
            <p className="iw__modal-kicker">Congratulations</p>
            <p className="iw__modal-title">You won!</p>
            <p className="iw__modal-amt">{formatINR(lastWin)}</p>
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
