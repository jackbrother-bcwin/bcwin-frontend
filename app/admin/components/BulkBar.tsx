"use client";

import React from "react";
import { IoCheckmarkDone, IoClose, IoTrash } from "react-icons/io5";

export default function BulkBar({
  count,
  onClear,
  actions,
}: {
  count: number;
  onClear: () => void;
  actions: Array<{
    label: string;
    onClick: () => void;
    variant?: "success" | "danger" | "primary" | "ghost";
    icon?: "check" | "close" | "trash";
    disabled?: boolean;
  }>;
}) {
  if (count <= 0) return null;
  return (
    <div className="admin-bulk-bar sticky top-14 z-20 mb-4 flex flex-col gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 shadow-sm admin-fade-up sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:px-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-blue-800">{count} selected</span>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-semibold text-blue-600 underline active:opacity-70"
        >
          Clear
        </button>
      </div>
      <div className="flex flex-wrap gap-2 sm:ml-auto">
        {actions.map((a) => {
          const cls =
            a.variant === "success"
              ? "admin-btn-success"
              : a.variant === "danger"
                ? "admin-btn-danger"
                : a.variant === "ghost"
                  ? "admin-btn-ghost"
                  : "admin-btn-primary";
          const Icon =
            a.icon === "close"
              ? IoClose
              : a.icon === "trash"
                ? IoTrash
                : IoCheckmarkDone;
          return (
            <button
              key={a.label}
              type="button"
              disabled={a.disabled}
              onClick={a.onClick}
              className={`${cls} inline-flex min-h-10 flex-1 items-center justify-center gap-1 text-xs sm:flex-none disabled:opacity-50`}
            >
              <Icon size={14} />
              {a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
