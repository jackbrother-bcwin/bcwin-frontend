"use client";

/**
 * Settings Center — account profile + security (BCWIN-style).
 * Frontend-only; no backend changes.
 */

import React, { useState } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import {
  IoChevronForward,
  IoLockClosed,
  IoMail,
  IoInformationCircle,
  IoCopyOutline,
  IoCheckmark,
} from "react-icons/io5";
import PageHeader from "../ui/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../ui/Toast";
import EditNicknameSheet from "../ui/EditNicknameSheet";
import BindEmailSheet from "../ui/BindEmailSheet";

interface Props {
  onBack: () => void;
  onNavigate?: (screen: string) => void;
}

/** App display version shown in settings (matches product screenshot) */
const APP_VERSION = "1.0.9";

export default function SettingsPage({ onBack, onNavigate }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [editNickOpen, setEditNickOpen] = useState(false);
  const [bindEmailOpen, setBindEmailOpen] = useState(false);

  const uid = String(user?.serialNumber ?? "—");
  const nickname = user?.username ?? t("common.guest");
  const boundEmail = user?.email?.trim() || null;

  const copyUid = async () => {
    try {
      await navigator.clipboard.writeText(uid);
      setCopied(true);
      toast("UID copied", "success");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast("Could not copy", "error");
    }
  };

  return (
    <div
      className="flex flex-col min-h-screen min-w-0 w-full max-w-full overflow-x-clip pb-[max(2.5rem,env(safe-area-inset-bottom))]"
      style={{ background: "#110D14" }}
    >
      <PageHeader title={t("settings.title")} onBack={onBack} />

      {/* Profile card */}
      <div
        className="mx-3 mt-3 rounded-[12px] overflow-hidden"
        style={{
          background: "#241E22",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Change avatar row */}
        <button
          type="button"
          onClick={() => toast("Avatar change coming soon", "info")}
          className="w-full flex items-center justify-between px-3.5 py-3.5 active:bg-white/[0.03]"
        >
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-white/10 shrink-0">
            <Image
              src="/assets/png/avatar.png"
              alt="Avatar"
              fill
              sizes="64px"
              className="object-cover"
              priority
            />
          </div>
          <div className="flex items-center gap-1 text-[13px] text-white/55 font-medium">
            {t("settings.changeAvatar")}
            <IoChevronForward size={16} className="opacity-60" />
          </div>
        </button>

        <div className="h-px bg-white/[0.06] mx-3" />

        {/* Nickname — editable via existing PUT /user/update-username */}
        <button
          type="button"
          onClick={() => setEditNickOpen(true)}
          className="w-full flex items-center justify-between px-3.5 py-3.5 active:bg-white/[0.03] gap-3 min-w-0"
        >
          <span className="text-[13px] text-white/45 shrink-0">{t("settings.nickname")}</span>
          <span className="flex items-center gap-0.5 min-w-0">
            <span className="text-[13px] font-semibold text-white/90 truncate max-w-[11rem] sm:max-w-[14rem]">
              {nickname}
            </span>
            <IoChevronForward
              size={16}
              className="text-white/35 shrink-0"
            />
          </span>
        </button>

        <div className="h-px bg-white/[0.06] mx-3" />

        {/* UID */}
        <div className="w-full flex items-center justify-between px-3.5 py-3.5 gap-3">
          <span className="text-[13px] text-white/45 shrink-0">UID</span>
          <button
            type="button"
            onClick={copyUid}
            className="flex items-center gap-1.5 active:opacity-80 min-w-0"
          >
            <span className="text-[13px] font-bold text-[#FED358] tabular-nums truncate">
              {uid}
            </span>
            {copied ? (
              <IoCheckmark size={15} className="text-[#17B15E] shrink-0" />
            ) : (
              <IoCopyOutline
                size={14}
                className="text-[#FED358]/80 shrink-0"
              />
            )}
          </button>
        </div>
      </div>

      {/* Security information */}
      <div className="mx-3 mt-5 mb-2 flex items-center gap-2">
        <span
          className="w-0.5 h-3.5 rounded-full shrink-0"
          style={{ background: "#FED358" }}
        />
        <h2 className="text-[14px] font-bold text-[#FED358]">
          {t("settings.security")}
        </h2>
      </div>

      <div
        className="mx-3 rounded-[12px] overflow-hidden"
        style={{
          background: "#241E22",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <SettingsRow
          icon={
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(254,211,88,0.12)" }}
            >
              <IoLockClosed size={18} className="text-[#FED358]" />
            </div>
          }
          label={t("settings.loginPassword")}
          action={t("settings.edit")}
          onClick={() => onNavigate?.("change-password")}
        />
        <div className="h-px bg-white/[0.06] mx-3" />
        <SettingsRow
          icon={
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(254,211,88,0.12)" }}
            >
              <IoMail size={18} className="text-[#FED358]" />
            </div>
          }
          label={t("settings.bindMailbox")}
          action={
            boundEmail
              ? boundEmail
              : t("settings.toBind")
          }
          onClick={() => {
            if (boundEmail) {
              toast(
                t("settings.emailAlreadyBound", {
                  defaultValue: "Email already bound",
                }),
                "info"
              );
              return;
            }
            setBindEmailOpen(true);
          }}
        />
        <div className="h-px bg-white/[0.06] mx-3" />
        <SettingsRow
          icon={
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(254,211,88,0.12)" }}
            >
              <IoInformationCircle size={18} className="text-[#FED358]" />
            </div>
          }
          label={t("settings.updatedVersion")}
          action={APP_VERSION}
          onClick={() => toast(`App version ${APP_VERSION}`, "info")}
        />
      </div>

      <EditNicknameSheet
        open={editNickOpen}
        onClose={() => setEditNickOpen(false)}
      />
      <BindEmailSheet
        open={bindEmailOpen}
        onClose={() => setBindEmailOpen(false)}
      />
    </div>
  );
}

function SettingsRow({
  icon,
  label,
  action,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3.5 py-3.5 active:bg-white/[0.03] min-w-0"
    >
      {icon}
      <span className="flex-1 text-left text-[13px] font-semibold text-white min-w-0 truncate">
        {label}
      </span>
      <span className="flex items-center gap-0.5 shrink-0 min-w-0 max-w-[55%] text-[12px] text-white/40 font-medium">
        <span className="truncate">{action}</span>
        <IoChevronForward size={15} className="opacity-70 shrink-0" />
      </span>
    </button>
  );
}
