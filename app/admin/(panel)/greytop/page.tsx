"use client";

/**
 * Legacy path: /admin/greytop → /admin/inout
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyInoutRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/inout");
  }, [router]);
  return (
    <div className="px-4 py-12 text-center text-sm text-slate-500">
      Redirecting to Inout games…
    </div>
  );
}
