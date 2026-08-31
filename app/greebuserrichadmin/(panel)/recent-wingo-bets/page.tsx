"use client";

import React, { useCallback, useEffect, useState } from "react";
import * as admin from "../../../lib/admin-api";
import { useToast } from "../../../components/ui/Toast";
import { formatIstDateTime } from "../../../lib/ist-day";
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

function money(value: number): string {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function durationLabel(seconds: number): string {
  return seconds < 60 ? `${seconds}s` : `${seconds / 60} min`;
}

export default function RecentWingoBetsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<admin.SettledWingoBet[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await admin.getRecentSettledWingoBets();
      setRows(response.bets);
    } catch (error: unknown) {
      toast(
        error instanceof Error ? error.message : "Failed to load WinGo bets",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initialTimer);
  }, [load]);

  return (
    <div>
      <PageTitle
        title="Last 50 settled WinGo bets"
        subtitle="Real users only · newest settlements first"
        action={<RefreshBtn onClick={load} loading={loading} />}
      />

      <Surface>
        {loading ? (
          <LoadingBlock label="Loading settled bets…" />
        ) : rows.length === 0 ? (
          <EmptyBlock label="No settled WinGo bets found" />
        ) : (
          <TableWrap>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>User</th>
                  <th>Period</th>
                  <th>Bet</th>
                  <th>Amount</th>
                  <th>Draw result</th>
                  <th>Bet result</th>
                  <th>Win amount</th>
                  <th>Settled</th>
                  <th>Hub</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="font-semibold tabular-nums text-slate-400">
                      {index + 1}
                    </td>
                    <td>
                      <AdminUserCell user={row.user} bank={row.user.bank} />
                    </td>
                    <td>
                      <p className="font-mono text-[11px] text-slate-700">
                        {row.periodNumber}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-400">
                        WinGo {durationLabel(row.durationSeconds)}
                      </p>
                    </td>
                    <td>
                      <p className="text-xs font-bold text-slate-700">
                        {row.betChoice}
                      </p>
                      <p className="text-[10px] text-slate-400">{row.betType}</p>
                    </td>
                    <td className="font-bold tabular-nums">
                      ₹{money(row.betAmount)}
                    </td>
                    <td>
                      <p className="font-bold tabular-nums text-slate-800">
                        {row.resultNumber ?? "—"}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {[row.resultColor, row.resultSize].filter(Boolean).join(" · ") ||
                          "—"}
                      </p>
                    </td>
                    <td>
                      <Badge status={row.status} />
                    </td>
                    <td
                      className={`font-bold tabular-nums ${
                        row.winAmount > 0 ? "text-emerald-600" : "text-slate-400"
                      }`}
                    >
                      ₹{money(row.winAmount)}
                    </td>
                    <td className="whitespace-nowrap text-[11px] text-slate-500">
                      {formatIstDateTime(row.settledAt)}
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
