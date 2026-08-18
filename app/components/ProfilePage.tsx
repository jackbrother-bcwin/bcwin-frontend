"use client";

import { asset } from "../lib/cdn";
import React from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { formatINR } from "../lib/format";
import {
  MdAccountBalanceWallet,
  MdSavings,
  MdCreditCard,
  MdDiamond,
  MdHistoryEdu,
  MdReceiptLong,
  MdCallReceived,
  MdCallMade,
  MdCampaign,
  MdCardGiftcard,
  MdBarChart,
  MdLanguage,
  MdSettings,
  MdChatBubbleOutline,
  MdHeadsetMic,
  MdMenuBook,
  MdInfoOutline,
  MdLogout,
  MdRefresh,
  MdEdit,
} from "react-icons/md";
import { useAuth } from "../context/AuthContext";
import { vipBadgeSrc } from "./account/vip/vipConfig";
import LogoutConfirmModal from "./ui/LogoutConfirmModal";
import EditNicknameSheet from "./ui/EditNicknameSheet";

interface ProfilePageProps {
  onLogout?: () => void;
  onNavigate?: (screen: string) => void;
}

/** Absolute last-login in Asia/Kolkata: YYYY-MM-DD HH:mm */
function formatLastLoginIst(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

export default function ProfilePage({ onLogout, onNavigate }: ProfilePageProps) {
  const { t, i18n } = useTranslation();
  const { user, refreshUser, logout } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);
  const [logoutOpen, setLogoutOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [editNickOpen, setEditNickOpen] = React.useState(false);

  const go = (screen: string) => onNavigate?.(screen);

  const langLabel =
    i18n.language === "hi" ? t("common.hindi") : t("common.english");

  const handleCopyUid = () => {
    const uid = String(user?.serialNumber ?? "");
    navigator.clipboard.writeText(uid);
  };

  const handleRefreshBalance = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshUser();
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogoutConfirm = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      setLogoutOpen(false);
      onLogout?.();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-bg-level-4 text-text-level-4 pb-20">
      {/* Top User Info Section — gold gradient header */}
      <div className="flex items-center px-4 pt-6 pb-6 gap-3 bg-gradient-to-b from-brand-gold/25 via-bg-level-3/30 to-transparent">
        {/* Avatar */}
        <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-brand-gold/30">
          <Image
            src={asset("/assets/png/avatar.png")}
            alt="User Avatar"
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>

        {/* User Details */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-bold tracking-wide text-white uppercase truncate max-w-[9.5rem] sm:max-w-[12rem]">
              {user?.username ?? t("common.guest")}
            </span>
            {user ? (
              <button
                type="button"
                onClick={() => setEditNickOpen(true)}
                className="shrink-0 p-1 rounded-md text-brand-gold/80 hover:text-brand-gold hover:bg-[#FED358]/12 active:scale-95 transition-all cursor-pointer"
                aria-label={t("settings.editNickname", {
                  defaultValue: "Edit nickname",
                })}
                title={t("settings.editNickname", {
                  defaultValue: "Edit nickname",
                })}
              >
                <MdEdit size={16} />
              </button>
            ) : null}
            {/* VIP Badge */}
            <div className="relative w-12 h-4 select-none shrink-0">
              <Image
                src={vipBadgeSrc(Number(user?.vipLevel ?? 0))}
                alt={`VIP ${user?.vipLevel ?? 0}`}
                fill
                sizes="48px"
                className="object-contain"
              />
            </div>
          </div>

          {/* UID Card */}
          <div className="flex items-center gap-1.5 self-start">
            <div className="bg-[#FED358]/15 text-brand-gold px-2 py-0.5 rounded text-[10px] font-bold tracking-wider flex items-center gap-1">
              <span>UID</span>
              <span className="text-white/60">|</span>
              <span>{user?.serialNumber ?? "—"}</span>
            </div>
            <button
              onClick={handleCopyUid}
              className="p-1 rounded bg-[#FED358]/10 hover:bg-[#FED358]/20 active:scale-95 transition-all cursor-pointer"
              title={t("profile.copyUid")}
            >
              <svg className="w-3.5 h-3.5 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
            </button>
          </div>

          {/* Last login (replaces mobile under UID — glossary-profile-last-login) */}
          <span className="text-[10px] text-text-secondary">
            {user
              ? user.lastLoginDate
                ? t("profile.lastLogin", {
                    time: formatLastLoginIst(user.lastLoginDate),
                    defaultValue: `Last login: ${formatLastLoginIst(user.lastLoginDate)}`,
                  })
                : t("profile.noLoginYet", { defaultValue: "No login yet" })
              : t("profile.notLoggedIn")}
          </span>
        </div>
      </div>

      {/* Wallet / Balance Card */}
      <div className="mx-4 mb-4 bg-bg-level-3 rounded-lg p-4 flex flex-col gap-4 border border-bg-level-3/45 shadow-sm">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[11px] text-text-secondary font-medium">
              {t("profile.totalBalance")}
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl font-bold text-white">
                {formatINR(user?.balance ?? 0)}
              </span>
              <button
                type="button"
                onClick={() => void handleRefreshBalance()}
                disabled={refreshing}
                className="p-1 rounded hover:bg-bg-level-4 text-white/45 hover:text-brand-gold active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                aria-label="Refresh balance"
              >
                <MdRefresh
                  size={18}
                  className={refreshing ? "animate-spin" : undefined}
                />
              </button>
            </div>
          </div>

          <button
            onClick={() => go("wallet")}
            className="px-4 py-1.5 bg-brand-gold text-bg-level-4 font-bold text-xs rounded-full shadow-gold-glow hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            {t("profile.enterWallet")}
          </button>
        </div>

        {/* Quick action shortcuts — colorful icons (screenshot-matched) */}
        <div className="grid grid-cols-4 pt-3 border-t border-bg-level-4/30">
          {[
            {
              id: "wallet",
              label: t("profile.wallet"),
              color: "text-[#FF7A6B]",
              icon: <MdAccountBalanceWallet size={28} color="#FF6B5A" />,
            },
            {
              id: "deposit",
              label: t("profile.deposit"),
              color: "text-[#E8B84A]",
              icon: <MdSavings size={28} color="#E8A84A" />,
            },
            {
              id: "withdraw",
              label: t("profile.withdraw"),
              color: "text-[#5B9BFF]",
              icon: <MdCreditCard size={28} color="#5B9BFF" />,
            },
            {
              id: "vip",
              label: t("profile.vip"),
              color: "text-[#3DDC84]",
              icon: <MdDiamond size={28} color="#2ECC71" />,
            },
          ].map((action) => (
            <button
              key={action.id}
              onClick={() => go(action.id)}
              className="flex flex-col items-center gap-1.5 group cursor-pointer py-1"
            >
              <div className="group-hover:scale-110 transition-transform duration-200 drop-shadow-md">
                {action.icon}
              </div>
              <span
                className={`text-[10px] font-medium ${action.color} group-hover:brightness-125 transition-colors`}
              >
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid Shortcuts (2x2) — colorful tile icons */}
      <div className="grid grid-cols-2 gap-3 mx-4 mb-4">
        {(
          [
            {
              id: "game-history",
              title: t("profile.gameHistory"),
              sub: t("profile.gameHistorySub"),
              bg: "linear-gradient(145deg,#5B9BFF,#3B6FE0)",
              icon: <MdHistoryEdu size={20} color="#fff" />,
            },
            {
              id: "transaction-history",
              title: t("profile.transaction"),
              sub: t("profile.transactionSub"),
              bg: "linear-gradient(145deg,#4ADE80,#16A34A)",
              icon: <MdReceiptLong size={20} color="#fff" />,
            },
            {
              id: "deposit-history",
              title: t("profile.depositHistory"),
              sub: t("profile.depositHistorySub"),
              bg: "linear-gradient(145deg,#FF7A6B,#E03E3E)",
              icon: <MdCallReceived size={20} color="#fff" />,
            },
            {
              id: "withdraw-history",
              title: t("profile.withdrawHistory"),
              sub: t("profile.withdrawHistorySub"),
              bg: "linear-gradient(145deg,#FBBF24,#D97706)",
              icon: <MdCallMade size={20} color="#fff" />,
            },
          ] as const
        ).map((tile) => (
          <button
            key={tile.id}
            onClick={() => go(tile.id)}
            className="flex items-center gap-2.5 bg-bg-level-3 p-3 rounded-lg border border-bg-level-3/45 hover:border-brand-gold/30 hover:scale-[1.01] transition-all cursor-pointer"
          >
            <div
              className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 shadow-md"
              style={{ background: tile.bg }}
            >
              {tile.icon}
            </div>
            <div className="flex flex-col text-left min-w-0">
              <span className="text-xs font-bold text-white leading-tight truncate">
                {tile.title}
              </span>
              <span className="text-[9px] text-text-secondary mt-0.5 truncate">
                {tile.sub}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* List items selection panel */}
      <div className="mx-4 mb-4 bg-bg-level-3 rounded-lg overflow-hidden border border-bg-level-3/45 shadow-sm divide-y divide-bg-level-4/30">
        {[
          {
            id: "notice",
            label: t("profile.notification"),
            icon: <MdCampaign size={20} color="#FED358" />,
          },
          {
            id: "gifts",
            label: t("profile.gifts"),
            icon: <MdCardGiftcard size={20} color="#FED358" />,
          },
          {
            id: "game-statistics",
            label: t("profile.gameStatistics", "Game statistics"),
            icon: <MdBarChart size={20} color="#FED358" />,
          },
          {
            id: "language",
            label: t("profile.language"),
            value: langLabel,
            icon: <MdLanguage size={20} color="#FED358" />,
          },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => {
              const map: Record<string, string> = {
                notice: "notifications",
                gifts: "gifts",
                "game-statistics": "game-statistics",
                language: "language",
              };
              go(map[item.id] ?? item.id);
            }}
            className="w-full flex items-center justify-between p-3.5 hover:bg-bg-level-4/20 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                {item.icon}
              </div>
              <span className="text-xs font-bold text-white">{item.label}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              {"value" in item && item.value && (
                <span className="font-medium">{item.value}</span>
              )}
              <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* Service Center Card */}
      <div className="mx-4 mb-6 bg-bg-level-3 rounded-lg p-4 border border-bg-level-3/45 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-level-3 mb-4">
          {t("profile.serviceCenter")}
        </h3>

        <div className="grid grid-cols-3 gap-y-5">
          {[
            {
              id: "settings",
              label: t("profile.settings"),
              icon: <MdSettings size={22} color="#FED358" />,
            },
            {
              id: "feedback",
              label: t("profile.feedback"),
              icon: <MdChatBubbleOutline size={22} color="#FED358" />,
            },
            {
              id: "announcement",
              label: t("profile.announcement"),
              icon: <MdCampaign size={22} color="#FED358" />,
            },
            {
              id: "cs",
              label: t("profile.customerService"),
              icon: <MdHeadsetMic size={22} color="#FED358" />,
            },
            {
              id: "guide",
              label: t("profile.beginnersGuide"),
              icon: <MdMenuBook size={22} color="#FED358" />,
            },
            {
              id: "about",
              label: t("profile.aboutUs"),
              icon: <MdInfoOutline size={22} color="#FED358" />,
            },
          ].map((srv) => (
            <button
              key={srv.id}
              onClick={() => {
                const map: Record<string, string> = {
                  settings: "settings",
                  feedback: "feedback",
                  announcement: "notifications",
                  cs: "feedback",
                  guide: "guide",
                  about: "about",
                };
                go(map[srv.id] || "profile");
              }}
              className="flex flex-col items-center gap-1.5 group cursor-pointer"
            >
              <div className="group-hover:scale-105 transition-transform duration-200">
                {srv.icon}
              </div>
              <span className="text-[10px] text-text-secondary font-medium text-center w-full group-hover:text-white transition-colors">
                {srv.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Log out Button */}
      <div className="mx-4 mb-6">
        <button
          type="button"
          onClick={() => setLogoutOpen(true)}
          className="w-full flex items-center justify-center gap-2 h-10 border border-brand-gold rounded-full text-brand-gold font-bold text-xs uppercase tracking-wider hover:bg-brand-gold/10 active:scale-98 transition-all cursor-pointer"
        >
          <MdLogout size={16} />
          {t("profile.logOut")}
        </button>
      </div>

      <LogoutConfirmModal
        open={logoutOpen}
        loading={loggingOut}
        onCancel={() => {
          if (!loggingOut) setLogoutOpen(false);
        }}
        onConfirm={handleLogoutConfirm}
      />

      <EditNicknameSheet
        open={editNickOpen}
        onClose={() => setEditNickOpen(false)}
      />
    </div>
  );
}
