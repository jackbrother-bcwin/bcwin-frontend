"use client";

import React, { useCallback, useEffect, useState } from "react";
import * as admin from "../../../../lib/admin-api";
import { useToast } from "../../../../components/ui/Toast";
import {
  Badge,
  EmptyBlock,
  LoadingBlock,
  PageTitle,
  Pagination,
  RefreshBtn,
  Surface,
} from "../../../components/ui";
import { AdminHubLink, AdminUserCell } from "../../../components/AdminUserCell";

export default function GameHistoryPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await admin.listGameHistory({ page, limit: 30 });
      setRows((res.bets as Array<Record<string, unknown>>) ?? []);
      setTotalPages(Number((res as { totalPages?: number }).totalPages) || 1);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageTitle
        title="Game history"
        subtitle="Who bet — same identity as Withdrawals"
        action={<RefreshBtn onClick={load} loading={loading} />}
      />
      <Surface>
        {loading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyBlock />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Game</th>
                  <th>Bet</th>
                  <th>Win</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Hub</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const u = (r.user ?? {}) as Record<string, unknown>;
                  return (
                    <tr key={String(r.id)}>
                      <td>
                        <AdminUserCell
                          user={u}
                          bank={u.bank as { fullName?: string } | null}
                        />
                      </td>
                      <td>{String(r.gameName ?? r.majorGameType ?? "—")}</td>
                      <td className="font-semibold">
                        ₹{Number(r.betAmount ?? 0).toLocaleString("en-IN")}
                      </td>
                      <td>₹{Number(r.winAmount ?? 0).toLocaleString("en-IN")}</td>
                      <td>
                        <Badge status={String(r.status ?? "")} />
                      </td>
                      <td className="text-[11px] text-slate-500">
                        {r.createdAt
                          ? new Date(String(r.createdAt)).toLocaleString()
                          : "—"}
                      </td>
                      <td>
                        <AdminHubLink userId={String(u.id ?? "")} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} onPage={setPage} />
      </Surface>
    </div>
  );
}
