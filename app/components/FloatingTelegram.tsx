"use client";

import React from "react";
import { FaTelegramPlane } from "react-icons/fa";
import DraggableFloat from "./DraggableFloat";
import { openSafeUrl } from "../lib/safe";
import { OFFICIAL_TELEGRAM_URL } from "../lib/official-hosts";

/**
 * Floating Telegram shortcut — sits above CS + Dragon on the right stack.
 */
export default function FloatingTelegram() {
  return (
    <DraggableFloat
      id="telegram"
      size={48}
      defaultBottom={228}
      defaultRight={12}
      zIndex={42}
      aria-label="Telegram official channel"
      onClick={() => {
        openSafeUrl(OFFICIAL_TELEGRAM_URL);
      }}
      className="rounded-full flex items-center justify-center"
      style={{
        background: "linear-gradient(145deg, #54A9EB 0%, #2AABEE 50%, #229ED9 100%)",
        boxShadow:
          "0 4px 18px rgba(42,171,238,0.5), 0 0 0 2px rgba(17,13,20,0.8), inset 0 1px 0 rgba(255,255,255,0.35)",
      }}
    >
      <FaTelegramPlane size={22} color="#ffffff" style={{ marginLeft: 1 }} />
    </DraggableFloat>
  );
}
