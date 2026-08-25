"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  IoGrid,
  IoHardwareChip,
  IoTv,
  IoFootball,
  IoGameController,
  IoBriefcase,
  IoShieldCheckmark,
} from "react-icons/io5";
import PageHeader from "../ui/PageHeader";
import LoadingSpinner from "../ui/LoadingSpinner";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../context/AuthContext";
import * as api from "../../lib/api";
import type {
  SelfRebateSummary,
  SelfRebateHistoryEntry,
  RebateGameCategory,
} from "../../lib/api";
import { formatINR } from "../../lib/format";

interface Props {
  onBack: () => void;
}

type TabCategory = "ALL" | RebateGameCategory;

const TABS: { id: TabCategory; label: string; icon: React.ReactNode }[] = [
  { id: "ALL", label: "All", icon: <IoGrid size={18} /> },
  { id: "LOTTERY", label: "Lottery", icon: <IoHardwareChip size={18} /> },
  { id: "CASINO", label: "Casino", icon: <IoTv size={18} /> },
  { id: "SPORTS", label: "Sports", icon: <IoFootball size={18} /> },
  { id: "RUMMY", label: "Rummy", icon: <IoGameController size={18} /> },
  { id: "SLOTS", label: "Slots", icon: <IoBriefcase size={18} /> },
];

