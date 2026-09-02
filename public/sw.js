// Minimal service worker: caches the app shell so it opens fast and stays
// installable. API responses are always fetched fresh (never cached).
const CACHE = 'scored-shell-v1';
const SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return; // never cache API
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});
