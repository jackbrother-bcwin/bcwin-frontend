"use client";

/**
 * Subordinate data — full overview (search, tier, date, stats grid, member list).
 * Not the same as header “New subordinates” (simple period list).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "../../lib/api";
import type { TeamMember } from "../../lib/api";
import { formatINR } from "../../lib/format";
import AgencyHeader from "./shared/AgencyHeader";
import EmptyState from "./shared/EmptyState";
import DatePickerSheet from "./shared/DatePickerSheet";
import TierPickerSheet from "./shared/TierPickerSheet";
import { latestSettledYmd } from "./dateRange";

interface Props {
  onBack: () => void;
}

function asArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  return [];
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

export default function SubordinateDataPage({ onBack }: Props) {
  const maxDate = useMemo(() => latestSettledYmd(), []);
  const [search, setSearch] = useState("");
  /** "all" or "1"–"6". Stats stay one settled IST day. */
  const [tier, setTier] = useState("all");
  /** Single IST day, default yesterday (latest settled). Never today / all-time. */
  const [date, setDate] = useState<string>(maxDate);
  const [tierOpen, setTierOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [summary, setSummary] = useState<api.TeamMembersSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Always a settled IST day (default/max = yesterday). API returns
      // only people with bets/deposits/settled rebate on that day.
      const day = date && date <= maxDate ? date : maxDate;
      const res = await api.getTeamMembers({
        page: 1,
        limit: 100,
        layer: !tier || tier === "all" ? undefined : tier,
        username: search.trim() || undefined,
        date: day,
      });
      setMembers(asArray<TeamMember>(res.data));
      setSummary(res.summary ?? null);
    } catch {
      setMembers([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [tier, search, date, maxDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const tierLabel =
    !tier || tier === "all" ? "All tiers" : `Tier ${tier}`;
  const dateLabel = date && date <= maxDate ? date : maxDate;

  return (
    <div className="agency-page min-h-screen flex flex-col bg-[#110D14] text-[#FDE4BC]">
      <AgencyHeader title="Subordinate data" onBack={onBack} />
      <div className="agency-scroll flex-1 px-3 pt-3 pb-8">
        {/* Search & Filter Card */}
        <div className="bg-[#241E22] border border-[#3D363A]/60 rounded-xl p-3 mb-3 shadow-md flex flex-col gap-2.5">
          {/* Row 1: Search input + Gold Search Button */}
          <div className="flex items-center gap-2">
            <input
              className="flex-1 bg-[#181316] text-[#FDE4BC] placeholder-[#837064] text-xs h-10 px-3 rounded-lg border border-[#3D363A]/60 focus:outline-none focus:border-[#FED358]/60 transition-colors"
              placeholder="Search subordinate UID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void load()}
              enterKeyHint="search"
            />
            <button
              type="button"
              className="w-10 h-10 rounded-lg bg-gradient-to-b from-[#FFE9A8] via-[#FED358] to-[#E8A84A] text-[#5c3a08] flex items-center justify-center flex-shrink-0 cursor-pointer shadow-sm active:scale-95 transition-transform"
              onClick={() => void load()}
              aria-label="Search"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-[#5c3a08] stroke-[2.2]">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M16.5 16.5L21 21" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Row 2: Tier & Date Dropdown Select Triggers */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              className="h-9 bg-[#181316] text-[#FDE4BC] text-xs px-3 rounded-lg border border-[#3D363A]/60 flex items-center justify-between cursor-pointer hover:bg-[#20191e] transition-colors"
              onClick={() => setTierOpen(true)}
            >
              <span>{tierLabel}</span>
              <span className="text-[#837064] text-[10px]">▼</span>
            </button>
            <button
              type="button"
              className="h-9 bg-[#181316] text-[#FDE4BC] text-xs px-3 rounded-lg border border-[#3D363A]/60 flex items-center justify-between cursor-pointer hover:bg-[#20191e] transition-colors"
              onClick={() => setDateOpen(true)}
            >
              <span className="truncate">{dateLabel}</span>
              <span className="text-[#837064] text-[10px]">▼</span>
            </button>
          </div>
        </div>

        {/* Overview Box (2x3 grid matching screenshot) */}
        <div className="bg-[#241E22] border border-[#3D363A]/60 rounded-xl p-4 mb-3 shadow-md grid grid-cols-2 gap-y-4 gap-x-3 text-center">
          {/* Row 1: Deposit number | Deposit amount */}
          <div className="flex flex-col items-center justify-center">
            <span className="text-base font-bold text-[#FDE4BC] tabular-nums">
              {summary?.depositCount ?? summary?.depositors ?? 0}
            </span>
            <span className="text-[11px] text-[#837064] mt-0.5">Deposit number</span>
          </div>
          <div className="flex flex-col items-center justify-center">
            <span className="text-base font-bold text-[#FDE4BC] tabular-nums">
              {formatINR(summary?.totalDeposit ?? 0)}
            </span>
            <span className="text-[11px] text-[#837064] mt-0.5">Deposit amount</span>
          </div>

          {/* Row 2: Number of bettors | Total bet */}
          <div className="flex flex-col items-center justify-center">
            <span className="text-base font-bold text-[#FDE4BC] tabular-nums">
              {summary?.bettors ?? 0}
            </span>
            <span className="text-[11px] text-[#837064] mt-0.5">Number of bettors</span>
          </div>
          <div className="flex flex-col items-center justify-center">
            <span className="text-base font-bold text-[#FDE4BC] tabular-nums">
              {formatINR(summary?.totalBetting ?? 0)}
            </span>
            <span className="text-[11px] text-[#837064] mt-0.5">Total bet</span>
          </div>

          {/* Row 3: Number of people making first deposit | First deposit amount */}
          <div className="flex flex-col items-center justify-center">
            <span className="text-base font-bold text-[#FDE4BC] tabular-nums">
              {summary?.firstDepositUsers ?? 0}
            </span>
            <span className="text-[11px] text-[#837064] mt-0.5">
              Number of people making first deposit
            </span>
          </div>
          <div className="flex flex-col items-center justify-center">
            <span className="text-base font-bold text-[#FDE4BC] tabular-nums">
              {formatINR(summary?.firstDepositAmount ?? 0)}
            </span>
            <span className="text-[11px] text-[#837064] mt-0.5">First deposit amount</span>
          </div>
        </div>

        {/* Member Cards List */}
        {loading ? (
          <div className="py-20 text-center text-[#837064] text-xs">Loading…</div>
        ) : members.length === 0 ? (
          <div className="pt-12 pb-16">
            <EmptyState label="No data" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {members.map((m) => {
              const uid = String(m.serialNumber ?? m.id);
              const nickname = String(m.username ?? "—").trim() || "—";
              const createdAtDate = m.createdAt ? m.createdAt.slice(0, 10) : date;

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

                  {/* Card Details: Level, Deposit amount, Commission (rebate), reg. date */}
                  <div className="flex flex-col gap-2 pt-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[#837064] font-medium">Level</span>
                      <span className="text-[#FDE4BC] font-semibold">{m.layer ?? 1}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#837064] font-medium">
                        Deposit amount
                      </span>
                      <span className="text-[#FED358] font-semibold">
                        {formatINR(m.totalDeposit ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#837064] font-medium">
                        Agent commission
                      </span>
                      <span className="text-[#FED358] font-semibold">
                        {formatINR(m.commissionGenerated ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#837064] font-medium">Bets</span>
                      <span className="text-[#FDE4BC] font-semibold tabular-nums">
                        {m.betCount ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#837064] font-medium">Joined</span>
                      <span className="text-[#837064] font-mono">{createdAtDate}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TierPickerSheet
        open={tierOpen}
        value={tier}
        onCancel={() => setTierOpen(false)}
        onConfirm={(t) => {
          setTier(t);
          setTierOpen(false);
        }}
      />
      <DatePickerSheet
        open={dateOpen}
        value={dateLabel}
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
