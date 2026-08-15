/**
 * Frontend rule: all reward / bonus collects require bank details.
 * Does not change backend — check before any claim API call.
 */

import * as api from "./api";
import type { BankDetails } from "./api";

export function hasCompleteBank(bank: BankDetails | null | undefined): boolean {
  if (!bank) return false;
  return Boolean(
    bank.fullName?.trim() &&
      bank.bankAccount?.trim() &&
      bank.ifsc?.trim()
  );
}

/**
 * Fetches bank details and validates essentials (name, account, IFSC).
 * @returns true if collect is allowed
 */
export async function requireBankForCollect(): Promise<{
  ok: boolean;
  message?: string;
}> {
  try {
    const res = await api.getBank();
    if (hasCompleteBank(res.data)) {
      return { ok: true };
    }
    return {
      ok: false,
      message: "Please add your bank details before collecting rewards",
    };
  } catch {
    // 404 / missing bank
    return {
      ok: false,
      message: "Please add your bank details before collecting rewards",
    };
  }
}
