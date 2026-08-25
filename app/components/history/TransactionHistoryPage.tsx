"use client";

/**
 * Account → Transaction history (BCWIN-style).
 * Dual filters: type bottom-sheet + date wheel. Cards: Detail / Time / Balance.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IoChevronDown, IoRefresh } from "react-icons/io5";
import PageHeader from "../ui/PageHeader";
import LoadingSpinner from "../ui/LoadingSpinner";
import EmptyState from "../ui/EmptyState";
import { useToast } from "../ui/Toast";
import * as api from "../../lib/api";
import { formatINR, formatUSD } from "../../lib/format";
import {
  TX_FILTERS,
  labelForTxType,
  type TxFilterId,
  type TxItem,
} from "./transactionTypes";
import { useSpaBackClose } from "../../hooks/useSpaBackClose";
import { DateOdometer, ymdFromParts } from "../ui/DatePickerSheet";
import { Pagination } from "../game/shared";
import {
  HISTORY_MAX_PAGES,
  capHistoryPage,
  capHistoryPages,
} from "../../lib/history-pages";
import {
  istDayEndIso,
  istDayEndLabel,
  latestSettledYmd,
  rebateIstDay,
  ymdIst,
} from "../../lib/ist-day";

/** Client-side page size (ledger is already merged in memory) */
const PAGE_SIZE = 20;

/** Must stay within backend activity history max (200) */
const ACTIVITY_HISTORY_LIMIT = 100;

interface Props {
  onBack: () => void;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatTxTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function dateKey(iso: string) {
  return rebateIstDay(iso);
}

function yesterdayKey() {
  return latestSettledYmd();
}

/** Previous IST calendar month as { start, end } YYYY-MM-DD inclusive */
function lastMonthRange() {
  const today = ymdIst();
  const [ys, ms] = today.split("-").map(Number);
  const m = ms === 1 ? 12 : (ms ?? 1) - 1;
  const y = ms === 1 ? (ys ?? 0) - 1 : (ys ?? 0);
  const start = `${y}-${pad2(m)}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${pad2(m)}-${pad2(lastDay)}`;
  return { start, end };
}

type DatePreset = "all" | "yesterday" | "last_month" | "custom";

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last_month", label: "Last month" },
  { id: "custom", label: "Custom date" },
];

function push(
  list: TxItem[],
  item: Omit<TxItem, "amount"> & { amount: number }
) {
  if (!item.amount || item.amount <= 0) return;
  list.push(item);
}

type LedgerSource =
  | "deposits"
  | "withdrawals"
  | "games"
  | "rebates"
  | "selfRebates"
  | "bonuses"
  | "salary"
  | "vip"
  | "inviteSpins"
  | "luckySpins"
  | "gifts";

const LEDGER_SOURCE_LABEL: Record<LedgerSource, string> = {
  deposits: "deposits",
  withdrawals: "withdrawals",
  games: "game history",
  rebates: "rebates",
  selfRebates: "self rebate",
  bonuses: "bonuses / top-up rewards",
  salary: "salary",
  vip: "VIP rewards",
  inviteSpins: "spin wheel",
  luckySpins: "lucky spin",
  gifts: "gift codes",
};

