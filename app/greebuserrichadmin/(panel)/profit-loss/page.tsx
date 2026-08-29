"use client";
import React, { useCallback, useEffect, useState } from "react";
import * as admin from "../../../lib/admin-api";
import { useToast } from "../../../components/ui/Toast";
import { LoadingBlock, PageTitle, RefreshBtn, StatCard, Surface } from "../../components/ui";

export default function Page() {
  const { toast } = useToast();
  const [filter, setFilter] = useState("today");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await admin.getProfitLoss(filter);
      setData((r.data as Record<string, unknown>) ?? null);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => { load(); }, [load]);

  const cards = (data?.cardItems as Record<string, unknown>) ?? {};

  return (
    <div>
      <PageTitle title="Profit & Loss" action={<RefreshBtn onClick={load} loading={loading} />} />
      <div className="mb-4 flex flex-wrap gap-2">
        {["today", "yesterday", "this_week", "last_week", "this_month", "last_month"].map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === f ? "bg-blue-600 text-white" : "bg-white text-slate-600 shadow-sm"}`}>
            {f.replace(/_/g, " ")}
          </button>
        ))}
      </div>
      {loading ? <LoadingBlock /> : (
        <div className="admin-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Object.entries(cards).map(([k, v]) => (
            <StatCard key={k} label={k} value={typeof v === "number" ? v : String(v)} />
          ))}
        </div>
      )}
    </div>
  );
}
