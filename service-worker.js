const CACHE = "grants-v1";
const STATIC = ["./icon-192.png", "./icon-512.png", "./manifest.json"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC))); self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const u = new URL(req.url);
  const networkFirst = req.mode === "navigate" || u.pathname.endsWith("/calls.json") || u.pathname.endsWith("index.html") || u.pathname.endsWith("/");
  if (networkFirst) {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return r; }).catch(() => caches.match(req).then((m) => m || caches.match("./"))));
  } else {
    e.respondWith(caches.match(req).then((m) => m || fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return r; })));
  }
});
