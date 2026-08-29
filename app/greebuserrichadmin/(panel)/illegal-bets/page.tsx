"use client";

import Link from "next/link";
import ResourcePage from "../_resource/ResourcePage";
import * as admin from "../../../lib/admin-api";
import { PageTitle, Surface } from "../../components/ui";

/**
 * Illegal bets hub:
 * 1) Detection list (hedge / illegal bet events) — unchanged
 * 2) Link to separate Penalty users page (who has Nx factor + adjust)
 */
export default function Page() {
  return (
    <div className="space-y-4">
      <PageTitle
        title="Illegal bets"
        subtitle="Detection history of illegal / hedge bets. Manage user penalties on a separate page."
        action={
          <Link
            href="/greebuserrichadmin/illegal-bets/penalties"
            className="admin-btn-primary text-xs no-underline"
          >
            Penalty users →
          </Link>
        }
      />

      <Surface className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-800">
              Users with active penalty
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              See only players with illegal-bet wager factor (e.g. 3x), and
              increase / decrease / clear — not mixed with the detection list.
            </p>
          </div>
          <Link
            href="/greebuserrichadmin/illegal-bets/penalties"
            className="admin-btn-secondary shrink-0 text-xs no-underline"
          >
            Open penalty users
          </Link>
        </div>
      </Surface>

      <ResourcePage
        title="Illegal bets (detections)"
        loader={async () => {
          const r = await admin.listIllegalBets({ page: 1, limit: 50 });
          const d = r.data;
          return Array.isArray(d) ? d : [];
        }}
      />
      <ResourcePage
        title="Illegal bets statistics"
        loader={async () => {
          const r = await admin.getIllegalBetsStats();
          const d = r.data;
          if (Array.isArray(d)) return d;
          if (d && typeof d === "object") return [d as Record<string, unknown>];
          return [];
        }}
      />
    </div>
  );
}
