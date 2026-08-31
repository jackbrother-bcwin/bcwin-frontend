"use client";

import React, { useCallback, useEffect, useState } from "react";
import * as admin from "../../../lib/admin-api";
import { useToast } from "../../../components/ui/Toast";
import { AdminHubLink, AdminUserCell } from "../../components/AdminUserCell";
import {
  Badge,
  EmptyBlock,
  LoadingBlock,
  PageTitle,
  RefreshBtn,
  Surface,
  TableWrap,
} from "../../components/ui";

type SortMode = "balance" | "withdrawals";

function money(value: number): string {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function TopUsersPage() {
  const { toast } = useToast();
  const [sort, setSort] = useState<SortMode>("balance");
  const [rows, setRows] = useState<admin.RankedAdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await admin.getTopAdminUsers(sort);
      setRows(response.users);
    } catch (error: unknown) {
      toast(
        error instanceof Error ? error.message : "Failed to load top users",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [sort, toast]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initialTimer);
  }, [load]);

  return (
    <div>
      <PageTitle
        title="Top 100 users"
        subtitle="Real users only · successful withdrawals only"
        action={<RefreshBtn onClick={load} loading={loading} />}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["balance", "Highest balance"],
            ["withdrawals", "Most withdrawn"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setSort(value)}
            className={
              sort === value
                ? "admin-btn-primary text-xs"
                : "admin-btn-ghost text-xs"
            }
          >
            {label}
          </button>
        ))}
      </div>

      <Surface>
        {loading ? (
          <LoadingBlock label="Ranking users…" />
        ) : rows.length === 0 ? (
          <EmptyBlock label="No users found for this ranking" />
        ) : (
          <TableWrap>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>User</th>
                  <th>Current balance</th>
                  <th>Successful withdrawals</th>
                  <th>Withdraw count</th>
                  <th>Status</th>
                  <th>Hub</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.user.id}>
                    <td className="text-base font-black tabular-nums text-blue-600">
                      #{row.rank}
                    </td>
                    <td>
                      <AdminUserCell user={row.user} bank={row.user.bank} />
                    </td>
                    <td
                      className={`font-bold tabular-nums ${
                        sort === "balance" ? "text-blue-700" : "text-slate-700"
                      }`}
                    >
                      ₹{money(row.balance)}
                    </td>
                    <td
                      className={`font-bold tabular-nums ${
                        sort === "withdrawals"
                          ? "text-blue-700"
                          : "text-slate-700"
                      }`}
                    >
                      ₹{money(row.successfulWithdrawAmount)}
                    </td>
                    <td className="tabular-nums text-slate-600">
                      {row.successfulWithdrawCount.toLocaleString("en-IN")}
                    </td>
                    <td>
                      <Badge status={row.isBanned ? "BANNED" : "ACTIVE"} />
                    </td>
                    <td>
                      <AdminHubLink userId={row.user.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Surface>
    </div>
  );
}
