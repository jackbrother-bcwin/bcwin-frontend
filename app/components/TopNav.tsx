"use client";

import React from "react";
import Image from "next/image";
import { IoDownloadOutline } from "react-icons/io5";
import { useAuthState } from "../context/AuthContext";
import { formatINR } from "../lib/format";

interface TopNavProps {
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  onWalletClick?: () => void;
  onNavigate?: (tab: string) => void;
}

/** Home header matching reference: logo left · Log in outline · Register gold fill */
export default function TopNav({
  onLoginClick,
  onRegisterClick,
  onWalletClick,
  onNavigate,
}: TopNavProps) {
  const { isLoggedIn, user } = useAuthState();

  const goWallet = () => {
    onWalletClick?.();
    onNavigate?.("wallet");
  };

  return (
    <header className="home-topnav flex h-[52px] min-h-[52px] items-center gap-1.5 px-2.5 sm:gap-2 sm:px-3">
      <div className="relative h-[28px] w-[min(112px,34vw)] min-w-[88px] shrink-0 sm:h-[30px]">
        <Image
          src="/assets/png/bcwin.png"
          alt="BCWin"
          fill
          sizes="112px"
          className="object-contain object-left"
          priority
        />
      </div>

      <div className="ml-auto flex min-w-0 max-w-[62%] items-center justify-end gap-1 sm:gap-1.5">
        <button
          type="button"
          className="home-icon-btn home-nav-secondary"
          aria-label="Download"
        >
          <IoDownloadOutline size={15} color="#FED358" />
        </button>

        {isLoggedIn ? (
          <button
            type="button"
            onClick={goWallet}
            className="home-balance-pill active:scale-95 transition-transform"
            aria-label="Open wallet"
            title="Wallet"
          >
            <span className="opacity-70 text-[10px]">₹</span>
            <span className="max-w-[5.5rem] truncate tabular-nums sm:max-w-none">
              {formatINR(user?.balance).replace("₹", "")}
            </span>
          </button>
        ) : (
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={onLoginClick} className="home-auth-login">
              Log in
            </button>
            <button type="button" onClick={onRegisterClick} className="home-auth-register">
              Register
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
