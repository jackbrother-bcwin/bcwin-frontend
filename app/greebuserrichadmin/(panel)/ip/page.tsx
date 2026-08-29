"use client";

import React, { useCallback, useEffect, useState } from "react";
import * as admin from "../../../lib/admin-api";
import { useToast } from "../../../components/ui/Toast";
import { EmptyBlock, LoadingBlock, PageTitle, RefreshBtn, Surface } from "../../components/ui";
import { AdminPieChart } from "../../components/Charts";

export default function IpPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [ipInput, setIpInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, st] = await Promise.all([
        admin.listIps({ page: 1, limit: 100 }),
        admin.getIpStats(),
      ]);
      const d = list.data;
      setRows(Array.isArray(d) ? (d as Array<Record<string, unknown>>) : []);
      setStats((st.data as Record<string, unknown>) ?? null);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const pie = stats
    ? Object.entries(stats)
        .filter(([, v]) => typeof v === "number")
        .map(([name, value]) => ({ name, value: Number(value) }))
    : [];

  return (
    <div>
      <PageTitle title="IP control" subtitle="List · detail · blacklist / whitelist" action={<RefreshBtn onClick={load} />} />
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        {pie.length > 0 && <AdminPieChart data={pie} title="IP intelligence stats" />}
        <Surface title="Lookup / action">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!ipInput.trim()) return;
              setBusy(true);
              try {
                const r = await admin.getIpDetails(ipInput.trim());
                setDetail((r.data as Record<string, unknown>) ?? { ip: ipInput });
              } catch (err: unknown) {
                toast(err instanceof Error ? err.message : "Lookup failed", "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            <input className="admin-input flex-1" placeholder="IP address" value={ipInput} onChange={(e) => setIpInput(e.target.value)} />
            <button type="submit" disabled={busy} className="admin-btn-primary">Lookup</button>
            <button
              type="button"
              disabled={busy || !ipInput.trim()}
              className="admin-btn-danger"
              onClick={async () => {
                setBusy(true);
                try {
                  await admin.blacklistIp(ipInput.trim());
                  toast("Blacklisted", "success");
                  load();
                } catch (e: unknown) {
                  toast(e instanceof Error ? e.message : "Failed", "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Blacklist
            </button>
            <button
              type="button"
              disabled={busy || !ipInput.trim()}
              className="admin-btn-success"
              onClick={async () => {
                setBusy(true);
                try {
                  await admin.whitelistIp(ipInput.trim());
                  toast("Whitelisted", "success");
                  load();
                } catch (e: unknown) {
                  toast(e instanceof Error ? e.message : "Failed", "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Whitelist
            </button>
          </form>
          {detail && (
            <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600">
              {JSON.stringify(detail, null, 2)}
            </pre>
          )}
        </Surface>
      </div>
      <Surface title="IP list">
        {loading ? <LoadingBlock /> : rows.length === 0 ? <EmptyBlock /> : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>IP</th>
                  <th>Status</th>
                  <th>Risk</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const ip = String(r.ip ?? r.address ?? r.id ?? i);
                  return (
                    <tr key={ip}>
                      <td className="font-mono text-xs">{ip}</td>
                      <td>{String(r.status ?? r.listType ?? "—")}</td>
                      <td>{String(r.riskLevel ?? r.risk ?? "—")}</td>
                      <td className="space-x-2">
                        <button type="button" className="text-xs font-bold text-red-600" onClick={async () => {
                          await admin.blacklistIp(ip);
                          toast("Blacklisted", "success");
                          load();
                        }}>Blacklist</button>
                        <button type="button" className="text-xs font-bold text-emerald-600" onClick={async () => {
                          await admin.whitelistIp(ip);
                          toast("Whitelisted", "success");
                          load();
                        }}>Whitelist</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
    </div>
  );
}
