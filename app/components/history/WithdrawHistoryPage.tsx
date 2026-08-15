"use client";

/**
 * Withdrawal history — status + date filters (same chrome as transaction history).
 * Statuses map to backend WithdrawOrderStatus:
 *   GENERATED → Pending · PROCESSING → Processing · SUCCESS → Approved
 *   FAILED → Failed · USER_CANCELED → Cancelled
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Image from "next/image";
import { IoChevronDown } from "react-icons/io5";
import { SiBinance } from "react-icons/si";
import PageHeader from "../ui/PageHeader";
import LoadingSpinner from "../ui/LoadingSpinner";
import EmptyState from "../ui/EmptyState";
import { useToast } from "../ui/Toast";
import * as api from "../../lib/api";
import type { Withdrawal } from "../../lib/api";
import { formatINR } from "../../lib/format";
import { DateOdometer, ymdFromParts } from "../ui/DatePickerSheet";
import LogoutConfirmModal from "../ui/LogoutConfirmModal";
import { TETHER_ICON } from "../wallet/deposit/types";
import { Pagination } from "../game/shared";

const PAGE_SIZE = 20;

interface Props {
  onBack: () => void;
}

type StatusFilter =
  | "ALL"
  | "PENDING"
  | "PROCESSING"
  | "APPROVED"
  | "FAILED"
  | "CANCELLED";

const STATUS_OPTS: { id: StatusFilter; label: string; api?: string }[] = [
  { id: "ALL", label: "All" },
  { id: "PENDING", label: "Pending", api: "GENERATED" },
  { id: "PROCESSING", label: "Processing", api: "PROCESSING" },
  { id: "APPROVED", label: "Completed", api: "SUCCESS" },
  { id: "FAILED", label: "Failed", api: "FAILED" },
  { id: "CANCELLED", label: "Cancelled", api: "USER_CANCELED" },
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatTxTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function dateKey(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function statusLabel(st: string) {
  const u = st.toUpperCase();
  if (u === "GENERATED" || u === "PENDING" || u === "CREATED") return "Pending";
  if (u === "PROCESSING") return "Processing";
  if (u === "SUCCESS") return "Completed";
  if (u === "FAILED") return "Failed";
  if (u === "USER_CANCELED" || u === "CANCELLED" || u === "CANCELED")
    return "Cancelled";
  return st;
}

function statusColor(st: string) {
  const u = st.toUpperCase();
  if (u === "SUCCESS") return "#17B15E";
  if (u === "FAILED") return "#DA3735";
  if (u === "USER_CANCELED" || u === "CANCELLED") return "rgba(255,255,255,0.45)";
  if (u === "PROCESSING") return "#5088D3";
  return "#FED358";
}

function canCancel(status: string) {
  return ["GENERATED", "PENDING", "CREATED"].includes(status.toUpperCase());
}

function isUsdtWithdraw(method?: string | null) {
  const m = String(method ?? "").toUpperCase();
  return m === "OXAPAY" || m.includes("USDT");
}

function amountColor(st: string) {
  const u = st.toUpperCase();
  if (u === "SUCCESS") return "#17B15E";
  if (u === "FAILED") return "#DA3735";
  return undefined;
}

function resolveUsdtAmount(
  w: Withdrawal,
  withdrawRate?: number
): number | null {
  let usdt = w.usdtAmount != null ? Number(w.usdtAmount) : NaN;
  if (
    (!Number.isFinite(usdt) || usdt <= 0) &&
    isUsdtWithdraw(w.method) &&
    withdrawRate &&
    withdrawRate > 0
  ) {
    usdt = Number(w.amount) / withdrawRate;
  }
  if (isUsdtWithdraw(w.method) && Number.isFinite(usdt) && usdt > 0) {
    return usdt;
  }
  return null;
}

function formatWithdrawAmount(w: Withdrawal, withdrawRate?: number) {
  const inr = formatINR(w.amount);
  const usdt = resolveUsdtAmount(w, withdrawRate);
  if (usdt != null) return `${inr} (${usdt.toFixed(2)} USDT)`;
  return inr;
}

function BnbMark({ size = 14 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden"
      style={{
        width: size,
        height: size,
        background: "#F3BA2F",
      }}
      title="BNB Smart Chain (BEP20)"
      aria-label="BNB Smart Chain (BEP20)"
    >
      <SiBinance
        size={Math.max(8, Math.round(size * 0.65))}
        style={{ color: "#110D14" }}
        aria-hidden
      />
    </span>
  );
}

/** FE-only display labels: Bank · USDT(BEP20) · USDT(TRC20) · UPI */
function methodLabel(
  method?: string | null,
  cryptoChain?: string | null
): string {
  const m = String(method ?? "").toUpperCase();
  const chain = String(cryptoChain ?? "").toUpperCase();

  if (m === "OXAPAY" || m === "USDT") {
    if (chain === "BEP20") return "USDT(BEP20)";
    if (chain === "TRC20") return "USDT(TRC20)";
    return "USDT";
  }
  if (m === "CXPAY" || m === "XDPAY" || m === "BANK") return "Bank card";
  if (m === "UPI") return "UPI";
  return "Bank card";
}

