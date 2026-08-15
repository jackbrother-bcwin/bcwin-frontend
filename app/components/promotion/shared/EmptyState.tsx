"use client";

import React from "react";

export default function EmptyState({ label = "No data" }: { label?: string }) {
  return (
    <div className="agency-empty">
      <div className="agency-empty-art" aria-hidden>
        <svg width="120" height="100" viewBox="0 0 120 100" fill="none">
          {/* soft ground / hills */}
          <ellipse cx="60" cy="88" rx="48" ry="8" fill="#1a1518" />
          <path
            d="M8 78c8-10 18-14 28-10 6 2 10 0 14-6 6-10 18-12 28-4 8 6 16 4 24-2 6-5 12-4 18 2v20H8V78z"
            fill="#1e191c"
          />
          {/* trees */}
          <path d="M22 72l4-14 4 14H22z" fill="#2a2428" />
          <rect x="25" y="72" width="2" height="6" fill="#2a2428" />
          <path d="M90 70l5-16 5 16H90z" fill="#2a2428" />
          <rect x="93.5" y="70" width="2" height="8" fill="#2a2428" />
          {/* parchment scroll */}
          <path
            d="M38 18c0-4 6-6 14-6h22c8 0 12 3 12 8v48c0 5-4 8-12 8H52c-8 0-14-3-14-8V18z"
            fill="#2e282c"
            stroke="#3d3630"
            strokeWidth="1.5"
          />
          <path
            d="M40 22c0-2 4-4 12-4h20c6 0 10 2 10 5v42c0 3-4 5-10 5H52c-8 0-12-2-12-5V22z"
            fill="#241E22"
          />
          {/* lines on paper */}
          <path
            d="M48 34h24M48 42h20M48 50h22M48 58h16"
            stroke="#3d3630"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* paper plane */}
          <path d="M62 40l22-16-8 20-6-6-8 2z" fill="#3d3630" opacity="0.9" />
          <path d="M62 40l8 2 6 6" stroke="#4a4240" strokeWidth="0.8" fill="none" />
          {/* dashed trail */}
          <path
            d="M84 24c6 4 10 10 8 18"
            stroke="#3d3630"
            strokeWidth="1"
            strokeDasharray="2 3"
            fill="none"
          />
          {/* small box */}
          <rect x="78" y="62" width="14" height="10" rx="1" fill="#2a2428" stroke="#3d3630" />
          <path d="M78 65h14" stroke="#3d3630" />
        </svg>
      </div>
      <p className="agency-empty-label">{label}</p>
    </div>
  );
}
