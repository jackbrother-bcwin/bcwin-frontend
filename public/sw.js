/* BCWin PWA — production-safe service worker.
 * NEVER cache HTML or Next.js chunks (that broke scrolling/loading).
 * Only static public assets; navigations always hit network.
 */
const CACHE = "bcwin-static-v3";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache
        .addAll(["/manifest.webmanifest", "/assets/png/bcwin.png", "/favicon.ico"])
        .catch(() => undefined)
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Pass through: API, Next runtime, admin
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/greebuserrichadmin")
  ) {
    return;
  }

  // Documents / navigations: always network (never cache-first HTML)
  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith(
      fetch(req).catch(
        () =>
          new Response(
            "<!doctype html><meta charset=utf-8><title>Offline</title><body style='margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#110D14;color:#FDE4BC;font-family:system-ui'><p>Offline — reconnect and refresh.</p></body>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
          )
      )
    );
    return;
  }

  const isStatic =
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/gamecategory/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/favicon.ico";

  if (!isStatic) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone()).catch(() => undefined);
        return res;
      } catch {
        const hit = await cache.match(req);
        return hit || Response.error();
      }
    })
  );
});