type DatePreset = "all" | "yesterday" | "last_month" | "custom";

export default function WithdrawHistoryPage({ onBack }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<Withdrawal[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Withdrawal | null>(null);
  const [usdtWdRate, setUsdtWdRate] = useState(100);

  const [statusF, setStatusF] = useState<StatusFilter>("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customDate, setCustomDate] = useState<string | null>(null);

  const [statusSheet, setStatusSheet] = useState(false);
  const [dateSheet, setDateSheet] = useState(false);
  const [draftStatus, setDraftStatus] = useState<StatusFilter>("ALL");
  const [draftPreset, setDraftPreset] = useState<DatePreset>("all");
  const now = new Date();
  const [draftY, setDraftY] = useState(now.getFullYear());
  const [draftM, setDraftM] = useState(now.getMonth() + 1);
  const [draftD, setDraftD] = useState(now.getDate());

  const dateRange = useMemo(() => {
    if (datePreset === "yesterday") {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const y = dateKey(d.toISOString());
      return { startDate: y, endDate: y };
    }
    if (datePreset === "last_month") {
      const n = new Date();
      const y = n.getMonth() === 0 ? n.getFullYear() - 1 : n.getFullYear();
      const m = n.getMonth() === 0 ? 12 : n.getMonth();
      return {
        startDate: `${y}-${pad2(m)}-01`,
        endDate: `${y}-${pad2(m)}-${pad2(new Date(y, m, 0).getDate())}`,
      };
    }
    if (datePreset === "custom" && customDate) {
      return { startDate: customDate, endDate: customDate };
    }
    return {};
  }, [datePreset, customDate]);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const apiStatus = STATUS_OPTS.find((s) => s.id === statusF)?.api;
        const res = await api.getWithdrawals({
          page: p,
          limit: PAGE_SIZE,
          status: apiStatus,
          ...dateRange,
        });
        setItems(res.withdrawals ?? []);
        setTotalPages(Math.max(1, Number(res.totalPages ?? 1)));
        setPage(Number(res.currentPage ?? p));
      } catch (e: unknown) {
        toast(e instanceof Error ? e.message : "Failed to load", "error");
        setItems([]);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    },
    [statusF, dateRange, toast]
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  useEffect(() => {
    void api
      .getPaymentRates()
      .then((r) => {
        const n = Number(r.inrToUsdtWithdrawalConversionRate);
        if (Number.isFinite(n) && n > 0) setUsdtWdRate(n);
      })
      .catch(() => {
        /* keep 100 */
      });
  }, []);

  const handleCancel = async () => {
    const orderId = cancelTarget?.orderId;
    if (!orderId) return;
    setCancelling(orderId);
    try {
      await api.cancelWithdraw(orderId);
      toast("Withdrawal cancelled", "success");
      setCancelTarget(null);
      void load(page);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Cancel failed", "error");
    } finally {
      setCancelling(null);
    }
  };

  const statusLabelBtn =
    STATUS_OPTS.find((s) => s.id === statusF)?.label ?? "All";
  const dateLabel =
    datePreset === "all"
      ? "All time"
      : datePreset === "yesterday"
        ? "Yesterday"
        : datePreset === "last_month"
          ? "Last month"
          : customDate ?? "Custom date";

  return (
    <div
      className="flex flex-col min-h-screen min-w-0 w-full max-w-full overflow-x-clip pb-[max(2.5rem,env(safe-area-inset-bottom))]"
      style={{ background: "#110D14" }}
    >
      <PageHeader title="Withdrawal history" onBack={onBack} />

      <div className="px-2.5 sm:px-3 pt-2 pb-3 flex gap-2 min-w-0">
        <FilterBtn
          label={statusLabelBtn}
          onClick={() => {
            setDraftStatus(statusF);
            setStatusSheet(true);
          }}
        />
        <FilterBtn
          label={dateLabel}
          muted={datePreset === "all"}
          onClick={() => {
            setDraftPreset(datePreset);
            setDateSheet(true);
          }}
        />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState
          title="No withdrawals"
          subtitle="Try another status or date filter"
        />
      ) : (
        <div className="px-3 space-y-3">
          {items.map((w) => (
            <article
              key={w.id}
              className="rounded-[12px] overflow-hidden"
              style={{
                background: "#241E22",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div
                className="px-3.5 py-2.5 flex items-center justify-between gap-2"
                style={{
                  background: "rgba(0,0,0,0.18)",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <span className="text-[14px] font-bold text-[#FED358]">
                  Withdraw
                </span>
                <span
                  className="text-[12px] font-bold"
                  style={{ color: statusColor(w.status) }}
                >
                  {statusLabel(w.status)}
                </span>
              </div>
              <div className="px-3.5 py-1">
                <AmountRow w={w} rate={usdtWdRate} />
                <TypeRow method={w.method} cryptoChain={w.cryptoChain} />
                <Row label="Order" value={w.orderId} mono />
                {w.txHash ? (
                  <Row label="Tx hash" value={w.txHash} mono />
                ) : null}
                <Row label="Time" value={formatTxTime(w.createdAt)} muted />
                {w.note && <Row label="Note" value={w.note} muted />}
              </div>
              {canCancel(w.status) && (
                <div className="px-3.5 pb-3">
                  <button
                    type="button"
                    disabled={cancelling === w.orderId}
                    onClick={() => setCancelTarget(w)}
                    className="w-full h-9 rounded-full text-[12px] font-bold text-[#DA3735] active:opacity-70"
                    style={{
                      border: "1px solid rgba(218,55,53,0.45)",
                      background: "rgba(218,55,53,0.08)",
                    }}
                  >
                    {cancelling === w.orderId
                      ? "Cancelling…"
                      : "Cancel withdrawal"}
                  </button>
                </div>
              )}
              {!canCancel(w.status) && (
                <div
                  className="h-8 mx-3 mb-3 mt-1 rounded-md"
                  style={{ background: "rgba(0,0,0,0.22)" }}
                />
              )}
            </article>
          ))}
          <Pagination
            page={page}
            totalPages={totalPages}
            onChange={(p) => {
              void load(p);
              if (typeof window !== "undefined") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
          />
        </div>
      )}

      {statusSheet && (
        <Sheet
          onClose={() => setStatusSheet(false)}
          onCancel={() => setStatusSheet(false)}
          onConfirm={() => {
            setStatusF(draftStatus);
            setStatusSheet(false);
          }}
          title={null}
        >
          <div className="py-2 max-h-[50vh] overflow-y-auto no-scrollbar">
            {STATUS_OPTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setDraftStatus(s.id)}
                className="w-full py-3.5 text-center text-[15px] font-semibold"
                style={{
                  color:
                    draftStatus === s.id
                      ? "#FED358"
                      : "rgba(255,255,255,0.55)",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {dateSheet && (
        <Sheet
          onClose={() => setDateSheet(false)}
          onCancel={() => setDateSheet(false)}
          onConfirm={() => {
            if (draftPreset === "custom") {
              setCustomDate(ymdFromParts(draftY, draftM, draftD));
              setDatePreset("custom");
            } else {
              setDatePreset(draftPreset);
              setCustomDate(null);
            }
            setDateSheet(false);
          }}
          title="Choose a date"
        >
          <div className="grid grid-cols-2 gap-2 px-4 pt-3 pb-2">
            {(
              [
                { id: "all" as const, label: "All time" },
                { id: "yesterday" as const, label: "Yesterday" },
                { id: "last_month" as const, label: "Last month" },
                { id: "custom" as const, label: "Custom date" },
              ] as const
            ).map((p) => {
              const on = draftPreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setDraftPreset(p.id)}
                  className="h-10 rounded-[10px] text-[13px] font-bold"
                  style={{
                    background: on
                      ? "rgba(254,211,88,0.18)"
                      : "rgba(255,255,255,0.05)",
                    color: on ? "#FED358" : "rgba(255,255,255,0.55)",
                    border: on
                      ? "1px solid rgba(254,211,88,0.45)"
                      : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          {draftPreset === "custom" && (
            <>
              <p className="px-4 pt-1 pb-1 text-[11px] text-white/35 font-semibold uppercase tracking-wider">
                Pick a day
              </p>
              <DateOdometer
                year={draftY}
                month={draftM}
                day={draftD}
                onChange={(y, m, d) => {
                  setDraftPreset("custom");
                  setDraftY(y);
                  setDraftM(m);
                  setDraftD(d);
                }}
              />
            </>
          )}
        </Sheet>
      )}

      <LogoutConfirmModal
        open={!!cancelTarget}
        title="Do you want to cancel this withdrawal?"
        confirmLabel="Confirm"
        cancelLabel="Keep it"
        loadingLabel="Cancelling…"
        loading={!!cancelling}
        onConfirm={() => void handleCancel()}
        onCancel={() => {
          if (!cancelling) setCancelTarget(null);
        }}
      />
    </div>
  );
}

function FilterBtn({
  label,
  onClick,
  muted,
}: {
  label: string;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 min-w-0 h-10 rounded-[10px] px-2.5 sm:px-3 flex items-center justify-between text-[12px] sm:text-[13px] font-semibold"
      style={{
        background: "#241E22",
        border: "1px solid rgba(255,255,255,0.06)",
        color: muted ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.85)",
      }}
    >
      <span className="truncate">{label}</span>
      <IoChevronDown size={16} className="opacity-50 shrink-0 ml-1" />
    </button>
  );
}

function AmountRow({ w, rate }: { w: Withdrawal; rate: number }) {
  const st = w.status.toUpperCase();
  const completed = st === "SUCCESS";
  const usdt = resolveUsdtAmount(w, rate);
  const failedColor = amountColor(w.status);

  if (completed && usdt != null) {
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] gap-3">
        <span className="text-[13px] text-white/45 shrink-0">Amount</span>
        <span className="text-[13px] text-right font-bold tabular-nums">
          <span style={{ color: "#FED358" }}>{formatINR(w.amount)}</span>
          <span className="text-white/35"> (</span>
          <span style={{ color: "#17B15E" }}>{usdt.toFixed(2)} USDT</span>
          <span className="text-white/35">)</span>
        </span>
      </div>
    );
  }

  return (
    <Row
      label="Amount"
      value={formatWithdrawAmount(w, rate)}
      strong
      valueColor={failedColor}
    />
  );
}

function TypeRow({
  method,
  cryptoChain,
}: {
  method?: string | null;
  cryptoChain?: string | null;
}) {
  const usdt = isUsdtWithdraw(method);
  const chain = String(cryptoChain ?? "").toUpperCase();
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] gap-3">
      <span className="text-[13px] text-white/45 shrink-0">Type</span>
      <span className="flex min-w-0 items-center justify-end gap-1 text-[13px] text-white/55">
        {usdt && (
          <Image
            src={TETHER_ICON}
            alt=""
            width={14}
            height={14}
            className="shrink-0 object-contain"
          />
        )}
        {usdt && chain === "BEP20" && <BnbMark size={14} />}
        <span className="truncate">{methodLabel(method, cryptoChain)}</span>
      </span>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
  mono,
  valueColor,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  mono?: boolean;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0 gap-3">
      <span className="text-[13px] text-white/45 shrink-0">{label}</span>
      <span
        className={`text-[13px] text-right break-all ${
          strong
            ? "text-white font-bold"
            : muted
              ? "text-white/55"
              : "text-white/85"
        } ${mono ? "font-mono text-[11px]" : ""}`}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

function Sheet({
  children,
  onClose,
  onCancel,
  onConfirm,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  title: string | null;
}) {
  return (
    <div
      className="fixed inset-0 z-[140] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[min(100vw,430px)] rounded-t-[18px] overflow-hidden pb-[env(safe-area-inset-bottom,0px)]"
        style={{ background: "#1a1519" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 h-12 border-b border-white/5">
          <button
            type="button"
            onClick={onCancel}
            className="text-[14px] font-semibold text-white/55 min-w-[64px] text-left"
          >
            Cancel
          </button>
          <span className="text-[15px] font-bold text-[#FED358]">
            {title ?? ""}
          </span>
          <button
            type="button"
            onClick={onConfirm}
            className="text-[14px] font-bold text-[#FED358] min-w-[64px] text-right"
          >
            Confirm
          </button>
        </div>
        {children}
        <div className="h-4" />
      </div>
    </div>
  );
}


