// Service worker: l'app si apre anche senza rete e si aggiorna da sola in sottofondo.
const CACHE = 'casa-v1.4.0';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/app.js', 'js/core.js', 'js/store.js', 'js/config.js', 'js/utils.js', 'js/icons.js', 'js/data.js', 'js/seed.js', 'js/season.js',
  'js/views/home.js', 'js/views/spesa.js', 'js/views/casa.js', 'js/views/ricette.js', 'js/views/film.js',
  'js/views/musica.js', 'js/views/desideri.js', 'js/views/gatti.js', 'js/views/impostazioni.js', 'js/views/login.js',
  'assets/icons/icon.svg', 'assets/icons/icon-192.png', 'assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Stale-while-revalidate per i file del sito e i font; dati (api/), TMDB, Spotify… vanno diretti in rete.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const own = url.origin === self.location.origin;
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!own && !fonts) return;
  if (own && url.pathname.includes('/api/')) return; // i dati condivisi vanno sempre chiesti al server
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: own });
      const net = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })
  );
});
