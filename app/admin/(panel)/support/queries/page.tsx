"use client";

import React, { useCallback, useEffect, useState } from "react";
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
import BulkBar from "../../../components/BulkBar";
import { AdminPieChart } from "../../../components/Charts";
import { formatIstDateTime } from "../../../../lib/ist-day";
import {
  IoCopyOutline,
  IoCheckmark,
  IoClose,
  IoOpenOutline,
  IoPersonOutline,
  IoImageOutline,
  IoSearchOutline,
  IoInformationCircleOutline,
  IoChatboxEllipsesOutline,
} from "react-icons/io5";

const STATUSES = ["CREATED", "VERIFIED", "PROCESSING", "COMPLETED", "REJECTED"] as const;
const TYPES = ["DEPOSIT", "WITHDRAWAL", "GAME", "ACCOUNT", "OTHER"] as const;

// Safe stringify utility with cycle detection & depth cap to prevent stack overflow
function safeStringify(obj: unknown, maxDepth = 4): string {
  const seen = new WeakSet();
  try {
    return JSON.stringify(
      obj,
      (key, value) => {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) return "[Circular]";
          seen.add(value);
        }
        return value;
      },
      2
    );
  } catch {
    return String(obj);
  }
}

// Helper to extract description or message from query details
function getQueryDescription(details: unknown): string {
  if (!details) return "";
  if (typeof details === "string") return details;
  if (typeof details === "object" && details !== null) {
    const d = details as Record<string, unknown>;
    const val = d.description || d.message || d.note || d.remarks || d.reason || d.issue;
    if (typeof val === "string") return val;
    if (typeof val === "object" && val !== null) return safeStringify(val);
    return typeof d.details === "string" ? d.details : "";
  }
  return "";
}

// Helper to detect proof screenshot/image URL in details
function getProofImageUrl(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const d = details as Record<string, unknown>;
  const candidateKeys = ["proofUrl", "imageUrl", "screenshot", "attachment", "proof", "image", "fileUrl"];
  for (const k of candidateKeys) {
    if (typeof d[k] === "string" && String(d[k]).trim().length > 0) {
      return String(d[k]).trim();
    }
  }
  for (const val of Object.values(d)) {
    if (typeof val === "string") {
      const v = val.trim();
      if (
        v.startsWith("http") &&
        (v.match(/\.(jpeg|jpg|gif|png|webp)/i) || v.includes("/uploads/") || v.includes("cloudinary") || v.includes("s3"))
      ) {
        return v;
      }
    }
  }
  return null;
}

