"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useSpaBackClose } from "../../hooks/useSpaBackClose";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

interface PromoItem {
  id: string;
  kind: "item" | "warn";
  text: React.ReactNode;
  action?: (onNavigate?: (tab: string) => void) => void;
}

interface Props {
  open: boolean;
  onConfirm: () => void;
  onNavigate?: (tab: string) => void;
}

/** Marketing items matching BCWIN BIG BONUS popup requirement */
const PROMO_ITEMS: PromoItem[] = [
  {
    id: "daily-recharge",
    kind: "item",
    text: (
      <>
        <span className="promo-hl-line">DAILY RECHARGE</span>{" "}
        <span className="promo-hl-go active:brightness-125 transition-all">[GO]</span>
      </>
    ),
    action: (onNavigate) => onNavigate?.("deposit"),
  },
  {
    id: "daily-game-unlock",
    kind: "item",
    text: (
      <>
        <span className="promo-hl-line">DAILY GAME UNLOCK GIFT CODE</span>
        <br />
        <span className="promo-hl-link active:brightness-125 transition-all">Bonus[GO]</span>
      </>
    ),
    action: (onNavigate) => onNavigate?.("wingo"),
  },
  {
    id: "usdt-recharge-bonus",
    kind: "item",
    text: (
      <>
        Claim Maximum <span className="promo-hl-yellow">3%</span> Bonus On USDT Recharge{" "}
        <span className="promo-hl-more active:brightness-125 transition-all">[MORE]</span>
      </>
    ),
    action: (onNavigate) => onNavigate?.("deposit"),
  },
  // {
  //   id: "special-recharge-3day",
  //   kind: "item",
  //   text: (
  //     <>
  //       <span className="promo-hl-line">MONTHLY 3 DAY SPECIAL RECHARGE BONUS 3%</span>
  //       <br />
  //       🎉 <span className="promo-hl-yellow">9TH-19TH-29TH</span> 🎉{" "}
  //       <span className="promo-hl-go hover:brightness-125 transition-all">[GO]</span>
  //     </>
  //   ),
  //   action: (onNavigate) => onNavigate?.("deposit"),
  // },
  {
    id: "verify-true-bcwin",
    kind: "item",
    text: (
      <>
        Verify True <span className="promo-hl-red">BCWin</span> Site{" "}
        <span className="promo-hl-go active:brightness-125 transition-all">[GO]</span>
      </>
    ),
    action: () => {
      if (typeof window !== "undefined") {
        window.location.href = "/verifybcwinclub";
      }
    },
  },
  {
    id: "warning-note",
    kind: "warn",
    text: (
      <>
        🚫 Never transfer money to any strangers !!
        <br />
        Never send OTP to anyone claiming to be support.
      </>
    ),
  },
  {
    id: "invite-friends",
    kind: "item",
    text: (
      <>
        Invite friends · earn commission every day{" "}
        <span className="promo-hl-go active:brightness-125 transition-all">[GO]</span>
      </>
    ),
    action: (onNavigate) => onNavigate?.("promotion"),
  },
  {
    id: "spin-wheel",
    kind: "item",
    text: (
      <>
        Spin wheel free daily · deposit unlocks extra spins{" "}
        <span className="promo-hl-go active:brightness-125 transition-all">[GO]</span>
      </>
    ),
    action: (onNavigate) => onNavigate?.("spin"),
  },
];

/**
 * Daily flash promo — portaled to body so nothing clips fixed overlay.
 */
export default function DailyPromoPopup({ open, onConfirm, onNavigate }: Props) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  useSpaBackClose(open, onConfirm, "daily-promo-popup");
  useBodyScrollLock(open);

  if (!open || !mounted) return null;

  const handleItemClick = (item: PromoItem) => {
    if (item.kind === "warn" || !item.action) return;
    onConfirm();
    item.action(onNavigate);
  };

  return createPortal(
    <div
      className="promo-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Daily promotions"
    >
      <div className="promo-daily-card">
        <div className="promo-daily-ribbon">
          <span className="promo-daily-ribbon-icon" aria-hidden>
            🎗
          </span>
          <h2 className="promo-daily-ribbon-title">BCWIN BIG BONUS</h2>
          <span className="promo-daily-ribbon-icon" aria-hidden>
            🎗
          </span>
        </div>

        <div className="promo-daily-scroll">
          {PROMO_ITEMS.map((item) => (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              role={item.kind === "item" ? "button" : undefined}
              tabIndex={item.kind === "item" ? 0 : undefined}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleItemClick(item);
                }
              }}
              className={
                item.kind === "warn"
                  ? "promo-daily-line promo-daily-line--warn cursor-default"
                  : "promo-daily-line active:bg-white/5 active:scale-[0.99] cursor-pointer transition-all"
              }
            >
              {item.text}
            </div>
          ))}
        </div>

        <div className="promo-daily-scroll-hint" aria-hidden>
          <span />
          <span />
          <span />
        </div>

        <button type="button" className="promo-daily-confirm" onClick={onConfirm}>
          Confirm
        </button>
      </div>
    </div>,
    document.body
  );
}
