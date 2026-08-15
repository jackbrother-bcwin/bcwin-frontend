"use client";

import React, { useState } from "react";
import Image from "next/image";
import { CATEGORIES, CategoryId } from "./GameCategoryTabs";
import * as api from "../lib/api";
import { isSafeHttpUrl } from "../lib/safe";
import { useToast } from "./ui/Toast";
import ThirdPartyGameShell, {
  type ThirdPartyGameSession,
} from "./home/ThirdPartyGameShell";

interface GameItem {
  id: string;
  image: string;
  name: string;
  category: CategoryId;
  /** Internal SPA screen: wingo | trxwingo | k3 | 5d | moto */
  game?: string;
  /** Inout catalog search (title / gameMode) then POST /inout/launch */
  inoutSearch?: string;
}

/** First-party lottery + Inout-search tiles. */
const GAMES: GameItem[] = [
  { id: "wingo",     image: "/assets/png/games/wingo.png",      name: "Win Go",     category: "lottery", game: "wingo" },
  { id: "k3",        image: "/assets/png/games/k3.png",         name: "K3",         category: "lottery", game: "k3" },
  { id: "5d",        image: "/assets/png/games/5d.png",         name: "5D Lottery", category: "lottery", game: "5d" },
  { id: "trxwingo",  image: "/assets/png/games/trxwingo.png",   name: "TRX WinGo",  category: "lottery", game: "trxwingo" },
  { id: "moto",      image: "/assets/png/games/motoracing.png", name: "Moto Racing",category: "lottery", game: "moto" },
  // Inout third-party (search catalog)
  { id: "aviator",   image: "/assets/img/aviator.png",          name: "Aviator",    category: "slots",   inoutSearch: "Aviator" },
  { id: "mini-av",   image: "/assets/img/aviator.png",          name: "Aviator",    category: "mini",    inoutSearch: "Aviator" },
];

const RECOMMENDED: GameItem[] = [
  { id: "r-wingo",   image: "/assets/png/games/wingo-vertical.png", name: "Win Go",    category: "popular", game: "wingo" },
  { id: "r-trx",     image: "/assets/png/games/trxwingo.png",       name: "TRX WinGo", category: "popular", game: "trxwingo" },
  { id: "r-k3",      image: "/assets/png/games/k3.png",             name: "K3",        category: "popular", game: "k3" },
  { id: "r-5d",      image: "/assets/png/games/5d.png",             name: "5D",        category: "popular", game: "5d" },
  { id: "r-moto",    image: "/assets/png/games/motoracing.png",     name: "Moto",      category: "popular", game: "moto" },
  { id: "r-aviator", image: "/assets/img/aviator.png",              name: "Aviator",   category: "popular", inoutSearch: "Aviator" },
];

const WINNERS = [
  { name: "Mem***OIN", amount: "₹3,900.00", game: "Win Go", avatar: "/assets/png/avatar.png"  },
  { name: "Mem***OOY", amount: "₹2,049.80", game: "Win Go", avatar: "/assets/png/avatar2.png" },
  { name: "Mem***ELX", amount: "₹392.00",   game: "Win Go", avatar: "/assets/png/avatar.png"  },
  { name: "Mem***RDO", amount: "₹784.00",   game: "Win Go", avatar: "/assets/png/avatar2.png" },
];

const IMAGE_GAME_MAP: Record<string, string> = {
  "/assets/png/games/wingo.png": "wingo",
  "/assets/png/games/wingo-vertical.png": "wingo",
  "/assets/png/game_wingo.png": "wingo",
  "/assets/png/lotterycategory_20260326112956t35m.png": "wingo",
  "/assets/png/Lottery_WinGo-d07ef527.png": "wingo",
  "/assets/png/games/trxwingo.png": "trxwingo",
  "/assets/png/lotterycategory_20260326113034g5yq.png": "trxwingo",
  "/assets/png/game_trxwingo.png": "trxwingo",
  "/assets/png/games/k3.png": "k3",
  "/assets/png/lotterycategory_202603261130075lqh.png": "k3",
  "/assets/png/game_k3.png": "k3",
  "/assets/png/games/5d.png": "5d",
  "/assets/png/lotterycategory_20260326113016kjsa.png": "5d",
  "/assets/png/game_5d.png": "5d",
  "/assets/png/games/motoracing.png": "moto",
  "/assets/png/lotterycategory_2026032611304965yf.png": "moto",
};

