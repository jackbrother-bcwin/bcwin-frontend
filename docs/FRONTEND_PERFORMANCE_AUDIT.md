# BCWin Frontend — Performance & Compatibility Audit

**Scope:** `frontend/` (Next.js 16 App Router, React 19, Tailwind v4)  
**Date:** 2026-07-16  
**Browsers:** Chrome, Safari, Firefox, Edge · Android Chrome, Samsung Internet, iOS Safari  

---

## Executive summary

The player app is a client-heavy SPA shell (`AppShell` + `next/dynamic`) with real-time game pages (WebSocket + polling). The largest risks were:

1. **Game poll storms** when countdown hit 0 (Critical) — **fixed**
2. **Dual font families / many weights** hurting LCP (High) — **fixed**
3. **Broken/minimal `next.config`** risking production API/images (Critical) — **fixed** (standalone kept)
4. **49MB static `/public` assets** without CDN (High) — **mitigated** via optional CF remotePatterns + docs
5. **Auth gate blank spinner** (Medium UX) — **fixed** with `BrandSplash`

Remaining medium items: large public asset set, `sharp` ignoreScripts, full CSR games, some admin re-fetch patterns.

---

## Priority ranking (all issues)

| Pri | ID | Issue | Impact | Status |
|-----|-----|-------|--------|--------|
| 1 | G1 | Game countdown @0s re-fired full API stack every second | **Critical** | **Fixed** |
| 2 | C1 | `next.config` missing rewrites/headers/images in bad states | **Critical** | **Fixed** |
| 3 | F1 | Poppins×6 + Roboto×4 font download | **High** | **Fixed** |
| 4 | A1 | `/public` ~49MB / 1800+ files, no CDN | **High** | Docs + remotePatterns |
| 5 | G2 | Chart history limit=100 on every Wingo open | **High** | **Fixed** (lazy) |
| 6 | R1 | Full-page re-render every 1s from countdown | **High** | Mitigated (skip equal state) |
| 7 | B1 | Banner mounts all 6 images | **Medium** | **Fixed** (near-slide) |
| 8 | N1 | Duplicate concurrent GETs | **Medium** | **Fixed** (dedupe) |
| 9 | CSS1 | `backdrop-filter` on mobile chrome | **Medium** | **Fixed** (disable ≤479px) |
| 10 | A11Y1 | `userScalable: false` / maxScale 1 | **Medium** | **Fixed** |
| 11 | ADM1 | Admin countdown 250ms + load every tick at 0 | **Medium** | **Fixed** (1s + once) |
| 12 | UX1 | Bare spinner on auth bootstrap | **Medium** | **Fixed** BrandSplash |
| 13 | S1 | `ignoreScripts: sharp` weakens image pipeline | **Medium** | Open |
| 14 | G3 | Games `ssr: false` (blank until JS) | **Medium** | Intentional |
| 15 | WS1 | WS reconnect + multi-subscribe on tab change | **Low–Med** | Open |
| 16 | CSS2 | Large globals + animation keys always shipped | **Low** | Partial (reduced-motion) |
| 17 | SEC1 | `robots: noindex` ok; no CSP header | **Low** | Open |
| 18 | MEM1 | Moto race timers (now cleaned via ref) | **Low** | **Fixed** |

---

## Detailed findings (by audit objective)

### 1–4. Slow loads, lag, low-end, DPI, slow network

| Issue | Why | Devices | Impact | Location | Fix |
|-------|-----|---------|--------|----------|-----|
| Font overload | Many google-font weights block/compete with LCP | All, worse 3G | High | `app/layout.tsx` | Use 4 weights only — **done** |
| Huge static assets | 49MB public never leaves device download path | Mobile, slow net | High | `public/assets` | CDN/CF Images — see docs |
| Banner decode | 6 full-size banners in DOM | Low-end Android | Med | `BannerCarousel.tsx` | Near-slide only — **done** |
| Game network storm | At countdown 0, interval re-called load×N/s | All game devices | Critical | Wingo/K3/5D/Moto | Once-per-endTime — **done** |

### 5. Hydration / SSR / CSR

