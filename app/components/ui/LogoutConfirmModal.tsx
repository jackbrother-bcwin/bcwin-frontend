"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useSpaBackClose } from "../../hooks/useSpaBackClose";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

interface LogoutConfirmModalProps {
  open: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loadingLabel?: string;
}

/**
 * Centered logout confirmation — dark card, red ! badge,
 * gold Confirm + outlined Cancel (matches account reference UI).
 */
export default function LogoutConfirmModal({
  open,
  onConfirm,
  onCancel,
  loading = false,
  title,
  confirmLabel,
  cancelLabel,
  loadingLabel,
}: LogoutConfirmModalProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useSpaBackClose(open, onCancel, "logout-confirm");
  useBodyScrollLock(open);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      {/* Semi-transparent dark backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0, 0, 0, 0.72)" }}
        aria-hidden
      />

      {/* Modal card */}
      <div
        className="relative z-10 w-full max-w-[320px] px-6 pt-7 pb-6"
        style={{
          background: "#222225",
          borderRadius: 18,
          boxShadow:
            "0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        {/* Red ! circle */}
        <div className="mb-4 flex justify-center">
          <div
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full"
            style={{
              background: "#FF4D4D",
              boxShadow: "0 4px 16px rgba(255, 77, 77, 0.4)",
            }}
            aria-hidden
          >
            <span
              className="select-none font-black leading-none text-white"
              style={{ fontSize: 30, marginTop: -2 }}
            >
              !
            </span>
          </div>
        </div>

        {/* Question */}
        <h2
          id="logout-confirm-title"
          className="mb-6 text-center text-[18px] font-semibold leading-snug"
          style={{ color: "#FFE8D6" }}
        >
          {title ?? t("profile.logoutConfirm", "Do you want to log out?")}
        </h2>

        {/* Actions — stacked full-width pills */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => void onConfirm()}
            className="h-[46px] w-full rounded-full text-[17px] font-bold active:scale-[0.98] transition-transform disabled:opacity-70"
            style={{
              background: "linear-gradient(180deg, #FFD166 0%, #FFA03D 100%)",
              color: "#1A1A1A",
              boxShadow: "0 4px 14px rgba(255, 160, 61, 0.35)",
            }}
          >
            {loading
              ? loadingLabel ?? t("profile.loggingOut", "Logging out…")
              : confirmLabel ?? t("profile.confirmLogout", "Confirm")}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="h-[46px] w-full rounded-full text-[17px] font-bold active:scale-[0.98] transition-transform disabled:opacity-50"
            style={{
              background: "transparent",
              color: "#FFC107",
              border: "1.5px solid #FFC107",
            }}
          >
            {cancelLabel ?? t("profile.cancelLogout", "Cancel")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
