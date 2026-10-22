// Slakoth Line Binder offline support.
// The page itself: network first (so updates show up), cached copy when offline.
// Scripts, fonts and card images: cached copy first, refreshed in the background.
const VERSION = 'slk-line-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './favicon.png'];
const LIBS = [
  'https://cdn.tailwindcss.com/3.4.17',
  'https://unpkg.com/lucide@0.344.0/dist/umd/lucide.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
    await Promise.all(LIBS.map(async url => {
      try { const res = await fetch(url, { mode: 'no-cors' }); await cache.put(url, res); } catch (e) {}
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('slk-line-') && k !== VERSION).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put('./index.html', res.clone());
        return res;
      } catch (e) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Everything else: cache first, then network (and store what comes back)
  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreVary: true }) || await caches.match(req.url, { ignoreVary: true });
    const network = fetch(req).then(async res => {
      if (res && (res.ok || res.type === 'opaque')) {
        const cache = await caches.open(url.origin === location.origin ? VERSION : 'slk-line-media');
        cache.put(req, res.clone());
      }
      return res;
    }).catch(() => null);
    if (cached) { event.waitUntil(network); return cached; }
    return (await network) || Response.error();
  })());
});
