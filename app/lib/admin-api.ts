/**
 * Admin API client — all /api/v1/admin/* endpoints
 * Auth: same auth-token cookie; requires ADMIN | SUB_ADMIN role
 */

const BASE = "/api/v1";

export class AdminApiError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

async function adminRequest<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = 20_000, ...fetchOpts } = options;
  const method = (fetchOpts.method ?? "GET").toUpperCase();
  const headers = new Headers(fetchOpts.headers);
  if (method !== "GET" && method !== "HEAD" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const ctrl = new AbortController();
  const external = fetchOpts.signal;
  const onAbort = () => ctrl.abort();
  external?.addEventListener("abort", onAbort);
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...fetchOpts,
      method,
      credentials: "include",
      headers,
      signal: ctrl.signal,
    });
  } catch {
    throw new AdminApiError(
      ctrl.signal.aborted && !external?.aborted
        ? "Request timed out"
        : "Network error. Check your connection."
    );
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", onAbort);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const rawText = await res.text().catch(() => "");
  let data: unknown = null;
  if (contentType.includes("application/json") || rawText.trim().startsWith("{")) {
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = { success: false, error: "Invalid JSON response" };
    }
  } else {
    data = { success: false, error: `HTTP ${res.status}` };
  }

  if (!res.ok) {
    const raw =
      data && typeof data === "object" && data !== null && "error" in data
        ? String((data as { error?: string }).error ?? "")
        : "";
    const msg = (raw || `Request failed (${res.status})`)
      .replace(/<[^>]*>/g, "")
      .slice(0, 200);
    throw new AdminApiError(msg, res.status);
  }
  return data as T;
}

function q(params: Record<string, string | number | boolean | undefined | null>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  }
  const str = s.toString();
  return str ? `?${str}` : "";
}

// ─── Overview & P/L ──────────────────────────────────────────────────────────

export async function getOverview() {
  return adminRequest<{ success: true; data: Record<string, unknown> }>("/admin/overview");
}

export async function getProfitLoss(dateFilter?: string) {
  return adminRequest<{ success: true; data: Record<string, unknown> }>(
    `/admin/profit-loss${q({ dateFilter })}`
  );
}

export async function getGameStatistics(params?: Record<string, string | number | undefined>) {
  return adminRequest<{ success: true; data: unknown }>(
    `/admin/profit-loss/game-statistics${q(params ?? {})}`
  );
}

export type TopPerformer = {
  userId?: string;
  username: string;
  mobile: string;
  status: string;
  totalDeposits: number;
  totalWithdrawals: number;
  totalBets: number;
  totalBetAmount: number;
  totalWon: number;
  bettingActivity: number;
  currentBalance: number;
  avgBetSize: number;
  activityScore: number;
  retentionRate: number;
  netProfit: number;
  winRate: number;
  roi: number;
  directDownlinksCount?: number;
  totalTeamSize?: number;
  teamTurnover?: number;
  teamDeposits?: number;
  teamWithdrawals?: number;
  teamBets?: number;
  totalCombinedTurnover?: number;
  totalCombinedDeposits?: number;
};

export type TopPerformanceResponse = {
  timeFilter: string;
  mode?: string;
  cardItems: {
    totalDeposits: number;
    totalWithdrawals: number;
    totalBets: number;
    totalTurnover: number;
    averageROI: number;
    avgWinRate: number;
    netProfit: number;
    totalTeamTurnover?: number;
    totalTeamDeposits?: number;
    totalTeamMembers?: number;
  };
  topPerformers: TopPerformer[];
};

export async function getTopPerformance(params?: Record<string, string | number | undefined>) {
  return adminRequest<{ success: true; data: TopPerformanceResponse }>(
    `/admin/top-performance${q(params ?? {})}`
  );
}

// ─── Set game results ────────────────────────────────────────────────────────

/** OpenAPI oneOf: wingo | k3 | 5d only */
export type SetResultBody =
  | { game: "wingo"; periodId: string; result: { number: number } }
  | {
      game: "k3";
      periodId: string;
      result: { dice1: number; dice2: number; dice3: number };
    }
  | {
      game: "5d";
      periodId: string;
      result: { resultNumber: string };
    };

