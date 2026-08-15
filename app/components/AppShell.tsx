"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
} from "react";
import dynamic from "next/dynamic";
import BottomNav from "./BottomNav";
import FloatingCS from "./FloatingCS";
import FloatingTelegram from "./FloatingTelegram";
import HomeFloatingColumn from "./HomeFloatingColumn";
import DragonAssistant from "./dragon/DragonAssistant";
import BrandSplash from "./ui/BrandSplash";
import HomePage from "./home/HomePage";
import { useAuthState, useAuthActions } from "../context/AuthContext";
import {
  bootstrapSpaHistory,
  capStack,
  isSpaHistoryState,
  parseHash,
  pushSpaHistory,
  replaceSpaHistory,
  stackToHash,
  trapSpaHistory,
} from "../lib/spa-history";
import { consumeSpaOverlayPop } from "../lib/spa-overlay";

// ─── Heavy screens: code-split (Next 16 lazy-loading best practice) ──────────

const loadFallback = () => <BrandSplash compact label="Loading…" />;

const ProfilePage = dynamic(() => import("./ProfilePage"), { loading: loadFallback });
const ActivityPage = dynamic(() => import("./ActivityPage"), { loading: loadFallback });
const PromotionPage = dynamic(() => import("./PromotionPage"), { loading: loadFallback });
const LoginPage = dynamic(() => import("./LoginPage"), { loading: loadFallback });
const RegisterPage = dynamic(() => import("./RegisterPage"), { loading: loadFallback });
const ForgotPasswordPage = dynamic(() => import("./ForgotPasswordPage"), { loading: loadFallback });
const SpinPage = dynamic(() => import("./SpinPage"), { loading: loadFallback });
const LuckySpinPage = dynamic(() => import("./LuckySpinPage"), { loading: loadFallback });
const WingoPage = dynamic(() => import("./WingoPage"), { loading: loadFallback, ssr: false });
const K3Page = dynamic(() => import("./K3Page"), { loading: loadFallback, ssr: false });
const FiveDPage = dynamic(() => import("./FiveDPage"), { loading: loadFallback, ssr: false });
const MotoPage = dynamic(() => import("./MotoPage"), { loading: loadFallback, ssr: false });
const WalletPage = dynamic(() => import("./wallet/WalletPage"), { loading: loadFallback });
const DepositPage = dynamic(() => import("./wallet/DepositPage"), { loading: loadFallback });
const WithdrawPage = dynamic(() => import("./wallet/WithdrawPage"), { loading: loadFallback });
const BankDetailsPage = dynamic(() => import("./wallet/BankDetailsPage"), { loading: loadFallback });
const DepositHistoryPage = dynamic(() => import("./history/DepositHistoryPage"), { loading: loadFallback });
const WithdrawHistoryPage = dynamic(() => import("./history/WithdrawHistoryPage"), { loading: loadFallback });
const GameHistoryPage = dynamic(() => import("./history/GameHistoryPage"), { loading: loadFallback });
const GameStatisticsPage = dynamic(
  () => import("./account/GameStatisticsPage"),
  { loading: loadFallback }
);
const TransactionHistoryPage = dynamic(
  () => import("./history/TransactionHistoryPage"),
  { loading: loadFallback }
);
const VipPage = dynamic(() => import("./account/VipPage"), { loading: loadFallback });
const NotificationsPage = dynamic(() => import("./account/NotificationsPage"), { loading: loadFallback });
const GiftsPage = dynamic(() => import("./account/GiftsPage"), { loading: loadFallback });
const FeedbackPage = dynamic(() => import("./account/FeedbackPage"), { loading: loadFallback });
const SettingsPage = dynamic(() => import("./account/SettingsPage"), { loading: loadFallback });
const AboutUsPage = dynamic(() => import("./account/AboutUsPage"), { loading: loadFallback });
const BeginnerGuidePage = dynamic(() => import("./account/BeginnerGuidePage"), { loading: loadFallback });
const LanguagePage = dynamic(() => import("./account/LanguagePage"), { loading: loadFallback });
const ChangePasswordPage = dynamic(
  () => import("./account/ChangePasswordPage"),
  { loading: loadFallback }
);

