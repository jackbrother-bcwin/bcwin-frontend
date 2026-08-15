"use client";

/**
 * New subordinates — Agency header filter only.
 * Simple: Today / Yesterday / This month + list of people who registered then.
 * Full stats live on Subordinate data (menu), not here.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "../../lib/api";
import type { TeamMember } from "../../lib/api";
import { formatINR } from "../../lib/format";
import AgencyHeader from "./shared/AgencyHeader";
import EmptyState from "./shared/EmptyState";
import { rangeForPreset, shiftYmd, ymdLocal } from "./dateRange";

interface Props {
  onBack: () => void;
}

type PeriodId = "today" | "yesterday" | "this_month";

const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this_month", label: "This month" },
];

function asArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  return [];
}

function memberDayKey(createdAt: string | undefined): string {
  if (!createdAt) return "";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  return ymdLocal(d);
}

function registeredInPeriod(
  createdAt: string | undefined,
  period: PeriodId
): boolean {
  const k = memberDayKey(createdAt);
  if (!k) return false;
  if (period === "today") return k === ymdLocal();
  if (period === "yesterday") return k === shiftYmd(ymdLocal(), -1);
  const r = rangeForPreset("this_month");
  return !!(r.startDate && r.endDate && k >= r.startDate && k <= r.endDate);
}

function CopyUidButton({ uid }: { uid: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(uid);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1 text-[#FED358] hover:text-[#FFE9A8] transition-colors flex items-center gap-1 cursor-pointer"
      title="Copy UID"
    >
      {copied ? (
        <span className="text-[10px] text-green-400 font-semibold">Copied!</span>
      ) : (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}

export default function NewSubordinatesPage({ onBack }: Props) {
  const [period, setPeriod] = useState<PeriodId>("today");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Direct subordinates (layer 1) only
      const res = await api.getTeamMembers({
        page: 1,
        limit: 100,
        layer: 1,
      });
      setMembers(asArray<TeamMember>(res.data));
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const list = useMemo(
    () => members.filter((m) => (m.layer === undefined || m.layer === 1) && registeredInPeriod(m.createdAt, period)),
    [members, period]
  );

  return (
    <div className="agency-page min-h-screen flex flex-col bg-[#110D14] text-[#FDE4BC]">
      <AgencyHeader title="New subordinates" onBack={onBack} />
      <div className="agency-scroll flex-1 px-3 pt-2 pb-6">
        {/* 3-segment period filter tabs */}
        <div className="grid grid-cols-3 gap-2.5 my-3">
          {PERIODS.map((p) => {
            const on = period === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`h-10 rounded-[10px] text-[13px] transition-all duration-200 flex items-center justify-center px-2 cursor-pointer select-none ${
                  on
                    ? "bg-gradient-to-b from-[#FFE9A8] via-[#FED358] to-[#E8A84A] text-[#5c3a08] font-bold shadow-md shadow-[#FED358]/20 border border-[#FED358]/50"
                    : "bg-[#241E22] text-[#B79C8B] font-medium border border-[#3D363A]/60 hover:bg-[#2c2429] hover:text-[#FDE4BC]"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="py-20 text-center text-[#837064] text-xs">Loading…</div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 pb-20">
            <EmptyState label="No data" />
          </div>
        ) : (
          <div className="flex flex-col gap-3 mt-3">
            <div className="px-1 pb-1 text-[11px] text-[#837064]">
              {list.length} {list.length === 1 ? "direct subordinate" : "direct subordinates"} registered{" "}
              {period === "today"
                ? "today"
                : period === "yesterday"
                  ? "yesterday"
                  : "this month"}
            </div>
            {list.map((m) => {
              const uid = String(m.serialNumber ?? m.id);
              const nickname = String(m.username ?? "—").trim() || "—";
              const createdAtDate = memberDayKey(m.createdAt);

              return (
                <div
                  key={m.id}
                  className="bg-[#241E22] border border-[#3D363A]/60 rounded-xl p-3.5 flex flex-col shadow-sm"
                >
                  {/* Card Header: UID + copy (left) · nickname (right) */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#3D363A]/60">
                    <div className="flex min-w-0 items-center gap-0.5">
                      <span className="text-sm font-bold text-[#FDE4BC] tracking-wide tabular-nums">
                        UID:{uid}
                      </span>
                      <CopyUidButton uid={uid} />
                    </div>
                    <span
                      className="max-w-[45%] truncate text-right text-sm font-semibold text-[#FED358]"
                      title={nickname}
                    >
                      {nickname}
                    </span>
                  </div>

                  {/* Card Details: Level, Mobile/Email, Deposit amount, Commission, Time */}
                  <div className="flex flex-col gap-2 pt-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[#837064] font-medium">Level</span>
                      <span className="text-[#FDE4BC] font-semibold">{m.layer ?? 1}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#837064] font-medium">
                        {m.mobileNumber ? "Mobile number" : "Email"}
                      </span>
                      <span className="text-[#FDE4BC] font-mono">
                        {m.mobileNumber || m.email || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#837064] font-medium">Deposit amount</span>
                      <span className="text-[#FED358] font-semibold">
                        {formatINR(m.totalDeposit ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#837064] font-medium">Commission</span>
                      <span className="text-[#FED358] font-semibold">
                        {formatINR(m.commissionGenerated ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#837064] font-medium">Time</span>
                      <span className="text-[#837064] font-mono">{createdAtDate}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
