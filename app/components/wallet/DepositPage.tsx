"use client";

/**
 * Deposit — Bcwin-style UI: methods grid, channels, quick amounts, history strip.
 * UPI family → CxPay (CXPAY); USDT → OxaPay (OXAPAY).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  IoChevronBack,
  IoRefresh,
  IoWalletOutline,
  IoCardOutline,
} from "react-icons/io5";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../ui/Toast";
import StatusBadge from "../ui/StatusBadge";
import LoadingSpinner from "../ui/LoadingSpinner";
import * as api from "../../lib/api";
import type { Deposit } from "../../lib/api";
import {
  formatDateTime,
  formatDepositAmount,
  formatDepositInrHint,
  formatINR,
  formatMoney,
  formatUSD,
} from "../../lib/format";
import {
  closeOpenedTab,
  navigateOpenedTab,
  openBlankTab,
  openSafeUrlDetailed,
  sanitizeAmount,
  sanitizeErrorMessage,
} from "../../lib/safe";
import {
  CHANNELS,
  PAY_METHODS,
  QUICK_AMOUNTS_INR,
  QUICK_AMOUNTS_USDT,
  RECHARGE_INSTRUCTIONS,
  formatAmountHint,
  formatQuickLabel,
  isUsdtMethod,
  type ChannelId,
  type PayUiId,
} from "./deposit/types";
import { TetherMark, UsdtTypeIcons } from "./UsdtTypeIcons";

interface Props {
  onBack: () => void;
  onNavigate?: (screen: string) => void;
}

type Tab = "deposit" | "history";

export default function DepositPage({ onBack, onNavigate }: Props) {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("deposit");
  const [methodId, setMethodId] = useState<PayUiId>("upi-x-qr");
  const [channelId, setChannelId] = useState<ChannelId>("phonepe_qr");
  /** Last quick-pick value (for highlight); field is always driven by `amountInput` */
  const [amount, setAmount] = useState(100);
  const [amountInput, setAmountInput] = useState("100");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPayUrl, setLastPayUrl] = useState<string | null>(null);

  const [history, setHistory] = useState<Deposit[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  /** 1 USDT → this many INR (admin `inrToUsdtPaymentConversionRate`) */
  const [usdtToInrRate, setUsdtToInrRate] = useState(105);
  /** Live admin recharge bonus % (defaults match backend Config) */
  const [usdtBonusPct, setUsdtBonusPct] = useState(5);
  const [inrBonusPct, setInrBonusPct] = useState(0);

  const payMethod = useMemo(
    () => PAY_METHODS.find((m) => m.id === methodId) ?? PAY_METHODS[0]!,
    [methodId]
  );
  const channel = CHANNELS[channelId] ?? CHANNELS.phonepe_qr;
  const isUsdt = isUsdtMethod(payMethod.apiMethod);
  const quickAmounts = isUsdt ? QUICK_AMOUNTS_USDT : QUICK_AMOUNTS_INR;
  const unit = isUsdt ? "usdt" : "inr";
  /** Active channel/method bonus % from admin config */
  const bonusPct = isUsdt ? usdtBonusPct : inrBonusPct;

  const finalAmount = useMemo(() => {
    const n = Number(amountInput);
    return Number.isFinite(n) ? n : 0;
  }, [amountInput]);

  /** INR wallet credit estimate for USDT amount (matches backend floor) */
  const usdtInrCredit = useMemo(() => {
    if (!isUsdt || finalAmount <= 0 || usdtToInrRate <= 0) return 0;
    return Math.floor(finalAmount * usdtToInrRate);
  }, [isUsdt, finalAmount, usdtToInrRate]);

  /**
   * Bonus estimate in INR — matches backend:
   * floor(principal × percent / 100); USDT principal = floor(usdt × payRate)
   */
  const bonusInrEst = useMemo(() => {
    if (finalAmount <= 0 || bonusPct <= 0) return 0;
    const principal = isUsdt
      ? usdtInrCredit
      : Math.floor(finalAmount);
    if (principal <= 0) return 0;
    return Math.floor((principal * bonusPct) / 100);
  }, [finalAmount, bonusPct, isUsdt, usdtInrCredit]);

  // Keep channel valid for selected method
  useEffect(() => {
    if (!payMethod.channels.includes(channelId)) {
      setChannelId(payMethod.channels[0]!);
    }
  }, [payMethod, channelId]);

  // When switching INR ↔ USDT, reset amount to that gateway's default min pick
  useEffect(() => {
    const defaults = isUsdtMethod(payMethod.apiMethod)
      ? QUICK_AMOUNTS_USDT
      : QUICK_AMOUNTS_INR;
    const def = defaults[0]!;
    setAmount(def);
    setAmountInput(String(def));
    setError(null);
  }, [payMethod.apiMethod]);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const res = await api.getDeposits({ page: 1, limit: 15 });
      setHistory(res.deposits ?? []);
    } catch {
      /* soft fail on deposit tab preview */
    } finally {
      setHistLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // Load admin USDT→INR rate + recharge bonus % for deposit estimates
  useEffect(() => {
    let cancelled = false;
    void api
      .getPaymentRates()
      .then((r) => {
        if (cancelled) return;
        const rate = Number(r.inrToUsdtPaymentConversionRate);
        if (Number.isFinite(rate) && rate > 0) setUsdtToInrRate(rate);
        const usdtB = Number(r.usdtDepositBonusPercent);
        if (Number.isFinite(usdtB) && usdtB >= 0) setUsdtBonusPct(usdtB);
        const inrB = Number(r.inrDepositBonusPercent);
        if (Number.isFinite(inrB) && inrB >= 0) setInrBonusPct(inrB);
      })
      .catch(() => {
        /* keep defaults: rate 105, USDT bonus 5%, INR bonus 0% */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onRefreshBalance = async () => {
    setRefreshing(true);
    try {
      await refreshUser();
      await loadHistory();
      toast("Balance updated", "success");
    } catch {
      toast("Could not refresh", "error");
    } finally {
      setRefreshing(false);
    }
  };

  const selectMethod = (id: PayUiId) => {
    setMethodId(id);
    const m = PAY_METHODS.find((x) => x.id === id);
    if (m?.channels[0]) setChannelId(m.channels[0]);
    setError(null);
  };

  /** Quick button → also fills the amount field */
  const pickQuick = (n: number) => {
    setAmount(n);
    setAmountInput(String(n));
    setError(null);
  };

  const handleDeposit = async () => {
    setError(null);
    const amt = sanitizeAmount(finalAmount);
    if (!amt) {
      setError("Enter a valid amount");
      return;
    }
    if (amt < channel.min) {
      setError(
        isUsdt
          ? `Minimum deposit is $${channel.min} USDT`
          : `Minimum deposit is ${formatINR(channel.min)}`
      );
      return;
    }
    if (!isUsdt && amt > channel.max) {
      setError(
        `Maximum deposit is ${formatINR(channel.max)}`
      );
      return;
    }

    // Must open in this tap. After await initiateDeposit, window.open is a
    // popup and the first gateway tab is blocked — “Open again” then works.
    const payTab = user?.isDemo ? null : openBlankTab();

    setLoading(true);
    try {
      const res = await api.initiateDeposit({
        amount: amt,
        method: payMethod.apiMethod,
      });
      await refreshUser();
      void loadHistory();

      if (user?.isDemo) {
        // Demo: backend credits balance immediately (no gateway / payUrl)
        toast("Demo deposit successful — balance credited", "success");
        setAmount(0);
        setAmountInput("");
      } else if (res.payUrl) {
        const openResult = navigateOpenedTab(payTab, res.payUrl);
        if (openResult !== "invalid") {
          setLastPayUrl(res.payUrl);
        }

        if (openResult === "opened") {
          toast("Opening payment page…", "success");
        } else if (openResult === "blocked") {
          const retry = openSafeUrlDetailed(res.payUrl);
          if (retry === "opened") {
            toast("Opening payment page…", "success");
          } else {
            setError(
              "Payment page did not open. Tap “Open again” below to continue."
            );
            toast("Tap Open again to complete payment", "info");
          }
        } else {
          setError("Payment unsuccessful. Please try again.");
          toast("Payment unsuccessful. Please try again.", "error");
        }
      } else if (payMethod.apiMethod === "UPI") {
        closeOpenedTab(payTab);
        toast("UPI order created. Complete transfer as instructed.", "success");
      } else {
        closeOpenedTab(payTab);
        toast("Deposit order created.", "success");
      }
    } catch (e: unknown) {
      closeOpenedTab(payTab);
      const msg = sanitizeErrorMessage(e, "Deposit failed");
      setError(msg);
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen w-full min-w-0 flex-1 flex-col pb-28"
      style={{ background: "#110D14" }}
    >
      {/* Top tabs */}
      <header className="app-page-header app-page-header--lg app-fixed-chrome fixed top-0 z-50">
        <div className="app-page-header-inner gap-1">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center text-[#FDE4BC] active:opacity-60"
            aria-label="Back"
          >
            <IoChevronBack size={22} />
          </button>
          <div
            className="flex min-w-0 flex-1 items-center justify-center gap-0"
            role="tablist"
            aria-label="Deposit sections"
          >
            {(
              [
                { id: "deposit" as const, label: "Deposit" },
                { id: "history" as const, label: "Deposit history" },
              ] as const
            ).map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setTab(t.id);
                    if (t.id === "history") void loadHistory();
                  }}
                  className="relative min-w-0 px-3 py-2 text-[14px] font-bold transition-colors sm:px-4"
                  style={{ color: active ? "#FED358" : "#837064" }}
                >
                  <span className="truncate">{t.label}</span>
                  {active && (
                    <span
                      className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                      style={{ background: "#FED358" }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <div className="w-9 shrink-0" aria-hidden />
        </div>
      </header>
      <div className="app-page-header-spacer app-page-header-spacer--lg" aria-hidden />

      {tab === "history" ? (
        <HistoryPanel
          items={history}
          loading={histLoading}
          onReload={() => void loadHistory()}
        />
      ) : (
        <div className="mx-auto w-full max-w-lg px-3 pt-3">
          {/* Balance card */}
          <div
            className="relative overflow-hidden rounded-2xl px-4 py-4 shadow-lg"
            style={{
              background:
                "linear-gradient(115deg, #0d9488 0%, #14b8a6 35%, #22c55e 100%)",
            }}
          >
            <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-10 left-10 h-24 w-24 rounded-full bg-black/10" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-white/85">Balance</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-[28px] font-black tabular-nums leading-none text-white tracking-tight">
                    {formatINR(user?.balance)}
                  </p>
                  <button
                    type="button"
                    onClick={() => void onRefreshBalance()}
                    disabled={refreshing}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white active:bg-white/25"
                    aria-label="Refresh balance"
                  >
                    <IoRefresh
                      size={16}
                      className={refreshing ? "animate-spin" : undefined}
                    />
                  </button>
                </div>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
                <IoWalletOutline size={24} />
              </div>
            </div>
          </div>

          {/* Payment methods */}
          <p className="mb-2 mt-5 text-[13px] font-bold text-white/90">
            Payment methods
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {PAY_METHODS.map((m) => {
              const active = methodId === m.id;
              const mBonus = isUsdtMethod(m.apiMethod)
                ? usdtBonusPct
                : inrBonusPct;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectMethod(m.id)}
                  className="relative flex flex-col items-center rounded-xl px-1 pb-2 pt-3 transition-all active:scale-[0.97]"
                  style={{
                    background: active
                      ? "linear-gradient(180deg, rgba(254,211,88,0.28) 0%, rgba(232,168,74,0.18) 100%)"
                      : "#241E22",
                    border: active
                      ? "1.5px solid rgba(254,211,88,0.65)"
                      : "1px solid #3D363A",
                  }}
                  aria-pressed={active}
                  aria-label={m.label}
                >
                  {mBonus > 0 && (
                    <span className="absolute -right-1 -top-1 rounded-md bg-[#E53935] px-1 py-0.5 text-[9px] font-black leading-none text-white shadow">
                      +{mBonus}%
                    </span>
                  )}
                  <div className="relative mb-1.5 flex h-9 w-9 items-center justify-center">
                    {isUsdtMethod(m.apiMethod) ? (
                      <TetherMark size={36} />
                    ) : (
                      <Image
                        src={m.icon}
                        alt=""
                        fill
                        sizes="36px"
                        className="object-contain"
                      />
                    )}
                  </div>
                  <span
                    className="line-clamp-2 text-center text-[10px] font-bold leading-tight"
                    style={{ color: active ? "#FED358" : "rgba(255,255,255,0.7)" }}
                  >
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Select channel */}
          <p className="mb-2 mt-5 text-[13px] font-bold text-white/90">
            Select channel
          </p>
          <div className="space-y-2">
            {payMethod.channels.map((cid) => {
              const ch = CHANNELS[cid];
              const active = channelId === cid;
              return (
                <button
                  key={cid}
                  type="button"
                  onClick={() => setChannelId(cid)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-3 text-left transition-all active:scale-[0.99]"
                  style={{
                    background: active
                      ? "linear-gradient(90deg, #FED358 0%, #E8A84A 100%)"
                      : "#241E22",
                    border: active
                      ? "1px solid transparent"
                      : "1px solid #3D363A",
                  }}
                  aria-pressed={active}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {ch.chain ? (
                      <UsdtTypeIcons chain={ch.chain} size={22} />
                    ) : ch.icon ? (
                      isUsdt ? (
                        <TetherMark size={32} />
                      ) : (
                        <div className="relative h-8 w-8 shrink-0">
                          <Image
                            src={ch.icon}
                            alt=""
                            fill
                            sizes="32px"
                            className="object-contain"
                          />
                        </div>
                      )
                    ) : null}
                    <div className="min-w-0">
                      <p
                        className="truncate text-[13px] font-bold"
                        style={{ color: active ? "#110D14" : "#FDE4BC" }}
                      >
                        {ch.name}
                      </p>
                      <p
                        className="mt-0.5 text-[11px] font-medium"
                        style={{
                          color: active ? "rgba(17,13,20,0.65)" : "#837064",
                        }}
                      >
                        {ch.balanceLabel}
                        {bonusPct > 0
                          ? ` · +${bonusPct}% bonus`
                          : ""}
                      </p>
                    </div>
                  </div>
                  {bonusPct > 0 && (
                    <span
                      className="shrink-0 rounded-md px-2 py-1 text-[11px] font-black"
                      style={{
                        background: active
                          ? "rgba(17,13,20,0.12)"
                          : "rgba(229,57,53,0.15)",
                        color: active ? "#110D14" : "#FD565C",
                      }}
                    >
                      +{bonusPct}% bonus
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* USDT promo — live bonus % from admin config */}
          {isUsdt && bonusPct > 0 && (
            <div
              className="mt-3 flex items-center gap-2.5 rounded-xl px-3 py-2.5"
              style={{
                background:
                  "linear-gradient(90deg, rgba(38,161,123,0.18) 0%, rgba(38,161,123,0.06) 100%)",
                border: "1px solid rgba(38,161,123,0.35)",
              }}
            >
              <TetherMark size={28} />
              <p className="text-[12px] font-semibold leading-snug text-[#26A17B]">
                Pay with USDT (Tether) and get a{" "}
                <span className="font-black">+{bonusPct}% bonus</span>{" "}
                credited with your deposit.
              </p>
            </div>
          )}

          {/* Deposit amount */}
          <p className="mb-2 mt-5 text-[13px] font-bold text-white/90">
            Deposit amount
            {isUsdt && (
              <span className="ml-2 text-[11px] font-medium text-white/40">
                (USDT)
              </span>
            )}
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-4">
            {quickAmounts.map((n) => {
              const active = Number(amountInput) === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => pickQuick(n)}
                  className="h-10 rounded-lg text-[12px] font-bold active:scale-95 transition-transform"
                  style={{
                    background: active
                      ? "linear-gradient(180deg, #FED358 0%, #E8A84A 100%)"
                      : "#241E22",
                    color: active ? "#110D14" : "rgba(255,255,255,0.75)",
                    border: active
                      ? "1px solid transparent"
                      : "1px solid #3D363A",
                  }}
                >
                  {formatQuickLabel(n, unit)}
                </button>
              );
            })}
          </div>

          <div
            className="mt-3 flex items-center gap-2 rounded-xl px-3"
            style={{
              background: "#241E22",
              border: "1px solid #3D363A",
              height: 48,
            }}
          >
            <span className="text-[14px] font-bold text-[#FED358] shrink-0">
              {isUsdt ? "$" : "₹"}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={channel.min}
              max={isUsdt ? undefined : channel.max}
              step={isUsdt ? "0.01" : "1"}
              placeholder={isUsdt ? "Enter $ USDT amount" : "Enter amount"}
              value={amountInput}
              onChange={(e) => {
                setAmountInput(e.target.value);
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setAmount(n);
              }}
              className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-white outline-none placeholder:text-white/30"
              aria-label="Deposit amount"
            />
          </div>

          {/* USDT → INR credit preview (admin conversion rate) */}
          {isUsdt && finalAmount > 0 && (
            <div
              className="mt-2 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
              style={{
                background: "rgba(254,211,88,0.08)",
                border: "1px solid rgba(254,211,88,0.22)",
              }}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-white/45">
                  You will receive (INR)
                </p>
                <p className="text-[16px] font-black text-[#FED358] tabular-nums leading-tight mt-0.5">
                  {formatINR(usdtInrCredit, 0)}
                </p>
              </div>
              <p className="text-[10px] text-white/40 text-right shrink-0 leading-snug">
                1 USDT ≈ {formatINR(usdtToInrRate, 0)}
                <br />
                <span className="text-white/30">wallet credit</span>
              </p>
            </div>
          )}

          <p className="mt-1.5 text-[11px] text-[#837064]">
            {formatAmountHint(channel.min, channel.max, unit)}
            {bonusInrEst > 0 && (
              <span className="ml-2 font-semibold text-[#17B15E]">
                +{formatINR(bonusInrEst)} bonus est.
              </span>
            )}
          </p>

          {/* Instructions */}
          <div
            className="mt-5 rounded-xl px-3.5 py-3"
            style={{
              background: "#1A1519",
              border: "1px solid #3D363A",
            }}
          >
            <p className="mb-2 text-[12px] font-bold text-[#FED358]">
              Recharge instructions
            </p>
            <ul className="space-y-1.5">
              {RECHARGE_INSTRUCTIONS.map((line, idx) => (
                <li
                  key={idx}
                  className="flex gap-2 text-[11px] leading-relaxed text-[#B79C8B]"
                >
                  <span
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                    style={{ background: "#FED358" }}
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <div
              className="mt-3 rounded-lg px-3 py-2 text-[12px] font-medium text-[#FD565C]"
              style={{
                background: "rgba(229,56,59,0.12)",
                border: "1px solid rgba(229,56,59,0.3)",
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          {lastPayUrl && (
            <div
              className="mt-3 rounded-lg px-3 py-2 text-[11px] text-[#FED358]"
              style={{
                background: "rgba(254,211,88,0.1)",
                border: "1px solid rgba(254,211,88,0.25)",
              }}
            >
              If you closed the payment page without finishing, you can{" "}
              <button
                type="button"
                className="font-bold underline"
                onClick={() => {
                  const r = openSafeUrlDetailed(lastPayUrl);
                  if (r === "opened") {
                    setError(null);
                    toast("Opening payment page…", "success");
                  } else if (r === "blocked") {
                    toast(
                      "Could not open payment page. Allow pop-ups or try again.",
                      "info"
                    );
                  } else {
                    toast("Payment unsuccessful. Please try a new deposit.", "error");
                  }
                }}
              >
                Open again
              </button>
            </div>
          )}

          {/* Recent history preview */}
          <div className="mb-2 mt-6 flex items-center justify-between">
            <p className="text-[13px] font-bold text-white/90">Deposit history</p>
            <button
              type="button"
              onClick={() => {
                setTab("history");
                void loadHistory();
              }}
              className="text-[11px] font-bold text-[#FED358] active:opacity-70"
            >
              View all
            </button>
          </div>
          {histLoading && history.length === 0 ? (
            <div className="py-6">
              <LoadingSpinner />
            </div>
          ) : history.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-white/35">
              No deposits yet
            </p>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 5).map((d) => (
                <HistoryCard key={d.id} d={d} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sticky bottom bar — deposit tab only */}
      {tab === "deposit" && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-lg px-3 pb-3 pt-2"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, #110D14 28%)",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
          }}
        >
          <div
            className="mb-2 flex items-center justify-between rounded-xl px-3 py-2"
            style={{
              background: "#241E22",
              border: "1px solid #3D363A",
            }}
          >
            <div className="flex min-w-0 items-center gap-2">
              <IoCardOutline size={16} className="shrink-0 text-[#FED358]" />
              <div className="min-w-0">
                <p className="text-[10px] text-[#837064]">Recharge method</p>
                <p className="truncate text-[12px] font-bold text-[#FDE4BC]">
                  {channel.name}
                </p>
              </div>
            </div>
            <p className="shrink-0 text-[14px] font-black tabular-nums text-white">
              {formatMoney(finalAmount || 0, unit)}
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleDeposit()}
            className="ts-btn-gold w-full h-[48px] text-[15px] font-bold disabled:opacity-60"
          >
            {loading ? "Processing…" : "Deposit"}
          </button>
        </div>
      )}
    </div>
  );
}

function HistoryCard({ d }: { d: Deposit }) {
  const inrHint = formatDepositInrHint(d);
  return (
    <div
      className="rounded-xl px-3 py-3"
      style={{
        background: "#241E22",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-white">
            {formatDepositAmount(d)}
          </p>
          {inrHint ? (
            <p className="mt-0.5 text-[10px] font-medium text-white/35 tabular-nums">
              {inrHint}
            </p>
          ) : null}
          <p className="mt-0.5 text-[11px] text-[#B79C8B]">
            {d.method}
            {d.method === "CXPAY" ? " · UPI / QR" : ""}
            {d.method === "OXAPAY" ? " · USDT" : ""}
          </p>
        </div>
        <StatusBadge status={mapStatus(d.status)} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[10px] text-white/35">
        <span>{formatDateTime(d.createdAt)}</span>
        <span className="max-w-[55%] truncate font-mono">{d.orderId}</span>
      </div>
    </div>
  );
}

function mapStatus(status: string): string {
  const s = status.toUpperCase();
  if (s === "SUCCESS") return "Complete";
  if (s === "PROCESSING") return "Processing";
  if (s === "FAILED") return "Failed";
  return status;
}

function HistoryPanel({
  items,
  loading,
  onReload,
}: {
  items: Deposit[];
  loading: boolean;
  onReload: () => void;
}) {
  if (loading && items.length === 0) return <LoadingSpinner />;
  if (items.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-sm text-white/50">No deposits yet</p>
        <button
          type="button"
          onClick={onReload}
          className="mt-3 text-[12px] font-bold text-[#FED358]"
        >
          Refresh
        </button>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-lg space-y-2 px-3 pt-3">
      {items.map((d) => (
        <HistoryCard key={d.id} d={d} />
      ))}
    </div>
  );
}
