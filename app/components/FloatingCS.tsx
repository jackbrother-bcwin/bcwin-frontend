"use client";

import React from "react";
import { IoHeadset } from "react-icons/io5";
import DraggableFloat from "./DraggableFloat";
import { useAuthState } from "../context/AuthContext";

export default function FloatingCS() {
  const { isLoggedIn } = useAuthState();
  if (!isLoggedIn) return null;

  return (
    <DraggableFloat
      id="cs"
      size={48}
      defaultBottom={96}
      defaultRight={12}
      zIndex={40}
      aria-label="Customer service"
      onClick={() => {
        /* CS link can be wired later */
      }}
      className="rounded-full flex items-center justify-center"
      style={{
        background: "linear-gradient(145deg, #FED358 0%, #FFB472 55%, #CF7C10 100%)",
        boxShadow:
          "0 4px 18px rgba(254,211,88,0.5), 0 0 0 2px rgba(17,13,20,0.8), inset 0 1px 0 rgba(255,255,255,0.4)",
      }}
    >
      <IoHeadset size={22} color="#110D14" />
    </DraggableFloat>
  );
}
