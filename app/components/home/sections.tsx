"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import type { GameDef, HomeSectionDef } from "../../lib/home-catalog";
import {
  EARNINGS_TOP,
  JACKPOT_ITEMS,
  WINNING_INFO,
  buildEarningsShowcase,
  resolveGames,
} from "../../lib/home-catalog";
import { useInoutCatalog } from "../../hooks/useInoutCatalog";
import SectionShell from "./SectionShell";
import GameTile from "./GameTile";
import GameAutoScrollRail from "./GameAutoScrollRail";

/* ── Winning information — auto-scroll right → left (seamless loop) ── */
export function WinningInfoSection({ section }: { section: HomeSectionDef }) {
  // Duplicate track for seamless marquee
  const track = [...WINNING_INFO, ...WINNING_INFO];

  return (
    <SectionShell title={section.title} icon={section.icon} id={section.id}>
      <div className="home-card home-winning-shell overflow-hidden">
        <div className="home-winning-marquee" aria-label="Recent winners">
          <div className="home-winning-track">
            {track.map((w, i) => (
              <div key={`${w.id}-${i}`} className="home-winner-card shrink-0">
                <div
                  className="relative h-[72px] w-full overflow-hidden rounded-t-[8px]"
                  style={{
                    background:
                      "linear-gradient(165deg,#3a2e12 0%,#1a1408 100%)",
                  }}
                >
                  <Image
                    src={w.image}
                    alt=""
                    fill
                    sizes="112px"
                    className="object-contain p-1.5"
                  />
                </div>
                <div className="flex items-center gap-1.5 px-1.5 py-1.5">
                  <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full ring-1 ring-[#FED358]/40">
                    <Image src={w.avatar} alt="" fill sizes="20px" className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[9px] leading-tight text-white/55">{w.name}</p>
                    <p className="text-[11px] font-extrabold leading-tight tabular-nums text-[#FED358]">
                      {w.amount}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

/* ── Game section: vertical posters + slow auto-scroll + View all ── */
export function GameGridSection({
  section,
  onOpen,
  launchingId,
}: {
  section: HomeSectionDef;
  onOpen: (g: GameDef) => void;
  launchingId: string | null;
}) {
  const {
    resolveSectionGames,
    loading: catalogLoading,
    error: catalogError,
    refresh,
  } = useInoutCatalog();
  const games = useMemo(
    () => resolveSectionGames(section),
    [resolveSectionGames, section]
  );
  const [viewAll, setViewAll] = useState(false);
  const [page, setPage] = useState(0);
  const cols = section.columns ?? 3;
  const rows = 3;
  const pageSize = cols * rows;
  const totalPages = Math.max(1, Math.ceil(games.length / pageSize));

  // Keep page in range when catalog loads
  React.useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  if (!games.length) {
    if (catalogLoading) {
      return (
        <SectionShell
          id={section.id}
          title={section.title}
          icon={section.icon}
        >
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] animate-pulse rounded-xl bg-[#241E22]"
              />
            ))}
          </div>
        </SectionShell>
      );
    }
    if (catalogError && section.gameCategory !== "lottery") {
      return (
        <SectionShell
          id={section.id}
          title={section.title}
          icon={section.icon}
        >
          <div className="rounded-xl border border-white/10 bg-[#1A1519] px-3 py-4 text-center">
            <p className="text-[12px] text-[#837064]">
              Games couldn&apos;t load
            </p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-2 rounded-full px-4 py-1.5 text-[12px] font-bold text-[#110D14]"
              style={{
                background: "linear-gradient(180deg,#FED358 0%,#E8A84A 100%)",
              }}
            >
              Retry
            </button>
          </div>
        </SectionShell>
      );
    }
    return null;
  }

  return (
    <SectionShell
      id={section.id}
      title={section.title}
      icon={section.icon}
      showDetail={section.showDetail !== false && games.length > 3}
      detailLabel={viewAll ? "Collapse" : "View all"}
      onDetail={() => setViewAll((v) => !v)}
      showPager={!viewAll && totalPages > 1}
      onPrev={() =>
        setPage((p) => (p - 1 + totalPages) % totalPages)
      }
      onNext={() => setPage((p) => (p + 1) % totalPages)}
      meta={`${games.length}`}
    >
      {viewAll ? (
        <div
          className={`grid gap-2 ${cols === 2 ? "grid-cols-2" : "grid-cols-3"}`}
        >
          {games.map((g) => (
            <GameTile
              key={g.id}
              game={g}
              onOpen={onOpen}
              loading={launchingId === g.id}
              variant="poster"
            />
          ))}
        </div>
      ) : (
        <GameAutoScrollRail
          games={games}
          onOpen={onOpen}
          launchingId={launchingId}
          cols={cols}
          rows={rows}
          page={page}
          onPageChange={setPage}
        />
      )}
    </SectionShell>
  );
}

/* ── Lottery 2-col wide tiles ── */
export function LotteryGridSection({
  section,
  onOpen,
  launchingId,
}: {
  section: HomeSectionDef;
  onOpen: (g: GameDef) => void;
  launchingId: string | null;
}) {
  const games = useMemo(() => resolveGames(section), [section]);
  const [viewAll, setViewAll] = useState(false);
  if (!games.length) return null;

  const visible = viewAll ? games : games.slice(0, 4);

  return (
    <SectionShell
      id={section.id}
      title={section.title}
      icon={section.icon}
      showDetail={section.showDetail && games.length > 4}
      detailLabel={viewAll ? "Collapse" : "View all"}
      onDetail={() => setViewAll((v) => !v)}
      meta={`${games.length}`}
    >
      <div className="grid grid-cols-2 gap-2">
        {visible.map((g) => (
          <GameTile
            key={g.id}
            game={g}
            onOpen={onOpen}
            loading={launchingId === g.id}
            variant="lottery"
          />
        ))}
      </div>
    </SectionShell>
  );
}

/* ── Wheel of fortune + VIP ── */
export function PromoRowSection({ onSpin, onVip }: { onSpin?: () => void; onVip?: () => void }) {
  return (
    <section className="grid grid-cols-2 gap-2.5">
      <button type="button" onClick={onSpin} className="home-promo-card group">
        <div className="flex-1 text-left">
          <p className="text-[13px] font-extrabold text-[#FDE4BC] leading-tight">Daily</p>
          <p className="text-[13px] font-extrabold text-[#FDE4BC] leading-tight">Spin</p>
        </div>
        <div className="relative w-12 h-12 shrink-0">
          <Image
            src="/assets/png/invite_wheel-bb332472.webp"
            alt=""
            fill
            sizes="48px"
            className="object-contain group-active:rotate-12 transition-transform"

          />
        </div>
      </button>
      <button type="button" onClick={onVip} className="home-promo-card group">
        <div className="flex-1 text-left">
          <p className="text-[13px] font-extrabold text-[#FDE4BC] leading-tight">VIP</p>
          <p className="text-[13px] font-extrabold text-[#FDE4BC] leading-tight">privileges</p>
        </div>
        <div className="relative w-11 h-11 shrink-0">
          <Image
            src="/assets/png/crown1-6889b8e0.png"
            alt=""
            fill
            sizes="44px"
            className="object-contain drop-shadow-[0_0_10px_rgba(254,211,88,0.5)]"

          />
        </div>
      </button>
    </section>
  );
}

/* ── Super Jackpot ── */
export function SuperJackpotSection({ section }: { section: HomeSectionDef }) {
  return (
    <SectionShell title={section.title} icon={section.icon} id={section.id}>
      <p className="text-[11px] text-[#837064] leading-relaxed mb-2.5 px-0.5">
        When you win a super jackpot, you will receive additional rewards. Maximum bonus{" "}
        <span className="text-[#FED358] font-bold">₹500.00</span>
      </p>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {JACKPOT_ITEMS.map((item) => (
          <div key={item.id} className="home-jackpot-card">
            <span className="home-jackpot-mult">{item.mult}</span>
            <div className="relative w-full aspect-square rounded-[8px] overflow-hidden mb-1.5">
              <Image src={item.image} alt={item.name} fill sizes="100px" className="object-cover" />
            </div>
            <p className="text-[10px] font-bold text-white/80 truncate text-center">{item.name}</p>
            <p className="text-[11px] font-extrabold text-[#FED358] text-center tabular-nums">
              {item.amount}
            </p>
          </div>
        ))}
      </div>
      <button type="button" className="home-cta-btn w-full">
        Look Super Jackpot
      </button>
    </SectionShell>
  );
}

/* ── Today's earnings chart + promo winners ticker (showcase only) ── */
export function EarningsSection({ section }: { section: HomeSectionDef }) {
  const ordered = [2, 1, 3]
    .map((rank) => EARNINGS_TOP.find((p) => p.rank === rank))
    .filter((p): p is (typeof EARNINGS_TOP)[number] => Boolean(p));

  // 48 fake winners · doubled for seamless bottom→top loop
  const showcase = useMemo(() => buildEarningsShowcase(48), []);
  const track = useMemo(() => [...showcase, ...showcase], [showcase]);

  return (
    <SectionShell title={section.title} icon={section.icon} id={section.id}>
      {/* Podium */}
      <div className="grid grid-cols-3 gap-2 items-end mb-4 px-1 pt-2">
        {ordered.map((p) => {
          const isFirst = p.rank === 1;
          return (
            <div key={p.rank} className={`flex flex-col items-center ${isFirst ? "-mt-2" : ""}`}>
              <div
                className={`relative rounded-full overflow-hidden mb-1.5 ${
                  isFirst ? "w-14 h-14" : "w-12 h-12"
                }`}
                style={{
                  boxShadow: isFirst
                    ? "0 0 0 2px #FED358, 0 0 16px rgba(254,211,88,0.45)"
                    : p.rank === 2
                      ? "0 0 0 2px #C0C0C0"
                      : "0 0 0 2px #CD7F32",
                }}
              >
                <Image src={p.avatar} alt="" fill sizes="56px" className="object-cover" />
              </div>
              {isFirst && (
                <Image
                  src="/assets/png/crown1-6889b8e0.png"
                  alt=""
                  width={22}
                  height={22}
                  className="mb-0.5 -mt-1"
                />
              )}
              <p className="text-[10px] text-white/70 truncate max-w-full font-medium">{p.name}</p>
              <p className="text-[10px] font-extrabold text-[#FED358] tabular-nums mb-1.5 truncate max-w-full">
                {p.amount}
              </p>
              <div
                className="w-full rounded-t-[10px] flex items-center justify-center font-black"
                style={{
                  height: isFirst ? 56 : p.rank === 2 ? 44 : 36,
                  background: isFirst
                    ? "linear-gradient(180deg,#FED358 0%,#CF7C10 100%)"
                    : p.rank === 2
                      ? "linear-gradient(180deg,#E8E8E8 0%,#9A9A9A 100%)"
                      : "linear-gradient(180deg,#E8A060 0%,#A85A20 100%)",
                  color: isFirst ? "#110D14" : "#110D14",
                  fontSize: isFirst ? 28 : 22,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
                }}
              >
                {p.rank}
              </div>
            </div>
          );
        })}
      </div>

      {/* Auto vertical ticker — bottom → top, seamless loop (promo) */}
      <div className="home-card home-earnings-feed overflow-hidden">
        <div
          className="home-earnings-viewport"
          aria-label="Recent big winners showcase"
          style={{
            // Inline so production CSS cache / purge cannot leave this at ~5 rows
            height: 360,
            minHeight: 360,
            maxHeight: "none",
            overflow: "hidden",
          }}
        >
          <div className="home-earnings-track">
            {track.map((row, i) => (
              <div
                key={`${row.id}-${i}`}
                className="home-earnings-row flex items-center gap-2.5 px-3"
                style={{ height: 45, minHeight: 45, flexShrink: 0 }}
              >
                <span className="w-5 text-[12px] font-bold text-[#837064] tabular-nums">
                  {(i % showcase.length) + 4}
                </span>
                <div className="relative w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/10 shrink-0">
                  <Image src={row.avatar} alt="" fill sizes="32px" className="object-cover" />
                </div>
                <span className="flex-1 text-[12px] text-[#B79C8B] font-medium truncate">
                  {row.name}
                </span>
                <span className="text-[12px] font-extrabold text-[#FED358] tabular-nums shrink-0">
                  {row.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

/* ── Footer legal ── */
export function FooterLegalSection() {
  return (
    <section className="px-1 pb-2">
      <div className="flex items-center justify-center gap-6 mb-3">
        <div className="flex flex-col items-center gap-1">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full text-[13px] font-black text-[#110D14] shadow-[0_0_12px_rgba(254,211,88,0.45)]"
            style={{
              background: "linear-gradient(160deg,#FED358 0%,#E8A84A 55%,#CF7C10 100%)",
            }}
          >
            +18
          </span>
        </div>
        <a
          href="https://t.me/"
          target="_blank"
          rel="noopener noreferrer"
          className="w-11 h-11 rounded-full flex items-center justify-center bg-[#2AABEE] shadow-[0_0_12px_rgba(42,171,238,0.4)]"
          aria-label="Telegram"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M9.78 15.28l-.37 4.43c.53 0 .76-.23 1.04-.5l2.5-2.38 5.18 3.8c.95.52 1.62.25 1.87-.88l3.39-15.94h.01c.3-1.4-.5-1.95-1.42-1.6L2.3 9.7c-1.36.53-1.34 1.28-.23 1.62l4.87 1.52 11.32-7.13c.53-.32 1.02-.14.62.2" />
          </svg>
        </a>
      </div>
      <ul className="space-y-1.5 text-[10px] text-[#6B5C52] leading-relaxed px-1">
        <li className="flex gap-1.5">
          <span className="text-[#FED358] shrink-0">✦</span>
          <span>
            The platform advocates fairness, justice, and openness. We mainly operate fair lottery,
            blockchain games, live casino, and slot machine games.
          </span>
        </li>
        <li className="flex gap-1.5">
          <span className="text-[#FED358] shrink-0">✦</span>
          <span>
            BCWin works with more than 10,000 online live game dealers and slot games, all of which
            are verified fair games.
          </span>
        </li>
        <li className="flex gap-1.5">
          <span className="text-[#FED358] shrink-0">✦</span>
          <span>
            BCWin supports fast deposit and withdrawal. Gambling can be addictive — please play
            rationally. 18+ only.
          </span>
        </li>
      </ul>
    </section>
  );
}

/* ── Section dispatcher ── */
export function HomeSectionRenderer({
  section,
  onOpen,
  launchingId,
  onNavigate,
}: {
  section: HomeSectionDef;
  onOpen: (g: GameDef) => void;
  launchingId: string | null;
  onNavigate?: (tab: string) => void;
}) {
  switch (section.kind) {
    case "winning-info":
      return <WinningInfoSection section={section} />;
    case "game-grid":
      return (
        <GameGridSection section={section} onOpen={onOpen} launchingId={launchingId} />
      );
    case "lottery-grid":
      return (
        <LotteryGridSection section={section} onOpen={onOpen} launchingId={launchingId} />
      );
    case "promo-row":
      return (
        <PromoRowSection
          onSpin={() => onNavigate?.("spin")}
          onVip={() => onNavigate?.("vip")}
        />
      );
    case "super-jackpot":
      return <SuperJackpotSection section={section} />;
    case "earnings":
      return <EarningsSection section={section} />;
    case "footer-legal":
      return <FooterLegalSection />;
    default:
      return null;
  }
}