/** Screens that hide the bottom tab bar */
const HIDE_NAV = new Set([
  "wingo",
  "trxwingo",
  "k3",
  "5d",
  "moto",
  "login",
  "register",
  "forgot",
  "spin",
  "lucky-spin",
  "wallet",
  "deposit",
  "withdraw",
  "bank",
  "bank-upi",
  "bank-usdt",
  "deposit-history",
  "withdraw-history",
  "game-history",
  "game-statistics",
  "transaction-history",
  "vip",
  "notifications",
  "gifts",
  "feedback",
  "settings",
  "about",
  "guide",
  "language",
  "change-password",
]);

const PUBLIC = new Set(["home", "login", "register", "forgot"]);

/** Bottom-nav roots: selecting these resets the stack (not push) */
const ROOT_TABS = new Set(["home", "activity", "promotion", "profile"]);

const AUTH_SCREENS = new Set(["login", "register", "forgot"]);

/** Known screens — hash deep-links outside this list fall back to home */
const KNOWN_SCREENS = new Set([
  "home",
  "activity",
  "promotion",
  "profile",
  "login",
  "register",
  "forgot",
  "wingo",
  "trxwingo",
  "k3",
  "5d",
  "moto",
  "spin",
  "lucky-spin",
  "wallet",
  "deposit",
  "withdraw",
  "bank",
  "bank-upi",
  "bank-usdt",
  "deposit-history",
  "withdraw-history",
  "game-history",
  "game-statistics",
  "transaction-history",
  "vip",
  "notifications",
  "gifts",
  "feedback",
  "settings",
  "about",
  "guide",
  "language",
  "change-password",
]);

const MAX_STACK = 32;

function sanitizeStack(stack: string[]): string[] {
  const clean = stack.filter((s) => KNOWN_SCREENS.has(s));
  return clean.length ? capStack(clean, MAX_STACK) : ["home"];
}

/**
 * Client app shell: SPA navigation + browser History API.
 * - Bottom tabs → replace stack + replaceState
 * - Nested screens → push stack + pushState
 * - Header back / swipe-back / browser back → popstate → same stack
 */
