"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthState } from "../../context/AuthContext";

const ALLOWED = new Set(["ADMIN", "SUB_ADMIN"]);

export default function AdminGuard({ children }: { children: ReactNode }) {
  const { user, isLoading, isLoggedIn } = useAuthState();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!isLoggedIn || !user) {
      router.replace(`/greebuserrichadmin/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!ALLOWED.has(user.role)) {
      router.replace("/greebuserrichadmin/login?error=forbidden");
    }
  }, [isLoading, isLoggedIn, user, router, pathname]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0f2f5]">
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-10 w-10 animate-spin rounded-full border-[3px] border-blue-200 border-t-blue-600"
            aria-hidden
          />
          <p className="text-sm font-medium text-slate-500">Loading admin…</p>
        </div>
      </div>
    );
  }

  if (!user || !ALLOWED.has(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0f2f5]">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  return <>{children}</>;
}
