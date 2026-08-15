"use client";

import React, { useCallback, useEffect, useState } from "react";
import * as admin from "../../../lib/admin-api";
import { useToast } from "../../../components/ui/Toast";
import { EmptyBlock, LoadingBlock, PageTitle, RefreshBtn, Surface } from "../../components/ui";
import { AdminBarChart } from "../../components/Charts";
import BulkBar from "../../components/BulkBar";

export default function WinStreakPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ consecutiveWins: "3", bonusPercentage: "10", isActive: true });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await admin.listWinStreakRules();
      setRows(Array.isArray(r.data) ? (r.data as Array<Record<string, unknown>>) : []);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const chart = rows.map((r) => ({
    name: `${r.consecutiveWins} wins`,
    bonus: Number(r.bonusPercentage ?? 0),
  }));

  return (
    <div>
      <PageTitle title="Win streak rules" action={<RefreshBtn onClick={load} />} />
      <BulkBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        actions={[{
          label: "Delete selected",
          variant: "danger",
          icon: "trash",
          onClick: async () => {
            if (!confirm(`Delete ${selected.size}?`)) return;
            await Promise.all([...selected].map((id) => admin.deleteWinStreakRule(id)));
            toast("Deleted", "success");
            setSelected(new Set());
            load();
          },
        }]}
      />
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <AdminBarChart data={chart} xKey="name" yKey="bonus" title="Bonus % by streak length" />
        <Surface title="Create rule">
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await admin.createWinStreakRule({
                  consecutiveWins: Number(form.consecutiveWins),
                  bonusPercentage: Number(form.bonusPercentage),
                  isActive: form.isActive,
                });
                toast("Created", "success");
                load();
              } catch (err: unknown) {
                toast(err instanceof Error ? err.message : "Failed", "error");
              }
            }}
          >
            <input className="admin-input" placeholder="Consecutive wins" value={form.consecutiveWins} onChange={(e) => setForm((f) => ({ ...f, consecutiveWins: e.target.value }))} />
            <input className="admin-input" placeholder="Bonus %" value={form.bonusPercentage} onChange={(e) => setForm((f) => ({ ...f, bonusPercentage: e.target.value }))} />
            <button type="submit" className="admin-btn-primary">Create</button>
          </form>
        </Surface>
      </div>
      <Surface>
        {loading ? <LoadingBlock /> : rows.length === 0 ? <EmptyBlock /> : (
          <table className="admin-table">
            <thead><tr><th /><th>Wins</th><th>Bonus %</th><th>Active</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => {
                const id = String(r.id);
                return (
                  <tr key={id}>
                    <td><input type="checkbox" checked={selected.has(id)} onChange={(e) => { const n = new Set(selected); e.target.checked ? n.add(id) : n.delete(id); setSelected(n); }} /></td>
                    <td className="font-bold">{Number(r.consecutiveWins)}</td>
                    <td>{Number(r.bonusPercentage)}%</td>
                    <td>{r.isActive ? "Yes" : "No"}</td>
                    <td className="space-x-2">
                      <button type="button" className="text-xs font-bold text-blue-600" onClick={async () => {
                        await admin.updateWinStreakRule(id, { isActive: !r.isActive });
                        load();
                      }}>Toggle</button>
                      <button type="button" className="text-xs font-bold text-red-600" onClick={async () => {
                        await admin.deleteWinStreakRule(id);
                        load();
                      }}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Surface>
    </div>
  );
}