| Issue | Why | Impact | Location | Notes |
|-------|-----|--------|----------|-------|
| Games `ssr: false` | Avoids clock/WS hydration mismatch | Med | `AppShell.tsx` | Intentional; use BrandSplash loading |
| `suppressHydrationWarning` on `<html>` | Common for theme/extensions | Low | `layout.tsx` | OK |
| Client-only shell | Entire player UX is CSR after shell | Med | `AppShell` | Home is static import (good for LCP) |

### 6. React re-renders / memo

| Issue | Why | Impact | Location | Fix |
|-------|-----|--------|----------|-----|
| Countdown state every second | Re-renders entire game tree | High | Game pages | Skip if second unchanged — **done** |
| `useAuth()` pulls user+actions | Balance tick re-renders consumers | Med | Many pages | Prefer `useAuthState` / `useAuthActions` (already split) |
| Chart compute on load | Extra work | Med | Wingo chart | Lazy load chart data — **done** |

### 7. Bundles / lazy load / deps

| Issue | Why | Impact | Fix |
|-------|-----|--------|-----|
| `recharts` in admin | Heavy | Med if admin on weak device | `optimizePackageImports` includes recharts — **done** |
| `react-icons` | Tree-shake risk if barrel imports | Med | optimizePackageImports — **done** |
| Dynamic imports for games/wallet | Good | — | Already in AppShell |
| Deps lean | Only next/react/icons/recharts | Low risk of dup packages | Good |

### 8. Images / fonts / video / cache

| Issue | Why | Impact | Status |
|-------|-----|--------|--------|
| AVIF/WebP formats | Smaller bytes | High | next.config images.formats — **done** |
| Asset cache headers | Repeat visits | High | `/assets`, `/gamecategory` max-age 1y — **done** |
| No video found in player shell | — | — | N/A |
| CF Images optional | Edge delivery | High when enabled | docs + env |

### 9. Core Web Vitals (CLS / LCP / INP)

| Metric | Risk | Mitigation |
|--------|------|------------|
| **LCP** | Banner/logo/fonts | Slim fonts, priority first banner, BrandSplash uses logo |
| **CLS** | Banner fixed height 160px | Good; keep aspect reserved |
| **INP** | Bet buttons during 1s re-renders | Fewer state updates when second unchanged |

### 10. Animations

| Issue | Devices | Impact | Fix |
|-------|---------|--------|-----|
| Marquee continuous | Low-end | Med | `will-change` + contain + reduced-motion |
| Moto race CSS animations | Mobile GPU | Med | Prefer reduced-motion off |
| backdrop-blur nav | Android GPU | Med | Disabled on small/coarse — **done** |

### 11. Responsive / orientation

| Item | Notes |
|------|-------|
| Full-bleed mobile shell | `#110D14`, `max-w` only ≥480px — good for iPhone gutters |
| `viewportFit: cover` | Notch safe |
| `min-h-dvh` | Better iOS Safari than `100vh` alone |
| Landscape | Games are vertical-first; acceptable for casino UX |

### 12. CSS

| Issue | Impact | Status |
|-------|--------|--------|
| Tailwind v4 `@theme` tokens | Good | — |
| Unused utilities purged by TW | Good | — |
| Heavy blur | Med | Mobile off |

### 13. Leaks (listeners / timers / observers)

| Issue | Impact | Status |
|-------|--------|--------|
| Game intervals cleaned on unmount | — | Yes |
| Moto race timers | Was local var risk | Now `raceTimerRef` + cleanup — **done** |
| WS unsub on unmount | — | Yes via subscribe returns |
| Banner autoplay interval | — | Cleaned |

### 14. Network

| Issue | Impact | Status |
|-------|--------|--------|
| Period + results + bets + chart stack | High | Chart lazy; settle once |
| 8s full poll + 1s storm | High | 12s backup; once-zero |
| GET dedupe | Med | **done** |
| No HTTP cache on API | Intentional (auth/live) | OK |

### 15. Accessibility

