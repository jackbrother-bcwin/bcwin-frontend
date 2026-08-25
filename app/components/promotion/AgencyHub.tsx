"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import * as api from "../../lib/api";
import { formatINR } from "../../lib/format";
import { useToast } from "../ui/Toast";
import AgencyHeader from "./shared/AgencyHeader";
import MenuRow from "./shared/MenuRow";
import type { AgencyView } from "./types";
import { latestSettledYmd, shiftYmd, ymdIst } from "./dateRange";
import { AUTO_SALARY_LIVE, SALARY_DASHBOARD_NOTICE } from "../../lib/auto-salary";

interface Props {
  onOpen: (view: AgencyView) => void;
  onNavigate?: (screen: string) => void;
}

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export default function AgencyHub({ onOpen, onNavigate }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [yesterday, setYesterday] = useState(0);
  const [weekCommission, setWeekCommission] = useState(0);
  const [direct, setDirect] = useState(0);
  const [team, setTeam] = useState(0);
  const [lifeDirect, setLifeDirect] = useState(0);
  const [lifeTeam, setLifeTeam] = useState(0);
  const [teamDeposit, setTeamDeposit] = useState(0);
  const [directDeposit, setDirectDeposit] = useState(0);
  const [directDepCount, setDirectDepCount] = useState(0);
  const [teamDepCount, setTeamDepCount] = useState(0);
  const [directFirstDep, setDirectFirstDep] = useState(0);
  const [teamFirstDep, setTeamFirstDep] = useState(0);
  const [lifetime, setLifetime] = useState(0);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const ymdYest = latestSettledYmd();
      const today = ymdIst();
      const weekStart = shiftYmd(today, -6);

      const [ovLife, ovYest, rebateYest, weekSum] = await Promise.all([
        api.getTeamOverview().catch(() => null),
        api.getTeamOverview({ date: ymdYest }).catch(() => null),
        api.getRebateDaily({ date: ymdYest }).catch(() => null),
        api
          .sumRebatesInRange({
            startDate: weekStart,
            endDate: today,
            settled: "all",
          })
          .catch(() => 0),
      ]);

      if (ovYest?.data) {
        const d = ovYest.data;
        const l1 = n(d.directTeamSize);
        const all = n(d.totalTeamSize);
        setDirect(l1);
        setTeam(Math.max(0, all - l1));
        setDirectDeposit(n(d.directTeamDeposit));
        setTeamDeposit(
          Math.max(0, n(d.totalTeamDeposit) - n(d.directTeamDeposit))
        );
        setDirectDepCount(n(d.directDepositCount));
        setTeamDepCount(
          Math.max(0, n(d.teamDepositCount) - n(d.directDepositCount))
        );
        setDirectFirstDep(n(d.directFirstDepositUsers));
        setTeamFirstDep(
          Math.max(0, n(d.teamFirstDepositUsers) - n(d.directFirstDepositUsers))
        );
      }

      if (ovLife?.data) {
        const d = ovLife.data;
        const l1 = n(d.directTeamSize);
        setLifeDirect(l1);
        setLifeTeam(Math.max(0, n(d.totalTeamSize) - l1));
        setLifetime(n(d.totalCommissionEarned));
      }

      setYesterday(n(rebateYest?.data?.totalCommission));
      setWeekCommission(n(weekSum));
    } catch {
      /* keep zeros */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const code = user?.referralCode ?? "—";
  const handleCopy = async () => {
    if (!user?.referralCode) {
      toast("No invitation code", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(user.referralCode);
      setCopied(true);
      toast("Invitation code copied", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Copy failed", "error");
    }
  };

  return (
    <div className="agency-page">
      <AgencyHeader
        title="Agency"
        right={
          <button
            type="button"
            className="agency-filter-btn agency-header-right"
            aria-label="New subordinates"
            title="New subordinates"
            onClick={() => onOpen("newSubordinates")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FED358" strokeWidth="2">
              <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
            </svg>
          </button>
        }
      />

      <div className="agency-scroll">
        {/* Hero commission */}
        <div className="agency-hero">
          <p className="agency-hero-amount">{formatINR(yesterday)}</p>
          <div className="agency-hero-pill">Yesterday&apos;s total commission</div>
          <p className="agency-hero-hint">Upgrade the level to increase commission income</p>
        </div>

        {/* Direct / Team columns */}
        <div className="agency-sub-card">
          <div className="agency-sub-tabs">
            <span className="agency-sub-tab agency-sub-tab--on">Direct subordinates</span>
            <span className="agency-sub-tab agency-sub-tab--on">Team subordinates</span>
          </div>
          <div className="agency-sub-grid">
            <div className="agency-sub-col">
              <Stat label="number of register" value={direct} accent count />
              <Stat label="Deposit number" value={directDepCount} count />
              <Stat label="Deposit amount" value={directDeposit} money />
              <Stat
                label="Number of people making first deposit"
                value={directFirstDep}
                count
              />
            </div>
            <div className="agency-sub-divider" />
            <div className="agency-sub-col">
              <Stat label="number of register" value={team} accent count />
              <Stat label="Deposit number" value={teamDepCount} count />
              <Stat label="Deposit amount" value={teamDeposit} money />
              <Stat
                label="Number of people making first deposit"
                value={teamFirstDep}
                count
              />
            </div>
          </div>
        </div>

        <button type="button" className="agency-invite-cta" onClick={() => onOpen("invite")}>
          INVITATION LINK
        </button>

        {!AUTO_SALARY_LIVE ? (
          <div
            className="mx-3 mb-3 rounded-[12px] px-3 py-2.5 text-[13px] leading-relaxed text-[#FDE4BC]"
            style={{
              background: "#282330",
              border: "1px solid rgba(254,211,88,0.35)",
            }}
          >
            {SALARY_DASHBOARD_NOTICE}
          </div>
        ) : null}

        <div className="agency-menu">
          <MenuRow
            icon={<MenuIconCommissionNew />}
            label="Commission dashboard"
            isNew
            onClick={() => onOpen("commission")}
          />
          <MenuRow
            icon={<MenuIconSalaryNew />}
            label="Salary dashboard"
            subtitle={!AUTO_SALARY_LIVE ? "Maintenance" : undefined}
            isNew={AUTO_SALARY_LIVE}
            onClick={() => onOpen("salary")}
          />
          <MenuRow
            icon={<MenuIconAgentBot />}
            label="Agent Bot"
            subtitle="Earnings · subordinates · Excel — on Telegram"
            isNew
            onClick={() => {
              if (typeof window !== "undefined") {
                window.open("https://t.me/bcwinwin_bot", "_blank", "noopener,noreferrer");
              }
            }}
          />
          <MenuRow
            icon={<MenuIconCopy />}
            label="Copy invitation code"
            chevron={false}
            trailing={
              <span className="agency-code-trail">
                <span className="agency-code-text">{code}</span>
                <span className="agency-code-copy" aria-hidden>
                  {copied ? "✓" : "⧉"}
                </span>
              </span>
            }
            onClick={handleCopy}
          />
          <MenuRow
            icon={<MenuIconList />}
            label="Subordinate data"
            onClick={() => onOpen("subordinates")}
          />
          <MenuRow
            icon={<MenuIconCommissionDetail />}
            label="Commission detail"
            onClick={() => onOpen("commissionDetail")}
          />
          <MenuRow
            icon={<MenuIconBook />}
            label="Invitation rules"
            onClick={() => onOpen("rules")}
          />
          <MenuRow
            icon={<MenuIconCs />}
            label="Agent line customer service"
            onClick={() => onNavigate?.("feedback")}
          />
          <MenuRow
            icon={<MenuIconRebate />}
            label="Rebate ratio"
            onClick={() => onOpen("rebate")}
          />
        </div>

        {/* promotion data footer block */}
        <div className="agency-promo-data">
          <div className="agency-promo-data-head">
            <span className="agency-promo-data-icon" aria-hidden>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#110D14">
                <circle cx="12" cy="12" r="3" />
                <path
                  d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"
                  stroke="#110D14"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </span>
            <span>promotion data</span>
          </div>
          <div className="agency-promo-data-grid">
            <div>
              <p className="agency-promo-data-val">{formatINR(weekCommission)}</p>
              <p className="agency-promo-data-lab">This Week</p>
            </div>
            <div>
              <p className="agency-promo-data-val">{formatINR(lifetime)}</p>
              <p className="agency-promo-data-lab">Total commission</p>
            </div>
            <div>
              <p className="agency-promo-data-val">{Math.round(lifeDirect)}</p>
              <p className="agency-promo-data-lab">direct subordinate</p>
            </div>
            <div>
              <p className="agency-promo-data-val">{Math.round(lifeTeam)}</p>
              <p className="agency-promo-data-lab">Team subordinates (L2–L6)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  money,
  count,
}: {
  label: string;
  value: number;
  accent?: boolean;
  /** Currency — always 3 decimals */
  money?: boolean;
  /** Whole people/counts */
  count?: boolean;
}) {
  let display: string | number;
  if (money) {
    display = formatINR(value);
  } else if (count) {
    display = Math.round(n(value));
  } else {
    display = formatINR(value);
  }
  return (
    <div className="agency-stat">
      <p className={accent ? "agency-stat-val agency-stat-val--green" : "agency-stat-val"}>
        {display}
      </p>
      <p className="agency-stat-lab">{label}</p>
    </div>
  );
}

function MenuIconCopy() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="8" y="8" width="11" height="13" rx="2" fill="#FED358" opacity="0.35" />
      <rect x="5" y="3" width="11" height="13" rx="2" stroke="#FED358" strokeWidth="1.6" />
      <path d="M8 8h5M8 11h5M8 14h3" stroke="#FED358" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function MenuIconList() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="3" width="14" height="18" rx="2" fill="#FED358" opacity="0.2" stroke="#FED358" strokeWidth="1.4" />
      <path d="M8 8h8M8 12h8M8 16h5" stroke="#FED358" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
/** Agent commission — chart + coin */
function MenuIconCommissionNew() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#FED358" opacity="0.18" />
      <path
        d="M7 16V12M11 16V9M15 16v-5M19 16V7"
        stroke="#FED358"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="18" cy="7" r="2.2" fill="#FED358" />
    </svg>
  );
}
/** Salary dashboard — calendar + ₹ */
function MenuIconSalaryNew() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="3" fill="#FED358" opacity="0.18" stroke="#FED358" strokeWidth="1.4" />
      <path d="M3.5 9.5h17" stroke="#FED358" strokeWidth="1.4" />
      <path d="M8 3.5v3M16 3.5v3" stroke="#FED358" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M12 12.2v5.2M10 13.4c.35-.7 1.15-1.15 2-1.15s1.65.45 2 1.15c.25.55-.15 1.1-.85 1.35L12 15.2l-1.15.45c-.7.25-1.1.8-.85 1.35.35.7 1.15 1.15 2 1.15s1.65-.45 2-1.15"
        stroke="#FED358"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Agent Bot — robot avatar with headset & cyan visor */
function MenuIconAgentBot() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#18131B" stroke="#FED358" strokeWidth="1" strokeOpacity="0.4" />
      <circle cx="16" cy="6.5" r="1.5" fill="#FED358" />
      <path d="M16 8v2" stroke="#FED358" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="7.5" y="10" width="17" height="13.5" rx="3.5" fill="#26202C" stroke="#FED358" strokeWidth="1" />
      <rect x="5.5" y="13.5" width="2" height="6.5" rx="1" fill="#FED358" />
      <rect x="24.5" y="13.5" width="2" height="6.5" rx="1" fill="#FED358" />
      <rect x="10" y="12.5" width="12" height="6.5" rx="2" fill="#0C0A0E" />
      <circle cx="13" cy="15.8" r="1.3" fill="#00E5FF" />
      <circle cx="19" cy="15.8" r="1.3" fill="#00E5FF" />
      <circle cx="13.4" cy="15.4" r="0.4" fill="#FFFFFF" />
      <circle cx="19.4" cy="15.4" r="0.4" fill="#FFFFFF" />
      <rect x="9.5" y="24.5" width="13" height="4" rx="1.2" fill="#FED358" />
      <text x="16" y="27.6" textAnchor="middle" fill="#110D14" fontSize="3.2" fontWeight="900" fontFamily="system-ui, -apple-system, sans-serif" letterSpacing="0.4">BOT</text>
    </svg>
  );
}
function MenuIconBook() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M5 4h12a2 2 0 012 2v13H7a2 2 0 01-2-2V4z" fill="#FED358" opacity="0.2" />
      <path d="M5 4h12a2 2 0 012 2v13H7a2 2 0 00-2 2" stroke="#FED358" strokeWidth="1.5" />
      <path d="M8 8h8M8 12h6" stroke="#FED358" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
