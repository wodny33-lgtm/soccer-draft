const CACHE = 'draft-fussball';
const DATEIEN = [
  './', 'index.html', 'css/style.css', 'manifest.json',
  'icons/icon-192.png', 'icons/icon-512.png',
  'js/app.js', 'js/rng.js', 'js/formationen.js', 'js/team.js', 'js/draft.js',
  'js/sim.js', 'js/saison.js', 'js/code.js', 'js/speicher.js', 'js/spieler-daten.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN.map((d) => new Request(d, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// Erst das Netz fragen (immer die neueste Version), ohne Netz aus dem Cache (Offline-Betrieb).
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        const r = await fetch(e.request, { cache: 'no-cache' });
        if (r.ok) cache.put(e.request, r.clone());
        return r;
      } catch {
        const treffer = await cache.match(e.request);
        if (treffer) return treffer;
        throw new Error('offline');
      }
    }),
  );
});
