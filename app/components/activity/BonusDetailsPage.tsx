"use client";

import React, { useEffect, useState } from "react";
import PageHeader from "../ui/PageHeader";
import LoadingSpinner from "../ui/LoadingSpinner";
import StatusBadge from "../ui/StatusBadge";
import * as api from "../../lib/api";
import type { ActivityBonus } from "../../lib/api";
import { formatDateTime, formatINR } from "../../lib/format";

const BONUS_TYPE_LABEL: Record<string, string> = {
  WEEKLY: "Weekly bonus",
  DAILY: "Daily bonus",
  INVITATION: "Invitation bonus",
  FIRST_DEPOSIT: "First deposit bonus",
  ATTENDENCE: "Attendance bonus",
  SPIN_WHEEL: "Spin wheel",
  WIN_STREAK: "Win streak",
  INR_RECHARGE_BONUS: "INR recharge bonus",
  USDT_RECHARGE_BONUS: "USDT recharge bonus",
};

function bonusTypeLabel(type: string | undefined): string {
  if (!type) return "Bonus";
  return BONUS_TYPE_LABEL[type] ?? type.replace(/_/g, " ");
}

export default function BonusDetailsPage({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ActivityBonus[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getActivityHistory({ page: 1, limit: 80 });
        if (!cancelled) setRows(res.data ?? []);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-screen pb-24" style={{ background: "#110D14" }}>
      <PageHeader title="Bonus details" onBack={onBack} />

      {loading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <p className="text-center text-white/35 text-[15px] py-16">No more</p>
      ) : (
        <div className="px-3 space-y-2">
          {rows.map((b) => (
            <div
              key={b.id}
              className="rounded-[12px] p-3 flex justify-between items-center"
              style={{
                background: "#241E22",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-white truncate">
                  {bonusTypeLabel(b.type)}
                </p>
                <p className="text-[16px] font-black text-[#FED358] tabular-nums">
                  {formatINR(b.amount)}
                </p>
                {b.createdAt && (
                  <p className="text-[12px] text-white/30 mt-0.5">
                    {formatDateTime(b.createdAt)}
                  </p>
                )}
              </div>
              <StatusBadge status={b.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
