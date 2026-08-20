/** Calendar day in Asia/Kolkata (YYYY-MM-DD). Team commission days are IST 00:00–24:00. */
export function ymdIst(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function shiftYmd(ymd: string, days: number): string {
  const start = new Date(`${ymd}T00:00:00+05:30`);
  return ymdIst(new Date(start.getTime() + days * 24 * 60 * 60 * 1000));
}

/** Latest IST day whose team play has closed (yesterday 24:00). */
export function latestSettledYmd(d = new Date()): string {
  return shiftYmd(ymdIst(d), -1);
}

/** IST calendar day of a rebate / ledger timestamp. */
export function rebateIstDay(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const sliced = String(iso).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(sliced) ? sliced : "";
  }
  return ymdIst(d);
}

/** Player-facing close of that IST day. */
export function istDayEndLabel(ymd: string): string {
  return `${ymd} 24:00:00`;
}

/** Instant that still sorts/filters onto that IST calendar day. */
export function istDayEndIso(ymd: string): string {
  return `${ymd}T23:59:59+05:30`;
}

const IST = "Asia/Kolkata";

/** Admin / ops datetime: always Kolkata, 24h. */
export function formatIstDateTime(iso: unknown): string {
  if (iso == null || iso === "") return "—";
  const d = iso instanceof Date ? iso : new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Long IST calendar date (dashboard subtitle). */
export function formatIstDateLong(d = new Date()): string {
  return d.toLocaleDateString("en-IN", {
    timeZone: IST,
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
