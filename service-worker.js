const CACHE_NAME = "anjwa-career-shell-v1.04.01";
const DATA_CACHE_NAME = "anjwa-career-data-v1";
const OFFLINE_URL = "./index.html";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./curriculum-data.js",
  "./subject-guide-data.js",
  "./recommendation-data.js",
  "./university-recommendation-data.js",
  "./course-designer-data.js",
  "./topic-data.js",
  "./site-meta.js",
  "./pwa-install.css",
  "./pwa-install.js",
  "./manifest.webmanifest",
  "./icons/app-icon-192.png",
  "./icons/app-icon-512.png",
  "./icons/app-icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("anjwa-career-") && ![CACHE_NAME, DATA_CACHE_NAME].includes(key))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function putIfUsable(cacheName, request, response) {
  if (!response || !response.ok) return;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  } catch (error) {
    console.warn("캐시 저장 생략", error);
  }
}

async function networkFirst(request, cacheName, fallbackUrl) {
  try {
    const response = await fetch(request);
    await putIfUsable(cacheName, request, response);
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl, { ignoreSearch: true });
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  const update = fetch(request)
    .then(async (response) => {
      await putIfUsable(CACHE_NAME, request, response);
      return response;
    })
    .catch(() => null);
  const response = cached || await update;
  return response || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, CACHE_NAME, OFFLINE_URL));
    return;
  }

  if (url.pathname.includes("/admission-data/")) {
    event.respondWith(networkFirst(request, DATA_CACHE_NAME));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