async function launchInoutBySearch(search: string): Promise<string | null> {
  try {
    const res = await api.getInoutGames({ search, limit: 20 });
    const list = res.data ?? [];
    if (!list.length) return null;
    const q = search.toLowerCase();
    const exact = list.find(
      (g) =>
        g.title.toLowerCase() === q ||
        g.gameMode.toLowerCase() === q ||
        g.title.toLowerCase().includes(q) ||
        g.gameMode.toLowerCase().includes(q)
    );
    const game = exact ?? list[0];
    if (!game?.gameMode) return null;
    const launch = await api.launchInout(game.gameMode);
    return launch.gameUrl ?? null;
  } catch {
    return null;
  }
}

/* ── Section Header — matches ts777.info style ── */
function SectionHeader({
  title,
  icon,
  action,
  onAction,
}: {
  title: string;
  icon?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-[12px] py-[10px]">
      <div className="flex items-center gap-[7px]">
        {icon ? (
          <span className="text-[16px]">{icon}</span>
        ) : (
          <span
            className="w-[3px] h-[14px] rounded-full"
            style={{ background: "linear-gradient(180deg, #FED358 0%, #FFB472 100%)" }}
          />
        )}
        <span className="text-[14px] font-bold text-white">{title}</span>
      </div>
      {action && (
        <div className="flex items-center gap-[8px]">
          <button
            onClick={onAction}
            className="text-[11px] text-white/60 px-[10px] py-[3px] rounded-full"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            {action}
          </button>
          <button
            className="w-[22px] h-[22px] rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M4 2l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

/* ── 3-column game grid ── */
function GameCardGrid({
  items,
  onOpenItem,
  launchingId,
}: {
  items: GameItem[];
  onOpenItem?: (item: GameItem) => void;
  launchingId?: string | null;
}) {
  return (
    <div className="grid grid-cols-3 gap-[8px] px-[12px] pb-[12px]">
      {items.slice(0, 6).map((item) => (
        <button
          key={item.id}
          className="relative overflow-hidden rounded-[8px] active:scale-[0.97] transition-transform"
          style={{ aspectRatio: "3/4", background: "#110D14" }}
          onClick={() => onOpenItem?.(item)}
          disabled={launchingId === item.id}
        >
          <Image
            src={item.image}
            alt={item.name}
            fill
            sizes="109px"
            className="object-cover"
          />
          {/* Game name overlay */}
          <div
            className="absolute bottom-0 left-0 right-0 px-[6px] py-[4px] text-[10px] font-semibold text-white text-center truncate"
            style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.75) 0%, transparent 100%)" }}
          >
            {item.name}
          </div>
        </button>
      ))}
    </div>
  );
}

/* ── Recommended — large 3-col cards matching ts777 ── */
function RecommendedGrid({
  items,
  onOpenItem,
  launchingId,
}: {
  items: GameItem[];
  onOpenItem?: (item: GameItem) => void;
  launchingId?: string | null;
}) {
  const featured = items[0];
  const side = items.slice(1, 3);
  const rest = items.slice(3, 6);

  return (
    <div className="px-[12px] pb-[12px]">
      {/* Top row: big left + 2 right */}
      <div className="flex gap-[8px] mb-[8px]">
        {featured && (
          <button
            className="relative overflow-hidden rounded-[10px] active:scale-[0.97] transition-transform"
            style={{ flex: "1", aspectRatio: "1.1/1", background: "#110D14" }}
            onClick={() => onOpenItem?.(featured)}
            disabled={launchingId === featured.id}
          >
            <Image src={featured.image} alt={featured.name} fill sizes="160px" className="object-cover" />
            <div
              className="absolute bottom-0 left-0 right-0 px-2 py-1.5 text-[11px] font-bold text-white text-center"
              style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%)" }}
            >
              {featured.name.toUpperCase()}
            </div>
          </button>
        )}
        <div className="flex flex-col gap-[8px]" style={{ flex: "1" }}>
          {side.map((item) => (
            <button
              key={item.id}
              className="relative overflow-hidden rounded-[10px] active:scale-[0.97] transition-transform"
              style={{ flex: 1, aspectRatio: "2/1", background: "#110D14" }}
              onClick={() => onOpenItem?.(item)}
              disabled={launchingId === item.id}
            >
              <Image src={item.image} alt={item.name} fill sizes="120px" className="object-cover" />
              <div
                className="absolute bottom-0 left-0 right-0 px-2 py-1 text-[10px] font-bold text-white text-center"
                style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%)" }}
              >
                {item.name.toUpperCase()}
              </div>
            </button>
          ))}
        </div>
      </div>
      {/* Bottom row: 3 equal */}
      <div className="grid grid-cols-3 gap-[8px]">
        {rest.map((item) => (
          <button
            key={item.id}
            className="relative overflow-hidden rounded-[8px] active:scale-[0.97] transition-transform"
            style={{ aspectRatio: "1/1", background: "#110D14" }}
            onClick={() => onOpenItem?.(item)}
            disabled={launchingId === item.id}
          >
            <Image src={item.image} alt={item.name} fill sizes="100px" className="object-cover" />
            <div
              className="absolute bottom-0 left-0 right-0 px-1 py-1 text-[9px] font-semibold text-white text-center"
              style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.75) 0%, transparent 100%)" }}
            >
              {item.name.toUpperCase()}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Winning Info Ticker (ts777 horizontal scroll style) ── */
function WinningInfo() {
  return (
    <div className="px-[12px] pb-[12px]">
      <div className="flex gap-[8px] overflow-x-auto no-scrollbar">
        {WINNERS.map((winner, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-[110px] rounded-[8px] overflow-hidden"
            style={{ background: "#241E22", border: "1px solid rgba(254,211,88,0.15)" }}
          >
            {/* Game image */}
            <div className="relative w-full h-[72px]">
              <Image
                src="/assets/png/Lottery_WinGo-d07ef527.png"
                alt={winner.game}
                fill
                sizes="110px"
                className="object-cover"
              />
              <div
                className="absolute top-[4px] left-[4px] text-[9px] font-bold text-white px-[5px] py-[2px] rounded-[4px]"
                style={{ background: "rgba(0,0,0,0.65)" }}
              >
                {winner.game}
              </div>
            </div>
            {/* Winner info */}
            <div className="px-[7px] py-[6px]">
              <p className="text-[10px] text-white/60 truncate">{winner.name}</p>
              <p className="text-[11px] font-bold text-[#FED358] mt-[1px]">{winner.amount}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Earnings leaderboard (ts777 podium) ── */
function EarningsChart() {
  const podium = [
    { rank: 2, amount: "₹0.00",      avatar: "/assets/png/avatar.png",  height: 70 },
    { rank: 1, amount: "₹98,000.00", avatar: "/assets/png/avatar2.png", height: 100 },
    { rank: 3, amount: "₹0.00",      avatar: "/assets/png/avatar.png",  height: 56 },
  ];

  return (
    <div className="px-[14px] pb-[16px] pt-[6px]">
      <div className="grid grid-cols-3 items-end gap-[8px] h-[170px]">
        {podium.map((player) => (
          <div key={player.rank} className="flex flex-col items-center">
            <div
              className="relative w-[44px] h-[44px] rounded-full overflow-hidden border-2"
              style={{ borderColor: player.rank === 1 ? "#FED358" : player.rank === 2 ? "#B79C8B" : "#DD9138" }}
            >
              <Image src={player.avatar} alt="" fill sizes="44px" className="object-cover" />
            </div>
            <div
              className="mt-[4px] rounded-full px-[6px] py-[2px] text-[9px] font-bold"
              style={{ background: "rgba(0,0,0,0.4)", color: "#FED358" }}
            >
              {player.amount}
            </div>
            <div
              className="mt-[6px] w-full rounded-t-[8px] flex items-center justify-center text-[22px] font-black"
              style={{
                height: player.height,
                background:
                  player.rank === 1
                    ? "linear-gradient(180deg, #FED358 0%, #FFB472 100%)"
                    : player.rank === 2
                    ? "linear-gradient(180deg, #B79C8B 0%, #837064 100%)"
                    : "linear-gradient(180deg, #EB9549 0%, #CF7C10 100%)",
                color: player.rank === 1 ? "#110D14" : "#fff",
              }}
            >
              0{player.rank}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Section wrapper card ── */
function Section({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="mx-3 mt-[12px] rounded-[10px] overflow-hidden"
      style={{
        background: "#241E22",
        border: "1px solid rgba(254,211,88,0.12)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
      }}
    >
      {children}
    </section>
  );
}

export default function GameGrid({
  category,
  onOpenGame,
}: {
  category: CategoryId;
  onOpenGame?: (tab: string) => void;
}) {
  const { toast } = useToast();
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [gameSession, setGameSession] = useState<ThirdPartyGameSession | null>(
    null
  );
  const activeCategory = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0]!;

  const filteredGames: GameItem[] =
    category === "lobby" || category === "popular"
      ? RECOMMENDED
      : GAMES.filter((g) => g.category === category);

  const displayGames = filteredGames.length >= 6 ? filteredGames : [...filteredGames, ...RECOMMENDED].slice(0, 6);

  const handleOpenItem = async (item: GameItem) => {
    const game = item.game ?? IMAGE_GAME_MAP[item.image];
    if (game) {
      onOpenGame?.(game);
      return;
    }
    if (item.inoutSearch) {
      setLaunchingId(item.id);
      toast(`Launching ${item.name}…`, "info");
      const url = await launchInoutBySearch(item.inoutSearch);
      setLaunchingId(null);
      if (url && isSafeHttpUrl(url)) {
        setGameSession({ url, title: item.name });
      } else {
        toast(`${item.name} is unavailable right now`, "error");
      }
      return;
    }
    toast("Coming soon", "info");
  };

  return (
    <div className="flex flex-col pb-4">

      {/* ── Winning Information ── */}
      <Section>
        <SectionHeader title="Winning information" />
        <WinningInfo />
      </Section>

      {/* ── Category games ── */}
      <Section>
        <SectionHeader
          title={activeCategory.name}
          icon="🎮"
          action="Detail"
        />
        <GameCardGrid
          items={displayGames.map((g, i) => ({ ...g, id: g.id ?? String(i) }))}
          onOpenItem={handleOpenItem}
          launchingId={launchingId}
        />
      </Section>

      {/* ── Recommended ── */}
      <Section>
        <SectionHeader title="Recommended Games" icon="👑" action="Detail" />
        <RecommendedGrid
          items={RECOMMENDED}
          onOpenItem={handleOpenItem}
          launchingId={launchingId}
        />
      </Section>

      {/* ── Earnings chart ── */}
      <Section>
        <SectionHeader title="Today's earnings chart" />
        <EarningsChart />
      </Section>

      <ThirdPartyGameShell
        session={gameSession}
        onClose={() => setGameSession(null)}
      />
    </div>
  );
}
