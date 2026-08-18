import { asset } from "./cdn";
/**
 * Home catalog — single source of truth for lobby sections & games.
 * Add/remove games or sections by editing this file only.
 */

export type CategoryId =
  | "lobby"
  | "popular"
  | "mini"
  | "lottery"
  | "slots"
  | "fishing"
  | "sports"
  | "casino"
  | "pvc";

export type GameAction =
  | { type: "spa"; screen: string }
  /** Inout third-party — launch via POST /inout/launch { gameMode } */
  | { type: "inout"; gameMode: string }
  /** Search Inout catalog by title/gameMode then launch */
  | { type: "inout-search"; search: string }
  | { type: "soon" };

export type TileLayout = "poster" | "square" | "wide" | "lottery";

export interface GameDef {
  id: string;
  name: string;
  image: string;
  /** Categories this game appears under */
  categories: CategoryId[];
  action: GameAction;
  /** Optional solid accent underlay (reference style for Aviator/Boom etc.) */
  accent?: string;
  layout?: TileLayout;
  badge?: string;
  /** Title is already drawn on the artwork — hide tile text overlay */
  titleInImage?: boolean;
  enabled?: boolean;
  /** Inout provider category (instant | crash_game | slots | roulette) */
  providerCategory?: string;
}

export interface CategoryDef {
  id: CategoryId;
  name: string;
  icon: string;
}

export type SectionKind =
  | "winning-info"
  | "game-grid"
  | "lottery-grid"
  | "promo-row"
  | "super-jackpot"
  | "earnings"
  | "footer-legal";

export interface HomeSectionDef {
  id: string;
  kind: SectionKind;
  /** Section title (omit for pure content blocks) */
  title?: string;
  icon?: string;
  /** Show only when active category is one of these; omit = always on lobby feed */
  showOn?: CategoryId[];
  /** Pull games by category filter */
  gameCategory?: CategoryId;
  /** Or explicit ordered game ids */
  gameIds?: string[];
  columns?: 2 | 3;
  maxItems?: number;
  showDetail?: boolean;
  showPager?: boolean;
  enabled?: boolean;
}

/* ── Categories (tab rail) — icons from ImageKit CDN (banner-cdn CDN_CAT_ICONS)
 * Lottery pinned near top (right after Lobby) so it stays easy to find.
 */
export const CATEGORIES: CategoryDef[] = [
  { id: "lobby", name: "Lobby", icon: "lobby" },
  { id: "lottery", name: "Lottery", icon: "lottery" },
  { id: "popular", name: "Popular", icon: "popular" },
  { id: "mini", name: "Mini Game", icon: "mini" },
  { id: "slots", name: "Slots", icon: "slots" },
  { id: "fishing", name: "Fishing", icon: "fishing" },
  { id: "sports", name: "Sports", icon: "sports" },
  { id: "casino", name: "Casino", icon: "casino" },
];

/**
 * First-party catalog only.
 * Third-party (Inout) games load from GET /inout/games — see useInoutCatalog.
 */
export const GAMES: GameDef[] = [
  // Popular — SPA flagship on recommended row
  {
    id: "wingo",
    name: "Win Go",
    image: asset("/assets/png/games/wingo-vertical.png"),
    categories: ["popular"],
    action: { type: "spa", screen: "wingo" },
    layout: "poster",
    titleInImage: true,
    accent: "linear-gradient(160deg,#2a2210 0%,#14100a 100%)",
  },

  // Lottery — 5 first-party games (screenshot thumbs)
  {
    id: "lottery-wingo",
    name: "Win Go",
    image: asset("/assets/png/games/wingo.png"),
    categories: ["lottery"],
    action: { type: "spa", screen: "wingo" },
    layout: "lottery",
    titleInImage: true,
  },
  {
    id: "lottery-k3",
    name: "K3",
    image: asset("/assets/png/games/k3.png"),
    categories: ["lottery"],
    action: { type: "spa", screen: "k3" },
    layout: "lottery",
    titleInImage: true,
  },
  {
    id: "lottery-5d",
    name: "5D",
    image: asset("/assets/png/games/5d.png"),
    categories: ["lottery"],
    action: { type: "spa", screen: "5d" },
    layout: "lottery",
    titleInImage: true,
  },
  {
    id: "lottery-trx",
    name: "Trx Wingo",
    image: asset("/assets/png/games/trxwingo.png"),
    categories: ["lottery"],
    action: { type: "spa", screen: "trxwingo" },
    layout: "lottery",
    titleInImage: true,
  },
  {
    id: "lottery-moto",
    name: "Moto Racing",
    image: asset("/assets/png/games/motoracing.png"),
    categories: ["lottery"],
    action: { type: "spa", screen: "moto" },
    layout: "lottery",
    titleInImage: true,
  },
];

