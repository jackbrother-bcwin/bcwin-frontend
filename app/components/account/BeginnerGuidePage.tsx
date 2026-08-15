"use client";

/**
 * Beginner's Guide — interactive tutorial page with annotated screenshots
 * covering all major app features: registration, login, gaming, deposits,
 * withdrawals, promotions, and account management.
 */

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import PageHeader from "../ui/PageHeader";

interface Props {
  onBack: () => void;
  onNavigate?: (screen: string) => void;
}

/* ── Guide section data ── */

interface GuideSection {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  image: string;
  steps: string[];
  tips?: string[];
  /** Optional quick-action button label + target screen */
  action?: { label: string; screen: string };
}

const SECTIONS: GuideSection[] = [
  {
    id: "register",
    number: 1,
    title: "How to Register",
    subtitle: "Create your BCWIN account in seconds",
    image: "/assets/guide/guide_register.png",
    steps: [
      "Open the app and tap **Register** on the home screen",
      "Enter your **phone number** with country code (+91)",
      "Set a **password** (minimum 6 characters)",
      "**Confirm** your password by typing it again",
      "Enter the **invitation code** if you have one",
      "Check **\"I have read and agree\"** to accept the Privacy Agreement",
      "Tap the **Register** button to create your account",
    ],
    tips: [
      "Your phone number will be used for login and password recovery",
      "Keep your password safe — use a mix of letters and numbers",
    ],
    action: { label: "Go to Register", screen: "register" },
  },
  {
    id: "login",
    number: 2,
    title: "How to Log In",
    subtitle: "Access your account quickly",
    image: "/assets/guide/guide_login.png",
    steps: [
      "Tap **\"Login\"** on the home screen or registration page",
      "Enter your registered **phone number**",
      "Enter your **password**",
      "Complete the **security verification** puzzle",
      "Tap **\"Log In\"** to access your account",
    ],
    tips: [
      "If you forgot your password, tap \"Forgot password?\" to reset it",
      "Your account stays logged in until you manually log out",
    ],
    action: { label: "Go to Login", screen: "login" },
  },
  {
    id: "home",
    number: 3,
    title: "Navigating the Home Page",
    subtitle: "Explore all features from the main screen",
    image: "/assets/guide/guide_home.png",
    steps: [
      "The **banner area** at top shows current promotions and announcements",
      "Use the **game category tabs** (Lottery, Slots, Sports, Casino, etc.) to filter games",
      "Tap any **game card** to start playing",
      "Use the **bottom navigation bar** to switch between Home, Activity, Promotion, Wallet, and Account",
    ],
    tips: [
      "Swipe the banner to see all current offers and promotions",
      "The Lottery section includes Win Go, K3, 5D, and TRX Win Go games",
      "Tap the floating customer service icon for instant help",
    ],
  },
  {
    id: "games",
    number: 4,
    title: "How to Play Games",
    subtitle: "Win Go, K3, 5D, and more lottery games",
    image: "/assets/guide/guide_games.png",
    steps: [
      "Select a game from the **Home page** (e.g., Win Go, K3, 5D)",
      "Wait for the **countdown timer** — you can only bet while the timer is running",
      "Choose your bet: pick a **color** (Green, Violet, or Red) or select a **number** (0-9)",
      "Set your **bet amount** using the quantity selector",
      "Tap **\"Place Bet\"** to confirm your bet before the timer ends",
      "Watch the **result** when the timer reaches zero",
    ],
    tips: [
      "Each game round has a time limit — place your bets before the countdown ends",
      "You can view your bet history in the game page's history tab",
      "Start with smaller amounts to learn the game patterns",
      "Different time periods (1min, 3min, 5min, 10min) are available for each game",
    ],
    action: { label: "Play Win Go", screen: "wingo" },
  },
  {
    id: "deposit",
    number: 5,
    title: "How to Deposit / Recharge",
    subtitle: "Add funds to your wallet easily",
    image: "/assets/guide/guide_deposit.png",
    steps: [
      "Go to the **Wallet** page from the bottom navigation or Account page",
      "Tap the **\"Deposit\"** button",
      "Select your preferred **payment method** (Bank Transfer or E-Wallet)",
      "Enter the **deposit amount** or select a quick amount (₹100, ₹200, ₹500, etc.)",
      "Tap **\"Deposit\"** to confirm and complete the payment",
    ],
    tips: [
      "We support Bank Transfer, UPI, and E-Wallet payment methods",
      "Minimum deposit amount may vary by payment method",
      "Deposits are usually processed instantly",
      "Check Deposit History to track your transaction status",
    ],
    action: { label: "Deposit Now", screen: "deposit" },
  },
  {
    id: "wallet",
    number: 6,
    title: "Understanding Your Wallet",
    subtitle: "Manage your Main Wallet and 3rd Party Wallet",
    image: "/assets/guide/guide_wallet.png",
    steps: [
      "Your **Total Balance** is shown at the top of the Wallet page",
      "The **Main Wallet** holds your withdrawable funds",
      "The **3rd Party Wallet** holds funds allocated to game providers",
      "Use **\"Main wallet transfer\"** to move funds between wallets",
      "Access **Deposit**, **Withdraw**, **Deposit History**, and **Withdrawal History** from the quick action buttons",
    ],
    tips: [
      "Transfer funds from 3rd Party Wallet to Main Wallet before withdrawing",
      "Refresh your balance by tapping the refresh icon",
    ],
    action: { label: "Open Wallet", screen: "wallet" },
  },
  {
    id: "withdraw",
    number: 7,
    title: "How to Withdraw",
    subtitle: "Cash out your winnings to your bank account",
    image: "/assets/guide/guide_withdraw.png",
    steps: [
      "First, **add a bank account** from the Withdraw page if you haven't already",
      "Select your **linked bank account** for the withdrawal",
      "Enter the **withdrawal amount** you wish to cash out",
      "Tap **\"Withdraw\"** to submit your withdrawal request",
      "Your withdrawal will be processed and credited to your bank account",
    ],
    tips: [
      "You must add and verify a bank account before your first withdrawal",
      "Withdrawal requests are typically processed within 15 minutes",
      "Make sure your bank details are correct to avoid delays",
      "Check Withdrawal History to track your payout status",
    ],
    action: { label: "Withdraw", screen: "withdraw" },
  },
  {
    id: "promotion",
    number: 8,
    title: "Promotion & Referral Program",
    subtitle: "Invite friends and earn commission",
    image: "/assets/guide/guide_promotion.png",
    steps: [
      "Go to the **Promotion** tab from the bottom navigation bar",
      "Tap **\"Copy Invitation Link\"** to get your unique referral link",
      "Share the link with **friends and family** via WhatsApp, Telegram, etc.",
      "Track your team in the **Subordinate Data** section",
      "View your earnings in the **Commission** section",
    ],
    tips: [
      "You earn commission from your referrals' bets at multiple levels (Level 1, 2, 3)",
      "The more active members you invite, the higher your commission",
      "Check the Invitation Rules for full details on commission tiers",
      "Daily salary rewards are available for active promoters",
    ],
  },
  {
    id: "account",
    number: 9,
    title: "Managing Your Account",
    subtitle: "Settings, security, and more",
    image: "/assets/guide/guide_account.png",
    steps: [
      "Tap **Account** in the bottom navigation to view your profile",
      "Access quick actions: **Wallet, Deposit, Withdraw, VIP**",
      "Go to **Settings** to change your password or update account details",
      "Use **Feedback** to report issues or suggestions",
      "Check **Notifications** for important updates and announcements",
    ],
    tips: [
      "Regularly update your password for better security",
      "Check your VIP level for exclusive rewards and benefits",
      "Contact Customer Service for any account-related issues",
    ],
    action: { label: "Open Account", screen: "profile" },
  },
];

