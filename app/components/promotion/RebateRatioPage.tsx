"use client";

/**
 * Rebate ratio tables — prefer GET /user/rebate/rates (DB seed),
 * fall back to static rebateTables if API fails / empty.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import AgencyHeader from "./shared/AgencyHeader";
import * as api from "../../lib/api";
import {
  REBATE_LEVELS,
  REBATE_TABLES,
  formatPct,
  mapApiRatesToTables,
  type RebateCategory,
  type LevelRates,
} from "./rebateTables";

interface Props {
  onBack: () => void;
}

const TABS: { id: RebateCategory; label: string; icon: React.ReactNode }[] = [
  {
    id: "lottery",
    label: "Lottery",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="9" opacity="0.25" />
        <circle cx="9" cy="10" r="1.5" />
        <circle cx="15" cy="10" r="1.5" />
        <circle cx="12" cy="14" r="1.5" />
        <path d="M7 17c1.5 1.5 8.5 1.5 10 0" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
    ),
  },
  {
    id: "slots",
    label: "Slots",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="4" width="16" height="16" rx="2" opacity="0.3" />
        <rect x="7" y="7" width="3" height="10" rx="0.5" />
        <rect x="10.5" y="7" width="3" height="10" rx="0.5" />
        <rect x="14" y="7" width="3" height="10" rx="0.5" />
      </svg>
    ),
  },
  {
    id: "casino",
    label: "Casino",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <rect x="3" y="5" width="18" height="12" rx="2" opacity="0.3" />
        <path d="M3 15h18v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2z" />
        <circle cx="12" cy="11" r="2" />
      </svg>
    ),
  },
  {
    id: "sports",
    label: "Sports",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 3c2 3 2 15 0 18M3 12c3-2 15-2 18 0M5.5 6.5c4 2 9 2 13 0M5.5 17.5c4-2 9-2 13 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        />
      </svg>
    ),
  },
  {
    id: "rummy",
    label: "Rummy",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <rect x="5" y="3" width="10" height="14" rx="1.5" opacity="0.35" transform="rotate(-8 10 10)" />
        <rect x="9" y="5" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <path d="M12 10l2 2 3-4" stroke="currentColor" strokeWidth="1.4" fill="none" />
      </svg>
    ),
  },
];

export default function RebateRatioPage({ onBack }: Props) {
  const [cat, setCat] = useState<RebateCategory>("lottery");
  const [tables, setTables] = useState(REBATE_TABLES);
  const [loading, setLoading] = useState(true);
  const [fromApi, setFromApi] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getRebateRates();
      const mapped = mapApiRatesToTables(res?.data ?? null);
      // Prefer API if at least one category has non-empty rows
      const hasRows =
        res?.data &&
        Object.values(res.data).some(
          (arr) => Array.isArray(arr) && arr.length > 0
        );
      setTables(mapped);
      setFromApi(Boolean(hasRows));
    } catch {
      setTables(REBATE_TABLES);
      setFromApi(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const table = useMemo(
    () => tables[cat] ?? REBATE_TABLES[cat],
    [tables, cat]
  );

  return (
    <div className="agency-page">
      <AgencyHeader title="Rebate ratio" onBack={onBack} />
      <div className="agency-scroll">
        <div className="agency-rebate-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={
                cat === t.id
                  ? "agency-rebate-tab agency-rebate-tab--on"
                  : "agency-rebate-tab"
              }
              onClick={() => setCat(t.id)}
            >
              <span className="agency-rebate-tab-ico">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="agency-loading">Loading rates…</p>
        ) : (
          <>
            {!fromApi ? (
              <p className="agency-rebate-source-hint">
                Showing offline tables (live rates unavailable)
              </p>
            ) : null}

            {REBATE_LEVELS.map((lv) => {
              const rates: LevelRates =
                table[lv] ?? REBATE_TABLES[cat][lv] ?? [0, 0, 0, 0, 0, 0];
              return (
                <div key={lv} className="agency-rebate-block">
                  <p className="agency-rebate-level">
                    Rebate level{" "}
                    <span className="text-[#FED358] font-black">{lv}</span>
                  </p>
                  <ul className="agency-rebate-list">
                    {rates.map((pct, i) => (
                      <li key={i}>
                        <span className="agency-rebate-dot" />
                        <span className="agency-rebate-desc">
                          {i + 1} level lower level commission rebate
                        </span>
                        <span className="agency-rebate-pct">
                          {formatPct(pct)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
