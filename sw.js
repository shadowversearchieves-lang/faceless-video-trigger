// Simple app-shell cache. API calls (api.github.com) always go to the network.
const CACHE = "vt-shell-v3";
const SHELL = [
  ".", "index.html", "styles.css", "app.js",
  "manifest.webmanifest", "icon-192.png", "icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.hostname === "api.github.com") return; // never cache API
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request))
  );
});
