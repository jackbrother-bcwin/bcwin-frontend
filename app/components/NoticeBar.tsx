"use client";

import React from "react";
import { IoVolumeHigh } from "react-icons/io5";
import { NOTICE_TEXT } from "../lib/home-catalog";

export default function NoticeBar() {
  return (
    <div className="mx-3 mt-2.5 home-notice">
      <div className="w-[22px] h-[22px] rounded-full shrink-0 flex items-center justify-center bg-[rgba(254,211,88,0.14)]">
        <IoVolumeHigh size={13} color="#FED358" />
      </div>
      <div className="overflow-hidden flex-1 min-w-0">
        <p className="text-[13px] text-[#FDE4BC]/90 whitespace-nowrap animate-marquee font-medium">
          {NOTICE_TEXT}
        </p>
      </div>
      <button type="button" className="home-chip shrink-0 !text-[#110D14] !bg-gradient-to-b from-[#FED358] to-[#FFB472] !border-0 shadow-[0_2px_8px_rgba(254,211,88,0.35)]">
        Detail
      </button>
    </div>
  );
}
