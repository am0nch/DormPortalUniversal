// DormPortalUniversal — Service Worker
// Bump CACHE_NAME after any deploy to force cache refresh on all devices
const CACHE_NAME = 'dormportal-v16';

// All files the app needs to work fully offline.
// Paths are relative to this SW file (repo root).
const PRECACHE = [
  './',
  './index.html',
  './dorm-db.js',
  './dorm-ui.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './modules/ra-portal.html',
  './modules/monitor-portal.html',
  './modules/attendance.html',
  './modules/incidents.html',
  './modules/room-inspection.html',
  './modules/key-inventory.html',
  './modules/room-reservations.html',
  './modules/student-profiles.html',
  './modules/student-admin.html',
  './modules/floor-plan.html',
  './modules/dorm-workers.html',
  './modules/staff-scheduling.html',
  './modules/inventory.html',
  './modules/utilities.html',
  './modules/plant-requests.html',
  './modules/reports.html',
  './modules/handbook.html',
  './modules/userguide.html',
];

// ── Install: precache all app shell files ─────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: delete old caches, claim all tabs immediately ──────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for app shell, network-first for everything else ───────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          // Cache new HTML and JS files on first visit
          if (response.ok && (url.pathname.endsWith('.html') || url.pathname.endsWith('.js') || url.pathname.endsWith('.png'))) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone)).catch(err => console.warn('SW cache write failed:', url.pathname, err.name));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback: return index.html for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
    })
  );
});
