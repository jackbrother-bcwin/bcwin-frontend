"use client";

import React, { useCallback, useEffect, useState } from "react";
import * as admin from "../../../../lib/admin-api";
import { useToast } from "../../../../components/ui/Toast";
import { EmptyBlock, LoadingBlock, PageTitle, RefreshBtn, Surface } from "../../../components/ui";
import BulkBar from "../../../components/BulkBar";

export default function NotificationsAdminPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [importance, setImportance] = useState("MEDIUM");
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await admin.listNotifications();
      const d = r.notifications ?? r.data ?? [];
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

  return (
    <div>
      <PageTitle title="Notifications" subtitle="Create · edit · bulk delete" action={<RefreshBtn onClick={load} />} />
      <BulkBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        actions={[{
          label: "Delete selected",
          variant: "danger",
          icon: "trash",
          onClick: async () => {
            if (!confirm(`Delete ${selected.size}?`)) return;
            await Promise.all([...selected].map((id) => admin.deleteNotification(id)));
            toast("Deleted", "success");
            setSelected(new Set());
            load();
          },
        }]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Surface title={editId ? "Edit notification" : "Create notification"}>
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const body = { title, message, type: "GLOBAL", importance };
                if (editId) {
                  await admin.updateNotification(editId, body);
                  toast("Updated", "success");
                } else {
                  await admin.createNotification(body);
                  toast("Created", "success");
                }
                setTitle("");
                setMessage("");
                setEditId(null);
                load();
              } catch (err: unknown) {
                toast(err instanceof Error ? err.message : "Failed", "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            <input className="admin-input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <textarea className="admin-input h-24 py-2" placeholder="Message" value={message} onChange={(e) => setMessage(e.target.value)} required />
            <select className="admin-input" value={importance} onChange={(e) => setImportance(e.target.value)}>
              {["LOW", "MEDIUM", "HIGH", "URGENT"].map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="admin-btn-primary">{editId ? "Update" : "Publish"}</button>
              {editId && (
                <button type="button" className="admin-btn-ghost" onClick={() => { setEditId(null); setTitle(""); setMessage(""); }}>Cancel</button>
              )}
            </div>
          </form>
        </Surface>
        <Surface title="All notifications">
          {loading ? <LoadingBlock /> : rows.length === 0 ? <EmptyBlock /> : (
            <div className="max-h-[420px] space-y-2 overflow-y-auto">
              {rows.map((n) => {
                const id = String(n.id);
                return (
                  <div key={id} className="flex gap-2 rounded-lg border border-slate-100 p-3">
                    <input type="checkbox" checked={selected.has(id)} onChange={(e) => {
                      const s = new Set(selected);
                      e.target.checked ? s.add(id) : s.delete(id);
                      setSelected(s);
                    }} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm">{String(n.title)}</p>
                      <p className="text-xs text-slate-500 line-clamp-2">{String(n.message)}</p>
                      <div className="mt-1 flex gap-2">
                        <button type="button" className="text-[11px] font-bold text-blue-600" onClick={() => {
                          setEditId(id);
                          setTitle(String(n.title ?? ""));
                          setMessage(String(n.message ?? ""));
                          setImportance(String(n.importance ?? "MEDIUM"));
                        }}>Edit</button>
                        <button type="button" className="text-[11px] font-bold text-red-600" onClick={async () => {
                          await admin.deleteNotification(id);
                          load();
                        }}>Delete</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Surface>
      </div>
    </div>
  );
}
