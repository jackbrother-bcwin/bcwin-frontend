"use client";

/**
 * Bottom sheet: edit nickname (maps to User.username via existing API).
 * FE-only — uses PUT /user/update-username.
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

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

function validateUsername(raw: string): string | null {
  const v = raw.trim();
  if (v.length < 3) return "Nickname must be at least 3 characters";
  if (v.length > 20) return "Nickname must be at most 20 characters";
  if (!USERNAME_RE.test(v)) {
    return "Only letters, numbers, and underscores";
  }
  return null;
}

export default function EditNicknameSheet({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useSpaBackClose(open, onClose, "edit-nickname");
  useBodyScrollLock(open);

  useEffect(() => {
    if (open) {
      setValue(user?.username ?? "");
      setError(null);
      setSaving(false);
    }
  }, [open, user?.username]);

  if (!open) return null;

  const onSave = async () => {
    const next = value.trim();
    const clientErr = validateUsername(next);
    if (clientErr) {
      setError(clientErr);
      return;
    }
    if (next === user?.username) {
      setError("New nickname must be different");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await api.updateUsername(next);
      await refreshUser();
      toast(res.message || "Nickname updated", "success");
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update nickname";
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
        style={{ background: "#241E22", border: "1px solid rgba(255,255,255,0.06)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-nick-title"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />
        <h2
          id="edit-nick-title"
          className="text-center text-[18px] font-bold text-[#FDE4BC] mb-4"
        >
          {t("settings.editNickname", { defaultValue: "Edit nickname" })}
        </h2>

        <label className="block text-[14px] text-white/45 mb-1.5">
          {t("settings.nickname")}
        </label>
        <input
          type="text"
          value={value}
          maxLength={20}
          autoFocus
          autoComplete="username"
          spellCheck={false}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void onSave();
          }}
          className="w-full h-12 rounded-xl px-3.5 text-[17px] font-semibold text-white outline-none border border-white/10 focus:border-[#FED358]/55"
          style={{ background: "#1a1518" }}
          placeholder="3–20 letters, numbers, _"
        />
        <p className="mt-1.5 text-[13px] text-white/35">
          3–20 characters · letters, numbers, underscore only
        </p>
        {error ? (
          <p className="mt-2 text-[14px] text-red-400 font-medium">{error}</p>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-11 rounded-full text-[16px] font-semibold text-white/70 active:opacity-80"
            style={{ background: "#1a1518", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {t("profile.cancel", { defaultValue: "Cancel" })}
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving}
            className="h-11 rounded-full text-[16px] font-bold text-[#5c3a08] active:scale-[0.98] disabled:opacity-60"
            style={{
              background:
                "linear-gradient(180deg, #FFE9A8 0%, #FED358 50%, #E8A84A 100%)",
            }}
          >
            {saving
              ? t("common.saving", { defaultValue: "Saving…" })
              : t("profile.confirm", { defaultValue: "Confirm" })}
          </button>
        </div>
      </div>
    </div>
  );
}
