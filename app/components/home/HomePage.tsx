"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import TopNav from "../TopNav";
import BannerCarousel from "../BannerCarousel";
import NoticeBar from "../NoticeBar";
import CategoryRail from "./CategoryRail";
import { HomeSectionRenderer, WinningInfoSection } from "./sections";
import { useGameOpen } from "./useGameOpen";
import {
  type CategoryId,
  type HomeSectionDef,
  sectionsForCategory,
} from "../../lib/home-catalog";
import AddToDesktop from "./AddToDesktop";
import HomePopups from "./HomePopups";
import ThirdPartyDepositGate, {
  INOUT_MIN_TOTAL_DEPOSIT,
} from "./ThirdPartyDepositGate";
import ThirdPartyGameShell from "./ThirdPartyGameShell";

interface HomePageProps {
  onNavigate: (tab: string) => void;
  onLogin: () => void;
  onRegister: () => void;
}

const TOPNAV_H = 52;

/**
 * Home scroll chrome:
 * 1) TopNav fixed while banner / notice / winning scroll.
 * 2) When in-flow category rail hits the bar, TopNav swaps for pinned CategoryRail.
 *
 * Safe-area: same as `.app-page-header` — fixed `top:0` + padding-top inside bar.
 * Spacer = nav/rail row height only (shell already pads content for the notch).
 * Avoid transform/backdrop-filter on the bar (WebView/APK paint-through bugs).
 */
export default function HomePage({ onNavigate, onLogin, onRegister }: HomePageProps) {
  const [category, setCategory] = useState<CategoryId>("lobby");
  const [catPinned, setCatPinned] = useState(false);
  const [railH, setRailH] = useState(56);
  const {
    openGame,
    launchingId,
    depositGate,
    closeDepositGate,
    gameSession,
    closeGameSession,
  } = useGameOpen(onNavigate);

  const railFlowRef = useRef<HTMLDivElement>(null);
  const fixedChromeRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(false);
  /** Bottom of TopNav chrome (viewport coords) while unpinned — pin threshold */
  const pinLineRef = useRef(TOPNAV_H);

  const sections = useMemo(() => sectionsForCategory(category), [category]);
  const winningSection = sections.find((s) => s.kind === "winning-info");
  const restSections = sections.filter((s) => s.kind !== "winning-info");

  useEffect(() => {
    pinnedRef.current = catPinned;
  }, [catPinned]);

  // Measure in-flow rail height for spacer when pinned
  useLayoutEffect(() => {
    const el = railFlowRef.current;
    if (!el) return;
    const apply = () => {
      const h = el.offsetHeight;
      if (h > 0) setRailH(h);
    };
    apply();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;

    const measure = () => {
      raf = 0;
      const el = railFlowRef.current;
      if (!el) return;

      const top = el.getBoundingClientRect().top;
      const prev = pinnedRef.current;

      // Cache TopNav bottom only while TopNav is showing (not pinned rail)
      if (!prev && fixedChromeRef.current) {
        const bottom = fixedChromeRef.current.getBoundingClientRect().bottom;
        if (bottom > 0) pinLineRef.current = bottom;
      }

      const pinLine = pinLineRef.current || TOPNAV_H;
      const HYST = 20;

      let next: boolean;
      if (!prev) {
        next = top <= pinLine + 1;
      } else {
        next = top <= pinLine + HYST;
      }

      if (next !== prev) {
        pinnedRef.current = next;
        setCatPinned(next);
      }
    };

    const onScrollOrResize = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(measure);
    };

    measure();

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });
    // visualViewport shifts on mobile URL bar / APK — remeasure pin line
    const vv = window.visualViewport;
    vv?.addEventListener("resize", onScrollOrResize);
    vv?.addEventListener("scroll", onScrollOrResize);
    document.addEventListener("scroll", onScrollOrResize, {
      passive: true,
      capture: true,
    });
    document.body?.addEventListener("scroll", onScrollOrResize, {
      passive: true,
    });
    document.documentElement?.addEventListener("scroll", onScrollOrResize, {
      passive: true,
    });

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      vv?.removeEventListener("resize", onScrollOrResize);
      vv?.removeEventListener("scroll", onScrollOrResize);
      document.removeEventListener("scroll", onScrollOrResize, true);
      document.body?.removeEventListener("scroll", onScrollOrResize);
      document.documentElement?.removeEventListener("scroll", onScrollOrResize);
    };
  }, []);

  // Spacer = content row only (TopNav 52 / rail). Safe-area is shell + chrome pad, not double-counted.
  const topChromeH = catPinned ? Math.max(railH, 48) : TOPNAV_H;

  return (
    <div
      className={`home-page flex w-full flex-1 flex-col${
        catPinned ? " home-page--cat-pinned" : ""
      }`}
    >
      {/* top:0 + safe-area padding inside — see .home-fixed-chrome (no mid-screen float) */}
      <div
        ref={fixedChromeRef}
        className="home-fixed-chrome z-50"
      >
        <div
          className={`home-fixed-chrome-inner${
            catPinned ? " home-fixed-chrome-inner--rail" : ""
          }`}
        >
          {!catPinned ? (
            <TopNav
              onLoginClick={onLogin}
              onRegisterClick={onRegister}
              onNavigate={onNavigate}
            />
          ) : (
            <CategoryRail active={category} onChange={setCategory} pinned />
          )}
        </div>
      </div>

      <div
        className="home-fixed-chrome-spacer shrink-0"
        style={{ height: topChromeH }}
        aria-hidden
      />

      <div className="flex w-full flex-1 flex-col pb-3">
        <BannerCarousel />
        <NoticeBar />

        {winningSection && (
          <div className="px-3 pt-3">
            <WinningInfoSection section={winningSection as HomeSectionDef} />
          </div>
        )}

        {/* In-flow rail: visible until pin; then only a height placeholder for measure/layout */}
        <div
          ref={railFlowRef}
          className={`home-cat-rail-flow${catPinned ? " home-cat-rail-flow--pinned" : ""}`}
          style={catPinned ? { height: railH } : undefined}
          aria-hidden={catPinned || undefined}
        >
          {!catPinned && (
            <CategoryRail active={category} onChange={setCategory} pinned={false} />
          )}
        </div>

        <div className="flex flex-col gap-4 px-3 pt-3 pb-6">
          {restSections.map((section) => (
            <HomeSectionRenderer
              key={section.id}
              section={section}
              onOpen={openGame}
              launchingId={launchingId}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>

      <AddToDesktop />
      <HomePopups onNavigate={onNavigate} />
      <ThirdPartyDepositGate
        open={depositGate.open}
        gameName={depositGate.gameName}
        totalDeposit={depositGate.totalDeposit}
        required={INOUT_MIN_TOTAL_DEPOSIT}
        onClose={closeDepositGate}
        onDeposit={() => {
          closeDepositGate();
          onNavigate("deposit");
        }}
      />

      {/* Inout / third-party games — iframe inside app (no new browser tab) */}
      <ThirdPartyGameShell
        session={gameSession}
        onClose={closeGameSession}
      />
    </div>
  );
}
