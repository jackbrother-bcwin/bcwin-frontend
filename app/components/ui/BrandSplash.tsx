"use client";

import { asset } from "../../lib/cdn";
import React from "react";
import Image from "next/image";

/**
 * Full-screen BCWin branded loading:
 *  - BG: splashimagebg (casino table)
 *  - Foreground promo: loadingimage (character + free chips art)
 *  - BCWin logo top · spinner bottom
 */
export default function BrandSplash({
  label = "Loading…",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex min-h-[40vh] flex-1 flex-col items-center justify-center gap-3 px-4">
        <div className="relative h-10 w-28">
          <Image
            src={asset("/assets/png/bcwin.png")}
            alt="BCWin"
            fill
            sizes="112px"
            className="object-contain"
            priority
          />
        </div>
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "rgba(254,211,88,0.25)", borderTopColor: "#FED358" }}
          aria-hidden
        />
        <p className="text-[11px] text-white/45">{label}</p>
      </div>
    );
  }

  return (
    <div
      className="brand-splash fixed inset-0 z-[300] flex flex-col overflow-hidden bg-[#1a0e04]"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {/* Layer 1 — full-screen background */}
      <div className="absolute inset-0">
        <Image
          src={asset("/assets/png/splashimagebg.png")}
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
          priority
        />
      </div>

      {/* Layer 2 — earlier splash promo (character art), slightly zoomed out so full text fits */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="relative h-full w-full max-w-[430px]"
          style={{ transform: "scale(0.88)", transformOrigin: "center center" }}
        >
          <Image
            src={asset("/assets/png/loadingimage.png")}
            alt=""
            fill
            sizes="(max-width: 480px) 100vw, 430px"
            className="object-contain object-center"
            priority
          />
        </div>
      </div>

      {/* Soft scrims for logo / spinner */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-24"
        style={{
          background: "linear-gradient(180deg, rgba(10,6,2,0.45) 0%, transparent 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[26%]"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(10,6,2,0.3) 45%, rgba(10,6,2,0.72) 100%)",
        }}
      />

      {/* BCWin logo */}
      <div className="relative z-10 flex flex-col items-center pt-[max(16px,env(safe-area-inset-top))] px-4">
        <div
          className="relative mt-3 h-11 w-[148px] sm:h-12 sm:w-[168px]"
          style={{
            filter:
              "drop-shadow(0 4px 18px rgba(0,0,0,0.55)) drop-shadow(0 0 20px rgba(254,211,88,0.4))",
          }}
        >
          <Image
            src={asset("/assets/png/bcwin.png")}
            alt="BCWin"
            fill
            sizes="168px"
            className="object-contain"
            priority
          />
        </div>
      </div>

      {/* Spinner + label */}
      <div className="relative z-10 mt-auto flex flex-col items-center gap-3 px-6 pb-[max(28px,calc(20px+env(safe-area-inset-bottom)))]">
        <div
          className="h-9 w-9 animate-spin rounded-full border-[3px] border-t-transparent"
          style={{
            borderColor: "rgba(254,211,88,0.25)",
            borderTopColor: "#FED358",
            boxShadow: "0 0 16px rgba(254,211,88,0.3)",
          }}
          aria-hidden
        />
        <span className="text-[12px] font-semibold tracking-wide text-[#FDE4BC]">
          {label}
        </span>
      </div>
    </div>
  );
}
