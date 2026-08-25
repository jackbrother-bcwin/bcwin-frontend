"use client";

/**
 * HistoryStrip — horizontal scrolling strip of recent race results.
 * Shows top-3 podium as colored number pills, newest on the right.
 * Matches reference screenshot: colored boxes + "1st" label.
 */

import React, { useEffect, useRef } from "react";
import type { MotoPeriod } from "../../lib/api";
import { bikeColor } from "./constants";
import { GameSoundToggle } from "../game/shared";

export function HistoryStrip({ items }: { items: MotoPeriod[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Only show resolved periods (have podium)
  const resolved = items.filter(
    (p) =>
      p.firstPlace != null && p.secondPlace != null && p.thirdPlace != null
  );

  // Auto-scroll to newest (right end) when new results arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollLeft = el.scrollWidth;
    }
  }, [resolved.length]);

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-2"
      style={{
        background: "linear-gradient(180deg, #1e1a22 0%, #151015 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {/* Scrollable result pills */}
      <div
        ref={scrollRef}
        className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar"
        style={{ scrollBehavior: "smooth" }}
      >
        {resolved.length === 0 ? (
          <span className="text-[12px] text-white/25 italic px-1">
            No results yet
          </span>
        ) : (
          resolved.map((p) => {
            const places = [p.firstPlace!, p.secondPlace!, p.thirdPlace!];
            return (
              <div
                key={p.id}
                className="flex items-center gap-[2px] shrink-0"
              >
                {places.map((n, i) => {
                  const c = bikeColor(n);
                  return (
                    <span
                      key={`${p.id}-${i}`}
                      className="inline-flex items-center justify-center rounded-[4px] text-[12px] font-black leading-none tabular-nums shrink-0"
                      style={{
                        width: 22,
                        height: 22,
                        background: `linear-gradient(150deg, ${c.glow}, ${c.primary})`,
                        color: "#fff",
                        textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                        boxShadow: `0 0 6px ${c.primary}44`,
                      }}
                    >
                      {n}
                    </span>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* "1st" label */}
      <span
        className="text-[13px] font-black text-white/70 shrink-0 ml-1"
        style={{ letterSpacing: "0.02em" }}
      >
        1st
      </span>

      {/* Sound toggle */}
      <GameSoundToggle />
    </div>
  );
}
