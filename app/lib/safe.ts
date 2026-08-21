/**
 * Frontend security helpers — URL allowlists, error sanitization.
 */

/** Prefer https in production; allow http only on localhost for dev. */
export function isSafeHttpUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url.trim());
    if (u.protocol === "https:") return true;
    if (u.protocol === "http:") {
      const host = u.hostname.toLowerCase();
      return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Open a URL in a new tab if it is a safe http(s) URL.
 * Returns false if invalid URL or popup blocked (caller should toast / fallback).
 */
export function openSafeUrl(url: string | null | undefined): boolean {
  return openSafeUrlDetailed(url) === "opened";
}

export type OpenSafeUrlResult = "opened" | "blocked" | "invalid";

/**
 * Same as openSafeUrl but distinguishes invalid URL vs browser popup block.
 * Mobile WebViews often return "blocked" when window.open is restricted —
 * that is NOT an "unsafe scheme" issue.
 */
export function openSafeUrlDetailed(
  url: string | null | undefined
): OpenSafeUrlResult {
  if (!isSafeHttpUrl(url) || typeof window === "undefined") return "invalid";
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) return "blocked";
  try {
    win.opener = null;
  } catch {
    /* ignore */
  }
  return "opened";
}

/**
 * Open a blank tab **inside the click**. After an await, window.open is a
 * popup and Chrome / Safari / Android often block it — first Deposit tap
 * fails, “Open again” works. Hold this handle and call navigateOpenedTab.
 */
export function openBlankTab(): Window | null {
  if (typeof window === "undefined") return null;
  const win = window.open("about:blank", "_blank");
  if (!win) return null;
  try {
    win.document.title = "Opening payment…";
  } catch {
    /* cross-origin or empty doc */
  }
  return win;
}

export function navigateOpenedTab(
  win: Window | null,
  url: string | null | undefined
): OpenSafeUrlResult {
  if (!isSafeHttpUrl(url)) {
    try {
      win?.close();
    } catch {
      /* ignore */
    }
    return "invalid";
  }
  if (!win || win.closed) return "blocked";
  try {
    win.location.replace(url);
  } catch {
    try {
      win.close();
    } catch {
      /* ignore */
    }
    return "blocked";
  }
  try {
    win.opener = null;
  } catch {
    /* ignore */
  }
  return "opened";
}

export function closeOpenedTab(win: Window | null): void {
  if (!win || win.closed) return;
  try {
    win.close();
  } catch {
    /* ignore */
  }
}

/** Cap + strip control chars from API error messages shown in UI */
export function sanitizeErrorMessage(input: unknown, fallback = "Something went wrong"): string {
  let msg = "";
  if (typeof input === "string") msg = input;
  else if (input instanceof Error) msg = input.message;
  else return fallback;

  // Strip HTML-ish tags and control characters
  msg = msg
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();

  if (!msg) return fallback;
  if (msg.length > 200) msg = `${msg.slice(0, 197)}…`;
  return friendlyAuthError(msg);
}

/** Login / reset copy — map older API strings too */
export function friendlyAuthError(msg: string): string {
  const n = msg.trim().toLowerCase();
  if (
    n === "invalid credentials" ||
    n === "invalid email or password" ||
    n === "incorrect password"
  ) {
    return "Wrong account or password";
  }
  if (
    n === "user not found" ||
    n === "user not found with this mobile number" ||
    n === "user not found with this email" ||
    n.startsWith("user not found")
  ) {
    return "User does not exist";
  }
  if (n.includes("demo account") || n.includes("demo user")) {
    return "Game is temporarily under maintenance. Please try again later.";
  }
  return msg;
}

/** Clamp numeric bet amounts before API calls */
export function sanitizeAmount(n: unknown, max = 1_000_000): number | null {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.min(Math.floor(v * 100) / 100, max);
}
