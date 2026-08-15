"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  IoGridOutline,
  IoGameControllerOutline,
  IoCashOutline,
  IoPeopleOutline,
  IoHeadsetOutline,
  IoSettingsOutline,
  IoShieldCheckmarkOutline,
  IoStatsChartOutline,
  IoLogOutOutline,
  IoMenuOutline,
  IoCloseOutline,
  IoChevronForward,
  IoHomeOutline,
  IoGlobeOutline,
  IoSparklesOutline,
  IoTrophyOutline,
} from "react-icons/io5";
import { useAuthState, useAuthActions } from "../../context/AuthContext";
import { useToast } from "../../components/ui/Toast";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  children?: { href: string; label: string }[];
};

const NAV: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: <IoGridOutline size={18} /> },
  {
    href: "/admin/games",
    label: "Game Managers",
    icon: <IoGameControllerOutline size={18} />,
    children: [
      { href: "/admin/games/wingo", label: "WinGo Manager" },
      { href: "/admin/games/trxwingo", label: "TRX WinGo" },
      { href: "/admin/games/k3", label: "K3 Manager" },
      { href: "/admin/games/5d", label: "5D Manager" },
      { href: "/admin/games/moto", label: "Moto Manager" },
    ],
  },
  {
    href: "/admin/finance",
    label: "Finance",
    icon: <IoCashOutline size={18} />,
    children: [
      { href: "/admin/finance/deposits", label: "Deposits" },
      { href: "/admin/finance/withdrawals", label: "Withdrawals" },
      { href: "/admin/finance/game-history", label: "Game history" },
      { href: "/admin/finance/commission", label: "Commission" },
      { href: "/admin/finance/rebate", label: "Rebate" },
      { href: "/admin/finance/balance", label: "Balance updates" },
    ],
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: <IoPeopleOutline size={18} />,
    children: [
      { href: "/admin/users", label: "User list" },
      { href: "/admin/users/create", label: "Create user" },
      { href: "/admin/users/invite-tree", label: "Invite tree" },
      { href: "/admin/agents", label: "Agents" },
      { href: "/admin/subadmins", label: "Sub-admins" },
      { href: "/admin/turnover", label: "Turnover + charts" },
      { href: "/admin/bank", label: "Bank details" },
    ],
  },
  {
    href: "/admin/support",
    label: "Support",
    icon: <IoHeadsetOutline size={18} />,
    children: [
      { href: "/admin/support/queries", label: "Queries (bulk)" },
      { href: "/admin/support/notifications", label: "Notifications" },
    ],
  },
  {
    href: "/admin/manage",
    label: "Manage",
    icon: <IoSparklesOutline size={18} />,
    children: [
      { href: "/admin/gifts", label: "Gifts" },
      { href: "/admin/vip", label: "VIP rules" },
      { href: "/admin/activity", label: "Activity tiers" },
      { href: "/admin/spin", label: "Lucky spin" },
      { href: "/admin/win-streak", label: "Win streak" },
      { href: "/admin/salary", label: "Salary" },
    ],
  },
  {
    href: "/admin/security",
    label: "Security",
    icon: <IoShieldCheckmarkOutline size={18} />,
    children: [
      { href: "/admin/illegal-bets", label: "Illegal bets" },
      { href: "/admin/illegal-bets/penalties", label: "Penalty users" },
      { href: "/admin/ip", label: "IP control" },
    ],
  },
  { href: "/admin/profit-loss", label: "Profit & Loss", icon: <IoStatsChartOutline size={18} /> },
  { href: "/admin/performance", label: "Top performance", icon: <IoTrophyOutline size={18} /> },
  {
    href: "/admin/config",
    label: "Config",
    icon: <IoSettingsOutline size={18} />,
    children: [
      { href: "/admin/config", label: "Platform config" },
      { href: "/admin/config/commission", label: "Commission rates" },
    ],
  },
  { href: "/admin/inout", label: "Inout games", icon: <IoGlobeOutline size={18} /> },
];

const SIDEBAR_W = 260;

function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return desktop;
}

