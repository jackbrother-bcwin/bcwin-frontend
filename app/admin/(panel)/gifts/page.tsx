"use client";

import React, { useCallback, useEffect, useState } from "react";
import * as admin from "../../../lib/admin-api";
import { useToast } from "../../../components/ui/Toast";
import { EmptyBlock, LoadingBlock, PageTitle, RefreshBtn, Surface } from "../../components/ui";
import BulkBar from "../../components/BulkBar";
import { AdminPieChart } from "../../components/Charts";

export default function GiftsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [gifts, setGifts] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    amount: "100",
    totalRedeemable: "10",
    type: "FIXED",
    title: "Gift code",
  });
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await admin.listGifts({});
      const list = (res.gifts ?? res.data ?? []) as Array<Record<string, unknown>>;
      setGifts(Array.isArray(list) ? list : []);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const pie = [
    { name: "Active", value: gifts.filter((g) => g.isActive !== false).length },
    { name: "Inactive", value: gifts.filter((g) => g.isActive === false).length },
  ].filter((x) => x.value > 0);

  return (
    <div>
      <PageTitle title="Gifts" subtitle="Create · toggle · bulk deactivate" action={<RefreshBtn onClick={load} />} />
      <BulkBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        actions={[
          {
            label: "Deactivate selected",
            variant: "danger",
            icon: "close",
            onClick: async () => {
              await Promise.all([...selected].map((id) => admin.patchGiftActive(id, { isActive: false })));
              toast("Deactivated", "success");
              setSelected(new Set());
              load();
            },
          },
          {
            label: "Activate selected",
            variant: "success",
            icon: "check",
            onClick: async () => {
              await Promise.all([...selected].map((id) => admin.patchGiftActive(id, { isActive: true })));
              toast("Activated", "success");
              setSelected(new Set());
              load();
            },
          },
        ]}
      />
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <AdminPieChart data={pie} title="Gift status" />
        <Surface title="Create gift">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const res = await admin.createGift({
                  amount: Number(form.amount),
                  totalRedeemable: Number(form.totalRedeemable),
                  type: form.type,
                  title: form.title,
                  isActive: true,
                });
                setCreated(res.code);
                toast(`Gift created: ${res.code}`, "success");
                load();
              } catch (err: unknown) {
                toast(err instanceof Error ? err.message : "Failed", "error");
              } finally {
                setBusy(false);
              }
            }}
            className="space-y-3"
          >
            <input className="admin-input" placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <input className="admin-input" type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            <input className="admin-input" type="number" placeholder="Total redeemable" value={form.totalRedeemable} onChange={(e) => setForm((f) => ({ ...f, totalRedeemable: e.target.value }))} />
            <select className="admin-input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              <option value="FIXED">FIXED</option>
              <option value="UPTO">UPTO</option>
            </select>
            <button type="submit" disabled={busy} className="admin-btn-primary">{busy ? "Creating…" : "Create gift"}</button>
            {created && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">Code: {created}</p>
            )}
          </form>
        </Surface>
      </div>
      <Surface title="Gift list">
        {loading ? <LoadingBlock /> : gifts.length === 0 ? <EmptyBlock /> : (
          <table className="admin-table">
            <thead>
              <tr>
                <th />
                <th>Code</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {gifts.map((g, i) => {
                const id = String(g.id ?? i);
                return (
                  <tr key={id}>
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
                    <td className="font-mono font-bold">{String(g.code ?? "—")}</td>
                    <td>₹{String(g.amount ?? 0)}</td>
                    <td>{String(g.type ?? "")}</td>
                    <td>{g.isActive === false ? "Inactive" : "Active"}</td>
                    <td>
                      <button
                        type="button"
                        className="text-xs font-bold text-blue-600"
                        onClick={async () => {
                          await admin.patchGiftActive(id, { isActive: g.isActive === false });
                          toast("Toggled", "success");
                          load();
                        }}
                      >
                        Toggle
                      </button>
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
