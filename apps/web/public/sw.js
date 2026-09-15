/* UPC AI service worker — minimal and safe by design.
   Responsibilities: push events, notification clicks, and a small
   versioned cache for static assets ONLY. API calls, chat SSE streams
   and pages are never cached (the chat requires the network). */

const CACHE = "upcai-static-v1";
const STATIC_PATTERNS = ["/_next/static/", "/icons/"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never cache API POSTs
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const cacheable = STATIC_PATTERNS.some((p) => url.pathname.startsWith(p));
  if (!cacheable) return; // everything else: plain network passthrough

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return hit || Response.error();
      }
    })(),
  );
});

/* ---- Push ---- */

self.addEventListener("push", (event) => {
  let payload = { title: "UPC AI", body: "New update available.", url: "/chat" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    /* non-JSON payload — keep defaults */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.url || "upcai",
      data: { url: payload.url || "/chat" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/chat";
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        const target = new URL(client.url);
        if (target.pathname === url || target.pathname.startsWith("/chat")) {
          await client.focus();
          if (target.pathname !== url) return client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