export async function setResults(body: SetResultBody) {
  return adminRequest<{ success: true }>("/admin/setResults", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Admin-locked prediction for an active period (Redis), if any */
export async function getFixedResult(
  game: "wingo" | "k3" | "5d" | "moto",
  periodId: string
) {
  return adminRequest<{
    success: true;
    fixed:
      | { number: number }
      | { dice1: number; dice2: number; dice3: number }
      | { resultNumber: string }
      | { firstPlace: number; secondPlace: number; thirdPlace: number }
      | null;
  }>(`/admin/setResults/fixed${q({ game, periodId })}`);
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function listUsers(params?: {
  page?: number;
  limit?: number;
  search?: string;
  isBanned?: string;
  hasIllegalBetPenalty?: string;
  role?: string;
  isDemo?: string;
}) {
  return adminRequest<{
    success: true;
    users: Array<Record<string, unknown>>;
    total?: number;
    currentPage?: number;
    totalPages?: number;
  }>(`/admin/users/list${q(params ?? {})}`);
}

export async function getUserDetails(id: string) {
  return adminRequest<{ success: true; user: Record<string, unknown> }>(
    `/admin/users/${id}`
  );
}

export async function getUserYesterdayStats(id: string) {
  return adminRequest<{
    success: true;
    date: string;
    levels: Array<{
      level: string | number;
      memberCount: number;
      depositCount: number;
      depositAmount: number;
      withdrawCount: number;
      withdrawAmount: number;
      betCount: number;
      betAmount: number;
    }>;
  }>(`/admin/users/${id}/yesterday-stats`, { timeoutMs: 60_000 });
}

export type TeamDayMetric = {
  count: number;
  amount: number;
};

export type TeamDayMetricSet = {
  memberCount: number;
  deposit: TeamDayMetric;
  withdrawal: TeamDayMetric;
  bet: TeamDayMetric;
};

export type TeamDayLeg = Omit<TeamDayMetricSet, "deposit" | "withdrawal" | "bet"> & {
  id: string;
  username: string;
  mobileNumber: string;
  serialNumber: number;
  deposit: TeamDayMetric & { share: number };
  withdrawal: TeamDayMetric & { share: number };
  bet: TeamDayMetric & { share: number };
};

export type TeamDayAnalysis = {
  success: true;
  date: string;
  self: TeamDayMetricSet;
  team: TeamDayMetricSet;
  levels: Array<TeamDayMetricSet & { level: number }>;
  concentration: {
    isConcentrated: boolean;
    threshold: number;
    leader: {
      id: string;
      username: string;
      serialNumber: number;
      amount: number;
      share: number;
    } | null;
  };
  chart: Array<{
    id: string;
    label: string;
    amount: number;
    share: number;
    isOthers: boolean;
  }>;
  legs: TeamDayLeg[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  sortBy: "deposit" | "withdrawal" | "bet";
};

export async function getUserTeamDayAnalysis(
  id: string,
  params: {
    date: string;
    sortBy: "deposit" | "withdrawal" | "bet";
    page?: number;
  }
) {
  return adminRequest<TeamDayAnalysis>(
    `/admin/users/${id}/team-day-analysis${q({
      ...params,
      limit: 25,
    })}`,
    { timeoutMs: 60_000 }
  );
}

export async function updateUserPenalty(
  id: string,
  data: {
    hasIllegalBetPenalty: boolean;
    illegalBetPenaltyFactor?: number;
  }
) {
  return adminRequest<{
    success: true;
    message: string;
    user: {
      id: string;
      hasIllegalBetPenalty: boolean;
      illegalBetPenaltyFactor: number | null;
    };
  }>(`/admin/users/${id}/penalty`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function createUser(body: {
  username: string;
  mobileNumber: string;
  password: string;
  role?: "USER" | "AGENT" | "SUB_ADMIN" | "ADMIN";
  isDemo?: boolean;
  referredBy?: string;
  balance?: number;
}) {
  return adminRequest<{ success: true; user?: Record<string, unknown> }>(
    "/admin/users/create",
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

export async function updateUserBalance(
  id: string,
  body: { amount: number; reason?: string }
) {
  return adminRequest<{ success: true }>(`/admin/users/${id}/balance`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function banUser(id: string, body?: { reason?: string }) {
  return adminRequest<{ success: true }>(`/admin/users/${id}/ban`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export async function unbanUser(id: string) {
  return adminRequest<{ success: true }>(`/admin/users/${id}/unban`, {
    method: "POST",
    body: "{}",
  });
}

export async function getInviteTree(params?: {
  userId?: string;
  serialNumber?: string | number;
  mobile?: string;
  username?: string;
  search?: string;
  layer?: string | number;
}) {
  return adminRequest<{
    success: true;
    user: {
      id: string;
      serialNumber: number;
      username: string;
      mobileNumber: string;
      referralCode: string;
    };
    tree: Array<{
      id: string;
      serialNumber: number;
      username: string;
      mobileNumber: string;
      layer: number;
      referralCode: string;
      referredBy: string | null;
      createdAt: string;
    }>;
    total: number;
    layerCounts: Record<string, number>;
  }>(`/admin/users/invite-tree${q(params ?? {})}`);
}

// ─── Transactions ────────────────────────────────────────────────────────────

export async function listDeposits(params?: {
  page?: number;
  limit?: number;
  status?: string;
  method?: string;
  userId?: string;
}) {
  return adminRequest<{
    success: true;
    deposits: Array<Record<string, unknown>>;
    total?: number;
    currentPage?: number;
    totalPages?: number;
  }>(`/admin/transactions/deposit${q(params ?? {})}`);
}

export async function manageDeposit(body: {
  action: "approve" | "reject";
  orderId: string;
}) {
  return adminRequest<{ success: true; message: string }>(
    "/admin/transactions/deposit/manage",
    { method: "POST", body: JSON.stringify(body) }
  );
}

export async function listWithdrawals(params?: {
  page?: number;
  limit?: number;
  status?: string;
  userId?: string;
  method?: string;
}) {
  return adminRequest<{
    success: true;
    withdrawals: Array<Record<string, unknown>>;
    total?: number;
    currentPage?: number;
    totalPages?: number;
  }>(`/admin/transactions/withdraw${q(params ?? {})}`);
}

export async function manageWithdrawal(body: {
  action: "approve" | "reject";
  orderId: string;
  remark?: string;
}) {
  return adminRequest<{ success: true; message: string }>(
    "/admin/transactions/withdraw/manage",
    { method: "POST", body: JSON.stringify(body) }
  );
}

export async function listGameHistory(params?: Record<string, string | number | undefined>) {
  return adminRequest<{
    success: true;
    data?: unknown;
    bets?: unknown[];
    totalPages?: number;
  }>(`/admin/transactions/game-history${q(params ?? {})}`);
}

export async function listCommissionHistory(params?: Record<string, string | number | undefined>) {
  return adminRequest<{
    success: true;
    data?: unknown;
    commissions?: unknown[];
    totalPages?: number;
  }>(`/admin/transactions/commission-history${q(params ?? {})}`);
}

export async function listRebateHistory(params?: Record<string, string | number | undefined>) {
  return adminRequest<{
    success: true;
    data?: unknown;
    rebates?: unknown[];
    totalPages?: number;
  }>(`/admin/transactions/rebate-history${q(params ?? {})}`);
}

export async function listActivityBonusHistory(params?: Record<string, string | number | undefined>) {
  return adminRequest<{ success: true; data?: unknown }>(
    `/admin/transactions/activity-bonus-history${q(params ?? {})}`
  );
}

export async function listBalanceUpdates(params?: Record<string, string | number | undefined>) {
  return adminRequest<{
    success: true;
    data?: unknown;
    transactions?: unknown[];
    totalPages?: number;
  }>(`/admin/transactions/balance-update${q(params ?? {})}`);
}

// ─── Bank ────────────────────────────────────────────────────────────────────

export async function searchBank(params?: { search?: string; page?: number; limit?: number }) {
  return adminRequest<{
    success: true;
    user?: {
      id: string;
      serialNumber?: number;
      username?: string;
      mobileNumber?: string;
      bank?: Record<string, unknown> | null;
    } | null;
    data?: unknown;
  }>(`/admin/bank/search${q(params ?? {})}`);
}

export async function updateUserBank(userId: string, body: Record<string, unknown>) {
  return adminRequest<{ success: true; message?: string; bank?: Record<string, unknown> }>(
    `/admin/bank/${userId}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    }
  );
}

// ─── Queries / Support ───────────────────────────────────────────────────────

export async function listQueries(params?: {
  page?: number;
  limit?: number;
  status?: string;
  userId?: string;
  serialNumber?: number;
}) {
  return adminRequest<{
    success: true;
    queries: Array<Record<string, unknown>>;
    total?: number;
  }>(`/admin/queries${q(params ?? {})}`);
}

export async function updateQueryStatus(
  id: string,
  body: { status: string; adminNotes?: string }
) {
  return adminRequest<{ success: true; message: string }>(
    `/admin/queries/${id}/status`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
}

// ─── Gifts ───────────────────────────────────────────────────────────────────

export async function listGifts(body?: Record<string, unknown>) {
  return adminRequest<{ success: true; gifts?: unknown[]; data?: unknown }>(
    "/admin/gifts",
    { method: "POST", body: JSON.stringify(body ?? {}) }
  );
}

export async function createGift(body: Record<string, unknown>) {
  return adminRequest<{
    success: true;
    code: string;
    amount: number;
    totalRedeemable: number;
  }>("/admin/create", { method: "POST", body: JSON.stringify(body) });
}

export async function patchGiftActive(giftId: string, body: { isActive: boolean }) {
  return adminRequest<{ success: true }>(`/admin/${giftId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// ─── Agents & Sub-admins ─────────────────────────────────────────────────────

export async function listAgents(params?: Record<string, string | number | undefined>) {
  return adminRequest<{ success: true; agents?: unknown[]; data?: unknown }>(
    `/admin/agent/list${q(params ?? {})}`
  );
}

export async function createAgent(body: Record<string, unknown>) {
  return adminRequest<{ success: true }>("/admin/agent/create", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getAgent(identifier: string) {
  return adminRequest<{ success: true; data?: unknown }>(
    `/admin/agent/${encodeURIComponent(identifier)}`
  );
}

export async function getAgentPerformance(identifier: string) {
  return adminRequest<{ success: true; data?: unknown }>(
    `/admin/agent/${encodeURIComponent(identifier)}/performance`
  );
}

export async function listSubAdmins() {
  return adminRequest<{ success: true; data?: unknown }>("/admin/subadmin/list");
}

export async function createSubAdmin(body: Record<string, unknown>) {
  return adminRequest<{ success: true }>("/admin/subadmin/create", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ─── Config ──────────────────────────────────────────────────────────────────

export async function getConfig() {
  return adminRequest<{ success: true; config: Record<string, unknown> }>(
    "/admin/config"
  );
}

export async function updateConfig(body: Record<string, unknown>) {
  return adminRequest<{ success: true; message: string; config?: Record<string, unknown> }>(
    "/admin/config",
    { method: "PATCH", body: JSON.stringify(body) }
  );
}

export async function getCommissionRates() {
  return adminRequest<{ success: true; data?: unknown }>(
    "/admin/config/commission-rates"
  );
}

export async function updateCommissionRates(body: Record<string, unknown>) {
  return adminRequest<{ success: true }>("/admin/config/commission-rates", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function listNotifications() {
  return adminRequest<{ success: true; notifications?: unknown[]; data?: unknown }>(
    "/admin/config/notifications"
  );
}

export async function createNotification(body: Record<string, unknown>) {
  return adminRequest<{ success: true }>("/admin/config/notifications", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateNotification(id: string, body: Record<string, unknown>) {
  return adminRequest<{ success: true }>(`/admin/config/notifications/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteNotification(id: string) {
  return adminRequest<{ success: true }>(`/admin/config/notifications/${id}`, {
    method: "DELETE",
  });
}

// ─── VIP / Activity / Spin / Win streak ───────────────────────────────────────

/** Admin VIP rule — matches POST/PATCH /admin/vip-rules */
export type AdminVipRule = {
  id: string;
  level: number;
  expRequired: number;
  levelUpReward: number;
  monthlyReward: number;
  rebateRate: string | null;
  teamSize: number;
  teamBetting: number;
  teamDeposit: number;
  vipName: string | null;
  minBet: number | null;
  oneTimeBonus: number | null;
  monthlyBonus: number | null;
  rebatePercentage: number | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminVipRuleInput = {
  level: number;
  expRequired?: number;
  levelUpReward?: number;
  monthlyReward?: number;
  rebateRate?: string | null;
  teamSize?: number;
  teamBetting?: number;
  teamDeposit?: number;
  vipName?: string;
  minBet?: number;
  oneTimeBonus?: number;
  monthlyBonus?: number;
  rebatePercentage?: number;
};

export async function listVipRules() {
  return adminRequest<{ success: true; rules: AdminVipRule[] }>(
    "/admin/vip-rules"
  );
}

export async function createVipRule(body: AdminVipRuleInput) {
  return adminRequest<{ success: true; message: string; rule: AdminVipRule }>(
    "/admin/vip-rules",
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

export async function updateVipRule(
  id: string,
  body: Partial<AdminVipRuleInput>
) {
  return adminRequest<{ success: true; message: string; rule: AdminVipRule }>(
    `/admin/vip-rules/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    }
  );
}

export async function deleteVipRule(id: string) {
  return adminRequest<{ success: true; message: string }>(
    `/admin/vip-rules/${id}`,
    {
      method: "DELETE",
    }
  );
}

export async function listActivityTiers() {
  return adminRequest<{ success: true; data?: unknown }>(
    "/admin/activity-bonuses/tiers"
  );
}

export async function createActivityTier(body: Record<string, unknown>) {
  return adminRequest<{ success: true }>("/admin/activity-bonuses/tiers", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateActivityTier(id: string, body: Record<string, unknown>) {
  return adminRequest<{ success: true }>(`/admin/activity-bonuses/tiers/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteActivityTier(id: string) {
  return adminRequest<{ success: true }>(`/admin/activity-bonuses/tiers/${id}`, {
    method: "DELETE",
  });
}

export async function listLuckySpinRewards() {
  return adminRequest<{ success: true; data?: unknown }>("/admin/lucky-spin/rewards");
}

export async function createLuckySpinReward(body: Record<string, unknown>) {
  return adminRequest<{ success: true }>("/admin/lucky-spin/rewards", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateLuckySpinReward(id: string, body: Record<string, unknown>) {
  return adminRequest<{ success: true }>(`/admin/lucky-spin/rewards/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteLuckySpinReward(id: string) {
  return adminRequest<{ success: true }>(`/admin/lucky-spin/rewards/${id}`, {
    method: "DELETE",
  });
}

export async function listLuckySpinRules() {
  return adminRequest<{ success: true; data?: unknown }>("/admin/lucky-spin/rules");
}

export async function createLuckySpinRule(body: Record<string, unknown>) {
  return adminRequest<{ success: true }>("/admin/lucky-spin/rules", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateLuckySpinRule(id: string, body: Record<string, unknown>) {
  return adminRequest<{ success: true }>(`/admin/lucky-spin/rules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteLuckySpinRule(id: string) {
  return adminRequest<{ success: true }>(`/admin/lucky-spin/rules/${id}`, {
    method: "DELETE",
  });
}

export async function listWinStreakRules() {
  return adminRequest<{ success: true; data?: unknown }>("/admin/win-streak-rules");
}

export async function createWinStreakRule(body: Record<string, unknown>) {
  return adminRequest<{ success: true }>("/admin/win-streak-rules", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateWinStreakRule(id: string, body: Record<string, unknown>) {
  return adminRequest<{ success: true }>(`/admin/win-streak-rules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteWinStreakRule(id: string) {
  return adminRequest<{ success: true }>(`/admin/win-streak-rules/${id}`, {
    method: "DELETE",
  });
}

// ─── Salary ──────────────────────────────────────────────────────────────────

export async function listSalaryRules(params?: {
  page?: number;
  limit?: number;
  search?: string;
  userId?: string;
  status?: "ACTIVE" | "STOPPED" | "ALL" | string;
}) {
  return adminRequest<{
    success: true;
    rules: Array<Record<string, unknown>>;
    total: number;
    currentPage: number;
    totalPages: number;
  }>(`/admin/salary/list${q(params ?? {})}`);
}

export async function createSalaryRule(body: Record<string, unknown>) {
  return adminRequest<{ success: true; message?: string; rule?: Record<string, unknown> }>(
    "/admin/salary/create",
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

export async function updateSalaryRule(id: string, body: Record<string, unknown>) {
  return adminRequest<{ success: true; message?: string; rule?: Record<string, unknown> }>(
    `/admin/salary/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    }
  );
}

export async function toggleSalaryRule(id: string, isActive: boolean) {
  return updateSalaryRule(id, { isActive });
}

export async function deleteSalaryRule(id: string) {
  return adminRequest<{ success: true; message?: string }>(`/admin/salary/${id}`, {
    method: "DELETE",
  });
}

export async function getSalaryStatistics() {
  return adminRequest<{ success: true; data?: unknown; totalPaid?: number; activeRules?: number; totalUsers?: number }>(
    "/admin/salary/statistics"
  );
}

// ─── Auto salary slabs ───────────────────────────────────────────────────────

export async function listAutoSalarySlabs() {
  return adminRequest<{
    success: true;
    slabs: Array<{
      index: number;
      reward: number;
      direct: number;
      active: number;
      teamDeposit: number;
    }>;
  }>("/admin/salary/auto/slabs");
}

export async function generateAutoSalary(periodDate: string) {
  return adminRequest<{
    success: true;
    message: string;
    result: {
      periodDate: string;
      created: number;
      updated: number;
      skippedNoSlab: number;
      skippedApproved: number;
      evaluated: number;
    };
  }>("/admin/salary/auto/generate", {
    method: "POST",
    body: JSON.stringify({ periodDate }),
  });
}

export async function listAutoSalaryClaims(params?: {
  page?: number;
  limit?: number;
  status?: string;
  periodDate?: string;
  search?: string;
}) {
  return adminRequest<{
    success: true;
    claims: Array<Record<string, unknown>>;
    total: number;
    currentPage: number;
    totalPages: number;
  }>(`/admin/salary/auto/claims${q(params ?? {})}`);
}

export async function approveAutoSalaryClaim(id: string) {
  return adminRequest<{ success: true; message: string; amount: number }>(
    `/admin/salary/auto/claims/${id}/approve`,
    { method: "POST" }
  );
}

export async function rejectAutoSalaryClaim(id: string, reason?: string) {
  return adminRequest<{ success: true; message: string }>(
    `/admin/salary/auto/claims/${id}/reject`,
    {
      method: "POST",
      body: JSON.stringify(reason ? { reason } : {}),
    }
  );
}

// ─── Illegal bets & IP ───────────────────────────────────────────────────────

export async function listIllegalBets(params?: Record<string, string | number | undefined>) {
  return adminRequest<{ success: true; data?: unknown }>(
    `/admin/illegal-bets${q(params ?? {})}`
  );
}

export async function getIllegalBetsStats() {
  return adminRequest<{ success: true; data?: unknown }>(
    "/admin/illegal-bets/statistics"
  );
}

export async function listIps(params?: Record<string, string | number | undefined>) {
  return adminRequest<{ success: true; data?: unknown }>(
    `/admin/ip/list${q(params ?? {})}`
  );
}

export async function getIpStats() {
  return adminRequest<{ success: true; data?: unknown }>("/admin/ip/statistics");
}

export async function getIpDetails(ip: string) {
  return adminRequest<{ success: true; data?: unknown }>(
    `/admin/ip/${encodeURIComponent(ip)}`
  );
}

export async function blacklistIp(ip: string) {
  return adminRequest<{ success: true }>(
    `/admin/ip/${encodeURIComponent(ip)}/blacklist`,
    { method: "POST", body: "{}" }
  );
}

export async function whitelistIp(ip: string) {
  return adminRequest<{ success: true }>(
    `/admin/ip/${encodeURIComponent(ip)}/whitelist`,
    { method: "POST", body: "{}" }
  );
}

// ─── Turnover ────────────────────────────────────────────────────────────────

export async function listTurnover(params?: Record<string, string | number | undefined>) {
  return adminRequest<{ success: true; data?: unknown }>(
    `/admin/turnover${q(params ?? {})}`
  );
}

export async function adjustTurnover(
  identifier: string,
  body: Record<string, unknown>
) {
  return adminRequest<{ success: true }>(
    `/admin/turnover/${encodeURIComponent(identifier)}`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
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

/** GET /admin/update-inout-games — pull catalog from Inout into DB */
export async function updateInoutGames() {
  // Provider sync can take a while for full catalog
  return adminRequest<{ success: true }>("/admin/update-inout-games", {
    timeoutMs: 120_000,
  });
}

/** GET /inout/games — list DB catalog (paginated + filters) */
export async function listInoutGames(params?: {
  page?: number;
  limit?: number;
  category?: InoutGameCategory | "";
  search?: string;
}) {
  return adminRequest<{
    success: true;
    data: InoutGame[];
    total: number;
    currentPage: number;
    totalPages: number;
  }>(`/inout/games${q(params ?? {})}`);
}

// ─── Auth helpers (shared with player login cookie) ──────────────────────────

export async function adminLogin(mobileNumber: string, password: string) {
  return adminRequest<{ success: true; token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ mobileNumber, password }),
  });
}

export async function adminLogout() {
  return adminRequest<{ success: true }>("/auth/logout");
}

export async function adminGetMe() {
  return adminRequest<{
    success: true;
    user: {
      id: string;
      username: string;
      serialNumber: number;
      mobileNumber: string;
      balance: number;
      role: "USER" | "ADMIN" | "SUB_ADMIN" | "AGENT";
      referralCode: string;
      isBanned: boolean;
      isDemo: boolean;
      vipLevel: number;
    };
  }>("/user/user");
}
