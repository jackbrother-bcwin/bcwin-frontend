"use client";

/**
 * Language picker — EN / HI only (UI text via react-i18next).
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { IoCheckmark } from "react-icons/io5";
import PageHeader from "../ui/PageHeader";
import {
  type AppLocale,
  persistLocale,
  SUPPORTED_LOCALES,
} from "../../lib/i18n";

interface Props {
  onBack: () => void;
}

const OPTIONS: { id: AppLocale; labelKey: "english" | "hindi"; native: string }[] = [
  { id: "en", labelKey: "english", native: "English" },
  { id: "hi", labelKey: "hindi", native: "हिंदी" },
];

export default function LanguagePage({ onBack }: Props) {
  const { t, i18n } = useTranslation();
  const current = (SUPPORTED_LOCALES.includes(i18n.language as AppLocale)
    ? i18n.language
    : "en") as AppLocale;

  const select = (lng: AppLocale) => {
    void i18n.changeLanguage(lng);
    persistLocale(lng);
  };

  return (
    <div
      className="flex flex-col min-h-screen min-w-0 w-full max-w-full overflow-x-clip pb-[max(2.5rem,env(safe-area-inset-bottom))]"
      style={{ background: "#110D14" }}
    >
      <PageHeader title={t("common.language")} onBack={onBack} />

      <p className="px-4 pt-3 pb-2 text-[14px] text-white/45 font-medium">
        {t("common.chooseLanguage")}
      </p>

      <div
        className="mx-3 rounded-[12px] overflow-hidden"
        style={{
          background: "#241E22",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {OPTIONS.map((opt, idx) => {
          const active = current === opt.id;
          return (
            <React.Fragment key={opt.id}>
              {idx > 0 && <div className="h-px bg-white/[0.06] mx-3" />}
              <button
                type="button"
                onClick={() => select(opt.id)}
                className="w-full flex items-center justify-between px-3.5 py-3.5 active:bg-white/[0.03]"
              >
                <div className="flex flex-col items-start gap-0.5">
                  <span className="text-[16px] font-semibold text-white">
                    {opt.native}
                  </span>
                  <span className="text-[13px] text-white/40">
                    {t(`common.${opt.labelKey}`)}
                  </span>
                </div>
                {active ? (
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(254,211,88,0.15)" }}
                  >
                    <IoCheckmark size={18} className="text-[#FED358]" />
                  </span>
                ) : (
                  <span
                    className="w-7 h-7 rounded-full border border-white/15"
                    aria-hidden
                  />
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
