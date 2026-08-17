/** Public site hosts (same six as /verifybcwinclub). */
export const OFFICIAL_WEB_HOSTS = [
  "bcwin.club",
  "bcwin7.site",
  "bcwin7.live",
  "bcwin.click",
  "bcwin7.xyz",
  "bcwin.best",
] as const;

export function isOfficialWebHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  return (OFFICIAL_WEB_HOSTS as readonly string[]).includes(h);
}

/** API origin for live game socket (Next on the site host cannot upgrade WS). */
export const OFFICIAL_WS_URL = "wss://api.bcwin.club/api/v1/ws";
