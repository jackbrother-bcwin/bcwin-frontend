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
  IoOpenOutline,
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

type TabId =
  | "overview"
  | "deposits"
  | "withdrawals"
  | "bets"
  | "invite"
  | "bank";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <IoStatsChartOutline size={14} /> },
  { id: "deposits", label: "Deposits", icon: <IoCashOutline size={14} /> },
  { id: "withdrawals", label: "Withdrawals", icon: <IoWalletOutline size={14} /> },
  { id: "bets", label: "Bets", icon: <IoGameControllerOutline size={14} /> },
  { id: "invite", label: "Invite tree", icon: <IoPeopleOutline size={14} /> },
  { id: "bank", label: "Bank", icon: <IoCardOutline size={14} /> },
];

function money(n: unknown) {
  return `₹${Number(n ?? 0).toLocaleString("en-IN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}`;
}

function fmtDate(iso: unknown) {
  if (!iso) return "—";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

  const stats = (user?.stats as Record<string, unknown>) ?? {};
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
      }
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load data", "error");
    } finally {
      setListLoading(false);
    }
  }, [id, tab, page, toast]);

  useEffect(() => {
    if (tab === "overview" || tab === "bank") return;
    void loadTabData();
  }, [tab, page, loadTabData]);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  const setTabNav = (t: TabId) => {
    setTab(t);
    const url = `/admin/users/${id}${t === "overview" ? "" : `?tab=${t}`}`;
    router.replace(url, { scroll: false });
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
            <Link
              href={`/admin/users/invite-tree?q=${encodeURIComponent(String(user.id))}`}
              className="admin-btn-ghost text-xs no-underline"
            >
              Open invite tree
            </Link>
            <button
              type="button"
              className="admin-btn-ghost text-xs inline-flex items-center gap-1"
              onClick={() => router.push("/admin/users")}
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
            <Surface title="Moderation">
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
            empty="No bets found"
            page={page}
            totalPages={totalPages}
            onPage={setPage}
            columns={["Game", "Bet", "Win", "Status", "Time"]}
            rows={bets.map((b, i) => [
              String(b.gameName ?? b.majorGameType ?? b.game ?? "—"),
              money(b.betAmount ?? b.amount),
              money(b.winAmount ?? b.win),
              <Badge
                key={i}
                status={String(b.status ?? (b.isWin ? "WON" : "LOST"))}
              />,
              fmtDate(b.createdAt),
            ])}
          />
        </div>
      )}

      {/* ── Invite ── */}
      {tab === "invite" && (
        <div className="space-y-4">
          {listLoading ? (
            <LoadingBlock />
          ) : !invite ? (
            <EmptyBlock label="Could not load invite tree" />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatMini label="Total downline" value={String(invite.total)} />
                <StatMini
                  label="Direct (L1)"
                  value={String(invite.layerCounts["1"] ?? 0)}
                />
                <StatMini
                  label="Layers filled"
                  value={String(Object.keys(invite.layerCounts).length)}
                />
              </div>
              {Object.keys(invite.layerCounts).length > 0 && (
                <AdminBarChart
                  title="Members per layer"
                  data={Object.entries(invite.layerCounts)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([layer, count]) => ({
                      name: `L${layer}`,
                      count: Number(count),
                    }))}
                  xKey="name"
                  yKey="count"
                  height={200}
                />
              )}
              <Surface
                title="Downline list"
                action={
                  <Link
                    href={`/admin/users/invite-tree?q=${encodeURIComponent(id)}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 no-underline"
                  >
                    Full tree <IoOpenOutline size={12} />
                  </Link>
                }
              >
                {invite.tree.length === 0 ? (
                  <EmptyBlock label="No downline members" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Layer</th>
                          <th>User</th>
                          <th>Mobile</th>
                          <th>Serial</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {invite.tree.slice(0, 50).map((m) => (
                          <tr key={String(m.id)}>
                            <td>L{String(m.layer)}</td>
                            <td className="font-semibold">
                              {String(m.username)}
                            </td>
                            <td>{String(m.mobileNumber)}</td>
                            <td className="font-mono">
                              #{String(m.serialNumber)}
                            </td>
                            <td>
                              <Link
                                href={`/admin/users/${m.id}`}
                                className="text-xs font-bold text-blue-600"
                              >
                                Open
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {invite.tree.length > 50 && (
                      <p className="mt-2 text-center text-[11px] text-slate-400">
                        Showing first 50 of {invite.tree.length}. Open full tree
                        for more.
                      </p>
                    )}
                  </div>
                )}
              </Surface>
            </>
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
