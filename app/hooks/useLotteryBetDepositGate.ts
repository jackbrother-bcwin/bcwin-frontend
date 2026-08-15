"use client";

import { useCallback, useMemo, useState } from "react";
import { useAuthState } from "../context/AuthContext";
import ThirdPartyDepositGate from "../components/home/ThirdPartyDepositGate";
import {
  MIN_LIFETIME_DEPOSIT_TO_PLAY,
  checkMinLifetimeDeposit,
} from "../lib/play-deposit-gate";

/**
 * Lottery (Wingo / TRX / K3 / 5D / Moto): allow opening the game,
 * block placing a bet until lifetime SUCCESS recharge meets the minimum.
 */
export function useLotteryBetDepositGate(
  gameName: string,
  onNavigate?: (screen: string) => void
) {
  const { user } = useAuthState();
  const [gate, setGate] = useState({ open: false, totalDeposit: 0 });

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

  const depositGate = useMemo(
    () => (
      <ThirdPartyDepositGate
        open={gate.open}
        gameName={gameName}
        totalDeposit={gate.totalDeposit}
        required={MIN_LIFETIME_DEPOSIT_TO_PLAY}
        intent="bet"
        onClose={closeGate}
        onDeposit={() => {
          closeGate();
          onNavigate?.("deposit");
        }}
      />
    ),
    [closeGate, gameName, gate.open, gate.totalDeposit, onNavigate]
  );

  return { ensureCanBet, depositGate };
}
