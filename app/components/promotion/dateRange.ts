/** IST-friendly calendar helpers for agency dashboards */

export function ymdLocal(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Calendar day in Asia/Kolkata (YYYY-MM-DD). Agency settled stats use IST. */
export function ymdIst(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Latest IST day with settled team stats: yesterday. */
export function latestSettledYmd(d = new Date()): string {
  return shiftYmd(ymdIst(d), -1);
}

export function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  return ymdLocal(dt);
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
  const today = ymdLocal();
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
      const d = new Date();
      const day = d.getDay(); // 0 Sun
      const monOffset = day === 0 ? -6 : 1 - day;
      const start = shiftYmd(today, monOffset);
      return { startDate: start, endDate: today, label: "This week" };
    }
    case "last_week": {
      const d = new Date();
      const day = d.getDay();
      const monOffset = day === 0 ? -6 : 1 - day;
      const thisMon = shiftYmd(today, monOffset);
      const lastMon = shiftYmd(thisMon, -7);
      const lastSun = shiftYmd(thisMon, -1);
      return { startDate: lastMon, endDate: lastSun, label: "Last week" };
    }
    case "this_month": {
      const d = new Date();
      const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      return { startDate: start, endDate: today, label: "This month" };
    }
    case "last_month": {
      const d = new Date();
      const firstThis = new Date(d.getFullYear(), d.getMonth(), 1);
      const lastPrev = new Date(firstThis.getTime() - 86_400_000);
      const start = `${lastPrev.getFullYear()}-${String(lastPrev.getMonth() + 1).padStart(2, "0")}-01`;
      const end = ymdLocal(lastPrev);
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
