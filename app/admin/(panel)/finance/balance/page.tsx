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

export default function BalanceUpdatesPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await admin.listBalanceUpdates({ page, limit: 30 });
      const list =
        (res as { transactions?: unknown }).transactions ??
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
        title="Balance updates"
        subtitle="Who was credited — same identity as Withdrawals"
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
                  <th>Amount</th>
                  <th>Reason</th>
                  <th>By</th>
                  <th>Time</th>
                  <th>Hub</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const u = (r.user ?? {}) as Record<string, unknown>;
                  const by = (r.by ?? {}) as Record<string, unknown>;
                  return (
                    <tr key={String(r.id)}>
                      <td>
                        <AdminUserCell
                          user={u}
                          bank={u.bank as { fullName?: string } | null}
                        />
                      </td>
                      <td className="font-semibold">
                        ₹{Number(r.amount ?? 0).toLocaleString("en-IN")}
                      </td>
                      <td className="max-w-[16rem] text-[12px] text-slate-600">
                        {String(r.reason ?? "—")}
                      </td>
                      <td className="text-[12px]">{String(by.username ?? "—")}</td>
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
