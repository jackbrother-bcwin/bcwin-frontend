/**
 * Lifetime successful deposit total (recharge gate for Inout + lottery).
 */

import * as api from "./api";

/**
 * Sum SUCCESS deposits (paginated, hard cap 30 pages).
 */
export async function getTotalSuccessfulDeposit(): Promise<number> {
  let total = 0;
  let page = 1;
  let totalPages = 1;
  const MAX_PAGES = 30;

  while (page <= totalPages && page <= MAX_PAGES) {
    const res = await api.getDeposits({
      page,
      limit: 100,
      status: "SUCCESS",
    });
    const list = res.deposits ?? [];
    for (const d of list) {
      const st = String(d.status ?? "").toUpperCase();
      if (st === "SUCCESS" || st === "COMPLETED" || st === "PAID") {
        total += Number(d.amount) || 0;
      }
    }
    totalPages = Math.max(1, res.totalPages ?? 1);
    if (list.length === 0) break;
    page += 1;
  }

  return total;
}