/* ── Nav pill data ── */
const NAV_ITEMS = SECTIONS.map((s) => ({
  id: s.id,
  label: s.title.replace(/^How to /, ""),
}));

export default function BeginnerGuidePage({ onBack, onNavigate }: Props) {
  const [activeSection, setActiveSection] = useState(SECTIONS[0]!.id);
  const [expandedImg, setExpandedImg] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const navRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  /* ── Scroll spy ── */
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingRef.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("data-section");
            if (id) setActiveSection(id);
          }
        }
      },
      { root: container, rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );

    for (const el of sectionRefs.current.values()) {
      observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  /* ── Scroll active nav pill into view ── */
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const pill = nav.querySelector(`[data-nav="${activeSection}"]`) as HTMLElement | null;
    if (pill) {
      pill.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeSection]);

  const scrollToSection = (id: string) => {
    const el = sectionRefs.current.get(id);
    if (!el || !scrollRef.current) return;
    isScrollingRef.current = true;
    setActiveSection(id);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 800);
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen" style={{ background: "#110D14" }}>
      <PageHeader title="Beginner's Guide" onBack={onBack} />

      {/* ── Horizontal nav pills ── */}
      <div
        ref={navRef}
        className="flex gap-2 px-3 py-2.5 overflow-x-auto scrollbar-hide"
        style={{
          background: "linear-gradient(180deg, #1a1520 0%, #110D14 100%)",
          borderBottom: "1px solid rgba(162,132,34,0.15)",
        }}
      >
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            data-nav={item.id}
            onClick={() => scrollToSection(item.id)}
            className="shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-300 whitespace-nowrap"
            style={{
              background:
                activeSection === item.id
                  ? "linear-gradient(135deg, #FED358 0%, #FFB472 100%)"
                  : "rgba(56,46,53,0.6)",
              color: activeSection === item.id ? "#110D14" : "#B79C8B",
              boxShadow:
                activeSection === item.id
                  ? "0 2px 12px rgba(254,211,88,0.3)"
                  : "none",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* ── Scrollable guide content ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pb-24"
        style={{ scrollBehavior: "smooth" }}
      >
        {/* Welcome hero */}
        <div className="mx-3 mt-4 mb-6 p-5 rounded-2xl text-center" style={{
          background: "linear-gradient(135deg, rgba(254,211,88,0.12) 0%, rgba(255,180,114,0.08) 50%, rgba(56,46,53,0.4) 100%)",
          border: "1px solid rgba(254,211,88,0.2)",
        }}>
          <div className="text-3xl mb-2">🎮</div>
          <h2 className="text-[16px] font-bold text-[#FDE4BC] mb-1">
            Welcome to BCWIN!
          </h2>
          <p className="text-[12px] text-[#B79C8B] leading-relaxed">
            This guide will walk you through every feature of the app —
            from creating your account to playing games, making deposits,
            and withdrawing your winnings.
          </p>
        </div>

        {/* ── Guide sections ── */}
        {SECTIONS.map((section) => (
          <div
            key={section.id}
            data-section={section.id}
            ref={(el) => {
              if (el) sectionRefs.current.set(section.id, el);
            }}
            className="mx-3 mb-5"
          >
            {/* Section header */}
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[13px] font-black"
                style={{
                  background: "linear-gradient(135deg, #FED358 0%, #FFB472 100%)",
                  color: "#110D14",
                  boxShadow: "0 2px 10px rgba(254,211,88,0.3)",
                }}
              >
                {section.number}
              </div>
              <div className="min-w-0">
                <h3 className="text-[14px] font-bold text-[#FDE4BC] truncate">
                  {section.title}
                </h3>
                <p className="text-[10px] text-[#837064] truncate">
                  {section.subtitle}
                </p>
              </div>
            </div>

            {/* Card */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(160deg, #241E22 0%, #1A1520 100%)",
                border: "1px solid rgba(162,132,34,0.18)",
              }}
            >
              {/* Screenshot */}
              <button
                type="button"
                className="w-full relative cursor-pointer group"
                onClick={() => setExpandedImg(section.image)}
                aria-label={`View ${section.title} screenshot`}
              >
                <div className="relative w-full overflow-hidden" style={{ aspectRatio: "1 / 1" }}>
                  <Image
                    src={section.image}
                    alt={`${section.title} guide`}
                    fill
                    className="object-contain transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 500px) 100vw, 500px"
                  />
                </div>
                {/* Tap to expand overlay */}
                <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-full text-[9px] font-semibold flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity" style={{
                  background: "rgba(0,0,0,0.7)",
                  color: "#FED358",
                  backdropFilter: "blur(4px)",
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                  Tap to zoom
                </div>
              </button>

              {/* Steps */}
              <div className="px-4 py-4">
                <div className="space-y-2.5">
                  {section.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-bold"
                        style={{
                          background: "rgba(254,211,88,0.15)",
                          color: "#FED358",
                          border: "1px solid rgba(254,211,88,0.25)",
                        }}
                      >
                        {i + 1}
                      </div>
                      <p
                        className="text-[12px] leading-[1.6] text-[#B79C8B] flex-1"
                        dangerouslySetInnerHTML={{
                          __html: step
                            .replaceAll(
                              /\*\*(.+?)\*\*/g,
                              '<strong style="color:#FDE4BC;font-weight:600">$1</strong>'
                            ),
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Tips */}
                {section.tips && section.tips.length > 0 && (
                  <div
                    className="mt-4 p-3 rounded-xl"
                    style={{
                      background: "rgba(254,211,88,0.06)",
                      border: "1px solid rgba(254,211,88,0.12)",
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[13px]">💡</span>
                      <span className="text-[10px] font-bold text-[#FED358] uppercase tracking-wider">
                        Tips
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {section.tips.map((tip, i) => (
                        <p key={i} className="text-[11px] text-[#837064] leading-[1.5] pl-5">
                          • {tip}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick action button */}
                {section.action && onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate(section.action!.screen)}
                    className="mt-4 w-full h-10 rounded-full text-[12px] font-bold uppercase tracking-wider transition-all duration-300 active:scale-[0.97]"
                    style={{
                      background: "linear-gradient(135deg, #FED358 0%, #FFB472 100%)",
                      color: "#110D14",
                      boxShadow: "0 2px 12px rgba(254,211,88,0.2)",
                    }}
                  >
                    {section.action.label}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Footer note */}
        <div className="mx-3 mb-8 p-4 rounded-2xl text-center" style={{
          background: "rgba(56,46,53,0.3)",
          border: "1px solid rgba(162,132,34,0.1)",
        }}>
          <p className="text-[11px] text-[#837064] leading-[1.6]">
            Need more help? Contact our{" "}
            <span className="text-[#FED358] font-semibold">Customer Service</span>{" "}
            team — available 24/7 through the floating chat icon or the Account page.
          </p>
        </div>
      </div>

      {/* ── Full-screen image modal ── */}
      {expandedImg && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.92)" }}
          onClick={() => setExpandedImg(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Expanded guide image"
        >
          <button
            type="button"
            onClick={() => setExpandedImg(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center z-10"
            style={{ background: "rgba(255,255,255,0.1)" }}
            aria-label="Close expanded image"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FDE4BC" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className="relative w-[95vw] h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <Image
              src={expandedImg}
              alt="Guide screenshot (zoomed)"
              fill
              className="object-contain"
              sizes="95vw"
              priority
            />
          </div>
        </div>
      )}
    </div>
  );
}
