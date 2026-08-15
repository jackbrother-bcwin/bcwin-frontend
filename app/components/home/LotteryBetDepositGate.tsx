"use client";

import ThirdPartyDepositGate from "./ThirdPartyDepositGate";
import { MIN_LIFETIME_DEPOSIT_TO_PLAY } from "../../lib/play-deposit-gate";
import type { LotteryBetGate } from "../../hooks/useLotteryBetDepositGate";

export default function LotteryBetDepositGate({
  gate,
  closeGate,
  gameName,
  onNavigate,
}: {
  gate: LotteryBetGate;
  closeGate: () => void;
  gameName: string;
  onNavigate?: (screen: string) => void;
}) {
  return (
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
  );
}
