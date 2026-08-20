"use client";

import React, { useCallback, useEffect, useState } from "react";
import * as admin from "../../../../lib/admin-api";
import { useToast } from "../../../../components/ui/Toast";
import {
  EmptyBlock,
  LoadingBlock,
  PageTitle,
  Pagination,
  RefreshBtn,
  Surface,
} from "../../../components/ui";
import { AdminHubLink, AdminUserCell } from "../../../components/AdminUserCell";
import { formatIstDateTime } from "../../../../lib/ist-day";

export default function CommissionHistoryPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await admin.listCommissionHistory({ page, limit: 30 });
      const list =
        (res as { commissions?: unknown }).commissions ??
        (res as { data?: unknown }).data;
      setRows(Array.isArray(list) ? (list as Array<Record<string, unknown>>) : []);
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
        title="Commission history"
        subtitle="Receiver and downline — same identity as Withdrawals"
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
                  <th>Receiver</th>
                  <th>From</th>
                  <th>L</th>
                  <th>Amount</th>
                  <th>Bet</th>
                  <th>Game</th>
                  <th>Time</th>
                  <th>Hub</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const u = (r.user ?? {}) as Record<string, unknown>;
                  const from = (r.fromUser ?? {}) as Record<string, unknown>;
                  return (
                    <tr key={String(r.id)}>
                      <td>
                        <AdminUserCell
                          user={u}
                          bank={u.bank as { fullName?: string } | null}
                        />
                      </td>
                      <td>
                        <AdminUserCell
                          user={from}
                          bank={from.bank as { fullName?: string } | null}
                        />
                      </td>
                      <td>{String(r.layer ?? "—")}</td>
                      <td className="font-semibold">
                        ₹{Number(r.commissionAmount ?? 0).toLocaleString("en-IN")}
                      </td>
                      <td>₹{Number(r.betAmount ?? 0).toLocaleString("en-IN")}</td>
                      <td>{String(r.betType ?? "—")}</td>
                      <td className="text-[11px] text-slate-500">
                        {formatIstDateTime(r.createdAt)}
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
