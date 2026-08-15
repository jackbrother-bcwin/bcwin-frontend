"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  COUNTRY_OPTIONS_ALL,
  COUNTRY_OPTIONS_SMS,
  getCountryOption,
  type CountryOption,
} from "../../lib/countryPhone";

export type CountrySelectMode = "sms" | "all";

interface Props {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
  /**
   * sms — only IN/PK/BD (SMS OTP)
   * all — major countries (email-register phone storage)
   */
  mode?: CountrySelectMode;
}

/**
 * Gold-accent country dialing picker.
 * `mode="all"` for email registration (no SMS); `mode="sms"` for phone OTP.
 */
export default function CountryCodeSelect({
  value,
  onChange,
  disabled,
  className = "",
  mode = "sms",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const options = mode === "all" ? COUNTRY_OPTIONS_ALL : COUNTRY_OPTIONS_SMS;
  const selected = getCountryOption(String(value).replace(/\D/g, "") || "91");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso.toLowerCase().includes(q) ||
        c.code.includes(q) ||
        `+${c.code}`.includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const t = window.setTimeout(() => searchRef.current?.focus(), 50);
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // If current value not in this mode's list, snap to first option
  useEffect(() => {
    const ok = options.some((c) => c.code === selected.code);
    if (!ok && options[0]) onChange(options[0].code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const pick = (c: CountryOption) => {
    onChange(c.code);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((v) => !v)}
        className="group flex h-11 min-w-[5.75rem] items-center gap-1.5 rounded-xl px-2.5 transition-all active:scale-[0.98] disabled:opacity-50"
        style={{
          background:
            "linear-gradient(145deg, rgba(56,46,53,0.95) 0%, rgba(36,30,34,0.98) 100%)",
          border: open
            ? "1px solid rgba(254,211,88,0.55)"
            : "1px solid rgba(254,211,88,0.18)",
          boxShadow: open
            ? "0 0 0 3px rgba(254,211,88,0.12), 0 8px 20px rgba(0,0,0,0.35)"
            : "0 2px 8px rgba(0,0,0,0.25)",
        }}
      >
        <span className="text-[16px] leading-none" aria-hidden>
          {selected.flag}
        </span>
        <span className="text-[12px] font-extrabold tracking-wide text-[#FED358]">
          +{selected.code}
        </span>
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="ml-auto text-white/45 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-[80] w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl"
          style={{
            background: "linear-gradient(180deg,#2A2228 0%,#1A1519 100%)",
            border: "1px solid rgba(254,211,88,0.28)",
            boxShadow:
              "0 16px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)",
          }}
        >
          {mode === "all" && (
            <div className="border-b border-white/5 p-2">
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country or code…"
                className="h-9 w-full rounded-lg px-3 text-[12px] text-white outline-none placeholder:text-white/30"
                style={{
                  background: "rgba(0,0,0,0.35)",
                  border: "1px solid rgba(254,211,88,0.15)",
                }}
                aria-label="Search countries"
              />
            </div>
          )}
          <ul
            id={listId}
            role="listbox"
            aria-label="Country code"
            className="max-h-[240px] overflow-y-auto py-1"
          >
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-center text-[11px] text-white/40">
                No matches
              </li>
            )}
            {filtered.map((c) => {
              const active = c.code === selected.code;
              return (
                <li key={c.code} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => pick(c)}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
                    style={{
                      background: active
                        ? "linear-gradient(90deg, rgba(254,211,88,0.16), transparent)"
                        : "transparent",
                    }}
                  >
                    <span className="text-[18px] leading-none">{c.flag}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-bold text-white">
                        {c.name}
                      </span>
                      <span className="block text-[10px] text-white/40">
                        {c.iso}
                        {c.smsOtp ? " · SMS OTP" : " · phone only"}
                      </span>
                    </span>
                    <span
                      className="shrink-0 text-[12px] font-extrabold tabular-nums"
                      style={{
                        color: active ? "#FED358" : "rgba(255,255,255,0.55)",
                      }}
                    >
                      +{c.code}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
