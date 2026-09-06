"use client";

/**
 * Withdraw page — BCWIN-style (balance card, BANK/UPI/USDT tabs, amount, rules).
 * USDT (OXAPAY): BEP20 min 5 USDT · TRC20 min 100 USDT (INR = USDT × withdrawal rate).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  IoCardOutline,
  IoRefresh,
  IoAdd,
  IoWalletOutline,
} from "react-icons/io5";
import { SiTether } from "react-icons/si";
import PageHeader from "../ui/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../ui/Toast";
import * as api from "../../lib/api";
import type { BankDetails } from "../../lib/api";
import { formatDecimal, formatINR } from "../../lib/format";
import LoadingSpinner from "../ui/LoadingSpinner";
import WithdrawSuccessModal from "../ui/WithdrawSuccessModal";

type MethodTab = "BANK" | "UPI" | "USDT";
type CryptoChain = "BEP20" | "TRC20";

const TAB_TO_API: Record<MethodTab, "CXPAY" | "UPI" | "OXAPAY"> = {
  BANK: "CXPAY",
  UPI: "UPI",
  USDT: "OXAPAY",
};

/** Bank / UPI minimum (INR) */
const MIN_WD_INR = 200;
const MAX_WD = 200_000;

/** OXAPAY USDT minimums by chain */
const MIN_USDT_BEP20 = 5;
const MIN_USDT_TRC20 = 100;

function resolveUsdtAddresses(bank: BankDetails | null): {
  trc20: string | null;
  bep20: string | null;
} {
  if (!bank) return { trc20: null, bep20: null };
  const trc20 =
    bank.trc20Address?.trim() ||
    (bank.tronAddress && /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(bank.tronAddress.trim())
      ? bank.tronAddress.trim()
      : null);
  const bep20 =
    bank.bep20Address?.trim() ||
    (bank.tronAddress && /^0x[a-fA-F0-9]{40}$/i.test(bank.tronAddress.trim())
      ? bank.tronAddress.trim()
      : null);
  return { trc20, bep20 };
}

interface Props {
  onBack: () => void;
  onNavigate?: (screen: string) => void;
}

