"use client";

import React, { useEffect, useState } from "react";
import PageHeader from "../ui/PageHeader";
import LoadingSpinner from "../ui/LoadingSpinner";
import EmptyState from "../ui/EmptyState";
import * as api from "../../lib/api";
import type { Notification } from "../../lib/api";
import { formatDateTime } from "../../lib/format";

interface Props {
  onBack: () => void;
}

export default function NotificationsPage({ onBack }: Props) {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getNotifications()
      .then((r) => setItems(r.notifications ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-screen pb-8" style={{ background: "#110D14" }}>
      <PageHeader title="Notifications" onBack={onBack} />
      {loading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState title="No notifications" />
      ) : (
        <div className="px-3 mt-2 space-y-2">
          {items.map((n) => (
            <div key={n.id} className="rounded-[10px] p-3"
              style={{ background: "#241E22", border: "1px solid rgba(254,211,88,0.12)" }}>
              <div className="flex justify-between items-start gap-2">
                <p className="text-[14px] font-bold text-white">{n.title}</p>
                <span className="text-[11px] text-[#FED358] shrink-0 uppercase">{n.importance}</span>
              </div>
              <p className="text-[13px] text-white/55 mt-1 leading-relaxed">{n.message}</p>
              <p className="text-[12px] text-white/30 mt-2">{formatDateTime(n.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