/** Build unified ledger from existing user APIs */
async function loadLedger(): Promise<{ items: TxItem[]; failed: LedgerSource[] }> {
  const out: TxItem[] = [];
  const failed: LedgerSource[] = [];

  const settled = await Promise.allSettled([
    // Higher caps so ledger closer to DB (same APIs; no new architecture)
    api.getDeposits({ page: 1, limit: 500, status: "SUCCESS" }),
    api.getWithdrawals({ page: 1, limit: 500, status: "SUCCESS" }),
    api.getGameHistory({ page: 1, limit: 200 }),
    // ADR-0011: legacy commission list not used for new ledger; rebate only
    Promise.resolve({ data: [] as api.CommissionBreakdownItem[] }),
    // Settled team rebate only; grouped below by IST 00:00–24:00 (same as Agency)
    api.getAllSettledRebates().then((data) => ({ data })),
    api.getSelfRebateHistory({ limit: 500 }),
    // Backend activity history max 200; stay at 100 for headroom
    api.getActivityHistory({ page: 1, limit: ACTIVITY_HISTORY_LIMIT }),
    api.getSalary({ page: 1, limit: 100, creditedOnly: true }),
    api.getVipClaimHistory({ page: 1, limit: 100, type: "all" }),
    api.getSpinHistory({ page: 1, limit: 50 }),
    api.getLuckySpinHistory({ page: 1, limit: 50 }),
    api.getGiftHistory(),
  ]);

  const [
    deposits,
    withdrawals,
    games,
    commissions,
    rebates,
    selfRebates,
    bonuses,
    salary,
    vipClaims,
    inviteSpins,
    luckySpins,
    gifts,
  ] = settled;

  const track = (r: PromiseSettledResult<unknown>, key: LedgerSource) => {
    if (r.status === "rejected") failed.push(key);
  };
  track(deposits, "deposits");
  track(withdrawals, "withdrawals");
  track(games, "games");
  track(rebates, "rebates");
  track(selfRebates, "selfRebates");
  track(bonuses, "bonuses");
  track(salary, "salary");
  track(vipClaims, "vip");
  track(inviteSpins, "inviteSpins");
  track(luckySpins, "luckySpins");
  track(gifts, "gifts");

  if (deposits.status === "fulfilled") {
    for (const d of deposits.value.deposits ?? []) {
      const st = String(d.status ?? "").toUpperCase();
      if (st !== "SUCCESS") continue;
      const method = String(d.method ?? "").toUpperCase();
      let type: TxFilterId = "DEPOSIT";
      if (method.includes("USDT") || method === "OXAPAY") type = "USDT_DEPOSIT";
      if (method === "MANUAL" || method.includes("MANUAL")) type = "MANUAL_DEPOSIT";
      const isUsdt = type === "USDT_DEPOSIT";
      const usdt = d.usdtAmount != null ? Number(d.usdtAmount) : NaN;
      const primary =
        isUsdt && Number.isFinite(usdt) ? usdt : Number(d.amount);
      push(out, {
        id: `dep-${d.id}`,
        type,
        title: labelForTxType(type),
        amount: primary,
        amountUnit: isUsdt && Number.isFinite(usdt) ? "usdt" : "inr",
        amountHintInr:
          isUsdt && Number.isFinite(usdt) ? Number(d.amount) : null,
        credit: true,
        createdAt: d.createdAt,
        detail: d.orderId,
      });
    }
  }

  if (withdrawals.status === "fulfilled") {
    for (const w of withdrawals.value.withdrawals ?? []) {
      const st = String(w.status ?? "").toUpperCase();
      if (st !== "SUCCESS") continue;
      push(out, {
        id: `wd-${w.id}`,
        type: "WITHDRAW",
        title: labelForTxType("WITHDRAW"),
        amount: Number(w.amount),
        credit: false,
        createdAt: w.createdAt,
        detail: w.orderId,
      });
    }
  }

  if (games.status === "fulfilled") {
    for (const g of games.value.data ?? []) {
      const betAmt = Number(g.betAmount ?? 0);
      const winAmt = Number(g.winAmount ?? 0);
      const major = String(g.majorGameType ?? "").toUpperCase();
      const isSlot =
        major === "INOUT" || major.includes("SLOT");

      // Stake: lottery → Bet; third-party/slots → Game moved in (wallet → game)
      push(out, {
        id: `bet-${g.id}`,
        type: isSlot ? "GAME_MOVED_IN" : "BET",
        title: isSlot
          ? labelForTxType("GAME_MOVED_IN")
          : labelForTxType("BET"),
        amount: betAmt,
        credit: false, // debit → red
        createdAt: g.createdAt,
        detail: g.gameName || g.majorGameType,
      });

      if (winAmt > 0) {
        // Win / return: lottery → Win; slots → Game moved out (game → wallet)
        push(out, {
          id: `win-${g.id}`,
          type: isSlot ? "GAME_MOVED_OUT" : "WIN",
          title: isSlot
            ? labelForTxType("GAME_MOVED_OUT")
            : labelForTxType("WIN"),
          amount: winAmt,
          credit: true, // credit → green
          createdAt: g.createdAt,
          detail: g.gameName || g.majorGameType,
        });
      }
    }
  }

  if (commissions.status === "fulfilled") {
    const rows = commissions.value.data ?? [];
    for (const c of rows) {
      const amt = Number(c.commissionAmount ?? c.amount ?? 0);
      push(out, {
        id: `com-${c.id}`,
        type: "AGENT_COMMISSION",
        title: labelForTxType("AGENT_COMMISSION"),
        amount: amt,
        credit: true,
        createdAt: c.createdAt ?? new Date().toISOString(),
        detail: c.fromUser?.username
          ? `From ${c.fromUser.username}`
          : undefined,
      });
    }
  }

  if (rebates.status === "fulfilled") {
    // One ledger line per IST calendar day (00:00–24:00), same total as Agency
    const byDay = new Map<
      string,
      { amount: number; count: number }
    >();
    for (const r of rebates.value.data ?? []) {
      if (r.settled === false) continue;
      const day = rebateIstDay(r.createdAt);
      if (!day) continue;
      const prev = byDay.get(day) ?? { amount: 0, count: 0 };
      prev.amount += Number(r.amount ?? 0);
      prev.count += 1;
      byDay.set(day, prev);
    }
    for (const [day, v] of byDay) {
      push(out, {
        id: `reb-day-${day}`,
        type: "AGENT_COMMISSION",
        title: labelForTxType("AGENT_COMMISSION"),
        amount: Number(v.amount),
        credit: true,
        createdAt: istDayEndIso(day),
        timeDisplay: istDayEndLabel(day),
        detail:
          v.count > 1
            ? `${v.count} team bets settled`
            : "Agent commission settled",
      });
    }
  }

  if (selfRebates.status === "fulfilled") {
    for (const r of selfRebates.value.data ?? []) {
      if (r.status === "Completed" && r.rebateAmount > 0) {
        push(out, {
          id: `self-reb-${r.date}-${r.category}`,
          type: "ONE_CLICK_REBATE",
          title: labelForTxType("ONE_CLICK_REBATE"),
          amount: Number(r.rebateAmount),
          credit: true,
          createdAt: `${r.date}T01:00:00.000Z`,
          detail: r.title || r.category,
        });
      }
    }
  }

  // Dedicated spin/gift histories (prefer over generic activity SPIN_WHEEL to avoid doubles)
  const luckySpinIds = new Set<string>();
  if (luckySpins.status === "fulfilled") {
    for (const s of luckySpins.value.data ?? []) {
      luckySpinIds.add(s.id);
      const amt = Number(s.amount);
      if (!amt || amt <= 0) continue;
      push(out, {
        id: `lucky-${s.id}`,
        type: "LUCKY_SPIN_REWARD",
        title: labelForTxType("LUCKY_SPIN_REWARD"),
        amount: amt,
        credit: true,
        createdAt: s.claimAt || s.createdAt,
        detail: "Lucky Spin",
      });
    }
  }

  if (inviteSpins.status === "fulfilled") {
    for (const s of inviteSpins.value.data ?? []) {
      // Invite history API returns all SPIN_WHEEL; skip lucky rows already added
      if (luckySpinIds.has(s.id)) continue;
      const amt = Number(s.amount);
      if (!amt || amt <= 0) continue;
      push(out, {
        id: `invite-spin-${s.id}`,
        type: "INVITE_WHEEL_REWARD",
        title: labelForTxType("INVITE_WHEEL_REWARD"),
        amount: amt,
        credit: true,
        createdAt: s.claimAt || s.createdAt,
        detail: "Invite Wheel",
      });
    }
  }

  if (gifts.status === "fulfilled") {
    for (const g of gifts.value.data ?? []) {
      const amt = Number(g.amount);
      if (!amt || amt <= 0) continue;
      push(out, {
        id: `gift-${g.id}`,
        type: "GIFT_REDEEM",
        title: labelForTxType("GIFT_REDEEM"),
        amount: amt,
        credit: true,
        createdAt: g.createdAt,
        detail: g.code ? `Code ${g.code}` : "Gift redeem",
      });
    }
  }

  if (bonuses.status === "fulfilled") {
    for (const b of bonuses.value.data ?? []) {
      const st = String(b.status ?? "").toUpperCase();
      if (st !== "COLLECTED" && st !== "COMPLETED_UNCOLLECTED") continue;
      const t = String(b.type ?? "").toUpperCase();
      // Spins handled via dedicated history endpoints above
      if (t === "SPIN_WHEEL") continue;
      let type: TxFilterId = "DAILY_REWARD";
      if (t === "ATTENDENCE" || t === "ATTENDANCE") type = "ATTENDANCE_BONUS";
      else if (t === "FIRST_DEPOSIT") type = "FIRST_DEPOSIT_BONUS";
      else if (t === "WEEKLY") type = "WEEKLY_AWARD";
      else if (t === "DAILY") type = "DAILY_REWARD";
      else if (t === "INVITATION") type = "INVITE_BONUS";
      else if (t === "WIN_STREAK") type = "RETURN_REWARD";
      else if (t === "INR_RECHARGE_BONUS" || t === "USDT_RECHARGE_BONUS")
        type = "TOP_UP_REWARD";
      push(out, {
        id: `bon-${b.id}`,
        type,
        title: labelForTxType(type),
        amount: Number(b.amount),
        credit: true,
        createdAt: b.claimAt || b.createdAt,
      });
    }
  }

  if (salary.status === "fulfilled") {
    // Auto-salary APPROVED claims only (wallet-credited by admin)
    const pays = salary.value.payments ?? salary.value.data ?? [];
    for (const s of pays) {
      const st = String(s.status ?? "APPROVED").toUpperCase();
      if (st !== "APPROVED") continue;
      push(out, {
        id: `sal-${s.id}`,
        type: "AGENT_SALARY",
        title: labelForTxType("AGENT_SALARY"),
        amount: Number(s.amount),
        credit: true,
        createdAt: s.createdAt,
        detail: s.note || (s.periodDate ? `Period ${s.periodDate}` : undefined),
      });
    }
  }

  if (vipClaims.status === "fulfilled") {
    for (const c of vipClaims.value.data ?? []) {
      const isMonthly = c.type === "MONTHLY";
      const type: TxFilterId = isMonthly
        ? "VIP_MONTHLY_REWARD"
        : "VIP_LEVEL_UP_REWARD";
      push(out, {
        id: `vip-${c.id}`,
        type,
        title: labelForTxType(type),
        amount: Number(c.amount),
        credit: true,
        createdAt: c.createdAt,
        detail: isMonthly
          ? `VIP${c.level}${c.monthYear ? ` · ${c.monthYear}` : ""}`
          : `VIP${c.level} level-up`,
      });
    }
  }

  out.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return { items: out, failed };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TransactionHistoryPage({ onBack }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<TxItem[]>([]);
  const [filterId, setFilterId] = useState<TxFilterId>("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customDate, setCustomDate] = useState<string | null>(null); // YYYY-MM-DD

  const [typeSheet, setTypeSheet] = useState(false);
  const [dateSheet, setDateSheet] = useState(false);
  const [draftType, setDraftType] = useState<TxFilterId>("ALL");
  const [draftPreset, setDraftPreset] = useState<DatePreset>("all");
  const now = new Date();
  const [draftY, setDraftY] = useState(now.getFullYear());
  const [draftM, setDraftM] = useState(now.getMonth() + 1);
  const [draftD, setDraftD] = useState(now.getDate());
  const [page, setPage] = useState(1);
  const loadGen = useRef(0);
  const lastSilentAt = useRef(0);

  const load = useCallback(
    async (opts?: { silent?: boolean; reportFailures?: boolean }) => {
      const silent = !!opts?.silent;
      const reportFailures = opts?.reportFailures ?? !silent;
      // Throttle background refetches (visibility)
      if (silent && !opts?.reportFailures) {
        const nowMs = Date.now();
        if (nowMs - lastSilentAt.current < 12_000) return;
        lastSilentAt.current = nowMs;
      }
      const gen = ++loadGen.current;
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const { items: list, failed } = await loadLedger();
        if (gen !== loadGen.current) return;
        setItems(list);
        if (!silent) setPage(1);
        if (failed.length > 0) {
          if (typeof console !== "undefined") {
            console.warn("[tx-history] ledger sources failed:", failed);
          }
          // Toast on open/refresh; skip visibility auto-refetch to avoid spam
          if (reportFailures) {
            const labels = failed
              .slice(0, 3)
              .map((k) => LEDGER_SOURCE_LABEL[k])
              .join(", ");
            const extra =
              failed.length > 3 ? ` +${failed.length - 3} more` : "";
            toast(
              `Some history failed to load (${labels}${extra}). Try refresh.`,
              "error"
            );
          }
        }
      } catch {
        if (gen !== loadGen.current) return;
        setItems([]);
        if (!silent) setPage(1);
        if (reportFailures) toast("Could not load transaction history", "error");
      } finally {
        if (gen === loadGen.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [toast]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Near real-time: refetch when tab/app becomes visible again
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void load({ silent: true, reportFailures: false });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const filtered = useMemo(() => {
    const yKey = yesterdayKey();
    const lm = lastMonthRange();
    return items.filter((it) => {
      if (filterId !== "ALL" && it.type !== filterId) {
        const commissionAlias =
          (filterId === "AGENT_COMMISSION" && it.type === "BETTING_REBATE") ||
          (filterId === "BETTING_REBATE" && it.type === "AGENT_COMMISSION");
        if (!commissionAlias) return false;
      }
      const k = dateKey(it.createdAt);
      if (datePreset === "all") return true;
      if (datePreset === "yesterday") return k === yKey;
      if (datePreset === "last_month") return k >= lm.start && k <= lm.end;
      if (datePreset === "custom" && customDate) return k === customDate;
      return true;
    });
  }, [items, filterId, datePreset, customDate]);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterId, datePreset, customDate]);

  const totalPages = capHistoryPages(
    Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  );
  const pageSafe = capHistoryPage(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageSafe]);

  const filterLabel =
    filterId === "ALL" ? "All" : labelForTxType(filterId);
  const dateLabel =
    datePreset === "all"
      ? "All time"
      : datePreset === "yesterday"
        ? "Yesterday"
        : datePreset === "last_month"
          ? "Last month"
          : customDate ?? "Custom date";

  const openType = () => {
    setDraftType(filterId);
    setTypeSheet(true);
  };
  const openDate = () => {
    setDraftPreset(datePreset);
    if (datePreset === "custom" && customDate) {
      const [y, m, d] = customDate.split("-").map(Number);
      setDraftY(y!);
      setDraftM(m!);
      setDraftD(d!);
    } else {
      const n = new Date();
      setDraftY(n.getFullYear());
      setDraftM(n.getMonth() + 1);
      setDraftD(n.getDate());
    }
    setDateSheet(true);
  };

  return (
    <div
      className="flex flex-col min-h-screen min-w-0 w-full max-w-full overflow-x-clip pb-[max(2.5rem,env(safe-area-inset-bottom))]"
      style={{ background: "#110D14" }}
    >
      <PageHeader
        title="Transaction history"
        onBack={onBack}
        right={
          <button
            type="button"
            onClick={() =>
              void load({ silent: true, reportFailures: true })
            }
            disabled={loading || refreshing}
            className="flex h-9 w-9 items-center justify-center text-[#FED358] active:opacity-60 disabled:opacity-40"
            aria-label="Refresh transactions"
          >
            <IoRefresh
              size={18}
              className={refreshing ? "animate-spin" : undefined}
            />
          </button>
        }
      />

      {/* Filter bar */}
      <div className="px-2.5 sm:px-3 pt-2 pb-3 flex gap-2 min-w-0">
        <button
          type="button"
          onClick={openType}
          className="flex-1 min-w-0 h-10 rounded-[10px] px-2.5 sm:px-3 flex items-center justify-between text-[14px] sm:text-[15px] font-semibold"
          style={{
            background: "#241E22",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.85)",
          }}
        >
          <span className="truncate">{filterLabel}</span>
          <IoChevronDown size={16} className="opacity-50 shrink-0 ml-1" />
        </button>
        <button
          type="button"
          onClick={openDate}
          className="flex-1 min-w-0 h-10 rounded-[10px] px-2.5 sm:px-3 flex items-center justify-between text-[14px] sm:text-[15px] font-semibold"
          style={{
            background: "#241E22",
            border: "1px solid rgba(255,255,255,0.06)",
            color:
              datePreset !== "all"
                ? "rgba(255,255,255,0.85)"
                : "rgba(255,255,255,0.55)",
          }}
        >
          <span className="truncate">{dateLabel}</span>
          <IoChevronDown size={16} className="opacity-50 shrink-0 ml-1" />
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No transactions"
          subtitle={
            filterId !== "ALL" || datePreset !== "all"
              ? "Try another filter or date"
              : "Your balance changes will appear here"
          }
        />
      ) : (
        <div className="px-3 space-y-3 pb-2">
          {pageItems.map((it) => (
            <article
              key={it.id}
              className="rounded-[12px] overflow-hidden"
              style={{
                background: "#241E22",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {/* Title strip */}
              <div
                className="px-3.5 py-2.5 text-[16px] font-bold"
                style={{
                  color: "rgba(254,211,88,0.92)",
                  background: "rgba(0,0,0,0.18)",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                {it.title}
              </div>

              <div className="px-3.5 py-1">
                <Row label="Detail" value={it.detail || it.title} muted />
                <Row
                  label="Time"
                  value={it.timeDisplay ?? formatTxTime(it.createdAt)}
                  muted
                />
                <Row
                  label="Balance"
                  value={
                    it.amountUnit === "usdt"
                      ? `${formatUSD(it.amount)} USDT`
                      : formatINR(it.amount)
                  }
                  valueClass={
                    it.credit ? "text-[#17B15E] font-bold" : "text-[#DA3735] font-bold"
                  }
                />
                {it.amountUnit === "usdt" &&
                it.amountHintInr != null &&
                Number.isFinite(it.amountHintInr) ? (
                  <div className="flex justify-between py-1.5 text-[13px] text-white/35">
                    <span />
                    <span className="tabular-nums">
                      ≈ {formatINR(it.amountHintInr)}
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Spacer bar like screenshot bottom strip */}
              <div
                className="h-10 mx-3 mb-3 mt-1 rounded-md"
                style={{ background: "rgba(0,0,0,0.22)" }}
              />
            </article>
          ))}

          {totalPages > 1 && (
            <div className="pt-1 pb-4">
              <p className="text-center text-[12px] text-white/35 mb-1 tabular-nums">
                {filtered.length} total · page {pageSafe}/{totalPages}
              </p>
              <Pagination
                page={pageSafe}
                totalPages={totalPages}
                maxPages={HISTORY_MAX_PAGES}
                onChange={(p) => {
                  setPage(capHistoryPage(p, totalPages));
                  if (typeof window !== "undefined") {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Type filter sheet */}
      {typeSheet && (
        <Sheet
          onClose={() => setTypeSheet(false)}
          onCancel={() => setTypeSheet(false)}
          onConfirm={() => {
            setFilterId(draftType);
            setTypeSheet(false);
          }}
          title={null}
        >
          <div className="max-h-[48vh] overflow-y-auto no-scrollbar py-2">
            {TX_FILTERS.filter(
              (f) =>
                f.id !== "BETTING_REBATE" &&
                f.id !== "CANCEL_WITHDRAW" &&
                f.id !== "WITHDRAWAL_REJECTS"
            ).map((f) => {
              const on = draftType === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setDraftType(f.id)}
                  className="w-full py-3.5 text-center text-[17px] font-semibold active:opacity-80"
                  style={{
                    color: on ? "#FED358" : "rgba(255,255,255,0.55)",
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </Sheet>
      )}

      {/* Date filter sheet */}
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
          cancelLabel="Cancel"
        >
          {/* Presets: All time / Yesterday / Last month / Custom */}
          <div className="grid grid-cols-2 gap-2 px-4 pt-3 pb-2">
            {DATE_PRESETS.map((p) => {
              const on = draftPreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setDraftPreset(p.id)}
                  className="h-10 rounded-[10px] text-[15px] font-bold active:scale-[0.98]"
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

          {/* Global odometer when Custom date is active */}
          {draftPreset === "custom" && (
            <>
              <p className="px-4 pt-1 pb-1 text-[13px] text-white/35 font-semibold uppercase tracking-wider">
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

          {draftPreset !== "custom" && (
            <p className="px-4 py-6 text-center text-[14px] text-white/35">
              {draftPreset === "all" && "Show transactions from any date"}
              {draftPreset === "yesterday" &&
                `Only ${yesterdayKey().replace(/-/g, "/")}`}
              {draftPreset === "last_month" &&
                (() => {
                  const r = lastMonthRange();
                  return `From ${r.start} to ${r.end}`;
                })()}
            </p>
          )}
        </Sheet>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  valueClass,
}: {
  label: string;
  value: string;
  muted?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-[15px] text-white/45">{label}</span>
      <span
        className={`text-[15px] text-right ${
          valueClass ?? (muted ? "text-white/55" : "text-white/85")
        }`}
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
  cancelLabel = "Cancel",
}: {
  children: React.ReactNode;
  onClose: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  title: string | null;
  cancelLabel?: string;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useSpaBackClose(true, onClose, `tx-sheet-${title ?? "filter"}`);
  return (
    <div
      className="fixed inset-0 z-[140] flex items-end justify-center px-0"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={sheetRef}
        className="w-full max-w-[min(100vw,430px)] rounded-t-[18px] overflow-hidden pb-[env(safe-area-inset-bottom,0px)]"
        style={{
          background: "#1a1519",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 h-12"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button
            type="button"
            onClick={onCancel}
            className="text-[16px] font-semibold text-white/55 min-w-[64px] text-left"
          >
            {cancelLabel}
          </button>
          <span className="text-[17px] font-bold text-[#FED358]">
            {title ?? ""}
          </span>
          <button
            type="button"
            onClick={onConfirm}
            className="text-[16px] font-bold text-[#FED358] min-w-[64px] text-right"
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