export default function WithdrawPage({ onBack, onNavigate }: Props) {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [bank, setBank] = useState<BankDetails | null>(null);
  const [loadingBank, setLoadingBank] = useState(true);
  const [tab, setTab] = useState<MethodTab>("BANK");
  const [amountStr, setAmountStr] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  /** Selected crypto chain — prefer BEP20 when both addresses exist */
  const [cryptoChain, setCryptoChain] = useState<CryptoChain>("BEP20");
  /** INR per 1 USDT on withdrawal (admin config) */
  const [withdrawRate, setWithdrawRate] = useState(100);
  /** Remaining wager (INR) required before withdraw is allowed */
  const [needToBet, setNeedToBet] = useState<number | null>(null);
  const [depositWagerNeeded, setDepositWagerNeeded] = useState<number>(0);
  const [rewardWagerNeeded, setRewardWagerNeeded] = useState<number>(0);
  const [remainingWdToday, setRemainingWdToday] = useState(3);
  const [maxWdPerDay, setMaxWdPerDay] = useState(3);

  const loadBank = useCallback(async () => {
    setLoadingBank(true);
    try {
      const r = await api.getBank();
      setBank(r.data);
      const { trc20, bep20 } = resolveUsdtAddresses(r.data);
      // Default: BEP20 if available; otherwise TRC20
      if (bep20) setCryptoChain("BEP20");
      else if (trc20) setCryptoChain("TRC20");
    } catch {
      setBank(null);
    } finally {
      setLoadingBank(false);
    }
  }, []);

  const loadWithdrawInfo = useCallback(async () => {
    try {
      const r = await api.getWithdrawInfo();
      const d = r?.data ?? (r as unknown as api.WithdrawInfo);
      const need = Number(
        (d as api.WithdrawInfo)?.needToBet ??
          (r as { needToBet?: number })?.needToBet ??
          0
      );
      setNeedToBet(Math.max(0, Number.isFinite(need) ? need : 0));
      setDepositWagerNeeded(Number((d as api.WithdrawInfo)?.depositWagerNeeded ?? 0));
      setRewardWagerNeeded(Number((d as api.WithdrawInfo)?.rewardWagerNeeded ?? 0));
      setRemainingWdToday(
        Math.max(
          0,
          Number(
            (d as api.WithdrawInfo)?.remainingWithdrawalsToday ?? 3
          )
        )
      );
      setMaxWdPerDay(
        Math.max(
          1,
          Number((d as api.WithdrawInfo)?.maxWithdrawalsPerDay ?? 3)
        )
      );
    } catch {
      setNeedToBet(null);
    }
  }, []);

  useEffect(() => {
    void loadBank();
    void loadWithdrawInfo();
  }, [loadBank, loadWithdrawInfo]);

  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState === "visible") void loadWithdrawInfo();
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, [loadWithdrawInfo]);

  useEffect(() => {
    api
      .getPaymentRates()
      .then((r) => {
        const rate = Number(r.inrToUsdtWithdrawalConversionRate);
        if (rate > 0) setWithdrawRate(rate);
      })
      .catch(() => {
        /* keep default 100 */
      });
  }, []);

  const balance = Number(user?.balance ?? 0);
  const amount = Number(amountStr) || 0;
  /** Any open wager (recharge / bonus / penalty-on-recharge) ≥ ₹1 → nothing withdrawable */
  const wagerLocked =
    needToBet != null &&
    (needToBet >= 1 || depositWagerNeeded >= 1 || rewardWagerNeeded >= 1);
  const withdrawable = wagerLocked ? 0 : needToBet == null ? null : balance;

  const usdtAddrs = useMemo(() => resolveUsdtAddresses(bank), [bank]);
  const hasTrc20 = !!usdtAddrs.trc20;
  const hasBep20 = !!usdtAddrs.bep20;
  const hasBothUsdt = hasTrc20 && hasBep20;

  // Keep selected chain valid when addresses change (prefer BEP20 if both exist)
  useEffect(() => {
    if (cryptoChain === "BEP20" && !hasBep20 && hasTrc20) setCryptoChain("TRC20");
    else if (cryptoChain === "TRC20" && !hasTrc20 && hasBep20) setCryptoChain("BEP20");
  }, [cryptoChain, hasTrc20, hasBep20]);

  const activeUsdtAddress =
    cryptoChain === "BEP20" ? usdtAddrs.bep20 : usdtAddrs.trc20;

  const minUsdtForChain =
    cryptoChain === "BEP20" ? MIN_USDT_BEP20 : MIN_USDT_TRC20;
  const minWdInrUsdt = Math.ceil(minUsdtForChain * withdrawRate);
  const minWd =
    tab === "USDT" ? Math.max(MIN_WD_INR, minWdInrUsdt) : MIN_WD_INR;

  const beneficiaryReady = useMemo(() => {
    if (!bank) return false;
    if (tab === "BANK")
      return !!(bank.bankAccount && bank.ifsc && bank.fullName);
    if (tab === "UPI") return !!bank.upiId;
    return !!(hasTrc20 || hasBep20);
  }, [bank, tab, hasTrc20, hasBep20]);

  const beneficiaryLabel = useMemo(() => {
    if (!bank) return null;
    if (tab === "BANK" && bank.bankAccount) {
      const acc = bank.bankAccount;
      const masked = acc.length > 4 ? `****${acc.slice(-4)}` : acc;
      return {
        title: bank.bankName || "Bank account",
        sub: `${bank.fullName || "—"} · ${masked}`,
      };
    }
    if (tab === "UPI" && bank.upiId) {
      return { title: "UPI", sub: bank.upiId };
    }
    if (tab === "USDT" && activeUsdtAddress) {
      const a = activeUsdtAddress;
      return {
        title: `USDT · ${cryptoChain}`,
        sub: `${a.slice(0, 6)}…${a.slice(-6)}`,
      };
    }
    return null;
  }, [bank, tab, activeUsdtAddress, cryptoChain]);

  const received = amount > 0 ? amount : 0;
  const isUsdt = tab === "USDT";
  const estimatedUsdt =
    isUsdt && amount > 0 && withdrawRate > 0
      ? formatDecimal(amount / withdrawRate, 3)
      : null;

  const handleWithdraw = async () => {
    setError(null);
    if (!beneficiaryReady) {
      setError("Need to add beneficiary information to be able to withdraw money");
      return;
    }
    if (isUsdt && !activeUsdtAddress) {
      setError(`Add a ${cryptoChain} USDT address first`);
      return;
    }
    if (!amount || amount < minWd) {
      if (isUsdt) {
        setError(
          `Minimum ${cryptoChain} withdrawal is ${minUsdtForChain} USDT (≈ ${formatINR(minWdInrUsdt)})`
        );
      } else {
        setError(`Minimum withdrawal is ${formatINR(MIN_WD_INR)}`);
      }
      return;
    }
    if (amount > MAX_WD) {
      setError(`Maximum withdrawal is ${formatINR(MAX_WD)}`);
      return;
    }
    if (wagerLocked) {
      setError("Complete remaining wager before withdrawing");
      return;
    }
    if (amount > balance) {
      setError("Insufficient balance");
      return;
    }
    if (!password.trim()) {
      setError("Enter your login password to withdraw");
      return;
    }
    setLoading(true);
    try {
      await api.initiateWithdraw({
        amount: Math.floor(amount),
        method: TAB_TO_API[tab],
        password: password.trim(),
        ...(isUsdt ? { cryptoChain: cryptoChain || "BEP20" } : {}),
      });
      await refreshUser();
      void loadWithdrawInfo();
      setPassword("");
      setShowSuccess(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Withdraw failed";
      setError(msg);
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    if (tab === "BANK") onNavigate?.("bank");
    else if (tab === "UPI") onNavigate?.("bank-upi");
    else onNavigate?.("bank-usdt");
  };

  if (loadingBank) {
    return (
      <div className="flex-1 min-h-screen" style={{ background: "#110D14" }}>
        <PageHeader title="Withdraw" onBack={onBack} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col min-h-screen min-w-0 w-full max-w-full overflow-x-clip pb-[max(2.5rem,env(safe-area-inset-bottom))]"
      style={{ background: "#110D14" }}
    >
      <PageHeader
        title="Withdraw"
        onBack={onBack}
        right={
          <button
            type="button"
            onClick={() => onNavigate?.("withdraw-history")}
            className="text-[12px] sm:text-[13px] text-[#FED358] font-bold leading-tight text-right max-w-[4.5rem] sm:max-w-none"
          >
            History
          </button>
        }
      />

      {/* Balance card */}
      <div
        className="mx-3 mt-2 rounded-[14px] p-3 sm:p-4 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #5eead4 0%, #2dd4bf 45%, #14b8a6 100%)",
          boxShadow: "0 8px 24px rgba(20,184,166,0.35)",
        }}
      >
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[13px] sm:text-[14px] font-semibold text-[#0f3d38]/opacity-90">
              <IoWalletOutline size={14} className="shrink-0" />
              Available balance
            </div>
            <div className="flex items-center gap-2 mt-1 min-w-0">
              <p className="text-[clamp(1.25rem,6.5vw,1.65rem)] font-black text-[#0a2e2a] tabular-nums leading-none truncate">
                {formatINR(balance)}
              </p>
              <button
                type="button"
                onClick={() => {
                  void refreshUser();
                  void loadWithdrawInfo();
                }}
                className="p-1 rounded-full active:opacity-70"
                style={{ background: "rgba(255,255,255,0.35)" }}
                aria-label="Refresh"
              >
                <IoRefresh size={14} className="text-[#0a2e2a]" />
              </button>
            </div>
          </div>
          <div className="text-right text-[13px] font-bold text-[#0a2e2a]/opacity-50 tracking-widest">
            **** ****
          </div>
        </div>
      </div>

      {/* Channel promo */}
      <div
        className="mx-3 mt-3 rounded-[12px] px-3 py-2.5 flex items-center gap-2.5"
        style={{
          background: "#241E22",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-black text-[#110D14] text-[15px]"
          style={{ background: "linear-gradient(135deg,#FED358,#E8A84A)" }}
        >
          ₹
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-white">
            {isUsdt ? "USDT" : "Bank card"}
          </p>
          <p className="text-[12px] text-white/45 leading-snug">
            {isUsdt
              ? "Enter amount in ₹ — paid out as USDT to your wallet address"
              : "Withdraw to your linked bank account"}
          </p>
        </div>
      </div>

      {/* Method tabs — UPI hidden for now */}
      <div className="mx-3 mt-3 grid grid-cols-2 gap-1.5 sm:gap-2">
        {(
          [
            {
              id: "BANK" as const,
              label: "BANK CARD",
              icon: <IoCardOutline size={28} color="#26A17B" />,
            },
            {
              id: "USDT" as const,
              label: "USDT",
              icon: <SiTether size={26} color="#26A17B" />,
            },
          ] as const
        ).map((m) => {
          const on = tab === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setTab(m.id)}
              className="rounded-[12px] py-2.5 sm:py-3 flex flex-col items-center gap-1.5 min-w-0 active:scale-[0.98]"
              style={{
                background: on
                  ? "linear-gradient(180deg,#FED358,#E8A84A)"
                  : "#241E22",
                border: on
                  ? "1px solid transparent"
                  : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span className="leading-none flex items-center justify-center">
                {m.icon}
              </span>
              <span
                className="text-[11px] sm:text-[12px] font-black tracking-wide truncate max-w-full px-0.5"
                style={{ color: on ? "#110D14" : "rgba(255,255,255,0.55)" }}
              >
                {m.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* USDT network selector when both addresses saved */}
      {isUsdt && hasBothUsdt && (
        <div className="mx-3 mt-3 grid grid-cols-2 gap-2">
          {(["BEP20", "TRC20"] as const).map((chain) => {
            const on = cryptoChain === chain;
            return (
              <button
                key={chain}
                type="button"
                onClick={() => setCryptoChain(chain)}
                className="rounded-[10px] py-2 text-[13px] font-bold active:scale-[0.98]"
                style={{
                  background: on
                    ? "linear-gradient(180deg,#FED358,#E8A84A)"
                    : "#241E22",
                  color: on ? "#110D14" : "rgba(255,255,255,0.6)",
                  border: on
                    ? "1px solid transparent"
                    : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {chain}
                <span className="block text-[11px] font-semibold opacity-80 mt-0.5">
                  Min {chain === "BEP20" ? MIN_USDT_BEP20 : MIN_USDT_TRC20} USDT
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Beneficiary / add */}
      <div className="mx-3 mt-4">
        {beneficiaryLabel ? (
          <button
            type="button"
            onClick={openAdd}
            className="w-full rounded-[12px] px-3.5 py-3 flex items-center gap-3 text-left active:opacity-90"
            style={{
              background: "#241E22",
              border: "1px solid rgba(254,211,88,0.25)",
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(254,211,88,0.15)" }}
            >
              <IoCardOutline size={20} className="text-[#FED358]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-white truncate">
                {beneficiaryLabel.title}
              </p>
              <p className="text-[13px] text-white/45 truncate">
                {beneficiaryLabel.sub}
              </p>
            </div>
            <span className="text-[13px] font-bold text-[#FED358]">Edit</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={openAdd}
            className="w-full flex flex-col items-center py-5 gap-2"
          >
            <div
              className="w-14 h-14 rounded-[12px] flex items-center justify-center"
              style={{
                border: "1.5px dashed rgba(255,255,255,0.25)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <IoAdd size={28} className="text-white/40" />
            </div>
            <p className="text-[15px] font-semibold text-white/70">
              {tab === "BANK" && "Add a bank account number"}
              {tab === "UPI" && "Add UPI ID"}
              {tab === "USDT" && "Add USDT address"}
            </p>
          </button>
        )}

        {!beneficiaryReady && (
          <p className="text-center text-[14px] font-semibold text-[#DA3735] mt-2 px-2">
            Need to add beneficiary information to be able to withdraw money
          </p>
        )}
      </div>

      {/* Amount */}
      <div className="mx-3 mt-4">
        <div
          className="h-12 rounded-full px-4 flex items-center gap-2"
          style={{
            background: "#241E22",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <span className="text-[#FED358] font-black text-[18px]">₹</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder={
              isUsdt
                ? `Min ${formatINR(minWd)} (${minUsdtForChain} USDT · ${cryptoChain})`
                : "Please enter the amount"
            }
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className="flex-1 bg-transparent outline-none text-[16px] text-white placeholder:text-white/30 font-semibold"
          />
        </div>

        <div className="mt-2.5 flex flex-col xs:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="text-[12px] sm:text-[13px] text-white/45 space-y-0.5 min-w-0 flex-1">
            <p className="break-words">
              Withdrawable balance{" "}
              <span className="text-white/70 font-bold tabular-nums">
                {withdrawable == null ? "…" : formatINR(withdrawable)}
              </span>
            </p>
            <p className="break-words">
              Withdrawal amount received{" "}
              <span className="text-white/80 font-bold tabular-nums">
                {formatINR(received)}
              </span>
              {isUsdt && estimatedUsdt && (
                <span className="ml-1 text-[#26A17B] font-semibold">
                  → ≈ {estimatedUsdt} USDT
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setAmountStr(String(Math.floor(withdrawable ?? 0)))
            }
            className="shrink-0 self-end sm:self-auto h-8 min-w-[3.25rem] px-4 rounded-full text-[14px] font-bold text-[#110D14]"
            style={{
              background: "linear-gradient(180deg,#FED358,#E8A84A)",
            }}
          >
            All
          </button>
        </div>
      </div>

      {/* Login password required to authorize withdraw */}
      <div className="mx-3 mt-4">
        <label className="block text-[14px] font-semibold text-white/55 mb-1.5 px-1">
          Login password
        </label>
        <div
          className="h-12 rounded-full px-4 flex items-center"
          style={{
            background: "#241E22",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Enter account password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex-1 bg-transparent outline-none text-[16px] text-white placeholder:text-white/30 font-semibold"
          />
        </div>
      </div>

      {error && (
        <div
          className="mx-3 mt-3 px-3 py-2 rounded-lg text-[13px] text-[#FD565C]"
          style={{ background: "rgba(229,56,59,0.12)" }}
        >
          {error}
        </div>
      )}

      <div className="mx-3 mt-5">
        <button
          type="button"
          disabled={loading}
          onClick={handleWithdraw}
          className="w-full h-12 rounded-full font-bold text-[17px] text-[#110D14] disabled:opacity-50 active:scale-[0.99]"
          style={{
            background: "linear-gradient(180deg,#c4b5a0 0%,#a89b8a 100%)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
          }}
        >
          {loading ? "Submitting…" : "Withdraw"}
        </button>
      </div>

      {/* Rules / instructions */}
      <ul className="mx-3 mt-5 space-y-2 text-[13px] text-[#c9a227]/80 leading-relaxed pb-4">
        <li className="flex gap-2">
          <span className="text-[#FED358]">◆</span>
          <span>
            Total Need to bet{" "}
            <strong
              className="font-extrabold tabular-nums"
              style={{ color: "#FD565C" }}
            >
              {needToBet == null ? "…" : formatINR(needToBet)}
            </strong>
          </span>
        </li>
        {depositWagerNeeded > 0 && (
          <li className="flex gap-2 pl-4 text-[12px]">
            <span className="text-white/40">↳</span>
            <span>
              Deposit Wager: <strong className="text-white/85">{formatINR(depositWagerNeeded)}</strong>
            </span>
          </li>
        )}
        {rewardWagerNeeded > 0 && (
          <li className="flex gap-2 pl-4 text-[12px]">
            <span className="text-white/40">↳</span>
            <span>
              Reward Wager: <strong className="text-white/85">{formatINR(rewardWagerNeeded)}</strong>
            </span>
          </li>
        )}
        <li className="flex gap-2">
          <span className="text-[#FED358]">◆</span>
          <span>
            Need to bet enough turnover to be able to withdraw (Inout bets excluded).
          </span>
        </li>
        <li className="flex gap-2">
          <span className="text-[#FED358]">◆</span>
          <span>Withdraw time 00:00–23:59</span>
        </li>
        <li className="flex gap-2">
          <span className="text-[#FED358]">◆</span>
          <span>
            Inday Remaining Withdrawal Times{" "}
            <strong className="text-white/85 tabular-nums">{remainingWdToday}</strong>
            {maxWdPerDay > 0 ? (
              <span className="text-white/40"> / {maxWdPerDay}</span>
            ) : null}
          </span>
        </li>
        <li className="flex gap-2">
          <span className="text-[#FED358]">◆</span>
          <span>
            Bank / UPI withdrawal amount range {formatINR(MIN_WD_INR)}–
            {formatINR(MAX_WD)}
          </span>
        </li>
        <li className="flex gap-2">
          <span className="text-[#FED358]">◆</span>
          <span>
            <strong className="text-[#FED358]/90">USDT (BEP20)</strong> minimum{" "}
            <strong className="text-white/80">{MIN_USDT_BEP20} USDT</strong> (≈{" "}
            {formatINR(Math.ceil(MIN_USDT_BEP20 * withdrawRate))}) ·{" "}
            <strong className="text-[#FED358]/90">USDT (TRC20)</strong> minimum{" "}
            <strong className="text-white/80">{MIN_USDT_TRC20} USDT</strong> (≈{" "}
            {formatINR(Math.ceil(MIN_USDT_TRC20 * withdrawRate))})
          </span>
        </li>
        {isUsdt && (
          <li className="flex gap-2">
            <span className="text-[#FED358]">◆</span>
            <span>
              Selected network: <strong className="text-white/80">{cryptoChain}</strong>{" "}
              — enter at least {formatINR(minWd)} (≈ {minUsdtForChain} USDT). Rate: 1
              USDT ≈ ₹{withdrawRate}.
            </span>
          </li>
        )}
        <li className="flex gap-2">
          <span className="text-[#FED358]">◆</span>
          <span>
            Please check your registered bank information again before making a
            withdrawal. If your registered bank information is incorrect, our
            company will not be responsible for any loss.
          </span>
        </li>
      </ul>

      <WithdrawSuccessModal
        open={showSuccess}
        onConfirm={() => {
          setShowSuccess(false);
          onNavigate?.("withdraw-history");
        }}
      />
    </div>
  );
}
