// Service worker: l'app si apre anche senza rete e si aggiorna da sola in sottofondo.
const CACHE = 'casa-v1.21.0';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/app.js', 'js/precarica.js', 'js/gestures.js', 'js/mappa.js', 'js/notifiche.js', 'js/spotify.js', 'js/core.js', 'js/store.js', 'js/config.js', 'js/utils.js', 'js/icons.js', 'js/data.js', 'js/seed.js', 'js/season.js',
  'js/views/home.js', 'js/views/zone.js', 'js/views/cibo.js', 'js/views/svago.js', 'js/views/viaggi.js', 'js/views/spesa.js', 'js/views/casa.js', 'js/views/ricette.js', 'js/views/film.js',
  'js/views/musica.js', 'js/views/spotify.js', 'js/views/desideri.js', 'js/views/gatti.js', 'js/views/dove.js', 'js/vendor/maplibre/maplibre-gl.js', 'js/vendor/maplibre/maplibre-gl.css', 'js/views/impostazioni.js', 'js/views/login.js',
  'assets/icons/icon.svg', 'assets/icons/icon-192.png', 'assets/icons/apple-touch-icon.png',
  'assets/fonts/manrope-latin.woff2', 'assets/fonts/fraunces-latin.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Stale-while-revalidate per i file del sito; dati (api/), mappe, copertine, Spotify… vanno diretti in rete.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return; // i dati condivisi vanno sempre chiesti al server
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })
  );
});

// ---------------------------------------------------------------------------
// Notifiche: arrivano dal server (api/_push.js) anche ad app chiusa
// ---------------------------------------------------------------------------
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Fam. Comperotto', {
    body: d.body || '',
    tag: d.tag || undefined,
    icon: 'assets/icons/icon-192.png',
    badge: 'assets/icons/icon-192.png',
    data: { url: d.url || '' },
  }));
});

// tocco sulla notifica: apre l'app alla pagina giusta (o la porta davanti se è già aperta)
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const vai = (e.notification.data && e.notification.data.url) || '';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((aperte) => {
    const c = aperte.find((x) => 'focus' in x);
    if (c) { c.postMessage({ vai }); return c.focus(); }
    return self.clients.openWindow(new URL(`./${vai}`, self.registration.scope).href);
  }));
});
