# Frontend performance remediations (2026-07)

Summary of applied fixes after the full audit. Behavior of games (betting lock, period WS, result popups) preserved.

## P0 / P1 applied

| Area | Change |
|------|--------|
| `next.config.ts` | Restored standalone + rewrites + security headers + AVIF/WebP + long-cache assets + `optimizePackageImports` + optional CF/CDN `remotePatterns` |
| Fonts | Poppins 400/600/700/800 only; Roboto removed; zoom allowed (a11y) |
| Loading UX | `BrandSplash` full-screen auth gate + compact dynamic import fallback |
| Games | Once-per-endTime settle refresh; skip identical countdown state; chart lazy on Wingo; 12s backup poll; stable refs for WS/intervals |
| Admin set-result | 1s countdown (was 250ms) + once load at zero |
| Banner | Near-slide mount only + lazy non-LCP images |
| API | Concurrent GET dedupe (`inflightGet`) |
| CSS | Mobile/coarse: drop topnav blur; `prefers-reduced-motion`; marquee contain |

## Env (optional)

```bash
BACKEND_URL=http://localhost:3000
NEXT_PUBLIC_CF_IMAGES_HOST=imagedelivery.net   # optional
NEXT_PUBLIC_CDN_HOST=assets.example.com        # optional
```

See [CLOUDFLARE_IMAGES.md](./CLOUDFLARE_IMAGES.md).

## Expected impact

- **Fonts / LCP**: fewer weight downloads → faster first paint (High)
- **Game poll storm**: large drop in network + React work while locked at 0s (Critical → fixed)
- **Chart lazy**: less work on Wingo open until Chart tab (Medium)
- **GET dedupe**: less double-fetch under React Strict Mode / parallel mounts (Medium)
- **Banner**: less simultaneous image decode on low-end Android (Medium)
- **BrandSplash**: perceived quality only (no raw metric win)

## Left intentional

- Admin game manager still polls every 6s (operators need live liability).
- Games still use `ssr: false` (WebSocket + client clocks).
- Full chart/recharts stays client-only when opened.
