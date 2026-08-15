"use client";

import React from "react";
import { IoChevronBack } from "react-icons/io5";

interface PageHeaderProps {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  /** When true (default), header is fixed to the top of the viewport */
  sticky?: boolean;
}

/**
 * Shared page chrome. Uses position:fixed (not sticky) so ancestor
 * overflow-x never steals the scrollport and hides the bar.
 */
export default function PageHeader({
  title,
  onBack,
  right,
  sticky = true,
}: PageHeaderProps) {
  if (!sticky) {
    return (
      <header
        className="h-[52px] flex items-center justify-between px-3"
        style={{
          background: "linear-gradient(180deg, #241E22 0%, #110D14 100%)",
          borderBottom: "1px solid rgba(162,132,34,0.28)",
        }}
      >
        <HeaderInner title={title} onBack={onBack} right={right} />
      </header>
    );
  }

  return (
    <>
      <header className="app-page-header app-page-header--lg app-fixed-chrome fixed top-0 z-50">
        <div className="app-page-header-inner">
          <HeaderInner title={title} onBack={onBack} right={right} />
        </div>
      </header>
      <div className="app-page-header-spacer app-page-header-spacer--lg" aria-hidden />
    </>
  );
}

function HeaderInner({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <>
      <div className="w-10 flex items-center shrink-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center text-[#FDE4BC] active:opacity-60"
            aria-label="Back"
          >
            <IoChevronBack size={22} />
          </button>
        )}
      </div>
      <h1 className="text-[13px] sm:text-[15px] font-bold text-[#FDE4BC] tracking-wide truncate px-1 sm:px-2 min-w-0 flex-1 text-center">
        {title}
      </h1>
      <div className="min-w-10 max-w-[38%] flex items-center justify-end text-[#FED358] shrink-0">
        {right}
      </div>
    </>
  );
}
