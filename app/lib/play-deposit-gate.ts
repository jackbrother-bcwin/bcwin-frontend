/**
 * Lifetime SUCCESS recharge required to play Inout + first-party lottery.
 * Same ₹100 as Config.GAME_MIN_LIFETIME_DEPOSIT / ADR-0007 third-party gate.
 */

import { getTotalSuccessfulDeposit } from "./deposit-total";

export const MIN_LIFETIME_DEPOSIT_TO_PLAY = 100;

export const PLAY_GATED_SCREENS: Record<string, string> = {
  wingo: "Win Go",
  trxwingo: "Trx Win Go",
  k3: "K3",
  "5d": "5D",
  moto: "Moto Race",
};

export function isPlayGatedScreen(screen: string): boolean {
  return Object.prototype.hasOwnProperty.call(PLAY_GATED_SCREENS, screen);
}

export async function checkMinLifetimeDeposit(): Promise<{
  ok: boolean;
  total: number;
}> {
  const total = await getTotalSuccessfulDeposit();
  return { ok: total >= MIN_LIFETIME_DEPOSIT_TO_PLAY, total };
}
