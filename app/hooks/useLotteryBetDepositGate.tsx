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
 * Lottery (Wingo / TRX / K3 / 5D / Moto): open the game freely,
 * block confirming a bet until lifetime SUCCESS recharge meets the minimum.
 */
export function useLotteryBetDepositGate(
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

  const depositModal = (
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
  );

  return { ensureCanBet, depositModal };
}
