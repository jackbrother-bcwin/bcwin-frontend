"use client";

/**
 * Admin · Inout games
 * - GET /admin/update-inout-games → sync provider catalog into DB
 * - GET /inout/games → browse / filter stored games
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as admin from "../../../lib/admin-api";
import type { InoutGame, InoutGameCategory } from "../../../lib/admin-api";
import { useToast } from "../../../components/ui/Toast";
import { formatIstDateTime } from "../../../lib/ist-day";
import {
  EmptyBlock,
  LoadingBlock,
  PageTitle,
  RefreshBtn,
  Surface,
} from "../../components/ui";

const CATEGORIES: { id: InoutGameCategory | ""; label: string }[] = [
  { id: "", label: "All categories" },
  { id: "instant", label: "Instant" },
  { id: "crash_game", label: "Crash" },
  { id: "slots", label: "Slots" },
  { id: "roulette", label: "Roulette" },
];

function formatRtp(n: number): string {
  if (!Number.isFinite(n)) return "—";
  // API may send 0.96 or 96
  const pct = n > 0 && n <= 1 ? n * 100 : n;
  return `${pct.toFixed(2)}%`;
}

function categoryBadgeClass(cat: string): string {
  switch (cat) {
    case "slots":
      return "bg-violet-100 text-violet-800";
    case "crash_game":
      return "bg-rose-100 text-rose-800";
    case "instant":
      return "bg-amber-100 text-amber-900";
    case "roulette":
      return "bg-emerald-100 text-emerald-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function InoutGamesAdminPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<InoutGame[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(24);
  const [category, setCategory] = useState<InoutGameCategory | "">("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await admin.listInoutGames({
        page,
        limit,
        category: category || undefined,
        search: search.trim() || undefined,
      });
      setRows(Array.isArray(res.data) ? res.data : []);
      setTotal(Number(res.total ?? 0));
      setTotalPages(Math.max(1, Number(res.totalPages ?? 1)));
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load games", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, category, search, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const sync = async () => {
    if (syncing) return;
    if (
      !confirm(
        "Pull the latest game catalog from Inout and upsert into the database? This may take a minute."
      )
    ) {
      return;
    }
    setSyncing(true);
    try {
      await admin.updateInoutGames();
      // Bust player-app catalog cache (module store on next home visit)
      try {
        const { invalidateInoutCatalog } = await import(
          "../../../lib/inout-catalog-store"
        );
        invalidateInoutCatalog();
      } catch {
        /* optional */
      }
      toast("Inout games updated from provider", "success");
      setPage(1);
      await load();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Sync failed", "error");
    } finally {
      setSyncing(false);
    }
  };

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const stats = useMemo(() => {
    const byCat = new Map<string, number>();
    for (const r of rows) {
      const c = String(r.category || "other");
      byCat.set(c, (byCat.get(c) ?? 0) + 1);
    }
    return { pageCount: rows.length, byCat };
  }, [rows]);

  return (
    <div>
      <PageTitle
        title="Inout games"
        subtitle="Third-party catalog · sync provider → DB · browse & filter"
        action={
          <div className="flex flex-wrap gap-2">
            <RefreshBtn onClick={() => void load()} />
            <button
              type="button"
              disabled={syncing}
              className="admin-btn-primary"
              onClick={() => void sync()}
            >
              {syncing ? "Updating…" : "Update Inout games"}
            </button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Surface className="!p-0">
          <div className="px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Total in DB
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-slate-800">
              {total.toLocaleString("en-IN")}
            </p>
          </div>
        </Surface>
        <Surface className="!p-0">
          <div className="px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              This page
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-slate-800">
              {stats.pageCount}
            </p>
          </div>
        </Surface>
        <Surface className="!p-0 sm:col-span-2">
          <div className="px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Sync
            </p>
            <p className="mt-1 text-[13px] leading-snug text-slate-600">
              <code className="rounded bg-slate-100 px-1 text-[12px]">
                GET /admin/update-inout-games
              </code>{" "}
              fetches the provider list and upserts{" "}
              <code className="rounded bg-slate-100 px-1 text-[12px]">
                InoutGame
              </code>{" "}
              rows (title, gameMode, icon, category, RTP…).
            </p>
          </div>
        </Surface>
      </div>

      <Surface
        title="Catalog"
        action={
          <form
            onSubmit={applySearch}
            className="flex flex-wrap items-center gap-2"
          >
            <select
              className="admin-input !w-auto min-w-[140px]"
              value={category}
              onChange={(e) => {
                setPage(1);
                setCategory(e.target.value as InoutGameCategory | "");
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.id || "all"} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              className="admin-input !w-auto min-w-[160px]"
              placeholder="Search title…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button type="submit" className="admin-btn-ghost text-sm">
              Search
            </button>
          </form>
        }
      >
        {loading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyBlock label="No Inout games yet — click “Update Inout games” to sync from the provider." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Icon</th>
                    <th>Title</th>
                    <th>gameMode</th>
                    <th>Category</th>
                    <th>RTP</th>
                    <th>MP</th>
                    <th>Bonuses</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((g) => (
                    <tr key={g.id}>
                      <td>
                        <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-slate-100">
                          {g.icon ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={g.icon}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="flex h-full items-center justify-center text-[10px] text-slate-400">
                              —
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <p className="font-semibold text-slate-800">{g.title}</p>
                        {g.description && (
                          <p className="max-w-[220px] truncate text-[11px] text-slate-400">
                            {g.description}
                          </p>
                        )}
                      </td>
                      <td>
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">
                          {g.gameMode}
                        </code>
                      </td>
                      <td>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${categoryBadgeClass(String(g.category))}`}
                        >
                          {String(g.category).replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="tabular-nums text-sm">
                        {formatRtp(Number(g.rtp))}
                      </td>
                      <td className="text-sm">
                        {g.multiplayer ? (
                          <span className="font-semibold text-emerald-600">
                            Yes
                          </span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </td>
                      <td className="max-w-[140px] truncate text-[11px] text-slate-500">
                        {(g.bonusTypes ?? []).join(", ") || "—"}
                      </td>
                      <td className="whitespace-nowrap text-[11px] text-slate-500">
                        {g.updatedAt
                          ? formatIstDateTime(g.updatedAt)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <p className="text-[12px] text-slate-500">
                Page {page} of {totalPages} · {total.toLocaleString("en-IN")}{" "}
                games
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="admin-btn-ghost text-sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="admin-btn-ghost text-sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Surface>
    </div>
  );
}
