"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuthState } from "../../context/AuthContext";
import * as api from "../../lib/api";
import { requireBankForCollect } from "../../lib/require-bank";
import {
  DAILY_PROMO_HIDE_KEY,
  FD_NO_REMIND_DAY_KEY,
  readDailyPromoHideUntil,
  writeDailyPromoHideUntil,
} from "../../lib/promo-storage";
import { useToast } from "../ui/Toast";
import DailyPromoPopup from "./DailyPromoPopup";
import FirstDepositPopup, {
  fetchFirstDepositProgress,
  type FirstDepositTierRow,
} from "./FirstDepositPopup";

/**
 * Within one login session, after Confirm, hide daily promo for this many hours
 * (avoids re-open on every Home visit). Cleared on logout + login in AuthContext.
 */
const DAILY_COOLDOWN_H = 12;
const SHOW_DELAY_MS = 350;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function write(key: string, val: string) {
  try {
    localStorage.setItem(key, val);
  } catch {
    /* private mode */
  }
}

function forcePopupsFromUrl(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("forcePopups") === "1";
  } catch {
    return false;
  }
}

interface Props {
  onNavigate: (tab: string) => void;
}

/**
 * Home popup flow:
 * 1) Daily promo if gate open (cleared on every login/logout in AuthContext)
 * 2) First deposit after daily when eligible
 *
 * Bug fixed: logout from Account never cleared the daily hide key because
 * this component only mounts on Home — gate is now cleared in AuthContext.
 */
export default function HomePopups({ onNavigate }: Props) {
  const { isLoggedIn, isLoading } = useAuthState();
  const { toast } = useToast();
  const [phase, setPhase] = useState<"none" | "daily" | "firstDeposit">("none");
  const [fdTiers, setFdTiers] = useState<FirstDepositTierRow[]>([]);
  const [fdLoading, setFdLoading] = useState(false);
  const [noRemindToday, setNoRemindToday] = useState(false);
  const timerRef = useRef<number | null>(null);

  const openFirstDepositIfNeeded = useCallback(async () => {
    if (!isLoggedIn && !forcePopupsFromUrl()) {
      setPhase("none");
      return;
    }
    const day = todayKey();
    try {
      if (
        !forcePopupsFromUrl() &&
        localStorage.getItem(FD_NO_REMIND_DAY_KEY) === day
      ) {
        setPhase("none");
        return;
      }
    } catch {
      /* ignore */
    }

    setFdLoading(true);
    const { tiers, shouldOffer } = await fetchFirstDepositProgress();
    setFdLoading(false);
    setFdTiers(tiers);

    if (forcePopupsFromUrl() || shouldOffer) {
      setPhase("firstDeposit");
    } else {
      setPhase("none");
    }
  }, [isLoggedIn]);

  const schedulePopupFlow = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const force = forcePopupsFromUrl();
      const hideUntil = readDailyPromoHideUntil();
      const showDaily = force || Date.now() >= hideUntil;

      if (showDaily) {
        setPhase("daily");
        return;
      }

      void openFirstDepositIfNeeded();
    }, SHOW_DELAY_MS);
  }, [openFirstDepositIfNeeded]);

  // After auth settles (and whenever login flips), re-evaluate popups
  useEffect(() => {
    if (isLoading) {
      setPhase("none");
      return;
    }

    schedulePopupFlow();

    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isLoading, isLoggedIn, schedulePopupFlow]);

  const handleDailyConfirm = () => {
    // Close first — do not wait for first-deposit API (that felt like a 1s lag).
    setPhase("none");
    if (!forcePopupsFromUrl()) {
      writeDailyPromoHideUntil(
        Date.now() + DAILY_COOLDOWN_H * 60 * 60 * 1000
      );
    }
    void openFirstDepositIfNeeded();
  };

  const handleFdClose = () => {
    if (noRemindToday) write(FD_NO_REMIND_DAY_KEY, todayKey());
    setPhase("none");
  };

  const handleFdActivity = () => {
    if (noRemindToday) write(FD_NO_REMIND_DAY_KEY, todayKey());
    setPhase("none");
    onNavigate("activity");
  };

  const handleFdDeposit = () => {
    if (noRemindToday) write(FD_NO_REMIND_DAY_KEY, todayKey());
    setPhase("none");
    onNavigate("deposit");
  };

  const handleFdClaim = useCallback(
    async (tier: FirstDepositTierRow) => {
      if (!tier.bonusId || !tier.eligible) {
        toast("This bonus is not available to claim", "error");
        return;
      }

      const bank = await requireBankForCollect();
      if (!bank.ok) {
        toast(
          bank.message ?? "Please add your bank details before collecting",
          "error"
        );
        if (noRemindToday) write(FD_NO_REMIND_DAY_KEY, todayKey());
        setPhase("none");
        onNavigate("bank");
        return;
      }

      try {
        await api.claimActivityBonus(tier.bonusId);
        toast("First deposit bonus claimed!", "success");
      } catch (e: unknown) {
        toast(e instanceof Error ? e.message : "Claim failed", "error");
        return;
      }

      const { tiers, claimed, shouldOffer } = await fetchFirstDepositProgress();
      setFdTiers(tiers);
      if (claimed || !shouldOffer) {
        setPhase("none");
      }
    },
    [noRemindToday, onNavigate, toast]
  );

  return (
    <>
      <DailyPromoPopup
        open={phase === "daily"}
        onConfirm={handleDailyConfirm}
        onNavigate={onNavigate}
      />
      <FirstDepositPopup
        open={phase === "firstDeposit"}
        tiers={fdTiers}
        noRemindToday={noRemindToday}
        onToggleNoRemind={setNoRemindToday}
        onClose={handleFdClose}
        onDeposit={handleFdDeposit}
        onActivity={handleFdActivity}
        onClaim={handleFdClaim}
        loading={fdLoading}
      />
    </>
  );
}

// Re-export key for debugging / tests
export { DAILY_PROMO_HIDE_KEY };