| Issue | Impact | Status |
|-------|--------|--------|
| Zoom disabled | High a11y | **Fixed** |
| BrandSplash `role=status` | Good | **done** |
| Contrast gold-on-dark | Generally OK | Monitor WCAG for small text |

### 16–18. Browser APIs / Safari / crashes

| Issue | Safari/iOS | Impact | Notes |
|-------|------------|--------|-------|
| `100dvh` / `env(safe-area-*)` | Needs modern iOS | Low | Fallback `min-h-screen` present |
| WebSocket | All modern | Med | Reconnect logic in `ws.ts` |
| `credentials: "include"` cookies | Safari ITP | Med | Same-origin rewrite helps |
| No `localStorage` hard dep in critical path | — | Low | Safer for private mode |

### 19. Build config

Restored production config:

- `output: "standalone"`
- API rewrites `/api/v1/*` → `BACKEND_URL`
- Security headers + asset cache
- `images.formats` AVIF/WebP, quality allowlist
- `optimizePackageImports`
- Optional CF/CDN hosts

### 20. Security / production side effects

| Issue | Impact | Notes |
|-------|--------|-------|
| No CSP | Low–Med | Add carefully (inline styles used) |
| `poweredByHeader: false` | Low | Done |
| X-Frame-Options DENY | Good | Done |
| Cookie auth over rewrite | Good for mobile Safari third-party cookie issues | — |

---

## Fixes applied this pass (code map)

| File | Change |
|------|--------|
| `next.config.ts` | Blended standalone + rewrites/headers/images/CF |
| `app/layout.tsx` | Poppins 4 weights; zoom allowed |
| `app/globals.css` | Font stack; mobile blur off; reduced-motion |
| `app/components/ui/BrandSplash.tsx` | New branded splash |
| `app/components/AppShell.tsx` | BrandSplash for auth + dynamic fallback |
| `app/loading.tsx` | Branded route loading |
| `app/lib/game-refresh.ts` | Once-per-key + setCountdownIfChanged |
| `app/components/WingoPage.tsx` | Poll isolation, lazy chart, stable refs |
| `app/components/K3Page.tsx` | Same settle/poll pattern |
| `app/components/FiveDPage.tsx` | Same |
| `app/components/MotoPage.tsx` | Same + race timer ref cleanup |
| `app/components/BannerCarousel.tsx` | Near-slide + lazy |
| `app/lib/api.ts` | Concurrent GET dedupe |
| `app/admin/.../games/[game]/page.tsx` | 1s countdown, once at zero |
| `docs/CLOUDFLARE_IMAGES.md` | CF setup |
| `docs/PERFORMANCE_NOTES.md` | Ops summary |

---

## Estimated overall improvement (after applied fixes)

| Area | Estimate |
|------|----------|
| Game page main-thread while “locked” | **60–90% less** redundant work/network |
| Font transfer / LCP text | **~40–60% less** font bytes |
| Wingo first open (no chart) | **1 fewer large results request** (limit 100) |
| Home banner decode | **~50% fewer** simultaneous images |
| Auth perceived load | UX only (branded splash) |
| **Overall player UX score (lab)** | **~25–40%** better on mid/low Android if CF Images also used for banners |

### Still recommended (not blocking)

1. Enable Cloudflare CDN for `/assets` or migrate banners to CF Images.
2. Allow `sharp` install in CI/production for Next Image optimization (remove from `ignoreScripts` in deploy images).
3. Optionally extract countdown digit UI into a memoized child to cut React reconciliation further.
4. Add lightweight CSP + `Report-Only` first.
5. Compress/dedupe unused PNGs under `public` (audit unused gamecategory art).

---

## Corrected patterns (reference)

### Once-per-endTime settle (games)

```ts
// app/lib/game-refresh.ts
const once = createOncePerKey();
// in 1s interval:
if (left <= 0) once.run(endTime, refreshAfterSettle);
// when new period endTime arrives:
if (nextEnd !== endRef.current) once.clear();
```

### GET dedupe

```ts
// concurrent identical GETs without AbortSignal share one Promise
```

### Brand splash gate

```tsx
if (isLoading) return <BrandSplash label="Starting BCWin…" />;
```
