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
import { AdminPieChart, AdminBarChart } from "../../../components/Charts";

function DepositsInner() {
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
      const res = await admin.listDeposits({ page, limit: 30, status: status || undefined });
      setRows(res.deposits ?? []);
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
    () => rows.filter((r) => String(r.status) === "PROCESSING"),
    [rows]
  );

  const bulk = async (action: "approve" | "reject", orderIds: string[]) => {
    if (!orderIds.length) return;
    if (!confirm(`${action.toUpperCase()} ${orderIds.length} deposits?`)) return;
    setBusy(true);
    let ok = 0;
    let fail = 0;
    for (const orderId of orderIds) {
      try {
        await admin.manageDeposit({ orderId, action });
        ok++;
      } catch {
        fail++;
      }
    }
    toast(`${action}: ${ok} ok, ${fail} failed`, fail ? "error" : "success");
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

  const byMethod = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const s = String(r.method ?? "OTHER");
      m.set(s, (m.get(s) ?? 0) + 1);
    }
    return [...m.entries()].map(([name, count]) => ({ name, count }));
  }, [rows]);

  return (
    <div>
      <PageTitle
        title="Deposits"
        subtitle="Bulk approve / reject pending recharges"
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
            onClick: () => bulk(
              "approve",
              processable.map((r) => String(r.orderId))
            ),
          },
          {
            label: `Reject ALL pending (${processable.length})`,
            variant: "danger",
            icon: "close",
            disabled: busy || !processable.length,
            onClick: () => bulk(
              "reject",
              processable.map((r) => String(r.orderId))
            ),
          },
        ]}
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <AdminPieChart data={pie} title="Amount by status (page)" />
        <AdminBarChart data={byMethod} xKey="name" yKey="count" title="Count by method" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {["", "PROCESSING", "SUCCESS", "FAILED"].map((s) => (
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
                        setSelected(
                          e.target.checked
                            ? new Set(rows.map((r) => String(r.orderId)))
                            : new Set()
                        )
                      }
                    />
                  </th>
                  <th>Order ID</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const orderId = String(r.orderId ?? "");
                  const st = String(r.status ?? "");
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
                      <td className="font-semibold">₹{Number(r.amount ?? 0).toLocaleString("en-IN")}</td>
                      <td>{String(r.method ?? "—")}</td>
                      <td><Badge status={st} /></td>
                      <td className="text-[11px] text-slate-500">
                        {r.createdAt ? new Date(String(r.createdAt)).toLocaleString() : "—"}
                      </td>
                      <td>
                        {st === "PROCESSING" && (
                          <div className="flex gap-1">
                            <button type="button" disabled={busy} onClick={() => bulk("approve", [orderId])} className="admin-btn-success text-[11px]">Approve</button>
                            <button type="button" disabled={busy} onClick={() => bulk("reject", [orderId])} className="admin-btn-danger text-[11px]">Reject</button>
                          </div>
                        )}
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

export default function DepositsPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <DepositsInner />
    </Suspense>
  );
}
