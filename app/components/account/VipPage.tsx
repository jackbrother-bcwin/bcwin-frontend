"use client";

/**
 * VIP page — BCWIN UI + live backend:
 * GET /user/vip/status · requirements · claim-reward · claim-history
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { IoLockClosed } from "react-icons/io5";
import PageHeader from "../ui/PageHeader";
import LoadingSpinner from "../ui/LoadingSpinner";
import { useToast } from "../ui/Toast";
import * as api from "../../lib/api";
import type {
  VipLevelRequirement,
  VipRewardClaim,
  VipStatus,
} from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { sanitizeErrorMessage } from "../../lib/safe";
import { formatINR } from "../../lib/format";
import {
  labelForTxType,
  type TxFilterId,
} from "../history/transactionTypes";
import {
  SETTLEMENT_NOTE,
  VIP_ASSET,
  VIP_RULES,
  VIP_THEMES,
  defaultReqForLevel,
  formatExp,
  formatReward,
  formatSelfRebatePercent,
  selfRebatePercentForVip,
  vipBadgeSrc,
  type VipTheme,
} from "./vip/vipConfig";
import { Pagination } from "../game/shared";

const EXP_PAGE_SIZE = 15;

interface Props {
  onBack: () => void;
}

type SubTab = "history" | "rules";

type ExpHistoryItem = {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  exp: number;
};

/** Merged presentation + API requirement for carousel levels 1–10 */
type VipCardLevel = VipTheme & {
  expRequired: number;
  levelUpReward: number;
  monthlyReward: number;
  rebateRate: string | null;
  selfRebatePercent: number;
};

/** Prefer API value when > 0; else seed default */
function pickNum(apiVal: number | undefined | null, fallback: number): number {
  const n = Number(apiVal);
  if (Number.isFinite(n) && n > 0) return n;
  return fallback;
}

