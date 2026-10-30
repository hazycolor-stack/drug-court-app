// Minimal service worker — caches the app shell so it opens reliably
// even on a flaky connection. Not a full offline data solution.
const CACHE_NAME = "dca-shell-v5";
const SHELL_FILES = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Only cache the app's own files. Account data, posts and photos from
  // Supabase must always come fresh from the network.
  if (new URL(event.request.url).origin !== self.location.origin) return;

  // Pages: always try the network first so everyone gets the newest version
  // right away. Fall back to the saved copy only when there's no signal.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", clone));
          }
          return response;
        })
        .catch(() => caches.match("/index.html").then((c) => c || caches.match("/")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// ---------- Push notifications (lock-screen alerts) ----------
// Fires even when the app is closed. The phone plays its normal
// notification sound unless it's on silent / Do Not Disturb.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || "Drug Court App";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/favicon-32.png",
      tag: data.tag,
      renotify: true,
      silent: false,
      vibrate: [200, 100, 200],
      data: { url: data.url || "/" },
    })
  );
});

// Tapping the alert opens the app (or brings it to the front)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          w.postMessage({ type: "open-tab", tab: new URL(url).searchParams.get("tab") });
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
