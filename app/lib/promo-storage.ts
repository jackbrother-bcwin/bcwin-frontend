/**
 * Home promo popup gates (localStorage).
 * Daily promo hide must be cleared on logout/login in AuthContext —
 * HomePopups is only mounted on Home, so logout from Account never saw the clear.
 */

export const DAILY_PROMO_HIDE_KEY = "bcwin_daily_promo_hide_until";
export const FD_NO_REMIND_DAY_KEY = "bcwin_fd_no_remind_day";

export function clearDailyPromoHide(): void {
  try {
    localStorage.removeItem(DAILY_PROMO_HIDE_KEY);
  } catch {
    /* private mode */
  }
}

export function readDailyPromoHideUntil(): number {
  try {
    return Number(localStorage.getItem(DAILY_PROMO_HIDE_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

export function writeDailyPromoHideUntil(ts: number): void {
  try {
    localStorage.setItem(DAILY_PROMO_HIDE_KEY, String(ts));
  } catch {
    /* private mode */
  }
}
