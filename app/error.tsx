"use client";

import { useEffect } from "react";
import { IoRefresh, IoWarningOutline } from "react-icons/io5";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center"
      role="alert"
      style={{ background: "#110D14", color: "#FDE4BC" }}
    >
      <IoWarningOutline size={40} color="#FED358" aria-hidden />
      <h2 className="text-lg font-bold text-[#FDE4BC]">Something went wrong</h2>
      <p className="max-w-xs text-[12px] text-[#B79C8B]">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      {error.digest && (
        <p className="font-mono text-[10px] text-[#837064]">Ref: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={reset}
        className="ts-btn-gold inline-flex h-11 items-center gap-2 px-6 text-sm"
      >
        <IoRefresh size={16} aria-hidden />
        Try again
      </button>
    </div>
  );
}
