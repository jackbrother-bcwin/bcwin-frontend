/** Player history lists (game / chart / wallet) stop at this page. */
export const HISTORY_MAX_PAGES = 50;

export function capHistoryPages(totalPages: number | undefined | null): number {
  const n = Math.max(1, Math.floor(Number(totalPages) || 1));
  return Math.min(n, HISTORY_MAX_PAGES);
}

export function capHistoryPage(
  page: number | undefined | null,
  totalPages?: number | undefined | null
): number {
  const last = capHistoryPages(totalPages ?? HISTORY_MAX_PAGES);
  const p = Math.max(1, Math.floor(Number(page) || 1));
  return Math.min(p, last);
}