function currentMonthYear(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Keys for claimed UI: LEVEL_UP is forever; MONTHLY is per calendar month */
function claimKey(
  level: number,
  type: api.VipRewardClaimType,
  monthYear?: string | null
): string {
  if (type === "MONTHLY") {
    return `MONTHLY:${level}:${monthYear || currentMonthYear()}`;
  }
  return `LEVEL_UP:${level}`;
}

function claimsToClaimedSet(claims: VipRewardClaim[]): Set<string> {
  const set = new Set<string>();
  const thisMonth = currentMonthYear();
  for (const c of claims) {
    if (c.type === "LEVEL_UP") {
      set.add(claimKey(c.level, "LEVEL_UP"));
    } else if (c.type === "MONTHLY") {
      // only current month blocks re-claim
      if (c.monthYear === thisMonth || !c.monthYear) {
        set.add(claimKey(c.level, "MONTHLY", c.monthYear || thisMonth));
      }
    }
  }
  return set;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatRemain(ms: number): string {
  if (ms <= 0) return "Ready";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${pad2(h)}h ${pad2(m)}m`;
  if (h > 0) return `${h}h ${pad2(m)}m ${pad2(sec)}s`;
  return `${m}m ${pad2(sec)}s`;
}

function formatTxTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export default function VipPage({ onBack }: Props) {
  const { user, refreshUser, applyBalance } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<VipStatus | null>(null);
  const [requirements, setRequirements] = useState<VipLevelRequirement[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [subTab, setSubTab] = useState<SubTab>("rules");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [claims, setClaims] = useState<VipRewardClaim[]>([]);
  const [expHistory, setExpHistory] = useState<ExpHistoryItem[]>([]);
  const [expPage, setExpPage] = useState(1);
  const [expTotalPages, setExpTotalPages] = useState(1);
  const [expLoading, setExpLoading] = useState(false);

  /** Claimed flags from GET /vip/claim-history */
  const [claimed, setClaimed] = useState<Set<string>>(new Set());
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimsLoading, setClaimsLoading] = useState(false);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const didSetIdx = useRef(false);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const loadClaims = useCallback(async () => {
    setClaimsLoading(true);
    try {
      const res = await api.getVipClaimHistory({
        page: 1,
        limit: 100,
        type: "all",
      });
      const list = Array.isArray(res.data) ? res.data : [];
      setClaims(list);
      setClaimed(claimsToClaimedSet(list));
    } catch {
      /* soft fail — claim UI still works via error path */
    } finally {
      setClaimsLoading(false);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    const [s, r] = await Promise.all([
      api.getVipStatus(),
      api.getVipRequirements(),
    ]);
    setStatus(s.data);
    // API may wrap oddly — normalize to array
    const raw = r.data as unknown;
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { levels?: unknown })?.levels)
        ? ((raw as { levels: VipLevelRequirement[] }).levels)
        : [];
    setRequirements(list);
    if (!didSetIdx.current) {
      const lvl = Number(s.data.currentLevel ?? 0);
      const focusLevel = Math.min(Math.max(lvl === 0 ? 1 : lvl, 1), 10);
      setActiveIdx(focusLevel - 1);
      didSetIdx.current = true;
    }
    return s.data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([loadStatus(), loadClaims()]);
      } catch (e: unknown) {
        if (!cancelled) {
          toast(
            sanitizeErrorMessage(e, "Failed to load VIP status"),
            "error"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadStatus, loadClaims, toast]);

  // EXP history — only when History tab is open; one API page at a time
  useEffect(() => {
    if (subTab !== "history") return;
    let cancelled = false;
    setExpLoading(true);
    void (async () => {
      try {
        const res = await api.getGameHistory({
          page: expPage,
          limit: EXP_PAGE_SIZE,
        });
        if (cancelled) return;
        const items: ExpHistoryItem[] = (res.data ?? []).map((b) => ({
          id: b.id,
          title: "Experience Bonus",
          subtitle: "Betting EXP",
          time: formatTxTime(b.createdAt),
          exp: Math.max(0, Math.floor(Number(b.betAmount ?? 0))),
        }));
        setExpHistory(items.filter((x) => x.exp > 0));
        setExpTotalPages(Math.max(1, Number(res.totalPages ?? 1)));
      } catch {
        if (!cancelled) {
          setExpHistory([]);
          setExpTotalPages(1);
        }
      } finally {
        if (!cancelled) setExpLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subTab, expPage]);

  const levels: VipCardLevel[] = useMemo(() => {
    const byLevel = new Map(
      requirements.map((r) => [Number(r.level), r] as const)
    );
    // Also merge nextRequirements / currentRequirements from status if list empty
    if (status?.currentRequirements) {
      const c = status.currentRequirements;
      if (!byLevel.has(Number(c.level))) byLevel.set(Number(c.level), c);
    }
    if (status?.nextRequirements) {
      const n = status.nextRequirements;
      if (!byLevel.has(Number(n.level))) byLevel.set(Number(n.level), n);
    }

    return VIP_THEMES.map((theme) => {
      const req = byLevel.get(theme.level);
      const def = defaultReqForLevel(theme.level);
      const apiPct = Number(req?.selfRebatePercent);
      const selfPct = Number.isFinite(apiPct)
        ? apiPct
        : def.selfRebatePercent ?? selfRebatePercentForVip(theme.level);
      return {
        ...theme,
        expRequired: pickNum(req?.expRequired, def.expRequired),
        levelUpReward: pickNum(req?.levelUpReward, def.levelUpReward),
        monthlyReward: pickNum(req?.monthlyReward, def.monthlyReward),
        rebateRate: formatSelfRebatePercent(selfPct),
        selfRebatePercent: selfPct,
      };
    });
  }, [requirements, status]);

  const myExp = Number(status?.xp ?? 0);
  const currentLevel = Number(status?.currentLevel ?? user?.vipLevel ?? 0);

  const onScrollSnap = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-vip-card]");
    if (!card) return;
    const w = card.offsetWidth + 12;
    const idx = Math.round(el.scrollLeft / w);
    setActiveIdx(Math.max(0, Math.min(levels.length - 1, idx)));
  }, [levels.length]);

  useEffect(() => {
    if (loading) return;
    const el = scrollerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      const card = el.querySelector<HTMLElement>("[data-vip-card]");
      if (!card) return;
      const w = card.offsetWidth + 12;
      el.scrollTo({ left: activeIdx * w, behavior: "auto" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial position only
  }, [loading]);

  const activeLevel = levels[activeIdx] ?? levels[0]!;
  const displayName = user?.username ?? "Member";
  const monthly = status?.monthlyClaim ?? {
    level: currentLevel,
    canClaim: false,
    nextClaimAt: null,
    lastClaimAt: null,
  };

  const isClaimed = (level: number, type: api.VipRewardClaimType) =>
    claimed.has(claimKey(level, type));

  const handleClaim = async (
    level: number,
    type: api.VipRewardClaimType
  ) => {
    const key = claimKey(level, type);
    if (claiming) return;
    setClaiming(key);
    try {
      const res = await api.claimVipReward({ level, type });
      setClaimed((prev) => new Set(prev).add(key));
      if (typeof res.newBalance === "number") {
        applyBalance(res.newBalance);
      } else {
        void refreshUser();
      }
      toast(res.message || "Reward claimed", "success");
      try {
        await Promise.all([loadStatus(), loadClaims()]);
      } catch {
        /* ignore refresh errors after successful claim */
      }
    } catch (e: unknown) {
      const msg = sanitizeErrorMessage(e, "Claim failed");
      if (/already been claimed/i.test(msg)) {
        setClaimed((prev) => new Set(prev).add(key));
        void loadClaims();
      }
      toast(msg, "error");
    } finally {
      setClaiming(null);
    }
  };

  if (loading) {
    return (
      <div
        className="flex min-h-screen flex-1 flex-col"
        style={{ background: "#110D14" }}
      >
        <PageHeader title="VIP" onBack={onBack} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen w-full min-w-0 flex-1 flex-col pb-28"
      style={{ background: "#110D14" }}
    >
      <PageHeader title="VIP" onBack={onBack} />

      <div className="mx-auto w-full max-w-lg px-3 pt-3">
        {/* Profile */}
        <div className="flex items-center gap-3 px-1">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-[#3D363A]">
            <Image
              src={VIP_ASSET.avatar}
              alt=""
              fill
              sizes="56px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1.5">
              <div className="relative h-5 w-12">
                <Image
                  src={vipBadgeSrc(currentLevel)}
                  alt={`VIP${currentLevel}`}
                  fill
                  sizes="48px"
                  className="object-contain object-left"
                />
              </div>
            </div>
            <p className="truncate text-[17px] font-semibold text-white/90">
              {displayName}
            </p>
          </div>
        </div>

        {/* EXP + payout */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <StatTile value={`${formatExp(myExp)} EXP`} label="My experience" />
          <StatTile
            value={
              monthly.canClaim || !monthly.nextClaimAt
                ? currentLevel < 1
                  ? "—"
                  : "Ready"
                : formatRemain(
                    new Date(monthly.nextClaimAt).getTime() - nowMs
                  )
            }
            label="Payout time"
          />
        </div>

        <div
          className="mt-3 rounded-lg px-3 py-2 text-center text-[13px] leading-snug text-[#B79C8B]"
          style={{ background: "#1A1519", border: "1px solid #2E282C" }}
        >
          {SETTLEMENT_NOTE}
        </div>

        {/* Horizontal VIP cards */}
        <div
          ref={scrollerRef}
          onScroll={onScrollSnap}
          className="mt-4 -mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{
            scrollPaddingInline: 12,
            WebkitOverflowScrolling: "touch",
          }}
          aria-label="VIP levels — swipe left and right"
        >
          {levels.map((lvl) => (
            <VipLevelCard
              key={lvl.level}
              cfg={lvl}
              myExp={myExp}
              currentLevel={currentLevel}
            />
          ))}
          <div className="w-2 shrink-0 snap-none" aria-hidden />
        </div>

        <BenefitsPanel
          cfg={activeLevel}
          currentLevel={currentLevel}
          claimedLevelUp={isClaimed(activeLevel.level, "LEVEL_UP")}
          claimedMonthly={isClaimed(activeLevel.level, "MONTHLY")}
          monthlyReady={
            monthly.canClaim && activeLevel.level === currentLevel
          }
          monthlyWaitLabel={
            monthly.nextClaimAt && activeLevel.level === currentLevel
              ? formatRemain(new Date(monthly.nextClaimAt).getTime() - nowMs)
              : activeLevel.level !== currentLevel
                ? "Current VIP only"
                : null
          }
          claiming={claiming}
          onClaimLevelUp={() =>
            void handleClaim(activeLevel.level, "LEVEL_UP")
          }
          onClaimMonthly={() =>
            void handleClaim(activeLevel.level, "MONTHLY")
          }
        />

        {/* Tabs */}
        <div className="mt-5 flex items-end justify-center gap-10 border-b border-white/5 pb-0">
          {(
            [
              { id: "history" as const, label: "History" },
              { id: "rules" as const, label: "Rules" },
            ] as const
          ).map((t) => {
            const on = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id)}
                className="relative px-2 pb-2.5 text-[17px] font-bold transition-colors"
                style={{ color: on ? "#FED358" : "#6B5E58" }}
              >
                {t.label}
                {on && (
                  <span
                    className="absolute bottom-0 left-1 right-1 h-[2.5px] rounded-full"
                    style={{ background: "#FED358" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {subTab === "rules" ? (
          <RulesPanel />
        ) : (
          <div className="mt-3 pb-6">
            {/* Claimed rewards — icon bar on top */}
            <ClaimedIconBar items={claims} loading={claimsLoading} />

            {/* EXP history list (as before) */}
            <p className="mb-2 mt-4 text-[14px] font-bold text-[#837064]">
              Experience history
            </p>
            <ExpHistoryList
              items={expHistory}
              loading={expLoading}
              page={expPage}
              totalPages={expTotalPages}
              onPage={setExpPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Subcomponents ───────────────────────────────────────────────────────── */

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div
      className="rounded-xl px-3 py-3 text-center"
      style={{ background: "#241E22", border: "1px solid #3D363A" }}
    >
      <p className="text-[18px] font-black tabular-nums text-[#F5D78E]">
        {value}
      </p>
      <p className="mt-0.5 text-[13px] text-[#837064]">{label}</p>
    </div>
  );
}

function VipLevelCard({
  cfg,
  myExp,
  currentLevel,
}: {
  cfg: VipCardLevel;
  myExp: number;
  currentLevel: number;
}) {
  const opened = currentLevel >= cfg.level;
  const need = Math.max(0, cfg.expRequired);
  const remaining = Math.max(0, need - myExp);
  const pct = need > 0 ? Math.min(100, (myExp / need) * 100) : opened ? 100 : 0;

  return (
    <div
      data-vip-card
      className="relative w-[min(88vw,352px)] shrink-0 snap-start overflow-hidden rounded-2xl shadow-lg"
      style={{ background: cfg.cardBg, minHeight: 172 }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <Image
          src={VIP_ASSET.bg(cfg.level)}
          alt=""
          fill
          sizes="340px"
          className="object-cover object-right"
          priority={cfg.level <= 2}
        />
      </div>

      <div className="pointer-events-none absolute -right-1 top-2 h-[100px] w-[100px] sm:h-[110px] sm:w-[110px]">
        <Image
          src={VIP_ASSET.logo(cfg.level)}
          alt=""
          fill
          sizes="110px"
          className="object-contain drop-shadow-md"
        />
      </div>

      <div className="relative z-[1] flex h-full flex-col p-3.5 pr-24 sm:p-4 sm:pr-28">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative h-5 w-5 shrink-0">
            <Image
              src={VIP_ASSET.king(cfg.king)}
              alt=""
              fill
              sizes="20px"
              className="object-contain"
            />
          </div>
          <span
            className="text-[22px] font-black tracking-wide"
            style={{ color: cfg.text }}
          >
            VIP{cfg.level}
          </span>
          {!opened ? (
            <span
              className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[12px] font-bold text-white"
              style={{ background: "#E53935" }}
            >
              <IoLockClosed size={10} />
              Not open yet
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[12px] font-bold text-white"
              style={{ background: "#17B15E" }}
            >
              Opened
            </span>
          )}
        </div>

        <p
          className="mt-1 text-[14px] font-semibold leading-snug"
          style={{ color: cfg.textMuted }}
        >
          {opened ? (
            <>
              VIP{cfg.level} unlocked
              {need > 0 && (
                <>
                  {" "}
                  · need{" "}
                  <span className="font-bold" style={{ color: cfg.text }}>
                    {formatExp(need)}EXP
                  </span>
                </>
              )}
            </>
          ) : (
            <>
              Upgrading VIP{cfg.level} requires{" "}
              <span className="font-bold" style={{ color: cfg.text }}>
                {formatExp(remaining)}EXP
              </span>
            </>
          )}
        </p>

        <div
          className="mt-2.5 inline-flex w-fit items-center rounded-md px-2 py-1 text-[13px] font-bold"
          style={{ background: cfg.chipBg, color: cfg.text }}
        >
          Bet ₹1=1EXP
        </div>

        <div className="mt-auto pt-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span
              className="text-[12px] font-semibold tabular-nums"
              style={{ color: cfg.textMuted }}
            >
              {formatExp(Math.min(myExp, need || myExp))}/
              {formatExp(need || 0)}
            </span>
            <span
              className="text-[12px] font-semibold"
              style={{ color: cfg.textMuted }}
            >
              {formatExp(need)} EXP can be leveled up
            </span>
          </div>
          <div
            className="h-[7px] overflow-hidden rounded-full"
            style={{ background: cfg.progressTrack }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${pct}%`,
                background: cfg.progress,
                minWidth: pct > 0 ? 6 : 0,
              }}
            />
          </div>
          <p
            className="mt-1.5 text-right text-[13px] font-bold tracking-wide opacity-70"
            style={{ color: cfg.text }}
          >
            VIP{cfg.level}
          </p>
        </div>
      </div>
    </div>
  );
}