export default function QueriesPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("COMPLETED");
  const [bulkNotes, setBulkNotes] = useState("");
  const [busy, setBusy] = useState(false);

  // Active query for detail modal view
  const [activeQuery, setActiveQuery] = useState<Record<string, unknown> | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await admin.listQueries({
        page,
        limit: 20,
        status: statusFilter || undefined,
      });
      setRows(res.queries ?? []);
      const totalCount = typeof res.total === "number" ? res.total : 0;
      setTotalPages(Math.max(1, Math.ceil(totalCount / 20)));
      setSelected(new Set());
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load support queries", "error");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast("Copied to clipboard!", "success");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const updateSingleStatus = async (id: string, newStatus: string, notesToSave?: string) => {
    try {
      const res = await admin.updateQueryStatus(id, {
        status: newStatus,
        adminNotes: notesToSave,
      });
      toast(res.message || `Query updated to ${newStatus}`, "success");
      
      if (activeQuery && String(activeQuery.id) === id) {
        setActiveQuery((prev) => (prev ? { ...prev, status: newStatus, adminNotes: notesToSave ?? prev.adminNotes } : null));
      }
      load();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Update failed", "error");
    }
  };

  const applyBulk = async (ids: string[], newStatus: string) => {
    if (!ids.length) return;
    if (!confirm(`Set ${ids.length} queries to ${newStatus}?`)) return;
    setBusy(true);
    let ok = 0;
    for (const id of ids) {
      try {
        await admin.updateQueryStatus(id, { status: newStatus, adminNotes: bulkNotes || undefined });
        ok++;
      } catch {
        /* continue */
      }
    }
    toast(`Updated ${ok}/${ids.length} queries to ${newStatus}`, ok === ids.length ? "success" : "error");
    setBusy(false);
    load();
  };

  // Filter rows locally by search and type
  const filteredRows = rows.filter((r) => {
    if (typeFilter && String(r.type).toUpperCase() !== typeFilter.toUpperCase()) {
      return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const ticketId = String(r.ticketId || "").toLowerCase();
    const subject = String(r.subject || "").toLowerCase();
    const desc = getQueryDescription(r.details).toLowerCase();
    const userObj = (r.user as Record<string, unknown>) || {};
    const username = String(userObj.username || "").toLowerCase();
    const mobile = String(userObj.mobileNumber || "").toLowerCase();
    const serial = String(userObj.serialNumber || "").toLowerCase();

    return (
      ticketId.includes(q) ||
      subject.includes(q) ||
      desc.includes(q) ||
      username.includes(q) ||
      mobile.includes(q) ||
      serial.includes(q)
    );
  });

  const pie = STATUSES.map((s) => ({
    name: s,
    value: rows.filter((r) => String(r.status) === s).length,
  })).filter((x) => x.value > 0);

  return (
    <div className="space-y-4">
      <PageTitle
        title="Support queries"
        subtitle="View support ticket details, attachments, user details, and update status"
        action={<RefreshBtn onClick={load} loading={loading} />}
      />

      <BulkBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        actions={[
          {
            label: `Set selected → ${bulkStatus}`,
            variant: "primary",
            icon: "check",
            disabled: busy || !selected.size,
            onClick: () => applyBulk([...selected], bulkStatus),
          },
          {
            label: "Complete ALL open on page",
            variant: "success",
            icon: "check",
            disabled: busy,
            onClick: () =>
              applyBulk(
                rows
                  .filter((r) => !["COMPLETED", "REJECTED"].includes(String(r.status)))
                  .map((r) => String(r.id)),
                "COMPLETED"
              ),
          },
          {
            label: "Reject ALL open on page",
            variant: "danger",
            icon: "close",
            disabled: busy,
            onClick: () =>
              applyBulk(
                rows
                  .filter((r) => !["COMPLETED", "REJECTED"].includes(String(r.status)))
                  .map((r) => String(r.id)),
                "REJECTED"
              ),
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <AdminPieChart data={pie} title="Status mix (page)" height={200} />
        </div>
        <Surface title="Bulk & filter controls" className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Target status for bulk</label>
              <select className="admin-input" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Filter by Query Type</label>
              <select className="admin-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All Types</option>
                {TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-500">Admin notes (applied on bulk update)</label>
              <input className="admin-input" value={bulkNotes} onChange={(e) => setBulkNotes(e.target.value)} placeholder="Optional bulk resolution note..." />
            </div>
          </div>
        </Surface>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-400 mr-1">Status:</span>
          {["", ...STATUSES].map((s) => (
            <button
              key={s || "all"}
              type="button"
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${statusFilter === s ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
            >
              {s || "All"}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative min-w-[240px]">
          <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            className="admin-input pl-9 text-xs"
            placeholder="Search ticket, username, mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Main Queries Listing Surface */}
      <Surface>
        {loading ? (
          <LoadingBlock label="Loading support queries..." />
        ) : filteredRows.length === 0 ? (
          <EmptyBlock label="No support queries match your search or filter" />
        ) : (
          <div className="space-y-3">
            {filteredRows.map((q) => {
              const id = String(q.id);
              const ticketId = String(q.ticketId || id.slice(0, 8));
              const subject = String(q.subject || "No subject");
              const queryType = String(q.type || "OTHER");
              const currentStatus = String(q.status || "CREATED");
              const userObj = (q.user as Record<string, unknown>) || {};
              const username = String(userObj.username || "Unknown User");
              const mobile = String(userObj.mobileNumber || "");
              const serial = userObj.serialNumber ? `#${userObj.serialNumber}` : "";
              const description = getQueryDescription(q.details);
              const proofUrl = getProofImageUrl(q.details);
              const adminNotes = String(q.adminNotes || "");
              const createdAt = q.createdAt ? formatIstDateTime(q.createdAt) : "";

              return (
                <div
                  key={id}
                  className="group rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={selected.has(id)}
                      onChange={(e) => {
                        const n = new Set(selected);
                        e.target.checked ? n.add(id) : n.delete(id);
                        setSelected(n);
                      }}
                    />

                    <div className="min-w-0 flex-1 space-y-2">
                      {/* Top Header Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(ticketId, id)}
                            className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-mono font-bold text-slate-700 hover:bg-slate-200"
                            title="Click to copy ticket ID"
                          >
                            {ticketId}
                            {copiedId === id ? (
                              <IoCheckmark className="text-emerald-600" size={12} />
                            ) : (
                              <IoCopyOutline size={12} className="text-slate-400" />
                            )}
                          </button>
                          <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-100">
                            {queryType}
                          </span>
                          <span className="text-[11px] text-slate-400">{createdAt}</span>
                        </div>
                        <Badge status={currentStatus} />
                      </div>

                      {/* Subject & User Info */}
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold text-slate-900 leading-snug group-hover:text-blue-600 transition-colors">
                            {subject}
                          </h3>
                          {/* User metadata */}
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                              <IoPersonOutline size={13} className="text-slate-400" />
                              {username} {serial && <span className="text-slate-400 font-normal">({serial})</span>}
                            </span>
                            {mobile && <span className="font-mono text-slate-500">{mobile}</span>}
                          </div>
                        </div>

                        {/* View Full Details Button */}
                        <button
                          type="button"
                          onClick={() => setActiveQuery(q)}
                          className="admin-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
                        >
                          <IoInformationCircleOutline size={15} />
                          View Details
                        </button>
                      </div>

                      {/* Description / Details Preview */}
                      {description && (
                        <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700 line-clamp-2 border border-slate-100 font-normal">
                          {description}
                        </div>
                      )}

                      {/* Bottom Quick Action Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {proofUrl && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
                              <IoImageOutline size={13} /> Proof Screenshot Attached
                            </span>
                          )}
                          {adminNotes && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 italic max-w-xs truncate">
                              <IoChatboxEllipsesOutline size={13} className="text-slate-400 shrink-0" />
                              Notes: {adminNotes}
                            </span>
                          )}
                        </div>

                        {/* Quick Status Buttons */}
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[10px] font-semibold text-slate-400 mr-1">Quick set:</span>
                          {STATUSES.map((s) => (
                            <button
                              key={s}
                              type="button"
                              disabled={busy || currentStatus === s}
                              onClick={() => updateSingleStatus(id, s)}
                              className={`rounded px-2 py-0.5 text-[10px] font-bold transition-all ${
                                currentStatus === s
                                  ? "bg-slate-200 text-slate-500 cursor-default opacity-60"
                                  : s === "COMPLETED"
                                  ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                  : s === "REJECTED"
                                  ? "bg-red-100 text-red-800 hover:bg-red-200"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onPage={setPage} />
      </Surface>

      {/* Detail Modal Component */}
      {activeQuery && (
        <QueryDetailModal
          query={activeQuery}
          onClose={() => setActiveQuery(null)}
          onUpdateStatus={updateSingleStatus}
        />
      )}
    </div>
  );
}

interface QueryUser {
  id?: string;
  serialNumber?: number;
  username?: string;
  mobileNumber?: string;
}

function UserCard({ user }: { user: QueryUser }): React.JSX.Element {
  const username = String(user.username || "N/A");
  const mobile = String(user.mobileNumber || "N/A");
  const serial = typeof user.serialNumber === "number" ? `#${user.serialNumber}` : String(user.id || "").slice(0, 8);

  return (
    <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          User Information
        </h3>
        <button
          type="button"
          onClick={() => {
            window.open(`/admin/users?search=${encodeURIComponent(username !== "N/A" ? username : mobile)}`, "_blank");
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
        >
          View in Users Admin <IoOpenOutline size={12} />
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3 text-xs">
        <div>
          <span className="text-slate-400 block text-[11px]">Username</span>
          <span className="font-bold text-slate-800">{username}</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[11px]">Mobile</span>
          <span className="font-mono font-semibold text-slate-800">{mobile}</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[11px]">Serial / ID</span>
          <span className="font-mono font-semibold text-slate-800">{serial}</span>
        </div>
      </div>
    </div>
  );
}

interface QueryRecord {
  id?: string;
  ticketId?: string;
  type?: string;
  status?: string;
  subject?: string;
  details?: any;
  adminNotes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  user?: QueryUser | null;
}

function QueryDetailModal({
  query,
  onClose,
  onUpdateStatus,
}: {
  query: QueryRecord;
  onClose: () => void;
  onUpdateStatus: (id: string, status: string, notes?: string) => Promise<void>;
}): React.JSX.Element {
  const [notesInput, setNotesInput] = useState(String(query.adminNotes ?? ""));
  const [submitting, setSubmitting] = useState(false);

  const description = getQueryDescription(query.details);
  const proofUrl = getProofImageUrl(query.details);

  const handleStatusChange = async (newStatus: string) => {
    setSubmitting(true);
    try {
      await onUpdateStatus(String(query.id), newStatus, notesInput);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 sm:p-6 shadow-2xl space-y-5 border border-slate-200 admin-fade-up">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                {String(query.ticketId || query.id)}
              </span>
              <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 border border-blue-100">
                {String(query.type || "OTHER")}
              </span>
              <Badge status={String(query.status || "CREATED")} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 leading-snug">
              {String(query.subject || "Support Ticket Details")}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Submitted on: {query.createdAt ? formatIstDateTime(query.createdAt) : "N/A"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all"
          >
            <IoClose size={22} />
          </button>
        </div>

        {/* User Details Card */}
        {query.user ? <UserCard user={query.user} /> : null}

        {/* Full Query Message / Description */}
        <div>
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Ticket Description / Message
          </h3>
          <div className="rounded-xl bg-slate-900 p-4 text-xs font-mono text-slate-100 whitespace-pre-wrap leading-relaxed shadow-inner max-h-60 overflow-y-auto">
            {description || String(query.subject || "No text description provided")}
          </div>
        </div>

        {/* Key-Value Details Grid */}
        {query.details && typeof query.details === "object" && (
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Additional Details & Attributes
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(query.details as Record<string, unknown>).map(([k, v]) => {
                if (["proofUrl", "imageUrl", "screenshot", "attachment", "proof", "image"].includes(k)) {
                  return null;
                }
                if (typeof v === "object" && v !== null) {
                  return (
                    <div key={k} className="sm:col-span-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
                      <span className="font-bold text-slate-600 block mb-1">{k}:</span>
                      <pre className="text-[11px] font-mono text-slate-700 bg-slate-50 p-2 rounded overflow-x-auto">
                        {safeStringify(v)}
                      </pre>
                    </div>
                  );
                }
                return (
                  <div key={k} className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
                    <span className="font-medium text-slate-400 block text-[10px] uppercase tracking-wider">{k}</span>
                    <span className="font-bold text-slate-800 font-mono break-all">{String(v)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Attached Proof Screenshot / Image */}
        {proofUrl && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-xs font-bold text-amber-900 inline-flex items-center gap-1.5">
                <IoImageOutline size={16} /> Attached Proof Screenshot
              </h3>
              <a
                href={proofUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:underline"
              >
                Open Original Image <IoOpenOutline size={12} />
              </a>
            </div>
            <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 max-h-96 flex items-center justify-center">
              <img
                src={proofUrl}
                alt="Proof Screenshot"
                className="max-h-96 w-auto object-contain cursor-pointer hover:opacity-95 transition-opacity"
                onClick={() => window.open(proofUrl, "_blank")}
              />
            </div>
          </div>
        )}

        {/* Admin Notes & Resolution Section */}
        <div className="border-t border-slate-200 pt-4 space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Admin Resolution Notes
            </label>
            <textarea
              className="admin-input w-full h-24 p-3 text-xs"
              placeholder="Enter internal notes, resolution details, or reasons for rejection..."
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
            />
          </div>

          {/* Status Update Action Buttons */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Update Ticket Status
            </label>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleStatusChange(s)}
                  className={`min-h-10 rounded-lg text-xs font-bold transition-all shadow-sm ${
                    String(query.status) === s
                      ? "bg-slate-900 text-white ring-2 ring-slate-900 ring-offset-1"
                      : s === "COMPLETED"
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : s === "REJECTED"
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : s === "PROCESSING"
                      ? "bg-amber-500 text-white hover:bg-amber-600"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {submitting && String(query.status) === s ? "Updating..." : `Set ${s}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="admin-btn-ghost text-xs px-4"
          >
            Close Modal
          </button>
        </div>
      </div>
    </div>
  );
}
