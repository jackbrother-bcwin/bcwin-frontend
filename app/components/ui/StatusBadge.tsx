"use client";

import React from "react";
import { statusTone, STATUS_COLORS } from "../../lib/format";

/** Map backend bet statuses to player-facing labels (all games). */
export function displayStatusLabel(status: string): string {
  const s = String(status ?? "").toUpperCase();
  if (s === "WON") return "Succeed";
  if (s === "LOST") return "Failed";
  if (s === "PENDING") return "Pending";
  if (s === "SETTLED") return "Succeed";
  return status;
}

export default function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  const color = STATUS_COLORS[tone];
  return (
    <span
      className="inline-flex items-center justify-center px-3 py-0.5 rounded-[6px] text-[13px] font-medium tracking-wide"
      style={{
        color,
        background: `${color}1A`,
        border: `1px solid ${color}55`,
      }}
    >
      {displayStatusLabel(status)}
    </span>
  );
}
