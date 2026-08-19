"use client";

import NextLink from "next/link";

/** Same identity block as Finance → Withdrawals (ADR-0026). */
export function AdminUserCell({
  user,
  bank,
  showHub = false,
}: {
  user?: Record<string, unknown> | null;
  bank?: { fullName?: string | null } | null;
  showHub?: boolean;
}) {
  const u = user ?? {};
  const uid = String(u.id ?? "");
  const username = String(u.username ?? "—");
  const serial = u.serialNumber != null ? String(u.serialNumber) : "—";
  const mobile = String(u.mobileNumber ?? "").trim() || "—";
  const email = String(u.email ?? "").trim();
  const fromUserBank = (u.bank as { fullName?: string } | null | undefined)?.fullName;
  const legal = String(bank?.fullName ?? fromUserBank ?? "").trim();

  return (
    <div className="min-w-[12rem]">
      <p className="text-[12px] font-bold text-slate-800">{username}</p>
      {legal && legal !== username ? (
        <p className="text-[10px] text-slate-500">{legal}</p>
      ) : null}
      <p className="text-[11px] text-slate-600 tabular-nums">
        #{serial}
        <span className="text-slate-300"> · </span>
        {mobile}
      </p>
      {email ? (
        <p className="text-[11px] text-slate-500 break-all">{email}</p>
      ) : null}
      {showHub && uid ? (
        <NextLink
          href={`/admin/users/${uid}`}
          className="mt-1 inline-block admin-btn-ghost text-[11px] no-underline"
        >
          Hub
        </NextLink>
      ) : null}
    </div>
  );
}

export function AdminHubLink({ userId }: { userId?: string }) {
  if (!userId) return null;
  return (
    <NextLink
      href={`/admin/users/${userId}`}
      className="admin-btn-ghost text-[11px] no-underline"
    >
      Hub
    </NextLink>
  );
}
