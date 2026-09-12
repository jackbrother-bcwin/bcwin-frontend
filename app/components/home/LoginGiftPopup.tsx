"use client";

import React from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { asset } from "../../lib/cdn";
import { useSpaBackClose } from "../../hooks/useSpaBackClose";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

export const DEFAULT_TELEGRAM_GIFT_URL =
  "https://telegram.me/+pYiHhtl8XVA4MjVl";

interface Props {
  open: boolean;
  onConfirm: () => void;
  telegramUrl?: string;
}

/**
 * 24-Hour Gift Code Telegram channel popup shown after user login.
 * Matches exact UI:
 * - Golden header: "Receive the gift code within 24 hours"
 * - Graphic banner: "BC BCWIN 24 HOUR GET GIFT CODE"
 * - Claim now : channel link
 * - Golden Confirm button to dismiss
 */
export default function LoginGiftPopup({
  open,
  onConfirm,
  telegramUrl = DEFAULT_TELEGRAM_GIFT_URL,
}: Props) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  useSpaBackClose(open, onConfirm, "login-gift-popup");
  useBodyScrollLock(open);

  if (!open || !mounted) return null;

  const handleOpenChannel = () => {
    if (typeof window !== "undefined") {
      window.open(telegramUrl, "_blank", "noopener,noreferrer");
    }
  };

  return createPortal(
    <div
      className="promo-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Receive the gift code within 24 hours"
    >
      <div
        className="w-full max-w-[340px] sm:max-w-[360px] flex flex-col rounded-2xl overflow-hidden bg-white border border-amber-300/40 shadow-[0_20px_50px_rgba(0,0,0,0.65)]"
        style={{
          animation: "promo-pop 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        {/* Golden top ribbon */}
        <div
          className="w-full py-2.5 px-3 flex items-center justify-center"
          style={{
            background:
              "linear-gradient(180deg, #FFE89C 0%, #FED358 50%, #EAA83C 100%)",
            boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.08)",
          }}
        >
          <h2 className="m-0 text-[15px] sm:text-[16px] font-black text-[#111111] text-center tracking-tight">
            Receive the gift code within 24 hours
          </h2>
        </div>

        {/* Center Graphic */}
        <div className="p-3 pb-1 flex flex-col items-center">
          <div
            onClick={handleOpenChannel}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleOpenChannel();
              }
            }}
            className="w-full relative cursor-pointer overflow-hidden rounded-xl border border-amber-200/60 shadow-sm transition-opacity hover:opacity-95 active:opacity-90"
            title="Click to open Telegram channel"
          >
            <Image
              src="/assets/banner/gift_code_banner.png"
              alt="BCWIN 24 Hour Get Gift Code"
              width={516}
              height={480}
              className="w-full h-auto object-contain block"
              priority
            />
          </div>
        </div>

        {/* Channel Claim Link Section */}
        <div className="px-4 pt-2 pb-1 text-center flex flex-col items-center">
          <p className="m-0 text-[14px] font-bold text-[#111111] mb-0.5">
            Claim now :
          </p>
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] font-bold text-[#1a56db] underline hover:text-blue-800 break-all leading-relaxed transition-colors px-2"
          >
            {telegramUrl}
          </a>
        </div>

        {/* Confirm Button */}
        <div className="px-5 pt-3 pb-4">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full h-11 rounded-full font-black text-[17px] text-[#111111] tracking-wider border-none cursor-pointer flex items-center justify-center transition-transform active:scale-[0.98]"
            style={{
              background:
                "linear-gradient(180deg, #FFDD6B 0%, #FEB82B 50%, #F59E0B 100%)",
              boxShadow:
                "0 4px 16px rgba(251, 191, 36, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
