import { asset } from "../../../lib/cdn";
/**
 * VIP presentation (colors, assets, rules text).
 * Level numbers/rewards prefer backend GET /user/vip/requirements;
 * DEFAULT_VIP_REQUIREMENTS fills gaps when API returns 0 / empty (unseeded DB).
 */

export type VipTheme = {
  level: number;
  cardBg: string;
  text: string;
  textMuted: string;
  progress: string;
  progressTrack: string;
  chipBg: string;
  king: 1 | 2;
};

/** Seed-aligned defaults (matches backend seeds/vipRequirements.ts) */
export type VipReqDefault = {
  level: number;
  expRequired: number;
  levelUpReward: number;
  monthlyReward: number;
  rebateRate: string | null;
  selfRebatePercent: number;
};

/** ADR-0021 — same table as SelfRebateRateConfig (VIP0=0) */
export const SELF_REBATE_PERCENT_BY_VIP: Record<number, number> = {
  0: 0,
  1: 0.05,
  2: 0.05,
  3: 0.1,
  4: 0.1,
  5: 0.1,
  6: 0.15,
  7: 0.15,
  8: 0.15,
  9: 0.2,
  10: 0.3,
};

export function selfRebatePercentForVip(level: number): number {
  return SELF_REBATE_PERCENT_BY_VIP[level] ?? 0;
}

export function formatSelfRebatePercent(pct: number): string {
  if (!Number.isFinite(pct) || pct <= 0) return "0%";
  const s = pct.toFixed(2).replace(/\.?0+$/, "");
  return `${s}%`;
}

export const DEFAULT_VIP_REQUIREMENTS: VipReqDefault[] = [
  { level: 1, expRequired: 3_000, levelUpReward: 30, monthlyReward: 5, rebateRate: null, selfRebatePercent: 0.05 },
  { level: 2, expRequired: 30_000, levelUpReward: 150, monthlyReward: 15, rebateRate: null, selfRebatePercent: 0.05 },
  { level: 3, expRequired: 400_000, levelUpReward: 690, monthlyReward: 69, rebateRate: null, selfRebatePercent: 0.1 },
  { level: 4, expRequired: 4_000_000, levelUpReward: 1_290, monthlyReward: 690, rebateRate: null, selfRebatePercent: 0.1 },
  { level: 5, expRequired: 20_000_000, levelUpReward: 5_900, monthlyReward: 2_690, rebateRate: null, selfRebatePercent: 0.1 },
  { level: 6, expRequired: 80_000_000, levelUpReward: 16_900, monthlyReward: 6_900, rebateRate: null, selfRebatePercent: 0.15 },
  { level: 7, expRequired: 300_000_000, levelUpReward: 69_000, monthlyReward: 26_900, rebateRate: null, selfRebatePercent: 0.15 },
  { level: 8, expRequired: 1_000_000_000, levelUpReward: 169_000, monthlyReward: 69_000, rebateRate: null, selfRebatePercent: 0.15 },
  { level: 9, expRequired: 5_000_000_000, levelUpReward: 690_000, monthlyReward: 169_000, rebateRate: null, selfRebatePercent: 0.2 },
  { level: 10, expRequired: 10_000_000_000, levelUpReward: 1_690_000, monthlyReward: 690_000, rebateRate: null, selfRebatePercent: 0.3 },
];

export function defaultReqForLevel(level: number): VipReqDefault {
  return (
    DEFAULT_VIP_REQUIREMENTS.find((r) => r.level === level) ??
    DEFAULT_VIP_REQUIREMENTS[0]!
  );
}

