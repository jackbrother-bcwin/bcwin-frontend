import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: {
    default: "BCWin Admin",
    template: "%s · BCWin Admin",
  },
  description: "BCWin Admin Control Panel",
  robots: "noindex,nofollow",
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-root min-h-dvh min-h-screen w-full max-w-none flex-1 overflow-x-clip bg-[#f0f2f5] text-slate-800 antialiased">
      {children}
    </div>
  );
}
