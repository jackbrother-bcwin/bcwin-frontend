"use client";

import React from "react";

interface Props {
  icon: React.ReactNode;
  label: string;
  subtitle?: React.ReactNode;
  onClick?: () => void;
  trailing?: React.ReactNode;
  chevron?: boolean;
  /** Small “NEW” pill after the label */
  isNew?: boolean;
}

export default function MenuRow({
  icon,
  label,
  subtitle,
  onClick,
  trailing,
  chevron = true,
  isNew = false,
}: Props) {
  return (
    <button type="button" className="agency-menu-row" onClick={onClick}>
      <span className="agency-menu-icon" aria-hidden>
        {icon}
      </span>
      <div className="agency-menu-content flex flex-col items-start justify-center min-w-0 flex-1 gap-0.5">
        <div className="agency-menu-title-row flex items-center gap-2">
          <span className="agency-menu-label text-[14px] font-semibold text-[#FDE4BC] leading-tight">{label}</span>
          {isNew ? <span className="agency-menu-new">NEW</span> : null}
        </div>
        {subtitle ? (
          <div className="agency-menu-sublabel text-[11px] text-[#8c7e75] font-normal leading-tight mt-0.5">
            {subtitle}
          </div>
        ) : null}
      </div>
      {trailing}
      {chevron && <span className="agency-menu-chevron">›</span>}
    </button>
  );
}
