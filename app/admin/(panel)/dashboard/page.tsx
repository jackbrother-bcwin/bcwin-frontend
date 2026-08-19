"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as admin from "../../../lib/admin-api";
import { useAuthState } from "../../../context/AuthContext";
import { useToast } from "../../../components/ui/Toast";
import { LoadingBlock, PageTitle, RefreshBtn, StatCard } from "../../components/ui";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmt(v: unknown): string {
  const n = num(v);
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

export default function AdminDashboardPage() {
  const { user } = useAuthState();
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [pl, setPl] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, profit] = await Promise.all([
        admin.getOverview(),
        admin.getProfitLoss("today").catch(() => null),
      ]);
      setData((ov.data as Record<string, unknown>) ?? null);
      setPl((profit?.data as Record<string, unknown>) ?? null);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load overview", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const users = (data?.users as Record<string, unknown>) ?? {};
  const deposits = (data?.deposits as Record<string, unknown>) ?? {};
  const withdrawals = (data?.withdrawals as Record<string, unknown>) ?? {};
  const bets = (data?.bets as Record<string, unknown>) ?? {};
  const cards = (pl?.cardItems as Record<string, unknown>) ?? {};

  const today = new Date().toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (loading && !data) return <LoadingBlock label="Loading dashboard…" />;

  return (
    <div>
      <PageTitle
        title={`Hi, ${user?.username ?? "Admin"}!`}
        subtitle={`${today} · real USERs · SUCCESS recharge / withdraw`}
        action={<RefreshBtn onClick={load} loading={loading} />}
      />

      <div className="admin-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Today User Join" value={num(users.todayCount)} />
        <StatCard
          label="Today's Recharge"
          value={fmt(deposits.todayAmount)}
          hint="SUCCESS only"
          onClick={() => router.push("/admin/finance/deposits?status=SUCCESS")}
        />
        <StatCard
          label="Today's Withdrawal"
          value={fmt(withdrawals.todayAmount)}
          hint="SUCCESS only"
          onClick={() => router.push("/admin/finance/withdrawals?status=SUCCESS")}
        />
        <StatCard
          label="User Balance"
          value={fmt(users.totalBalance)}
          hint="See in Detail"
          onClick={() => router.push("/admin/users")}
        />
        <StatCard
          label="Total Users"
          value={num(users.totalCount)}
          hint="See in Detail"
          onClick={() => router.push("/admin/users")}
        />
        <StatCard
          label="Pending Recharge"
          value={fmt(deposits.pendingAmount ?? deposits.processingAmount)}
          hint="See in Detail"
          onClick={() => router.push("/admin/finance/deposits?status=PROCESSING")}
        />
        <StatCard
          label="Success Recharge"
          value={fmt(deposits.successAmount ?? deposits.totalSuccessAmount)}
          hint="See in Detail"
          onClick={() => router.push("/admin/finance/deposits?status=SUCCESS")}
        />
        <StatCard
          label="Total Withdrawal"
          value={fmt(withdrawals.successAmount ?? withdrawals.totalSuccessAmount)}
          hint="See in Detail"
          onClick={() => router.push("/admin/finance/withdrawals")}
        />
        <StatCard
          label="Withdrawal Requests"
          value={fmt(withdrawals.pendingAmount ?? withdrawals.processingAmount)}
          hint="See in Detail"
          onClick={() => router.push("/admin/finance/withdrawals?status=PROCESSING")}
        />
        <StatCard
          label="Today's total bet"
          value={fmt(bets.todayTotalBet ?? cards.totalInvested)}
        />
        <StatCard
          label="Today's total win"
          value={fmt(bets.todayTotalWin ?? cards.totalWon)}
        />
        <StatCard
          label="Today's profit"
          value={fmt(bets.todayProfit ?? cards.netPL)}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="admin-surface p-5 admin-fade-up">
          <h3 className="mb-3 text-sm font-bold text-slate-700">Quick actions</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { href: "/admin/games/wingo", label: "Set WinGo result" },
              { href: "/admin/finance/deposits", label: "Approve deposits" },
              { href: "/admin/finance/withdrawals", label: "Process withdrawals" },
              { href: "/admin/support/queries", label: "Support tickets" },
              { href: "/admin/gifts", label: "Create gift" },
              { href: "/admin/config", label: "Platform config" },
            ].map((a) => (
              <button
                key={a.href}
                type="button"
                onClick={() => router.push(a.href)}
                className="admin-btn-primary text-xs"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <div className="admin-surface p-5 admin-fade-up">
          <h3 className="mb-3 text-sm font-bold text-slate-700">Platform snapshot</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex justify-between">
              <span>Active users (7d)</span>
              <strong>{fmt(users.activeCount)}</strong>
            </li>
            <li className="flex justify-between">
              <span>Total bets (today P/L)</span>
              <strong>{fmt(cards.totalBets)}</strong>
            </li>
            <li className="flex justify-between">
              <span>Wins / Losses</span>
              <strong>
                {fmt(cards.totalWins)} / {fmt(cards.totalLosses)}
              </strong>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
