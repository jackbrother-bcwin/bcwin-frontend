"use client";

import React, { useCallback, useEffect, useState } from "react";
import * as admin from "../../../../lib/admin-api";
import { useToast } from "../../../../components/ui/Toast";
import { EmptyBlock, LoadingBlock, PageTitle, RefreshBtn, Surface } from "../../../components/ui";
import { AdminBarChart } from "../../../components/Charts";

export default function CommissionRatesPage() {
  const { toast } = useToast();
  const [rates, setRates] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    vipLevel: "0",
    layer1: "0.4",
    layer2: "0.1",
    layer3: "0.05",
    layer4: "0.03",
    layer5: "0.02",
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await admin.getCommissionRates();
      const list = (r as { rates?: unknown; data?: unknown }).rates
        ?? (r as { data?: unknown }).data
        ?? [];
      setRates(Array.isArray(list) ? (list as Array<Record<string, unknown>>) : []);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const chart = rates
    .slice()
    .sort((a, b) => Number(a.vipLevel) - Number(b.vipLevel))
    .map((r) => ({
      name: `VIP${r.vipLevel}`,
      L1: Number(r.layer1 ?? 0) * 100,
      L2: Number(r.layer2 ?? 0) * 100,
    }));

  return (
    <div>
      <PageTitle title="Commission rates" subtitle="Per VIP level · layer rates 0–1" action={<RefreshBtn onClick={load} />} />
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <AdminBarChart data={chart} xKey="name" yKey="L1" yKey2="L2" title="Layer rates % by VIP" />
        <Surface title="Update VIP level rates">
          <form
            className="grid grid-cols-2 gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await admin.updateCommissionRates({
                  vipLevel: Number(form.vipLevel),
                  layer1: Number(form.layer1),
                  layer2: Number(form.layer2),
                  layer3: Number(form.layer3),
                  layer4: Number(form.layer4),
                  layer5: Number(form.layer5),
                });
                toast("Commission rates updated", "success");
                load();
              } catch (err: unknown) {
                toast(err instanceof Error ? err.message : "Failed", "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            {Object.entries(form).map(([k, v]) => (
              <div key={k}>
                <label className="mb-0.5 block text-[10px] font-semibold uppercase text-slate-500">{k}</label>
                <input className="admin-input" value={v} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
            <div className="col-span-2">
              <button type="submit" disabled={busy} className="admin-btn-primary">{busy ? "Saving…" : "Save rates"}</button>
            </div>
          </form>
        </Surface>
      </div>
      <Surface>
        {loading ? <LoadingBlock /> : rates.length === 0 ? <EmptyBlock /> : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>VIP</th>
                <th>L1</th>
                <th>L2</th>
                <th>L3</th>
                <th>L4</th>
                <th>L5</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={String(r.id ?? r.vipLevel)}>
                  <td className="font-bold">{String(r.vipLevel)}</td>
                  <td>{Number(r.layer1 ?? 0)}</td>
                  <td>{Number(r.layer2 ?? 0)}</td>
                  <td>{Number(r.layer3 ?? 0)}</td>
                  <td>{Number(r.layer4 ?? 0)}</td>
                  <td>{Number(r.layer5 ?? 0)}</td>
                  <td>
                    <button
                      type="button"
                      className="text-xs font-bold text-blue-600"
                      onClick={() =>
                        setForm({
                          vipLevel: String(r.vipLevel ?? 0),
                          layer1: String(r.layer1 ?? 0),
                          layer2: String(r.layer2 ?? 0),
                          layer3: String(r.layer3 ?? 0),
                          layer4: String(r.layer4 ?? 0),
                          layer5: String(r.layer5 ?? 0),
                        })
                      }
                    >
                      Load
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Surface>
    </div>
  );
}
