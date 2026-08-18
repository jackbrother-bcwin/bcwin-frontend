/** IST-friendly calendar helpers for agency dashboards */

import { latestSettledYmd, shiftYmd, ymdIst } from "../../lib/ist-day";

export { latestSettledYmd, shiftYmd, ymdIst };

export function ymdLocal(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function istWeekdaySun0(d = new Date()): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
  }).format(d);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

export type DatePreset =
  | "today"
  | "yesterday"
  | "day_before"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "all"
  | "custom";

export function rangeForPreset(
  preset: DatePreset,
  custom?: { start: string; end: string }
): { startDate?: string; endDate?: string; label: string } {
  const today = ymdIst();
  switch (preset) {
    case "today":
      return { startDate: today, endDate: today, label: "Today" };
    case "yesterday": {
      const y = shiftYmd(today, -1);
      return { startDate: y, endDate: y, label: "Yesterday" };
    }
    case "day_before": {
      const y = shiftYmd(today, -2);
      return { startDate: y, endDate: y, label: "Day before" };
    }
    case "this_week": {
      const day = istWeekdaySun0();
      const monOffset = day === 0 ? -6 : 1 - day;
      const start = shiftYmd(today, monOffset);
      return { startDate: start, endDate: today, label: "This week" };
    }
    case "last_week": {
      const day = istWeekdaySun0();
      const monOffset = day === 0 ? -6 : 1 - day;
      const thisMon = shiftYmd(today, monOffset);
      const lastMon = shiftYmd(thisMon, -7);
      const lastSun = shiftYmd(thisMon, -1);
      return { startDate: lastMon, endDate: lastSun, label: "Last week" };
    }
    case "this_month": {
      const start = `${today.slice(0, 7)}-01`;
      return { startDate: start, endDate: today, label: "This month" };
    }
    case "last_month": {
      const [ys, ms] = today.split("-").map(Number);
      const pm = ms === 1 ? 12 : (ms ?? 1) - 1;
      const py = ms === 1 ? (ys ?? 0) - 1 : (ys ?? 0);
      const start = `${py}-${String(pm).padStart(2, "0")}-01`;
      const endDay = new Date(py, pm, 0).getDate();
      const end = `${py}-${String(pm).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
      return { startDate: start, endDate: end, label: "Last month" };
    }
    case "custom":
      return {
        startDate: custom?.start,
        endDate: custom?.end,
        label: "Custom",
      };
    case "all":
    default:
      return { label: "All" };
  }
}

export function formatRatePct(rate: number): string {
  // CommissionRateConfig / RebateRateConfig store percent points, e.g. 0.6 = 0.6%
  // (NOT fractions like 0.006 — do not multiply by 100.)
  const pct = Number(rate) || 0;
  if (pct === 0) return "0%";
  if (pct >= 1) return `${pct.toFixed(2).replace(/\.?0+$/, "")}%`;
  // small rates: show enough precision (0.6, 0.054, 0.001458)
  const s = pct.toFixed(6).replace(/\.?0+$/, "");
  return `${s}%`;
}
