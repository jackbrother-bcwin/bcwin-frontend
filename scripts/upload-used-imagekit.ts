// @ts-nocheck — Bun-only one-off uploader
/**
 * Upload app-referenced /public/assets images to ImageKit, mirroring paths.
 *
 *   IMAGEKIT_PRIVATE_KEY=private_… bun run scripts/upload-used-imagekit.ts
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { basename, dirname, join } from "path";

const ROOT = join(import.meta.dir, "..");
const PUBLIC = join(ROOT, "public");
const ENDPOINT = "https://ik.imagekit.io/BCwin";
const PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY?.trim();

if (!PRIVATE_KEY) {
  console.error("IMAGEKIT_PRIVATE_KEY is required");
  process.exit(1);
}

const AUTH =
  "Basic " + Buffer.from(`${PRIVATE_KEY}:`).toString("base64");

const EXT = /\.(png|jpg|jpeg|webp|svg|gif|ico)$/i;
const SKIP_DIRS = new Set(["node_modules", "public", ".next"]);

function collectReferenced(): string[] {
  const found = new Set<string>();
  const pat =
    /['"`](\/assets\/[^'"`\s)]+\.(?:png|jpg|jpeg|webp|svg|gif|ico))['"`]/g;
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue;
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(ts|tsx|js|css)$/.test(name)) {
        const t = readFileSync(p, "utf8");
        for (const m of t.matchAll(pat)) found.add(m[1]!);
      }
    }
  };
  walk(join(ROOT, "app"));
  for (const extra of ["public/sw.js", "public/manifest.webmanifest"]) {
    const p = join(ROOT, extra);
    try {
      const t = readFileSync(p, "utf8");
      for (const m of t.matchAll(pat)) found.add(m[1]!);
    } catch {
      /* missing */
    }
  }
  for (let n = 1; n <= 10; n++) {
    found.add(`/assets/vip/vipbg${n}.png`);
    found.add(`/assets/vip/vip${n}logo.png`);
  }
  found.add("/assets/vip/vipking1.png");
  found.add("/assets/vip/vipking2.png");
  return [...found].filter((rel) => {
    if (rel.includes("${")) return false;
    try {
      return statSync(join(PUBLIC, rel.slice(1))).isFile();
    } catch {
      return false;
    }
  });
}

async function uploadOne(rel: string): Promise<{ ok: boolean; url?: string; err?: string }> {
  const abs = join(PUBLIC, rel.slice(1));
  const fileName = basename(rel);
  const folder = dirname(rel).replace(/\\/g, "/");
  const form = new FormData();
  form.append("file", Bun.file(abs));
  form.append("fileName", fileName);
  form.append("folder", folder);
  form.append("useUniqueFileName", "false");
  form.append("overwriteFile", "true");
  form.append("tags", "bcwin-used");

  const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    headers: { Authorization: AUTH },
    body: form,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* raw */
  }
  if (!res.ok) {
    return { ok: false, err: `${res.status} ${text.slice(0, 240)}` };
  }
  return { ok: true, url: json?.url || `${ENDPOINT}${rel}` };
}

const files = collectReferenced().sort();
console.log(`Uploading ${files.length} files to ${ENDPOINT} …`);

const CONCURRENCY = 4;
let ok = 0;
let fail = 0;
const errors: string[] = [];

for (let i = 0; i < files.length; i += CONCURRENCY) {
  const batch = files.slice(i, i + CONCURRENCY);
  const results = await Promise.all(batch.map((rel) => uploadOne(rel).then((r) => ({ rel, ...r }))));
  for (const r of results) {
    if (r.ok) {
      ok++;
      console.log(`ok  ${r.rel}`);
    } else {
      fail++;
      errors.push(`${r.rel}: ${r.err}`);
      console.log(`ERR ${r.rel}: ${r.err}`);
    }
  }
}

console.log(`done ok=${ok} fail=${fail}`);
if (errors.length) {
  process.exit(1);
}
