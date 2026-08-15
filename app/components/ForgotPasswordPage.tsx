"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import * as api from "../lib/api";
import { useToast } from "./ui/Toast";
import { sanitizeErrorMessage } from "../lib/safe";
import CountryCodeSelect from "./ui/CountryCodeSelect";
import {
  getCountryOption,
  type CountryCode,
} from "../lib/countryPhone";

interface Props {
  onBack: () => void;
  onLoginClick: () => void;
}

export default function ForgotPasswordPage({ onBack, onLoginClick }: Props) {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState<CountryCode>("91");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countryMeta = getCountryOption(countryCode);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  /** OTP rate limiting via sessionStorage — max 5 per full number per session */
  const getOtpKey = (cc: string, num: string) => `otp_forgot_${cc}_${num}`;
  const canSendOtp = (cc: string, num: string): { allowed: boolean; reason?: string } => {
    try {
      const raw = sessionStorage.getItem(getOtpKey(cc, num));
      if (!raw) return { allowed: true };
      const entries: number[] = JSON.parse(raw);
      if (entries.length >= 5) return { allowed: false, reason: "Too many OTP requests. Please try again later." };
      const last = entries[entries.length - 1];
      if (last && Date.now() - last < 60_000) return { allowed: false, reason: "Please wait before requesting another OTP" };
      return { allowed: true };
    } catch {
      return { allowed: true };
    }
  };
  const recordOtpSend = (cc: string, num: string) => {
    try {
      const raw = sessionStorage.getItem(getOtpKey(cc, num));
      const entries: number[] = raw ? JSON.parse(raw) : [];
      entries.push(Date.now());
      sessionStorage.setItem(getOtpKey(cc, num), JSON.stringify(entries));
    } catch { /* ignore */ }
  };

  const sendOtp = async () => {
    if (phone.trim().length !== countryMeta.maxLen) {
      setError(
        `Enter a valid ${countryMeta.maxLen}-digit mobile for ${countryMeta.name}`
      );
      return;
    }
    const check = canSendOtp(countryCode, phone.trim());
    if (!check.allowed) {
      setError(check.reason ?? "Please wait before requesting another OTP");
      return;
    }
    setError(null);
    setSending(true);
    try {
      await api.sendOtp({
        method: "mobileNumber",
        mobileNumber: phone.trim(),
        countryCode,
        purpose: "reset",
      });
      recordOtpSend(countryCode, phone.trim());
      setCountdown(60);
      toast("OTP sent", "success");
    } catch (e: unknown) {
      setError(sanitizeErrorMessage(e, "Failed to send OTP"));
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (phone.trim().length !== countryMeta.maxLen)
      return setError("Invalid mobile number");
    if (otp.length !== 6) return setError("Enter 6-digit OTP");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (!/[a-z]/.test(password)) return setError("Password must contain at least one lowercase letter");
    if (!/[A-Z]/.test(password)) return setError("Password must contain at least one uppercase letter");
    if (!/\d/.test(password)) return setError("Password must contain at least one number");
    if (!/[^a-zA-Z0-9]/.test(password)) return setError("Password must contain at least one special character");
    if (password !== confirm) return setError("Passwords do not match");
    setLoading(true);
    try {
      await api.forgotPassword({
        mobileNumber: phone.trim(),
        otp,
        password,
        countryCode,
      });
      toast("Password reset successfully", "success");
      onLoginClick();
    } catch (err: unknown) {
      setError(sanitizeErrorMessage(err, "Reset failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen pb-6" style={{ background: "#110D14" }}>
      <header className="app-page-header app-page-header--lg app-fixed-chrome fixed top-0 z-50">
        <div className="app-page-header-inner">
          <button
            type="button"
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center text-white/80"
            aria-label="Back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div style={{ position: "relative", width: "120px", height: "36px" }}>
            <Image src="/assets/png/bcwin.png" alt="BCWin" fill sizes="120px" className="object-contain" />
          </div>
          <div className="w-8" />
        </div>
      </header>
      <div className="app-page-header-spacer app-page-header-spacer--lg" aria-hidden />

      <form onSubmit={handleSubmit} className="px-5 pt-5 flex flex-col flex-1">
        <h1 className="text-[20px] font-bold text-white mb-1">Reset password</h1>
        <p className="text-[12px] text-white/45 mb-5">Verify OTP and set a new password</p>

        <label className="text-[11px] text-white/50 mb-1">Mobile number</label>
        <div className="flex gap-2 mb-3">
          <CountryCodeSelect
            value={countryCode}
            onChange={(code) => {
              setCountryCode(code);
              setPhone("");
              setError(null);
            }}
          />
          <input
            value={phone}
            onChange={(e) =>
              setPhone(
                e.target.value.replace(/\D/g, "").slice(0, countryMeta.maxLen)
              )
            }
            placeholder={countryMeta.placeholder}
            className="flex-1 h-11 rounded-xl px-4 text-sm text-white outline-none"
            style={{
              background: "#382E35",
              border: "1px solid rgba(254,211,88,0.18)",
            }}
          />
          <button
            type="button"
            disabled={sending || countdown > 0}
            onClick={sendOtp}
            className="px-3 h-11 rounded-xl text-[11px] font-bold text-[#110D14] disabled:opacity-50"
            style={{ background: "linear-gradient(180deg, #FED358 0%, #FFB472 100%)" }}
          >
            {countdown > 0 ? `${countdown}s` : sending ? "…" : "OTP"}
          </button>
        </div>

        <label className="text-[11px] text-white/50 mb-1">OTP</label>
        <input
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="6-digit OTP"
          className="w-full h-11 rounded-xl px-4 text-sm text-white outline-none mb-3 tracking-widest"
          style={{ background: "#382E35", border: "1px solid rgba(255,255,255,0.08)" }}
        />

        <label className="text-[11px] text-white/50 mb-1">New password</label>
        <div className="relative mb-3">
          <input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            className="w-full h-11 rounded-xl px-4 pr-10 text-sm text-white outline-none"
            style={{ background: "#382E35", border: "1px solid rgba(255,255,255,0.08)" }}
          />
          <button type="button" onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 text-[11px]">
            {showPw ? "Hide" : "Show"}
          </button>
        </div>

        <label className="text-[11px] text-white/50 mb-1">Confirm password</label>
        <input
          type={showPw ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter password"
          className="w-full h-11 rounded-xl px-4 text-sm text-white outline-none mb-1"
          style={{ background: "#382E35", border: "1px solid rgba(255,255,255,0.08)" }}
        />

        {/* Password strength hints */}
        {password.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] px-0.5 mb-3">
            {[
              { ok: password.length >= 8, label: "8+ chars" },
              { ok: /[a-z]/.test(password), label: "lowercase" },
              { ok: /[A-Z]/.test(password), label: "UPPERCASE" },
              { ok: /\d/.test(password), label: "number" },
              { ok: /[^a-zA-Z0-9]/.test(password), label: "special (!@#)" },
            ].map((r) => (
              <span key={r.label} style={{ color: r.ok ? "#40AD72" : "rgba(255,255,255,0.35)" }}>
                {r.ok ? "✓" : "○"} {r.label}
              </span>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg text-[11px] text-[#FD565C]"
            style={{ background: "rgba(229,56,59,0.12)" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-full font-bold text-sm text-[#110D14] disabled:opacity-60 mt-2"
          style={{ background: "linear-gradient(180deg, #FED358 0%, #FFB472 100%)" }}
        >
          {loading ? "Resetting…" : "Reset password"}
        </button>

        <button type="button" onClick={onLoginClick} className="mt-4 text-center text-[12px] text-[#FED358]">
          Back to login
        </button>
      </form>
    </div>
  );
}
