# ImageKit CDN (BCWin frontend)

Lightweight delivery helper — **no ImageKit SDK**. Browser loads images straight from ImageKit.

## Setup

1. Create an ImageKit account and copy your **URL endpoint**  
   (e.g. `https://ik.imagekit.io/your_id`).

2. In `frontend/.env.local` (or deploy env):

```bash
NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id
```

3. Restart Next (`npm run dev` / rebuild).

`next.config.ts` already allows `ik.imagekit.io` for `next/image`.

## Usage

```tsx
import Image from "next/image";
import { asset, cdnUrl, CDN_PRESETS } from "../lib/cdn";

// A) Prefer this — works local + CDN
<Image
  src={asset("/assets/banner/banner_1.jpg", CDN_PRESETS.banner)}
  width={800}
  height={300}
  alt="Banner"
/>

// B) Explicit ImageKit media path after upload
<Image
  src={cdnUrl("/bcwin/banners/hero.jpg", { w: 800, q: 80 })}
  width={800}
  height={300}
  alt="Hero"
/>
```

### API

| Helper | Purpose |
|--------|---------|
| `asset(localPath, transform?)` | Resolve `/public` path → CDN when configured |
| `cdnUrl(path, transform?)` | Always build against endpoint (or pass-through absolute URLs) |
| `tr({ w, h, q, f, ... })` | Build ImageKit `tr=` string |
| `CDN_PRESETS` | `thumb` / `tile` / `banner` / `hero` / `avatar` |
| `CDN_PATHS` | Map local path → different ImageKit path when names differ |
| `isCdnEnabled()` | Whether endpoint env is set |

## Migrating assets

### Option 1 — Mirror folders (fastest)

Upload so ImageKit layout matches `/public`:

```
/public/assets/banner/x.jpg  →  {endpoint}/assets/banner/x.jpg
```

Then `asset("/assets/banner/x.jpg")` works with **no map entry** when CDN is on.

### Option 2 — Explicit map

Edit `CDN_PATHS` in `app/lib/cdn.ts`:

```ts
export const CDN_PATHS: Record<string, string> = {
  "/assets/banner/banner_1.jpg": "/bcwin/marketing/banner_1.jpg",
};
```

### Gradual roll-out

1. Leave `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT` **unset** in dev → always local.
2. Set endpoint + fill `CDN_PATHS` for files you uploaded (only those hit CDN).
3. When the whole `/public` tree is mirrored on ImageKit, set:
   ```bash
   NEXT_PUBLIC_IMAGEKIT_MIRROR=1
   ```
   so every `asset("/assets/...")` resolves on CDN without a map entry.
4. Per-call override:
   ```ts
   asset("/assets/banner/banner_1.jpg", CDN_PRESETS.banner, { mirrorLocal: true })
   ```

## Transforms (ImageKit `tr`)

Examples:

| Goal | Transform |
|------|-----------|
| Width 800, quality 80 | `{ w: 800, q: 80 }` |
| Square thumb | `{ w: 96, h: 96, c: "maintain_ratio" }` |
| Auto format | `{ f: "auto", q: 80 }` |

See [ImageKit transformations](https://imagekit.io/docs/image-transformation).

## Not in this helper

- Uploads (use ImageKit dashboard or add a signed upload API later)
- Private files / signed URLs
- Fetching blobs through the Next server (avoid — use CDN URLs directly)

## Env reference

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT` | `https://ik.imagekit.io/abc123` |
