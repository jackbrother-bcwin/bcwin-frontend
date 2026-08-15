"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { useAuthState } from "../context/AuthContext";
import ThirdPartyDepositGate from "../components/home/ThirdPartyDepositGate";
import {
  MIN_LIFETIME_DEPOSIT_TO_PLAY,
  checkMinLifetimeDeposit,
} from "../lib/play-deposit-gate";

export type LotteryBetGateResult = {
  ensureCanBet: () => Promise<boolean>;
  depositModal: ReactNode;
};

/**
 * Lottery screens open freely. Confirming a bet requires
 * lifetime SUCCESS recharge ≥ MIN_LIFETIME_DEPOSIT_TO_PLAY.
 *
 * When the gate blocks, it opens first (z-index above the slip), then
 * `onBlocked` runs on the next task so the bet slip can unmount after
 * the gate is the top SPA overlay (docs/adr/0003).
 */
export function useLotteryBetGate(
  gameName: string,
  onNavigate?: (screen: string) => void,
  onBlocked?: () => void
): LotteryBetGateResult {
  const { user } = useAuthState();
  const [open, setOpen] = useState(false);
  const [totalDeposit, setTotalDeposit] = useState(0);
  const onBlockedRef = useRef(onBlocked);
  onBlockedRef.current = onBlocked;

  const closeGate = useCallback(() => setOpen(false), []);

  const ensureCanBet = useCallback(async (): Promise<boolean> => {
    if (user?.isDemo) return true;
    const { ok, total } = await checkMinLifetimeDeposit();
    if (ok) return true;
    setTotalDeposit(total);
    setOpen(true);
    // Next task: slip dismiss runs after gate pushSpaOverlay (see ADR-0003).
    window.setTimeout(() => onBlockedRef.current?.(), 0);
    return false;
  }, [user?.isDemo]);

  return {
    ensureCanBet,
    depositModal: (
      <ThirdPartyDepositGate
        open={open}
        gameName={gameName}
        totalDeposit={totalDeposit}
        required={MIN_LIFETIME_DEPOSIT_TO_PLAY}
        intent="bet"
        onClose={closeGate}
        onDeposit={() => {
          closeGate();
          onNavigate?.("deposit");
        }}
      />
    ),
  };
}
