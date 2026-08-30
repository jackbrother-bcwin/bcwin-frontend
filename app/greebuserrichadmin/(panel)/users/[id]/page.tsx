"use client";

/**
 * User 360° hub — profile, finance, bets, invite tree, moderation.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  IoArrowBack,
  IoCashOutline,
  IoGameControllerOutline,
  IoPeopleOutline,
  IoWalletOutline,
  IoCardOutline,
  IoStatsChartOutline,
  IoCalendarOutline,
} from "react-icons/io5";
import * as admin from "../../../../lib/admin-api";
import { useToast } from "../../../../components/ui/Toast";
import {
  Badge,
  EmptyBlock,
  LoadingBlock,
  PageTitle,
  Pagination,
  Surface,
} from "../../../components/ui";
import { AdminBarChart, AdminPieChart } from "../../../components/Charts";
import { TeamDayAnalysisPanel } from "../../../components/TeamDayAnalysis";
import { formatIstDateTime, latestSettledYmd } from "../../../../lib/ist-day";

type TabId =
  | "overview"
  | "userhub"
  | "deposits"
  | "withdrawals"
  | "bets"
  | "invite"
  | "bank"
  | "salary";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <IoStatsChartOutline size={14} /> },
  { id: "userhub", label: "User Hub", icon: <IoCalendarOutline size={14} /> },
  { id: "deposits", label: "Deposits", icon: <IoCashOutline size={14} /> },
  { id: "withdrawals", label: "Withdrawals", icon: <IoWalletOutline size={14} /> },
  { id: "bets", label: "Bets", icon: <IoGameControllerOutline size={14} /> },
  { id: "invite", label: "Invite tree", icon: <IoPeopleOutline size={14} /> },
  { id: "bank", label: "Bank", icon: <IoCardOutline size={14} /> },
  { id: "salary", label: "Salary", icon: <IoCashOutline size={14} /> },
];

function money(n: unknown) {
  return `₹${Number(n ?? 0).toLocaleString("en-IN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}`;
}

function fmtDate(iso: unknown) {
  return formatIstDateTime(iso);
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const initialTab = (searchParams.get("tab") as TabId) || "overview";
  const [tab, setTab] = useState<TabId>(
    TABS.some((t) => t.id === initialTab) ? initialTab : "overview"
  );

  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const [penaltyFactorInput, setPenaltyFactorInput] = useState("3");
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);

  // ── Salary State ──────────────────────────────────────────
  const [salaryRules, setSalaryRules] = useState<Array<Record<string, unknown>>>([]);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryActionId, setSalaryActionId] = useState<string | null>(null);
  const [salaryForm, setSalaryForm] = useState({
    amount: "500",
    frequency: "ONE_TIME",
    remark: "",
    immediateFirst: false,
    addToTurnover: false,
  });

  const handleUpdatePenalty = async (hasPenalty: boolean, factor?: number) => {
    setBusy(true);
    try {
      const res = await admin.updateUserPenalty(id, {
        hasIllegalBetPenalty: hasPenalty,
        illegalBetPenaltyFactor: factor,
      });
      toast(res.message || "Penalty updated", "success");
      setShowPenaltyModal(false);
      void loadUser();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to update penalty", "error");
    } finally {
      setBusy(false);
    }
  };

  const loadSalary = useCallback(async () => {
    if (!id) return;
    setSalaryLoading(true);
    try {
      const res = await admin.listSalaryRules({ userId: id, limit: 50 });
      setSalaryRules(res.rules ?? []);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load salary rules", "error");
    } finally {
      setSalaryLoading(false);
    }
  }, [id, toast]);

  // Lists
  const [deposits, setDeposits] = useState<Array<Record<string, unknown>>>([]);
  const [withdrawals, setWithdrawals] = useState<Array<Record<string, unknown>>>([]);
  const [bets, setBets] = useState<Array<Record<string, unknown>>>([]);
  const [listLoading, setListLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Invite
  const [invite, setInvite] = useState<{
    total: number;
    layerCounts: Record<string, number>;
    tree: Array<Record<string, unknown>>;
  } | null>(null);

  // User Hub — one completed IST day
  const maxTeamDate = useMemo(() => latestSettledYmd(), []);
  const [teamDate, setTeamDate] = useState(maxTeamDate);
  const [teamSort, setTeamSort] = useState<"deposit" | "withdrawal" | "bet">(
    "deposit"
  );
  const [teamPage, setTeamPage] = useState(1);
  const [teamAnalysis, setTeamAnalysis] = useState<admin.TeamDayAnalysis | null>(
    null
  );

  const stats = useMemo(
    () => (user?.stats as Record<string, unknown>) ?? {},
    [user]
  );
  const bank = (user?.bank as Record<string, unknown> | null) ?? null;

  const loadUser = useCallback(async () => {
    setLoading(true);
    try {
      const res = await admin.getUserDetails(id);
      setUser((res.user as Record<string, unknown>) ?? null);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  // This existing tab loader intentionally owns several independent list setters.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const loadTabData = useCallback(async () => {
    if (!id) return;
    setListLoading(true);
    try {
      if (tab === "deposits") {
        const res = await admin.listDeposits({ userId: id, page, limit: 15 });
        setDeposits(res.deposits ?? []);
        setTotalPages(res.totalPages ?? 1);
      } else if (tab === "withdrawals") {
        const res = await admin.listWithdrawals({
          userId: id,
          page,
          limit: 15,
        });
        setWithdrawals(res.withdrawals ?? []);
        setTotalPages(res.totalPages ?? 1);
      } else if (tab === "bets") {
        const res = await admin.listGameHistory({
          userId: id,
          page,
          limit: 20,
        });
        const raw =
          res.bets ??
          (res.data as { bets?: unknown[] } | undefined)?.bets ??
          (Array.isArray(res.data) ? res.data : []);
        setBets((raw as Array<Record<string, unknown>>) ?? []);
        const tp =
          (res as { totalPages?: number }).totalPages ??
          (res.data as { totalPages?: number } | undefined)?.totalPages ??
          1;
        setTotalPages(Number(tp) || 1);
      } else if (tab === "invite") {
        const res = await admin.getInviteTree({ userId: id });
        setInvite({
          total: res.total ?? 0,
          layerCounts: res.layerCounts ?? {},
          tree: res.tree ?? [],
        });
      } else if (tab === "salary") {
        await loadSalary();
      } else if (tab === "userhub") {
        const res = await admin.getUserTeamDayAnalysis(id, {
          date: teamDate,
          sortBy: teamSort,
          page: teamPage,
        });
        setTeamAnalysis(res);
      }
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load data", "error");
    } finally {
      setListLoading(false);
    }
  }, [id, tab, page, toast, loadSalary, teamDate, teamSort, teamPage]);

  useEffect(() => {
    if (tab === "overview" || tab === "bank") return;
    // Tab/date/page changes synchronize this client screen with the admin API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTabData();
  }, [tab, page, loadTabData]);

  useEffect(() => {
    // A newly selected tab starts its independent list at page one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [tab]);

  const setTabNav = (t: TabId) => {
    setTab(t);
    const url = `/greebuserrichadmin/users/${id}${t === "overview" ? "" : `?tab=${t}`}`;
    router.replace(url, { scroll: false });
  };

  const handleGiveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(salaryForm.amount);
    if (!amt || amt <= 0) {
      toast("Enter a valid positive amount", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await admin.createSalaryRule({
        userId: id,
        amount: amt,
        frequency: salaryForm.frequency,
        remark: salaryForm.remark.trim() || undefined,
        immediateFirst:
          salaryForm.frequency === "ONE_TIME" ? true : salaryForm.immediateFirst,
        addToTurnover: salaryForm.addToTurnover,
      });
      toast(res.message || "Salary credited / scheduled successfully", "success");
      setShowSalaryModal(false);
      setSalaryForm({
        amount: "500",
        frequency: "ONE_TIME",
        remark: "",
        immediateFirst: false,
        addToTurnover: false,
      });
      void loadUser();
      void loadSalary();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to process salary", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleSalary = async (ruleId: string, currentActive: boolean) => {
    setSalaryActionId(ruleId);
    try {
      await admin.toggleSalaryRule(ruleId, !currentActive);
      toast(
        currentActive ? "Salary rule stopped" : "Salary rule resumed",
        "success"
      );
      void loadSalary();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to toggle salary rule", "error");
    } finally {
      setSalaryActionId(null);
    }
  };

  const handleDeleteSalary = async (ruleId: string) => {
    if (!confirm("Delete this salary rule?")) return;
    try {
      await admin.deleteSalaryRule(ruleId);
      toast("Salary rule deleted", "success");
      void loadSalary();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to delete salary rule", "error");
    }
  };

  const adjust = async () => {
    const n = Number(amount);
    if (!n || Number.isNaN(n)) {
      toast("Enter a valid amount (+add / -subtract)", "error");
      return;
    }
    setBusy(true);
    try {
      await admin.updateUserBalance(id, {
        amount: n,
        reason: reason || undefined,
      });
      toast("Balance updated", "success");
      setAmount("");
      void loadUser();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleBan = async () => {
    setBusy(true);
    try {
      if (user?.isBanned) {
        await admin.unbanUser(id);
        toast("User unbanned", "success");
      } else {
        await admin.banUser(id, { reason: reason || "Admin ban" });
        toast("User banned", "success");
      }
      void loadUser();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const financeChart = useMemo(() => {
    return [
      {
        name: "Recharge",
        value: Number(stats.totalRecharge ?? 0),
      },
      {
        name: "Withdraw",
        value: Number(stats.totalWithdraw ?? 0),
      },
      {
        name: "Bets",
        value: Number(stats.totalBet ?? 0),
      },
      {
        name: "Commission",
        value: Number(stats.totalCommission ?? 0),
      },
    ].filter((x) => x.value > 0);
  }, [stats]);

  const teamChart = useMemo(() => {
    return [
      { name: "Direct", value: Number(stats.directDownlinksCount ?? 0) },
      {
        name: "All downline",
        value: Math.max(
          0,
          Number(stats.allDownlinksCount ?? 0) -
            Number(stats.directDownlinksCount ?? 0)
        ),
      },
    ].filter((x) => x.value > 0);
  }, [stats]);

  const betGamePie = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bets) {
      const g = String(b.gameName ?? b.majorGameType ?? b.game ?? "Other");
      map.set(g, (map.get(g) ?? 0) + Number(b.betAmount ?? b.amount ?? 0));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [bets]);

  if (loading) return <LoadingBlock label="Loading user…" />;
  if (!user) return <p className="text-sm text-slate-500">User not found</p>;

  return (
    <div className="min-w-0">
      <PageTitle
        title={String(user.username ?? "User")}
        subtitle={`${String(user.mobileNumber ?? "")} · #${String(user.serialNumber ?? "")}`}
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowSalaryModal(true)}
              className="admin-btn-primary text-xs"
            >
              Give Salary
            </button>
            <Link
              href={`/greebuserrichadmin/users/invite-tree?q=${encodeURIComponent(String(user.id))}`}
              className="admin-btn-ghost text-xs no-underline"
            >
              Open invite tree
            </Link>
            <button
              type="button"
              className="admin-btn-ghost text-xs inline-flex items-center gap-1"
              onClick={() => router.push("/greebuserrichadmin/users")}
            >
              <IoArrowBack size={14} /> Users
            </button>
          </div>
        }
      />

      {/* Identity strip */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="admin-card">
          <p className="text-xs text-white/80">Balance</p>
          <p className="mt-1 text-2xl font-black tabular-nums">
            {money(user.balance)}
          </p>
        </div>
        <div className="admin-surface p-4">
          <p className="text-xs text-slate-500">Role / VIP</p>
          <p className="font-bold">
            {String(user.role)} · VIP {String(stats.vipLevel ?? 0)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Demo: {user.isDemo ? "Yes" : "No"}
          </p>
        </div>
        <div className="admin-surface p-4">
          <p className="text-xs text-slate-500">Status & Penalty</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge status={user.isBanned ? "BANNED" : "ACTIVE"} />
            {user.hasIllegalBetPenalty ? (
              <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-500 ring-1 ring-inset ring-amber-500/20">
                {Number(user.illegalBetPenaltyFactor ?? 3)}x Wager Penalty
              </span>
            ) : (
              <span className="text-xs text-slate-400">No Penalty</span>
            )}
          </div>
          <p className="mt-2 break-all font-mono text-[10px] text-slate-400">
            {String(user.id)}
          </p>
        </div>
        <div className="admin-surface p-4">
          <p className="text-xs text-slate-500">Referral</p>
          <p className="truncate text-sm font-bold text-slate-800">
            {String(user.referralCode ?? "—")}
          </p>
          <p className="mt-1 truncate text-[11px] text-slate-400">
            By: {String(user.referredBy ?? "—")}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="mb-4 flex gap-1 overflow-x-auto no-scrollbar border-b border-slate-200 pb-px"
        role="tablist"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTabNav(t.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-t-lg px-3 py-2.5 text-[12px] font-bold transition-colors ${
                active
                  ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200 ring-b-white"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Overview ── */}
      {tab === "overview" && (
        <div className="space-y-4 admin-fade-up">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatMini label="Total recharge" value={money(stats.totalRecharge)} />
            <StatMini label="Total withdraw" value={money(stats.totalWithdraw)} />
            <StatMini label="Total bets" value={money(stats.totalBet)} />
            <StatMini
              label="Commission"
              value={money(stats.totalCommission)}
            />
            <StatMini
              label="Direct team"
              value={String(stats.directDownlinksCount ?? 0)}
            />
            <StatMini
              label="All downline"
              value={String(stats.allDownlinksCount ?? 0)}
            />
            <StatMini
              label="Direct recharge"
              value={money(stats.directRecharge)}
            />
            <StatMini
              label="Downline recharge"
              value={money(stats.downlinkRecharge)}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {financeChart.length > 0 && (
              <AdminBarChart
                title="User finance snapshot"
                data={financeChart}
                xKey="name"
                yKey="value"
                height={220}
              />
            )}
            {teamChart.length > 0 && (
              <AdminPieChart
                title="Team composition"
                data={teamChart}
                height={220}
              />
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Surface title="Adjust balance">
              <input
                className="admin-input mb-2"
                placeholder="Amount (+100 or -50)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <input
                className="admin-input mb-3"
                placeholder="Reason (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void adjust()}
                className="admin-btn-primary"
              >
                Update balance
              </button>
            </Surface>
            <Surface title="Moderation & Salary">
              <p className="mb-3 text-sm text-slate-600">
                Joined {fmtDate(user.createdAt)}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void toggleBan()}
                  className={
                    user.isBanned ? "admin-btn-success" : "admin-btn-danger"
                  }
                >
                  {user.isBanned ? "Unban user" : "Ban user"}
                </button>
                {user.hasIllegalBetPenalty ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleUpdatePenalty(false)}
                    className="admin-btn-secondary text-xs"
                  >
                    Clear penalty
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setPenaltyFactorInput(String(user.illegalBetPenaltyFactor ?? 3));
                    setShowPenaltyModal(true);
                  }}
                  className="admin-btn-secondary text-xs"
                >
                  {user.hasIllegalBetPenalty ? "Edit penalty factor" : "Set penalty factor"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSalaryModal(true)}
                  className="admin-btn-primary text-xs"
                >
                  Give salary
                </button>
                <button
                  type="button"
                  className="admin-btn-ghost text-xs"
                  onClick={() => setTabNav("salary")}
                >
                  View salary rules
                </button>
                <button
                  type="button"
                  className="admin-btn-ghost text-xs"
                  onClick={() => setTabNav("deposits")}
                >
                  View deposits
                </button>
                <button
                  type="button"
                  className="admin-btn-ghost text-xs"
                  onClick={() => setTabNav("bets")}
                >
                  View bets
                </button>
                <button
                  type="button"
                  className="admin-btn-ghost text-xs"
                  onClick={() => setTabNav("invite")}
                >
                  Invite tree
                </button>
              </div>
            </Surface>
          </div>
        </div>
      )}

      {/* ── Deposits ── */}
      {tab === "deposits" && (
        <DataTable
          loading={listLoading}
          empty="No deposits"
          page={page}
          totalPages={totalPages}
          onPage={setPage}
          columns={["Order", "Amount", "Method", "Status", "Time"]}
          rows={deposits.map((d) => [
            <span key="o" className="font-mono text-[11px]">
              {String(d.orderId ?? d.id ?? "—").slice(0, 18)}
            </span>,
            <b key="a">{money(d.amount)}</b>,
            String(d.method ?? "—"),
            <Badge key="s" status={String(d.status ?? "—")} />,
            fmtDate(d.createdAt),
          ])}
        />
      )}

      {/* ── Withdrawals ── */}
      {tab === "withdrawals" && (
        <DataTable
          loading={listLoading}
          empty="No withdrawals"
          page={page}
          totalPages={totalPages}
          onPage={setPage}
          columns={["Order", "Amount", "Method", "Status", "Time"]}
          rows={withdrawals.map((w) => [
            <span key="o" className="font-mono text-[11px]">
              {String(w.orderId ?? w.id ?? "—").slice(0, 18)}
            </span>,
            <b key="a">{money(w.amount)}</b>,
            String(w.method ?? "—"),
            <Badge key="s" status={String(w.status ?? "—")} />,
            fmtDate(w.createdAt),
          ])}
        />
      )}

      {/* ── Bets ── */}
      {tab === "bets" && (
        <div className="space-y-4">
          {!listLoading && betGamePie.length > 0 && (
            <AdminPieChart
              title="Stake by game (this page)"
              data={betGamePie}
              height={200}
            />
          )}
          <DataTable
            loading={listLoading}
            empty="No game bets"
            page={page}
            totalPages={totalPages}
            onPage={setPage}
            columns={[
              "Game",
              "Bet Amount",
              "Payout",
              "Result",
              "Status",
              "Time",
            ]}
            rows={bets.map((b) => [
              <span key="g" className="font-bold text-xs">
                {String(b.gameName ?? b.majorGameType ?? b.game ?? "—")}
              </span>,
              <span key="b">{money(b.betAmount ?? b.amount)}</span>,
              <span key="w" className="font-bold text-green-700">
                {money(b.winAmount ?? b.payout ?? 0)}
              </span>,
              <span key="r" className="text-xs">
                {String(b.result ?? b.selectType ?? "—")}
              </span>,
              <Badge key="s" status={String(b.status ?? "—")} />,
              fmtDate(b.createdAt),
            ])}
          />
        </div>
      )}

      {/* ── Invite tree ── */}
      {tab === "invite" && (
        <div className="space-y-4 admin-fade-up">
          {listLoading ? (
            <LoadingBlock />
          ) : !invite ? (
            <EmptyBlock label="No invite tree data" />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatMini label="Direct invites" value={String(invite.total)} />
                <StatMini
                  label="L1 count"
                  value={String(invite.layerCounts["1"] ?? invite.layerCounts["L1"] ?? 0)}
                />
                <StatMini
                  label="L2+ downline"
                  value={String(
                    Object.entries(invite.layerCounts)
                      .filter(([k]) => k !== "1" && k !== "L1")
                      .reduce((acc, [, v]) => acc + Number(v), 0)
                  )}
                />
              </div>

              <Surface title="Direct referrals (sample)">
                {!invite.tree.length ? (
                  <EmptyBlock label="No direct subordinates" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="admin-table text-xs">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Role</th>
                          <th>Joined</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {invite.tree.slice(0, 50).map((m) => {
                          const mid = String(m.id ?? "");
                          return (
                            <tr key={mid}>
                              <td>
                                <div className="font-bold">
                                  #{String(m.serialNumber ?? "—")}{" "}
                                  {String(m.username ?? "")}
                                </div>
                                <div className="font-mono text-slate-400">
                                  {String(m.mobileNumber ?? mid.slice(0, 8))}
                                </div>
                              </td>
                              <td>{String(m.role ?? "USER")}</td>
                              <td>{fmtDate(m.createdAt)}</td>
                              <td>
                                <Link
                                  href={`/greebuserrichadmin/users/${mid}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  Open hub →
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Surface>
            </>
          )}
        </div>
      )}

      {/* ── Salary ── */}
      {tab === "salary" && (
        <div className="space-y-4 admin-fade-up">
          <div className="flex justify-between items-center bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                Salary Rules & Schedules for #{String(user.serialNumber ?? "")} {String(user.username ?? "User")}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Active recurring schedules (Daily, Weekly, Monthly) and manual salary history.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSalaryModal(true)}
              className="admin-btn-primary text-xs"
            >
              + Give Salary to User
            </button>
          </div>

          <Surface title="Configured Salary Rules">
            {salaryLoading ? (
              <LoadingBlock label="Loading salary rules…" />
            ) : salaryRules.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500 mb-3">
                  No active or past salary rules configured for this user.
                </p>
                <button
                  type="button"
                  onClick={() => setShowSalaryModal(true)}
                  className="admin-btn-primary text-xs inline-flex items-center gap-1"
                >
                  Give First Salary
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Amount</th>
                      <th>Frequency</th>
                      <th>Remark</th>
                      <th>Status</th>
                      <th>Next Payment</th>
                      <th>Paid Count</th>
                      <th>Created</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaryRules.map((r) => {
                      const rid = String(r.id);
                      const isActive = Boolean(r.isActive);
                      const freq = String(r.frequency ?? "DAILY");
                      const remarkText = String(r.remark ?? "");

                      return (
                        <tr key={rid}>
                          <td className="font-bold text-slate-900">
                            ₹{Number(r.amount ?? 0).toLocaleString("en-IN")}
                          </td>
                          <td>
                            <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                              {freq}
                            </span>
                          </td>
                          <td className="text-xs max-w-[180px] truncate" title={remarkText || "None"}>
                            {remarkText ? (
                              <span className="font-medium text-slate-800">{remarkText}</span>
                            ) : (
                              <span className="text-slate-400 italic">None</span>
                            )}
                          </td>
                          <td>
                            {isActive ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                                ACTIVE
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                                STOPPED
                              </span>
                            )}
                          </td>
                          <td className="text-xs text-slate-500 whitespace-nowrap">
                            {isActive && freq !== "ONE_TIME" && r.nextPaymentAt ? (
                              formatIstDateTime(r.nextPaymentAt)
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="text-xs font-mono text-slate-700">
                            {String(r.paidCount ?? 0)}
                          </td>
                          <td className="text-xs text-slate-500 whitespace-nowrap">
                            {fmtDate(r.createdAt)}
                          </td>
                          <td className="text-right space-x-1.5 whitespace-nowrap">
                            {freq !== "ONE_TIME" && (
                              <button
                                type="button"
                                disabled={salaryActionId === rid}
                                onClick={() => void handleToggleSalary(rid, isActive)}
                                className={`rounded px-2 py-1 text-xs font-bold transition-colors ${
                                  isActive
                                    ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                              >
                                {salaryActionId === rid
                                  ? "…"
                                  : isActive
                                    ? "Stop"
                                    : "Resume"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleDeleteSalary(rid)}
                              className="rounded bg-red-50 px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Surface>
        </div>
      )}

      {/* ── User Hub — Daily Team Analysis ── */}
      {tab === "userhub" && (
        <div className="admin-fade-up">
          {listLoading ? (
            <LoadingBlock label="Loading team contribution…" />
          ) : !teamAnalysis ? (
            <EmptyBlock label="No team analysis available" />
          ) : (
            <TeamDayAnalysisPanel
              analysis={teamAnalysis}
              selectedDate={teamDate}
              maxDate={maxTeamDate}
              sortBy={teamSort}
              onDate={(date) => {
                setTeamPage(1);
                setTeamDate(date);
              }}
              onSort={(sort) => {
                setTeamPage(1);
                setTeamSort(sort);
              }}
              onPage={setTeamPage}
            />
          )}
        </div>
      )}

      {/* ── Bank ── */}
      {tab === "bank" && (
        <Surface title="Bank details">
          {!bank ? (
            <EmptyBlock label="No bank details on file" />
          ) : (
            <dl className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["Full name", bank.fullName],
                  ["Account", bank.bankAccount],
                  ["IFSC", bank.ifsc],
                  ["UPI", bank.upiId],
                  ["USDT TRC20", bank.trc20Address],
                  ["USDT BEP20", bank.bep20Address],
                ] as const
              ).map(([label, val]) => (
                <div key={label}>
                  <dt className="text-[11px] font-semibold text-slate-500">
                    {label}
                  </dt>
                  <dd className="break-all text-sm font-medium text-slate-800">
                    {String(val ?? "—")}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </Surface>
      )}

      {/* ── Give Salary Modal ── */}
      {showSalaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl admin-fade-up">
            <h3 className="text-lg font-bold text-slate-800">
              Give Salary to #{String(user.serialNumber ?? "")} {String(user.username ?? "User")}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Credit instant salary or create a recurring payout schedule.
            </p>

            <form className="mt-4 space-y-3" onSubmit={handleGiveSalary}>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={salaryForm.amount}
                    onChange={(e) =>
                      setSalaryForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    className="admin-input w-full"
                    placeholder="e.g. 500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Frequency
                  </label>
                  <select
                    value={salaryForm.frequency}
                    onChange={(e) =>
                      setSalaryForm((f) => ({
                        ...f,
                        frequency: e.target.value,
                      }))
                    }
                    className="admin-input w-full"
                  >
                    <option value="ONE_TIME">Instant One-Time</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly (7 days)</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="HOURLY">Hourly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Remark (Visible to user in transaction history)
                </label>
                <input
                  type="text"
                  value={salaryForm.remark}
                  onChange={(e) =>
                    setSalaryForm((f) => ({ ...f, remark: e.target.value }))
                  }
                  className="admin-input w-full"
                  placeholder="e.g. Weekly Agent Salary, Top performer reward"
                />
              </div>

              {salaryForm.frequency !== "ONE_TIME" && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="userSalaryImmediate"
                    checked={salaryForm.immediateFirst}
                    onChange={(e) =>
                      setSalaryForm((f) => ({
                        ...f,
                        immediateFirst: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="userSalaryImmediate"
                    className="text-xs text-slate-700 select-none"
                  >
                    Pay first cycle immediately to wallet balance
                  </label>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="userSalaryTurnover"
                  checked={salaryForm.addToTurnover}
                  onChange={(e) =>
                    setSalaryForm((f) => ({
                      ...f,
                      addToTurnover: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label
                  htmlFor="userSalaryTurnover"
                  className="text-xs text-slate-700 select-none"
                >
                  Count towards deposit / turnover calculation
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSalaryModal(false)}
                  className="admin-btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="admin-btn-primary text-xs"
                >
                  {busy
                    ? "Processing…"
                    : salaryForm.frequency === "ONE_TIME"
                      ? "Credit Salary Now"
                      : "Create Salary Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPenaltyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">
              Withdrawal Turnover Penalty
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Set the wager multiplier factor (e.g. 2, 3, 4) for this user&apos;s withdrawal requirements.
            </p>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700">
                Penalty Factor (x multiplier)
              </label>
              <input
                type="number"
                min="1"
                step="0.5"
                value={penaltyFactorInput}
                onChange={(e) => setPenaltyFactorInput(e.target.value)}
                className="admin-input mt-1 w-full"
                placeholder="e.g. 3"
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPenaltyModal(false)}
                className="admin-btn-ghost text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !Number(penaltyFactorInput)}
                onClick={() =>
                  void handleUpdatePenalty(true, Number(penaltyFactorInput))
                }
                className="admin-btn-primary text-xs"
              >
                Apply Penalty
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-surface p-3 sm:p-4">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black tabular-nums text-slate-800">
        {value}
      </p>
    </div>
  );
}

function DataTable({
  loading,
  empty,
  columns,
  rows,
  page,
  totalPages,
  onPage,
}: {
  loading: boolean;
  empty: string;
  columns: string[];
  rows: React.ReactNode[][];
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (loading) return <LoadingBlock />;
  if (!rows.length) return <EmptyBlock label={empty} />;
  return (
    <Surface>
      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, i) => (
              <tr key={i}>
                {cells.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} onPage={onPage} />
    </Surface>
  );
}
