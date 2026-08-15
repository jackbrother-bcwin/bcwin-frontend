"use client";

/**
 * Commission Details → inner distribution
 * Pixel-matched to:
 *  notes/screenshots/comission-details-innerdetailspage{1,2,3}.png
 */

import React from "react";
import type { RebateDailyCategoryBlock, RebateDailySummary } from "../../lib/api";
import { formatDecimal, formatINR, roundMoney } from "../../lib/format";

interface Props {
  summary: RebateDailySummary;
  onBack: () => void;
  onOpenRebateRules?: () => void;
}

/** ₹ with Indian-style grouping — 3 dp */
function fmtInr(n: number) {
  return formatINR(n, 3);
}

/** TotalComm / settlement — compact K for large values, else 3 dp */
function fmtComm(n: number) {
  if (!Number.isFinite(n)) return "0.000";
  if (n === 0) return "0.000";
  const abs = Math.abs(n);
  if (abs >= 1000) {
    const k = roundMoney(n / 1000, 3);
    return `${formatDecimal(k, 3)}K`;
  }
  return formatDecimal(n, 3);
}

function fmtBet(n: number) {
  if (!Number.isFinite(n) || n === 0) return "0.000";
  return formatDecimal(n, 3);
}

function fmtRate(rate: number) {
  if (!Number.isFinite(rate) || rate === 0) return "0%";
  // rates can be tiny (0.001458%) — keep up to 6 significant fraction digits, max 6
  const r = roundMoney(rate, 6);
  let s = r.toFixed(6).replace(/\.?0+$/, "");
  if (!s.includes(".")) s = `${s}.0`;
  return `${s}%`;
}

/** Gold crown + L-badge — matches screenshot lower-level column */
function LayerBadge({ layer }: { layer: number }) {
  return (
    <span className="cdi-lvl">
      <img
        className="cdi-lvl-crown"
        src="/assets/png/crown1-3912fd85.png"
        alt=""
        width={28}
        height={28}
        draggable={false}
      />
      <span className="cdi-lvl-tag">L{layer}</span>
    </span>
  );
}

function CategoryBlock({ block }: { block: RebateDailyCategoryBlock }) {
  return (
    <section className="cdi-cat">
      <h3 className="cdi-cat-title">{block.title}</h3>

      <div className="cdi-meta">
        <div className="cdi-meta-row">
          <span className="cdi-meta-lab">
            <i className="cdi-dot" />
            Number of bettors
          </span>
          <span className="cdi-meta-val">
            {block.bettorCount}People
          </span>
        </div>
        <div className="cdi-meta-row">
          <span className="cdi-meta-lab">
            <i className="cdi-dot" />
            Rebate level
          </span>
          <span className="cdi-meta-val cdi-meta-val--orange">
            LV{block.rebateLevel}
          </span>
        </div>
        <div className="cdi-meta-row">
          <span className="cdi-meta-lab">
            <i className="cdi-dot" />
            Bet amount
          </span>
          <span className="cdi-meta-val cdi-meta-val--orange">
            {fmtInr(block.betAmount)}
          </span>
        </div>
        <div className="cdi-meta-row">
          <span className="cdi-meta-lab">
            <i className="cdi-dot" />
            Commission payout
          </span>
          <span className="cdi-meta-val cdi-meta-val--orange">
            {fmtInr(block.commissionPayout)}
          </span>
        </div>
      </div>

      <div className="cdi-table">
        <div className="cdi-thead" role="row">
          <span>lower level</span>
          <span>Bet amount</span>
          <span>Rebate ratio</span>
          <span>Total Comm</span>
        </div>
        <div className="cdi-tbody">
          {block.layers.map((row) => (
            <div key={row.layer} className="cdi-trow" role="row">
              <span className="cdi-tcell cdi-tcell--lvl">
                <LayerBadge layer={row.layer} />
              </span>
              <span className="cdi-tcell">{fmtBet(row.betAmount)}</span>
              <span className="cdi-tcell">{fmtRate(row.rate)}</span>
              <span className="cdi-tcell">{fmtComm(row.totalComm)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function CommissionDetailInnerPage({
  summary,
  onBack,
  onOpenRebateRules,
}: Props) {
  return (
    <div className="cdi-page">
      {/* Header — flat dark bar, white title (screenshot) */}
      <header className="cdi-header app-fixed-chrome fixed top-0 z-50">
        <button
          type="button"
          className="cdi-header-back"
          onClick={onBack}
          aria-label="Back"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h1 className="cdi-header-title">Details</h1>
        <span className="cdi-header-spacer" aria-hidden />
      </header>
      <div className="cdi-header-spacer-flow" aria-hidden />

      <div className="cdi-scroll">
        {/* Day totals card */}
        <div className="cdi-summary">
          <p className="cdi-summary-time">{summary.settlementTime}</p>
          <div className="cdi-summary-line" />

          <div className="cdi-summary-rows">
            <div className="cdi-summary-row">
              <span className="cdi-summary-lab">Total number of bettors</span>
              <span className="cdi-summary-val">
                {summary.bettorCount}People
              </span>
            </div>
            <div className="cdi-summary-row">
              <span className="cdi-summary-lab">Total bet amount</span>
              <span className="cdi-summary-val cdi-summary-val--orange">
                {fmtInr(summary.totalBetAmount)}
              </span>
            </div>
            <div className="cdi-summary-row">
              <span className="cdi-summary-lab">Total commission settlement</span>
              <span className="cdi-summary-val cdi-summary-val--orange">
                {fmtComm(summary.totalCommission)}
              </span>
            </div>
          </div>

          <div className="cdi-ticket-divider">
            <span className="cdi-notch cdi-notch-left" />
            <div className="cdi-dash" />
            <span className="cdi-notch cdi-notch-right" />
          </div>

          <button
            type="button"
            className="cdi-rules"
            onClick={() => onOpenRebateRules?.()}
          >
            Rebate level rules
          </button>
        </div>

        <div className="cdi-cats">
          {summary.categories.map((block) => (
            <CategoryBlock key={block.category} block={block} />
          ))}
        </div>
      </div>
    </div>
  );
}