function BenefitsPanel({
  cfg,
  currentLevel,
  claimedLevelUp,
  claimedMonthly,
  monthlyReady,
  monthlyWaitLabel,
  claiming,
  onClaimLevelUp,
  onClaimMonthly,
}: {
  cfg: VipCardLevel;
  currentLevel: number;
  claimedLevelUp: boolean;
  claimedMonthly: boolean;
  monthlyReady: boolean;
  monthlyWaitLabel: string | null;
  claiming: string | null;
  onClaimLevelUp: () => void;
  onClaimMonthly: () => void;
}) {
  const eligible = currentLevel >= cfg.level;
  const canClaimLevelUp =
    eligible && cfg.levelUpReward > 0 && !claimedLevelUp;
  const canClaimMonthly =
    monthlyReady && cfg.monthlyReward > 0 && !claimedMonthly;

  return (
    <div
      className="mt-4 rounded-2xl px-3.5 py-3.5"
      style={{ background: "#1A1519", border: "1px solid #2E282C" }}
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="relative h-4 w-4 shrink-0">
          <Image
            src={VIP_ASSET.diamond}
            alt=""
            fill
            sizes="16px"
            className="object-contain"
            style={{
              filter: "sepia(1) saturate(4) hue-rotate(5deg) brightness(1.1)",
            }}
          />
        </div>
        <p className="text-[17px] font-bold text-[#E8C36A]">
          VIP{cfg.level} Benefits level
        </p>
      </div>

      <BenefitRow
        icon={VIP_ASSET.gift}
        title="Level up rewards"
        desc="Each account can only receive 1 time"
        primary={formatReward(cfg.levelUpReward)}
        secondary={claimedLevelUp ? formatReward(cfg.levelUpReward) : "0"}
        showSafe
        claimable={canClaimLevelUp}
        claiming={claiming === claimKey(cfg.level, "LEVEL_UP")}
        claimed={claimedLevelUp}
        onClaim={onClaimLevelUp}
        locked={!eligible}
      />
      <div className="my-2.5 h-px bg-white/5" />
      <BenefitRow
        icon={VIP_ASSET.coin}
        title="Monthly reward"
        desc={
          monthlyWaitLabel && !canClaimMonthly
            ? `Available in ${monthlyWaitLabel}`
            : "Current VIP only · once per month after settlement"
        }
        primary={formatReward(cfg.monthlyReward)}
        secondary={claimedMonthly ? formatReward(cfg.monthlyReward) : "0"}
        showSafe
        claimable={canClaimMonthly}
        claiming={claiming === claimKey(cfg.level, "MONTHLY")}
        claimed={claimedMonthly}
        onClaim={onClaimMonthly}
        locked={!eligible}
      />
      <div className="my-2.5 h-px bg-white/5" />
      <BenefitRow
        icon={VIP_ASSET.coins}
        title="Self rebate"
        desc="Cashback on your own bets (claim daily)"
        primary={formatSelfRebatePercent(cfg.selfRebatePercent)}
        secondary={null}
        showSafe={false}
        isRate
      />

      {!eligible && (
        <p className="mt-3 text-center text-[13px] text-[#837064]">
          Reach VIP{cfg.level} to claim these rewards
        </p>
      )}
    </div>
  );
}

