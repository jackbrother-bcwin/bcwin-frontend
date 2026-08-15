/**
 * ImageKit / CDN URL helper for BCWin.
 *
 * Delivery only — no SDK. Browser loads directly from ImageKit CDN.
 * When `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT` is unset, local `/public` paths are used.
 *
 * Usage:
 *   import { asset, cdnUrl, tr } from "./cdn";
 *
 *   // 1) Local path → auto CDN when env set, else same local path
 *   asset("/assets/banner/banner_1.jpg")
 *   asset("/assets/banner/banner_1.jpg", { w: 800, q: 80 })
 *
 *   // 2) Explicit ImageKit path (after you upload under a folder)
 *   cdnUrl("/bcwin/banner_1.jpg", { w: 800, q: 80 })
 *
 *   // 3) Override map — fill CDN_PATHS when you migrate a file
 *   //    local public path → ImageKit path (relative to urlEndpoint)
 */

/** ImageKit URL endpoint, e.g. https://ik.imagekit.io/your_id */
export function getImageKitEndpoint(): string | null {
  const ep = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT?.trim();
  if (!ep) return null;
  return ep.replace(/\/$/, "");
}

export function isCdnEnabled(): boolean {
  return !!getImageKitEndpoint();
}

/** Common ImageKit transform params (URL `tr=` query form) */
export type CdnTransform = {
  w?: number;
  h?: number;
  /** quality 1–100 */
  q?: number;
  /** crop mode e.g. "maintain_ratio", "at_max", "force" */
  c?: string;
  /** format: auto | webp | avif | jpg | png */
  f?: "auto" | "webp" | "avif" | "jpg" | "png";
  /** blur 0–100 */
  bl?: number;
  /** named transform from ImageKit dashboard */
  n?: string;
  /** raw extra tr segments, e.g. "rt-90" */
  raw?: string;
};

/**
 * Build ImageKit `tr=` string.
 * @see https://imagekit.io/docs/image-transformation
 */
export function tr(t: CdnTransform | string | undefined): string | undefined {
  if (!t) return undefined;
  if (typeof t === "string") return t || undefined;
  if (t.n) return `n-${t.n}`;
  const parts: string[] = [];
  if (t.w != null) parts.push(`w-${t.w}`);
  if (t.h != null) parts.push(`h-${t.h}`);
  if (t.q != null) parts.push(`q-${t.q}`);
  if (t.c) parts.push(`c-${t.c}`);
  if (t.f) parts.push(`f-${t.f}`);
  if (t.bl != null) parts.push(`bl-${t.bl}`);
  if (t.raw) parts.push(t.raw);
  return parts.length ? parts.join(",") : undefined;
}

function ensureLeadingSlash(path: string): string {
  if (!path) return "/";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Build a full ImageKit (or absolute) URL.
 * - Absolute http(s) URLs returned as-is (optional transform appended for ImageKit hosts).
 * - Relative paths prefixed with urlEndpoint when CDN is enabled.
 * - When CDN off, returns local path for `/public`.
 */
export function cdnUrl(
  path: string,
  transform?: CdnTransform | string
): string {
  const p = ensureLeadingSlash(path);
  const transformStr = tr(transform);

  // Already absolute
  if (p.startsWith("http://") || p.startsWith("https://")) {
    if (!transformStr) return p;
    const join = p.includes("?") ? "&" : "?";
    return `${p}${join}tr=${transformStr}`;
  }

  const endpoint = getImageKitEndpoint();
  if (!endpoint) {
    // Local public fallback — transforms ignored (Next/Image handles formats)
    return p;
  }

  const base = `${endpoint}${p}`;
  return transformStr ? `${base}?tr=${transformStr}` : base;
}

/**
 * Optional migration map: local public path → ImageKit media path.
 * Fill entries as you upload assets to ImageKit.
 *
 * Example:
 *   "/assets/banner/banner_1.jpg": "/bcwin/banners/banner_1.jpg",
 *   "/assets/png/avatar.png": "/bcwin/ui/avatar.png",
 */
export const CDN_PATHS: Record<string, string> = {
  // Home / activity promo creatives live as absolute URLs in banner-cdn.ts
  // (full ik.imagekit.io/BCwin/… paths). Map local legacy paths when needed:
  // "/assets/banner/banner_1.jpg": "/1000262418.jpg",
};

/**
 * Resolve an app asset path for `<Image src={...} />`.
 *
 * 1. If `CDN_PATHS[localPath]` exists → ImageKit path (preferred)
 * 2. Else if `mirrorLocal: true` and CDN on → same path under urlEndpoint
 * 3. Else → local `/public` path (default — safe while migrating)
 *
 * Default is **map-only** so unmapped assets stay local until you add them.
 * When every file is mirrored on ImageKit, pass `{ mirrorLocal: true }` or
 * set env `NEXT_PUBLIC_IMAGEKIT_MIRROR=1`.
 */
export function asset(
  localPath: string,
  transform?: CdnTransform | string,
  opts?: { mirrorLocal?: boolean }
): string {
  const key = ensureLeadingSlash(localPath);
  const mapped = CDN_PATHS[key];

  if (mapped) {
    return cdnUrl(mapped, transform);
  }

  const mirrorEnv = process.env.NEXT_PUBLIC_IMAGEKIT_MIRROR === "1";
  const mirror = opts?.mirrorLocal ?? mirrorEnv;

  if (!getImageKitEndpoint() || !mirror) {
    return key;
  }

  // Mirror: /assets/foo.png → {endpoint}/assets/foo.png
  return cdnUrl(key, transform);
}

/** Convenience presets for common UI sizes */
export const CDN_PRESETS = {
  thumb: { w: 96, h: 96, q: 80, c: "maintain_ratio" } satisfies CdnTransform,
  tile: { w: 200, h: 200, q: 80, c: "maintain_ratio" } satisfies CdnTransform,
  banner: { w: 800, q: 80, f: "auto" } satisfies CdnTransform,
  hero: { w: 1200, q: 85, f: "auto" } satisfies CdnTransform,
  avatar: { w: 128, h: 128, q: 85, c: "maintain_ratio" } satisfies CdnTransform,
} as const;

/**
 * Helper for backgrounds / CSS url(...) where next/image is not used.
 */
export function cssUrl(
  localPath: string,
  transform?: CdnTransform | string
): string {
  return `url(${asset(localPath, transform)})`;
}
