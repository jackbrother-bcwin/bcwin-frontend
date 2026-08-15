"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as admin from "../../../lib/admin-api";
import { useToast } from "../../../components/ui/Toast";
import { EmptyBlock, LoadingBlock, PageTitle, RefreshBtn, Surface } from "../../components/ui";
import { AdminBarChart, AdminAreaChart, AdminPieChart } from "../../components/Charts";

export default function TurnoverPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [adjustId, setAdjustId] = useState("");
  const [adjustAmt, setAdjustAmt] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await admin.listTurnover({ page: 1, limit: 100 });
      const d = r.data;
      setRows(Array.isArray(d) ? (d as Array<Record<string, unknown>>) : []);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const top = useMemo(() => {
    return rows
      .slice()
      .sort((a, b) => Number(b.totalTurnover ?? 0) - Number(a.totalTurnover ?? 0))
      .slice(0, 12)
      .map((r) => ({
        name: String(r.username ?? r.serialNumber ?? "?").slice(0, 10),
        turnover: Number(r.totalTurnover ?? 0),
        bets: Number(r.totalBets ?? 0),
        deposits: Number(r.totalDeposits ?? 0),
      }));
  }, [rows]);

  const pie = useMemo(() => {
    const totalT = rows.reduce((s, r) => s + Number(r.totalTurnover ?? 0), 0);
    const totalB = rows.reduce((s, r) => s + Number(r.totalBets ?? 0), 0);
    const totalD = rows.reduce((s, r) => s + Number(r.totalDeposits ?? 0), 0);
    return [
      { name: "Turnover", value: totalT },
      { name: "Bets", value: totalB },
      { name: "Deposits", value: totalD },
    ].filter((x) => x.value > 0);
  }, [rows]);

  return (
    <div>
      <PageTitle title="Turnover" subtitle="Wagering analytics + manual adjust" action={<RefreshBtn onClick={load} />} />

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AdminBarChart data={top} xKey="name" yKey="turnover" yKey2="deposits" title="Top users by turnover" height={280} />
        </div>
        <AdminPieChart data={pie} title="Aggregate mix" height={280} />
      </div>
      <div className="mb-4">
        <AdminAreaChart
          data={top.map((t, i) => ({ idx: i + 1, turnover: t.turnover }))}
          xKey="idx"
          yKey="turnover"
          title="Turnover curve (ranked)"
        />
      </div>

      <Surface title="Manual turnover adjust" className="mb-4 max-w-lg">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!adjustId.trim()) return;
            setBusy(true);
            try {
              await admin.adjustTurnover(adjustId.trim(), {
                amount: Number(adjustAmt),
              });
              toast("Turnover adjusted", "success");
              load();
            } catch (err: unknown) {
              toast(err instanceof Error ? err.message : "Failed", "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          <input className="admin-input flex-1" placeholder="User id / serial" value={adjustId} onChange={(e) => setAdjustId(e.target.value)} />
          <input className="admin-input w-32" placeholder="Amount ±" value={adjustAmt} onChange={(e) => setAdjustAmt(e.target.value)} />
          <button type="submit" disabled={busy} className="admin-btn-primary">Apply</button>
        </form>
      </Surface>

      <Surface title="Turnover table">
        {loading ? <LoadingBlock /> : rows.length === 0 ? <EmptyBlock /> : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Serial</th>
                  <th>User</th>
                  <th>Bets</th>
                  <th>Deposits</th>
                  <th>Turnover</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r.userId ?? r.serialNumber)}>
                    <td className="font-mono">{String(r.serialNumber)}</td>
                    <td className="font-semibold">{String(r.username)}</td>
                    <td>{Number(r.totalBets ?? 0).toLocaleString()}</td>
                    <td>{Number(r.totalDeposits ?? 0).toLocaleString()}</td>
                    <td className="font-bold text-blue-700">{Number(r.totalTurnover ?? 0).toLocaleString()}</td>
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
