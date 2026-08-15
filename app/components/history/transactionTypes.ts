/**
 * Transaction history type filters — labels match BCWIN-style UI.
 * `id` is used for filtering; `label` is shown in the picker + card title.
 */

export type TxFilterId =
  | "ALL"
  | "BET"
  | "AGENT_COMMISSION"
  | "WIN"
  | "RED_ENVELOPE"
  | "DEPOSIT"
  | "WITHDRAW"
  | "CANCEL_WITHDRAW"
  | "ATTENDANCE_BONUS"
  | "AGENT_SALARY"
  | "WITHDRAWAL_REJECTS"
  | "DEPOSIT_GIFT"
  | "MANUAL_DEPOSIT"
  | "SIGNUP_BONUS"
  | "FIRST_DEPOSIT_BONUS"
  | "FIRST_DEPOSIT_REBATE"
  | "INVESTMENT"
  | "FINANCIAL_INCOME"
  | "FINANCIAL_CAPITAL"
  | "CAPITAL"
  | "INVITE_BONUS"
  | "GAME_MOVED_IN"
  | "GAME_MOVED_OUT"
  | "WINNING_SLOT"
  | "BANK_BINDING_BONUS"
  | "GAME_REFUNDED"
  | "BETTING_REBATE"
  | "USDT_DEPOSIT"
  | "VIP_LEVEL_UP_REWARD"
  | "VIP_MONTHLY_REWARD"
  | "VIP_DEPOSIT_BONUS"
  | "MANUAL_WITHDRAWAL"
  | "ONE_CLICK_REBATE"
  | "SLOTS_JACKPOT"
  | "WEEKLY_AWARD"
  | "C2C_WITHDRAW"
  | "C2C_RECHARGE"
  | "NEWBIE_GIFT_PACK"
  | "RETURN_REWARD"
  | "DAILY_REWARD"
  | "SPIN_WHEEL_REWARDS"
  | "LUCKY_SPIN_REWARD"
  | "GIFT_REDEEM"
  | "PARTNER_REWARDS"
  | "JOIN_CHANNEL_REWARD"
  | "RECHARGE_REPLENISHMENT"
  | "WITHDRAWAL_REWARD"
  | "INVITE_WHEEL_REWARD"
  | "DOWNLOAD_BONUS"
  | "TOP_UP_REWARD"
  | "VIP_REWARDS"
  | "RETURNING_MEMBER_RECHARGE_BONUS";

export type TxFilterOption = { id: TxFilterId; label: string };

/** Order matches product filter sheet (All first) */
export const TX_FILTERS: TxFilterOption[] = [
  { id: "ALL", label: "All" },
  { id: "BET", label: "Bet" },
  { id: "AGENT_COMMISSION", label: "Agent commission" },
  { id: "WIN", label: "Win" },
  { id: "RED_ENVELOPE", label: "Red envelope" },
  { id: "DEPOSIT", label: "Deposit" },
  { id: "WITHDRAW", label: "Withdraw" },
  { id: "CANCEL_WITHDRAW", label: "Cancel withdraw" },
  { id: "ATTENDANCE_BONUS", label: "Attendance bonus" },
  { id: "AGENT_SALARY", label: "Agent salary" },
  { id: "WITHDRAWAL_REJECTS", label: "Withdrawal rejects" },
  { id: "DEPOSIT_GIFT", label: "Deposit gift" },
  { id: "MANUAL_DEPOSIT", label: "Manual deposit" },
  { id: "SIGNUP_BONUS", label: "Signup bonus" },
  { id: "FIRST_DEPOSIT_BONUS", label: "First deposit bonus" },
  { id: "FIRST_DEPOSIT_REBATE", label: "First deposit rebate" },
  { id: "INVESTMENT", label: "Investment" },
  { id: "FINANCIAL_INCOME", label: "Financial income" },
  { id: "FINANCIAL_CAPITAL", label: "Financial capital" },
  { id: "CAPITAL", label: "Capital" },
  { id: "INVITE_BONUS", label: "Invite bonus" },
  { id: "GAME_MOVED_IN", label: "Game moved in" },
  { id: "GAME_MOVED_OUT", label: "Game moved out" },
  { id: "WINNING_SLOT", label: "Winning slot" },
  { id: "BANK_BINDING_BONUS", label: "Bank binding bonus" },
  { id: "GAME_REFUNDED", label: "Game refunded" },
  /** Alias of AGENT_COMMISSION — not shown in the type picker */
  { id: "BETTING_REBATE", label: "Agent commission" },
  { id: "USDT_DEPOSIT", label: "USDT deposit" },
  { id: "VIP_LEVEL_UP_REWARD", label: "VIP level up reward" },
  { id: "VIP_MONTHLY_REWARD", label: "VIP monthly reward" },
  { id: "VIP_DEPOSIT_BONUS", label: "VIP deposit bonus" },
  { id: "MANUAL_WITHDRAWAL", label: "Manual withdrawal" },
  { id: "ONE_CLICK_REBATE", label: "One-click rebate" },
  { id: "SLOTS_JACKPOT", label: "Slots jackpot" },
  { id: "WEEKLY_AWARD", label: "Weekly award" },
  { id: "C2C_WITHDRAW", label: "C2C withdraw" },
  { id: "C2C_RECHARGE", label: "C2C recharge" },
  { id: "NEWBIE_GIFT_PACK", label: "Newbie gift pack" },
  { id: "RETURN_REWARD", label: "Return reward" },
  { id: "DAILY_REWARD", label: "Daily reward" },
  { id: "SPIN_WHEEL_REWARDS", label: "Spin wheel rewards" },
  { id: "INVITE_WHEEL_REWARD", label: "Invite wheel reward" },
  { id: "LUCKY_SPIN_REWARD", label: "Lucky spin reward" },
  { id: "GIFT_REDEEM", label: "Gift code" },
  { id: "PARTNER_REWARDS", label: "Partner rewards" },
  { id: "JOIN_CHANNEL_REWARD", label: "Join channel reward" },
  { id: "RECHARGE_REPLENISHMENT", label: "Recharge replenishment" },
  { id: "WITHDRAWAL_REWARD", label: "Withdrawal reward" },
  { id: "DOWNLOAD_BONUS", label: "Download bonus" },
  { id: "TOP_UP_REWARD", label: "Top-up reward" },
  { id: "VIP_REWARDS", label: "VIP rewards" },
  { id: "RETURNING_MEMBER_RECHARGE_BONUS", label: "Returning member recharge bonus" },
];

export function labelForTxType(id: TxFilterId): string {
  return TX_FILTERS.find((f) => f.id === id)?.label ?? id;
}

export type TxItem = {
  id: string;
  type: TxFilterId;
  /** Card title + Detail value */
  title: string;
  /** Absolute amount (always positive) — primary display number */
  amount: number;
  /** Display unit; USDT deposits use usdt + usdtAmount as amount */
  amountUnit?: "inr" | "usdt";
  /** For USDT deposits: INR equivalent (small secondary line) */
  amountHintInr?: number | null;
  /** true = credit (green), false = debit (red) */
  credit: boolean;
  createdAt: string;
  /** Optional extra detail text */
  detail?: string;
};
