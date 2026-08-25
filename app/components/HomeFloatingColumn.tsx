"use client";

import { asset } from "../lib/cdn";
import React, { useState, useEffect, useRef } from "react";
import { FaTelegramPlane } from "react-icons/fa";
import { IoChevronBack, IoHeadset } from "react-icons/io5";
import { openSafeUrl } from "../lib/safe";
import { useAuthState } from "../context/AuthContext";
import { OFFICIAL_TELEGRAM_URL } from "../lib/official-hosts";

interface HomeFloatingColumnProps {
  onNavigate: (screen: string) => void;
}

export default function HomeFloatingColumn({ onNavigate }: HomeFloatingColumnProps) {
  const { isLoggedIn } = useAuthState();
  // State: collapsed = slid out to the right off-screen (Samsung Edge style)
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Swipe / Drag tracking
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);

  // Scroll tracking (auto-reveal on scroll up/down)
  const lastScrollY = useRef(0);

  // Auto-reveal when user scrolls up/down by >40px
  useEffect(() => {
    lastScrollY.current = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDelta = Math.abs(currentScrollY - lastScrollY.current);

      if (scrollDelta > 40) {
        setIsCollapsed(false);
        lastScrollY.current = currentScrollY;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Touch / Pointer gesture handlers for swipe left / swipe right
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const touch = "touches" in e ? e.touches?.[0] : null;
    const clientX = touch ? touch.clientX : (e as React.MouseEvent).clientX;
    const clientY = touch ? touch.clientY : (e as React.MouseEvent).clientY;
    touchStartPos.current = { x: clientX, y: clientY };
    isDragging.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!touchStartPos.current) return;
    const touch = "touches" in e ? e.touches?.[0] : null;
    const clientX = touch ? touch.clientX : (e as React.MouseEvent).clientX;
    const clientY = touch ? touch.clientY : (e as React.MouseEvent).clientY;
    const deltaX = clientX - touchStartPos.current.x;
    const deltaY = clientY - touchStartPos.current.y;

    // If movement is horizontal enough
    if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
      isDragging.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (!touchStartPos.current) return;
    const touch = "changedTouches" in e ? e.changedTouches?.[0] : null;
    const clientX = touch ? touch.clientX : (e as React.MouseEvent).clientX;
    const deltaX = clientX - touchStartPos.current.x;

    // Swipe right (>35px) -> Slide out (collapse)
    if (deltaX > 35) {
      setIsCollapsed(true);
    }
    // Swipe left (<-35px) -> Slide back in (expand)
    else if (deltaX < -35) {
      setIsCollapsed(false);
    }

    touchStartPos.current = null;
  };

  // Button click helper (prevents click if user was swiping)
  const handleButtonClick = (action: () => void) => {
    if (isDragging.current) return;
    action();
  };

  // Trigger Dragon Assistant modal
  const openDragonAssistant = () => {
    window.dispatchEvent(new CustomEvent("open-dragon-assistant"));
  };

  return (
    <div
      className={`fixed right-0 bottom-20 z-[45] flex items-center transition-transform duration-300 ease-out select-none ${
        isCollapsed ? "translate-x-[calc(100%-12px)]" : "translate-x-0"
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseMove={handleTouchMove}
      onMouseUp={handleTouchEnd}
    >
      {/* Samsung Edge UI Pull Tab (visible when collapsed or for swiping back) */}
      <button
        type="button"
        aria-label={isCollapsed ? "Expand floating buttons" : "Collapse floating buttons"}
        onClick={() => setIsCollapsed((prev) => !prev)}
        className="w-4 h-36 bg-black/70 backdrop-blur-md border border-white/20 border-r-0 rounded-l-xl flex flex-col items-center justify-center cursor-pointer shadow-xl hover:bg-black/90 transition-colors group"
      >
        <IoChevronBack
          className={`w-4 h-4 text-amber-400 transition-transform duration-300 ${
            isCollapsed ? "rotate-0 animate-pulse" : "rotate-180 text-white/70"
          }`}
        />
        <div className="w-1.5 h-8 bg-gradient-to-b from-amber-400 to-yellow-500 rounded-full mt-2 opacity-80 group-hover:opacity-100" />
      </button>

      {/* Floating Buttons Column */}
      <div className="flex flex-col items-center gap-3 p-2.5 bg-black/50 backdrop-blur-2xl border border-white/10 border-r-0 rounded-l-3xl shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
        {/* 1. Lucky Spin Wheel Floating Button */}
        <button
          type="button"
          aria-label="Lucky Spin"
          onClick={() => handleButtonClick(() => onNavigate("lucky-spin"))}
          className="group relative flex flex-col items-center justify-center w-[54px] h-[54px] rounded-full bg-gradient-to-br from-amber-500/25 via-yellow-500/15 to-amber-600/35 border border-amber-400/50 shadow-[0_4px_18px_rgba(245,158,11,0.4)] hover:scale-105 active:scale-95 transition-all duration-200"
        >
          <div className="relative w-10 h-10 flex items-center justify-center">
            <img
              src={asset("/assets/luckyspin/floating-wheel.png")}
              alt="Lucky Spin Wheel"
              className="w-full h-full object-contain filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] group-hover:rotate-45 transition-transform duration-500"
            />
          </div>
          <span className="absolute -bottom-1 bg-gradient-to-r from-amber-500 to-yellow-400 text-[11px] font-black text-black px-1.5 py-[1px] rounded-full uppercase tracking-tighter shadow-md whitespace-nowrap">
            Lucky
          </span>
        </button>

        {/* 2. Invite Wheel Floating Button */}
        <button
          type="button"
          aria-label="Invite Wheel"
          onClick={() => handleButtonClick(() => onNavigate("spin"))}
          className="group relative flex flex-col items-center justify-center w-[54px] h-[54px] rounded-full bg-gradient-to-br from-red-500/25 via-amber-500/15 to-yellow-600/35 border border-yellow-400/50 shadow-[0_4px_18px_rgba(234,179,8,0.4)] hover:scale-105 active:scale-95 transition-all duration-200"
        >
          <div className="relative w-10 h-10 flex items-center justify-center">
            <img
              src={asset("/assets/invitewheel/floating-wheel.png")}
              alt="Invite Wheel"
              className="w-full h-full object-contain filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] group-hover:rotate-45 transition-transform duration-500"
            />
          </div>
          <span className="absolute -bottom-1 bg-gradient-to-r from-red-500 to-amber-400 text-[11px] font-black text-white px-1.5 py-[1px] rounded-full uppercase tracking-tighter shadow-md whitespace-nowrap">
            Invite
          </span>
        </button>

        {/* 3. Telegram Floating Button */}
        <button
          type="button"
          aria-label="Telegram Channel"
          onClick={() => handleButtonClick(() => openSafeUrl(OFFICIAL_TELEGRAM_URL))}
          className="group relative flex flex-col items-center justify-center w-[54px] h-[54px] rounded-full bg-gradient-to-br from-[#2AABEE] via-[#229ED9] to-[#1D82B6] border border-cyan-300/50 shadow-[0_4px_18px_rgba(42,171,238,0.45)] hover:scale-105 active:scale-95 transition-all duration-200"
        >
          <FaTelegramPlane size={24} color="#ffffff" className="ml-0.5 group-hover:scale-110 transition-transform" />
          <span className="absolute -bottom-1 bg-gradient-to-r from-cyan-400 to-blue-500 text-[11px] font-black text-white px-1.5 py-[1px] rounded-full uppercase tracking-tighter shadow-md whitespace-nowrap">
            Telegram
          </span>
        </button>

        {/* 4. Dragon Assistant Floating Button */}
        {isLoggedIn && (
          <button
            type="button"
            aria-label="Dragon Assistant"
            onClick={() => handleButtonClick(openDragonAssistant)}
            className="group relative flex flex-col items-center justify-center w-[54px] h-[54px] rounded-full bg-gradient-to-br from-purple-600/40 via-purple-500/20 to-fuchsia-700/40 border border-purple-300/50 shadow-[0_4px_18px_rgba(168,85,247,0.45)] hover:scale-105 active:scale-95 transition-all duration-200 overflow-visible"
          >
            <div className="relative w-10 h-10 flex items-center justify-center">
              <img
                src={asset("/assets/svg/dragon.svg")}
                alt="Dragon Assistant"
                className="w-full h-full object-contain pointer-events-none group-hover:scale-110 transition-transform duration-300"
              />
            </div>
            <span className="absolute -bottom-1 bg-gradient-to-r from-purple-500 to-fuchsia-500 text-[11px] font-black text-white px-1.5 py-[1px] rounded-full uppercase tracking-tighter shadow-md whitespace-nowrap">
              Dragon
            </span>
          </button>
        )}

        {/* 5. Customer Support (CS) Floating Button */}
        {isLoggedIn && (
          <button
            type="button"
            aria-label="Customer Support"
            onClick={() =>
              handleButtonClick(() => openSafeUrl(OFFICIAL_TELEGRAM_URL))
            }
            className="group relative flex flex-col items-center justify-center w-[54px] h-[54px] rounded-full bg-gradient-to-br from-[#FED358] via-[#FFB472] to-[#CF7C10] border border-amber-200/60 shadow-[0_4px_18px_rgba(254,211,88,0.5)] hover:scale-105 active:scale-95 transition-all duration-200"
          >
            <IoHeadset size={24} color="#110D14" className="group-hover:scale-110 transition-transform" />
            <span className="absolute -bottom-1 bg-gradient-to-r from-amber-600 to-yellow-600 text-[11px] font-black text-white px-1.5 py-[1px] rounded-full uppercase tracking-tighter shadow-md whitespace-nowrap">
              Support
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
