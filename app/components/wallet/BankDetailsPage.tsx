"use client";

/**
 * Bind payment methods — Bank card / UPI / USDT (BCWIN-style).
 * mode: "bank" | "upi" | "usdt" (from AppShell screen id).
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  IoBusinessOutline,
  IoPersonOutline,
  IoCardOutline,
  IoCallOutline,
  IoKeyOutline,
  IoWarningOutline,
  IoSearchOutline,
  IoChevronForward,
  IoLinkOutline,
  IoShieldCheckmarkOutline,
} from "react-icons/io5";
import { SiTether } from "react-icons/si";
import PageHeader from "../ui/PageHeader";
import LoadingSpinner from "../ui/LoadingSpinner";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../context/AuthContext";
import * as api from "../../lib/api";
import type { BankSavePayload } from "../../lib/api";
import { INDIAN_BANKS } from "./indianBanks";
import { useSpaBackClose } from "../../hooks/useSpaBackClose";

export type BankPageMode = "bank" | "upi" | "usdt";

interface Props {
  onBack: () => void;
  mode?: BankPageMode;
}

const inputCls =
  "w-full h-11 rounded-[10px] px-3.5 text-[15px] text-white outline-none placeholder:text-white/30";
const inputStyle = {
  background: "#2a2428",
  border: "1px solid rgba(255,255,255,0.08)",
} as const;

export default function BankDetailsPage({ onBack, mode = "bank" }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exists, setExists] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canUpdate, setCanUpdate] = useState(true);
  const [nextUpdateAt, setNextUpdateAt] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankName, setBankName] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [phone, setPhone] = useState("");
  const [upiId, setUpiId] = useState("");
  const [tronAddress, setTronAddress] = useState("");
  /** Cached per-chain addresses so switching network does not lose the other */
  const [savedTrc20, setSavedTrc20] = useState("");
  const [savedBep20, setSavedBep20] = useState("");
  const [alias, setAlias] = useState("");
  const [network, setNetwork] = useState<"TRC20" | "BEP20">("BEP20");

  const [otp, setOtp] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);

  const [pickBank, setPickBank] = useState(false);
  const [bankQuery, setBankQuery] = useState("");
  const [netSheet, setNetSheet] = useState(false);
  useSpaBackClose(netSheet, () => setNetSheet(false), "bank-network-sheet");

  const mobile = user?.mobileNumber ?? "";
  const email = (user?.email ?? "").trim().toLowerCase();
  const isDemo = !!user?.isDemo;
  /**
   * Email-primary accounts (have email on profile) verify bank via email OTP.
   * Phone-only accounts keep SMS OTP. Demo accounts always allow simulated OTP.
   */
  const otpViaEmail = !isDemo && !!email;
  const otpTargetReady = isDemo ? true : otpViaEmail ? !!email : !!mobile;

  const maskEmail = (e: string) => {
    const [local, domain] = e.split("@");
    if (!local || !domain) return e;
    const head = local.slice(0, 2);
    return `${head}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
  };

  const maskMobile = (m: string) => {
    const d = m.replace(/\D/g, "");
    if (d.length < 4) return m;
    return `${"*".repeat(Math.max(0, d.length - 4))}${d.slice(-4)}`;
  };

  useEffect(() => {
    api
      .getBank()
      .then((r) => {
        const d = r.data || {};
        const trc =
          d.trc20Address?.trim() ||
          (d.tronAddress &&
          /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(d.tronAddress.trim())
            ? d.tronAddress.trim()
            : "");
        const bep =
          d.bep20Address?.trim() ||
          (d.tronAddress && /^0x[a-fA-F0-9]{40}$/i.test(d.tronAddress.trim())
            ? d.tronAddress.trim()
            : "");
        const hasAny = !!(
          d.fullName ||
          d.bankAccount ||
          d.ifsc ||
          d.upiId ||
          trc ||
          bep ||
          d.bankName
        );
        setExists(hasAny);
        setFullName(d.fullName ?? "");
        setBankAccount(d.bankAccount ?? "");
        setBankName(d.bankName ?? "");
        setIfsc(d.ifsc ?? "");
        setUpiId(d.upiId ?? "");
        setSavedTrc20(trc);
        setSavedBep20(bep);
        // Prefer BEP20 by default (when both or only BEP20); else TRC20
        if (bep) {
          setNetwork("BEP20");
          setTronAddress(bep);
        } else if (trc) {
          setNetwork("TRC20");
          setTronAddress(trc);
        } else {
          setNetwork("BEP20");
          setTronAddress("");
        }
        setCanUpdate(isDemo ? true : d.canUpdate !== false);
        setNextUpdateAt(isDemo ? null : (d.nextUpdateAt ?? null));
      })
      .catch(() => {
        setExists(false);
        setCanUpdate(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const t = window.setTimeout(() => setOtpCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [otpCountdown]);

  const filteredBanks = useMemo(() => {
    const q = bankQuery.trim().toLowerCase();
    if (!q) return INDIAN_BANKS;
    return INDIAN_BANKS.filter((b) => b.toLowerCase().includes(q));
  }, [bankQuery]);

  const title =
    mode === "upi"
      ? "Add UPI ID"
      : mode === "usdt"
        ? "Add USDT address"
        : "Add a bank account number";

  const canSaveBank =
    !!bankName &&
    fullName.trim().length >= 3 &&
    bankAccount.trim().length >= 8 &&
    ifsc.trim().length >= 6;

  const canSaveUpi = upiId.trim().includes("@");
  const isTrc20Addr = /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(tronAddress.trim());
  const isBep20Addr = /^0x[a-fA-F0-9]{40}$/.test(tronAddress.trim());
  const canSaveUsdt =
    (network === "TRC20" && isTrc20Addr) ||
    (network === "BEP20" && isBep20Addr);

  const fieldsOk =
    mode === "bank" ? canSaveBank : mode === "upi" ? canSaveUpi : canSaveUsdt;
  const otpOk = otp.trim().length === 6;
  /** This screen already has a saved value (changing) vs first fill */
  const modeAlreadySet =
    mode === "bank"
      ? !!(bankAccount.trim() || ifsc.trim())
      : mode === "upi"
        ? !!upiId.trim()
        : network === "TRC20"
          ? !!savedTrc20.trim()
          : !!savedBep20.trim();
  /** First-time add of empty fields always allowed; changing saved values needs 24h (demo can always update) */
  const updateAllowed = isDemo || !modeAlreadySet || canUpdate;
  const canSave = fieldsOk && otpOk && updateAllowed && otpTargetReady;

  const sendOtp = async () => {
    if (!otpTargetReady) {
      toast(
        otpViaEmail
          ? "No email on account"
          : "No mobile number on account",
        "error"
      );
      return;
    }
    if (otpCountdown > 0 || otpSending) return;
    setOtpSending(true);
    setError(null);

    if (isDemo) {
      setTimeout(() => {
        setOtpSending(false);
        setOtpCountdown(120);
        toast(
          otpViaEmail
            ? "OTP sent to your registered email"
            : "OTP sent to your registered mobile",
          "success"
        );
      }, 200);
      return;
    }

    try {
      // Prefer email when present (works for all countries)
      if (otpViaEmail) {
        await api.sendOtp({ method: "email", email });
        setOtpCountdown(120);
        toast("OTP sent to your registered email", "success");
        return;
      }

      // SMS OTP: only 91 / 92 / 880 — never use full-country parseStoredMobile
      // (that can return 1/44/971 and backend rejects: "SMS OTP only supports…")
      const { parseStoredMobileForSmsOtp } = await import(
        "../../lib/countryPhone"
      );
      const parsed = parseStoredMobileForSmsOtp(mobile);
      if (!parsed) {
        const msg =
          "SMS OTP is only available for India (+91), Pakistan (+92), Bangladesh (+880). Bind an email to receive OTP.";
        setError(msg);
        toast(msg, "error");
        return;
      }
      await api.sendOtp({
        method: "mobileNumber",
        mobileNumber: parsed.mobileNumber,
        countryCode: parsed.countryCode,
      });
      setOtpCountdown(120);
      toast("OTP sent to your registered mobile", "success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send OTP";
      setError(msg);
      toast(msg, "error");
    } finally {
      setOtpSending(false);
    }
  };

  const handleSave = async () => {
    setError(null);
    if (!fieldsOk) {
      setError("Please complete all required fields");
      return;
    }
    if (!isDemo && !otpTargetReady) {
      setError(
        otpViaEmail
          ? "Email missing on account"
          : "Mobile number missing on account"
      );
      return;
    }
    if (!otpOk) {
      setError("Enter the 6-digit OTP");
      return;
    }
    if (!isDemo && modeAlreadySet && !canUpdate) {
      setError(
        nextUpdateAt
          ? `You can change saved details once every 24 hours. Try after ${new Date(nextUpdateAt).toLocaleString()}`
          : "You can change saved details only once every 24 hours"
      );
      return;
    }
    if (mode === "usdt") {
      if (network === "TRC20" && !isTrc20Addr) {
        setError("Enter a valid TRC20 address (starts with T)");
        return;
      }
      if (network === "BEP20" && !isBep20Addr) {
        setError("Enter a valid BEP20 address (0x + 40 hex chars)");
        return;
      }
    }
    setSaving(true);
    try {
      // Map UI address into the correct chain field (API uses trc20/bep20, not tronAddress)
      const addr = tronAddress.trim() || null;
      const usdtFields: Pick<BankSavePayload, "trc20Address" | "bep20Address"> =
        mode === "usdt"
          ? network === "TRC20"
            ? { trc20Address: addr, bep20Address: undefined }
            : { bep20Address: addr, trc20Address: undefined }
          : {};

      // Merge with existing so we don't wipe other channels
      const payload: BankSavePayload = {
        fullName: fullName.trim() || null,
        bankAccount: bankAccount.trim() || null,
        bankName: bankName.trim() || null,
        ifsc: ifsc.trim().toUpperCase() || null,
        upiId: upiId.trim() || null,
        ...usdtFields,
        otp: otp.replace(/\D/g, "").trim(),
      };
      if (exists) await api.updateBank(payload);
      else await api.saveBank(payload);
      setExists(true);
      if (!isDemo) {
        setCanUpdate(false);
        setNextUpdateAt(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
      }
      toast("Saved successfully", "success");
      onBack();
    } catch (e: unknown) {
      // If "already exist", try update with same OTP
      const msg = e instanceof Error ? e.message : "Save failed";
      if (/already exist/i.test(msg)) {
        try {
          const addr = tronAddress.trim() || null;
          const usdtFields: Pick<
            BankSavePayload,
            "trc20Address" | "bep20Address"
          > =
            mode === "usdt"
              ? network === "TRC20"
                ? { trc20Address: addr, bep20Address: undefined }
                : { bep20Address: addr, trc20Address: undefined }
              : {};
          await api.updateBank({
            fullName: fullName.trim() || null,
            bankAccount: bankAccount.trim() || null,
            bankName: bankName.trim() || null,
            ifsc: ifsc.trim().toUpperCase() || null,
            upiId: upiId.trim() || null,
            ...usdtFields,
            otp: otp.replace(/\D/g, "").trim(),
          });
          setExists(true);
          setCanUpdate(false);
          toast("Saved successfully", "success");
          onBack();
          return;
        } catch (e2: unknown) {
          const m2 = e2 instanceof Error ? e2.message : "Save failed";
          setError(m2);
          toast(m2, "error");
        }
      } else {
        setError(msg);
        toast(msg, "error");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 min-h-screen" style={{ background: "#110D14" }}>
        <PageHeader title={title} onBack={onBack} />
        <LoadingSpinner />
      </div>
    );
  }

  // ── Choose bank full-screen ──
  if (pickBank) {
    return (
      <div
        className="flex flex-col min-h-screen min-w-0 w-full max-w-full overflow-x-clip pb-[env(safe-area-inset-bottom)]"
        style={{ background: "#110D14" }}
      >
        <PageHeader title="Choose a bank" onBack={() => setPickBank(false)} />
        <div className="px-3 pt-2 pb-3">
          <div
            className="h-11 rounded-full px-3.5 flex items-center gap-2 min-w-0"
            style={{
              background: "#241E22",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <IoSearchOutline className="text-[#FED358] shrink-0" size={18} />
            <input
              value={bankQuery}
              onChange={(e) => setBankQuery(e.target.value)}
              placeholder="Search bank"
              className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-white placeholder:text-white/35"
            />
          </div>
        </div>
        <p className="px-4 text-[14px] text-white/40 font-semibold mb-1">
          Choose a bank
        </p>
        <div
          className="mx-3 rounded-[12px] overflow-hidden flex-1"
          style={{
            background: "#1e1a1c",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div className="max-h-[70vh] overflow-y-auto no-scrollbar">
            {filteredBanks.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => {
                  setBankName(b);
                  setPickBank(false);
                  setBankQuery("");
                }}
                className="w-full text-left px-4 py-3.5 text-[14px] font-semibold border-b border-white/[0.04] active:bg-white/5"
                style={{
                  color:
                    bankName === b
                      ? "#FED358"
                      : "rgba(232, 200, 140, 0.85)",
                }}
              >
                {b}
              </button>
            ))}
            {filteredBanks.length === 0 && (
              <p className="text-center text-white/30 text-xs py-10">
                No banks found
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col min-h-screen min-w-0 w-full max-w-full overflow-x-clip pb-[max(2.5rem,env(safe-area-inset-bottom))]"
      style={{ background: "#110D14" }}
    >
      <PageHeader title={title} onBack={onBack} />

      {/* Safety banner */}
      <div
        className="mx-3 mt-2 rounded-full px-3 py-2 flex items-start gap-2"
        style={{
          background: "rgba(60,40,40,0.9)",
          border: "1px solid rgba(218,55,53,0.25)",
        }}
      >
        <IoWarningOutline
          className="text-[#f87171] shrink-0 mt-0.5"
          size={16}
        />
        <p className="text-[13px] text-[#f87171] font-semibold leading-snug">
          {mode === "usdt"
            ? "To ensure the safety of your funds, please link your wallet"
            : "To ensure the safety of your funds, please bind your bank account"}
        </p>
      </div>

      <div className="mx-3 mt-4 space-y-4">
        {mode === "bank" && (
          <>
            <FieldLabel icon={<IoBusinessOutline />} text="Choose a bank" />
            <button
              type="button"
              onClick={() => setPickBank(true)}
              className="w-full h-11 rounded-[10px] px-3.5 flex items-center justify-between text-[15px] font-bold active:opacity-90"
              style={{
                background: bankName
                  ? "#2a2428"
                  : "linear-gradient(180deg,#FED358,#E8A84A)",
                color: bankName ? "#FED358" : "#110D14",
                border: bankName
                  ? "1px solid rgba(254,211,88,0.35)"
                  : "none",
              }}
            >
              <span className="truncate">
                {bankName || "Please select a bank"}
              </span>
              <IoChevronForward size={18} />
            </button>

            <FieldLabel
              icon={<IoPersonOutline />}
              text="Full recipient's name"
            />
            <input
              className={inputCls}
              style={inputStyle}
              placeholder="Please enter the recipient's name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />

            <FieldLabel
              icon={<IoCardOutline />}
              text="Bank account number"
            />
            <input
              className={inputCls}
              style={inputStyle}
              placeholder="Please enter your bank account number"
              inputMode="numeric"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
            />

            <FieldLabel icon={<IoCallOutline />} text="Phone number" />
            <input
              className={inputCls}
              style={inputStyle}
              placeholder="Please enter your phone number"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <FieldLabel icon={<IoKeyOutline />} text="IFSC code" />
            <input
              className={inputCls}
              style={inputStyle}
              placeholder="Please enter IFSC code"
              value={ifsc}
              onChange={(e) => setIfsc(e.target.value.toUpperCase())}
            />
          </>
        )}

        {mode === "upi" && (
          <>
            <FieldLabel icon={<IoLinkOutline />} text="UPI ID" />
            <input
              className={inputCls}
              style={inputStyle}
              placeholder="name@upi"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
            />
            <FieldLabel
              icon={<IoPersonOutline />}
              text="Account holder name (optional)"
            />
            <input
              className={inputCls}
              style={inputStyle}
              placeholder="Name as per UPI"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </>
        )}

        {mode === "usdt" && (
          <>
            <FieldLabel icon={<IoLinkOutline />} text="Select main network" />
            <button
              type="button"
              onClick={() => setNetSheet(true)}
              className="w-full h-11 rounded-[10px] px-3.5 flex items-center justify-between text-[15px] font-bold text-white"
              style={inputStyle}
            >
              <span>{network}</span>
              <span className="text-white/40 text-lg leading-none">▾</span>
            </button>
            <p className="text-[12px] text-white/40 -mt-2 px-0.5">
              {network === "TRC20"
                ? "Tron (TRC20) · address starts with T"
                : "BNB Smart Chain (BEP20) · address starts with 0x"}
            </p>

            <FieldLabel icon={<SiTether />} text="USDT Address" />
            <input
              className={inputCls}
              style={inputStyle}
              placeholder={
                network === "TRC20"
                  ? "T… TRC20 address"
                  : "0x… BEP20 address"
              }
              value={tronAddress}
              onChange={(e) => setTronAddress(e.target.value.trim())}
            />

            <FieldLabel icon={<IoKeyOutline />} text="Address Alias" />
            <input
              className={inputCls}
              style={inputStyle}
              placeholder="Please enter a remark of the withdrawal address"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
            />
          </>
        )}

        {/* OTP verification — required for add & update */}
        <div
          className="rounded-[12px] p-3.5 space-y-3"
          style={{
            background: "#1e1a1c",
            border: "1px solid rgba(254,211,88,0.2)",
          }}
        >
          <FieldLabel
            icon={<IoShieldCheckmarkOutline />}
            text="Verify with OTP"
          />
          <p className="text-[13px] text-white/45 leading-snug">
            {otpViaEmail ? (
              <>
                OTP will be sent to your registered email{" "}
                <span className="text-[#FED358] font-bold">
                  {maskEmail(email)}
                </span>
              </>
            ) : mobile ? (
              <>
                OTP will be sent to your registered number{" "}
                <span className="text-[#FED358] font-bold">
                  {maskMobile(mobile)}
                </span>
              </>
            ) : isDemo ? (
              <>
                OTP will be sent to your registered number{" "}
                <span className="text-[#FED358] font-bold">
                  ******8888
                </span>
              </>
            ) : (
              <>No mobile or email on account for OTP</>
            )}
            . You can add missing bank / UPI / USDT anytime. Changing a saved
            value is allowed{" "}
            <span className="text-white/70 font-semibold">once every 24 hours</span>.
          </p>
          <div className="flex gap-2 min-w-0">
            <input
              className={`${inputCls} flex-1 min-w-0`}
              style={inputStyle}
              placeholder="6-digit OTP"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
            <button
              type="button"
              disabled={!otpTargetReady || otpSending || otpCountdown > 0}
              onClick={() => void sendOtp()}
              className="shrink-0 h-11 px-3.5 rounded-[10px] text-[14px] font-bold disabled:opacity-45"
              style={{
                background:
                  otpCountdown > 0
                    ? "#3a3538"
                    : "linear-gradient(180deg,#FED358,#E8A84A)",
                color: otpCountdown > 0 ? "rgba(255,255,255,0.45)" : "#110D14",
              }}
            >
              {otpSending
                ? "Sending…"
                : otpCountdown > 0
                  ? `${otpCountdown}s`
                  : otpViaEmail
                    ? "Send email OTP"
                    : "Send OTP"}
            </button>
          </div>
        </div>

        {modeAlreadySet && !canUpdate && (
          <p className="text-[13px] text-[#f87171] font-semibold leading-snug px-0.5">
            This method is saved. Next change allowed
            {nextUpdateAt
              ? ` after ${new Date(nextUpdateAt).toLocaleString()}`
              : " after 24 hours"}
            . You can still add other missing methods.
          </p>
        )}
      </div>

      {error && (
        <div
          className="mx-3 mt-3 px-3 py-2 rounded-lg text-[13px] text-[#FD565C]"
          style={{ background: "rgba(229,56,59,0.12)" }}
        >
          {error}
        </div>
      )}

      <div className="mx-3 mt-8">
        <button
          type="button"
          disabled={saving || !canSave}
          onClick={() => void handleSave()}
          className="w-full h-12 rounded-full font-bold text-[17px] tracking-widest disabled:opacity-45 active:scale-[0.99]"
          style={{
            background: canSave
              ? "linear-gradient(180deg,#e8e4df 0%,#cfc8c0 100%)"
              : "#3a3538",
            color: canSave ? "#2a2428" : "rgba(255,255,255,0.35)",
          }}
        >
          {saving ? "Saving…" : "S a v e"}
        </button>
      </div>

      {netSheet && (
        <div
          className="fixed inset-0 z-[140] flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => setNetSheet(false)}
        >
          <div
            className="w-full max-w-[min(100vw,430px)] rounded-t-[18px] overflow-hidden pb-[env(safe-area-inset-bottom,0px)]"
            style={{ background: "#1a1519" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 h-12 border-b border-white/5">
              <button
                type="button"
                className="text-white/50 font-semibold text-[16px]"
                onClick={() => setNetSheet(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="text-[#FED358] font-bold text-[16px]"
                onClick={() => setNetSheet(false)}
              >
                Confirm
              </button>
            </div>
            {(
              [
                {
                  id: "BEP20" as const,
                  label: "BEP20",
                  sub: "BNB Smart Chain",
                },
                { id: "TRC20" as const, label: "TRC20", sub: "Tron network" },
              ] as const
            ).map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  // Persist draft for current network, then load the other chain
                  if (network === "TRC20") setSavedTrc20(tronAddress.trim());
                  else setSavedBep20(tronAddress.trim());
                  const next =
                    n.id === "TRC20"
                      ? network === "TRC20"
                        ? tronAddress
                        : savedTrc20
                      : network === "BEP20"
                        ? tronAddress
                        : savedBep20;
                  setNetwork(n.id);
                  setTronAddress(next);
                  setNetSheet(false);
                }}
                className="w-full py-3.5 px-4 text-left active:bg-white/[0.04]"
                style={{
                  color:
                    network === n.id ? "#FED358" : "rgba(255,255,255,0.55)",
                }}
              >
                <span className="block text-[17px] font-bold">{n.label}</span>
                <span className="block text-[13px] opacity-60 mt-0.5">
                  {n.sub}
                </span>
              </button>
            ))}
            <div className="h-4" />
          </div>
        </div>
      )}
    </div>
  );
}

function FieldLabel({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[15px] font-bold text-[#FED358]">
      <span className="text-[18px] opacity-90">{icon}</span>
      {text}
    </div>
  );
}
