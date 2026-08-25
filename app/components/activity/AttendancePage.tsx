"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  IoGift,
  IoCalendar,
  IoDocumentText,
  IoTime,
  IoChevronBack,
} from "react-icons/io5";
import PageHeader from "../ui/PageHeader";
import LoadingSpinner from "../ui/LoadingSpinner";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../context/AuthContext";
import * as api from "../../lib/api";
import { formatINR } from "../../lib/format";
import { requireBankForCollect } from "../../lib/require-bank";
import { useSpaBackClose } from "../../hooks/useSpaBackClose";

const DEFAULT_ATTENDANCE_TIERS = [
  { day: 1, accumulatedDeposit: 100, reward: 2 },
  { day: 2, accumulatedDeposit: 300, reward: 3 },
  { day: 3, accumulatedDeposit: 500, reward: 5 },
  { day: 4, accumulatedDeposit: 800, reward: 8 },
  { day: 5, accumulatedDeposit: 1500, reward: 18 },
  { day: 6, accumulatedDeposit: 3000, reward: 38 },
  { day: 7, accumulatedDeposit: 5000, reward: 58 },
];

function formatRulesCurrency(val: number) {
  return `₹${val.toLocaleString("en-IN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}`;
}

interface AttendanceTier {
  tier?: number;
  day?: number;
  reward?: number;
  completed?: boolean;
  claimed?: boolean;
  bonusId?: string | null;
  requirement?: { day?: number; accumulatedDeposit?: number };
  current?: { day?: number; accumulatedDeposit?: number };
  accumulatedDeposit?: number;
}

interface Props {
  onBack: () => void;
  onNavigate?: (screen: string) => void;
}

