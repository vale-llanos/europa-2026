const CACHE = 'europa-2026-v1';
const ASSETS = ['./','./index.html','./icon.svg','./manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Always network: Supabase data, CDNs, geocoding
  if (url.includes('supabase') || url.includes('cdn.jsdelivr') ||
      url.includes('unpkg.com') || url.includes('nominatim') ||
      url.includes('cartocdn') || url.includes('openstreetmap')) return;

  // Network-first for HTML page navigation — always gets latest code when online
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          if (resp.ok) caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
          return resp;
        })
        .catch(() => caches.match(e.request)) // offline fallback
    );
    return;
  }

  // Cache-first for other static assets (icons, manifests)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok && e.request.method === 'GET') {
          caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        }
        return resp;
      });
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const open = list.find(c => c.url.includes('europa-2026') && 'focus' in c);
      if (open) return open.focus();
      return clients.openWindow('./');
    })
  );
});