function MenuIconCs() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="10" r="4" fill="#FED358" opacity="0.25" stroke="#FED358" strokeWidth="1.4" />
      <path
        d="M5 18c1.5-2.5 4-4 7-4s5.5 1.5 7 4"
        stroke="#FED358"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M4 12h2M18 12h2" stroke="#FED358" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function MenuIconRebate() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" fill="#FED358" opacity="0.2" stroke="#FED358" strokeWidth="1.5" />
      <path d="M12 7v10M9 9.5c0-1.3 1.1-1.8 2.5-1.8s2.5.7 2.5 1.8c0 1.2-1.1 1.7-2.5 1.9-1.4.2-2.5.7-2.5 1.9 0 1.1 1.1 1.8 2.5 1.8s2.5-.7 2.5-1.8" stroke="#FED358" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 16h8" stroke="#FED358" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function MenuIconCommissionDetail() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="16" height="16" rx="3.5" fill="#FED358" opacity="0.2" stroke="#FED358" strokeWidth="1.4" />
      <path
        d="M12 7.5v9M9.5 9.8c0-1.1 1.1-1.8 2.5-1.8s2.5.7 2.5 1.8c0 1.2-1.1 1.7-2.5 1.9-1.4.2-2.5.7-2.5 1.9 0 1.1 1.1 1.8 2.5 1.8s2.5-.7 2.5-1.8"
        stroke="#FED358"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
