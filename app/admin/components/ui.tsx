"use client";

import React from "react";
import { IoRefresh } from "react-icons/io5";

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 admin-fade-up sm:mb-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-lg font-bold text-slate-800 sm:text-xl md:text-2xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-[12px] text-slate-500 sm:text-sm">{subtitle}</p>
        )}
      </div>
      {action && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{action}</div>
      )}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="admin-card w-full text-left"
      disabled={!onClick}
    >
      <p className="text-[11px] font-medium text-white/85 sm:text-[12px]">{label}</p>
      <p className="mt-1.5 text-xl font-black tracking-tight tabular-nums sm:mt-2 sm:text-2xl">
        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
      </p>
      {hint && (
        <p className="mt-2 text-[11px] font-semibold text-white/80 underline-offset-2 hover:underline active:underline">
          {hint}
        </p>
      )}
    </button>
  );
}

export function Surface({
  children,
  className = "",
  title,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={`admin-surface min-w-0 ${className}`}>
      {(title || action) && (
        <div className="flex flex-col gap-2 border-b border-slate-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          {title && (
            <h2 className="min-w-0 text-sm font-bold text-slate-700">{title}</h2>
          )}
          {action && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">{action}</div>
          )}
        </div>
      )}
      <div className="admin-surface-body min-w-0 p-3 sm:p-4">{children}</div>
    </section>
  );
}

/** Horizontal scroll wrapper for wide data tables — use around `<table className="admin-table">` */
export function TableWrap({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`admin-table-wrap ${className}`} role="region" aria-label="Scrollable table">
      {children}
    </div>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 sm:py-16">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-blue-100 border-t-blue-600" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

export function EmptyBlock({ label = "No data available" }: { label?: string }) {
  return (
    <div className="py-10 text-center text-sm text-slate-400 sm:py-12">{label}</div>
  );
}

export function RefreshBtn({
  onClick,
  loading,
}: {
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="admin-btn-ghost inline-flex min-h-10 items-center gap-1.5 text-xs active:bg-slate-300"
    >
      <IoRefresh className={loading ? "animate-spin" : ""} size={14} />
      Refresh
    </button>
  );
}

export function Badge({ status }: { status: string }) {
  const s = status.toUpperCase();
  let cls = "bg-slate-100 text-slate-600";
  if (["SUCCESS", "COMPLETED", "ACTIVE", "APPROVED", "WON"].includes(s))
    cls = "bg-emerald-50 text-emerald-700";
  else if (
    ["PROCESSING", "PENDING", "GENERATED", "CREATED", "VERIFIED"].includes(s)
  )
    cls = "bg-amber-50 text-amber-700";
  else if (["FAILED", "REJECTED", "BANNED", "LOST"].includes(s))
    cls = "bg-red-50 text-red-700";
  return <span className={`admin-badge ${cls}`}>{status}</span>;
}

export function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="admin-btn-ghost min-h-10 min-w-[5.5rem] text-xs disabled:opacity-40"
      >
        Previous
      </button>
      <span className="px-2 text-xs font-semibold tabular-nums text-slate-500">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className="admin-btn-ghost min-h-10 min-w-[5.5rem] text-xs disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}

/** Responsive filter / tool row used on list pages */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-filter-bar mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      {children}
    </div>
  );
}