/* ── Lobby section feed (order = render order) ──
 * Toggle enabled:false to hide. Reorder freely.
 * showOn defaults to lobby-only when set; omit for always (lobby feed path).
 */
export const HOME_SECTIONS: HomeSectionDef[] = [
  {
    id: "winning-info",
    kind: "winning-info",
    title: "Winning information",
    icon: "🏆",
    showOn: ["lobby"],
  },
  // Lottery pinned first among game grids on lobby
  {
    id: "lottery",
    kind: "lottery-grid",
    title: "Lottery",
    icon: "🎱",
    showOn: ["lobby", "lottery"],
    gameCategory: "lottery",
    showDetail: true,
  },
  {
    id: "recommended",
    kind: "game-grid",
    title: "Recommended Games",
    icon: "👑",
    showOn: ["lobby", "popular"],
    /**
     * SPA Win Go + full popular Inout catalog (no maxItems — pager shows all).
     * see useInoutCatalog.resolveSectionGames
     */
    gameIds: ["wingo"],
    gameCategory: "popular",
    columns: 3,
    showDetail: true,
    showPager: true,
  },
  {
    id: "mini-games",
    kind: "game-grid",
    title: "Mini games",
    icon: "🚀",
    showOn: ["lobby", "mini"],
    gameCategory: "mini",
    columns: 3,
    showDetail: true,
    showPager: true,
  },
  {
    id: "slots",
    kind: "game-grid",
    title: "Slots",
    icon: "🎰",
    showOn: ["lobby", "slots"],
    gameCategory: "slots",
    columns: 3,
    showDetail: true,
    showPager: true,
  },
  {
    id: "fishing",
    kind: "game-grid",
    title: "Fishing",
    icon: "🐟",
    showOn: ["lobby", "fishing"],
    gameCategory: "fishing",
    columns: 3,
    showDetail: true,
    showPager: true,
  },
  {
    id: "sports",
    kind: "game-grid",
    title: "Sports",
    icon: "⚽",
    showOn: ["lobby", "sports"],
    gameCategory: "sports",
    columns: 3,
    showDetail: true,
    showPager: true,
  },
  {
    id: "casino",
    kind: "game-grid",
    title: "Casino",
    icon: "🃏",
    showOn: ["lobby", "casino"],
    gameCategory: "casino",
    columns: 3,
    showDetail: true,
    showPager: true,
  },
  {
    id: "rummy",
    kind: "game-grid",
    title: "Rummy",
    icon: "♠️",
    showOn: ["lobby", "pvc"],
    gameCategory: "pvc",
    columns: 3,
    showDetail: true,
    showPager: true,
  },
  {
    id: "promo-row",
    kind: "promo-row",
    showOn: ["lobby"],
  },
  {
    id: "super-jackpot",
    kind: "super-jackpot",
    title: "Super Jackpot",
    icon: "💎",
    showOn: ["lobby"],
  },
  {
    id: "earnings",
    kind: "earnings",
    title: "Today's earnings chart",
    icon: "🏅",
    showOn: ["lobby"],
  },
  {
    id: "footer",
    kind: "footer-legal",
    showOn: ["lobby"],
  },
];

/* ── Demo / static content for non-API sections (BCWin lottery only) ── */
export const WINNING_INFO = [
  { id: "w1", name: "Mem***HMY", amount: "₹388.00", image: asset("/assets/png/games/wingo-vertical.png"), avatar: asset("/assets/png/avatar.png") },
  { id: "w2", name: "Mem***WMU", amount: "₹752.00", image: asset("/assets/png/games/trxwingo.png"), avatar: asset("/assets/png/avatar2.png") },
  { id: "w3", name: "Mem***VVM", amount: "₹338.00", image: asset("/assets/png/games/k3.png"), avatar: asset("/assets/png/avatar-fb4c2506.webp") },
  { id: "w4", name: "Mem***SBO", amount: "₹6,570.00", image: asset("/assets/png/games/5d.png"), avatar: asset("/assets/png/avatar.png") },
  { id: "w5", name: "Mem***MDI", amount: "₹3,491.95", image: asset("/assets/png/games/motoracing.png"), avatar: asset("/assets/png/avatar2.png") },
  { id: "w6", name: "Mem***OIN", amount: "₹1,240.00", image: asset("/assets/png/games/wingo.png"), avatar: asset("/assets/png/avatar.png") },
];

export const JACKPOT_ITEMS = [
  { id: "j1", name: "Win Go", amount: "₹1,200.00", mult: "9.8X", image: asset("/assets/png/games/wingo-vertical.png") },
  { id: "j2", name: "TRX WinGo", amount: "₹3,450.00", mult: "12.5X", image: asset("/assets/png/games/trxwingo.png") },
  { id: "j3", name: "K3 Lottery", amount: "₹2,100.00", mult: "8.2X", image: asset("/assets/png/games/k3.png") },
];

