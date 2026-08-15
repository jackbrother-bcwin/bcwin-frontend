"use client";
import ResourcePage from "../../_resource/ResourcePage";
import * as admin from "../../../../lib/admin-api";
export default function Page() {
  return (
    <ResourcePage
      title="Balance updates"
      loader={async () => {
        const r = await admin.listBalanceUpdates({ page: 1, limit: 50 });
        const d = (r as { data?: unknown }).data;
        return Array.isArray(d) ? d : [];
      }}
    />
  );
}
