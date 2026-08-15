"use client";

import { useCallback, useState } from "react";
import { useAuthState } from "../context/AuthContext";
import { checkMinLifetimeDeposit } from "../lib/play-deposit-gate";

export type LotteryBetGate = {
  open: boolean;
  totalDeposit: number;
};

/**
 * Lottery (Wingo / TRX / K3 / 5D / Moto): allow opening the game,
 * block placing a bet until lifetime SUCCESS recharge meets the minimum.
 */
export function useLotteryBetDepositGate(): {
  ensureCanBet: () => Promise<boolean>;
  gate: LotteryBetGate;
  closeGate: () => void;
} {
  const { user } = useAuthState();
  const [gate, setGate] = useState<LotteryBetGate>({
    open: false,
    totalDeposit: 0,
  });

  const closeGate = useCallback(() => {
    setGate((g) => ({ ...g, open: false }));
  }, []);

  const ensureCanBet = useCallback(async (): Promise<boolean> => {
    if (user?.isDemo) return true;
    const { ok, total } = await checkMinLifetimeDeposit();
    if (ok) return true;
    setGate({ open: true, totalDeposit: total });
    return false;
  }, [user?.isDemo]);

  return { ensureCanBet, gate, closeGate };
}
