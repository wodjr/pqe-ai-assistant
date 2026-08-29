/**
 * public/sw.js — PQE AI Assistant Service Worker
 *
 * Caches the app shell for offline use.
 * All API routes (/api/*) are always fetched from the network.
 * IndexedDB data is already available offline — no additional sync needed.
 */

const CACHE_NAME = "pqe-ai-assistant-v1";

const APP_SHELL = [
  "/",
  "/audits",
  "/checklists",
  "/findings",
  "/cars",
  "/suppliers",
  "/manufacturing",
  "/settings",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Always network-first for API routes
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  // Cache-first for everything else (app shell + static assets)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && request.method === "GET") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
