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
import { formatIstDateTime } from "../../../../lib/ist-day";

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
  const [rejectOrderIds, setRejectOrderIds] = useState<string[]>([]);
  const [rejectRemark, setRejectRemark] = useState("");

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
    // Initial/filtered page fetch is the external synchronization for this screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const processable = useMemo(
    () => rows.filter((r) => String(r.status) === "GENERATED"),
    [rows]
  );

  const bulk = async (
    action: "approve" | "reject",
    orderIds: string[],
    remark?: string
  ) => {
    if (!orderIds.length) return;
    if (
      action === "approve" &&
      !confirm(`APPROVE ${orderIds.length} withdrawals?`)
    )
      return;
    setBusy(true);
    let ok = 0;
    let fail = 0;
    for (const orderId of orderIds) {
      try {
        await admin.manageWithdrawal({
          orderId,
          action,
          ...(action === "reject" && remark?.trim()
            ? { remark: remark.trim() }
            : {}),
        });
        ok++;
      } catch {
        fail++;
      }
    }
    toast(`${action}: ${ok} ok · ${fail} failed`, fail ? "error" : "success");
    setBusy(false);
    await load();
  };

  const openReject = (orderIds: string[]) => {
    if (!orderIds.length) return;
    setRejectOrderIds(orderIds);
    setRejectRemark("");
  };

  const submitReject = async () => {
    const orderIds = rejectOrderIds;
    await bulk("reject", orderIds, rejectRemark);
    setRejectOrderIds([]);
    setRejectRemark("");
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
            onClick: () => openReject(selectedProcessable),
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
            onClick: () =>
              openReject(processable.map((r) => String(r.orderId))),
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
                  <th>Generated at</th>
                  <th>Remark</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const orderId = String(r.orderId ?? "");
                  const st = String(r.status ?? "");
                  const can = st === "GENERATED";
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
                            if (e.target.checked) n.add(orderId);
                            else n.delete(orderId);
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
                      <td className="whitespace-nowrap text-[11px] text-slate-500">
                        {formatIstDateTime(r.createdAt)}
                      </td>
                      <td className="max-w-[220px] text-xs text-slate-600">
                        <span className="line-clamp-2" title={String(r.note ?? "")}>
                          {String(r.note ?? "—")}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1">
                          <AdminHubLink userId={uid} />
                          {can && (
                            <>
                              <button type="button" disabled={busy} onClick={() => bulk("approve", [orderId])} className="admin-btn-success text-[11px]">Approve</button>
                              <button type="button" disabled={busy} onClick={() => openReject([orderId])} className="admin-btn-danger text-[11px]">Reject</button>
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

      {rejectOrderIds.length > 0 && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-withdrawal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setRejectOrderIds([]);
          }}
        >
          <form
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onSubmit={(e) => {
              e.preventDefault();
              void submitReject();
            }}
          >
            <h2
              id="reject-withdrawal-title"
              className="text-lg font-bold text-slate-900"
            >
              Reject {rejectOrderIds.length} withdrawal
              {rejectOrderIds.length === 1 ? "" : "s"}?
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              The amount will be refunded. This remark will be visible to the
              user in Withdrawal history.
            </p>
            <label className="mt-4 block text-xs font-semibold text-slate-600">
              Rejection remark (optional)
            </label>
            <textarea
              className="admin-input mt-1 min-h-28 resize-y"
              maxLength={300}
              autoFocus
              placeholder="Example: Account holder name does not match"
              value={rejectRemark}
              onChange={(e) => setRejectRemark(e.target.value)}
            />
            <p className="mt-1 text-right text-[11px] text-slate-400">
              {rejectRemark.length}/300
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="admin-btn-ghost"
                disabled={busy}
                onClick={() => setRejectOrderIds([])}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="admin-btn-danger"
                disabled={busy}
              >
                {busy ? "Rejecting…" : "Reject and refund"}
              </button>
            </div>
          </form>
        </div>
      )}
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
