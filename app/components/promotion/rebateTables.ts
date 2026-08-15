/**
 * Static rebate ratio tables (display-only).
 * Source: notes/docs/rebateratio/1.md (from Rebate_Ratio.xlsx).
 * Values are percentages for downline levels 1–6 per agent rebate level L0–L10.
 */

export type RebateCategory =
  | "lottery"
  | "slots"
  | "casino"
  | "sports"
  | "rummy";

/** Rates for downline levels 1–6 (percentages) */
export type LevelRates = number[];

/** Lottery Rebate Ratio — notes/docs/rebateratio/1.md */
const LOTTERY: Record<string, LevelRates> = {
  L0: [0.5, 0.15, 0.0512, 0.0162, 0.00486, 0.001458],
  L1: [0.6, 0.215, 0.06575, 0.025012, 0.010504, 0.003677],
  L2: [0.65, 0.22525, 0.085469, 0.035551, 0.010504, 0.003677],
  L3: [0.75, 0.28125, 0.105469, 0.0512, 0.02048, 0.008192],
  L4: [0.8, 0.30125, 0.153531, 0.065251, 0.027732, 0.011786],
  L5: [0.9, 0.405, 0.18225, 0.082013, 0.036906, 0.016608],
  L6: [1, 0.5, 0.25, 0.125, 0.0625, 0.03125],
  L7: [1.1, 0.605, 0.33275, 0.183013, 0.100657, 0.055361],
  L8: [1.2, 0.72, 0.432, 0.2592, 0.15552, 0.093312],
  L9: [1.3, 0.845, 0.54925, 0.357013, 0.232058, 0.150838],
  L10: [1.4, 0.98, 0.686, 0.4802, 0.33614, 0.235298],
};

/**
 * Casino / Sports / Rummy share the same ratios in 1.md
 * (each is roughly half of lottery L1-col for level-1 rates, etc.)
 */
const CASINO_SPORTS_RUMMY: Record<string, LevelRates> = {
  L0: [0.25, 0.07, 0.021, 0.0081, 0.00243, 0.000729],
  L1: [0.3, 0.1125, 0.032875, 0.011006, 0.005252, 0.001838],
  L2: [0.325, 0.120625, 0.042734, 0.015775, 0.005252, 0.001838],
  L3: [0.375, 0.140625, 0.052734, 0.0256, 0.01024, 0.004096],
  L4: [0.405, 0.150625, 0.076766, 0.032625, 0.013866, 0.005893],
  L5: [0.45, 0.2025, 0.091125, 0.041006, 0.018453, 0.008304],
  L6: [0.5, 0.25, 0.125, 0.0625, 0.03125, 0.015625],
  L7: [0.55, 0.3025, 0.166375, 0.091506, 0.050328, 0.027681],
  L8: [0.6, 0.36, 0.216, 0.1296, 0.07776, 0.046656],
  L9: [0.65, 0.4225, 0.274625, 0.178506, 0.116029, 0.075419],
  L10: [0.7, 0.49, 0.343, 0.2401, 0.16807, 0.117649],
};

export const REBATE_TABLES: Record<RebateCategory, Record<string, LevelRates>> =
  {
    lottery: LOTTERY,
    slots: CASINO_SPORTS_RUMMY,
    casino: CASINO_SPORTS_RUMMY,
    sports: CASINO_SPORTS_RUMMY,
    rummy: CASINO_SPORTS_RUMMY,
  };

export const REBATE_LEVELS = [
  "L0",
  "L1",
  "L2",
  "L3",
  "L4",
  "L5",
  "L6",
  "L7",
  "L8",
  "L9",
  "L10",
] as const;

/** Agency level requirements (invitation rules table) */
export const AGENCY_LEVEL_TABLE = [
  { level: "L0", team: 0, betting: "0", deposit: "0" },
  { level: "L1", team: 10, betting: "500K", deposit: "100K" },
  { level: "L2", team: 20, betting: "1,000K", deposit: "200K" },
  { level: "L3", team: 30, betting: "5M", deposit: "1,000K" },
  { level: "L4", team: 80, betting: "20M", deposit: "4M" },
  { level: "L5", team: 150, betting: "75M", deposit: "15M" },
  { level: "L6", team: 500, betting: "250M", deposit: "50M" },
  { level: "L7", team: 1000, betting: "500M", deposit: "100M" },
  { level: "L8", team: 2000, betting: "1,000M", deposit: "200M" },
  { level: "L9", team: 5000, betting: "1,500M", deposit: "30M" },
  { level: "L10", team: 8000, betting: "2,500M", deposit: "500M" },
];

export function formatPct(n: number): string {
  if (Number.isInteger(n)) return `${n}%`;
  const s = n
    .toFixed(8)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
  return `${s}%`;
}

/** One VIP row from GET /user/rebate/rates */
export type ApiRebateRateRow = {
  vipLevel: number;
  layer1: number;
  layer2: number;
  layer3: number;
  layer4: number;
  layer5: number;
  layer6: number;
};

export type ApiRebateRatesPayload = Partial<
  Record<RebateCategory, ApiRebateRateRow[]>
>;

/**
 * Map API rates → display table (L0–L10 × layers 1–6).
 * Falls back per-cell to static when a VIP row is missing.
 */
export function mapApiRatesToTables(
  api: ApiRebateRatesPayload | null | undefined
): Record<RebateCategory, Record<string, LevelRates>> {
  const out: Record<RebateCategory, Record<string, LevelRates>> = {
    lottery: { ...REBATE_TABLES.lottery },
    slots: { ...REBATE_TABLES.slots },
    casino: { ...REBATE_TABLES.casino },
    sports: { ...REBATE_TABLES.sports },
    rummy: { ...REBATE_TABLES.rummy },
  };

  if (!api) return out;

  const cats: RebateCategory[] = [
    "lottery",
    "slots",
    "casino",
    "sports",
    "rummy",
  ];

  for (const cat of cats) {
    const rows = api[cat];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    const byVip = new Map<number, ApiRebateRateRow>();
    for (const r of rows) {
      if (r && typeof r.vipLevel === "number") byVip.set(r.vipLevel, r);
    }

    const next: Record<string, LevelRates> = { ...out[cat] };
    for (const lv of REBATE_LEVELS) {
      const vip = Number(lv.slice(1));
      const row = byVip.get(vip);
      if (!row) continue;
      next[lv] = [
        Number(row.layer1) || 0,
        Number(row.layer2) || 0,
        Number(row.layer3) || 0,
        Number(row.layer4) || 0,
        Number(row.layer5) || 0,
        Number(row.layer6) || 0,
      ];
    }
    out[cat] = next;
  }

  return out;
}
