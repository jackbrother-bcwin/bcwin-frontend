"use client";

/**
 * Commission Details — Agency → "Commission detail"
 *
 * ADR-0011: rebate-only. Primary data = team rebate for one IST calendar day
 * (accrued on place-bet; day closes 24:00 IST — same total as TX).
 * Default / max date = yesterday — settled day only (docs/adr/0004).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "../../lib/api";
import type {
  CommissionBreakdownItem,
  RebateDailyCategoryBlock,
  RebateDailySummary,
} from "../../lib/api";
import { formatDateTime, formatDecimal, formatINR } from "../../lib/format";
import AgencyHeader from "./shared/AgencyHeader";
import DatePickerSheet from "./shared/DatePickerSheet";
import EmptyState from "./shared/EmptyState";
import CommissionDetailInnerPage from "./CommissionDetailInnerPage";
import { useSpaBackClose } from "../../hooks/useSpaBackClose";
import { latestSettledYmd } from "./dateRange";

interface Props {
  onBack: () => void;
  onOpenRebateRules?: () => void;
}

function fmtAmt(n: number) {
  return formatDecimal(n, 3);
}

type LayerBucket = {
  layer: number;
  commission: number;
  bet: number;
  users: Set<string>;
  count: number;
};

function getEffectiveSummary(
  summary: RebateDailySummary | null,
  date: string,
  rows: CommissionBreakdownItem[],
  totalBet: number,
  totalCommission: number,
  bettors: number
): RebateDailySummary {
  if (summary) return summary;

  const defaultCategories: RebateDailyCategoryBlock[] = [
    {
      category: "LOTTERY",
      title: "Lottery commission",
      bettorCount: 0,
      rebateLevel: 1,
      betAmount: 0,
      commissionPayout: 0,
      layers: [1, 2, 3, 4, 5, 6].map((L) => ({ layer: L, betAmount: 0, rate: 0, totalComm: 0 })),
    },
    {
      category: "SLOTS",
      title: "Slots commission",
      bettorCount: 0,
      rebateLevel: 1,
      betAmount: 0,
      commissionPayout: 0,
      layers: [1, 2, 3, 4, 5, 6].map((L) => ({ layer: L, betAmount: 0, rate: 0, totalComm: 0 })),
    },
    {
      category: "CASINO",
      title: "Casino commission",
      bettorCount: 0,
      rebateLevel: 1,
      betAmount: 0,
      commissionPayout: 0,
      layers: [1, 2, 3, 4, 5, 6].map((L) => ({ layer: L, betAmount: 0, rate: 0, totalComm: 0 })),
    },
    {
      category: "SPORTS",
      title: "Sports rebate",
      bettorCount: 0,
      rebateLevel: 1,
      betAmount: 0,
      commissionPayout: 0,
      layers: [1, 2, 3, 4, 5, 6].map((L) => ({ layer: L, betAmount: 0, rate: 0, totalComm: 0 })),
    },
    {
      category: "RUMMY",
      title: "Chess and card rebates",
      bettorCount: 0,
      rebateLevel: 1,
      betAmount: 0,
      commissionPayout: 0,
      layers: [1, 2, 3, 4, 5, 6].map((L) => ({ layer: L, betAmount: 0, rate: 0, totalComm: 0 })),
    },
  ];

  for (const r of rows) {
    const gameType = (r.betType || "").toUpperCase();
    const cat = defaultCategories.find((c) => c.category === gameType) ?? defaultCategories[0]!;

    cat.betAmount += Number(r.betAmount ?? 0);
    cat.commissionPayout += Number(r.commissionAmount ?? r.amount ?? 0);
    if (r.fromUser?.id) cat.bettorCount += 1;

    const layerNum = Number(r.layer) || 1;
    const lObj = cat.layers.find((l: { layer: number }) => l.layer === layerNum);
    if (lObj) {
      lObj.betAmount += Number(r.betAmount ?? 0);
      lObj.totalComm += Number(r.commissionAmount ?? r.amount ?? 0);
      if (r.commissionRate) lObj.rate = Number(r.commissionRate);
    }
  }

  return {
    date,
    settlementTime: `${date} 24:00:00`,
    settled: true,
    hasData: totalCommission > 0 || totalBet > 0 || rows.length > 0,
    bettorCount: bettors,
    totalBetAmount: totalBet,
    totalCommission: totalCommission,
    rebateLevel: 1,
    categories: defaultCategories,
  };
}

export default function CommissionDetailPage({
  onBack,
  onOpenRebateRules,
}: Props) {
  const maxDate = useMemo(() => latestSettledYmd(), []);
  const [date, setDate] = useState(maxDate);
  const [dateOpen, setDateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CommissionBreakdownItem[]>([]);
  const [totalCommission, setTotalCommission] = useState(0);
  const [totalBet, setTotalBet] = useState(0);
  const [rebateSummary, setRebateSummary] = useState<RebateDailySummary | null>(
    null
  );
  const [listOpen, setListOpen] = useState(false);
  const [rebateInnerOpen, setRebateInnerOpen] = useState(false);

  useSpaBackClose(
    listOpen || rebateInnerOpen,
    () => {
      if (rebateInnerOpen) setRebateInnerOpen(false);
      else setListOpen(false);
    },
    "commission-detail-drill"
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const day = date && date <= maxDate ? date : maxDate;
      const [rebateHist, rebateRes] = await Promise.all([
        api.getRebateHistory({
          startDate: day,
          endDate: day,
          settled: true,
          page: 1,
          limit: 500,
        }),
        api.getRebateDaily({ date: day }).catch(() => null),
      ]);

      const raw = Array.isArray(rebateHist.data) ? rebateHist.data : [];
      const data: CommissionBreakdownItem[] = raw.map((r) => ({
        id: r.id,
        layer: r.layer ?? 0,
        commissionAmount: Number(r.amount ?? 0),
        amount: Number(r.amount ?? 0),
        betAmount: Number(r.betAmount ?? 0),
        commissionRate: Number(r.rate ?? 0),
        fromUser: r.fromUser
          ? {
              id: String(r.fromUser.id ?? ""),
              username: String(r.fromUser.username ?? ""),
              ...(r.fromUser.serialNumber != null
                ? { serialNumber: Number(r.fromUser.serialNumber) }
                : {}),
            }
          : undefined,
        createdAt: r.createdAt,
        betType: r.game,
      }));
      setRows(data);

      const sumComm =
        Number(rebateRes?.data?.totalCommission) ||
        data.reduce((s, r) => s + Number(r.commissionAmount ?? 0), 0);
      const sumBet =
        Number(rebateRes?.data?.totalBetAmount) ||
        data.reduce((s, r) => s + Number(r.betAmount ?? 0), 0);

      setTotalCommission(sumComm);
      setTotalBet(sumBet);
      setRebateSummary(rebateRes?.data ?? null);
    } catch {
      setRows([]);
      setTotalCommission(0);
      setTotalBet(0);
      setRebateSummary(null);
    } finally {
      setLoading(false);
    }
  }, [date, maxDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const bettors = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      if (r.fromUser?.id) s.add(r.fromUser.id);
    }
    return s.size;
  }, [rows]);

  const rebateAmount = rebateSummary?.hasData
    ? Number(rebateSummary.totalCommission ?? 0)
    : 0;
  const displayPayout = totalCommission > 0 ? totalCommission : rebateAmount;
  const hasData = totalCommission > 0 || rows.length > 0 || rebateAmount > 0;

  if (rebateInnerOpen || listOpen) {
    const summaryToUse = getEffectiveSummary(
      rebateSummary,
      date,
      rows,
      totalBet,
      totalCommission,
      bettors
    );
    return (
      <CommissionDetailInnerPage
        summary={summaryToUse}
        onBack={() => {
          setRebateInnerOpen(false);
          setListOpen(false);
        }}
        onOpenRebateRules={onOpenRebateRules}
      />
    );
  }

  return (
    <div className="agency-page min-h-screen flex flex-col bg-[#110D14] text-[#FDE4BC]">
      <AgencyHeader title="Commission Details" onBack={onBack} />
      <div className="agency-scroll flex-1 px-3.5 pt-3 pb-8">
        {/* Date Selector Dropdown */}
        <button
          type="button"
          className="w-full bg-[#241E22] border border-[#3D363A]/60 rounded-xl px-4 py-3 text-[#FDE4BC] text-xs font-semibold flex justify-between items-center cursor-pointer mb-3.5 shadow-md hover:bg-[#2a2328] transition-colors"
          onClick={() => setDateOpen(true)}
        >
          <span>{date}</span>
          <span className="text-[#837064] text-[10px]">▼</span>
        </button>

        {loading ? (
          <div className="py-20 text-center text-[#837064] text-xs">Loading…</div>
        ) : !hasData ? (
          <div className="pt-12 pb-16 flex flex-col items-center justify-center">
            <EmptyState label="No data" />
          </div>
        ) : (
          <div
            className="bg-[#241E22] border border-[#3D363A]/60 rounded-xl p-4 shadow-md flex flex-col gap-3 cursor-pointer hover:border-[#3D363A] transition-colors"
            onClick={() => {
              setRebateInnerOpen(true);
            }}
          >
            {/* Settlement Header Info */}
            <div className="flex flex-col gap-1 border-b border-[#3D363A]/60 pb-3">
              <h3 className="text-xs font-medium text-[#FDE4BC]">
                {rebateSummary && !rebateSummary.settled
                  ? "Rebate pending settlement"
                  : "Settlement successful"}
              </h3>
              <p className="text-xs text-[#837064] font-mono">
                {rebateSummary?.settlementTime || `${date} 24:00:00`}
              </p>
              <p className="text-[11px] text-[#837064] leading-relaxed">
                {rebateSummary && !rebateSummary.settled
                  ? "Team rebate accrues and settles on schedule"
                  : "The commission has been automatically credited to your balance"}
              </p>
            </div>

            {/* Key-Value Table Rows */}
            <div className="bg-[#181316] border border-[#3D363A]/50 rounded-lg overflow-hidden flex flex-col divide-y divide-[#3D363A]/40 text-xs">
              <div className="flex justify-between items-center px-3.5 py-3">
                <span className="text-[#837064] font-medium">Number of bettors</span>
                <span className="text-[#FDE4BC] font-semibold">{bettors} People</span>
              </div>
              <div className="flex justify-between items-center px-3.5 py-3">
                <span className="text-[#837064] font-medium">Bet amount</span>
                <span className="text-[#FDE4BC] font-semibold">{fmtAmt(totalBet)}</span>
              </div>
              <div className="flex justify-between items-center px-3.5 py-3">
                <span className="text-[#837064] font-medium">Commission payout</span>
                <span className="text-[#FED358] font-bold text-sm">{fmtAmt(displayPayout)}</span>
              </div>
              <div className="flex justify-between items-center px-3.5 py-3">
                <span className="text-[#837064] font-medium">date</span>
                <span className="text-[#FDE4BC] font-mono">{date} 00:00:00</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <DatePickerSheet
        open={dateOpen}
        value={date && date <= maxDate ? date : maxDate}
        maxYmd={maxDate}
        onCancel={() => setDateOpen(false)}
        onConfirm={(d) => {
          setDate(d && d <= maxDate ? d : maxDate);
          setDateOpen(false);
        }}
      />
    </div>
  );
}