export default function AppShell() {
  const { isLoggedIn, isLoading } = useAuthState();
  const { logout } = useAuthActions();

  const [navStack, setNavStack] = useState<string[]>(["home"]);
  const [redirectTab, setRedirectTab] = useState<string | null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const [tpGameOpen, setTpGameOpen] = useState(false);

  /** Skip writing history when applying popstate */
  const applyingPopRef = useRef(false);
  const bootstrappedRef = useRef(false);
  const navStackRef = useRef(navStack);
  navStackRef.current = navStack;

  const activeTab = navStack[navStack.length - 1] ?? "home";

  // ─── Apply stack + optionally write browser history ─────────────────────
  const commitStack = useCallback(
    (next: string[], mode: "push" | "replace" | "silent") => {
      const stack = sanitizeStack(next);
      setNavStack(stack);
      if (typeof window === "undefined" || applyingPopRef.current) return;
      if (mode === "push") pushSpaHistory(stack);
      else if (mode === "replace") replaceSpaHistory(stack);
    },
    []
  );

  // ─── Bootstrap from hash once after auth known ──────────────────────────
  useEffect(() => {
    if (isLoading || typeof window === "undefined" || bootstrappedRef.current) {
      return;
    }
    bootstrappedRef.current = true;

    let stack = parseHash(window.location.hash);

    // Query deep links: ?ref=CODE (invite → register) · legacy ?screen=register&ref= · ?go=wingo
    let inviteRef: string | null = null;
    try {
      const q = new URLSearchParams(window.location.search);
      inviteRef =
        q.get("ref")?.trim() ||
        q.get("invite")?.trim() ||
        q.get("code")?.trim() ||
        null;
      if (inviteRef) {
        try {
          sessionStorage.setItem("bcwin_invite_ref", inviteRef);
        } catch {
          /* ignore */
        }
      }

      if (!stack) {
        const screen = q.get("screen") || q.get("go");
        if (screen && KNOWN_SCREENS.has(screen)) {
          stack = ROOT_TABS.has(screen) ? [screen] : ["home", screen];
        }
      }

      // Invitation link without screen → open Register (logged-out only)
      if (
        inviteRef &&
        !isLoggedIn &&
        (!stack || stack[stack.length - 1] === "home")
      ) {
        stack = ["home", "register"];
      }
    } catch {
      /* ignore */
    }

    stack = sanitizeStack(stack ?? ["home"]);

    // Already logged in — don't open login/register/forgot from invite links
    if (isLoggedIn) {
      stack = sanitizeStack(
        stack.filter((s) => !AUTH_SCREENS.has(s)).length
          ? stack.filter((s) => !AUTH_SCREENS.has(s))
          : ["home"]
      );
    }

    // Private deep-link while logged out → login + remember target
    const top = stack[stack.length - 1] ?? "home";
    if (!isLoggedIn && !PUBLIC.has(top)) {
      setRedirectTab(top);
      const publicPrefix = stack.filter(
        (s) => PUBLIC.has(s) || ROOT_TABS.has(s)
      );
      const base = publicPrefix.length ? publicPrefix : ["home"];
      stack =
        base[base.length - 1] === "login"
          ? sanitizeStack(base)
          : sanitizeStack([...base, "login"]);
    }

    applyingPopRef.current = true;
    setNavStack(stack);
    // Double entry so the first system-back cannot leave the site
    bootstrapSpaHistory(stack);
    // Drop deep-link query params after hydrating (clean address bar)
    try {
      const url = new URL(window.location.href);
      let dirty = false;
      for (const key of ["screen", "go", "ref", "invite", "code"]) {
        if (url.searchParams.has(key)) {
          url.searchParams.delete(key);
          dirty = true;
        }
      }
      if (dirty) {
        window.history.replaceState(
          window.history.state,
          "",
          `${url.pathname}${url.search}${stackToHash(stack)}`
        );
      }
    } catch {
      /* ignore */
    }
    applyingPopRef.current = false;
    setHistoryReady(true);
  }, [isLoading, isLoggedIn]);

  // ─── Browser / swipe back ───────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onPopState = (e: PopStateEvent) => {
      // 1) Close top dialog / sheet / nested view first
      if (consumeSpaOverlayPop()) {
        return;
      }

      applyingPopRef.current = true;
      try {
        if (isSpaHistoryState(e.state)) {
          const stack = sanitizeStack(e.state.stack);
          setNavStack(stack);
          // If we're back to a single root screen, re-arm trap pad
          // so another back still stays in-app
          if (stack.length <= 1) {
            trapSpaHistory(stack);
          }
          return;
        }

        const fromHash = parseHash(window.location.hash);
        if (fromHash) {
          const stack = sanitizeStack(fromHash);
          setNavStack(stack);
          trapSpaHistory(stack);
          return;
        }

        // Would leave the SPA — trap: stay on current (or home)
        const stay = sanitizeStack(
          navStackRef.current.length ? navStackRef.current : ["home"]
        );
        setNavStack(stay);
        trapSpaHistory(stay);
      } finally {
        window.setTimeout(() => {
          applyingPopRef.current = false;
        }, 0);
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Scroll to top on screen change
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeTab]);

  // Third-party iframe: hide bottom nav + floating buttons (only game top bar)
  useEffect(() => {
    const onTp = (e: Event) => {
      const open = Boolean((e as CustomEvent<{ open?: boolean }>).detail?.open);
      setTpGameOpen(open);
    };
    window.addEventListener("bcwin-tp-game", onTp);
    return () => window.removeEventListener("bcwin-tp-game", onTp);
  }, []);

  /** Highlight bottom-nav item from deepest root ancestor */
  const bottomNavTab = useMemo(() => {
    for (let i = navStack.length - 1; i >= 0; i--) {
      const t = navStack[i]!;
      if (ROOT_TABS.has(t)) return t;
    }
    return "home";
  }, [navStack]);

  const pushScreen = useCallback(
    (tab: string) => {
      if (!KNOWN_SCREENS.has(tab)) return;

      if (!isLoggedIn && !PUBLIC.has(tab)) {
        setRedirectTab(tab);
        const s = navStackRef.current;
        if (s[s.length - 1] === "login") {
          replaceSpaHistory(s);
          return;
        }
        commitStack([...s, "login"], "push");
        return;
      }

      const s = navStackRef.current;
      if (s[s.length - 1] === tab) return;

      commitStack([...s, tab], "push");
    },
    [isLoggedIn, commitStack]
  );

  /**
   * Bottom nav root jump.
   * Uses push (not replace) when switching tabs so system-back returns
   * to the previous area instead of leaving the site.
   */
  const resetTo = useCallback(
    (tab: string) => {
      if (!KNOWN_SCREENS.has(tab)) return;

      if (!isLoggedIn && !PUBLIC.has(tab)) {
        setRedirectTab(tab);
        commitStack(["login"], "push");
        return;
      }
      if (tab === "home") setRedirectTab(null);

      const s = navStackRef.current;
      const top = s[s.length - 1];
      // Same root already focused — just normalize stack
      if (s.length === 1 && top === tab) {
        commitStack([tab], "replace");
        return;
      }
      // New root tab: push a fresh single-root stack entry
      commitStack([tab], "push");
    },
    [isLoggedIn, commitStack]
  );

  /**
   * In-app header Back: always walk SPA stack via history.back() when nested.
   * Never use history.length (unreliable; includes prior websites).
   * Root: trap in-app (do not exit).
   */
  const goBack = useCallback(() => {
    const s = navStackRef.current;
    const leaving = s[s.length - 1];
    if (leaving && AUTH_SCREENS.has(leaving)) {
      setRedirectTab(null);
    }

    if (s.length <= 1) {
      // Sticky root — re-push trap so swipe-back doesn't leave
      const root = sanitizeStack(s.length ? s : ["home"]);
      commitStack(root, "replace");
      trapSpaHistory(root);
      return;
    }

    // One SPA step back (popstate applies previous stack)
    if (typeof window !== "undefined") {
      window.history.back();
      return;
    }
    commitStack(s.slice(0, -1), "replace");
  }, [commitStack]);

  const handleAuthSuccess = useCallback(() => {
    const target = redirectTab;
    setRedirectTab(null);
    const s = navStackRef.current;
    const cleaned = s.filter((x) => !AUTH_SCREENS.has(x));
    const base = cleaned.length ? cleaned : ["home"];
    let next = base;
    if (target && base[base.length - 1] !== target) {
      next = [...base, target];
    }
    commitStack(next, "replace");
  }, [redirectTab, commitStack]);

  const handleLogout = useCallback(async () => {
    await logout();
    setRedirectTab(null);
    commitStack(["home"], "replace");
  }, [logout, commitStack]);

  /** Auth screen swaps without growing stack forever */
  const swapAuthScreen = useCallback(
    (to: "login" | "register" | "forgot") => {
      const s = navStackRef.current.filter((x) => !AUTH_SCREENS.has(x));
      const base = s.length ? s : ["home"];
      commitStack([...base, to], "replace");
    },
    [commitStack]
  );

  if (isLoading || !historyReady) {
    return (
      <main className="app-shell flex flex-1 flex-col" aria-busy="true">
        <BrandSplash label="Starting BCWin…" />
      </main>
    );
  }

  const showBottomNav = !HIDE_NAV.has(activeTab);

  return (
    <div className="app-shell">
      <main
        className={`flex w-full flex-1 flex-col ${
          showBottomNav
            ? "pb-[calc(72px+env(safe-area-inset-bottom,0px))]"
            : "pb-[env(safe-area-inset-bottom,0px)]"
        }`}
        id="main-content"
      >
        <Suspense fallback={<BrandSplash compact label="Loading…" />}>
          {activeTab === "home" && (
            <HomePage
              onNavigate={pushScreen}
              onLogin={() => pushScreen("login")}
              onRegister={() => pushScreen("register")}
            />
          )}

          {activeTab === "activity" && <ActivityPage onNavigate={pushScreen} />}
          {activeTab === "promotion" && <PromotionPage onNavigate={pushScreen} />}
          {activeTab === "profile" && (
            <ProfilePage onLogout={handleLogout} onNavigate={pushScreen} />
          )}

          {activeTab === "login" && (
            <LoginPage
              onBack={goBack}
              onRegisterClick={() => swapAuthScreen("register")}
              onForgotClick={() => swapAuthScreen("forgot")}
              onSuccess={handleAuthSuccess}
            />
          )}
          {activeTab === "register" && (
            <RegisterPage
              onBack={goBack}
              onLoginClick={() => swapAuthScreen("login")}
              onSuccess={handleAuthSuccess}
            />
          )}
          {activeTab === "forgot" && (
            <ForgotPasswordPage
              onBack={goBack}
              onLoginClick={() => swapAuthScreen("login")}
            />
          )}

          {activeTab === "wingo" && (
            <WingoPage variant="wingo" onBack={goBack} onNavigate={pushScreen} />
          )}
          {activeTab === "trxwingo" && (
            <WingoPage variant="trxwingo" onBack={goBack} onNavigate={pushScreen} />
          )}
          {activeTab === "k3" && <K3Page onBack={goBack} onNavigate={pushScreen} />}
          {activeTab === "5d" && <FiveDPage onBack={goBack} onNavigate={pushScreen} />}
          {activeTab === "moto" && <MotoPage onBack={goBack} onNavigate={pushScreen} />}

          {activeTab === "spin" && (
            <SpinPage
              onBack={goBack}
              onNavigate={pushScreen}
              variant="invite"
            />
          )}
          {activeTab === "lucky-spin" && (
            <LuckySpinPage
              onBack={goBack}
              onNavigate={pushScreen}
            />
          )}
          {activeTab === "wallet" && (
            <WalletPage onBack={goBack} onNavigate={pushScreen} />
          )}
          {activeTab === "deposit" && (
            <DepositPage onBack={goBack} onNavigate={pushScreen} />
          )}
          {activeTab === "withdraw" && (
            <WithdrawPage onBack={goBack} onNavigate={pushScreen} />
          )}
          {activeTab === "bank" && (
            <BankDetailsPage onBack={goBack} mode="bank" />
          )}
          {activeTab === "bank-upi" && (
            <BankDetailsPage onBack={goBack} mode="upi" />
          )}
          {activeTab === "bank-usdt" && (
            <BankDetailsPage onBack={goBack} mode="usdt" />
          )}
          {activeTab === "deposit-history" && <DepositHistoryPage onBack={goBack} />}
          {activeTab === "withdraw-history" && <WithdrawHistoryPage onBack={goBack} />}
          {activeTab === "game-history" && <GameHistoryPage onBack={goBack} />}
          {activeTab === "game-statistics" && (
            <GameStatisticsPage onBack={goBack} />
          )}
          {activeTab === "transaction-history" && (
            <TransactionHistoryPage onBack={goBack} />
          )}
          {activeTab === "vip" && <VipPage onBack={goBack} />}
          {activeTab === "notifications" && <NotificationsPage onBack={goBack} />}
          {activeTab === "gifts" && (
            <GiftsPage onBack={goBack} onNavigate={pushScreen} />
          )}
          {activeTab === "feedback" && <FeedbackPage onBack={goBack} />}
          {activeTab === "settings" && (
            <SettingsPage onBack={goBack} onNavigate={pushScreen} />
          )}
          {activeTab === "about" && <AboutUsPage onBack={goBack} />}
          {activeTab === "guide" && (
            <BeginnerGuidePage onBack={goBack} onNavigate={pushScreen} />
          )}
          {activeTab === "language" && <LanguagePage onBack={goBack} />}
          {activeTab === "change-password" && (
            <ChangePasswordPage onBack={goBack} onNavigate={pushScreen} />
          )}
        </Suspense>

        {!tpGameOpen && activeTab !== "home" && isLoggedIn && <FloatingCS />}
        <DragonAssistant
          showFloatingButton={!tpGameOpen && activeTab !== "home" && isLoggedIn}
        />
        {!tpGameOpen && activeTab === "home" && (
          <HomeFloatingColumn onNavigate={pushScreen} />
        )}
        {showBottomNav && !tpGameOpen && (
          <BottomNav
            currentTab={bottomNavTab}
            onChangeTab={resetTo}
            onSpin={() => pushScreen("spin")}
            spinActive={activeTab === "spin"}
          />
        )}
      </main>
    </div>
  );
}
