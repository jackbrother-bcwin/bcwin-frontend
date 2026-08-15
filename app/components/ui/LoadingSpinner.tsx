"use client";

import React from "react";

export default function LoadingSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div
        className="w-9 h-9 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: "rgba(254,211,88,0.25)", borderTopColor: "#FED358" }}
      />
      <span className="text-[11px] text-white/45">{label}</span>
    </div>
  );
}
