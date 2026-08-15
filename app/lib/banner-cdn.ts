/**
 * BCWin promo banners + home category icons on ImageKit CDN.
 * Full delivery URLs — used by home carousel, activity hub, category rail.
 */

const IK = "https://ik.imagekit.io/BCwin";

/** Unique CDN banner files (deduped from upload list) */
export const CDN_BANNER = {
  /** Monthly 3-day recharge 3% (9th–19th–29th) */
  recharge3: `${IK}/1000262418.jpg`,
  /** Lucky 15-days cumulative recharge ₹507,777 */
  lucky15: `${IK}/1000262413.jpg`,
  /** First deposit get free ₹2000 */
  firstDeposit: `${IK}/1000262412.jpg`,
  /** Invite friends bonus up to ₹777,777 */
  invite: `${IK}/1000262410.jpg`,
  /** App download / share gift code ₹100M */
  appDownload: `${IK}/1000262417.jpg`,
  /** Lucky roulette iPhone 16 */
  luckySpin: `${IK}/1000262414.jpg`,
  /** Daily check-in continuous sign-in 3% */
  checkin: `${IK}/1000262411.jpg`,
  /** Creative video event ₹75,000 */
  creativeVideo: `${IK}/1000262416.jpg`,
  /** Chicken Road promo */
  chickenRoad: `${IK}/1000274005.png?updatedAt=1785600731286`,
} as const;

/**
 * Full-page activity promo posters (opened from activity hub banners).
 * Long detail images with PageHeader + back — not navigations to deposit/games.
 */
export const CDN_ACTIVITY_POSTERS = {
  /** 9th–19th–29th recharge 3% rules */
  recharge3: `${IK}/20260801_203117.png?updatedAt=1785599210536`,
  /** Lucky 15-days cumulative bonus chart */
  lucky15: `${IK}/bcwin-15daybonus.png`,
  /** Lucky roulette / iPhone 16 win rules */
  luckySpin: `${IK}/20260801_205623.png?updatedAt=1785599210373`,
  /** First deposit (3rd activity banner) full detail */
  firstDeposit: `${IK}/20260801_210458.png?updatedAt=1785599210384`,
  /** App download / share gift code */
  appDownload: `${IK}/20260801_210458.png?updatedAt=1785599210384`,
  /** Creative video event */
  creativeVideo: `${IK}/20260801_211315.jpg?updatedAt=1785599210430`,
  /** Chicken Road full detail (inner page) */
  chickenRoad: `${IK}/20260801_205059.png?updatedAt=1785599210461`,
} as const;

export type ActivityPosterId = keyof typeof CDN_ACTIVITY_POSTERS;

/**
 * Home category rail icons (idle `icon_*` + active `click_*`).
 * Keys match `CategoryId` in home-catalog.
 */
export const CDN_CAT_ICONS = {
  lobby: {
    idle: `${IK}/icon_Lobby.png?updatedAt=1785593713858`,
    active: `${IK}/click_Lobby.png?updatedAt=1785593713537`,
  },
  popular: {
    idle: `${IK}/icon_Popular.png?updatedAt=1785593714622`,
    active: `${IK}/click_Popular.png?updatedAt=1785593713821`,
  },
  mini: {
    idle: `${IK}/icon_MiniGame.png?updatedAt=1785593714055`,
    active: `${IK}/click_MiniGame.png?updatedAt=1785593714186`,
  },
  /** Only click_* uploaded — use for both states */
  lottery: {
    idle: `${IK}/click_Lottery.png?updatedAt=1785593714150`,
    active: `${IK}/click_Lottery.png?updatedAt=1785593714150`,
  },
  /** Only click_* uploaded — use for both states */
  slots: {
    idle: `${IK}/click_Slots.png?updatedAt=1785593714494`,
    active: `${IK}/click_Slots.png?updatedAt=1785593714494`,
  },
  fishing: {
    idle: `${IK}/icon_Fishing.png?updatedAt=1785593714160`,
    active: `${IK}/click_Fishing.png?updatedAt=1785593714143`,
  },
  sports: {
    idle: `${IK}/icon_Sports.png?updatedAt=1785593714148`,
    active: `${IK}/click_Sports.png?updatedAt=1785593714590`,
  },
  casino: {
    idle: `${IK}/icon_Casino.png?updatedAt=1785593713836`,
    active: `${IK}/click_Casino.png?updatedAt=1785593714529`,
  },
} as const;

export type CdnCatIconId = keyof typeof CDN_CAT_ICONS;

/**
 * Home screen auto-swiping carousel order
 * (promo-first, then product features).
 */
export const HOME_CAROUSEL_BANNERS: string[] = [
  CDN_BANNER.recharge3,
  CDN_BANNER.firstDeposit,
  CDN_BANNER.invite,
  CDN_BANNER.lucky15,
  CDN_BANNER.luckySpin,
  CDN_BANNER.checkin,
  CDN_BANNER.appDownload,
  CDN_BANNER.creativeVideo,
];
