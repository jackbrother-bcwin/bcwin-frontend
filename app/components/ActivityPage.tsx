"use client";

import { asset } from "../lib/cdn";
/**
 * Activity hub — production UI matching design screenshots.
 * Sub-views: bonus details, invitation, attendance.
 * Icons: react-icons · Banners: /assets/activity/*
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  IoPerson,
  IoGrid,
  IoTrophy,
  IoDisc,
  IoGiftOutline,
  IoCalendarOutline,
  IoChevronForward,
} from "react-icons/io5";
import * as api from "../lib/api";
import type { ActivityBonus, WinStreakData } from "../lib/api";
import { formatINR } from "../lib/format";
import { requireBankForCollect } from "../lib/require-bank";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./ui/Toast";
import { useSpaBackClose } from "../hooks/useSpaBackClose";
import LoadingSpinner from "./ui/LoadingSpinner";
import {
  ACTIVITY_BANNERS,
  ACTIVITY_POSTER_TITLES,
  activityPosterUrl,
  type ActivityBannerAction,
  type ActivityView,
} from "./activity/catalog";
import type { ActivityPosterId } from "../lib/banner-cdn";
import BonusDetailsPage from "./activity/BonusDetailsPage";
import AttendancePage from "./activity/AttendancePage";
import InvitationBonusPage from "./activity/InvitationBonusPage";
import SalaryChartPage from "./activity/SalaryChartPage";
import ActivityPosterPage from "./activity/ActivityPosterPage";
import SpinPage from "./SpinPage";
import LuckySpinPage from "./LuckySpinPage";
import SelfRebatePage from "./activity/SelfRebatePage";

interface Props {
  onNavigate?: (screen: string) => void;
}

const QUICK_ACTIONS: {
  id: string;
  label: string;
  icon: React.ReactNode;
  bg: string;
  action: { type: "view"; view: ActivityView } | { type: "screen"; screen: string };
}[] = [
  {
    id: "invitation",
    label: "Invitation bonus",
    icon: <IoPerson size={26} className="text-white" />,
    bg: "linear-gradient(145deg,#60A5FA,#3B82F6)",
    action: { type: "view", view: "invitation" },
  },
  {
    id: "rebate",
    label: "Betting rebate",
    icon: <IoGrid size={24} className="text-white" />,
    bg: "linear-gradient(145deg,#FBBF24,#D97706)",
    action: { type: "view", view: "rebate" },
  },
  {
    id: "jackpot",
    label: "Super Jackpot",
    icon: <IoTrophy size={26} className="text-white" />,
    bg: "linear-gradient(145deg,#4ADE80,#16A34A)",
    action: { type: "screen", screen: "wingo" },
  },
  {
    id: "wheel",
    label: "Invite Wheel",
    icon: <IoDisc size={28} className="text-white" />,
    bg: "linear-gradient(145deg,#FB923C,#EA580C)",
    action: { type: "view", view: "wheel" },
  },
  {
    id: "lucky-spin",
    label: "Lucky Spin",
    icon: <IoDisc size={28} className="text-white" />,
    bg: "linear-gradient(145deg,#F472B6,#A855F7)",
    action: { type: "view", view: "lucky-spin" },
  },
];

export default function ActivityPage({ onNavigate }: Props) {
  const { refreshUser } = useAuth();
  const { toast } = useToast();
  const [view, setView] = useState<ActivityView>("hub");
  /** Full-page promo poster (CDN detail image) */
  const [poster, setPoster] = useState<{
    id: ActivityPosterId;
    title: string;
  } | null>(null);
  const backToHub = useCallback(() => setView("hub"), []);
  useSpaBackClose(!!poster, () => setPoster(null), "activity-poster");
  useSpaBackClose(view !== "hub" && !poster, backToHub, "activity-nested");
  const [loading, setLoading] = useState(true);
  const [claimable, setClaimable] = useState<ActivityBonus[]>([]);
  const [history, setHistory] = useState<ActivityBonus[]>([]);
  const [streak, setStreak] = useState<WinStreakData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [claimRes, histRes, streakRes] = await Promise.all([
        api
          .getActivityBonuses({ status: "COMPLETED_UNCOLLECTED", limit: 50 })
          .catch(() => null),
        api.getActivityHistory({ page: 1, limit: 50 }).catch(() => null),
        api.getWinStreak().catch(() => null),
      ]);
      setClaimable(claimRes?.data ?? []);
      setHistory(histRes?.data ?? []);
      setStreak(streakRes?.data ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === "hub") void load();
  }, [load, view]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
  }, [view, poster]);

  const todayBonus = useMemo(
    () => claimable.reduce((s, b) => s + (b.amount || 0), 0),
    [claimable]
  );
  const totalBonus = useMemo(
    () =>
      history.reduce(
        (s, b) => s + (String(b.status).toUpperCase() === "COLLECTED" ? b.amount : 0),
        0
      ),
    [history]
  );

  const runAction = (action?: ActivityBannerAction) => {
    if (!action || action.type === "none") return;
    if (action.type === "view") {
      setPoster(null);
      setView(action.view);
      return;
    }
    if (action.type === "poster") {
      setPoster({
        id: action.poster,
        title: ACTIVITY_POSTER_TITLES[action.poster] ?? "Event details",
      });
      return;
    }
    if (action.type === "screen") {
      onNavigate?.(action.screen);
    }
  };

  if (poster) {
    return (
      <ActivityPosterPage
        title={poster.title}
        image={activityPosterUrl(poster.id)}
        onBack={() => setPoster(null)}
      />
    );
  }

  if (view === "bonus-details") {
    return <BonusDetailsPage onBack={() => setView("hub")} />;
  }
  if (view === "salary-chart") {
    return <SalaryChartPage onBack={() => setView("hub")} />;
  }
  if (view === "attendance") {
    return (
      <AttendancePage
        onBack={() => setView("hub")}
        onNavigate={onNavigate}
      />
    );
  }
  if (view === "spin" || view === "wheel") {
    return (
      <SpinPage
        onBack={() => setView("hub")}
        onNavigate={onNavigate}
        variant="invite"
      />
    );
  }
  if (view === "lucky-spin") {
    return (
      <LuckySpinPage
        onBack={() => setView("hub")}
        onNavigate={onNavigate}
      />
    );
  }
  if (view === "rebate") {
    return <SelfRebatePage onBack={() => setView("hub")} />;
  }
  if (view === "invitation" || view === "invitation-rules" || view === "invitation-record") {
    return (
      <InvitationBonusPage
        onBack={() => setView("hub")}
        onNavigate={onNavigate}
        initialSub={
          view === "invitation-rules"
            ? "rules"
            : view === "invitation-record"
              ? "record"
              : "main"
        }
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col pb-24" style={{ background: "#110D14" }}>
      {/* Logo header */}
      <header className="app-page-header app-page-header--lg app-fixed-chrome fixed top-0 z-50">
        <div className="app-page-header-inner justify-center">
          <div className="relative w-[120px] h-[35px]">
            <Image
              src={asset("/assets/png/bcwin.png")}
              alt="BCWin"
              fill
              sizes="120px"
              className="object-contain"
              priority
            />
          </div>
        </div>
      </header>
      <div className="app-page-header-spacer app-page-header-spacer--lg" aria-hidden />

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Today / Total */}
          <div className="flex items-start justify-center gap-0 px-4 pt-2 pb-1">
            <div className="flex-1 flex flex-col items-center">
              <span className="text-[12px] text-white/45">Today&apos;s bonus</span>
              <span className="text-[22px] font-black text-white tabular-nums mt-0.5">
                {formatINR(todayBonus)}
              </span>
            </div>
            <div
              className="w-px h-10 self-center"
              style={{ background: "rgba(255,255,255,0.12)" }}
            />
            <div className="flex-1 flex flex-col items-center">
              <span className="text-[12px] text-white/45">Total bonus</span>
              <span className="text-[22px] font-black text-white tabular-nums mt-0.5">
                {formatINR(totalBonus)}
              </span>
            </div>
          </div>

          {streak && (streak.currentStreak ?? 0) > 0 && (
            <p className="text-center text-[10px] text-white/40 mb-1">
              Win streak{" "}
              <span className="text-[#FED358] font-bold">{streak.currentStreak}</span>
            </p>
          )}

          {/* Bonus details */}
          <div className="flex justify-center my-3">
            <button
              type="button"
              onClick={() => setView("bonus-details")}
              className="h-9 px-8 rounded-full text-[13px] font-bold text-[#FED358] active:scale-95"
              style={{
                border: "1.5px solid rgba(254,211,88,0.65)",
                background: "transparent",
              }}
            >
              Bonus details
            </button>
          </div>

          {/* Quick icons */}
          <div className="flex justify-between px-4 mb-4">
            {QUICK_ACTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => runAction(item.action)}
                className="flex flex-col items-center gap-1.5 flex-1 active:scale-95"
              >
                <div
                  className="w-12 h-12 rounded-[14px] flex items-center justify-center shadow-lg"
                  style={{ background: item.bg }}
                >
                  {item.icon}
                </div>
                <span className="text-[10px] text-white/60 text-center leading-tight px-0.5">
                  {item.label}
                </span>
              </button>
            ))}
          </div>

          {/* Gifts + Attendance */}
          <div className="grid grid-cols-2 gap-2.5 px-3 mb-3">
            <button
              type="button"
              onClick={() => onNavigate?.("gifts")}
              className="rounded-[14px] p-3 text-left active:scale-[0.98] min-h-[132px] flex flex-col"
              style={{
                background: "linear-gradient(160deg,#2a2228 0%,#1a1519 100%)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-start justify-between gap-2 w-full">
                <p className="text-[14px] font-black text-white leading-tight flex-1 min-w-0">
                  Gifts
                </p>
                <div
                  className="w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center"
                  style={{ background: "linear-gradient(145deg,#FF6B6B,#C92A2A)" }}
                >
                  <IoGiftOutline size={28} className="text-[#FED358]" />
                </div>
              </div>
              <p className="text-[10px] text-white/45 mt-2 leading-snug">
                Enter the redemption code to receive gift rewards
              </p>
            </button>

            <button
              type="button"
              onClick={() => setView("attendance")}
              className="rounded-[14px] p-3 text-left active:scale-[0.98] min-h-[132px] flex flex-col"
              style={{
                background: "linear-gradient(160deg,#2a2228 0%,#1a1519 100%)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-start justify-between gap-2 w-full">
                <p className="text-[13px] font-black text-white leading-tight flex-1 min-w-0">
                  Attendance bonus
                </p>
                <div
                  className="w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center"
                  style={{ background: "linear-gradient(145deg,#FFB472,#E8A84A)" }}
                >
                  <IoCalendarOutline size={26} className="text-white" />
                </div>
              </div>
              <p className="text-[10px] text-white/45 mt-2 leading-snug">
                The more consecutive days you sign in, the higher the reward
              </p>
            </button>
          </div>

          {/* Claimable strip */}
          {claimable.length > 0 && (
            <div className="mx-3 mb-3 rounded-[12px] p-3" style={{ background: "#241E22", border: "1px solid rgba(254,211,88,0.25)" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-bold text-[#FED358]">
                  Ready to claim ({claimable.length})
                </p>
                <button
                  type="button"
                  onClick={() => setView("bonus-details")}
                  className="text-[10px] text-white/50 flex items-center gap-0.5"
                >
                  All <IoChevronForward size={12} />
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {claimable.slice(0, 6).map((b) => (
                  <ClaimChip
                    key={b.id}
                    bonus={b}
                    onNeedBank={() => {
                      toast(
                        "Please add your bank details before collecting rewards",
                        "error"
                      );
                      onNavigate?.("bank");
                    }}
                    onDone={() => {
                      toast("Bonus claimed!", "success");
                      void refreshUser();
                      void load();
                    }}
                    onError={(msg) => toast(msg, "error")}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Promo banners */}
          <div className="px-3 space-y-3 pb-6">
            {ACTIVITY_BANNERS.map((banner) => (
              <button
                key={banner.id}
                type="button"
                onClick={() => runAction(banner.action)}
                className="w-full text-left active:scale-[0.99] rounded-[12px] overflow-hidden"
                style={{
                  background: "#1a1519",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="relative w-full aspect-[2.15/1] bg-[#241E22]">
                  <Image
                    src={banner.image}
                    alt={banner.title}
                    fill
                    sizes="(max-width: 480px) 100vw, 440px"
                    className="object-cover"
                  />
                </div>
                <p className="text-[12px] font-bold text-[#FDE4BC] px-3 py-2.5 leading-snug">
                  {banner.title}
                </p>
              </button>
            ))}
            <p className="text-center text-white/25 text-[12px] py-2">No more</p>
          </div>
        </>
      )}
    </div>
  );
}

function ClaimChip({
  bonus,
  onDone,
  onNeedBank,
  onError,
}: {
  bonus: ActivityBonus;
  onDone: () => void;
  onNeedBank: () => void;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div
      className="shrink-0 w-[140px] rounded-xl p-2.5 flex flex-col gap-1.5"
      style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(254,211,88,0.2)" }}
    >
      <p className="text-[9px] text-white/45 truncate">
        {({
          INR_RECHARGE_BONUS: "INR recharge bonus",
          USDT_RECHARGE_BONUS: "USDT recharge bonus",
          FIRST_DEPOSIT: "First deposit",
          SPIN_WHEEL: "Spin wheel",
          ATTENDENCE: "Attendance",
        } as Record<string, string>)[bonus.type ?? ""] ??
          (bonus.type ?? "BONUS").replace(/_/g, " ")}
      </p>
      <p className="text-[13px] font-black text-[#FED358] tabular-nums">
        {formatINR(bonus.amount)}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const bank = await requireBankForCollect();
            if (!bank.ok) {
              onNeedBank();
              return;
            }
            await api.claimActivityBonus(bonus.id);
            onDone();
          } catch (e: unknown) {
            onError(e instanceof Error ? e.message : "Claim failed");
          } finally {
            setBusy(false);
          }
        }}
        className="h-7 rounded-full text-[10px] font-bold text-[#110D14] disabled:opacity-50"
        style={{ background: "linear-gradient(180deg,#FED358,#E8A84A)" }}
      >
        {busy ? "…" : "Claim"}
      </button>
    </div>
  );
}
