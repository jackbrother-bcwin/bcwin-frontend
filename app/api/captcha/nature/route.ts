import { NextResponse } from "next/server";
import { asset } from "../../../lib/cdn";


export const dynamic = "force-dynamic";
export const revalidate = 0;

const NATURE_QUERIES = [
  "sunset ocean",
  "sunrise beach",
  "mountain sky",
  "forest lake",
  "seascape clouds",
  "nature landscape",
  "golden hour coast",
  "tropical ocean sunset",
  "alpine lake sunrise",
  "desert sky dusk",
  "waterfall forest",
  "northern lights sky",
] as const;

/** Local scenic fallbacks if remote APIs are unavailable */
const LOCAL_FALLBACKS = [
  asset("/assets/captcha/sunset_1.jpg"),
  asset("/assets/captcha/sunset_2.jpg"),
  asset("/assets/captcha/sunset_3.jpg"),
] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

type ScenePayload = {
  url: string;
  source: "unsplash" | "openverse" | "local";
  alt?: string;
};

async function fromUnsplash(): Promise<ScenePayload | null> {
  const key =
    process.env.UNSPLASH_ACCESS_KEY ||
    process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;
  if (!key) return null;

  const query = pick(NATURE_QUERIES);
  const res = await fetch(
    `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high`,
    {
      headers: {
        Authorization: `Client-ID ${key}`,
        "Accept-Version": "v1",
      },
      cache: "no-store",
    }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    urls?: { regular?: string; small?: string };
    alt_description?: string | null;
    description?: string | null;
  };
  const url = data.urls?.regular || data.urls?.small;
  if (!url) return null;
  return {
    url: `${url}${url.includes("?") ? "&" : "?"}w=800&h=400&fit=crop`,
    source: "unsplash",
    alt: data.alt_description || data.description || query,
  };
}

/** Openverse (Creative Commons) — free, no API key required */
async function fromOpenverse(): Promise<ScenePayload | null> {
  const query = pick(NATURE_QUERIES);
  const page = 1 + Math.floor(Math.random() * 12);
  const url =
    `https://api.openverse.org/v1/images/` +
    `?q=${encodeURIComponent(query)}` +
    `&page=${page}&page_size=12` +
    `&license=pdm,cc0,by,by-sa` +
    `&aspect_ratio=wide`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "BCWin-Captcha/1.0 (nature puzzle captcha)",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    results?: Array<{
      url?: string;
      thumbnail?: string;
      title?: string;
      foreign_landing_url?: string;
    }>;
  };
  const results = data.results?.filter((r) => r.url || r.thumbnail) ?? [];
  if (!results.length) return null;

  const item = pick(results);
  const imageUrl = item.url || item.thumbnail;
  if (!imageUrl) return null;

  return {
    url: imageUrl,
    source: "openverse",
    alt: item.title || query,
  };
}

function fromLocal(): ScenePayload {
  return {
    url: pick(LOCAL_FALLBACKS),
    source: "local",
    alt: "Nature landscape",
  };
}

export async function GET() {
  try {
    const unsplash = await fromUnsplash().catch(() => null);
    if (unsplash) {
      return NextResponse.json(unsplash, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const openverse = await fromOpenverse().catch(() => null);
    if (openverse) {
      return NextResponse.json(openverse, {
        headers: { "Cache-Control": "no-store" },
      });
    }
  } catch {
    // fall through to local
  }

  return NextResponse.json(fromLocal(), {
    headers: { "Cache-Control": "no-store" },
  });
}
