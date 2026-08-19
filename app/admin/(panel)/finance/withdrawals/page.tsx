"use client";

import React, { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
import BulkBar from "../../../components/BulkBar";
import { AdminPieChart } from "../../../components/Charts";
import { AdminHubLink, AdminUserCell } from "../../../components/AdminUserCell";

function WithdrawalsInner() {
  const { toast } = useToast();
  const sp = useSearchParams();
  const [status, setStatus] = useState(sp.get("status") ?? "");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await admin.listWithdrawals({ page, limit: 30, status: status || undefined });
      setRows(res.withdrawals ?? []);
      setTotalPages(res.totalPages ?? 1);
      setSelected(new Set());
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }, [page, status, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const processable = useMemo(
    () => rows.filter((r) => ["GENERATED", "PROCESSING"].includes(String(r.status))),
    [rows]
  );

  const bulk = async (action: "approve" | "reject", orderIds: string[]) => {
    if (!orderIds.length) return;
    if (!confirm(`${action.toUpperCase()} ${orderIds.length} withdrawals?`)) return;
    setBusy(true);
    let ok = 0;
    let fail = 0;
    for (const orderId of orderIds) {
      try {
        await admin.manageWithdrawal({ orderId, action });
        ok++;
      } catch {
        fail++;
      }
    }
    toast(`${action}: ${ok} ok · ${fail} failed`, fail ? "error" : "success");
    setBusy(false);
    load();
  };

  const selectedProcessable = [...selected].filter((id) =>
    processable.some((r) => String(r.orderId) === id)
  );

  const pie = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const s = String(r.status ?? "OTHER");
      m.set(s, (m.get(s) ?? 0) + Number(r.amount ?? 0));
    }
    return [...m.entries()].map(([name, value]) => ({ name, value }));
  }, [rows]);

  return (
    <div>
      <PageTitle
        title="Withdrawals"
        subtitle="See who applied, then approve / reject"
        action={<RefreshBtn onClick={load} loading={loading} />}
      />

      <BulkBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        actions={[
          {
            label: `Approve selected (${selectedProcessable.length})`,
            variant: "success",
            icon: "check",
            disabled: busy || !selectedProcessable.length,
            onClick: () => bulk("approve", selectedProcessable),
          },
          {
            label: `Reject selected (${selectedProcessable.length})`,
            variant: "danger",
            icon: "close",
            disabled: busy || !selectedProcessable.length,
            onClick: () => bulk("reject", selectedProcessable),
          },
          {
            label: `Approve ALL pending (${processable.length})`,
            variant: "primary",
            icon: "check",
            disabled: busy || !processable.length,
            onClick: () => bulk("approve", processable.map((r) => String(r.orderId))),
          },
          {
            label: `Reject ALL pending (${processable.length})`,
            variant: "danger",
            icon: "close",
            disabled: busy || !processable.length,
            onClick: () => bulk("reject", processable.map((r) => String(r.orderId))),
          },
        ]}
      />

      <div className="mb-4 max-w-md">
        <AdminPieChart data={pie} title="Withdrawal amount by status" height={220} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {["", "GENERATED", "PROCESSING", "SUCCESS", "FAILED"].map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => { setStatus(s); setPage(1); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${status === s ? "bg-blue-600 text-white" : "bg-white text-slate-600 shadow-sm"}`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      <Surface>
        {loading ? <LoadingBlock /> : rows.length === 0 ? <EmptyBlock /> : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={selected.size === rows.length && rows.length > 0}
                      onChange={(e) =>
                        setSelected(e.target.checked ? new Set(rows.map((r) => String(r.orderId))) : new Set())
                      }
                    />
                  </th>
                  <th>Order ID</th>
                  <th>User</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const orderId = String(r.orderId ?? "");
                  const st = String(r.status ?? "");
                  const can = ["GENERATED", "PROCESSING"].includes(st);
                  const u = (r.user ?? {}) as Record<string, unknown>;
                  const uid = String(u.id ?? r.userId ?? "");
                  return (
                    <tr key={String(r.id)}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(orderId)}
                          onChange={(e) => {
                            const n = new Set(selected);
                            e.target.checked ? n.add(orderId) : n.delete(orderId);
                            setSelected(n);
                          }}
                        />
                      </td>
                      <td className="font-mono text-[11px]">{orderId}</td>
                      <td>
                        <AdminUserCell
                          user={u}
                          bank={r.bank as { fullName?: string } | null}
                        />
                      </td>
                      <td className="font-semibold">₹{Number(r.amount ?? 0).toLocaleString("en-IN")}</td>
                      <td>{String(r.method ?? "—")}</td>
                      <td><Badge status={st} /></td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1">
                          <AdminHubLink userId={uid} />
                          {can && (
                            <>
                              <button type="button" disabled={busy} onClick={() => bulk("approve", [orderId])} className="admin-btn-success text-[11px]">Approve</button>
                              <button type="button" disabled={busy} onClick={() => bulk("reject", [orderId])} className="admin-btn-danger text-[11px]">Reject</button>
                            </>
                          )}
                        </div>
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

export default function WithdrawalsPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <WithdrawalsInner />
    </Suspense>
  );
}
