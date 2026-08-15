/** Currency, date, and status formatting helpers */

/** Default fraction digits for all money / commission amounts in the player app */
export const MONEY_DECIMALS = 3;

/**
 * Round to N decimals without string artifacts (0.1+0.2 style).
 */
export function roundMoney(
  amount: number | null | undefined,
  decimals: number = MONEY_DECIMALS
): number {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/**
 * Plain number string with fixed decimals (no currency symbol).
 * Use for commission tables, bet volume, etc.
 */
export function formatDecimal(
  amount: number | null | undefined,
  decimals: number = MONEY_DECIMALS
): string {
  const n = roundMoney(amount, decimals);
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatINR(
  amount: number | null | undefined,
  decimals: number = MONEY_DECIMALS
): string {
  return `₹${formatDecimal(amount, decimals)}`;
}

/** USDT / dollar amounts (Tether deposit & crypto withdraw UI) */
export function formatUSD(
  amount: number | null | undefined,
  decimals: number = MONEY_DECIMALS
): string {
  const n = roundMoney(amount, decimals);
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/** Wallet-facing amount: INR ₹ or USDT $ */
export function formatMoney(
  amount: number | null | undefined,
  unit: "inr" | "usdt" = "inr",
  decimals: number = MONEY_DECIMALS
): string {
  return unit === "usdt"
    ? formatUSD(amount, decimals)
    : formatINR(amount, decimals);
}

/** True when deposit is OxaPay / USDT channel */
export function isUsdtDepositMethod(method?: string | null): boolean {
  const m = String(method ?? "").toUpperCase();
  return m === "OXAPAY" || m.includes("USDT");
}

/**
 * Primary deposit history amount.
 * USDT orders: show crypto size (usdtAmount). Never format INR `amount` as USDT.
 * INR methods: ₹ amount.
 */
export function formatDepositAmount(d: {
  amount: number;
  method?: string | null;
  usdtAmount?: number | null;
}): string {
  if (isUsdtDepositMethod(d.method)) {
    const u = d.usdtAmount != null ? Number(d.usdtAmount) : NaN;
    if (Number.isFinite(u)) return `${formatUSD(u)} USDT`;
    // Old rows without usdtAmount — show INR honestly (do not fake USDT)
    return formatINR(d.amount);
  }
  return formatINR(d.amount);
}

/**
 * Secondary line for USDT deposits: INR equivalent (small font in UI).
 * Returns null when not applicable.
 */
export function formatDepositInrHint(d: {
  amount: number;
  method?: string | null;
  usdtAmount?: number | null;
}): string | null {
  if (!isUsdtDepositMethod(d.method)) return null;
  const u = d.usdtAmount != null ? Number(d.usdtAmount) : NaN;
  if (!Number.isFinite(u)) return null;
  return `≈ ${formatINR(d.amount)}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export type StatusTone = "success" | "warning" | "danger" | "info" | "muted";

export function statusTone(status: string): StatusTone {
  const s = status.toUpperCase();
  if (
    [
      "SUCCESS",
      "COMPLETED",
      "COMPLETE",
      "COLLECTED",
      "WON",
      "RESOLVED",
      "VERIFIED",
    ].includes(s)
  )
    return "success";
  if (
    [
      "PENDING",
      "PROCESSING",
      "CREATED",
      "ACTIVE",
      "COMPLETED_UNCOLLECTED",
    ].includes(s)
  )
    return "warning";
  if (
    ["FAILED", "REJECTED", "LOST", "EXPIRED", "CANCELLED", "CANCELED"].includes(
      s
    )
  )
    return "danger";
  if (["ENDED"].includes(s)) return "muted";
  return "info";
}

export const STATUS_COLORS: Record<StatusTone, string> = {
  success: "#17B15E",
  warning: "#FED358",
  danger: "#DA3735",
  info: "#5088D3",
  muted: "rgba(255,255,255,0.45)",
};

export function secondsUntil(endTime: string | Date | null | undefined): number {
  if (!endTime) return 0;
  const end =
    typeof endTime === "string" ? new Date(endTime).getTime() : endTime.getTime();
  return Math.max(0, Math.floor((end - Date.now()) / 1000));
}

export function maskMiddle(str: string, keepStart = 3, keepEnd = 3): string {
  if (!str || str.length <= keepStart + keepEnd) return str;
  return `${str.slice(0, keepStart)}***${str.slice(-keepEnd)}`;
}
