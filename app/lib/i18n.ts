"use client";

/**
 * Client-only i18n (EN + HI). UI strings only — no backend changes.
 * Preference stored in localStorage under bcwin_locale.
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";
import hi from "../locales/hi.json";

export const LOCALE_STORAGE_KEY = "bcwin_locale";
export const SUPPORTED_LOCALES = ["en", "hi"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export function isAppLocale(v: string | null | undefined): v is AppLocale {
  return v === "en" || v === "hi";
}

export function readStoredLocale(): AppLocale {
  if (typeof window === "undefined") return "en";
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isAppLocale(raw)) return raw;
  } catch {
    /* ignore */
  }
  return "en";
}

export function persistLocale(lng: AppLocale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, lng);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng === "hi" ? "hi" : "en";
  }
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
    },
    lng: "en",
    fallbackLng: "en",
    // Show fallback / defaultValue instead of raw key paths like "profile.confirm"
    returnNull: false,
    returnEmptyString: false,
    parseMissingKeyHandler: undefined,
    interpolation: { escapeValue: false },
    // Avoid suspense flicker on first paint; we hydrate locale after mount
    react: { useSuspense: false },
  });
} else {
  // HMR / re-import: merge latest locale JSON so new keys appear without full restart
  i18n.addResourceBundle("en", "translation", en, true, true);
  i18n.addResourceBundle("hi", "translation", hi, true, true);
}

export default i18n;
