"use client";

import React from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";

import SpinWheelAsset from "./ui/SpinWheelAsset";

interface BottomNavProps {
  currentTab: string;
  onChangeTab: (tab: string) => void;
  /** Center spin hub — should push (not replace) so system back returns */
  onSpin?: () => void;
  /** True when SPA is on the spin screen */
  spinActive?: boolean;
}

const TABS = [
  {
    id: "home",
    labelKey: "nav.home",
    icon: "/assets/png/home_nor-589e7073.png",
    iconActive: "/assets/png/home_sel-b5bc73a5.webp",
  },
  {
    id: "activity",
    labelKey: "nav.activity",
    icon: "/assets/png/activity_nor-92e1ebc6.webp",
    iconActive: "/assets/png/activity_sel-58a0970f.webp",
  },
  {
    id: "promotion",
    labelKey: "nav.promotion",
    icon: "/assets/png/promotion_nor-c74223bc.png",
    iconActive: "/assets/png/promotion_sel-d3f0df2c.webp",
  },
  {
    id: "profile",
    labelKey: "nav.account",
    icon: "/assets/png/mine_nor-50322d77.webp",
    iconActive: "/assets/png/mine_sel-bc95a7c2.webp",
  },
] as const;

/**
 * Screenshot-matched bottom bar (BCWIN-style):
 * dark curved dock + elevated gold wheel hub + 4 side tabs.
 */
export default function BottomNav({
  currentTab,
  onChangeTab,
  onSpin,
  spinActive = false,
}: BottomNavProps) {
  const { t } = useTranslation();
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  const handleSpinClick = () => {
    if (onSpin) {
      onSpin();
    } else {
      onChangeTab("spin");
    }
  };

  return (
    <nav className="home-bottom-nav" aria-label="Main">
      {/* Soft gold rim / dock body */}
      <div className="home-bottom-nav-dock" aria-hidden />

      <div className="home-bottom-nav-inner">
        {left.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            label={t(tab.labelKey)}
            isActive={currentTab === tab.id}
            onClick={() => onChangeTab(tab.id)}
          />
        ))}

        {/* Center elevated Get ₹500 hub with upper-half visible wheel asset */}
        <div className="home-spin-slot">
          <button
            type="button"
            onClick={handleSpinClick}
            className="home-spin-btn group"
            aria-label={t("nav.getSpin")}
            aria-current={spinActive ? "page" : undefined}
          >
            {/* Ambient Gold Glow */}
            <div className="home-spin-glow" />

            {/* Upper half visible cropped wheel */}
            <div className="home-spin-wheel-crop">
              <SpinWheelAsset
                size={88}
                centerText="GO"
                className="transform group-hover:scale-105 group-active:scale-95 transition-transform duration-200"
              />
            </div>
          </button>
          <span
            className="home-spin-label"
            style={{ color: spinActive ? "#FED358" : "#FFC107" }}
          >
            {t("nav.getSpin")}
          </span>
        </div>

        {right.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            label={t(tab.labelKey)}
            isActive={currentTab === tab.id}
            onClick={() => onChangeTab(tab.id)}
          />
        ))}
      </div>
    </nav>
  );
}

function TabButton({
  tab,
  label,
  isActive,
  onClick,
}: {
  tab: (typeof TABS)[number];
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      aria-label={label}
      className="home-tab-btn"
    >
      <span
        className={`home-tab-icon ${isActive ? "home-tab-icon--active" : ""}`}
      >
        <Image
          src={isActive ? tab.iconActive : tab.icon}
          alt=""
          width={26}
          height={26}
          className="object-contain"
          draggable={false}
        />
      </span>
      <span className={`home-tab-label ${isActive ? "home-tab-label--active" : ""}`}>
        {label}
      </span>
      {isActive && <span className="home-tab-indicator" aria-hidden />}
    </button>
  );
}