/** VIP1–VIP10 visual themes (screenshots) */
export const VIP_THEMES: VipTheme[] = [
  {
    level: 1,
    cardBg: "linear-gradient(135deg, #c5d0e0 0%, #a8b8cc 45%, #8fa3bc 100%)",
    text: "#2c3e55",
    textMuted: "rgba(44,62,85,0.72)",
    progress: "#5b7a9a",
    progressTrack: "rgba(44,62,85,0.18)",
    chipBg: "rgba(255,255,255,0.45)",
    king: 1,
  },
  {
    level: 2,
    cardBg: "linear-gradient(135deg, #f0c98a 0%, #e0a85c 45%, #c98a3e 100%)",
    text: "#5c3a12",
    textMuted: "rgba(92,58,18,0.72)",
    progress: "#a66a1e",
    progressTrack: "rgba(92,58,18,0.18)",
    chipBg: "rgba(255,255,255,0.35)",
    king: 2,
  },
  {
    level: 3,
    cardBg: "linear-gradient(135deg, #f5b4b0 0%, #e88a88 45%, #d66a6e 100%)",
    text: "#6b2228",
    textMuted: "rgba(107,34,40,0.72)",
    progress: "#c0454d",
    progressTrack: "rgba(107,34,40,0.18)",
    chipBg: "rgba(255,255,255,0.35)",
    king: 2,
  },
  {
    level: 4,
    cardBg: "linear-gradient(135deg, #8ed4f0 0%, #5eb8e0 45%, #3a9ec8 100%)",
    text: "#0d3d55",
    textMuted: "rgba(13,61,85,0.72)",
    progress: "#1a7aa8",
    progressTrack: "rgba(13,61,85,0.18)",
    chipBg: "rgba(255,255,255,0.4)",
    king: 2,
  },
  {
    level: 5,
    cardBg: "linear-gradient(135deg, #f0a8e0 0%, #e07ad0 45%, #c85ab8 100%)",
    text: "#5a1650",
    textMuted: "rgba(90,22,80,0.72)",
    progress: "#b03a9a",
    progressTrack: "rgba(90,22,80,0.18)",
    chipBg: "rgba(255,255,255,0.4)",
    king: 2,
  },
  {
    level: 6,
    cardBg: "linear-gradient(135deg, #7eefd0 0%, #4fd4b0 45%, #2ab890 100%)",
    text: "#0a4a3a",
    textMuted: "rgba(10,74,58,0.72)",
    progress: "#1a9070",
    progressTrack: "rgba(10,74,58,0.18)",
    chipBg: "rgba(255,255,255,0.4)",
    king: 2,
  },
  {
    level: 7,
    cardBg: "linear-gradient(135deg, #7ad48a 0%, #4cb85e 45%, #2e9840 100%)",
    text: "#0d3d18",
    textMuted: "rgba(13,61,24,0.72)",
    progress: "#1a8030",
    progressTrack: "rgba(13,61,24,0.18)",
    chipBg: "rgba(255,255,255,0.4)",
    king: 2,
  },
  {
    level: 8,
    cardBg: "linear-gradient(135deg, #a8b8f0 0%, #7888d8 45%, #5868c0 100%)",
    text: "#1a2050",
    textMuted: "rgba(26,32,80,0.72)",
    progress: "#3a48a0",
    progressTrack: "rgba(26,32,80,0.18)",
    chipBg: "rgba(255,255,255,0.4)",
    king: 2,
  },
  {
    level: 9,
    cardBg: "linear-gradient(135deg, #f0d070 0%, #e0b030 45%, #c89010 100%)",
    text: "#4a3800",
    textMuted: "rgba(74,56,0,0.72)",
    progress: "#b08000",
    progressTrack: "rgba(74,56,0,0.18)",
    chipBg: "rgba(255,255,255,0.4)",
    king: 2,
  },
  {
    level: 10,
    cardBg: "linear-gradient(135deg, #e8c070 0%, #d4a040 40%, #b87820 100%)",
    text: "#3d2800",
    textMuted: "rgba(61,40,0,0.75)",
    progress: "#9a6810",
    progressTrack: "rgba(61,40,0,0.2)",
    chipBg: "rgba(255,255,255,0.35)",
    king: 2,
  },
];