export default function AttendancePage({ onBack, onNavigate }: Props) {
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [tiers, setTiers] = useState<AttendanceTier[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  useSpaBackClose(showRules, () => setShowRules(false), "attendance-rules");
  useSpaBackClose(showHistory, () => setShowHistory(false), "attendance-history");
  const [history, setHistory] = useState<
    { id: string; amount: number; createdAt?: string; status: string }[]
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prog, hist] = await Promise.all([
        api.getActivityProgress(),
        api
          .getActivityHistory({ page: 1, limit: 40, type: "ATTENDENCE" })
          .catch(() =>
            api.getActivityHistory({ page: 1, limit: 40 }).catch(() => null)
          ),
      ]);
      const att = prog.data?.attendance as
        | { currentStreak?: number; tiers?: AttendanceTier[] }
        | undefined;
      setStreak(att?.currentStreak ?? 0);
      setTiers(att?.tiers ?? []);
      const rows = (hist?.data ?? []).filter(
        (b) =>
          !b.type ||
          String(b.type).toUpperCase().includes("ATTEND") ||
          String(b.type).toUpperCase().includes("DAILY")
      );
      setHistory(
        rows.map((b) => ({
          id: b.id,
          amount: b.amount,
          createdAt: b.createdAt,
          status: b.status,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const accumulated = useMemo(
    () =>
      history
        .filter((h) => String(h.status).toUpperCase() === "COLLECTED")
        .reduce((s, h) => s + h.amount, 0),
    [history]
  );

  const claimable = tiers.find(
    (t) => t.completed && !t.claimed && t.bonusId
  );
  const nextLocked = tiers.find((t) => !t.completed && !t.claimed);

  const handleAttendance = async () => {
    if (!claimable?.bonusId) {
      if (nextLocked) {
        const needDay = nextLocked.requirement?.day ?? nextLocked.day ?? 0;
        const needDep = nextLocked.requirement?.accumulatedDeposit ?? 0;
        const haveDep = nextLocked.current?.accumulatedDeposit ?? 0;
        const parts: string[] = [];
        if (streak < needDay) {
          parts.push(`log in ${needDay - streak} more day(s)`);
        }
        if (haveDep < needDep) {
          parts.push(`deposit ₹${needDep - haveDep} more (need ₹${needDep} total)`);
        }
        toast(
          parts.length
            ? `To unlock next reward: ${parts.join(" and ")}`
            : "Keep logging in daily to unlock the next reward",
          "error"
        );
        return;
      }
      toast(
        streak > 0
          ? "No attendance reward available to claim right now"
          : "Login daily to start your attendance streak",
        "error"
      );
      return;
    }
    setClaiming(true);
    try {
      const bank = await requireBankForCollect();
      if (!bank.ok) {
        toast(
          bank.message ??
            "Please add your bank details before collecting rewards",
          "error"
        );
        onNavigate?.("bank");
        return;
      }
      await api.claimActivityBonus(claimable.bonusId);
      await refreshUser();
      toast("Attendance reward claimed!", "success");
      await load();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Claim failed", "error");
    } finally {
      setClaiming(false);
    }
  };

  const displayRulesTiers = useMemo(() => {
    if (tiers && tiers.length > 0) {
      return tiers.map((t, idx) => ({
        day: t.day ?? t.requirement?.day ?? idx + 1,
        accumulatedDeposit:
          t.requirement?.accumulatedDeposit ??
          t.accumulatedDeposit ??
          DEFAULT_ATTENDANCE_TIERS[idx]?.accumulatedDeposit ??
          0,
        reward: t.reward ?? DEFAULT_ATTENDANCE_TIERS[idx]?.reward ?? 0,
      }));
    }
    return DEFAULT_ATTENDANCE_TIERS;
  }, [tiers]);

  if (showRules) {
    const rulesList = [
      "The higher the number of consecutive login days, the more rewards you get, up to 7 consecutive days",
      "During the activity, please check once a day",
      "Players with no deposit history cannot claim the bonus",
      "Deposit requirements must be met from day one",
      "The platform reserves the right to final interpretation of this activity",
      "When you encounter problems, please contact customer service",
    ];

    return (
      <div className="flex-1 flex flex-col min-h-screen bg-[#ECEEF2] text-gray-800 pb-12">
        {/* Header bar matching screenshot */}
        <div
          className="h-[52px] w-full flex items-center justify-between px-3 fixed top-0 left-0 right-0 z-50"
          style={{
            maxWidth: "var(--app-max-width, 480px)",
            margin: "0 auto",
            background: "linear-gradient(180deg, #FA7126 0%, #E04E0C 100%)",
          }}
        >
          <button
            type="button"
            onClick={() => setShowRules(false)}
            className="w-9 h-9 flex items-center justify-center text-white active:opacity-70 transition-opacity"
            aria-label="Back"
          >
            <IoChevronBack size={22} />
          </button>
          <h1 className="text-white text-[19px] font-bold tracking-wide">
            Game Rules
          </h1>
          <div className="w-9" />
        </div>

        {/* Fixed header spacer */}
        <div className="h-[52px]" aria-hidden />

        {/* Content Body */}
        <div className="px-3.5 pt-3.5 space-y-4">
          {/* Card 1: Attendance Rule Table */}
          <div className="bg-white rounded-[16px] p-2.5 shadow-sm border border-gray-200/60 overflow-hidden">
            {/* Table Header */}
            <div
              className="rounded-t-[12px] py-2 px-1 flex items-center text-center text-white font-bold text-[14px] leading-tight"
              style={{
                background: "linear-gradient(90deg, #ED6A1B 0%, #E34E17 100%)",
              }}
            >
              <div className="flex-1 px-0.5">
                Continuous
                <br />
                attendance
              </div>
              <div className="flex-1 px-0.5">
                Accumulated
                <br />
                amount
              </div>
              <div className="flex-1 px-0.5">
                Attendance
                <br />
                bonus
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-100">
              {displayRulesTiers.map((t, idx) => {
                const isEven = idx % 2 === 1;
                return (
                  <div
                    key={t.day}
                    className={`flex items-center text-center py-2.5 px-1 ${
                      isEven ? "bg-[#F7F8FA]" : "bg-white"
                    }`}
                  >
                    <div className="flex-1 text-[#333333] text-[15px] font-medium">
                      {t.day}
                    </div>
                    <div className="flex-1 text-[#444444] text-[15px] font-semibold tabular-nums">
                      {formatRulesCurrency(t.accumulatedDeposit)}
                    </div>
                    <div className="flex-1 text-[#444444] text-[15px] font-semibold tabular-nums">
                      {formatRulesCurrency(t.reward)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 2: Rules Description Card */}
          <div className="bg-white rounded-[18px] p-4 pt-7 shadow-sm border border-gray-200/70 relative overflow-hidden">
            {/* Curved Tab Ribbon Header */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[160px] h-[32px] flex items-center justify-center pointer-events-none">
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 160 32"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient
                    id="rulesRibbonGrad"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#ED6A1B" />
                    <stop offset="100%" stopColor="#E34E17" />
                  </linearGradient>
                </defs>
                <path
                  d="M 0 0 C 20 0, 20 32, 40 32 L 120 32 C 140 32, 140 0, 160 0 Z"
                  fill="url(#rulesRibbonGrad)"
                />
              </svg>
              <span className="relative z-10 text-white font-black text-[17px] tracking-wide">
                Rules
              </span>
            </div>

            {/* Bullet points */}
            <div className="space-y-3.5 pt-1">
              {rulesList.map((text, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 text-[14.5px] leading-snug text-[#555555]"
                >
                  <span className="text-[#ED6A1B] text-[11px] mt-1 flex-shrink-0">
                    ◆
                  </span>
                  <p className="flex-1 font-medium">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showHistory) {
    return (
      <div className="flex-1 flex flex-col min-h-screen pb-24" style={{ background: "#110D14" }}>
        <PageHeader title="Attendance history" onBack={() => setShowHistory(false)} />
        {history.length === 0 ? (
          <p className="text-center text-white/35 text-[15px] py-16">No more</p>
        ) : (
          <div className="px-3 space-y-2">
            {history.map((h) => (
              <div
                key={h.id}
                className="rounded-xl p-3 flex justify-between"
                style={{ background: "#241E22" }}
              >
                <span className="text-[13px] text-white/45">
                  {h.createdAt
                    ? new Date(h.createdAt).toLocaleString("en-IN")
                    : h.id.slice(0, 8)}
                </span>
                <span className="text-[15px] font-bold text-[#FED358]">
                  {formatINR(h.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen pb-28" style={{ background: "#110D14" }}>
      <PageHeader title="Attendance" onBack={onBack} />

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Hero */}
          <div
            className="mx-3 rounded-[14px] p-4 relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg,#E84A4A 0%,#C92A2A 55%,#A61E1E 100%)",
            }}
          >
            <div className="relative z-[1] pr-[110px]">
              <h2 className="text-[20px] font-black text-white">Attendance bonus</h2>
              <p className="text-[13px] text-white/85 mt-1 leading-snug">
                Get rewards based on consecutive login days
              </p>
              <div
                className="inline-flex mt-3 rounded-full px-3 py-1 text-[13px] font-bold text-white"
                style={{ background: "rgba(0,0,0,0.2)" }}
              >
                Attended consecutively{" "}
                <span className="text-[#FED358] ml-1">{streak} Day</span>
              </div>
              <p className="text-[14px] text-white/90 mt-2">
                Accumulated{" "}
                <span className="font-black text-[#FED358]">{formatINR(accumulated)}</span>
              </p>
            </div>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-95">
              <div
                className="w-[88px] h-[88px] rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                <IoCalendar size={52} className="text-white" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mx-3 mt-3">
            <button
              type="button"
              onClick={() => setShowRules(true)}
              className="flex-1 h-10 rounded-full text-[14px] font-bold text-[#110D14] flex items-center justify-center gap-1.5"
              style={{ background: "linear-gradient(180deg,#FED358,#E8A84A)" }}
            >
              <IoDocumentText size={16} />
              Game Rules
            </button>
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="flex-1 h-10 rounded-full text-[14px] font-bold text-[#110D14] flex items-center justify-center gap-1.5"
              style={{ background: "linear-gradient(180deg,#FED358,#E8A84A)" }}
            >
              <IoTime size={16} />
              Attendance history
            </button>
          </div>

          {/* Day grid */}
          <div className="mx-3 mt-4 grid grid-cols-3 gap-2.5">
            {tiers.slice(0, 6).map((t) => {
              const day = t.day ?? (t.tier ?? 0) + 1;
              const done = !!t.completed;
              const claimed = !!t.claimed;
              return (
                <div
                  key={day}
                  className="rounded-[12px] py-3 px-2 flex flex-col items-center"
                  style={{
                    background: "#241E22",
                    border: done
                      ? "1px solid rgba(254,211,88,0.45)"
                      : "1px solid rgba(255,255,255,0.06)",
                    opacity: claimed ? 0.65 : 1,
                  }}
                >
                  <span className="text-[15px] font-black text-[#FED358] tabular-nums">
                    {formatINR(t.reward ?? 0)}
                  </span>
                  <div
                    className="w-11 h-11 rounded-full mt-2 mb-1.5 flex items-center justify-center"
                    style={{
                      background: "linear-gradient(160deg,#FED358,#CF7C10)",
                      boxShadow: "0 4px 12px rgba(254,211,88,0.35)",
                    }}
                  >
                    <span className="text-[18px]">★</span>
                  </div>
                  <span className="text-[13px] text-white/55 font-medium">
                    {day} Day
                  </span>
                </div>
              );
            })}
          </div>

          {/* Day 7 gift */}
          {tiers[6] && (
            <div
              className="mx-3 mt-2.5 rounded-[12px] p-4 flex items-center justify-between"
              style={{
                background: "#241E22",
                border: "1px solid rgba(254,211,88,0.25)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(145deg,#FF5A5A,#C92A2A)" }}
                >
                  <IoGift size={32} className="text-[#FED358]" />
                </div>
                <div>
                  <p className="text-[17px] font-black text-[#FED358] tabular-nums">
                    {formatINR(tiers[6].reward ?? 0)}
                  </p>
                  <p className="text-[13px] text-white/50">7 Day</p>
                </div>
              </div>
            </div>
          )}

          {tiers.length === 0 && (
            <p className="text-center text-white/30 text-xs py-8">
              Attendance tiers unavailable
            </p>
          )}
        </>
      )}

      {/* Sticky claim */}
      <div
        className="fixed bottom-[72px] left-0 right-0 z-40 px-4 py-3"
        style={{
          maxWidth: "var(--app-max-width, 480px)",
          margin: "0 auto",
          background: "linear-gradient(180deg, transparent, #110D14 30%)",
        }}
      >
        <button
          type="button"
          disabled={claiming || loading}
          onClick={() => void handleAttendance()}
          className="w-full h-12 rounded-full text-[17px] font-black text-[#110D14] disabled:opacity-60 active:scale-[0.98]"
          style={{ background: "linear-gradient(180deg,#FED358,#E8A84A)" }}
        >
          {claiming ? "Claiming…" : claimable ? "Claim reward" : "Attendance"}
        </button>
      </div>
    </div>
  );
}
