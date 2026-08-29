"use client";

import React, { useCallback, useEffect, useState } from "react";
import * as admin from "../../../lib/admin-api";
import { useToast } from "../../../components/ui/Toast";
import { EmptyBlock, LoadingBlock, PageTitle, RefreshBtn, Surface } from "../../components/ui";
import { AdminPieChart } from "../../components/Charts";
import BulkBar from "../../components/BulkBar";

const TYPES = ["WEEKLY", "DAILY", "INVITATION", "FIRST_DEPOSIT", "ATTENDENCE", "SPIN_WHEEL", "WIN_STREAK"];

export default function ActivityTiersPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    type: "WEEKLY",
    reward: "25",
    depositRequirement: "",
    betRequirement: "",
    inviteRequirement: "",
    dayRequirement: "",
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tiers, hist] = await Promise.all([
        admin.listActivityTiers(),
        admin.listActivityBonusHistory({ page: 1, limit: 30 }).catch(() => ({ data: [] })),
      ]);
      const list = (tiers.data ?? []) as Array<Record<string, unknown>>;
      setRows(Array.isArray(list) ? list : []);
      const h = (hist as { data?: unknown }).data;
      setHistory(Array.isArray(h) ? (h as Array<Record<string, unknown>>) : []);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const bodyFromForm = () => ({
    type: form.type,
    reward: Number(form.reward),
    depositRequirement: form.depositRequirement ? Number(form.depositRequirement) : null,
    betRequirement: form.betRequirement ? Number(form.betRequirement) : null,
    inviteRequirement: form.inviteRequirement ? Number(form.inviteRequirement) : null,
    dayRequirement: form.dayRequirement ? Number(form.dayRequirement) : null,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (editId) {
        await admin.updateActivityTier(editId, bodyFromForm());
        toast("Tier updated", "success");
      } else {
        await admin.createActivityTier(bodyFromForm());
        toast("Tier created", "success");
      }
      setEditId(null);
      load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const pie = TYPES.map((t) => ({
    name: t,
    value: rows.filter((r) => r.type === t).length || 0,
  })).filter((x) => x.value > 0);

  return (
    <div>
      <PageTitle title="Activity tiers" subtitle="CRUD + claim history" action={<RefreshBtn onClick={load} />} />
      <BulkBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        actions={[
          {
            label: "Delete selected",
            variant: "danger",
            icon: "trash",
            disabled: busy,
            onClick: async () => {
              if (!confirm(`Delete ${selected.size}?`)) return;
              setBusy(true);
              try {
                await Promise.all([...selected].map((id) => admin.deleteActivityTier(id)));
                toast("Deleted", "success");
                setSelected(new Set());
                load();
              } catch (e: unknown) {
                toast(e instanceof Error ? e.message : "Failed", "error");
              } finally {
                setBusy(false);
              }
            },
          },
        ]}
      />
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <AdminPieChart data={pie} title="Tiers by type" />
        <Surface title={editId ? "Edit tier" : "Create tier"}>
          <form onSubmit={submit} className="space-y-2">
            <select className="admin-input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {(["reward", "depositRequirement", "betRequirement", "inviteRequirement", "dayRequirement"] as const).map((k) => (
              <input
                key={k}
                className="admin-input"
                placeholder={k}
                value={form[k]}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              />
            ))}
            <button type="submit" disabled={busy} className="admin-btn-primary">{editId ? "Update" : "Create"}</button>
          </form>
        </Surface>
      </div>
      <Surface title="Tiers" className="mb-4">
        {loading ? <LoadingBlock /> : rows.length === 0 ? <EmptyBlock /> : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th />
                  <th>Type</th>
                  <th>Reward</th>
                  <th>Deposit req</th>
                  <th>Bet req</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const id = String(r.id);
                  return (
                    <tr key={id}>
                      <td>
                        <input type="checkbox" checked={selected.has(id)} onChange={(e) => {
                          const n = new Set(selected);
                          e.target.checked ? n.add(id) : n.delete(id);
                          setSelected(n);
                        }} />
                      </td>
                      <td className="font-semibold">{String(r.type)}</td>
                      <td>₹{Number(r.reward ?? 0)}</td>
                      <td>{String(r.depositRequirement ?? "—")}</td>
                      <td>{String(r.betRequirement ?? "—")}</td>
                      <td className="space-x-2">
                        <button type="button" className="text-xs font-bold text-blue-600" onClick={() => {
                          setEditId(id);
                          setForm({
                            type: String(r.type ?? "WEEKLY"),
                            reward: String(r.reward ?? 0),
                            depositRequirement: String(r.depositRequirement ?? ""),
                            betRequirement: String(r.betRequirement ?? ""),
                            inviteRequirement: String(r.inviteRequirement ?? ""),
                            dayRequirement: String(r.dayRequirement ?? ""),
                          });
                        }}>Edit</button>
                        <button type="button" className="text-xs font-bold text-red-600" onClick={async () => {
                          if (!confirm("Delete?")) return;
                          await admin.deleteActivityTier(id);
                          toast("Deleted", "success");
                          load();
                        }}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
      <Surface title="Activity bonus history (recent)">
        {history.length === 0 ? <EmptyBlock /> : (
          <div className="max-h-72 overflow-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={String(h.id ?? i)}>
                    <td>{String(h.type ?? "—")}</td>
                    <td>₹{Number(h.amount ?? 0)}</td>
                    <td>{String(h.status ?? "—")}</td>
                    <td className="font-mono text-[11px]">{String(h.userId ?? "—").slice(0, 8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
    </div>
  );
}
