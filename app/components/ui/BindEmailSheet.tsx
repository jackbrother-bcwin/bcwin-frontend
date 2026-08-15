"use client";

/**
 * Bottom sheet: bind email to account (once).
 * Uses GET /otp?method=email + PUT /user/bind-email.
 */

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import * as api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "./Toast";
import { useSpaBackClose } from "../../hooks/useSpaBackClose";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

interface Props {
  open: boolean;
  onClose: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function BindEmailSheet({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const alreadyBound = Boolean(user?.email?.trim());

  useSpaBackClose(open, onClose, "bind-email");
  useBodyScrollLock(open);

  useEffect(() => {
    if (open) {
      setEmail("");
      setOtp("");
      setOtpSent(false);
      setError(null);
      setSending(false);
      setSaving(false);
      setCooldown(0);
    }
  }, [open]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  if (!open) return null;

  const sendOtp = async () => {
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) {
      setError("Enter a valid email address");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await api.sendOtp({ method: "email", email: e });
      setOtpSent(true);
      setCooldown(120);
      toast("OTP sent to your email", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send OTP";
      setError(msg);
      toast(msg, "error");
    } finally {
      setSending(false);
    }
  };

  const onConfirm = async () => {
    const e = email.trim().toLowerCase();
    const code = otp.trim();
    if (!EMAIL_RE.test(e)) {
      setError("Enter a valid email address");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit OTP");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await api.bindEmail({ email: e, otp: code });
      await refreshUser();
      toast(res.message || "Email bound successfully", "success");
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to bind email";
      setError(msg);
      toast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative z-[1] w-full max-w-lg mx-auto rounded-t-2xl px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        style={{
          background: "#241E22",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bind-email-title"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />
        <h2
          id="bind-email-title"
          className="text-center text-[16px] font-bold text-[#FDE4BC] mb-4"
        >
          {t("settings.bindMailbox", { defaultValue: "Bind mailbox" })}
        </h2>

        {alreadyBound ? (
          <>
            <p className="text-[12px] text-white/45 mb-1.5">
              {t("settings.boundEmail", { defaultValue: "Bound email" })}
            </p>
            <p className="text-[15px] font-semibold text-white break-all mb-5">
              {user?.email}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 rounded-full text-[14px] font-bold text-[#5c3a08]"
              style={{
                background:
                  "linear-gradient(180deg, #FFE9A8 0%, #FED358 50%, #E8A84A 100%)",
              }}
            >
              {t("common.close", { defaultValue: "Close" })}
            </button>
          </>
        ) : (
          <>
            <label className="block text-[12px] text-white/45 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              autoComplete="email"
              autoFocus
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              className="w-full h-12 rounded-xl px-3.5 text-[15px] font-semibold text-white outline-none border border-white/10 focus:border-[#FED358]/55"
              style={{ background: "#1a1518" }}
              placeholder="you@example.com"
            />

            <div className="mt-3 flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                  if (error) setError(null);
                }}
                className="flex-1 h-12 rounded-xl px-3.5 text-[15px] font-semibold text-white outline-none border border-white/10 focus:border-[#FED358]/55 tracking-widest"
                style={{ background: "#1a1518" }}
                placeholder="6-digit OTP"
              />
              <button
                type="button"
                disabled={sending || cooldown > 0}
                onClick={() => void sendOtp()}
                className="shrink-0 h-12 px-3.5 rounded-xl text-[12px] font-bold text-[#5c3a08] disabled:opacity-50"
                style={{
                  background:
                    "linear-gradient(180deg, #FFE9A8 0%, #FED358 50%, #E8A84A 100%)",
                }}
              >
                {sending
                  ? "…"
                  : cooldown > 0
                    ? `${cooldown}s`
                    : otpSent
                      ? "Resend"
                      : "Send OTP"}
              </button>
            </div>

            {otpSent ? (
              <p className="mt-2 text-[11px] text-white/40">
                OTP sent. Valid for 5 minutes.
              </p>
            ) : null}

            {error ? (
              <p className="mt-2 text-[12px] text-red-400 font-medium">{error}</p>
            ) : null}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="h-11 rounded-full text-[14px] font-semibold text-white/70 active:opacity-80"
                style={{
                  background: "#1a1518",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void onConfirm()}
                disabled={saving || !otpSent}
                className="h-11 rounded-full text-[14px] font-bold text-[#5c3a08] active:scale-[0.98] disabled:opacity-60"
                style={{
                  background:
                    "linear-gradient(180deg, #FFE9A8 0%, #FED358 50%, #E8A84A 100%)",
                }}
              >
                {saving ? "Saving…" : "Confirm"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
