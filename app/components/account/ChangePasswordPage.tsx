"use client";

/**
 * Change login password — UI matches product screenshot.
 * Frontend-only: verifies current password via login API, then directs to
 * OTP forgot-password flow (no dedicated change-password backend route).
 */

import React, { useState } from "react";
import {
  IoLockClosed,
  IoEyeOutline,
  IoEyeOffOutline,
  IoChevronForward,
} from "react-icons/io5";
import PageHeader from "../ui/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../ui/Toast";
import * as api from "../../lib/api";

interface Props {
  onBack: () => void;
  onNavigate?: (screen: string) => void;
}

export default function ChangePasswordPage({ onBack, onNavigate }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave =
    oldPw.length >= 1 &&
    newPw.length >= 6 &&
    confirmPw.length >= 6 &&
    !saving;

  const handleSave = async () => {
    setError(null);
    if (!oldPw) {
      setError("Please enter your login password");
      return;
    }
    if (newPw.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }
    if (newPw !== confirmPw) {
      setError("New passwords do not match");
      return;
    }
    if (newPw === oldPw) {
      setError("New password must be different from current password");
      return;
    }
    const mobile = user?.mobileNumber;
    if (!mobile) {
      setError("No mobile number on account");
      return;
    }

    setSaving(true);
    try {
      // Verify current password without backend change-password route
      const { parseStoredMobile } = await import("../../lib/countryPhone");
      const parsed = parseStoredMobile(mobile);
      await api.login({
        mobileNumber: parsed.mobileNumber,
        countryCode: parsed.countryCode,
        password: oldPw,
      });
      // Login succeeds → session still valid; dedicated change API not available.
      // Product path for reset without old password is OTP forgot flow.
      toast(
        "Current password verified. Use OTP reset to set a new password.",
        "success"
      );
      onNavigate?.("forgot");
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Current password is incorrect";
      setError(
        /incorrect|invalid|fail|wrong|credential/i.test(msg)
          ? "Current login password is incorrect"
          : msg
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="flex flex-col min-h-screen min-w-0 w-full max-w-full overflow-x-clip pb-[max(2.5rem,env(safe-area-inset-bottom))]"
      style={{ background: "#110D14" }}
    >
      <PageHeader title="Change login password" onBack={onBack} />

      <div className="mx-3 mt-4 space-y-4">
        <PwField
          label="Login password"
          placeholder="Login password"
          value={oldPw}
          onChange={setOldPw}
          show={showOld}
          onToggle={() => setShowOld((v) => !v)}
        />
        <PwField
          label="New login password"
          placeholder="New login password"
          value={newPw}
          onChange={setNewPw}
          show={showNew}
          onToggle={() => setShowNew((v) => !v)}
        />
        <PwField
          label="Confirm new password"
          placeholder="Confirm new password"
          value={confirmPw}
          onChange={setConfirmPw}
          show={showConfirm}
          onToggle={() => setShowConfirm((v) => !v)}
        />
      </div>

      <div className="mx-3 mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => onNavigate?.("forgot")}
          className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-[#c9a227] active:opacity-80"
        >
          Forgot original login password
          <IoChevronForward size={14} />
        </button>
      </div>

      {error && (
        <div
          className="mx-3 mt-3 px-3 py-2 rounded-lg text-[11px] text-[#FD565C]"
          style={{ background: "rgba(229,56,59,0.12)" }}
        >
          {error}
        </div>
      )}

      <div className="mx-3 mt-8">
        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          className="w-full h-12 rounded-full font-bold text-[15px] tracking-wide disabled:opacity-50 active:scale-[0.99]"
          style={{
            background: canSave
              ? "linear-gradient(180deg,#FED358 0%,#E8A84A 100%)"
              : "linear-gradient(180deg,#c4a574 0%,#a88b55 100%)",
            color: "#110D14",
            boxShadow: canSave
              ? "0 4px 16px rgba(254,211,88,0.35)"
              : "none",
          }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function PwField({
  label,
  placeholder,
  value,
  onChange,
  show,
  onToggle,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2 text-[13px] font-bold text-[#FED358]">
        <IoLockClosed size={16} />
        {label}
      </div>
      <div
        className="h-11 rounded-[10px] px-3 flex items-center gap-2 min-w-0"
        style={{
          background: "#2a2428",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <input
          type={show ? "text" : "password"}
          autoComplete="new-password"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-white placeholder:text-white/30"
        />
        <button
          type="button"
          onClick={onToggle}
          className="p-1 text-white/40 active:text-white/70 shrink-0"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <IoEyeOutline size={18} /> : <IoEyeOffOutline size={18} />}
        </button>
      </div>
    </div>
  );
}
