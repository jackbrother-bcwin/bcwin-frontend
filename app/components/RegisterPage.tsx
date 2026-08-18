"use client";

import { asset } from "../lib/cdn";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useAuthActions } from "../context/AuthContext";
import * as api from "../lib/api";
import { sanitizeErrorMessage } from "../lib/safe";
import CountryCodeSelect from "./ui/CountryCodeSelect";
import { getCountryOption, isSmsOtpCountryCode } from "../lib/countryPhone";

interface RegisterPageProps {
  onBack: () => void;
  onLoginClick: () => void;
  onSuccess?: () => void;
}

const fieldStyle: React.CSSProperties = {
  background: "#382E35",
  border: "1px solid rgba(255,255,255,0.06)",
};

export default function RegisterPage({ onBack, onLoginClick, onSuccess }: RegisterPageProps) {
  const { register } = useAuthActions();
  const [registerMethod, setRegisterMethod] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agree, setAgree] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [countryCode, setCountryCode] = useState<string>("91");
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  // Prefill invite code from invitation link (?ref= / sessionStorage)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const q = new URLSearchParams(window.location.search);
      const fromUrl =
        q.get("ref")?.trim() ||
        q.get("invite")?.trim() ||
        q.get("code")?.trim() ||
        "";
      const fromStore =
        sessionStorage.getItem("bcwin_invite_ref")?.trim() || "";
      const code = fromUrl || fromStore;
      if (code) setInviteCode(code);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const countryMeta = getCountryOption(countryCode);

  const isValidEmail = (v: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  /** OTP rate limiting via sessionStorage — max 5 per target per session */
  const getOtpKey = (target: string) => `otp_ts_${target}`;
  const canSendOtp = (target: string): { allowed: boolean; reason?: string } => {
    try {
      const raw = sessionStorage.getItem(getOtpKey(target));
      if (!raw) return { allowed: true };
      const entries: number[] = JSON.parse(raw);
      if (entries.length >= 5)
        return {
          allowed: false,
          reason: "Too many OTP requests. Please try again later.",
        };
      const last = entries[entries.length - 1];
      if (last && Date.now() - last < 60_000)
        return {
          allowed: false,
          reason: "Please wait before requesting another OTP",
        };
      return { allowed: true };
    } catch {
      return { allowed: true };
    }
  };
  const recordOtpSend = (target: string) => {
    try {
      const raw = sessionStorage.getItem(getOtpKey(target));
      const entries: number[] = raw ? JSON.parse(raw) : [];
      entries.push(Date.now());
      sessionStorage.setItem(getOtpKey(target), JSON.stringify(entries));
    } catch {
      /* ignore */
    }
  };

  const handleSendOtp = async () => {
    setError(null);

    if (registerMethod === "email") {
      const em = email.trim().toLowerCase();
      if (!isValidEmail(em)) {
        setError("Please enter a valid email address first");
        return;
      }
      // Backend register still requires a mobile — collect before OTP so form is complete
      if (phone.trim().length !== countryMeta.maxLen) {
        setError(
          `Also enter a valid ${countryMeta.maxLen}-digit mobile for ${countryMeta.name} (required on account)`
        );
        return;
      }
      const check = canSendOtp(`email:${em}`);
      if (!check.allowed) {
        setError(check.reason ?? "Please wait before requesting another OTP");
        return;
      }
      setIsSendingOtp(true);
      try {
        await api.sendOtp({ method: "email", email: em });
        recordOtpSend(`email:${em}`);
        setOtpSent(true);
        setCountdown(60);
      } catch (err: unknown) {
        setError(
          sanitizeErrorMessage(err, "Failed to send OTP. Please try again.")
        );
      } finally {
        setIsSendingOtp(false);
      }
      return;
    }

    const mobileNumber = phone.trim();
    const len = countryMeta.maxLen;
    if (!mobileNumber || mobileNumber.length !== len) {
      setError(
        `Please enter a valid ${len}-digit mobile number for ${countryMeta.name}`
      );
      return;
    }
    const check = canSendOtp(`m:${countryCode}:${mobileNumber}`);
    if (!check.allowed) {
      setError(check.reason ?? "Please wait before requesting another OTP");
      return;
    }
    setIsSendingOtp(true);
    try {
      await api.sendOtp({
        method: "mobileNumber",
        mobileNumber,
        countryCode,
      });
      recordOtpSend(`m:${countryCode}:${mobileNumber}`);
      setOtpSent(true);
      setCountdown(60);
    } catch (err: unknown) {
      setError(
        sanitizeErrorMessage(err, "Failed to send OTP. Please try again.")
      );
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError("Password must contain at least one lowercase letter");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least one uppercase letter");
      return;
    }
    if (!/\d/.test(password)) {
      setError("Password must contain at least one number");
      return;
    }
    if (!/[^a-zA-Z0-9]/.test(password)) {
      setError(
        "Password must contain at least one special character (e.g., !@#$%^&*)"
      );
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!agree) {
      setError("Please agree to the Privacy Agreement to continue");
      return;
    }
    if (!otp || otp.length !== 6) {
      setError(
        registerMethod === "email"
          ? "Please enter the 6-digit OTP sent to your email"
          : "Please enter the 6-digit OTP sent to your phone"
      );
      return;
    }
    if (!nickname.trim()) {
      setError("Please enter a nickname");
      return;
    }
    if (nickname.trim().length < 3 || nickname.trim().length > 20) {
      setError("Nickname must be 3–20 characters");
      return;
    }
    // Backend always requires mobileNumber
    if (phone.trim().length !== countryMeta.maxLen) {
      setError(
        `Enter a valid ${countryMeta.maxLen}-digit mobile for ${countryMeta.name}`
      );
      return;
    }
    if (registerMethod === "email" && !isValidEmail(email)) {
      setError("Enter a valid email address");
      return;
    }
    if (!inviteCode.trim()) {
      setError("Invite code is required");
      return;
    }

    const mobileNumber = phone.trim();
    const username = nickname.trim();

    setIsLoading(true);
    try {
      await register({
        username,
        password,
        mobileNumber,
        otp,
        countryCode,
        email:
          registerMethod === "email"
            ? email.trim().toLowerCase()
            : undefined,
        referredBy: inviteCode.trim(),
      });
      onSuccess?.();
    } catch (err: unknown) {
      setError(
        sanitizeErrorMessage(err, "Registration failed. Please try again.")
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen w-full max-w-full flex-1 flex-col pb-6"
      style={{ background: "#110D14" }}
    >
      {/* Header — fixed so it never scrolls away */}
      <header className="app-page-header app-page-header--lg app-fixed-chrome fixed top-0 z-50">
        <div className="app-page-header-inner gap-2">
        <button
          type="button"
          onClick={onBack}
          className="home-icon-btn shrink-0"
          aria-label="Back"
          style={{
            background: "rgba(255,255,255,0.06)",
            borderColor: "rgba(255,255,255,0.14)",
            color: "rgba(255,255,255,0.85)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="relative h-8 w-[96px] min-w-0 shrink sm:w-[120px]">
          <Image
            src={asset("/assets/png/bcwin.png")}
            alt="BCWin"
            fill
            sizes="120px"
            className="object-contain"
            priority
          />
        </div>

        <button
          type="button"
          className="flex h-7 min-h-7 max-h-7 w-auto shrink-0 items-center justify-center rounded-full px-2.5 text-[11px] font-bold text-white"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
          aria-label="Language"
        >
          EN
        </button>
        </div>
      </header>
      <div className="app-page-header-spacer app-page-header-spacer--lg" aria-hidden />

      <div className="flex w-full min-w-0 max-w-full flex-1 flex-col px-3.5 pt-4 sm:px-5">
        <h1 className="mb-1 text-[18px] font-bold tracking-wide text-white sm:text-[20px]">Register</h1>
        <p className="text-[12px] leading-relaxed text-white/45">
          Register with phone number or email
        </p>

        {/* Short tab labels — long text was overflowing on Z30-class widths */}
        <div
          className="mb-5 mt-5 flex w-full min-w-0"
          style={{ borderBottom: "1.5px solid rgba(255,255,255,0.06)" }}
        >
          {(["phone", "email"] as const).map((method) => {
            const active = registerMethod === method;
            return (
              <button
                key={method}
                type="button"
                onClick={() => {
                  setRegisterMethod(method);
                  setOtp("");
                  setOtpSent(false);
                  setCountdown(0);
                  setError(null);
                  // Phone OTP only supports SMS markets — snap back if needed
                  if (method === "phone" && !isSmsOtpCountryCode(countryCode)) {
                    setCountryCode("91");
                    setPhone("");
                  }
                }}
                className="relative min-w-0 flex-1 pb-2.5 text-center text-[12px] font-bold sm:text-[13px]"
                style={{ color: active ? "#FED358" : "rgba(255,255,255,0.4)" }}
              >
                {method === "phone" ? "Phone" : "Email"}
                {active && (
                  <span
                    className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full"
                    style={{ background: "#FED358" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="flex w-full min-w-0 max-w-full flex-col gap-3.5">
          {registerMethod === "email" && (
            <div className="flex min-w-0 flex-col gap-2">
              <label className="text-[12px] font-bold text-white/70">
                Email address
              </label>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full min-w-0 rounded-xl px-3 text-[13px] text-white outline-none placeholder:text-white/20 focus:border-[#FED358]"
                style={{
                  ...fieldStyle,
                  border: "1px solid rgba(254,211,88,0.18)",
                }}
                required
              />
              <p className="text-[10px] text-white/35">
                OTP will be sent to this email
              </p>
            </div>
          )}

          {/* Backend always requires mobileNumber on register */}
          <div className="flex min-w-0 flex-col gap-2">
            <label className="text-[12px] font-bold text-white/70">
              Phone number
              {registerMethod === "email" && (
                <span className="ml-1 font-medium text-white/40">
                  (required)
                </span>
              )}
            </label>
            <div className="flex min-w-0 gap-2">
              <CountryCodeSelect
                mode={registerMethod === "email" ? "all" : "sms"}
                value={countryCode}
                onChange={(code) => {
                  setCountryCode(code);
                  setPhone("");
                  setError(null);
                }}
              />
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder={countryMeta.placeholder}
                value={phone}
                onChange={(e) =>
                  setPhone(
                    e.target.value
                      .replace(/\D/g, "")
                      .slice(0, countryMeta.maxLen)
                  )
                }
                className="h-11 min-w-0 flex-1 rounded-xl px-3 text-[13px] text-white outline-none placeholder:text-white/20 focus:border-[#FED358]"
                style={{
                  ...fieldStyle,
                  border: "1px solid rgba(254,211,88,0.18)",
                }}
                required
              />
            </div>
            <p className="text-[10px] text-white/35">
              {countryMeta.flag} {countryMeta.name} · +{countryMeta.code}
              {registerMethod === "phone"
                ? " · OTP via SMS"
                : " · linked to account"}
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <label className="text-[12px] font-bold text-white/70">
              Verification code
            </label>
            <div className="flex min-w-0 gap-2">
              <input
                type="text"
                inputMode="numeric"
                placeholder="6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-11 min-w-0 flex-1 rounded-lg px-3 text-[13px] text-white outline-none placeholder:text-white/20 focus:border-[#FED358]"
                style={fieldStyle}
                required
              />
              <button
                type="button"
                disabled={countdown > 0 || isSendingOtp}
                onClick={handleSendOtp}
                className="h-11 shrink-0 rounded-lg px-2.5 text-[11px] font-bold text-[#110D14] disabled:opacity-50 sm:text-[12px]"
                style={{
                  background: "linear-gradient(180deg, #FED358 0%, #FFB472 100%)",
                  minWidth: "4.5rem",
                }}
              >
                {isSendingOtp ? "…" : countdown > 0 ? `${countdown}s` : "OTP"}
              </button>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <label className="text-[12px] font-bold text-white/70">Set password</label>
            <div className="relative min-w-0">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Set password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full min-w-0 rounded-lg pl-3 pr-10 text-[13px] text-white outline-none placeholder:text-white/20 focus:border-[#FED358]"
                style={fieldStyle}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/35"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <label className="text-[12px] font-bold text-white/70">Confirm password</label>
            <div className="relative min-w-0">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-11 w-full min-w-0 rounded-lg pl-3 pr-10 text-[13px] text-white outline-none placeholder:text-white/20 focus:border-[#FED358]"
                style={fieldStyle}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/35"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <label className="text-[12px] font-bold text-white/70">Nickname</label>
            <input
              type="text"
              placeholder="Choose a nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 20))}
              className="h-11 w-full min-w-0 rounded-lg px-3 text-[13px] text-white outline-none placeholder:text-white/20 focus:border-[#FED358]"
              style={fieldStyle}
              maxLength={20}
            />
          </div>

          {/* Password strength hints */}
          {password.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] px-0.5">
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

          <div className="flex min-w-0 flex-col gap-2">
            <label className="text-[12px] font-bold text-white/70">
              Invite code <span className="text-[#FED358]">*</span>
            </label>
            <input
              type="text"
              placeholder="Enter invite code (required)"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="h-11 w-full min-w-0 rounded-lg px-3 text-[13px] text-white outline-none placeholder:text-white/20 focus:border-[#FED358]"
              style={fieldStyle}
              required
              autoComplete="off"
              aria-required
            />
            <p className="text-[10px] text-white/35">
              You need a valid invite code from an existing member to register
            </p>
          </div>

          <div className="mt-1 flex min-w-0 items-start gap-2">
            <button
              type="button"
              onClick={() => setAgree((v) => !v)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded-full border"
              style={{
                background: agree ? "#FED358" : "transparent",
                borderColor: agree ? "#FED358" : "rgba(255,255,255,0.25)",
              }}
              aria-pressed={agree}
              aria-label="Agree to privacy"
            />
            <span
              className="min-w-0 flex-1 text-[11px] font-medium leading-snug text-white/50 sm:text-[12px]"
              onClick={() => setAgree((v) => !v)}
              role="presentation"
            >
              I have read and agree{" "}
              <span className="text-[#FED358]">【Privacy Agreement】</span>
            </span>
          </div>

          {error && (
            <div
              className="rounded-lg px-3 py-2.5 text-[12px] font-medium break-words"
              style={{
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#FD565C",
              }}
            >
              {error}
            </div>
          )}

          {otpSent && !error && (
            <div
              className="rounded-lg px-3 py-2 text-[12px] font-medium"
              style={{
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.3)",
                color: "#40AD72",
              }}
            >
              {registerMethod === "email"
                ? "OTP sent! Check your email inbox."
                : "OTP sent! Check your SMS messages."}
            </div>
          )}

          <div className="mt-3 flex w-full min-w-0 flex-col gap-2.5">
            <button
              type="submit"
              disabled={isLoading}
              className="h-10 w-full rounded-full text-[14px] font-bold text-[#110D14] disabled:opacity-60"
              style={{
                background: "linear-gradient(180deg, #FED358 0%, #FFB472 100%)",
                boxShadow: "0 2px 10px rgba(254,211,88,0.4)",
              }}
            >
              {isLoading ? "Registering…" : "Register"}
            </button>
            <button
              type="button"
              onClick={onLoginClick}
              className="h-10 w-full rounded-full text-[14px] font-bold text-[#FED358]"
              style={{ background: "transparent", border: "1.5px solid #FED358" }}
            >
              I have an account · Login
            </button>
          </div>
        </form>

        <div className="mt-8 flex flex-wrap justify-center gap-8 text-[11px] font-bold text-white/50 sm:gap-12 sm:text-[12px]">
          <button type="button" className="flex flex-col items-center gap-1.5">
            <span className="home-icon-btn" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FED358" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <span>Forgot password</span>
          </button>
          <button type="button" className="flex flex-col items-center gap-1.5">
            <span className="home-icon-btn" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FED358" strokeWidth="2.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </span>
            <span>Customer Service</span>
          </button>
        </div>
      </div>
    </div>
  );
}
