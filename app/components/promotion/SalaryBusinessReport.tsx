"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../../lib/api";
import type {
  SalaryBusinessDay,
  SalaryBusinessLeg,
  SalaryBusinessReport as SalaryBusinessReportData,
  SalaryBusinessSort,
} from "../../lib/api";
import { formatINR } from "../../lib/format";

const PAGE_SIZE = 10;

function percentage(value: number): string {
  if (value > 0 && value < 0.01) return "<0.01%";
  return `${value.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

function ContributionMetric({
  label,
  metric,
  active,
  tone,
}: {
  label: string;
  metric: SalaryBusinessLeg["deposit"];
  active: boolean;
  tone: "deposit" | "withdrawal";
}) {
  const width = Math.min(100, Math.max(0, metric.share));
  return (
    <div className={`sal-biz-metric ${active ? "is-active" : ""}`}>
      <div className="sal-biz-metric-head">
        <span>{label}</span>
        <strong>{formatINR(metric.amount)}</strong>
      </div>
      <div className="sal-biz-share-line">
        <div
          className="sal-biz-progress"
          role="progressbar"
          aria-label={`${label} contribution ${percentage(metric.share)}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, Math.max(0, metric.share))}
        >
          <span
            className={`sal-biz-progress-fill is-${tone}`}
            style={{ width: `${width}%` }}
          />
        </div>
        <strong className={`sal-biz-share is-${tone}`}>
          {percentage(metric.share)}
        </strong>
      </div>
    </div>
  );
}

