"use client";

import React from "react";

interface SectionShellProps {
  title?: string;
  icon?: string;
  showDetail?: boolean;
  /** Label for the detail chip — default "View all" */
  detailLabel?: string;
  showPager?: boolean;
  onDetail?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  children: React.ReactNode;
  className?: string;
  id?: string;
  /** Optional right-side meta (e.g. "67 games") */
  meta?: string;
}

/**
 * Shared section chrome: gold title + View all / pager controls.
 */
export default function SectionShell({
  title,
  icon,
  showDetail,
  detailLabel = "View all",
  showPager,
  onDetail,
  onPrev,
  onNext,
  children,
  className = "",
  id,
  meta,
}: SectionShellProps) {
  return (
    <section id={id} className={`home-section ${className}`}>
      {title && (
        <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
          <div className="flex min-w-0 items-center gap-1.5">
            {icon ? (
              <span
                className="shrink-0 text-[15px] leading-none drop-shadow-sm"
                aria-hidden
              >
                {icon}
              </span>
            ) : (
              <span className="home-section-bar shrink-0" aria-hidden />
            )}
            <h2 className="truncate text-[14px] font-bold tracking-wide text-[#FDE4BC]">
              {title}
            </h2>
            {meta && (
              <span className="shrink-0 text-[10px] font-medium tabular-nums text-[#6B5E58]">
                {meta}
              </span>
            )}
          </div>
          {(showDetail || showPager) && (
            <div className="flex shrink-0 items-center gap-1.5">
              {showDetail && (
                <button
                  type="button"
                  onClick={onDetail}
                  className="home-chip home-chip--viewall"
                >
                  {detailLabel}
                </button>
              )}
              {showPager && (
                <>
                  <button
                    type="button"
                    onClick={onPrev}
                    className="home-pager-btn"
                    aria-label="Previous"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={onNext}
                    className="home-pager-btn"
                    aria-label="Next"
                  >
                    ›
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
