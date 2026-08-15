"use client";

import React from "react";

interface Props {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

/** Fixed agency title bar — stays put while document or content scrolls. */
export default function AgencyHeader({ title, onBack, right }: Props) {
  return (
    <>
      <header className="agency-header app-fixed-chrome fixed top-0 z-50">
        {onBack ? (
          <button type="button" className="agency-header-back" onClick={onBack} aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <span className="agency-header-spacer" />
        )}
        <h1 className="agency-header-title">{title}</h1>
        <div className="agency-header-right">{right ?? <span className="agency-header-spacer" />}</div>
      </header>
      <div className="agency-header-flow-spacer" aria-hidden />
    </>
  );
}
