"use client";

import React from "react";

export default function EmptyState({
  title = "Nothing here yet",
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
        style={{ background: "rgba(254,211,88,0.1)", border: "1px solid rgba(254,211,88,0.2)" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FED358" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12h8M12 8v8" opacity="0.4" />
        </svg>
      </div>
      <p className="text-sm font-bold text-white/80">{title}</p>
      {subtitle && <p className="text-[11px] text-white/40 mt-1 max-w-[240px]">{subtitle}</p>}
    </div>
  );
}
