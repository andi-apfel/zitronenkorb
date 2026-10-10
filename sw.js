// Offline-Speicher: Die App lädt auch ohne Netz (z. B. im Keller vom Supermarkt).
// Eigene Dateien: zuerst aus dem Netz (damit Updates sofort ankommen), sonst aus dem Speicher.
const CACHE = 'zitronenkorb-v9';
const CORE = ['./', './index.html', './app.css', './app.js', './recipes.js', './catalog.js', './import.js', './voice.js', './seed.js', './config.js', './icon-180.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        // immer beim Server nachfragen (kein HTTP-Zwischenspeicher), damit Updates sofort ankommen
        const fresh = req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req, { cache: 'no-cache' });
        const res = await Promise.race([fresh, timeout(4000)]);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') { const idx = await cache.match('./index.html'); if (idx) return idx; }
        throw err;
      }
    })());
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      cache.put(req, res.clone());
      return res;
    }));
  }
  // Supabase (Abgleich) läuft nie über den Speicher.
});
