"use client";

import React, { type ReactNode } from "react";
import { AuthProvider } from "../context/AuthContext";
import { ToastProvider } from "./ui/Toast";
import PwaRegister from "./PwaRegister";
import I18nProvider from "./I18nProvider";
import MobileViewportGuard from "./MobileViewportGuard";

/** Shared providers for player app. Admin has its own layout providers. */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>
        <ToastProvider>
          <PwaRegister />
          <MobileViewportGuard />
          <div className="app-root flex min-h-dvh min-h-screen w-full max-w-full justify-center bg-[#110D14]">
            {children}
          </div>
        </ToastProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
