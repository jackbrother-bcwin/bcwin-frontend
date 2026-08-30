"use client";

/**
 * Separate from illegal-bet *detection* list:
 * Users who currently have an illegal-bet withdrawal penalty,
 * with factor display + increase / decrease / clear.
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import * as admin from "../../../../lib/admin-api";
import { useToast } from "../../../../components/ui/Toast";
import {
  Badge,
  EmptyBlock,
  LoadingBlock,
  PageTitle,
  Pagination,
  RefreshBtn,
  Surface,
} from "../../../components/ui";

type PenaltyUser = {
  id: string;
  serialNumber?: number;
  username?: string;
  mobileNumber?: string;
  balance?: number;
  isBanned?: boolean;
  hasIllegalBetPenalty?: boolean;
  illegalBetPenaltyFactor?: number | null;
};

export default function IllegalBetPenaltiesPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState<PenaltyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [editUser, setEditUser] = useState<PenaltyUser | null>(null);
  const [factorInput, setFactorInput] = useState("3");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await admin.listUsers({
        page,
        limit: 25,
        search: search || undefined,
        hasIllegalBetPenalty: "true",
      });
      setRows((res.users as PenaltyUser[]) ?? []);
      setTotalPages(res.totalPages ?? 1);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load penalty users", "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFactor = async (userId: string, factor: number) => {
    if (!Number.isFinite(factor) || factor < 1) {
      toast("Factor must be ≥ 1", "error");
      return;
    }
    setBusyId(userId);
    try {
      const res = await admin.updateUserPenalty(userId, {
        hasIllegalBetPenalty: true,
        illegalBetPenaltyFactor: factor,
      });
      toast(res.message || `Penalty set to ${factor}x`, "success");
      setEditUser(null);
      void load();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Update failed", "error");
    } finally {
      setBusyId(null);
    }
  };

  const clearPenalty = async (userId: string) => {
    if (!window.confirm("Clear illegal-bet penalty for this user?")) return;
    setBusyId(userId);
    try {
      const res = await admin.updateUserPenalty(userId, {
        hasIllegalBetPenalty: false,
      });
      toast(res.message || "Penalty cleared", "success");
      void load();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Clear failed", "error");
    } finally {
      setBusyId(null);
    }
  };

  const bump = (u: PenaltyUser, delta: number) => {
    const cur = Number(u.illegalBetPenaltyFactor ?? 3);
    const next = Math.max(1, Math.round((cur + delta) * 10) / 10);
    void applyFactor(u.id, next);
  };

  return (
    <div>
      <PageTitle
        title="Penalty users"
        subtitle="Users with active illegal-bet wager penalty — separate from detection list. Adjust factor or clear."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/greebuserrichadmin/illegal-bets"
              className="admin-btn-ghost text-xs no-underline"
            >
              ← Illegal bets (detections)
            </Link>
            <RefreshBtn onClick={load} loading={loading} />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className="admin-input max-w-xs"
          placeholder="Search mobile / username / serial / email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setPage(1);
              void load();
            }
          }}
        />
        <button
          type="button"
          className="admin-btn-secondary text-xs"
          onClick={() => {
            setPage(1);
            void load();
          }}
        >
          Search
        </button>
      </div>

      <Surface className="overflow-x-auto">
        {loading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyBlock label="No users with active penalty" />
        ) : (
          <table className="admin-table w-full text-left text-sm">
            <thead>
              <tr>
                <th>Serial</th>
                <th>User</th>
                <th>Mobile</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Penalty factor</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const factor = Number(u.illegalBetPenaltyFactor ?? 3);
                const busy = busyId === u.id;
                return (
                  <tr key={u.id}>
                    <td className="font-mono">{u.serialNumber ?? "—"}</td>
                    <td className="font-semibold">{u.username ?? "—"}</td>
                    <td>{u.mobileNumber ?? "—"}</td>
                    <td>
                      ₹{Number(u.balance ?? 0).toLocaleString("en-IN")}
                    </td>
                    <td>
                      <Badge status={u.isBanned ? "BANNED" : "ACTIVE"} />
                    </td>
                    <td>
                      <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2.5 py-1 text-sm font-bold text-amber-600 ring-1 ring-inset ring-amber-500/25">
                        {factor}x
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          disabled={busy || factor <= 1}
                          title="Decrease by 0.5"
                          onClick={() => bump(u, -0.5)}
                          className="admin-btn-secondary px-2 py-1 text-xs font-bold disabled:opacity-40"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          title="Increase by 0.5"
                          onClick={() => bump(u, 0.5)}
                          className="admin-btn-secondary px-2 py-1 text-xs font-bold"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className="admin-btn-ghost text-xs"
                          onClick={() => {
                            setEditUser(u);
                            setFactorInput(String(factor));
                          }}
                        >
                          Set…
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className="admin-btn-danger text-xs"
                          onClick={() => void clearPenalty(u.id)}
                        >
                          Clear
                        </button>
                        <Link
                          href={`/greebuserrichadmin/users/${u.id}`}
                          className="text-xs font-bold text-blue-600 hover:underline"
                        >
                          Hub
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Surface>

      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            page={page}
            totalPages={totalPages}
            onPage={setPage}
          />
        </div>
      )}

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900">
              Set penalty factor
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {editUser.username} · current{" "}
              {Number(editUser.illegalBetPenaltyFactor ?? 3)}x · wager multiplier
              for withdrawals
            </p>
            <label className="mt-4 block text-xs font-semibold text-slate-700">
              Factor (×)
            </label>
            <input
              type="number"
              min={1}
              step={0.5}
              className="admin-input mt-1 w-full"
              value={factorInput}
              onChange={(e) => setFactorInput(e.target.value)}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="admin-btn-ghost text-xs"
                onClick={() => setEditUser(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn-primary text-xs"
                disabled={busyId === editUser.id}
                onClick={() =>
                  void applyFactor(editUser.id, Number(factorInput))
                }
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
