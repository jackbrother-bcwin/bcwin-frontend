"use client";

import React, { useCallback, useEffect, useState } from "react";
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

function asRows(v: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(v)) return v as Array<Record<string, unknown>>;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ["agents", "data", "users", "items", "list"]) {
      if (Array.isArray(o[k])) return o[k] as Array<Record<string, unknown>>;
    }
  }
  return [];
}

function pickId(r: Record<string, unknown>): string {
  return String(r.id ?? r.userId ?? r.mobileNumber ?? r.serialNumber ?? r.username ?? "");
}

export default function AgentsPage() {
  const { toast } = useToast();
  const [form, setForm] = useState({ mobileNumber: "", password: "", username: "" });
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [performance, setPerformance] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const r = await admin.listAgents({ page: 1, limit: 100, search: search || undefined });
      setRows(asRows(r.agents ?? r.data));
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load agents", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search, toast]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openDetail = async (identifier: string) => {
    if (!identifier) return;
    setSelectedId(identifier);
    setDetailLoading(true);
    setDetail(null);
    setPerformance(null);
    try {
      const [d, p] = await Promise.all([
        admin.getAgent(identifier),
        admin.getAgentPerformance(identifier).catch(() => null),
      ]);
      const raw = d.data ?? d;
      setDetail(
        raw && typeof raw === "object" ? (raw as Record<string, unknown>) : { value: raw }
      );
      if (p?.data && typeof p.data === "object") {
        setPerformance(p.data as Record<string, unknown>);
      } else if (p && typeof p === "object") {
        const rest = { ...(p as Record<string, unknown>) };
        delete rest.success;
        if (Object.keys(rest).length) setPerformance(rest);
      }
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load agent", "error");
    } finally {
      setDetailLoading(false);
    }
  };

  const perfNums = performance
    ? Object.entries(performance).filter(([, v]) => typeof v === "number").slice(0, 8)
    : [];

  return (
    <div className="space-y-4">
      <PageTitle
        title="Agents"
        subtitle="Create agents · inspect profile & performance"
        action={<RefreshBtn onClick={loadList} loading={loading} />}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          <Surface title="Create agent">
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await admin.createAgent(form);
                  toast("Agent created", "success");
                  setForm({ mobileNumber: "", password: "", username: "" });
                  loadList();
                } catch (err: unknown) {
                  toast(err instanceof Error ? err.message : "Failed", "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {(["username", "mobileNumber", "password"] as const).map((k) => (
                <input
                  key={k}
                  className="admin-input"
                  placeholder={k}
                  type={k === "password" ? "password" : "text"}
                  value={form[k]}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                  required
                />
              ))}
              <button type="submit" disabled={busy} className="admin-btn-primary">
                {busy ? "Creating…" : "Create agent"}
              </button>
            </form>
          </Surface>

          <Surface
            title="Agent list"
            action={
              <div className="flex gap-2">
                <input
                  className="admin-input !h-8 !text-xs w-40"
                  placeholder="Mobile, name, or #UID"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadList()}
                />
                <button type="button" className="admin-btn-ghost !py-1 text-xs" onClick={loadList}>
                  Go
                </button>
              </div>
            }
          >
            {loading ? (
              <LoadingBlock />
            ) : rows.length === 0 ? (
              <EmptyBlock label="No agents" />
            ) : (
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Mobile</th>
                      <th>Role</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const id = pickId(r);
                      return (
                        <tr
                          key={id || i}
                          className={selectedId === id ? "bg-blue-50/80" : undefined}
                        >
                          <td className="font-semibold">{String(r.username ?? "—")}</td>
                          <td className="font-mono text-xs">{String(r.mobileNumber ?? "—")}</td>
                          <td>{String(r.role ?? "AGENT")}</td>
                          <td>
                            <button
                              type="button"
                              className="text-xs font-bold text-blue-600"
                              onClick={() =>
                                openDetail(
                                  String(r.mobileNumber ?? r.serialNumber ?? r.id ?? r.username ?? "")
                                )
                              }
                            >
                              Details
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
        </div>

        <div className="space-y-4">
          <Surface title={selectedId ? `Agent · ${selectedId}` : "Agent detail"}>
            {!selectedId ? (
              <EmptyBlock label="Select an agent to view details & performance" />
            ) : detailLoading ? (
              <LoadingBlock />
            ) : (
              <>
                {detail && (
                  <div className="mb-4 grid gap-2 sm:grid-cols-2 text-sm">
                    {Object.entries(detail)
                      .filter(([, v]) => v == null || ["string", "number", "boolean"].includes(typeof v))
                      .slice(0, 16)
                      .map(([k, v]) => (
                        <div
                          key={k}
                          className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            {k}
                          </p>
                          <p className="truncate font-medium text-slate-800">{String(v ?? "—")}</p>
                        </div>
                      ))}
                  </div>
                )}
                {perfNums.length > 0 && (
                  <div className="mb-3 grid gap-2 sm:grid-cols-2">
                    {perfNums.map(([k, v]) => (
                      <StatCard key={k} label={k} value={Number(v)} />
                    ))}
                  </div>
                )}
                {performance && (
                  <details className="rounded-lg border border-slate-100 bg-white">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-slate-600">
                      Raw performance JSON
                    </summary>
                    <pre className="max-h-64 overflow-auto p-3 text-[10px] text-slate-500">
                      {JSON.stringify(performance, null, 2)}
                    </pre>
                  </details>
                )}
                {!detail && !performance && !detailLoading && (
                  <EmptyBlock label="No detail payload returned" />
                )}
              </>
            )}
          </Surface>
        </div>
      </div>
    </div>
  );
}
