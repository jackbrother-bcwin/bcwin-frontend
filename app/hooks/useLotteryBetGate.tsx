"use client";

import { useCallback, useState, type ReactNode } from "react";
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
 */
export function useLotteryBetGate(
  gameName: string,
  onNavigate?: (screen: string) => void
): LotteryBetGateResult {
  const { user } = useAuthState();
  const [open, setOpen] = useState(false);
  const [totalDeposit, setTotalDeposit] = useState(0);

  const closeGate = useCallback(() => setOpen(false), []);

  const ensureCanBet = useCallback(async (): Promise<boolean> => {
    if (user?.isDemo) return true;
    const { ok, total } = await checkMinLifetimeDeposit();
    if (ok) return true;
    setTotalDeposit(total);
    setOpen(true);
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