function crumbLabel(pathname: string) {
  const raw = pathname.replace(/^\/admin\/?/, "") || "dashboard";
  return raw
    .split("/")
    .filter(Boolean)
    .map((s) => s.replace(/-/g, " "))
    .join(" · ");
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthState();
  const { logout } = useAuthActions();
  const { toast } = useToast();
  const isDesktop = useIsDesktop();

  // Desktop: sidebar open by default. Mobile: closed (drawer).
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>("Game Managers");

  useEffect(() => {
    if (isDesktop) setOpen(true);
    else setOpen(false);
  }, [isDesktop]);

  // Close mobile drawer on route change
  useEffect(() => {
    if (!isDesktop) setOpen(false);
  }, [pathname, isDesktop]);

  // Body scroll lock when mobile drawer open
  useEffect(() => {
    if (isDesktop || !open) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, isDesktop]);

  // Escape closes mobile drawer
  useEffect(() => {
    if (isDesktop || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isDesktop]);

  const closeMobile = useCallback(() => {
    if (!isDesktop) setOpen(false);
  }, [isDesktop]);

  const handleLogout = async () => {
    await logout();
    toast("Logged out", "success");
    router.replace("/admin/login");
  };

  const isActive = (href: string) =>
    pathname === href ||
    (href !== "/admin/dashboard" && pathname.startsWith(href + "/"));

  const navLinkClass = (active: boolean) =>
    `admin-nav-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${
      active ? "bg-white/20" : "hover:bg-white/10 active:bg-white/15"
    }`;

  const sidebar = (
    <aside
      id="admin-sidebar"
      className="admin-sidebar flex h-full w-[min(260px,85vw)] max-w-[260px] flex-col text-white"
      style={{
        background: "linear-gradient(180deg, #2563eb 0%, #1d4ed8 55%, #1e40af 100%)",
      }}
      aria-label="Admin navigation"
    >
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4 sm:px-5 sm:py-5">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
          <Image
            src="/assets/png/bcwin.png"
            alt="BCWin"
            width={36}
            height={36}
            className="object-contain p-0.5"
            priority
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold tracking-wide">BCWin</p>
          <p className="text-[10px] text-white/70">Admin Control</p>
        </div>
        {!isDesktop && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white active:bg-white/20 lg:hidden"
            aria-label="Close menu"
          >
            <IoCloseOutline size={22} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-base font-bold sm:h-11 sm:w-11 sm:text-lg">
          {(user?.username?.[0] ?? "A").toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">
            {user?.username ?? "Admin"}
          </p>
          <p className="text-[11px] text-white/65">{user?.role ?? "ADMIN"}</p>
        </div>
      </div>

      <nav className="admin-sidebar-nav flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-2.5 py-3 sm:px-3">
        {NAV.map((item) => {
          const hasChildren = !!item.children?.length;
          const childActive = item.children?.some(
            (c) => pathname === c.href || pathname.startsWith(c.href + "/")
          );
          const active = isActive(item.href) || !!childActive;
          const isOpen = expanded === item.label || !!childActive;

          return (
            <div key={item.label}>
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : item.label)}
                  className={navLinkClass(!!active)}
                  aria-expanded={isOpen}
                >
                  <span className="shrink-0 opacity-90">{item.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <IoChevronForward
                    size={14}
                    className={`shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  />
                </button>
              ) : (
                <Link
                  href={item.href}
                  onClick={closeMobile}
                  className={navLinkClass(!!active)}
                >
                  <span className="shrink-0 opacity-90">{item.icon}</span>
                  <span className="min-w-0 truncate">{item.label}</span>
                </Link>
              )}
              {hasChildren && isOpen && (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/15 pl-2 sm:ml-4">
                  {item.children!.map((c) => {
                    const cActive =
                      pathname === c.href || pathname.startsWith(c.href + "/");
                    return (
                      <Link
                        key={c.href}
                        href={c.href}
                        onClick={closeMobile}
                        className={`block rounded-md px-3 py-2 text-[12px] transition-colors active:bg-white/20 ${
                          cActive
                            ? "bg-white/20 font-semibold"
                            : "text-white/85 hover:bg-white/10"
                        }`}
                      >
                        {c.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="safe-bottom space-y-1 border-t border-white/10 p-2.5 sm:p-3">
        <Link
          href="/"
          onClick={closeMobile}
          className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[12px] font-medium hover:bg-white/10 active:bg-white/15"
        >
          <IoHomeOutline size={16} />
          Go to Website
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-[12px] font-medium hover:bg-white/10 active:bg-white/15"
        >
          <IoLogOutOutline size={16} />
          Logout
        </button>
      </div>
    </aside>
  );

  return (
    <div className="admin-shell flex min-h-dvh w-full min-w-0">
      {/* Desktop rail */}
      <div
        className="admin-sidebar-desktop sticky top-0 z-40 hidden h-dvh shrink-0 lg:block"
        style={{ width: open ? SIDEBAR_W : 0, transition: "width 0.25s ease" }}
      >
        <div
          className="h-full overflow-hidden transition-opacity duration-200"
          style={{
            width: SIDEBAR_W,
            opacity: open ? 1 : 0,
            pointerEvents: open ? "auto" : "none",
          }}
        >
          {sidebar}
        </div>
      </div>

      {/* Mobile drawer + scrim */}
      <div
        className={`admin-drawer-root fixed inset-0 z-50 lg:hidden ${
          open ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!open}
      >
        <button
          type="button"
          className={`admin-drawer-scrim absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] transition-opacity duration-300 ${
            open ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          tabIndex={open ? 0 : -1}
        />
        <div
          className={`admin-drawer-panel absolute inset-y-0 left-0 shadow-2xl transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebar}
        </div>
      </div>

      {/* Main column */}
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="admin-topbar sticky top-0 z-30 flex h-14 min-h-14 items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-3 backdrop-blur-md sm:px-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="admin-icon-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 active:bg-slate-100 hover:bg-slate-50"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="admin-sidebar"
            >
              {open && isDesktop ? (
                <IoCloseOutline size={22} />
              ) : open && !isDesktop ? (
                <IoCloseOutline size={22} />
              ) : (
                <IoMenuOutline size={22} />
              )}
            </button>
            <p className="truncate text-[13px] font-semibold capitalize text-slate-700 sm:text-sm">
              {crumbLabel(pathname)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500 sm:gap-2">
            <IoTrophyOutline className="hidden text-blue-500 sm:inline" size={16} />
            <span className="hidden md:inline">BCWin Control Panel</span>
            <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-600 sm:text-xs">
              {user?.role}
            </span>
          </div>
        </header>

        <main className="admin-main min-w-0 flex-1 p-3 sm:p-4 md:p-6 admin-fade-in">
          {children}
        </main>

        <footer className="safe-bottom border-t border-slate-200 bg-white px-3 py-3 text-center text-[10px] text-slate-400 sm:px-6 sm:text-[11px]">
          © BCWin Admin · Production
        </footer>
      </div>
    </div>
  );
}
