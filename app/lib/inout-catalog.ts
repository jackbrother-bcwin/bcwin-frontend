/**
 * Inout third-party catalog mappings according to PDF catalog guidelines.
 * Maps provider game modes (slugs) & categories → home CategoryId and GameDef tiles.
 */

import type { InoutGame, InoutGameCategory } from "./api";
import type { CategoryId, GameDef } from "./home-catalog";
import { asset } from "./cdn";


/**
 * Exact mapping of Inout game slug (gameMode) -> home tab categories (CategoryId[])
 * as specified in official categorization PDF.
 */
export const INOUT_GAME_SLUG_TO_HOME: Record<string, CategoryId[]> = {
  // Page 1
  "aviafly-two": ["casino", "popular"],
  aviafly: ["casino", "popular"],
  ballonix: ["mini", "popular"],
  bubbles: ["mini"],
  "chicken-banana": ["mini"],
  "chicken-coin": ["slots"],
  "chicken-road-new": ["mini"],
  "chicken-road-rac": ["mini", "popular"],
  "chicken-road": ["mini", "popular"],
  "chicken-road-two": ["mini"],
  "chicken-road-bon": ["mini"],
  "chicken-road-gol": ["mini"],
  "chicken-road-veg": ["mini"],
  "chicken-royal": ["slots"],
  "chicken-shoot": ["mini"],
  "chicken-road-zom": ["mini"],
  coinflip: ["casino", "popular"],
  crash: ["casino", "popular"],
  "cricket-road": ["sports"],
  cryptos: ["slots"],
  diver: ["casino"],
  "drop-the-billionai": ["mini", "popular"],
  "fish-boom": ["fishing"],
  "fish-road-v1": ["fishing"],
  "forest-fortune-v1": ["mini"],
  "frog-jump": ["fishing"],
  peperoad: ["fishing"],
  "fruit-love-fever": ["slots"],

  // Page 2
  "goblin-tower": ["mini"],
  "hamster-run": ["mini"],
  "hot-mines": ["mini"],
  "ice-fish": ["fishing"],
  "jogo-do-bicho": ["casino"],
  "joker-poker": ["casino"],
  "joker-pyre": ["casino"],
  jumper: ["mini"],
  limbo: ["casino", "popular"],
  luckyducky: ["mini"],
  "lucky-mines": ["mini", "popular"],
  megablock: ["mini", "popular"],
  "mine-slot": ["slots"],
  "mine-slot-two": ["slots"],
  "platform-mines": ["mini", "popular"],
  "new-double": ["casino"],
  "new-hilo": ["casino"],
  "penalty-nations-c": ["sports"],
  "penalty-unlimited": ["sports"],
  "pengu-sport": ["sports"],
  plinko: ["mini"],
  "plinko-aztec": ["mini"],
  "rabbit-road-inout": ["mini", "popular"],
  "robo-dice": ["mini"],
  "rock-paper-sciss": ["mini"],
  roulette: ["casino", "popular"],
  "squid-game": ["mini"],
  stairs: ["mini"],
  "sugar-daddy": ["casino", "popular"],
  keno: ["casino"],

  // Page 3
  "topo-mole": ["mini"],
  tower: ["mini"],
  triple: ["casino"],
  twist: ["mini"],
  "twist-new-year": ["mini"],
  "twist-san-quentin": ["mini"],
  wheel: ["mini"],
  "wheel-out": ["mini", "popular"],
};

/**
 * Fallback mapping for provider categories if slug is unknown.
 */
export const INOUT_CATEGORY_TO_HOME: Record<string, CategoryId[]> = {
  instant: ["mini"],
  crash_game: ["mini"],
  slots: ["slots"],
  roulette: ["casino"],
};

/** Home section category → which Inout categories to pull */
export const HOME_TO_INOUT_CATEGORIES: Partial<
  Record<CategoryId, InoutGameCategory[]>
> = {
  mini: ["instant", "crash_game"],
  popular: ["instant", "crash_game", "roulette"],
  slots: ["slots"],
  casino: ["roulette", "instant"],
  fishing: ["instant"],
  sports: ["instant"],
  // lottery = first-party SPA only
};

export function homeCategoriesForInout(
  gameMode: string,
  inoutCategory?: string
): CategoryId[] {
  if (gameMode && INOUT_GAME_SLUG_TO_HOME[gameMode]) {
    return INOUT_GAME_SLUG_TO_HOME[gameMode];
  }
  if (inoutCategory && INOUT_CATEGORY_TO_HOME[inoutCategory]) {
    return INOUT_CATEGORY_TO_HOME[inoutCategory];
  }
  return ["mini"];
}

export function inoutToGameDef(game: InoutGame): GameDef {
  const cat = String(game.category || "instant");
  const homeCats = homeCategoriesForInout(game.gameMode, cat);
  // Vertical posters match classic recommended / Win Go cards
  const layout: GameDef["layout"] = "poster";

  return {
    id: `inout-${game.gameMode || game.id}`,
    name: game.title || game.gameMode,
    image: game.icon || asset("/assets/png/game_mini_bg-c04fcbbd.png"),
    categories: homeCats,
    action: { type: "inout", gameMode: game.gameMode },
    layout,
    // Name is baked into thumbnail art — no overlay text / badges
    titleInImage: true,
    enabled: true,
    providerCategory: cat,
  };
}

/**
 * Filter catalog into a home category.
 * `popular` / lobby recommended: prefer crash + instant, then slots.
 */
export function filterInoutForHomeCategory(
  games: GameDef[],
  homeCategory: CategoryId,
  maxItems?: number
): GameDef[] {
  let list = games.filter(
    (g) => g.enabled !== false && g.categories.includes(homeCategory)
  );

  if (homeCategory === "popular") {
    // Crash first, then instant, then slots
    const rank = (g: GameDef) => {
      if (g.action.type !== "inout") return 9;
      switch (g.providerCategory) {
        case "crash_game":
          return 0;
        case "instant":
          return 1;
        case "slots":
          return 2;
        default:
          return 3;
      }
    };
    list = [...list].sort(
      (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)
    );
  } else {
    list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  }

  if (maxItems != null && maxItems > 0) list = list.slice(0, maxItems);
  return list;
}

/** Merge static + API without duplicate ids (static wins on conflict). */
export function mergeGameLists(
  staticGames: GameDef[],
  apiGames: GameDef[]
): GameDef[] {
  const seen = new Set(staticGames.map((g) => g.id));
  const out = [...staticGames];
  for (const g of apiGames) {
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    out.push(g);
  }
  return out;
}
