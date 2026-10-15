/* My Games service worker — offline shell + cache-as-you-go for visited games. */
const BUILD = "20261015ad";
const CACHE = `mygames-v2-${BUILD}`;

const PRECACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./site.webmanifest",
  "./site-config.js",
  "./latest-changelog.js",
  "./icon.png",
  "./apple-touch-icon.png",
  "./hub-net.js",
  "./hub-afk.js",
  "./hub-game-boot.js",
  "./hub-supabase.js",
  "./hub-plays.js",
  "./hub-streak.js",
  "./hub-achievements.js",
  "./hub-sound.js",
  "./hub-audio.js",
  "./hub-confetti.js",
  "./hub-account-bag.js",
  "./script.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((p) => new Request(p, { cache: "reload" }))))
      .catch(async (error) => {
        await caches.delete(CACHE);
        throw error;
      })
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("mygames-") && k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function sameOrigin(url) {
  try {
    return new URL(url, self.location.href).origin === self.location.origin;
  } catch {
    return false;
  }
}

function isNavigate(request) {
  return request.mode === "navigate" || (request.destination === "document");
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      try {
        cache.put(request, fresh.clone());
      } catch {}
    }
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const fallback = await cache.match("./index.html");
    if (fallback) return fallback;
    throw new Error("offline");
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) {
    fetch(request)
      .then((fresh) => {
        if (fresh && fresh.ok) cache.put(request, fresh.clone());
      })
      .catch(() => {});
    return cached;
  }
  const fresh = await fetch(request);
  if (fresh && fresh.ok) {
    try {
      cache.put(request, fresh.clone());
    } catch {}
  }
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (!sameOrigin(request.url)) return;
  // Never cache API-ish JSON posts; GET to cloud hosts is cross-origin anyway.
  if (isNavigate(request)) {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});