function BenefitRow({
  icon,
  title,
  desc,
  primary,
  secondary,
  showSafe,
  isRate,
  claimable,
  claiming,
  claimed,
  locked,
  onClaim,
}: {
  icon: string;
  title: string;
  desc: string;
  primary: string;
  secondary: string | null;
  showSafe: boolean;
  isRate?: boolean;
  claimable?: boolean;
  claiming?: boolean;
  claimed?: boolean;
  locked?: boolean;
  onClaim?: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative h-10 w-10 shrink-0">
        <Image src={icon} alt="" fill sizes="40px" className="object-contain" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold text-[#F5D78E]">{title}</p>
        <p className="text-[13px] leading-snug text-[#837064]">{desc}</p>
        {claimable && onClaim && (
          <button
            type="button"
            disabled={claiming}
            onClick={onClaim}
            className="mt-1.5 rounded-full px-3 py-1 text-[13px] font-black text-[#1a1208] active:opacity-90 disabled:opacity-50"
            style={{
              background: "linear-gradient(180deg, #FED358 0%, #E8A84A 100%)",
            }}
          >
            {claiming ? "Claiming…" : "Claim"}
          </button>
        )}
        {claimed && !isRate && (
          <p className="mt-1 text-[12px] font-semibold text-[#17B15E]">
            Claimed
          </p>
        )}
        {locked && !isRate && !claimed && (
          <p className="mt-1 text-[12px] font-semibold text-[#837064]">
            Locked
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className="inline-flex min-w-[64px] items-center justify-center gap-1 rounded-md px-2 py-1 text-[14px] font-bold tabular-nums"
          style={{
            border: "1px solid rgba(232,168,74,0.55)",
            color: "#E8C36A",
            background: "rgba(232,168,74,0.08)",
          }}
        >
          {isRate ? <CoinsMini /> : <BagMini />}
          {primary}
        </span>
        {showSafe && secondary != null && (
          <span
            className="inline-flex min-w-[64px] items-center justify-center gap-1 rounded-md px-2 py-1 text-[14px] font-bold tabular-nums"
            style={{
              border: "1px solid rgba(232,168,74,0.55)",
              color: "#E8C36A",
              background: "rgba(232,168,74,0.08)",
            }}
          >
            <SafeMini />
            {secondary}
          </span>
        )}
      </div>
    </div>
  );
}

function BagMini() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9h12l-1.2 11.2a1 1 0 0 1-1 .8H8.2a1 1 0 0 1-1-.8L6 9Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9 9V7a3 3 0 0 1 6 0v2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SafeMini() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 9.5V8M12 16v-1.5M9.5 12H8M16 12h-1.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CoinsMini() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <ellipse
        cx="12"
        cy="8"
        rx="7"
        ry="3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5 8v4c0 1.7 3.1 3 7 3s7-1.3 7-3V8"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5 12v4c0 1.7 3.1 3 7 3s7-1.3 7-3v-4"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function RulesPanel() {
  return (
    <div className="mt-4 pb-6">
      <p className="text-center text-[18px] font-bold text-[#E8C36A]">
        VIP privileges
      </p>
      <p className="mt-0.5 text-center text-[14px] text-[#837064]">
        VIP rule description
      </p>
      <div className="mt-4 space-y-3">
        {VIP_RULES.map((r) => (
          <div
            key={r.title}
            className="overflow-hidden rounded-2xl"
            style={{ background: "#1A1519", border: "1px solid #2E282C" }}
          >
            <div
              className="mx-auto w-[72%] rounded-b-xl px-3 py-1.5 text-center text-[15px] font-bold text-[#1a1208]"
              style={{
                background: "linear-gradient(180deg, #FED358 0%, #E8A84A 100%)",
              }}
            >
              {r.title}
            </div>
            <p className="px-3.5 py-3 text-[14px] leading-relaxed text-[#B79C8B]">
              {r.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Horizontal claimed-rewards icon strip (History tab top) */
function ClaimedIconBar({
  items,
  loading,
}: {
  items: VipRewardClaim[];
  loading: boolean;
}) {
  return (
    <div
      className="rounded-xl px-2.5 py-2.5"
      style={{ background: "#1A1519", border: "1px solid #2E282C" }}
    >
      <div className="mb-2 flex items-center justify-between px-0.5">
        <p className="text-[14px] font-bold text-[#E8C36A]">Claimed rewards</p>
        <p className="text-[12px] text-[#837064]">
          {loading ? "…" : `${items.length} claim${items.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="px-0.5 py-2 text-[13px] text-[#6B5E58]">
          No claims yet — claim level-up / monthly rewards above
        </p>
      ) : (
        <div
          className="flex gap-2.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {items.map((c) => {
            const isMonthly = c.type === "MONTHLY";
            const title = isMonthly
              ? labelForTxType("VIP_MONTHLY_REWARD" as TxFilterId)
              : labelForTxType("VIP_LEVEL_UP_REWARD" as TxFilterId);
            return (
              <div
                key={c.id}
                className="flex w-[88px] shrink-0 flex-col items-center rounded-xl px-1.5 py-2"
                style={{
                  background: "#241E22",
                  border: "1px solid #3D363A",
                }}
                title={`${title} · VIP${c.level}`}
              >
                <div className="relative mb-1 h-9 w-9">
                  <Image
                    src={isMonthly ? VIP_ASSET.coin : VIP_ASSET.gift}
                    alt=""
                    fill
                    sizes="36px"
                    className="object-contain"
                  />
                </div>
                <p className="text-[12px] font-bold text-[#F5D78E]">
                  VIP{c.level}
                </p>
                <p className="text-[11px] text-[#837064]">
                  {isMonthly ? "Monthly" : "Level up"}
                </p>
                <p className="mt-0.5 text-[13px] font-black tabular-nums text-[#17B15E]">
                  +{formatINR(c.amount)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Betting EXP list — paginated from GET /user/game-history */
function ExpHistoryList({
  items,
  loading,
  page,
  totalPages,
  onPage,
}: {
  items: ExpHistoryItem[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (loading && items.length === 0) {
    return (
      <p className="py-8 text-center text-[14px] text-[#837064]">Loading…</p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-[15px] text-[#837064]">No experience records yet</p>
        <p className="mt-1 text-[13px] text-white/25">
          Place bets to earn EXP (₹1 = 1 EXP)
        </p>
      </div>
    );
  }

  return (
    <div>
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between gap-3 border-b border-white/5 py-3"
        >
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[#4A8CFF]">
              {item.title}
            </p>
            <p className="text-[14px] text-[#B79C8B]">{item.subtitle}</p>
            <p className="text-[13px] text-[#6B5E58]">{item.time}</p>
          </div>
          <p className="shrink-0 text-[15px] font-bold tabular-nums text-[#17B15E]">
            {item.exp} EXP
          </p>
        </div>
      ))}
      <Pagination page={page} totalPages={totalPages} onChange={onPage} />
    </div>
  );
}