export default function SalaryBusinessReport() {
  const [day, setDay] = useState<SalaryBusinessDay>("today");
  const [sortBy, setSortBy] = useState<SalaryBusinessSort>("deposit");
  const [report, setReport] = useState<SalaryBusinessReportData | null>(null);
  const [loadedPages, setLoadedPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);

  const load = useCallback(
    async (requestedPages: number, silent = false) => {
      const sequence = ++requestSequence.current;
      if (silent) setRefreshing(true);
      else setLoading(true);

      try {
        const first = await api.getSalaryBusinessReport({
          day,
          sortBy,
          page: 1,
          limit: PAGE_SIZE,
        });
        const pageCount = Math.min(
          Math.max(1, requestedPages),
          first.pagination.totalPages
        );
        const responses = [first];
        for (let page = 2; page <= pageCount; page++) {
          responses.push(
            await api.getSalaryBusinessReport({
              day,
              sortBy,
              page,
              limit: PAGE_SIZE,
            })
          );
        }
        if (sequence !== requestSequence.current) return;

        setReport({
          ...first,
          legs: responses.flatMap((response) => response.legs),
          pagination: {
            ...first.pagination,
            page: pageCount,
          },
        });
        setLoadedPages(pageCount);
        setError("");
      } catch (caught: unknown) {
        if (sequence !== requestSequence.current) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load team business"
        );
      } finally {
        if (sequence === requestSequence.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [day, sortBy]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(1), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (day !== "today") return;
    const timer = window.setInterval(
      () => void load(loadedPages, true),
      15_000
    );
    return () => window.clearInterval(timer);
  }, [day, load, loadedPages]);

  const canLoadMore =
    report != null && loadedPages < report.pagination.totalPages;

  return (
    <section
      className="sal-card sal-biz-card"
      aria-labelledby="salary-business-title"
    >
      <div className="sal-biz-title-row">
        <div>
          <p className="sal-biz-kicker">TEAM ONLY · L1–L6</p>
          <h2 id="salary-business-title" className="sal-card-title">
            Team business report
          </h2>
        </div>
        <button
          type="button"
          className={`sal-biz-refresh ${refreshing ? "is-spinning" : ""}`}
          onClick={() => void load(loadedPages, true)}
          disabled={loading || refreshing}
          aria-label="Refresh team business report"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M20 6v5h-5M4 18v-5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M18.2 9A7 7 0 006.7 6.2L4 9m16 6l-2.7 2.8A7 7 0 016 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="sal-biz-day-tabs" role="group" aria-label="Business report day">
        {(["today", "yesterday"] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={day === option ? "is-active" : ""}
            onClick={() => {
              if (option === day) return;
              requestSequence.current += 1;
              setReport(null);
              setError("");
              setLoadedPages(1);
              setDay(option);
            }}
          >
            {option === "today" ? "Today" : "Yesterday"}
          </button>
        ))}
      </div>

      {error && !report ? (
        <div className="sal-biz-error">
          <p>{error}</p>
          <button type="button" onClick={() => void load(1)}>
            Try again
          </button>
        </div>
      ) : loading && !report ? (
        <div className="sal-biz-skeleton" aria-label="Loading team business report">
          <span />
          <span />
          <span />
        </div>
      ) : report ? (
        <>
          <p className="sal-biz-date">
            {report.day === "today" ? "Live today" : "Completed yesterday"}
            {" · "}
            {report.date} IST
            {refreshing ? " · Updating…" : ""}
          </p>

          {error ? (
            <p className="sal-biz-stale" role="status">
              Refresh failed · showing the last available result
            </p>
          ) : null}

          <div className="sal-biz-summary">
            <div className="sal-biz-summary-item is-deposit">
              <span>Team deposit</span>
              <strong>{formatINR(report.team.deposit)}</strong>
            </div>
            <div className="sal-biz-summary-item is-withdrawal">
              <span>Team withdrawal</span>
              <strong>{formatINR(report.team.withdrawal)}</strong>
            </div>
            <div className="sal-biz-summary-item is-l1">
              <span>Total L1</span>
              <strong>{report.team.l1Count.toLocaleString("en-IN")}</strong>
            </div>
          </div>

          {report.concentration.status !== "none" && report.concentration.leader ? (
            <div
              className={`sal-biz-balance is-${report.concentration.status}`}
              role="status"
            >
              <span className="sal-biz-balance-icon" aria-hidden>
                {report.concentration.status === "balanced" ? "✓" : "!"}
              </span>
              <div>
                <strong>
                  {report.concentration.status === "balanced"
                    ? "Business balanced"
                    : "Business concentrated"}
                </strong>
                <p>
                  Top deposit leg #{report.concentration.leader.uid} is{" "}
                  {percentage(report.concentration.leader.deposit.share)}.
                  {report.concentration.status === "concentrated"
                    ? ` Keep it at or below ${report.concentration.threshold}%.`
                    : " Within the 80% balance limit."}
                </p>
              </div>
            </div>
          ) : null}

          <div className="sal-biz-section-head">
            <div>
              <h3>Level breakdown</h3>
              <p>Successful amounts by team depth</p>
            </div>
          </div>
          <div className="sal-biz-level-grid">
            {report.levels.map((level) => (
              <div key={level.level} className="sal-biz-level">
                <span className="sal-biz-level-name">L{level.level}</span>
                <div>
                  <small>Deposit</small>
                  <strong>{formatINR(level.deposit)}</strong>
                </div>
                <div>
                  <small>Withdrawal</small>
                  <strong>{formatINR(level.withdrawal)}</strong>
                </div>
              </div>
            ))}
          </div>

          <div className="sal-biz-section-head sal-biz-contribution-head">
            <div>
              <h3>Direct contribution</h3>
              <p>
                {report.pagination.total.toLocaleString("en-IN")} contributing L1
                {report.pagination.total === 1 ? "" : "s"}
              </p>
            </div>
            <div className="sal-biz-sort" role="group" aria-label="Sort contribution by">
              {(["deposit", "withdrawal"] as const).map((metric) => (
                <button
                  key={metric}
                  type="button"
                  className={sortBy === metric ? "is-active" : ""}
                  onClick={() => {
                    if (metric === sortBy) return;
                    requestSequence.current += 1;
                    setReport(null);
                    setError("");
                    setLoadedPages(1);
                    setSortBy(metric);
                  }}
                >
                  {metric === "deposit" ? "Deposit" : "Withdrawal"}
                </button>
              ))}
            </div>
          </div>

          {report.legs.length === 0 ? (
            <div className="sal-biz-empty">
              <strong>No contributing direct business</strong>
              <p>
                Your total L1 count is {report.team.l1Count.toLocaleString("en-IN")},
                but no direct leg has a successful deposit or withdrawal for this day.
              </p>
            </div>
          ) : (
            <div className="sal-biz-leg-list">
              {report.legs.map((leg, index) => (
                <article key={leg.uid} className="sal-biz-leg">
                  <div className="sal-biz-leg-head">
                    <span className="sal-biz-rank">{index + 1}</span>
                    <div className="sal-biz-identity">
                      <strong>{leg.name}</strong>
                      <span>UID #{leg.uid}</span>
                    </div>
                  </div>
                  <ContributionMetric
                    label="Deposit"
                    metric={leg.deposit}
                    active={sortBy === "deposit"}
                    tone="deposit"
                  />
                  <ContributionMetric
                    label="Withdrawal"
                    metric={leg.withdrawal}
                    active={sortBy === "withdrawal"}
                    tone="withdrawal"
                  />
                </article>
              ))}
            </div>
          )}

          {canLoadMore ? (
            <button
              type="button"
              className="sal-biz-load-more"
              disabled={loading}
              onClick={() => void load(loadedPages + 1)}
            >
              {loading ? "Loading…" : "Load 10 more"}
            </button>
          ) : report.legs.length > 0 ? (
            <p className="sal-biz-list-end">All contributing directs shown</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
