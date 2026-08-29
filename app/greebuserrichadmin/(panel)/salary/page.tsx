"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as admin from "../../../lib/admin-api";
import { useToast } from "../../../components/ui/Toast";
import {
  Badge,
  EmptyBlock,
  LoadingBlock,
  PageTitle,
  RefreshBtn,
  Surface,
  StatCard,
} from "../../components/ui";
import BulkBar from "../../components/BulkBar";
import { AdminPieChart } from "../../components/Charts";
import { formatIstDateTime } from "../../../lib/ist-day";
import { ADMIN_AUTO_SALARY_NOTICE, AUTO_SALARY_LIVE } from "../../../lib/auto-salary";

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
  const [tab, setTab] = useState<Tab>("manual");

  // ── Manual & Recurring rules ────────────────────────────────────────────
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [freqFilter, setFreqFilter] = useState<string>("ALL");
  const [form, setForm] = useState({
    number: "",
    amount: "500",
    frequency: "DAILY",
    remark: "",
    immediateFirst: false,
    addToTurnover: false,
  });
  const [busy, setBusy] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

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

  const loadManual = useCallback(async () => {
    setLoading(true);
    try {
      const [list, st] = await Promise.all([
        admin.listSalaryRules({
          search: search || undefined,
          status: statusFilter !== "ALL" ? statusFilter : undefined,
          limit: 100,
        }),
        admin.getSalaryStatistics().catch(() => ({ success: true, data: null })),
      ]);
      setRows(list.rules ?? []);
      const stRaw = st as {
        data?: unknown;
        totalPaid?: number;
        activeRules?: number;
        totalUsers?: number;
        frequencyDistribution?: Record<string, number>;
      };
      setStats(
        (stRaw.data as Record<string, unknown>) ?? {
          totalPaid: stRaw.totalPaid ?? 0,
          activeRules: stRaw.activeRules ?? 0,
          totalUsers: stRaw.totalUsers ?? 0,
          frequencyDistribution: stRaw.frequencyDistribution ?? {},
        }
      );
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load salary rules", "error");
    } finally {
      setLoading(false);
    }
  }, [toast, search, statusFilter]);

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
    if (!AUTO_SALARY_LIVE || tab === "manual") void loadManual();
    else void loadAuto();
  }, [tab, loadManual, loadAuto]);

  const filteredRows = useMemo(() => {
    if (freqFilter === "ALL") return rows;
    return rows.filter((r) => String(r.frequency) === freqFilter);
  }, [rows, freqFilter]);

  const pie = ["DAILY", "WEEKLY", "MONTHLY", "HOURLY", "ONE_TIME"]
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
    const u = r.user as { mobileNumber?: string; serialNumber?: number } | undefined;
    setForm({
      number: String(u?.mobileNumber ?? u?.serialNumber ?? r.number ?? r.userId ?? ""),
      amount: String(r.amount ?? "500"),
      frequency: String(r.frequency ?? "DAILY"),
      remark: String(r.remark ?? ""),
      immediateFirst: Boolean(r.immediateFirst),
      addToTurnover: Boolean(r.addToTurnover),
    });
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm({
      number: "",
      amount: "500",
      frequency: "DAILY",
      remark: "",
      immediateFirst: false,
      addToTurnover: false,
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.number.trim()) {
      toast("Enter a mobile number or user ID", "error");
      return;
    }
    const amt = Number(form.amount);
    if (!amt || amt <= 0) {
      toast("Enter a valid positive amount", "error");
      return;
    }
    setBusy(true);
    try {
      const body = {
        number: form.number.trim(),
        amount: amt,
        frequency: form.frequency,
        remark: form.remark.trim() || undefined,
        immediateFirst: form.frequency === "ONE_TIME" ? true : form.immediateFirst,
        addToTurnover: form.addToTurnover,
      };
      if (editId) {
        await admin.updateSalaryRule(editId, body);
        toast("Salary rule updated successfully", "success");
      } else {
        const res = await admin.createSalaryRule(body);
        toast(res.message || "Salary credited / scheduled successfully", "success");
      }
      cancelEdit();
      void loadManual();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to save salary rule", "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (id: string, currentActive: boolean) => {
    setActionId(id);
    try {
      await admin.toggleSalaryRule(id, !currentActive);
      toast(
        currentActive ? "Salary rule stopped" : "Salary rule resumed",
        "success"
      );
      void loadManual();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to toggle status", "error");
    } finally {
      setActionId(null);
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
        title="Salary Management"
        subtitle={
          AUTO_SALARY_LIVE
            ? "Manage recurring salaries, give instant credits, and review auto slabs"
            : "Manual & recurring salary only"
        }
        action={
          <RefreshBtn
            onClick={() => (tab === "manual" || !AUTO_SALARY_LIVE ? loadManual() : loadAuto())}
          />
        }
      />

      {!AUTO_SALARY_LIVE ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          {ADMIN_AUTO_SALARY_NOTICE}
        </div>
      ) : (
        <div className="mb-4 flex gap-2 border-b border-slate-200">
          {(
            [
              { id: "manual" as const, label: "Manual & Recurring Salary" },
              { id: "auto" as const, label: "Auto Salary Slabs" },
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
      )}

      {tab === "manual" ? (
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
                  toast("Deleted selected rules", "success");
                  setSelected(new Set());
                  void loadManual();
                },
              },
            ]}
          />

          {/* Stats summary */}
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Total Salary Paid"
              value={formatMoney(Number(stats?.totalPaid ?? 0))}
            />
            <StatCard
              label="Active Salary Rules"
              value={Number(stats?.activeRules ?? 0)}
            />
            <StatCard
              label="Users Receiving Salary"
              value={Number(stats?.totalUsers ?? 0)}
            />
          </div>

          {/* Create / Edit Form + Chart */}
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <Surface title={editId ? "Edit Salary Rule" : "Give Salary / Create Rule"}>
              <p className="mb-3 text-xs text-slate-500">
                {editId
                  ? "Update payment amount, schedule, status, or remark"
                  : "Give instant one-time salary or set up a recurring daily/weekly/monthly payout"}
              </p>
              {editId && (
                <div className="mb-3 rounded bg-blue-50 p-2 text-xs text-blue-700 flex justify-between items-center">
                  <span>Editing Rule #{editId.slice(0, 8)}…</span>
                  <button
                    type="button"
                    className="font-bold underline"
                    onClick={cancelEdit}
                  >
                    Cancel
                  </button>
                </div>
              )}

              <form className="space-y-3" onSubmit={submit}>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Recipient User (Mobile Number / Serial # / UUID)
                  </label>
                  <input
                    className="admin-input"
                    placeholder="e.g. 9876543210 or 10009"
                    value={form.number}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, number: e.target.value }))
                    }
                    required={!editId}
                    disabled={!!editId}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Amount (₹)
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="admin-input"
                      placeholder="Amount"
                      value={form.amount}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, amount: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Frequency
                    </label>
                    <select
                      className="admin-input"
                      value={form.frequency}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, frequency: e.target.value }))
                      }
                    >
                      <option value="ONE_TIME">Instant One-Time Credit</option>
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly (every 7 days)</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="HOURLY">Hourly</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Remark (Visible to User in Transaction History)
                  </label>
                  <input
                    className="admin-input"
                    placeholder="e.g. Weekly Agent Salary, Top performer bonus"
                    value={form.remark}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, remark: e.target.value }))
                    }
                  />
                </div>

                {form.frequency !== "ONE_TIME" && !editId && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="immediateFirst"
                      checked={form.immediateFirst}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          immediateFirst: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label
                      htmlFor="immediateFirst"
                      className="text-xs text-slate-700 select-none"
                    >
                      Pay first cycle immediately to wallet right now
                    </label>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="addToTurnover"
                    checked={form.addToTurnover}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        addToTurnover: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="addToTurnover"
                    className="text-xs text-slate-700 select-none"
                  >
                    Count salary credit towards deposit / turnover requirement
                  </label>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="admin-btn-primary flex-1"
                  >
                    {busy
                      ? "Processing…"
                      : editId
                        ? "Save Changes"
                        : form.frequency === "ONE_TIME"
                          ? "Credit Instant Salary"
                          : "Create Salary Schedule"}
                  </button>
                  {editId && (
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="admin-btn-ghost"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </Surface>

            <div className="space-y-4">
              <AdminPieChart data={pie} title="Salary rules by frequency" />
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 space-y-1.5 leading-relaxed shadow-sm">
                <p className="font-bold text-slate-800">
                  💡 How Salary & Remarks work:
                </p>
                <p>
                  • <strong>Instant One-Time</strong> credits user balance immediately with the provided Remark.
                </p>
                <p>
                  • <strong>Daily, Weekly & Monthly</strong> schedules run automatically until an admin clicks <strong>Stop</strong>.
                </p>
                <p>
                  • The <strong>Remark</strong> is permanently saved on each payout and displayed directly in the user&apos;s Transaction History ledger.
                </p>
                <p>
                  • Click <strong>Hub ↗</strong> on any row to open the user&apos;s full 360° management profile.
                </p>
              </div>
            </div>
          </div>

          {/* Salary List Section */}
          <Surface title="Salary List & Active Schedules">
            <p className="mb-3 text-xs text-slate-500">
              View, stop, resume, or manage all manual salary recipients
            </p>
            {/* Filter controls */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="min-w-[200px] flex-1">
                <input
                  className="admin-input"
                  placeholder="Search user by Serial # / Username / Mobile"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div>
                <select
                  className="admin-input"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">Status: All</option>
                  <option value="ACTIVE">Active only</option>
                  <option value="STOPPED">Stopped only</option>
                </select>
              </div>

              <div>
                <select
                  className="admin-input"
                  value={freqFilter}
                  onChange={(e) => setFreqFilter(e.target.value)}
                >
                  <option value="ALL">Frequency: All</option>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="ONE_TIME">One-Time</option>
                  <option value="HOURLY">Hourly</option>
                </select>
              </div>

              <button
                type="button"
                className="admin-btn-ghost"
                onClick={() => void loadManual()}
              >
                Apply Filters
              </button>
            </div>

            {loading ? (
              <LoadingBlock label="Loading salary rules…" />
            ) : filteredRows.length === 0 ? (
              <EmptyBlock label="No salary rules found matching criteria" />
            ) : (
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th className="w-8">
                        <input
                          type="checkbox"
                          checked={
                            selected.size === filteredRows.length &&
                            filteredRows.length > 0
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelected(
                                new Set(filteredRows.map((r) => String(r.id)))
                              );
                            } else {
                              setSelected(new Set());
                            }
                          }}
                        />
                      </th>
                      <th>User</th>
                      <th>Amount</th>
                      <th>Frequency</th>
                      <th>Remark</th>
                      <th>Status</th>
                      <th>Next Payment</th>
                      <th>Paid Count</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r) => {
                      const id = String(r.id);
                      const u = r.user as
                        | {
                            id?: string;
                            serialNumber?: number;
                            username?: string;
                            mobileNumber?: string;
                          }
                        | undefined;
                      const userId = String(u?.id ?? r.userId ?? "");
                      const isActive = Boolean(r.isActive);
                      const freq = String(r.frequency ?? "DAILY");
                      const remarkText = String(r.remark ?? "");

                      return (
                        <tr
                          key={id}
                          className={editId === id ? "bg-blue-50/70" : undefined}
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
                          <td className="text-xs">
                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                              <span>
                                #{u?.serialNumber ?? "—"} {u?.username ?? "User"}
                              </span>
                            </div>
                            <div className="font-mono text-slate-400 text-[11px]">
                              {u?.mobileNumber ?? userId.slice(0, 8)}
                            </div>
                          </td>
                          <td className="font-bold text-slate-900">
                            ₹{Number(r.amount ?? 0).toLocaleString("en-IN")}
                          </td>
                          <td>
                            <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                              {freq}
                            </span>
                          </td>
                          <td className="text-xs max-w-[180px] truncate text-slate-600" title={remarkText || "No remark"}>
                            {remarkText ? (
                              <span className="font-medium text-slate-800">
                                {remarkText}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">None</span>
                            )}
                          </td>
                          <td>
                            {isActive ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                                ACTIVE
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                                STOPPED
                              </span>
                            )}
                          </td>
                          <td className="text-xs text-slate-500 whitespace-nowrap">
                            {isActive && freq !== "ONE_TIME" && r.nextPaymentAt ? (
                              formatIstDateTime(r.nextPaymentAt)
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="text-xs font-mono text-slate-700">
                            {String(r.paidCount ?? 0)}
                          </td>
                          <td className="text-right space-x-1.5 whitespace-nowrap">
                            {/* Go to user hub button */}
                            {userId && (
                              <Link
                                href={`/greebuserrichadmin/users/${userId}?tab=salary`}
                                className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors no-underline"
                              >
                                Hub ↗
                              </Link>
                            )}

                            {/* Stop / Resume button */}
                            {freq !== "ONE_TIME" && (
                              <button
                                type="button"
                                disabled={actionId === id}
                                onClick={() => void toggleStatus(id, isActive)}
                                className={`rounded px-2 py-1 text-xs font-bold transition-colors ${
                                  isActive
                                    ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                              >
                                {actionId === id
                                  ? "…"
                                  : isActive
                                    ? "Stop"
                                    : "Resume"}
                              </button>
                            )}

                            {/* Edit button */}
                            <button
                              type="button"
                              className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors"
                              onClick={() => startEdit(r)}
                            >
                              Edit
                            </button>

                            {/* Delete button */}
                            <button
                              type="button"
                              className="rounded bg-red-50 px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors"
                              onClick={async () => {
                                if (!confirm("Delete this salary rule?")) return;
                                await admin.deleteSalaryRule(id);
                                if (editId === id) cancelEdit();
                                toast("Salary rule deleted", "success");
                                void loadManual();
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
              </div>
            )}
          </Surface>
        </>
      ) : (
        /* Auto Slabs Tab */
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
              onClick={() => void loadAuto()}
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
                            id?: string;
                            serialNumber?: number;
                            username?: string;
                            mobileNumber?: string;
                          }
                        | undefined;
                      const status = String(c.status);
                      const userId = String(user?.id ?? c.userId ?? "");
                      return (
                        <tr key={id}>
                          <td className="text-xs">
                            <div className="font-bold">
                              #{user?.serialNumber ?? "—"} {user?.username ?? ""}
                            </div>
                            <div className="text-slate-500 font-mono flex items-center gap-1">
                              <span>{user?.mobileNumber ?? String(c.userId).slice(0, 8)}</span>
                              {userId && (
                                <Link
                                  href={`/greebuserrichadmin/users/${userId}?tab=salary`}
                                  className="text-blue-600 hover:underline text-[10px]"
                                >
                                  Hub ↗
                                </Link>
                              )}
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
                                  className="text-xs font-bold text-green-700 hover:underline"
                                  disabled={actionId === id}
                                  onClick={() => approve(id)}
                                >
                                  {actionId === id ? "…" : "Approve"}
                                </button>
                                <button
                                  type="button"
                                  className="text-xs font-bold text-red-600 hover:underline"
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
      )}
    </div>
  );
}
