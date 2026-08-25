"use client";

/**
 * Global date picker — odometer wheel from Transaction History.
 * Use this for every custom date pick in the app.
 *
 * value / onConfirm: YYYY-MM-DD
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useSpaBackClose } from "../../hooks/useSpaBackClose";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

const WHEEL_H = 200;
const ITEM_H = 40;
const PAD_Y = (WHEEL_H - ITEM_H) / 2;

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function ymdFromParts(y: number, m: number, d: number): string {
  const maxD = new Date(y, m, 0).getDate();
  const day = Math.min(d, maxD);
  return `${y}-${pad2(m)}-${pad2(day)}`;
}

export function parseYmd(ymd: string | null | undefined): {
  y: number;
  m: number;
  d: number;
} {
  const n = new Date();
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
  }
  const [ys, ms, ds] = ymd.split("-").map(Number);
  return {
    y: ys || n.getFullYear(),
    m: ms || n.getMonth() + 1,
    d: ds || n.getDate(),
  };
}

/** One vertical reel — scroll snaps; center value is selected */
export function DateOdoColumn({
  values,
  value,
  onChange,
  pad = false,
}: {
  values: number[];
  value: number;
  onChange: (n: number) => void;
  pad?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const indexOf = useCallback(
    (v: number) => {
      const i = values.indexOf(v);
      return i >= 0 ? i : 0;
    },
    [values]
  );

  const scrollToIndex = useCallback(
    (i: number, smooth = false) => {
      const el = ref.current;
      if (!el) return;
      const top = Math.max(0, Math.min(values.length - 1, i)) * ITEM_H;
      lock.current = true;
      if (smooth) el.scrollTo({ top, behavior: "smooth" });
      else el.scrollTop = top;
      window.setTimeout(() => {
        lock.current = false;
      }, smooth ? 160 : 40);
    },
    [values.length]
  );

  useEffect(() => {
    scrollToIndex(indexOf(value), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.length]);

  useEffect(() => {
    if (!values.includes(value)) return;
    const el = ref.current;
    if (!el || lock.current) return;
    const expected = indexOf(value) * ITEM_H;
    if (Math.abs(el.scrollTop - expected) > ITEM_H * 0.6) {
      scrollToIndex(indexOf(value), false);
    }
  }, [value, values, indexOf, scrollToIndex]);

  const onScroll = () => {
    if (lock.current) return;
    const el = ref.current;
    if (!el) return;
    const i = Math.round(el.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(values.length - 1, i));
    const next = values[clamped]!;
    if (next !== valueRef.current) onChange(next);

    if (endTimer.current) clearTimeout(endTimer.current);
    endTimer.current = setTimeout(() => {
      if (lock.current) return;
      const el2 = ref.current;
      if (!el2) return;
      const j = Math.round(el2.scrollTop / ITEM_H);
      const c = Math.max(0, Math.min(values.length - 1, j));
      const n = values[c]!;
      if (n !== valueRef.current) onChange(n);
      const target = c * ITEM_H;
      if (Math.abs(el2.scrollTop - target) > 1.5) {
        scrollToIndex(c, true);
      }
    }, 90);
  };

  const onClickValue = (v: number) => {
    if (v === valueRef.current) return;
    onChange(v);
    scrollToIndex(indexOf(v), true);
  };

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto no-scrollbar relative z-[1]"
      style={{
        height: WHEEL_H,
        scrollSnapType: "y mandatory",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div style={{ height: PAD_Y, flexShrink: 0 }} aria-hidden />
      {values.map((v) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onClickValue(v)}
            className="w-full flex items-center justify-center font-semibold tabular-nums select-none active:opacity-80"
            style={{
              height: ITEM_H,
              scrollSnapAlign: "center",
              fontSize: on ? 17 : 14,
              color: on ? "#FED358" : "rgba(255,255,255,0.28)",
              transition: "color 0.1s ease, font-size 0.1s ease",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            {pad ? pad2(v) : v}
          </button>
        );
      })}
      <div style={{ height: PAD_Y, flexShrink: 0 }} aria-hidden />
    </div>
  );
}

/** Year / month / day odometer — embed in sheets that need custom day */
export function DateOdometer({
  year,
  month,
  day,
  onChange,
  yearsBack = 5,
  maxYmd,
}: {
  year: number;
  month: number;
  day: number;
  onChange: (y: number, m: number, d: number) => void;
  /** Inclusive years from (cap year - yearsBack) .. cap year */
  yearsBack?: number;
  /** YYYY-MM-DD inclusive upper bound (hides later days) */
  maxYmd?: string;
}) {
  const max = maxYmd ? parseYmd(maxYmd) : null;
  const years = useMemo(() => {
    const capY = max?.y ?? new Date().getFullYear();
    const list: number[] = [];
    for (let y = capY - yearsBack; y <= capY; y++) list.push(y);
    return list;
  }, [yearsBack, max?.y]);
  const months = useMemo(() => {
    const last = max && year === max.y ? max.m : 12;
    return Array.from({ length: last }, (_, i) => i + 1);
  }, [max, year]);
  const daysInMonth = new Date(year, month, 0).getDate();
  const maxDay =
    max && year === max.y && month === max.m
      ? Math.min(daysInMonth, max.d)
      : daysInMonth;
  const days = useMemo(
    () => Array.from({ length: maxDay }, (_, i) => i + 1),
    [maxDay]
  );
  const safeDay = Math.min(day, maxDay);

  const emit = (yy: number, mm: number, dd: number) => {
    let y = yy;
    let m = mm;
    let d = dd;
    if (max) {
      if (y > max.y) {
        y = max.y;
        m = max.m;
        d = max.d;
      } else if (y === max.y && m > max.m) {
        m = max.m;
        d = Math.min(d, max.d);
      } else if (y === max.y && m === max.m && d > max.d) {
        d = max.d;
      }
    }
    const dim = new Date(y, m, 0).getDate();
    onChange(y, m, Math.min(d, dim));
  };

  return (
    <div className="relative flex gap-0 px-3 py-1">
      <div
        className="pointer-events-none absolute left-4 right-4 top-1/2 h-10 -translate-y-1/2 rounded-lg z-[2]"
        style={{
          background: "rgba(254,211,88,0.1)",
          border: "1px solid rgba(254,211,88,0.22)",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.2)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-14 z-[3]"
        style={{
          background: "linear-gradient(180deg, #1a1519 0%, transparent 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-14 z-[3]"
        style={{
          background: "linear-gradient(0deg, #1a1519 0%, transparent 100%)",
        }}
      />

      <DateOdoColumn
        values={years}
        value={year}
        onChange={(y) => emit(y, month, safeDay)}
      />
      <DateOdoColumn
        values={months}
        value={month}
        onChange={(m) => emit(year, m, safeDay)}
        pad
      />
      <DateOdoColumn
        values={days}
        value={safeDay}
        onChange={(d) => emit(year, month, d)}
        pad
      />
    </div>
  );
}

export type DatePickerSheetProps = {
  open: boolean;
  /** YYYY-MM-DD */
  value: string;
  onConfirm: (ymd: string) => void;
  onCancel: () => void;
  title?: string;
  yearsBack?: number;
  zIndex?: number;
  /** Inclusive YYYY-MM-DD cap (e.g. yesterday for settled stats) */
  maxYmd?: string;
};

/**
 * Bottom sheet: Cancel | title | Confirm + odometer (Transaction History style).
 */
export default function DatePickerSheet({
  open,
  value,
  onConfirm,
  onCancel,
  title = "Choose a date",
  yearsBack = 5,
  zIndex = 140,
  maxYmd,
}: DatePickerSheetProps) {
  const [mounted, setMounted] = useState(false);
  const parsed = parseYmd(value);
  const [y, setY] = useState(parsed.y);
  const [m, setM] = useState(parsed.m);
  const [d, setD] = useState(parsed.d);

  useSpaBackClose(open, onCancel, "global-date-picker");
  useBodyScrollLock(open);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const raw = value && maxYmd && value > maxYmd ? maxYmd : value;
    const p = parseYmd(raw);
    setY(p.y);
    setM(p.m);
    setD(p.d);
  }, [open, value, maxYmd]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.55)", zIndex }}
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="w-full max-w-[min(100vw,430px)] rounded-t-[18px] overflow-hidden pb-[env(safe-area-inset-bottom,0px)]"
        style={{ background: "#1a1519" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between px-4 h-12 border-b border-white/5">
          <button
            type="button"
            onClick={onCancel}
            className="text-[16px] font-semibold text-white/55 min-w-[64px] text-left"
          >
            Cancel
          </button>
          <span className="text-[17px] font-bold text-[#FED358]">{title}</span>
          <button
            type="button"
            onClick={() => {
              const picked = ymdFromParts(y, m, d);
              onConfirm(maxYmd && picked > maxYmd ? maxYmd : picked);
            }}
            className="text-[16px] font-bold text-[#FED358] min-w-[64px] text-right"
          >
            Confirm
          </button>
        </div>
        <p className="px-4 pt-3 pb-1 text-[13px] text-white/35 font-semibold uppercase tracking-wider">
          Pick a day
        </p>
        <DateOdometer
          year={y}
          month={m}
          day={d}
          yearsBack={yearsBack}
          maxYmd={maxYmd}
          onChange={(yy, mm, dd) => {
            setY(yy);
            setM(mm);
            setD(dd);
          }}
        />
        <div className="h-4" />
      </div>
    </div>,
    document.body
  );
}
