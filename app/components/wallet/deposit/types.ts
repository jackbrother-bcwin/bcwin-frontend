import type { DepositMethod } from "../../../lib/api";
import { formatINR } from "../../../lib/format";

export type PayUiId =
  | "upi-x-qr"
  | "now-upi"
  | "crypto-pay"
  | "usdt";

export type ChannelId =
  | "phonepe_qr"
  | "paytm_qr"
  | "gpay_qr"
  | "upi_qr"
  | "online"
  | "usdt"
  | "tron_usdt"
  | "bsc_usdt";

export type PayMethodDef = {
  id: PayUiId;
  label: string;
  icon: string;
  /** Backend payment method */
  apiMethod: DepositMethod;
  /** Channels available when this method is selected */
  channels: ChannelId[];
};

export type ChannelDef = {
  id: ChannelId;
  name: string;
  /** Static range / min hint (bonus % comes from live admin config) */
  balanceLabel: string;
  min: number;
  max: number;
  /** Optional channel icon (e.g. Tether for USDT networks) */
  icon?: string;
};

/** Official-style Tether (USDT) mark — never use Tron diamond for USDT */
export const TETHER_ICON = "/assets/png/usdt-40311708.png";

export const PAY_METHODS: PayMethodDef[] = [
  {
    id: "upi-x-qr",
    label: "UPI x QR",
    icon: "/assets/png/upi-3f9883de.png",
    apiMethod: "CXPAY",
    channels: ["phonepe_qr", "paytm_qr", "gpay_qr"],
  },
  {
    id: "now-upi",
    label: "7· Now UPI",
    icon: "/assets/png/upi_recharge-a5d50b78.png",
    apiMethod: "CXPAY",
    channels: ["phonepe_qr", "upi_qr"],
  },
  {
    id: "usdt",
    label: "7· USDT",
    icon: TETHER_ICON,
    apiMethod: "OXAPAY",
    channels: ["usdt", "tron_usdt"],
  },
  {
    id: "crypto-pay",
    label: "Crypto",
    icon: TETHER_ICON,
    apiMethod: "OXAPAY",
    channels: ["tron_usdt", "bsc_usdt"],
  },
];

export const CHANNELS: Record<ChannelId, ChannelDef> = {
  phonepe_qr: {
    id: "phonepe_qr",
    name: "7· Phonepe_QR",
    balanceLabel: "₹100 - ₹50K",
    min: 100,
    max: 50_000,
  },
  paytm_qr: {
    id: "paytm_qr",
    name: "7· Paytm_QR",
    balanceLabel: "₹100 - ₹50K",
    min: 100,
    max: 50_000,
  },
  gpay_qr: {
    id: "gpay_qr",
    name: "7· GPay_QR",
    balanceLabel: "₹100 - ₹50K",
    min: 100,
    max: 50_000,
  },
  upi_qr: {
    id: "upi_qr",
    name: "7· UPI_QR",
    balanceLabel: "₹100 - ₹50K",
    min: 100,
    max: 50_000,
  },
  online: {
    id: "online",
    name: "7· Online Pay",
    balanceLabel: "₹100 - ₹50K",
    min: 100,
    max: 50_000,
  },
  usdt: {
    id: "usdt",
    name: "7· USDT (OxaPay)",
    balanceLabel: "Min 5 USDT",
    min: 5,
    max: 1_000_000,
    icon: TETHER_ICON,
  },
  tron_usdt: {
    id: "tron_usdt",
    name: "7· USDT · TRC20",
    balanceLabel: "Min 5 USDT",
    min: 5,
    max: 1_000_000,
    icon: TETHER_ICON,
  },
  bsc_usdt: {
    id: "bsc_usdt",
    name: "7· USDT · BEP20",
    balanceLabel: "Min 5 USDT",
    min: 5,
    max: 1_000_000,
    icon: TETHER_ICON,
  },
};

/** INR gateways — quick pick ₹100 → ₹50,000 */
export const QUICK_AMOUNTS_INR = [
  100, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000,
] as const;

/** USDT gateways — amount is USDT (backend converts); min 5, custom can go higher */
export const QUICK_AMOUNTS_USDT = [
  5, 10, 20, 50, 100, 200, 500, 1000,
] as const;

/** @deprecated use QUICK_AMOUNTS_INR / QUICK_AMOUNTS_USDT */
export const QUICK_AMOUNTS = QUICK_AMOUNTS_INR;

export function isUsdtMethod(apiMethod: DepositMethod): boolean {
  return apiMethod === "OXAPAY";
}

export function formatQuickLabel(n: number, unit: "inr" | "usdt" = "inr"): string {
  if (unit === "usdt") {
    // Dollar-style chips for USDT (e.g. $5, $1K)
    if (n >= 1000) {
      const k = n / 1000;
      return Number.isInteger(k) ? `$${k}K` : `$${k}K`;
    }
    return `$${n}`;
  }
  if (n >= 1000) {
    const k = n / 1000;
    return Number.isInteger(k) ? `₹${k}K` : `₹${k}K`;
  }
  return `₹${n}`;
}

export function formatAmountHint(
  min: number,
  max: number,
  unit: "inr" | "usdt"
): string {
  if (unit === "usdt") {
    return `Min $${min} USDT · enter any amount above`;
  }
  return `${formatINR(min)} - ${formatINR(max)}`;
}

export const RECHARGE_INSTRUCTIONS = [
  "If the transfer time is up, please fill out the deposit form again.",
  "The transfer amount must match the order that you created, otherwise the money cannot be credited successfully.",
  "If you transfer the wrong amount, our company will not be responsible for the lost amount!",
  "Note: do not cancel the deposit order after the money is transferred.",
] as const;
