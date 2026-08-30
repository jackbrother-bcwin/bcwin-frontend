"use client";

import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "../../../components/ui/Toast";
import * as admin from "../../../lib/admin-api";
import { AdminHubLink, AdminUserCell } from "../../components/AdminUserCell";
import {
  EmptyBlock,
  LoadingBlock,
  PageTitle,
  Pagination,
  RefreshBtn,
  Surface,
  TableWrap,
} from "../../components/ui";

type UserRow = Record<string, unknown>;

function userId(user: UserRow): string {
  return String(user.id ?? "");
}

function formatAddedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function SalaryLeadersPage() {
  const { toast } = useToast();
  const [leaders, setLeaders] = useState<admin.SalaryLeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [listSearch, setListSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [userSearch, setUserSearch] = useState("");
  const [candidates, setCandidates] = useState<UserRow[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateSearched, setCandidateSearched] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const loadLeaders = useCallback(async () => {
    setLoading(true);
    try {
      const result = await admin.listSalaryLeaders({
        page,
        limit: 20,
        search: appliedSearch || undefined,
      });
      setLeaders(result.leaders);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to load Salary Leaders", "error");
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, page, toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadLeaders(), 0);
    return () => window.clearTimeout(timer);
  }, [loadLeaders]);

  const listedUserIds = useMemo(
    () => new Set(leaders.map((leader) => leader.userId)),
    [leaders]
  );

  const applyListSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(listSearch.trim());
  };

  const searchUsers = async (event: FormEvent) => {
    event.preventDefault();
    const search = userSearch.trim();
    if (!search) {
      toast("Enter a username, mobile number, serial number, or email", "error");
      return;
    }

    setCandidateLoading(true);
    setCandidateSearched(true);
    try {
      const result = await admin.listUsers({ page: 1, limit: 10, search });
      setCandidates(result.users ?? []);
    } catch (error) {
      setCandidates([]);
      toast(error instanceof Error ? error.message : "Failed to search users", "error");
    } finally {
      setCandidateLoading(false);
    }
  };

  const addUser = async (user: UserRow) => {
    const id = userId(user);
    if (!id) return;

    setBusyUserId(id);
    try {
      await admin.addSalaryLeader(id);
      toast(`${String(user.username ?? "User")} added to Salary Leaders`, "success");
      await loadLeaders();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to add user", "error");
    } finally {
      setBusyUserId(null);
    }
  };

  const removeUser = async (leader: admin.SalaryLeader) => {
    const confirmed = window.confirm(
      `Remove ${leader.user.username} from Salary Leaders? The user account will not be deleted.`
    );
    if (!confirmed) return;

    setBusyUserId(leader.userId);
    try {
      await admin.deleteSalaryLeader(leader.userId);
      toast("User removed from Salary Leaders", "success");
      if (leaders.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await loadLeaders();
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to remove user", "error");
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageTitle
        title="Salary Leaders"
        subtitle="Maintain a simple, searchable list of selected users"
        action={<RefreshBtn onClick={loadLeaders} loading={loading} />}
      />

      <Surface title="Add user">
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={searchUsers}>
          <input
            className="admin-input min-w-0 flex-1"
            value={userSearch}
            onChange={(event) => setUserSearch(event.target.value)}
            placeholder="Search username, mobile, serial, email, or user ID"
            aria-label="Search users to add"
          />
          <button
            type="submit"
            className="admin-btn-primary min-h-10 text-xs"
            disabled={candidateLoading}
          >
            {candidateLoading ? "Searching…" : "Find user"}
          </button>
        </form>

        <div className="mt-3">
          {candidateLoading ? (
            <LoadingBlock label="Searching users…" />
          ) : candidates.length > 0 ? (
            <TableWrap>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Type</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((user) => {
                    const id = userId(user);
                    const alreadyAdded = listedUserIds.has(id);
                    return (
                      <tr key={id}>
                        <td><AdminUserCell user={user} /></td>
                        <td>{String(user.role ?? "—")}</td>
                        <td>{user.isDemo ? "Demo" : "Real"}</td>
                        <td>
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <AdminHubLink userId={id} />
                            <button
                              type="button"
                              className="admin-btn-primary text-xs"
                              disabled={alreadyAdded || busyUserId === id}
                              onClick={() => void addUser(user)}
                            >
                              {alreadyAdded
                                ? "Added"
                                : busyUserId === id
                                  ? "Adding…"
                                  : "Add"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          ) : candidateSearched ? (
            <EmptyBlock label="No matching users found" />
          ) : (
            <p className="text-xs text-slate-500">
              Search first, then choose the exact user to add.
            </p>
          )}
        </div>
      </Surface>

      <Surface
        title={`Salary Leaders (${total.toLocaleString("en-IN")})`}
        action={
          <form className="flex min-w-0 gap-2" onSubmit={applyListSearch}>
            <input
              className="admin-input !h-9 min-w-0 w-52 !text-xs"
              value={listSearch}
              onChange={(event) => setListSearch(event.target.value)}
              placeholder="Search this list…"
              aria-label="Search Salary Leaders"
            />
            <button type="submit" className="admin-btn-ghost min-h-9 text-xs">
              Search
            </button>
          </form>
        }
      >
        {loading ? (
          <LoadingBlock label="Loading Salary Leaders…" />
        ) : leaders.length === 0 ? (
          <EmptyBlock label={appliedSearch ? "No matching Salary Leaders" : "No users added yet"} />
        ) : (
          <>
            <TableWrap>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Type</th>
                    <th>Added</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaders.map((leader) => (
                    <tr key={leader.id}>
                      <td><AdminUserCell user={leader.user} /></td>
                      <td>{leader.user.role}</td>
                      <td>{leader.user.isDemo ? "Demo" : "Real"}</td>
                      <td className="whitespace-nowrap text-xs text-slate-500">
                        {formatAddedAt(leader.createdAt)}
                      </td>
                      <td>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <AdminHubLink userId={leader.userId} />
                          <button
                            type="button"
                            className="admin-btn-danger text-xs"
                            disabled={busyUserId === leader.userId}
                            onClick={() => void removeUser(leader)}
                          >
                            {busyUserId === leader.userId ? "Removing…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <Pagination page={page} totalPages={totalPages} onPage={setPage} />
          </>
        )}
      </Surface>
    </div>
  );
}