export const EARNINGS_TOP = [
  { rank: 1, name: "ROL***DZZ", amount: "₹530,031,040.00", avatar: asset("/assets/png/avatar2.png") },
  { rank: 2, name: "Ki***MJ", amount: "₹463,767,299.24", avatar: asset("/assets/png/avatar.png") },
  { rank: 3, name: "Mem***usv", amount: "₹382,033,013.88", avatar: asset("/assets/png/avatar-fb4c2506.webp") },
];

export const EARNINGS_LIST = [
  { rank: 4, name: "Mem***WTK", amount: "₹196,000,000.00", avatar: asset("/assets/png/avatar.png") },
  { rank: 5, name: "KRI***HNA", amount: "₹141,566,968.69", avatar: asset("/assets/png/avatar2.png") },
  { rank: 6, name: "Mem***NIO", amount: "₹95,060,000.00", avatar: asset("/assets/png/avatar.png") },
  { rank: 7, name: "Mem***L6B", amount: "₹53,489,615.20", avatar: asset("/assets/png/avatar-fb4c2506.webp") },
  { rank: 8, name: "Lod***aaa", amount: "₹40,086,096.40", avatar: asset("/assets/png/avatar2.png") },
  { rank: 9, name: "Mem***8U8", amount: "₹37,583,588.00", avatar: asset("/assets/png/avatar.png") },
  { rank: 10, name: "AYU***10X", amount: "₹36,367,800.00", avatar: asset("/assets/png/avatar2.png") },
];

/** Showcase-only winner feed under earnings podium (not real leaderboard data). */
const SHOWCASE_PREFIXES = [
  "Mem", "Raj", "Ami", "Kab", "Sur", "Dee", "Pri", "Roh", "Vin", "Sha",
  "Ayu", "Kri", "Lod", "Tas", "Win", "Plu", "Neo", "Sky", "Max", "Lux",
];
const SHOWCASE_SUFFIXES = [
  "WTK", "HNA", "NIO", "L6B", "8U8", "10X", "DZZ", "usv", "MJ", "CFD",
  "92", "05", "88", "31", "67", "AAA", "VIP", "PRO", "X9", "Q1",
];
const SHOWCASE_AVATARS = [
  asset("/assets/png/avatar.png"),
  asset("/assets/png/avatar2.png"),
  asset("/assets/png/avatar-fb4c2506.webp"),
];

function formatShowcaseAmount(n: number): string {
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}`;
}

/** Deterministic fake list so SSR/client match (promo ticker only). */
export function buildEarningsShowcase(count = 48): {
  id: string;
  rank: number;
  name: string;
  amount: string;
  avatar: string;
}[] {
  const out: {
    id: string;
    rank: number;
    name: string;
    amount: string;
    avatar: string;
  }[] = [];
  for (let i = 0; i < count; i++) {
    const pre = SHOWCASE_PREFIXES[i % SHOWCASE_PREFIXES.length]!;
    const suf = SHOWCASE_SUFFIXES[(i * 3) % SHOWCASE_SUFFIXES.length]!;
    // Varied “big win” amounts for promo feel
    const base = 12_000 + ((i * 97_331) % 180_000_000);
    const amount = base + ((i * 17) % 1000) / 100;
    out.push({
      id: `sc-${i}`,
      rank: i + 4,
      name: `${pre}***${suf}`,
      amount: formatShowcaseAmount(amount),
      avatar: SHOWCASE_AVATARS[i % SHOWCASE_AVATARS.length]!,
    });
  }
  return out;
}

export const NOTICE_TEXT =
  "Welcome to BCWin game platform, we will serve you wholeheartedly!";

/* ── Helpers ── */
const gameMap = new Map(GAMES.map((g) => [g.id, g]));

export function getGame(id: string): GameDef | undefined {
  return gameMap.get(id);
}

export function resolveGames(section: HomeSectionDef): GameDef[] {
  let list: GameDef[] = [];
  if (section.gameIds?.length) {
    list = section.gameIds.map((id) => gameMap.get(id)).filter(Boolean) as GameDef[];
  } else if (section.gameCategory) {
    list = GAMES.filter(
      (g) => g.enabled !== false && g.categories.includes(section.gameCategory!)
    );
  }
  list = list.filter((g) => g.enabled !== false);
  if (section.maxItems) list = list.slice(0, section.maxItems);
  return list;
}

export function sectionsForCategory(category: CategoryId): HomeSectionDef[] {
  return HOME_SECTIONS.filter((s) => {
    if (s.enabled === false) return false;
    if (!s.showOn) return category === "lobby";
    return s.showOn.includes(category);
  });
}
