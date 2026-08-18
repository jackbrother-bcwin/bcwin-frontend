/**
 * Nested Agency / Activity pages as hash segments.
 * Refresh and swipe-back use the same #/ stack as wallet → deposit.
 */

import type { AgencyView } from "../components/promotion/types";
import type { ActivityView } from "../components/activity/catalog";
import type { ActivityPosterId } from "./banner-cdn";

export const AGENCY_VIEW_SCREEN: Record<Exclude<AgencyView, "hub">, string> = {
  invite: "agency-invite",
  subordinates: "agency-subordinates",
  newSubordinates: "agency-new-subs",
  commission: "agency-commission",
  commissionDetail: "agency-commission-detail",
  salary: "agency-salary",
  rules: "agency-rules",
  rebate: "agency-rebate",
};

const AGENCY_SCREEN_VIEW: Record<string, Exclude<AgencyView, "hub">> = {
  "agency-invite": "invite",
  "agency-subordinates": "subordinates",
  "agency-new-subs": "newSubordinates",
  "agency-commission": "commission",
  "agency-commission-detail": "commissionDetail",
  "agency-salary": "salary",
  "agency-rules": "rules",
  "agency-rebate": "rebate",
};

export const ACTIVITY_VIEW_SCREEN: Record<
  Exclude<ActivityView, "hub" | "spin" | "wheel" | "lucky-spin">,
  string
> = {
  "bonus-details": "activity-bonus-details",
  invitation: "activity-invitation",
  "invitation-rules": "activity-invitation-rules",
  "invitation-record": "activity-invitation-record",
  attendance: "activity-attendance",
  "salary-chart": "activity-salary-chart",
  rebate: "activity-rebate",
};

const ACTIVITY_SCREEN_VIEW: Record<
  string,
  Exclude<ActivityView, "hub" | "spin" | "wheel" | "lucky-spin">
> = {
  "activity-bonus-details": "bonus-details",
  "activity-invitation": "invitation",
  "activity-invitation-rules": "invitation-rules",
  "activity-invitation-record": "invitation-record",
  "activity-attendance": "attendance",
  "activity-salary-chart": "salary-chart",
  "activity-rebate": "rebate",
};

const POSTER_IDS: ActivityPosterId[] = [
  "recharge3",
  "lucky15",
  "luckySpin",
  "firstDeposit",
  "appDownload",
  "creativeVideo",
  "chickenRoad",
];

export function posterScreen(id: ActivityPosterId): string {
  return `poster-${id}`;
}

export function posterIdFromScreen(tab: string): ActivityPosterId | null {
  if (!tab.startsWith("poster-")) return null;
  const id = tab.slice("poster-".length) as ActivityPosterId;
  return POSTER_IDS.includes(id) ? id : null;
}

export const NESTED_SPA_SCREENS: string[] = [
  ...Object.values(AGENCY_VIEW_SCREEN),
  ...Object.values(ACTIVITY_VIEW_SCREEN),
  ...POSTER_IDS.map(posterScreen),
];

export function agencyViewFromScreen(tab: string): AgencyView | null {
  if (tab === "promotion") return "hub";
  return AGENCY_SCREEN_VIEW[tab] ?? null;
}

export function activityViewFromScreen(tab: string): ActivityView | null {
  if (tab === "activity") return "hub";
  return ACTIVITY_SCREEN_VIEW[tab] ?? null;
}

export function activityNavigateTarget(view: ActivityView): string {
  if (view === "spin" || view === "wheel") return "spin";
  if (view === "lucky-spin") return "lucky-spin";
  if (view === "hub") return "activity";
  return ACTIVITY_VIEW_SCREEN[view];
}
