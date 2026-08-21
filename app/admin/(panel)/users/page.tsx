"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import * as admin from "../../../lib/admin-api";
import { useToast } from "../../../components/ui/Toast";
import {
  Badge,
  EmptyBlock,
  LoadingBlock,
  PageTitle,
  Pagination,
  RefreshBtn,
  Surface,
} from "../../components/ui";

export default function UsersListPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [demoFilter, setDemoFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await admin.listUsers({
        page,
        limit: 20,
        search: search || undefined,
        role: role || undefined,
        isDemo: demoFilter || undefined,
      });
      setRows(res.users ?? []);
      setTotalPages(res.totalPages ?? 1);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, role, demoFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageTitle
        title="Users"
        subtitle="Search, inspect, ban, and adjust balances"
        action={
          <div className="flex gap-2">
            <Link href="/admin/users/create" className="admin-btn-primary text-xs no-underline">
              Create user
            </Link>
            <RefreshBtn onClick={load} loading={loading} />
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className="admin-input max-w-xs"
          placeholder="Search mobile / username / serial"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (setPage(1), load())}
        />
        <select
          className="admin-input max-w-[160px]"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All roles</option>
          <option value="USER">USER</option>
          <option value="AGENT">AGENT</option>
          <option value="SUB_ADMIN">SUB_ADMIN</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <select
          className="admin-input max-w-[160px]"
          value={demoFilter}
          onChange={(e) => {
            setDemoFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All (Real & Demo)</option>
          <option value="false">Real only</option>
          <option value="true">Demo only</option>
        </select>
        <button type="button" className="admin-btn-primary text-xs" onClick={() => { setPage(1); load(); }}>
          Search
        </button>
      </div>
      <Surface>
        {loading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyBlock />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Serial</th>
                  <th>Username</th>
                  <th>Mobile</th>
                  <th>Balance</th>
                  <th>Role</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Penalty</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const uid = String(u.id);
                  const isDemo = Boolean(u.isDemo);
                  return (
                    <tr key={uid}>
                      <td className="font-mono">{String(u.serialNumber ?? "—")}</td>
                      <td className="font-semibold">{String(u.username ?? "—")}</td>
                      <td>{String(u.mobileNumber ?? "—")}</td>
                      <td>₹{Number(u.balance ?? 0).toLocaleString("en-IN")}</td>
                      <td>{String(u.role ?? "—")}</td>
                      <td>
                        {isDemo ? (
                          <span className="inline-flex items-center rounded bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700 ring-1 ring-inset ring-purple-600/20">
                            DEMO
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                            REAL
                          </span>
                        )}
                      </td>
                      <td>
                        <Badge status={u.isBanned ? "BANNED" : "ACTIVE"} />
                      </td>
                      <td>
                        {u.hasIllegalBetPenalty ? (
                          <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-500 ring-1 ring-inset ring-amber-500/20">
                            {Number(u.illegalBetPenaltyFactor ?? 3)}x Wager
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">None</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 whitespace-nowrap">
                          <Link
                            href={`/admin/users/${uid}`}
                            className="text-xs font-bold text-blue-600 hover:underline"
                          >
                            Hub
                          </Link>
                          <Link
                            href={`/admin/users/${uid}?tab=salary`}
                            className="text-xs font-semibold text-slate-500 hover:text-blue-600 hover:underline"
                          >
                            Salary
                          </Link>
                          <Link
                            href={`/admin/users/${uid}?tab=deposits`}
                            className="text-xs font-semibold text-slate-500 hover:text-blue-600 hover:underline"
                          >
                            Deposits
                          </Link>
                          <Link
                            href={`/admin/users/${uid}?tab=withdrawals`}
                            className="text-xs font-semibold text-slate-500 hover:text-blue-600 hover:underline"
                          >
                            Withdraw
                          </Link>
                          <Link
                            href={`/admin/users/${uid}?tab=bets`}
                            className="text-xs font-semibold text-slate-500 hover:text-blue-600 hover:underline"
                          >
                            Bets
                          </Link>
                          <Link
                            href={`/admin/users/${uid}?tab=invite`}
                            className="text-xs font-semibold text-slate-500 hover:text-blue-600 hover:underline"
                          >
                            Tree
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} onPage={setPage} />
      </Surface>
    </div>
  );
}
