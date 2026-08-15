"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as admin from "../../../lib/admin-api";
import { useToast } from "../../../components/ui/Toast";
import {
  EmptyBlock,
  LoadingBlock,
  PageTitle,
  RefreshBtn,
  Surface,
  StatCard,
} from "../../components/ui";
import BulkBar from "../../components/BulkBar";
import { AdminPieChart } from "../../components/Charts";

type Tab = "manual" | "auto";

function todayIstYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatMoney(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

export default function SalaryPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("auto");

  // ── Manual rules ────────────────────────────────────────────
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    number: "",
    amount: "500",
    frequency: "DAILY",
    maxPayments: "30",
  });
  const [busy, setBusy] = useState(false);

  // ── Auto slabs ──────────────────────────────────────────────
  const [slabs, setSlabs] = useState<
    Array<{
      index: number;
      reward: number;
      direct: number;
      active: number;
      teamDeposit: number;
    }>
  >([]);
  const [claims, setClaims] = useState<Array<Record<string, unknown>>>([]);
  const [claimsTotal, setClaimsTotal] = useState(0);
  const [claimStatus, setClaimStatus] = useState<string>("");
  const [periodDate, setPeriodDate] = useState(todayIstYmd);
  const [claimSearch, setClaimSearch] = useState("");
  const [autoLoading, setAutoLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadManual = useCallback(async () => {
    setLoading(true);
    try {
      const [list, st] = await Promise.all([
        admin.listSalaryRules(),
        admin.getSalaryStatistics().catch(() => ({ data: null })),
      ]);
      const raw = list as { rules?: unknown; data?: unknown };
      const d = raw.rules ?? raw.data;
      setRows(Array.isArray(d) ? (d as Array<Record<string, unknown>>) : []);
      const stRaw = st as { data?: unknown; totalPaid?: number };
      setStats(
        (stRaw.data as Record<string, unknown>) ??
          (typeof stRaw.totalPaid === "number"
            ? (st as Record<string, unknown>)
            : null)
      );
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadAuto = useCallback(async () => {
    setAutoLoading(true);
    try {
      const [slabRes, claimRes] = await Promise.all([
        admin.listAutoSalarySlabs(),
        admin.listAutoSalaryClaims({
          page: 1,
          limit: 100,
          status: claimStatus || undefined,
          periodDate: periodDate || undefined,
          search: claimSearch || undefined,
        }),
      ]);
      setSlabs(slabRes.slabs ?? []);
      setClaims(claimRes.claims ?? []);
      setClaimsTotal(claimRes.total ?? 0);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load auto salary", "error");
    } finally {
      setAutoLoading(false);
    }
  }, [toast, claimStatus, periodDate, claimSearch]);

  useEffect(() => {
    if (tab === "manual") void loadManual();
    else void loadAuto();
  }, [tab, loadManual, loadAuto]);

  const pie = ["HOURLY", "DAILY", "MONTHLY", "ONE_TIME"]
    .map((f) => ({
      name: f,
      value: rows.filter((r) => String(r.frequency) === f).length,
    }))
    .filter((x) => x.value > 0);

  const pendingCount = useMemo(
    () => claims.filter((c) => c.status === "PENDING").length,
    [claims]
  );

  const startEdit = (r: Record<string, unknown>) => {
    setEditId(String(r.id));
    setForm({
      number: String(r.number ?? r.mobileNumber ?? ""),
      amount: String(r.amount ?? "0"),
      frequency: String(r.frequency ?? "DAILY"),
      maxPayments: String(r.maxPayments ?? "30"),
    });
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm({ number: "", amount: "500", frequency: "DAILY", maxPayments: "30" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        number: form.number,
        amount: Number(form.amount),
        frequency: form.frequency,
        maxPayments: Number(form.maxPayments),
      };
      if (editId) {
        await admin.updateSalaryRule(editId, body);
        toast("Salary rule updated", "success");
      } else {
        await admin.createSalaryRule(body);
        toast("Salary rule created", "success");
      }
      cancelEdit();
      loadManual();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const runGenerate = async () => {
    if (!periodDate) {
      toast("Pick a date", "error");
      return;
    }
    if (!confirm(`Generate auto salary claims for ${periodDate} (IST)?`)) return;
    setGenerating(true);
    try {
      const res = await admin.generateAutoSalary(periodDate);
      toast(
        res.message ||
          `Created ${res.result.created}, updated ${res.result.updated}`,
        "success"
      );
      await loadAuto();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Generate failed", "error");
    } finally {
      setGenerating(false);
    }
  };

  const approve = async (id: string) => {
    if (!confirm("Approve and credit this salary to user balance?")) return;
    setActionId(id);
    try {
      const res = await admin.approveAutoSalaryClaim(id);
      toast(res.message || "Approved", "success");
      await loadAuto();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Approve failed", "error");
    } finally {
      setActionId(null);
    }
  };

  const reject = async (id: string) => {
    const reason = window.prompt("Reject reason (optional)") ?? undefined;
    setActionId(id);
    try {
      await admin.rejectAutoSalaryClaim(id, reason || undefined);
      toast("Rejected", "success");
      await loadAuto();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Reject failed", "error");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div>
      <PageTitle
        title="Salary"
        subtitle="Manual rules · automatic slabs"
        action={
          <RefreshBtn
            onClick={() => (tab === "manual" ? loadManual() : loadAuto())}
          />
        }
      />

      <div className="mb-4 flex gap-2 border-b border-slate-200">
        {(
          [
            { id: "auto" as const, label: "Auto slabs" },
            { id: "manual" as const, label: "Manual rules" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-bold border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "auto" ? (
        <>
          <p className="mb-3 text-xs text-slate-600 leading-relaxed max-w-3xl">
            Highest slab fully met is paid. Metrics: <strong>direct invites</strong>{" "}
            (L1) · <strong>active members</strong> (all downline with ≥1 deposit) ·{" "}
            <strong>one-day team deposit</strong> (all downline, IST day). Demo
            accounts are never counted in downline or as recipients.
          </p>

          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Period (IST)
              </label>
              <input
                type="date"
                className="admin-input"
                value={periodDate}
                onChange={(e) => setPeriodDate(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="admin-btn-primary"
              disabled={generating}
              onClick={runGenerate}
            >
              {generating ? "Generating…" : "Generate claims"}
            </button>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Status
              </label>
              <select
                className="admin-input"
                value={claimStatus}
                onChange={(e) => setClaimStatus(e.target.value)}
              >
                <option value="">All</option>
                <option value="PENDING">PENDING</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Search user
              </label>
              <input
                className="admin-input"
                placeholder="Serial / username / mobile"
                value={claimSearch}
                onChange={(e) => setClaimSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="admin-btn-ghost"
              onClick={() => loadAuto()}
            >
              Apply filters
            </button>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <StatCard label="Claims shown" value={claimsTotal} />
            <StatCard label="Pending (page)" value={pendingCount} />
            <StatCard label="Slabs" value={slabs.length} />
          </div>

          <Surface title="Slab table (reference)" className="mb-4">
            <div className="overflow-x-auto">
              <table className="admin-table text-xs">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Reward</th>
                    <th>Direct</th>
                    <th>Active</th>
                    <th>Team deposit (day)</th>
                  </tr>
                </thead>
                <tbody>
                  {slabs.map((s) => (
                    <tr key={s.index}>
                      <td>{s.index + 1}</td>
                      <td className="font-bold">{formatMoney(s.reward)}</td>
                      <td>{s.direct}</td>
                      <td>{s.active}</td>
                      <td>{formatMoney(s.teamDeposit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Surface>

          <Surface title="Claims">
            {autoLoading ? (
              <LoadingBlock />
            ) : claims.length === 0 ? (
              <EmptyBlock />
            ) : (
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Period</th>
                      <th>Amount</th>
                      <th>Direct</th>
                      <th>Active</th>
                      <th>Team dep.</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {claims.map((c) => {
                      const id = String(c.id);
                      const user = c.user as
                        | {
                            serialNumber?: number;
                            username?: string;
                            mobileNumber?: string;
                          }
                        | undefined;
                      const status = String(c.status);
                      return (
                        <tr key={id}>
                          <td className="text-xs">
                            <div className="font-bold">
                              #{user?.serialNumber ?? "—"} {user?.username ?? ""}
                            </div>
                            <div className="text-slate-500 font-mono">
                              {user?.mobileNumber ?? String(c.userId).slice(0, 8)}
                            </div>
                          </td>
                          <td className="text-xs whitespace-nowrap">
                            {String(c.periodDate).slice(0, 10)}
                          </td>
                          <td className="font-bold">{formatMoney(Number(c.amount))}</td>
                          <td>{String(c.directCount)}</td>
                          <td>{String(c.activeCount)}</td>
                          <td>{formatMoney(Number(c.teamDeposit))}</td>
                          <td>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                status === "APPROVED"
                                  ? "bg-green-100 text-green-800"
                                  : status === "REJECTED"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {status}
                            </span>
                          </td>
                          <td className="space-x-2 whitespace-nowrap">
                            {status === "PENDING" && (
                              <>
                                <button
                                  type="button"
                                  className="text-xs font-bold text-green-700"
                                  disabled={actionId === id}
                                  onClick={() => approve(id)}
                                >
                                  {actionId === id ? "…" : "Approve"}
                                </button>
                                <button
                                  type="button"
                                  className="text-xs font-bold text-red-600"
                                  disabled={actionId === id}
                                  onClick={() => reject(id)}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Surface>
        </>
      ) : (
        <>
          <BulkBar
            count={selected.size}
            onClear={() => setSelected(new Set())}
            actions={[
              {
                label: "Delete selected",
                variant: "danger",
                icon: "trash",
                onClick: async () => {
                  if (!confirm(`Delete ${selected.size} salary rules?`)) return;
                  await Promise.all(
                    [...selected].map((id) => admin.deleteSalaryRule(id))
                  );
                  toast("Deleted", "success");
                  setSelected(new Set());
                  loadManual();
                },
              },
            ]}
          />
          {stats && (
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              {Object.entries(stats)
                .filter(([, v]) => typeof v === "number")
                .slice(0, 6)
                .map(([k, v]) => (
                  <StatCard key={k} label={k} value={Number(v)} />
                ))}
            </div>
          )}
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <AdminPieChart data={pie} title="Rules by frequency" />
            <Surface title={editId ? "Edit salary rule" : "Create salary rule"}>
              {editId && (
                <p className="mb-2 text-xs text-blue-600 font-semibold">
                  Editing #{editId.slice(0, 8)}…{" "}
                  <button type="button" className="underline" onClick={cancelEdit}>
                    Cancel
                  </button>
                </p>
              )}
              <form className="space-y-2" onSubmit={submit}>
                <input
                  className="admin-input"
                  placeholder="Mobile number"
                  value={form.number}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, number: e.target.value }))
                  }
                  required={!editId}
                  disabled={!!editId}
                />
                <input
                  className="admin-input"
                  placeholder="Amount"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: e.target.value }))
                  }
                />
                <select
                  className="admin-input"
                  value={form.frequency}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, frequency: e.target.value }))
                  }
                >
                  {["HOURLY", "DAILY", "MONTHLY", "ONE_TIME"].map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <input
                  className="admin-input"
                  placeholder="Max payments"
                  value={form.maxPayments}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, maxPayments: e.target.value }))
                  }
                />
                <button type="submit" disabled={busy} className="admin-btn-primary">
                  {busy ? "Saving…" : editId ? "Update rule" : "Create"}
                </button>
              </form>
            </Surface>
          </div>
          <Surface>
            {loading ? (
              <LoadingBlock />
            ) : rows.length === 0 ? (
              <EmptyBlock />
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th />
                    <th>User</th>
                    <th>Amount</th>
                    <th>Frequency</th>
                    <th>Paid</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const id = String(r.id);
                    return (
                      <tr
                        key={id}
                        className={editId === id ? "bg-blue-50" : undefined}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(id)}
                            onChange={(e) => {
                              const n = new Set(selected);
                              e.target.checked ? n.add(id) : n.delete(id);
                              setSelected(n);
                            }}
                          />
                        </td>
                        <td className="font-mono text-xs">
                          {String(r.userId ?? r.number ?? "—").slice(0, 14)}
                        </td>
                        <td className="font-bold">₹{Number(r.amount ?? 0)}</td>
                        <td>{String(r.frequency)}</td>
                        <td>
                          {String(r.paidCount ?? 0)}/
                          {String(r.maxPayments ?? "∞")}
                        </td>
                        <td className="space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            className="text-xs font-bold text-blue-600"
                            onClick={() => startEdit(r)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-xs font-bold text-red-600"
                            onClick={async () => {
                              if (!confirm("Delete this salary rule?")) return;
                              await admin.deleteSalaryRule(id);
                              if (editId === id) cancelEdit();
                              loadManual();
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Surface>
        </>
      )}
    </div>
  );
}
