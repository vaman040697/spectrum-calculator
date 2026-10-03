const CACHE = "spectrum-calc-v4-functional";
const ASSETS = ["./", "./index.html", "./advanced.html", "./spectrum-calc-latest.html", "./math-ui.js", "./calc-engine.js", "./python-worker.js", "./offline-update.js", "./ui-fixes.css", "./favicon.svg", "./manifest.webmanifest"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("spectrum-calc-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  // Only intercept our app shell; remote Python assets retain their own network behavior.
  const asset = ASSETS.find(path => new URL(path, self.registration.scope).pathname === url.pathname);
  if (!asset) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    // Prefer saved application updates when online; the installed cache remains
    // the complete offline fallback. Never cache an error response.
    try {
      const fresh = await fetch(event.request);
      if (fresh.ok) return fresh;
    } catch {}
    const cached = await cache.match(asset);
    if (cached) return cached;
    return fetch(event.request);
  }));
});