export default function SelfRebatePage({ onBack }: Props) {
  const { refreshUser } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabCategory>("ALL");
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const [summary, setSummary] = useState<SelfRebateSummary | null>(null);
  const [history, setHistory] = useState<SelfRebateHistoryEntry[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, histRes] = await Promise.all([
        api.getSelfRebateSummary().catch(() => null),
        api
          .getSelfRebateHistory({
            category: tab === "ALL" ? undefined : tab,
            limit: 50,
          })
          .catch(() => null),
      ]);

      if (sumRes?.data) setSummary(sumRes.data);
      if (histRes?.data) setHistory(histRes.data);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleClaim = async () => {
    if (claiming) return;
    if (!summary || summary.todayRebate <= 0) {
      toast("No rebate available to claim today", "info");
      return;
    }

    setClaiming(true);
    try {
      const res = await api.claimSelfRebate();
      if (res.data.claimedAmount > 0) {
        toast(
          `Successfully claimed ${formatINR(res.data.claimedAmount)} self rebate!`,
          "success"
        );
        void refreshUser();
        void loadData();
      } else {
        toast("No claimable rebate at the moment", "info");
      }
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Claim failed", "error");
    } finally {
      setClaiming(false);
    }
  };

  const todayRebateVal = summary?.todayRebate ?? 0;
  const totalRebateVal = summary?.totalRebate ?? 0;

  return (
    <div
      className="flex-1 flex flex-col min-h-screen pb-24"
      style={{ background: "#1B1721" }}
    >
      <PageHeader title="Rebate" onBack={onBack} />

      {/* Tabs bar */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-3 overflow-x-auto no-scrollbar">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="flex flex-col items-center justify-center shrink-0 w-[72px] h-[60px] rounded-xl text-center transition-all active:scale-95"
              style={
                active
                  ? {
                      background: "linear-gradient(180deg, #E6AF51 0%, #C48E33 100%)",
                      color: "#110D14",
                      boxShadow: "0 4px 12px rgba(230,175,81,0.3)",
                    }
                  : {
                      background: "#2A2530",
                      color: "rgba(255,255,255,0.6)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }
              }
            >
              <div className="mb-1">{t.icon}</div>
              <span className="text-[13px] font-bold tracking-wide">
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {loading && !summary ? (
        <LoadingSpinner />
      ) : (
        <div className="px-3 space-y-4">
          {/* Main Card */}
          <div
            className="rounded-[16px] p-4 flex flex-col gap-3 relative overflow-hidden"
            style={{
              background: "#2A2530",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {/* Title & Real-time badge */}
            <div className="flex items-center justify-between">
              <span className="text-[16px] font-bold text-white/90">
                All-Total betting rebate
              </span>
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px] font-semibold text-[#FED358]"
                style={{
                  background: "rgba(254,211,88,0.12)",
                  border: "1px solid rgba(254,211,88,0.3)",
                }}
              >
                <IoShieldCheckmark size={14} />
                <span>Real-time count</span>
              </div>
            </div>

            {/* Large Amount */}
            <div className="flex items-center gap-2 mt-1">
              <div className="w-8 h-8 rounded-full bg-[#FED358]/20 flex items-center justify-center text-[#FED358] font-bold text-[20px]">
                ₹
              </div>
              <span className="text-[30px] font-black text-white tracking-tight tabular-nums">
                {todayRebateVal.toFixed(2)}
              </span>
            </div>

            {/* VIP upgrade hint */}
            <div
              className="rounded-lg px-3 py-2 text-[13px] text-white/60"
              style={{ background: "#201B26" }}
            >
              {summary
                ? `VIP${summary.vipLevel ?? 0} · ${Number(summary.rate ?? 0)}% self-rebate · upgrade VIP to increase`
                : "Upgrade VIP level to increase rebate rate"}
            </div>

            {/* Today & Total stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div
                className="rounded-xl p-3 flex flex-col"
                style={{ background: "#201B26" }}
              >
                <span className="text-[13px] text-white/50">Today rebate</span>
                <span className="text-[20px] font-black text-[#FED358] mt-0.5 tabular-nums">
                  {todayRebateVal.toFixed(2)}
                </span>
              </div>
              <div
                className="rounded-xl p-3 flex flex-col"
                style={{ background: "#201B26" }}
              >
                <span className="text-[13px] text-white/50">Total rebate</span>
                <span className="text-[20px] font-black text-[#FED358] mt-0.5 tabular-nums">
                  {totalRebateVal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Automatic washing notice */}
            <p className="text-[13px] text-white/40 text-center mt-1">
              Automatic code washing at 01:00:00 every morning
            </p>

            {/* Action Button */}
            <button
              type="button"
              disabled={claiming || todayRebateVal <= 0}
              onClick={handleClaim}
              className="w-full h-11 rounded-full text-[16px] font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-1"
              style={
                todayRebateVal > 0
                  ? {
                      background: "linear-gradient(180deg, #E6AF51 0%, #C48E33 100%)",
                      color: "#110D14",
                      boxShadow: "0 4px 14px rgba(230,175,81,0.35)",
                    }
                  : {
                      background: "rgba(255,255,255,0.12)",
                      color: "rgba(255,255,255,0.4)",
                    }
              }
            >
              {claiming ? "Processing…" : "One-Click Rebate"}
            </button>
          </div>

          {/* Section Header: Rebate History */}
          <div className="flex items-center gap-2 pt-2">
            <div className="w-1 h-4 bg-[#FED358] rounded-full" />
            <h2 className="text-[18px] font-bold text-white">Rebate history</h2>
          </div>

          {/* History List */}
          {history.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center"
              style={{ background: "#2A2530" }}
            >
              <p className="text-[15px] text-white/40">No rebate records found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item, idx) => (
                <div
                  key={`${item.date}-${item.category}-${idx}`}
                  className="rounded-[14px] p-4 flex flex-col gap-3"
                  style={{
                    background: "#2A2530",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {/* Category & Status */}
                  <div className="flex items-center justify-between pb-2 border-b border-white/5">
                    <span className="text-[17px] font-bold text-white">
                      {item.title}
                    </span>
                    <span
                      className={`text-[14px] font-bold ${
                        item.status === "Completed"
                          ? "text-[#10B981]"
                          : item.status === "Pending"
                          ? "text-[#F59E0B]"
                          : "text-white/40"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <p className="text-[13px] text-white/40 -mt-1">
                    {item.date} 01:00:00
                  </p>

                  {/* Timeline metric details */}
                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full border-2 border-[#10B981]" />
                        <span className="text-[14px] text-white/60">
                          Betting rebate
                        </span>
                      </div>
                      <span className="text-[15px] font-bold text-white tabular-nums">
                        {item.betAmount.toFixed(0)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full border-2 border-[#10B981]" />
                        <span className="text-[14px] text-white/60">
                          Rebate rate
                        </span>
                      </div>
                      <span className="text-[15px] font-bold text-[#EF4444] tabular-nums">
                        {item.rate}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full border-2 border-[#10B981]" />
                        <span className="text-[14px] text-white/60">
                          Rebate amount
                        </span>
                      </div>
                      <span className="text-[15px] font-bold text-[#FED358] tabular-nums">
                        {item.rebateAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
