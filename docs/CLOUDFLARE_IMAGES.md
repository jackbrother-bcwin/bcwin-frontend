# Cloudflare Images / CDN (BCWin frontend)

Optional image CDN setup. Local `/public` assets always work without any env.

## Why

- Faster LCP on slow networks (edge cache, WebP/AVIF)
- Less origin bandwidth for banners, game art, avatars
- Works with Next.js `<Image>` via `remotePatterns`

## Env vars

| Variable | Example | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_CF_IMAGES_HOST` | `imagedelivery.net` | Cloudflare Images delivery host |
| `NEXT_PUBLIC_CDN_HOST` | `assets.bcwin.example.com` | Custom CDN / R2 public host |
| `BACKEND_URL` | `http://backend:3000` | API rewrite target (existing) |

Both image hosts are optional. When set, `next.config.ts` adds matching `images.remotePatterns`.

## Cloudflare Images quick path

1. Create a Cloudflare Images account / zone.
2. Upload variants (e.g. `public`, `banner`, `thumb`).
3. Delivery URL shape:  
   `https://imagedelivery.net/<account_hash>/<image_id>/<variant>`
4. Set:
   ```bash
   NEXT_PUBLIC_CF_IMAGES_HOST=imagedelivery.net
   ```
5. In components, use full HTTPS URLs in `next/image` `src` (or a small helper that prefixes the CDN).

## Cloudflare R2 / custom domain

1. Bucket public access or custom domain (`assets.bcwin.example.com`).
2. Set:
   ```bash
   NEXT_PUBLIC_CDN_HOST=assets.bcwin.example.com
   ```
3. Point static marketing assets (banners) there; keep critical UI icons in `/public` for offline-first shell.

## Caching already in Next

`next.config.ts` sets long-cache headers for:

- `/assets/*`
- `/gamecategory/*`

Pair with Cloudflare **Cache Everything** or static asset rules for those paths when fronted by CF.

## Recommended Next Image usage

```tsx
import Image from "next/image";

// Local (always works)
<Image src="/assets/png/bcwin.png" alt="BCWin" width={160} height={48} priority />

// CDN (requires remotePatterns env)
<Image
  src={`https://${process.env.NEXT_PUBLIC_CDN_HOST}/banners/home-1.webp`}
  alt=""
  fill
  sizes="(max-width: 480px) 100vw, 430px"
  quality={75}
/>
```

## Security

- Do not enable `dangerouslyAllowSVG: true` for remote user content.
- Prefer CF Image Transformations over serving arbitrary third-party URLs.
- Keep `auth-token` cookie SameSite; never put tokens in image query strings.
