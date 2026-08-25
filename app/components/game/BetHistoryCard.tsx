"use client";

/**
 * My-history row + expandable Detail panel (BCWIN-style).
 * Used by WinGo / TRX / K3 / 5D / Moto (and account game history).
 */

import React, { useState } from "react";
import { IoCopyOutline, IoChevronForward, IoChevronDown, IoCheckmark } from "react-icons/io5";
import { formatINR, formatDateTime } from "../../lib/format";
import StatusBadge, { displayStatusLabel } from "../ui/StatusBadge";

export type BetHistoryDetail = {
  id: string;
  /** Short label for the selection chip, e.g. "Small", "Green", "A=5" */
  selectLabel: string;
  /** Optional chip color */
  selectColor?: string;
  periodNumber?: string | null;
  betAmount: number;
  /** Stake after service fee; falls back to betAmount */
  contractAmount?: number | null;
  /** Quantity of units (default 1) */
  quantity?: number | null;
  status: string;
  /** Win amount if won; 0 / omit if lost or pending */
  winAmount?: number | null;
  isWin?: boolean | null;
  createdAt?: string | null;
  /** Human result line, e.g. "9 Green Big" or "3-5-2 Σ10" */
  resultText?: string | null;
  /** Prefix for order number display, e.g. WG / K3 / 5D */
  orderPrefix?: string;
  /** Extra rows appended under standard fields */
  extraRows?: { label: string; value: React.ReactNode; valueClass?: string }[];
};

function orderNumber(prefix: string | undefined, id: string) {
  const p = (prefix ?? "ORD").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const compact = id.replace(/-/g, "").toUpperCase();
  return `${p}${compact}`;
}

function taxOf(bet: number, contract: number) {
  const t = Math.max(0, Number(bet) - Number(contract));
  return Math.round(t * 100) / 100;
}

function winLoseAmount(d: BetHistoryDetail): {
  text: string;
  className: string;
} {
  const st = String(d.status ?? "").toUpperCase();
  const pending = ["PENDING", "ACTIVE", "OPEN"].includes(st);
  if (pending) {
    return { text: formatINR(d.betAmount), className: "text-white/75 font-medium" };
  }
  // Lottery: WON / LOST. Inout: SETTLED with winAmount > 0 = win.
  // Never treat bare SETTLED as a win (loss settles with winAmount 0).
  const won =
    d.isWin === true ||
    st === "WON" ||
    (st === "SETTLED" && Number(d.winAmount ?? 0) > 0);
  if (won) {
    const w = Number(d.winAmount ?? 0);
    return {
      text: `+${formatINR(w)}`,
      className: "text-[#17B15E] font-medium",
    };
  }
  // Failed / Lost
  return {
    text: `-${formatINR(d.betAmount)}`,
    className: "text-[#DA3735] font-medium",
  };
}

function DetailRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-[7px] border-b border-white/[0.04] last:border-0">
      <span className="text-[14px] text-white/45 shrink-0">{label}</span>
      <span
        className={`text-[14px] text-right font-medium break-all ${
          valueClass ?? "text-white/85"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function getBadgeFontSize(label: string): string {
  const len = label ? label.trim().length : 0;
  if (len <= 4) return "13px";
  if (len <= 7) return "11.5px";
  if (len <= 10) return "10px";
  if (len <= 14) return "8.5px";
  return "7.5px";
}

export default function BetHistoryCard({ detail }: { detail: BetHistoryDetail }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const contract = Number(detail.contractAmount ?? detail.betAmount);
  const qty = Math.max(1, Number(detail.quantity ?? 1));
  const tax = taxOf(detail.betAmount, contract);
  const order = orderNumber(detail.orderPrefix, detail.id);
  const wl = winLoseAmount(detail);
  const chipBg = detail.selectColor ?? "#3B82F6";

  const copyOrder = async () => {
    try {
      await navigator.clipboard.writeText(order);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="border-b border-white/[0.06] px-2.5 sm:px-3 py-3 min-w-0 transition-colors"
      style={{ background: open ? "rgba(255,255,255,0.03)" : undefined }}
    >
      {/* Main row: [Larger Badge + Period/Date with Arrow] ---- [Status + Amount] */}
      <div
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3.5 min-w-0 cursor-pointer select-none"
      >
        {/* Larger fixed size badge box */}
        <div
          className="w-[48px] h-[48px] rounded-[14px] shrink-0 flex items-center justify-center font-bold text-white shadow-sm overflow-hidden text-center p-1 min-w-0"
          style={{ background: chipBg }}
        >
          <span
            className="break-words line-clamp-2 leading-[1.15] text-center max-w-full"
            style={{ fontSize: getBadgeFontSize(detail.selectLabel) }}
          >
            {detail.selectLabel}
          </span>
        </div>

        {/* Period number with tiny chevron arrow + date time */}
        <div className="min-w-0 shrink-0">
          {detail.periodNumber && (
            <div className="flex items-center gap-1.5 text-[16px] sm:text-[16.5px] text-white/90 font-medium tracking-tight">
              <span>{detail.periodNumber}</span>
              <IoChevronDown
                size={13}
                className={`transition-transform duration-200 ${
                  open ? "rotate-180 text-[#FED358]" : "text-white/35"
                }`}
              />
            </div>
          )}
          {detail.createdAt && (
            <p className="text-[13.5px] text-white/40 leading-snug truncate mt-0.5">
              {formatDateTime(detail.createdAt)}
            </p>
          )}
        </div>

        {/* Right side: status badge + win/lose amount stacked vertically */}
        <div className="flex flex-col items-end gap-1 shrink-0 ml-auto pl-1">
          <StatusBadge status={detail.status} />
          <span className={`text-[15.5px] sm:text-[16px] tabular-nums font-bold ${wl.className}`}>
            {wl.text}
          </span>
        </div>
      </div>

      {/* Expandable details */}
      {open && (
        <div className="mt-2.5 pt-1">
          <p className="text-[15px] font-bold text-white/80 mb-1">Details</p>
          <div
            className="rounded-[10px] px-3 py-1"
            style={{
              background: "rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <DetailRow
              label="Order number"
              value={
                <button
                  type="button"
                  onClick={copyOrder}
                  className="inline-flex items-center gap-1 text-left text-[13px] font-mono text-[#c4b5fd] active:opacity-80"
                >
                  <span className="break-all">{order}</span>
                  {copied ? (
                    <IoCheckmark size={14} className="shrink-0 text-[#17B15E]" />
                  ) : (
                    <IoCopyOutline size={13} className="shrink-0 opacity-70" />
                  )}
                </button>
              }
            />
            <DetailRow
              label="Period"
              value={detail.periodNumber ?? "—"}
              valueClass="text-white/80 font-mono text-[13px]"
            />
            <DetailRow
              label="Purchase amount"
              value={formatINR(detail.betAmount)}
            />
            <DetailRow label="Quantity" value={String(qty)} />
            <DetailRow
              label="Amount after tax"
              value={formatINR(contract)}
              valueClass="text-[#DA3735] font-bold"
            />
            <DetailRow
              label="Tax"
              value={formatINR(tax)}
              valueClass="text-white/70"
            />
            {detail.resultText != null && detail.resultText !== "" && (
              <DetailRow
                label="Result"
                value={detail.resultText}
                valueClass="text-white font-semibold"
              />
            )}
            <DetailRow label="Select" value={detail.selectLabel} />
            <DetailRow
              label="Status"
              value={
                <span
                  className={
                    ["WON", "SETTLED"].includes(
                      String(detail.status).toUpperCase()
                    )
                      ? "text-[#17B15E] font-bold"
                      : ["LOST", "FAILED"].includes(
                            String(detail.status).toUpperCase()
                          )
                        ? "text-[#DA3735] font-bold"
                        : "text-[#FED358] font-bold"
                  }
                >
                  {displayStatusLabel(detail.status)}
                </span>
              }
            />
            <DetailRow
              label="Win/lose"
              value={wl.text}
              valueClass={wl.className}
            />
            <DetailRow
              label="Order time"
              value={
                detail.createdAt ? formatDateTime(detail.createdAt) : "—"
              }
              valueClass="text-white/60 text-[13px]"
            />
            {detail.extraRows?.map((r) => (
              <DetailRow
                key={r.label}
                label={r.label}
                value={r.value}
                valueClass={r.valueClass}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
