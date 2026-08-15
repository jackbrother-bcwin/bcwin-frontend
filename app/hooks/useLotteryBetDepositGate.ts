/**
 * Stable import path for lottery pages.
 * Implementation lives in useLotteryBetGate.tsx so a leftover
 * useLotteryBetDepositGate.ts on the deploy host cannot shadow a .tsx twin.
 */
export {
  useLotteryBetGate as useLotteryBetDepositGate,
  type LotteryBetGateResult,
} from "./useLotteryBetGate";
