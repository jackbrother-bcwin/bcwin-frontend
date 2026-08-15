"use client";
import ResourcePage from "../../_resource/ResourcePage";
import * as admin from "../../../../lib/admin-api";
export default function Page() {
  return (
    <ResourcePage
      title="Game history"
      subtitle="Admin bet ledger"
      loader={async () => {
        const r = await admin.listGameHistory({ page: 1, limit: 50 });
        const d = r.data ?? r.bets ?? [];
        return Array.isArray(d) ? d : [];
      }}
    />
  );
}
