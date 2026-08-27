/**
 * API Client for BCWin backend
 * All requests are proxied through Next.js rewrites:
 *   /api/v1/* → BACKEND_URL/api/v1/*
 * Auth: `auth-token` cookie via credentials: "include"
 */

import { sanitizeErrorMessage } from "./safe";

const BASE = "/api/v1";

// ─── Shared types ────────────────────────────────────────────────────────────

export interface ApiError {
  success: false;
  error: string;
}

export interface User {
  id: string;
  username: string;
  serialNumber: number;
  mobileNumber: string;
  /** Optional unique email (email login / OTP) */
  email?: string | null;
  balance: number;
  role: "USER" | "ADMIN" | "SUB_ADMIN" | "AGENT";
  referralCode: string;
  isBanned: boolean;
  isDemo: boolean;
  referredBy?: string;
  vipLevel: number;
  /** ISO timestamp of last successful login (profile subline) */
  lastLoginDate?: string | null;
}

/** OTP channel — matches backend GET /otp `method` */
export type OtpMethod = "mobileNumber" | "email";

export interface Paginated {
  total: number;
  currentPage: number;
  totalPages: number;
}

export interface Deposit {
  id: string;
  orderId: string;
  /** INR wallet / order value */
  amount: number;
  /** USDT size when method is OXAPAY; null for bank/UPI */
  usdtAmount?: number | null;
  method: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Withdrawal {
  id: string;
  orderId: string;
  amount: number;
  method: string;
  /** Present for OXAPAY / USDT withdrawals */
  cryptoChain?: string | null;
  usdtAmount?: number | null;
  /** On-chain hash from OXAPAY payout callback */
  txHash?: string | null;
  status: string;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BankDetails {
  fullName?: string | null;
  bankAccount?: string | null;
  bankName?: string | null;
  ifsc?: string | null;
  /** @deprecated prefer trc20Address / bep20Address */
  tronAddress?: string | null;
  trc20Address?: string | null;
  bep20Address?: string | null;
  upiId?: string | null;
  /** ISO timestamp of last save/update */
  updatedAt?: string | null;
  /** Whether another update is allowed now (24h cooldown) */
  canUpdate?: boolean;
  /** ISO time when next update is allowed */
  nextUpdateAt?: string | null;
}

export type BankSavePayload = {
  fullName?: string | null;
  bankAccount?: string | null;
  bankName?: string | null;
  ifsc?: string | null;
  tronAddress?: string | null;
  trc20Address?: string | null;
  bep20Address?: string | null;
  upiId?: string | null;
  /** Required 6-digit OTP from registered mobile */
  otp: string;
};

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  importance: string;
  createdAt: string;
}

export interface GameHistoryItem {
  id: string;
  majorGameType: string;
  gameName: string;
  betAmount: number;
  winAmount: number;
  status: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
}

export interface ActivityBonus {
  id: string;
  userId: string;
  type: string;
  status: string;
  amount: number;
  metadata?: unknown;
  expiresAt?: string;
  claimAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WingoPeriod {
  id: string;
  periodNumber: string;
  durationSeconds: number;
  startTime: string;
  endTime: string;
  resultNumber?: number | null;
  resultColor?: string | null;
  resultSize?: string | null;
  status: "ACTIVE" | "ENDED" | "RESOLVED" | string;
  /** TRX WinGo only — Tron block proof */
  blockNumber?: number | null;
  blockHash?: string | null;
  blockTimestamp?: string | null;
}

export interface WingoResult {
  id: string;
  periodNumber: string;
  durationSeconds: number;
  startTime: string;
  endTime: string;
  resultNumber: number;
  resultColor: string;
  resultSize: string;
  /** TRX WinGo — Tron proof fields */
  blockNumber?: number | null;
  blockHash?: string | null;
  blockTimestamp?: string | null;
  userBet?: {
    id: string;
    betAmount: number;
    betType: string;
    betChoice: string;
    isWin: boolean;
    winAmount: number;
  } | null;
}

export interface WingoBet {
  id: string;
  periodId: string;
  periodNumber: string;
  betAmount: number;
  contractAmount: number;
  betType: string;
  betChoice: string;
  status: string;
  result?: { isWin: boolean; winAmount: number; multiplier?: number | null } | null;
  createdAt?: string;
}

export interface K3Period {
  id: string;
  periodNumber: string;
  durationSeconds: number;
  startTime: string;
  endTime: string;
  dice1?: number | null;
  dice2?: number | null;
  dice3?: number | null;
  sum?: number | null;
  status: string;
}

export interface K3Result {
  id: string;
  periodNumber: string;
  durationSeconds: number;
  startTime: string;
  endTime: string;
  dice1: number;
  dice2: number;
  dice3: number;
  sum: number;
  isTriple?: boolean;
  isDouble?: boolean;
  isBig?: boolean;
  isSmall?: boolean;
  isOdd?: boolean;
  isEven?: boolean;
}

export interface FiveDPeriod {
  id: string;
  periodNumber: string;
  durationSeconds: number;
  startTime: string;
  endTime: string;
  resultNumber?: string | null;
  resultDigitA?: number | null;
  resultDigitB?: number | null;
  resultDigitC?: number | null;
  resultDigitD?: number | null;
  resultDigitE?: number | null;
  resultSum?: number | null;
  status: string;
}

export interface FiveDResult {
  id: string;
  periodNumber: string;
  durationSeconds: number;
  startTime: string;
  endTime: string;
  resultNumber: string;
  resultDigitA: number;
  resultDigitB: number;
  resultDigitC: number;
  resultDigitD: number;
  resultDigitE: number;
  resultSum: number;
}

/** 5D user bet (POSITION A–E or SUM) */
export interface FiveDBet {
  id: string;
  periodId: string;
  periodNumber: string;
  betAmount: number;
  contractAmount?: number;
  betCategory: "POSITION" | "SUM";
  betType: string;
  position?: string | null;
  betChoice: string;
  status: string;
  result?: {
    isWin: boolean;
    winAmount: number;
    multiplier?: number | null;
  } | null;
  createdAt?: string;
}

export interface MotoPeriod {
  id: string;
  periodNumber: string;
  durationSeconds: number;
  startTime: string;
  endTime: string;
  firstPlace?: number | null;
  secondPlace?: number | null;
  thirdPlace?: number | null;
  status: string;
}

/** Moto bet — includes targetPosition (FIRST|SECOND|THIRD) */
export interface MotoBet {
  id: string;
  periodId: string;
  periodNumber: string;
  betAmount: number;
  contractAmount?: number;
  betType: "POSITION" | "ODD_EVEN" | "BIG_SMALL" | string;
  betChoice: string;
  targetPosition: "FIRST" | "SECOND" | "THIRD" | string;
  status: string;
  result?: {
    isWin: boolean;
    winAmount: number;
    multiplier?: number | null;
  } | null;
  createdAt?: string;
}

export interface UserQuery {
  id: string;
  ticketId: string;
  type: string;
  status: string;
  subject: string;
  details?: unknown;
  adminNotes?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** In-flight GET dedupe — concurrent identical GETs share one network round-trip */
const inflightGet = new Map<string, Promise<unknown>>();

async function requestRaw<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE}${path}`;
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);

  // Only set JSON content-type when sending a body (avoids GET CORS/proxy quirks)
  if (method !== "GET" && method !== "HEAD" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Soft timeout so auth bootstrap never hangs the UI forever
  const timeoutMs = 12_000;
  const externalSignal = options.signal;
  const ctrl = new AbortController();
  const onExternalAbort = () => ctrl.abort();
  externalSignal?.addEventListener("abort", onExternalAbort);
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      method,
      credentials: "include",
      headers,
      signal: ctrl.signal,
    });
  } catch {
    if (ctrl.signal.aborted && !externalSignal?.aborted) {
      throw new Error("Request timed out. Please try again.");
    }
    throw new Error("Network error. Check your connection.");
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }

  // Prefer JSON; fall back to text for HTML error pages
  const contentType = res.headers.get("content-type") ?? "";
  const rawText = await res.text().catch(() => "");
  let data: unknown = null;

  if (contentType.includes("application/json") || rawText.trim().startsWith("{") || rawText.trim().startsWith("[")) {
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = { success: false, error: "Invalid JSON response" };
    }
  } else {
    data = {
      success: false,
      error: res.ok ? "Unexpected response" : `HTTP ${res.status}`,
    };
  }

  if (!res.ok) {
    const raw =
      data && typeof data === "object" && data !== null && "error" in data
        ? String((data as ApiError).error ?? "")
        : "";
    throw new Error(sanitizeErrorMessage(raw || `Request failed (${res.status})`));
  }

  return data as T;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  // Dedupe only plain GETs without abort (abort would cancel shared promise for all callers)
  if (method === "GET" && !options.signal) {
    const key = `${BASE}${path}`;
    const existing = inflightGet.get(key);
    if (existing) return existing as Promise<T>;
    const p = requestRaw<T>(path, options).finally(() => {
      inflightGet.delete(key);
    });
    inflightGet.set(key, p);
    return p;
  }
  return requestRaw<T>(path, options);
}

function buildQuery(
  params: Record<string, string | number | boolean | undefined | null>
): string {
  const q = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") q.set(key, String(val));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

// ─── Auth ────────────────────────────────────────────────────────────────────

/**
 * Send OTP via SMS or email.
 * Backend: GET /otp?method=mobileNumber|email&...
 */
export async function sendOtp(
  opts:
    | {
        method?: "mobileNumber";
        mobileNumber: string;
        /** Digits only: 91 | 92 | 880 */
        countryCode?: string;
        /** reset = forgot password; user must already exist */
        purpose?: "register" | "reset";
      }
    | {
        method: "email";
        email: string;
        purpose?: "register" | "reset";
      }
): Promise<{ success: true }> {
  if (opts.method === "email") {
    const email = opts.email.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address");
    }
    return request(
      `/otp${buildQuery({
        method: "email",
        email,
        purpose: opts.purpose,
      })}`
    );
  }

  const countryCode = String(opts.countryCode ?? "91").replace(/\D/g, "");
  let mobileNumber = opts.mobileNumber.replace(/\D/g, "");
  if (
    (countryCode === "91" || countryCode === "92" || countryCode === "880") &&
    mobileNumber.startsWith("0")
  ) {
    mobileNumber = mobileNumber.replace(/^0+/, "");
  }
  if (!mobileNumber) {
    throw new Error("Enter a valid mobile number");
  }
  return request(
    `/otp${buildQuery({
      method: "mobileNumber",
      mobileNumber,
      countryCode,
      purpose: opts.purpose,
    })}`
  );
}

export type LoginOpts =
  | {
      password: string;
      mobileNumber: string;
      countryCode?: string;
      email?: never;
    }
  | {
      password: string;
      email: string;
      mobileNumber?: never;
      countryCode?: never;
    };

/** Login with mobile+countryCode or email (backend accepts either). */
export async function login(
  opts: LoginOpts
): Promise<{ success: true; token: string }> {
  if ("email" in opts && opts.email) {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: opts.email.trim().toLowerCase(),
        password: opts.password,
      }),
    });
  }
  if (!opts.mobileNumber) {
    throw new Error("Mobile number or email is required");
  }
  const countryCode = String(opts.countryCode ?? "91").replace(/\D/g, "");
  let mobileNumber = opts.mobileNumber.replace(/\D/g, "");
  if (
    (countryCode === "91" || countryCode === "92" || countryCode === "880") &&
    mobileNumber.startsWith("0")
  ) {
    mobileNumber = mobileNumber.replace(/^0+/, "");
  }
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      mobileNumber,
      password: opts.password,
      countryCode,
    }),
  });
}

/**
 * Register — backend always requires mobileNumber + otp + referredBy.
 * Optional email; OTP may have been delivered via SMS (e164) or email.
 */
export async function register(opts: {
  username: string;
  password: string;
  mobileNumber: string;
  otp: string;
  countryCode?: string;
  email?: string;
  /** Required invite / referral code of an existing user */
  referredBy: string;
}): Promise<{ success: true; token: string }> {
  const body: Record<string, string> = {
    username: opts.username.trim(),
    password: opts.password,
    mobileNumber: opts.mobileNumber.replace(/\D/g, ""),
    otp: opts.otp.replace(/\D/g, ""),
    countryCode: String(opts.countryCode ?? "91").replace(/\D/g, ""),
    referredBy: opts.referredBy.trim(),
  };
  if (opts.email?.trim()) {
    body.email = opts.email.trim().toLowerCase();
  }
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function logout(): Promise<{ success: true }> {
  return request("/auth/logout");
}

export async function forgotPassword(opts: {
  mobileNumber: string;
  otp: string;
  password: string;
  countryCode?: string;
}): Promise<{ success: true }> {
  return request("/auth/forgot", {
    method: "POST",
    body: JSON.stringify({
      mobileNumber: opts.mobileNumber.replace(/\D/g, ""),
      otp: opts.otp.replace(/\D/g, ""),
      password: opts.password,
      countryCode: String(opts.countryCode ?? "91").replace(/\D/g, ""),
    }),
  });
}

// ─── User ────────────────────────────────────────────────────────────────────

export async function getUser(): Promise<{ success: true; user: User }> {
  return request("/user/user");
}

/** PUT /user/update-username — nickname is User.username */
export async function updateUsername(
  username: string
): Promise<{ success: true; message: string; username: string }> {
  return request("/user/update-username", {
    method: "PUT",
    body: JSON.stringify({ username: username.trim() }),
  });
}

/** PUT /user/bind-email — bind email once (requires email OTP) */
export async function bindEmail(opts: {
  email: string;
  otp: string;
}): Promise<{ success: true; message: string; email: string }> {
  return request("/user/bind-email", {
    method: "PUT",
    body: JSON.stringify({
      email: opts.email.trim().toLowerCase(),
      otp: opts.otp.trim(),
    }),
  });
}

export async function getDeposits(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{ success: true; deposits: Deposit[] } & Paginated> {
  return request(`/user/deposits${buildQuery(params ?? {})}`);
}

export async function getWithdrawals(params?: {
  page?: number;
  limit?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ success: true; withdrawals: Withdrawal[] } & Paginated> {
  return request(`/user/withdrawals${buildQuery(params ?? {})}`);
}

export async function getGameHistory(params?: {
  page?: number;
  limit?: number;
  majorGameType?: string;
  minorGameType?: string;
  inoutGameMode?: string;
}): Promise<{ success: true; data: GameHistoryItem[] } & Paginated> {
  return request(`/user/game-history${buildQuery(params ?? {})}`);
}

export async function getNotifications(): Promise<{
  success: true;
  notifications: Notification[];
}> {
  return request("/user/notifications");
}

/** VIP level requirement — GET /user/vip/requirements & status.*Requirements */
export type VipLevelRequirement = {
  level: number;
  expRequired: number;
  levelUpReward: number;
  monthlyReward: number;
  rebateRate: string | null;
  /** ADR-0021 self-rebate % for this XP VIP */
  selfRebatePercent?: number;
  teamSize?: number;
  teamBetting?: number;
  teamDeposit?: number;
};

export type VipCommissionRates = {
  vipLevel: number;
  layer1: number;
  layer2: number;
  layer3: number;
  layer4: number;
  layer5: number;
  layer6: number;
};

/** GET /user/vip/status */
export type VipStatus = {
  /** XP VIP (rewards only) — ADR-0012 */
  currentLevel: number;
  /** Agency rebate tier for RebateRateConfig — ADR-0012 */
  rebateLevel: number;
  nextLevel: number | null;
  xp: number;
  teamSize: number;
  teamBetting: number;
  teamDeposit: number;
  currentRequirements: VipLevelRequirement;
  nextRequirements: VipLevelRequirement | null;
  progress: { xp: number } | null;
  commissionRates?: VipCommissionRates | null;
  lastCalculatedAt: string;
  monthlyClaim?: {
    level: number;
    canClaim: boolean;
    nextClaimAt: string | null;
    lastClaimAt: string | null;
  };
};

export type VipRewardClaimType = "LEVEL_UP" | "MONTHLY";

export async function getVipStatus(): Promise<{ success: true; data: VipStatus }> {
  return request("/user/vip/status");
}

export async function getVipRequirements(): Promise<{
  success: true;
  data: VipLevelRequirement[];
}> {
  return request("/user/vip/requirements");
}

/** POST /user/vip/claim-reward */
export async function claimVipReward(opts: {
  level: number;
  type: VipRewardClaimType;
}): Promise<{
  success: true;
  message: string;
  amount: number;
  newBalance: number;
}> {
  return request("/user/vip/claim-reward", {
    method: "POST",
    body: JSON.stringify(opts),
  });
}

/** GET /user/vip/claim-history */
export type VipRewardClaim = {
  id: string;
  level: number;
  type: VipRewardClaimType;
  amount: number;
  monthYear: string | null;
  createdAt: string;
};

export async function getVipClaimHistory(params?: {
  page?: number;
  limit?: number;
  type?: VipRewardClaimType | "all";
}): Promise<{
  success: true;
  data: VipRewardClaim[];
  total: number;
  currentPage: number;
  totalPages: number;
}> {
  return request(`/user/vip/claim-history${buildQuery(params ?? {})}`);
}

export type TeamOverviewData = {
  directTeamSize: number;
  totalTeamSize: number;
  totalTeamBetting: number;
  totalTeamDeposit: number;
  totalCommissionEarned: number;
  directTeamBetting?: number;
  directTeamDeposit?: number;
  directDepositCount?: number;
  teamDepositCount?: number;
  directFirstDepositUsers?: number;
  teamFirstDepositUsers?: number;
};

export async function getTeamOverview(params?: {
  date?: string;
}): Promise<{
  success: true;
  data: TeamOverviewData;
}> {
  return request(`/user/team/overview${buildQuery(params ?? {})}`);
}

export type AgencyHubData = {
  yesterday: TeamOverviewData;
  lifetime: TeamOverviewData;
  yesterdayCommission: number;
  weekCommission: number;
};

export async function getAgencyHub(): Promise<{
  success: true;
  data: AgencyHubData;
}> {
  return request("/user/team/hub");
}

/** Sum team-rebate amounts for an inclusive IST date range (pages history). */
export async function sumRebatesInRange(opts: {
  startDate: string;
  endDate: string;
  settled?: string | boolean;
}): Promise<number> {
  let total = 0;
  let page = 1;
  let totalPages = 1;
  do {
    const res = await getRebateHistory({
      page,
      limit: REBATE_HISTORY_PAGE,
      startDate: opts.startDate,
      endDate: opts.endDate,
      settled: opts.settled ?? "all",
    });
    for (const row of res.data ?? []) {
      total += Number(row.amount) || 0;
    }
    totalPages = Math.max(1, Number(res.totalPages ?? 1));
    page += 1;
  } while (page <= totalPages && page <= REBATE_HISTORY_MAX_PAGES);
  return total;
}

export interface TeamMember {
  id: string;
  username: string;
  mobileNumber?: string;
  email?: string;
  serialNumber?: number;
  layer: number;
  totalBetting: number;
  /** Number of bets in the selected day */
  betCount?: number;
  totalDeposit: number;
  commissionGenerated: number;
  createdAt: string;
}

export type TeamMembersSummary = {
  memberCount: number;
  depositCount?: number;
  totalBetting: number;
  totalDeposit: number;
  depositors: number;
  bettors: number;
  firstDepositUsers?: number;
  firstDepositAmount?: number;
};

export async function getTeamMembers(params?: {
  page?: number;
  limit?: number;
  layer?: number | string;
  username?: string;
  /**
   * IST day YYYY-MM-DD — member bet/deposit/rebate stats for that day only.
   * Omit for lifetime totals.
   */
  date?: string;
}): Promise<
  {
    success: true;
    data: TeamMember[];
    summary?: TeamMembersSummary;
  } & Partial<Paginated>
> {
  return request(`/user/team/members${buildQuery(params ?? {})}`);
}

export async function getCommissionDaily(params?: {
  page?: number;
  limit?: number;
}): Promise<{ success: true; data: unknown } & Partial<Paginated>> {
  return request(`/user/commission/daily${buildQuery(params ?? {})}`);
}

export interface CommissionBreakdownItem {
  id: string;
  fromUser?: {
    id: string;
    username: string;
    serialNumber?: number;
  };
  layer: number;
  userVipLevel?: number;
  commissionRate?: number;
  betAmount?: number;
  commissionAmount?: number;
  amount?: number;
  /** Game code when row is mapped from team rebate */
  betType?: string;
  createdAt?: string;
  /** false = accrued, not yet settled */
  settled?: boolean;
}

export async function getCommissionBreakdown(params?: {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  layer?: number | string;
}): Promise<{ success: true; data: CommissionBreakdownItem[] } & Partial<Paginated>> {
  return request(`/user/commission/breakdown${buildQuery(params ?? {})}`);
}

export async function getCommissionRates(): Promise<{ success: true; data: unknown }> {
  return request("/user/commission/rates");
}

export interface RebateRecord {
  id: string;
  amount: number;
  game: string;
  gameCategory?: string | null;
  layer?: number | null;
  rate?: number | null;
  betAmount?: number | null;
  receiverVip?: number | null;
  fromUser?: {
    id?: string;
    username?: string;
    serialNumber?: number;
  } | null;
  settled: boolean;
  createdAt: string;
}

const REBATE_HISTORY_PAGE = 200;
const REBATE_HISTORY_MAX_PAGES = 40;

/** Paginated team-rebate rows. `settled: "all"` includes today's live (unsettled). */
export async function getAllRebates(opts?: {
  settled?: string | boolean;
}): Promise<RebateRecord[]> {
  const out: RebateRecord[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const res = await getRebateHistory({
      page,
      limit: REBATE_HISTORY_PAGE,
      settled: opts?.settled ?? true,
    });
    out.push(...(res.data ?? []));
    totalPages = Math.max(1, Number(res.totalPages ?? 1));
    page += 1;
  } while (page <= totalPages && page <= REBATE_HISTORY_MAX_PAGES);
  return out;
}

/** Settled only — same source as Agency hero / TX. */
export async function getAllSettledRebates(): Promise<RebateRecord[]> {
  return getAllRebates({ settled: true });
}

export async function getRebateHistory(params?: {
  page?: number;
  limit?: number;
  date?: string;
  startDate?: string;
  endDate?: string;
  settled?: string | boolean;
  game?: string;
  category?: string;
  /** Paginate one downline’s bets (agent commission expand) */
  fromUserId?: string;
  layer?: number | string;
}): Promise<
  {
    success: true;
    data: RebateRecord[];
    total?: number;
    currentPage?: number;
    totalPages?: number;
  } & Partial<Paginated>
> {
  return request(`/user/rebate/history${buildQuery(params ?? {})}`);
}

export type RebateDayPreview = {
  date: string;
  rebateLevel: number;
  teamSize: number;
  teamBetting: number;
  teamDeposit: number;
  totalCommission: number;
  byLayer: Record<string, { commission: number; bet: number; users: number }>;
  people?: Array<{
    fromUserId: string;
    username: string;
    serialNumber: number | null;
    layer: number;
    commission: number;
    betVolume: number;
    bets: number;
  }>;
};

/** Live IST-day Agent commission (not in wallet until 00:00 close). */
export async function getRebateDayPreview(params?: {
  date?: string;
}): Promise<{ success: true; data: RebateDayPreview }> {
  return request(`/user/rebate/day-preview${buildQuery(params ?? {})}`);
}

export type RebatePersonBet = {
  id: string;
  fromUserId: string;
  layer: number;
  betAmount: number;
  amount: number;
  rate: number;
  game: string;
  createdAt: string;
  settled: boolean;
};

/** Expand: live today bets + settled past days for one downline. */
export async function getRebatePersonBets(params: {
  fromUserId: string;
  startDate?: string;
  endDate?: string;
  layer?: number | string;
  page?: number;
  limit?: number;
}): Promise<{
  success: true;
  data: RebatePersonBet[];
  total?: number;
  currentPage?: number;
  totalPages?: number;
}> {
  return request(`/user/rebate/person-bets${buildQuery(params)}`);
}

export type RebateGameCategory =
  | "LOTTERY"
  | "SLOTS"
  | "CASINO"
  | "SPORTS"
  | "RUMMY";

export interface RebateDailyLayerRow {
  layer: number;
  betAmount: number;
  rate: number;
  totalComm: number;
}

export interface RebateDailyCategoryBlock {
  category: RebateGameCategory;
  title: string;
  bettorCount: number;
  rebateLevel: number;
  betAmount: number;
  commissionPayout: number;
  layers: RebateDailyLayerRow[];
}

export interface RebateDailySummary {
  date: string;
  settlementTime: string;
  settled: boolean;
  hasData: boolean;
  bettorCount: number;
  totalBetAmount: number;
  totalCommission: number;
  rebateLevel: number;
  categories: RebateDailyCategoryBlock[];
}

/** One calendar day team-rebate settlement (Commission Details UI) */
export async function getRebateDaily(params: {
  date: string;
}): Promise<{ success: true; data: RebateDailySummary | null }> {
  return request(`/user/rebate/daily${buildQuery(params)}`);
}

export type RebateDayTotal = { date: string; total: number };

/** IST-day totals. Replaces paging every rebate row on commission / TX. */
export async function getRebateDayTotals(params?: {
  startDate?: string;
  endDate?: string;
  settled?: "true" | "false" | "all";
}): Promise<{ success: true; data: RebateDayTotal[] }> {
  return request(`/user/rebate/day-totals${buildQuery(params ?? {})}`);
}

export type RebatePersonRow = {
  fromUserId: string;
  username: string;
  serialNumber: number | null;
  layer: number;
  commission: number;
  betVolume: number;
  bets: number;
};

export type RebatePeoplePayload = {
  people: RebatePersonRow[];
  summary: {
    commission: number;
    betVolume: number;
    bets: number;
    bettors: number;
  };
  byDay: Array<{ date: string; commission: number }>;
  byLayer: Record<string, { commission: number; bet: number; users: number }>;
};

/** Collapsed Agent Commission list (GROUP BY downline). Expand still uses history. */
export async function getRebatePeople(params?: {
  startDate?: string;
  endDate?: string;
  settled?: string | boolean;
  layer?: number | string;
}): Promise<{ success: true; data: RebatePeoplePayload }> {
  return request(`/user/rebate/people${buildQuery(params ?? {})}`);
}

export async function getRebateRates(): Promise<{
  success: true;
  data: {
    lottery: { vipLevel: number; layer1: number; layer2: number; layer3: number; layer4: number; layer5: number; layer6: number }[];
    slots: { vipLevel: number; layer1: number; layer2: number; layer3: number; layer4: number; layer5: number; layer6: number }[];
    casino: { vipLevel: number; layer1: number; layer2: number; layer3: number; layer4: number; layer5: number; layer6: number }[];
    sports: { vipLevel: number; layer1: number; layer2: number; layer3: number; layer4: number; layer5: number; layer6: number }[];
    rummy: { vipLevel: number; layer1: number; layer2: number; layer3: number; layer4: number; layer5: number; layer6: number }[];
  };
}> {
  return request("/user/rebate/rates");
}

// ─── Self Rebate ─────────────────────────────────────────────────────────────

export interface SelfRebateCategorySummary {
  category: RebateGameCategory;
  title: string;
  betAmount: number;
  rebateAmount: number;
}

export interface SelfRebateSummary {
  todayRebate: number;
  totalRebate: number;
  rate: number;
  vipLevel?: number;
  settlementTime: string;
  categories: SelfRebateCategorySummary[];
}

export interface SelfRebateClaimResult {
  claimedAmount: number;
  claimedCount: number;
  newBalance: number;
}

export interface SelfRebateHistoryEntry {
  category: RebateGameCategory;
  title: string;
  date: string;
  betAmount: number;
  rate: number;
  rebateAmount: number;
  status: "Completed" | "Pending" | "Expired";
}

/** Today's self-rebate summary (rate from XP VIP) */
export async function getSelfRebateSummary(): Promise<{
  success: true;
  data: SelfRebateSummary;
}> {
  return request("/user/rebate/self/summary");
}

/** Claim all unclaimed self-rebates for today */
export async function claimSelfRebate(): Promise<{
  success: true;
  data: SelfRebateClaimResult;
}> {
  return request("/user/rebate/self/claim", { method: "POST" });
}

/** Paginated self-rebate history */
export async function getSelfRebateHistory(params?: {
  category?: RebateGameCategory;
  page?: number;
  limit?: number;
}): Promise<{
  success: true;
  data: SelfRebateHistoryEntry[];
  total: number;
  currentPage: number;
  totalPages: number;
}> {
  return request(`/user/rebate/self/history${buildQuery(params ?? {})}`);
}

export type AutoSalaryClaimStatus = "PENDING" | "APPROVED" | "REJECTED";

/** Auto-salary claim (admin generate → approve). Same record admin sees. */
export interface AutoSalaryClaimItem {
  id: string;
  amount: number;
  periodDate: string;
  status: AutoSalaryClaimStatus;
  slabIndex: number;
  directCount: number;
  activeCount: number;
  teamDeposit: number;
  rejectReason?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  note?: string;
}

/** Ledger row (transactions). Prefer APPROVED via creditedOnly=true. */
export interface SalaryPayment {
  id: string;
  amount: number;
  createdAt: string;
  note?: string;
  status?: AutoSalaryClaimStatus;
  periodDate?: string;
}

export interface SalaryEligibilityItem {
  id: string;
  title: string;
  ok: boolean;
  detail: string;
}

export interface SalarySlab {
  index: number;
  reward: number;
  direct: number;
  active: number;
  teamDeposit: number;
  unlocked: boolean;
}

export interface SalaryDashboardData {
  timezone: string;
  todayYmd: string;
  willReceive: number;
  /** Lifetime APPROVED auto-salary credited to wallet */
  totalReceived: number;
  pendingTotal: number;
  pendingCount: number;
  approvedCount: number;
  status: "eligible" | "on_hold" | "pending" | "paid" | "none";
  statusLabel: string;
  metrics: {
    direct: number;
    teamL1to6: number;
    active: number;
    yesterdaySalary: number;
    yesterdaySalaryStatus?: string | null;
    todayTeamDeposit: number;
    yesterdayTeamDeposit: number;
    dayBeforeTeamDeposit: number;
  };
  slabs: SalarySlab[];
  matchedSlab: {
    index: number;
    reward: number;
    direct: number;
    active: number;
    teamDeposit: number;
  } | null;
  nextSlab: {
    reward: number;
    directNeed: number;
    activeNeed: number;
    depositNeed: number;
  } | null;
  eligibility: SalaryEligibilityItem[];
  howto: { id: string; title: string; body: string }[];
  claim: {
    id: string;
    amount: number;
    status: string;
    periodDate: string;
    slabIndex?: number;
    directCount?: number;
    activeCount?: number;
    teamDeposit?: number;
    reviewedAt?: string | null;
    createdAt?: string;
  } | null;
  yesterdayClaim: {
    id: string;
    amount: number;
    status: string;
    periodDate: string;
    slabIndex?: number;
    directCount?: number;
    activeCount?: number;
    teamDeposit?: number;
    reviewedAt?: string | null;
    createdAt?: string;
  } | null;
}

export async function getSalary(params?: {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  status?: AutoSalaryClaimStatus | "ALL";
  /** true → only APPROVED (for transactions ledger) */
  creditedOnly?: boolean | string;
}): Promise<{
  success: true;
  claims: AutoSalaryClaimItem[];
  payments: SalaryPayment[];
  data?: SalaryPayment[];
  summary?: {
    totalReceived: number;
    totalAmount: number;
    pendingTotal: number;
    credits: number;
    pendingCount: number;
  };
} & Partial<Paginated>> {
  const q = {
    ...params,
    creditedOnly:
      params?.creditedOnly === true || params?.creditedOnly === "true"
        ? "true"
        : params?.creditedOnly === false || params?.creditedOnly === "false"
          ? "false"
          : undefined,
  };
  return request(`/user/salary${buildQuery(q)}`);
}

export async function getSalaryDashboard(): Promise<{
  success: true;
  data: SalaryDashboardData;
}> {
  return request("/user/salary/dashboard");
}

export interface DailyCommissionRow {
  date: string;
  totalCommission: number;
  layer1Commission: number;
  layer2Commission: number;
  layer3Commission: number;
  layer4Commission: number;
  layer5Commission: number;
  layer6Commission: number;
}

export interface CommissionRateRow {
  vipLevel: number;
  layer1: number;
  layer2: number;
  layer3: number;
  layer4: number;
  layer5: number;
  layer6: number;
}

export interface CommissionBreakdownSummary {
  totalCommission: number;
  byLayer: Record<string, number>;
  byGameType: Record<string, number>;
}

/** Strongly typed daily commission list */
export async function getCommissionDailyTyped(params?: {
  page?: number;
  limit?: number;
  date?: string;
}): Promise<{
  success: true;
  data: DailyCommissionRow[];
  total?: number;
  currentPage?: number;
  totalPages?: number;
}> {
  return request(`/user/commission/daily${buildQuery(params ?? {})}`);
}

export async function getCommissionBreakdownFull(params?: {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  layer?: number | string;
}): Promise<{
  success: true;
  data: CommissionBreakdownItem[];
  summary?: CommissionBreakdownSummary & { totalBetAmount?: number };
} & Partial<Paginated>> {
  return request(`/user/commission/breakdown${buildQuery(params ?? {})}`);
}

export async function getCommissionRatesTyped(): Promise<{
  success: true;
  data: CommissionRateRow[];
}> {
  return request("/user/commission/rates");
}

export async function submitQuery(opts: {
  type: "DEPOSIT" | "WITHDRAWAL" | "BANK_CHANGE" | "BONUS";
  subject: string;
  details: Record<string, unknown>;
}): Promise<{
  success: true;
  message: string;
  query: UserQuery;
}> {
  return request("/user/queries", {
    method: "POST",
    body: JSON.stringify(opts),
  });
}

export async function getQueries(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{ success: true; queries: UserQuery[] } & Partial<Paginated>> {
  return request(`/user/queries${buildQuery(params ?? {})}`);
}

// ─── Activity ────────────────────────────────────────────────────────────────

export async function getActivityBonuses(params?: {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
}): Promise<{ success: true; data: ActivityBonus[] } & Paginated> {
  return request(`/user/activity/bonuses${buildQuery(params ?? {})}`);
}

export async function claimActivityBonus(bonusId: string): Promise<{
  success: true;
  data: { bonus: ActivityBonus; newBalance?: number };
}> {
  return request("/user/activity/claim", {
    method: "POST",
    body: JSON.stringify({ bonusId }),
  });
}

export async function getActivityHistory(params?: {
  page?: number;
  limit?: number;
  type?: string;
}): Promise<{ success: true; data: ActivityBonus[] } & Paginated> {
  return request(`/user/activity/history${buildQuery(params ?? {})}`);
}

export interface ActivityTierProgress {
  tier?: number;
  requirement?: Record<string, number>;
  current?: Record<string, number>;
  reward?: number;
  completed?: boolean;
  claimed?: boolean;
}

export interface FirstDepositProgress {
  tiers?: Array<{
    tier?: number;
    requirement?: { deposit?: number };
    current?: { deposit?: number };
    reward?: number;
    eligible?: boolean;
    claimed?: boolean;
    /** True = not the max qualifying tier (locked after first deposit) */
    unavailable?: boolean;
    /** Backend bonus record id — used with claimActivityBonus() */
    bonusId?: string | null;
  }>;
  currentDeposit?: number;
  eligible?: boolean;
  claimed?: boolean;
  claimedTier?: number;
  /** Server flag: show home first-deposit popup */
  offerPopup?: boolean;
}

export async function getActivityProgress(): Promise<{
  success: true;
  data: {
    weekly?: ActivityTierProgress[];
    daily?: ActivityTierProgress[];
    invitation?: ActivityTierProgress[];
    firstDeposit?: FirstDepositProgress;
    attendance?: unknown;
    [key: string]: unknown;
  };
}> {
  return request("/user/activity/progress");
}

export interface SpinDepositRule {
  minDeposit: number;
  spinChances: number;
}

export interface SpinStatusData {
  availableSpins: number;
  dailyCumulativeDeposit?: number;
  freeSpinsPerDay?: number;
  rules?: SpinDepositRule[];
  prizes?: Array<{ amount: number }>;
}

export interface SpinHistoryItem {
  id: string;
  amount: number;
  claimAt: string | null;
  createdAt: string;
}

export async function getSpinStatus(): Promise<{
  success: true;
  data: SpinStatusData;
}> {
  return request("/user/activity/spin-wheel");
}

export async function getSpinHistory(params?: {
  page?: number;
  limit?: number;
}): Promise<{
  success: true;
  data: SpinHistoryItem[];
  total: number;
  currentPage: number;
  totalPages: number;
}> {
  return request(`/user/activity/spin-wheel/history${buildQuery(params ?? {})}`);
}

export async function spinWheel(): Promise<{
  success: true;
  data: {
    amount: number;
    /** Index of the wheel slice under the pointer (0 = top, clockwise) */
    sliceIndex?: number;
    newBalance: number;
    bonusId: string;
    availableSpins?: number;
  };
}> {
  return request("/user/activity/spin-wheel", { method: "POST", body: "{}" });
}

/** Lucky Spin (activity) — rupee prizes only; separate from Invite Wheel */
export async function getLuckySpinStatus(): Promise<{
  success: true;
  data: SpinStatusData;
}> {
  return request("/user/activity/lucky-spin");
}

export async function luckySpinWheel(): Promise<{
  success: true;
  data: {
    amount: number;
    sliceIndex?: number;
    newBalance: number;
    bonusId: string;
    availableSpins?: number;
  };
}> {
  return request("/user/activity/lucky-spin", { method: "POST", body: "{}" });
}

export async function getLuckySpinHistory(params?: {
  page?: number;
  limit?: number;
}): Promise<{
  success: true;
  data: SpinHistoryItem[];
  total: number;
  currentPage: number;
  totalPages: number;
}> {
  return request(`/user/activity/lucky-spin/history${buildQuery(params ?? {})}`);
}

export interface ActivityTierConfig {
  id: string;
  type: string;
  depositRequirement?: number | null;
  betRequirement?: number | null;
  inviteRequirement?: number | null;
  dayRequirement?: number | null;
  reward: number;
}

export async function getActivityTiers(params?: {
  type?: string;
}): Promise<{
  success: true;
  data:
    | ActivityTierConfig[]
    | {
        weekly?: ActivityTierConfig[];
        daily?: ActivityTierConfig[];
        [key: string]: unknown;
      };
}> {
  return request(`/user/activity/tiers${buildQuery(params ?? {})}`);
}

export interface WinStreakData {
  currentStreak: number;
  streakWinAmount?: number;
  lastBetGame?: string | null;
  lastBetAt?: string | null;
  rules?: Array<{
    id: string;
    consecutiveWins: number;
    bonusPercentage: number;
    isActive: boolean;
  }>;
  recentBonuses?: Array<{ id: string; amount: number; createdAt?: string }>;
}

export async function getWinStreak(): Promise<{ success: true; data: WinStreakData }> {
  return request("/user/activity/win-streak");
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export type DepositMethod = "CXPAY" | "UPI" | "XDPAY" | "OXAPAY";

/** Admin-configured USDT↔INR rates + recharge bonuses for deposit UI estimates */
export type PaymentRates = {
  success: true;
  /** INR credited per 1 USDT deposited */
  inrToUsdtPaymentConversionRate: number;
  inrToUsdtWithdrawalConversionRate: number;
  minDepositAmount: number;
  /** % of INR principal as INR_RECHARGE_BONUS (0 = off) */
  inrDepositBonusPercent?: number;
  /** % of USDT principal (after pay rate) as USDT_RECHARGE_BONUS */
  usdtDepositBonusPercent?: number;
};

export async function getPaymentRates(): Promise<PaymentRates> {
  return request("/payment/rates");
}

export type WithdrawInfo = {
  needToBet: number;
  depositWagerNeeded?: number;
  rewardWagerNeeded?: number;
  isWithdrawalFrozen?: boolean;
  totalRecharge: number;
  totalBets: number;
  wagerFactor: number;
  remainingWithdrawalsToday: number;
  maxWithdrawalsPerDay: number;
};

export async function getWithdrawInfo(): Promise<{
  success: true;
  data: WithdrawInfo;
}> {
  return request("/payment/withdraw/info");
}

export async function initiateDeposit(opts: {
  amount: number;
  method: DepositMethod;
}): Promise<{ success: true; payUrl?: string }> {
  return request("/payment/deposit", {
    method: "POST",
    body: JSON.stringify(opts),
  });
}

export async function initiateWithdraw(opts: {
  amount: number;
  /** BANK → CXPAY · UPI → UPI · USDT → OXAPAY */
  method: "CXPAY" | "XDPAY" | "UPI" | "OXAPAY";
  /** Required for OXAPAY (USDT) */
  cryptoChain?: "BEP20" | "TRC20";
  note?: string;
  /** Account login password (required) */
  password: string;
}): Promise<{ success: true }> {
  return request("/payment/withdraw", {
    method: "POST",
    body: JSON.stringify(opts),
  });
}

export async function cancelWithdraw(orderId: string): Promise<{
  success: true;
  message: string;
}> {
  return request("/payment/withdraw/cancel", {
    method: "POST",
    body: JSON.stringify({ orderId }),
  });
}

export async function getBank(): Promise<{ success: true; data: BankDetails }> {
  return request("/payment/bank");
}

export async function saveBank(data: BankSavePayload): Promise<{ success: true }> {
  return request("/payment/bank", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateBank(
  data: BankSavePayload
): Promise<{ success: true }> {
  return request("/payment/bank", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export interface GiftHistoryItem {
  id: string;
  code: string;
  amount: number;
  createdAt: string;
}

export async function redeemGift(code: string): Promise<{ success: true; amount?: number }> {
  return request("/redeem", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function getGiftHistory(): Promise<{ success: true; data: GiftHistoryItem[] }> {
  return request("/gift/history");
}

// ─── Inout (third-party games) ───────────────────────────────────────────────

export type InoutGameCategory =
  | "instant"
  | "crash_game"
  | "slots"
  | "roulette";

export type InoutGame = {
  id: string;
  title: string;
  gameMode: string;
  description: string;
  icon: string;
  category: InoutGameCategory | string;
  multiplayer: boolean;
  rtp: number;
  bonusTypes: string[];
  createdAt: string;
  updatedAt: string;
};

/** GET /inout/games */
export async function getInoutGames(params?: {
  page?: number;
  limit?: number;
  category?: InoutGameCategory | string;
  search?: string;
}): Promise<{
  success: true;
  data: InoutGame[];
  total: number;
  currentPage: number;
  totalPages: number;
}> {
  return request(`/inout/games${buildQuery(params ?? {})}`);
}

/** POST /inout/launch — body: { gameMode } */
export async function launchInout(gameMode: string): Promise<{
  success: true;
  gameUrl: string;
}> {
  return request("/inout/launch", {
    method: "POST",
    body: JSON.stringify({ gameMode }),
  });
}

// ─── Generic game helpers ────────────────────────────────────────────────────

type GamePrefix = "wingo" | "k3" | "5d" | "trxwingo" | "moto";

export async function getGamePeriods<T = WingoPeriod>(
  game: GamePrefix,
  params?: { duration?: number; page?: number; limit?: number }
): Promise<{
  success: true;
  periods: T[];
  currentPeriod?: T | null;
  total?: number;
  currentPage?: number;
  totalPages?: number;
}> {
  return request(`/${game}/periods${buildQuery(params ?? {})}`);
}

export async function getGameResults<T = WingoResult>(
  game: GamePrefix,
  params?: { duration?: number; page?: number; limit?: number }
): Promise<{
  success: true;
  results: T[];
  total?: number;
  currentPage?: number;
  totalPages?: number;
}> {
  return request(`/${game}/results${buildQuery(params ?? {})}`);
}

/** Single period result — GET /{game}/results/{periodId} */
export async function getGameResultByPeriod<T = WingoResult>(
  game: GamePrefix,
  periodId: string
): Promise<{ success: true; result?: T; data?: T } & Record<string, unknown>> {
  return request(`/${game}/results/${encodeURIComponent(periodId)}`);
}

export async function getGameBets<T = WingoBet>(
  game: GamePrefix,
  params?: Record<string, string | number | undefined | null>
): Promise<{
  success: true;
  bets: T[];
  total?: number;
  currentPage?: number;
  totalPages?: number;
}> {
  return request(`/${game}/bets${buildQuery(params ?? {})}`);
}

export async function placeWingoBet(opts: {
  periodId: string;
  betType: "COLOR" | "NUMBER" | "SIZE";
  betChoice: string;
  betAmount: number;
}): Promise<{ success: true; bet: WingoBet }> {
  return request("/wingo/bet", { method: "POST", body: JSON.stringify(opts) });
}

export async function placeTrxWingoBet(opts: {
  periodId: string;
  betType: "COLOR" | "NUMBER" | "SIZE";
  betChoice: string;
  betAmount: number;
}): Promise<{ success: true; bet: WingoBet }> {
  return request("/trxwingo/bet", { method: "POST", body: JSON.stringify(opts) });
}

export async function placeK3Bet(opts: {
  periodId: string;
  betType: string;
  betChoice: string;
  betAmount: number;
}): Promise<{ success: true; bet: WingoBet }> {
  return request("/k3/bet", { method: "POST", body: JSON.stringify(opts) });
}

export async function place5dBet(opts: {
  periodId: string;
  betCategory: "POSITION" | "SUM";
  betType: string;
  position?: string;
  betChoice: string;
  betAmount: number;
}): Promise<{ success: true; bet: FiveDBet }> {
  return request("/5d/bet", { method: "POST", body: JSON.stringify(opts) });
}

export async function placeMotoBet(opts: {
  periodId: string;
  betType: "POSITION" | "ODD_EVEN" | "BIG_SMALL";
  /** POSITION: "1"–"10"; ODD_EVEN: "odd"|"even"; BIG_SMALL: "big"|"small" */
  betChoice: string;
  targetPosition: "FIRST" | "SECOND" | "THIRD";
  betAmount: number;
}): Promise<{ success: true; bet: MotoBet }> {
  return request("/moto/bet", { method: "POST", body: JSON.stringify(opts) });
}

export async function healthCheck(): Promise<unknown> {
  return request("/health");
}