export function themeForLevel(level: number): VipTheme {
  return (
    VIP_THEMES.find((t) => t.level === level) ??
    VIP_THEMES[Math.min(Math.max(level - 1, 0), VIP_THEMES.length - 1)]!
  );
}

export const VIP_ASSET = {
  bg: (n: number) => asset(`/assets/vip/vipbg${Math.min(Math.max(n, 1), 10)}.png`),
  logo: (n: number) => asset(`/assets/vip/vip${Math.min(Math.max(n, 1), 10)}logo.png`),
  king: (n: 1 | 2) => asset(`/assets/vip/vipking${n}.png`),
  gift: asset("/assets/png/giftIcon-17a26471.png"),
  coin: asset("/assets/png/money-37bf3bca.png"),
  coins: asset("/assets/png/coinStack-85b61210.png"),
  diamond: asset("/assets/png/diamond-2cbec887.png"),
  avatar: asset("/assets/png/avatar.png"),
};

export function vipBadgeSrc(level: number): string {
  if (level <= 0) return asset("/assets/png/vip0.png");
  const map: Record<number, string> = {
    1: asset("/assets/png/vip1-cde9e3a4.png"),
    2: asset("/assets/png/vip2-6839e741.png"),
    3: asset("/assets/png/vip3-30c8484b.png"),
    4: asset("/assets/png/vip4-9dc1e9f4.png"),
    5: asset("/assets/png/vip5-28139224.png"),
    6: asset("/assets/png/vip6-0a2158b6.png"),
    7: asset("/assets/png/vip7-48005ca9.png"),
    8: asset("/assets/png/vip8-23c72cf0.png"),
    9: asset("/assets/png/vip9-a30a9d27.png"),
    10: asset("/assets/png/vip10-61bb0cf3.png"),
  };
  return map[Math.min(level, 10)] ?? asset("/assets/png/vip0.png");
}

export const PAYOUT_DAYS = 10;

export const SETTLEMENT_NOTE =
  "Monthly VIP reward: current level only, once per month after 02:00 IST on the 1st. First claim is the month after you reach that VIP.";

export type VipRuleSection = {
  title: string;
  body: string;
};

export const VIP_RULES: VipRuleSection[] = [
  {
    title: "Upgrade standard",
    body: "The VIP member's experience points (valid bet amount) that meet the requirements of the corresponding rank will be promoted to the corresponding VIP level, the member's VIP data statistics period starts from 00:00:00 days VIP system launched. VIP level calculation is refreshed every 10 minutes! The corresponding experience level is calculated according to valid odds 1:1 !",
  },
  {
    title: "Upgrade order",
    body: "The VIP level that meets the corresponding requirements can be promoted by one level every day, but the VIP level cannot be promoted by leapfrogging.",
  },
  {
    title: "Level maintenance",
    body: 'VIP members need to complete the maintenance requirements of the corresponding level within 30 days after the "VIP level change"; if the promotion is completed during this period, the maintenance requirements will be calculated according to the current level.',
  },
  {
    title: "Downgrade standard",
    body: "If a VIP member fails to complete the corresponding level maintenance requirements within 30 days, the system will automatically deduct the experience points corresponding to the level. If the experience points are insufficient, the level will be downgraded, and the corresponding discounts will be adjusted to the downgraded level accordingly.",
  },
  {
    title: "Upgrade rewards",
    body: "The upgrade rewards can be claimed on the VIP page after the member reaches the VIP membership level, and each VIP member can only get the reward of each level once.",
  },
  {
    title: "Monthly reward",
    body: "Only your current VIP level monthly reward can be claimed, once per month. After you reach a VIP level you wait until 02:00 IST on the 1st of the next month. Lower levels cannot be collected in a stack. Unclaimed rewards do not accumulate. Withdrawal still requires completing wager.",
  },
];

export function formatExp(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Math.floor(n).toLocaleString("en-IN");
}

export function formatReward(n: number): string {
  return n.toLocaleString("en-IN");
}
