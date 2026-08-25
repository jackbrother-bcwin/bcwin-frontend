"use client";

import React, { useEffect, useState } from "react";
import PageHeader from "../ui/PageHeader";
import LoadingSpinner from "../ui/LoadingSpinner";
import EmptyState from "../ui/EmptyState";
import StatusBadge from "../ui/StatusBadge";
import { useToast } from "../ui/Toast";
import * as api from "../../lib/api";
import type { UserQuery } from "../../lib/api";
import { formatDateTime } from "../../lib/format";

interface Props {
  onBack: () => void;
}

const TYPES = ["DEPOSIT", "WITHDRAWAL", "BANK_CHANGE", "BONUS"] as const;

export default function FeedbackPage({ onBack }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"new" | "list">("new");
  const [type, setType] = useState<(typeof TYPES)[number]>("DEPOSIT");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [queries, setQueries] = useState<UserQuery[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const loadList = async () => {
    setListLoading(true);
    try {
      const res = await api.getQueries({ page: 1, limit: 30 });
      setQueries(res.queries ?? []);
    } catch {
      setQueries([]);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "list") loadList();
  }, [tab]);

  const handleSubmit = async () => {
    if (subject.trim().length < 5) {
      toast("Subject must be at least 5 characters", "error");
      return;
    }
    setLoading(true);
    try {
      await api.submitQuery({
        type,
        subject: subject.trim(),
        details: { description: description.trim() },
      });
      toast("Query submitted", "success");
      setSubject("");
      setDescription("");
      setTab("list");
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Submit failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen pb-8" style={{ background: "#110D14" }}>
      <PageHeader title="Feedback" onBack={onBack} />

      <div className="mx-3 mt-3 grid grid-cols-2 gap-1 p-1 rounded-[10px]" style={{ background: "#382E35" }}>
        {(["new", "list"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="h-9 rounded-lg text-[14px] font-bold"
            style={{
              background: tab === t ? "linear-gradient(180deg, #FED358 0%, #FFB472 100%)" : "transparent",
              color: tab === t ? "#110D14" : "rgba(255,255,255,0.55)",
            }}
          >
            {t === "new" ? "New query" : "My tickets"}
          </button>
        ))}
      </div>

      {tab === "new" ? (
        <div className="mx-3 mt-4 space-y-3">
          <div>
            <p className="text-[13px] text-white/50 mb-1.5">Type</p>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className="h-9 rounded-lg text-[12px] font-bold"
                  style={{
                    background: type === t ? "rgba(254,211,88,0.15)" : "#382E35",
                    color: type === t ? "#FED358" : "rgba(255,255,255,0.55)",
                    border: type === t ? "1px solid rgba(254,211,88,0.45)" : "1px solid transparent",
                  }}
                >
                  {t.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[13px] text-white/50 mb-1.5">Subject</p>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary"
              className="w-full h-11 rounded-xl px-4 text-sm text-white outline-none"
              style={{ background: "#382E35", border: "1px solid rgba(255,255,255,0.08)" }}
            />
          </div>
          <div>
            <p className="text-[13px] text-white/50 mb-1.5">Details</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe your issue…"
              className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none resize-none"
              style={{ background: "#382E35", border: "1px solid rgba(255,255,255,0.08)" }}
            />
          </div>
          <button
            disabled={loading}
            onClick={handleSubmit}
            className="w-full h-12 rounded-full font-bold text-sm text-[#110D14] disabled:opacity-60"
            style={{ background: "linear-gradient(180deg, #FED358 0%, #FFB472 100%)" }}
          >
            {loading ? "Submitting…" : "Submit"}
          </button>
        </div>
      ) : listLoading ? (
        <LoadingSpinner />
      ) : queries.length === 0 ? (
        <EmptyState title="No tickets yet" />
      ) : (
        <div className="px-3 mt-3 space-y-2">
          {queries.map((q) => (
            <div key={q.id} className="rounded-[10px] p-3"
              style={{ background: "#241E22", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex justify-between items-start gap-2">
                <p className="text-[14px] font-bold text-white">{q.subject}</p>
                <StatusBadge status={q.status} />
              </div>
              <p className="text-[12px] text-white/40 mt-1">{q.type} · {q.ticketId}</p>
              <p className="text-[12px] text-white/30 mt-0.5">{formatDateTime(q.createdAt)}</p>
              {q.adminNotes && (
                <p className="text-[13px] text-[#FED358]/80 mt-2">Admin: {q.adminNotes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
