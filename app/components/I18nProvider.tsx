"use client";

import React, { useEffect, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { persistLocale, readStoredLocale } from "../lib/i18n";

/**
 * Loads saved locale after mount (avoids SSR/localStorage mismatch).
 */
export default function I18nProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const lng = readStoredLocale();
    if (i18n.language !== lng) {
      void i18n.changeLanguage(lng);
    }
    persistLocale(lng);
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
