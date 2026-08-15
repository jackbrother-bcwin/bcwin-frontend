/**
 * Activity hub catalog — promo banners + quick actions.
 * Images: ImageKit CDN (BCWin) — see lib/banner-cdn.ts
 */

import {
  CDN_BANNER,
  CDN_ACTIVITY_POSTERS,
  type ActivityPosterId,
} from "../../lib/banner-cdn";

export type ActivityView =
  | "hub"
  | "bonus-details"
  | "invitation"
  | "invitation-rules"
  | "invitation-record"
  | "attendance"
  | "salary-chart"
  | "spin"
  | "wheel"
  | "lucky-spin"
  | "rebate";

export type ActivityBannerAction =
  | { type: "view"; view: ActivityView }
  | { type: "screen"; screen: string }
  /** Full-page poster with navbar + back (CDN detail image) */
  | { type: "poster"; poster: ActivityPosterId }
  | { type: "none" };

export interface ActivityBanner {
  id: string;
  title: string;
  /** Strip thumbnail on hub */
  image: string;
  action?: ActivityBannerAction;
}

/**
 * Banner strip under Gifts / Attendance.
 * Promo rule charts open as full-page posters; feature banners deep-link in-app.
 */
/** Short header titles for full-page posters */
export const ACTIVITY_POSTER_TITLES: Record<ActivityPosterId, string> = {
  recharge3: "Recharge bonus 3%",
  lucky15: "Lucky 15-days bonus",
  luckySpin: "Lucky spin · iPhone",
  firstDeposit: "First deposit bonus",
  appDownload: "App download gift",
  creativeVideo: "Creative video event",
  chickenRoad: "Chicken Road",
};

export const ACTIVITY_BANNERS: ActivityBanner[] = [
  {
    id: "recharge-3",
    title: "9TH-19TH-29TH RECHARGE BONUS 3%",
    image: CDN_BANNER.recharge3,
    action: { type: "poster", poster: "recharge3" },
  },
  {
    id: "lucky-15",
    title: "LUCKY 15-DAYS CUMULATIVE BONUS UP TO ₹507,777",
    image: CDN_BANNER.lucky15,
    action: { type: "poster", poster: "lucky15" },
  },
  {
    id: "first-deposit",
    title: "FIRST DEPOSIT GET FREE ₹2,000",
    image: CDN_BANNER.firstDeposit,
    action: { type: "poster", poster: "firstDeposit" },
  },
  {
    id: "invite-friends",
    title: "INVITE FRIENDS BONUS UP TO ₹777,777",
    image: CDN_BANNER.invite,
    action: { type: "view", view: "invitation" },
  },
  {
    id: "app-download",
    title: "APP DOWNLOAD SHARE Gift Code ₹100 M",
    image: CDN_BANNER.appDownload,
    action: { type: "poster", poster: "appDownload" },
  },
  {
    id: "lucky-spin",
    title: "LUCKY SPIN TO WIN IPHONE 16",
    image: CDN_BANNER.luckySpin,
    action: { type: "poster", poster: "luckySpin" },
  },
  {
    id: "checkin",
    title: "CHECK IN DAILY AND EARN BONUS UP TO 3%",
    image: CDN_BANNER.checkin,
    action: { type: "view", view: "attendance" },
  },
  {
    id: "creative-video",
    title: "CREATIVE VIDEO EVENT UP TO ₹75,000",
    image: CDN_BANNER.creativeVideo,
    action: { type: "poster", poster: "creativeVideo" },
  },
  {
    id: "chicken-road",
    title: "CHICKEN ROAD",
    image: CDN_BANNER.chickenRoad,
    action: { type: "poster", poster: "chickenRoad" },
  },
];

/** Resolve poster CDN URL for a banner action */
export function activityPosterUrl(id: ActivityPosterId): string {
  return CDN_ACTIVITY_POSTERS[id];
}

/**
 * Invitation reward tiers — client-provided Invitation Rules table (product).
 * Backend FALLBACK_INVITATION_TIERS must match this list.
 * Admin ActivityBonusTier type=INVITATION overrides at runtime when seeded.
 *
 * Logic: L1 invites only; each invitee total SUCCESS deposit ≥ deposit (per person).
 */
export const INVITATION_RULES_TABLE: {
  people: number;
  deposit: number;
  bonus: number;
}[] = [
  { people: 1, deposit: 200, bonus: 27 },
  { people: 3, deposit: 300, bonus: 157 },
  { people: 10, deposit: 500, bonus: 577 },
  { people: 30, deposit: 800, bonus: 1577 },
  { people: 60, deposit: 1200, bonus: 3577 },
  { people: 100, deposit: 1200, bonus: 5777 },
  { people: 200, deposit: 1200, bonus: 10777 },
  { people: 500, deposit: 1200, bonus: 20777 },
  { people: 1000, deposit: 1200, bonus: 50777 },
  { people: 2000, deposit: 1200, bonus: 107777 },
  { people: 5000, deposit: 1500, bonus: 307777 },
  { people: 10000, deposit: 1500, bonus: 507777 },
  { people: 20000, deposit: 1500, bonus: 777777 },
];
