/* rr888bd service worker.
 *
 * Deliberately minimal. Chrome will only offer "Install app" for a site whose
 * service worker handles fetch, so that is what this does — and no more:
 *
 *   - page loads always go to the network first, and only fall back to a
 *     cached copy when the device is offline;
 *   - scripts, styles and images are never cached here, so a deploy can never
 *     leave a player running yesterday's JavaScript against today's API.
 *
 * Bump CACHE when this file changes; older caches are dropped on activate.
 */

const CACHE = 'rr888bd-shell-v2';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)).catch(() => undefined),
  );
  // a new worker should take over rather than wait for every tab to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only page navigations. Everything else — assets, API calls, Supabase —
  // goes straight to the network untouched.
  if (request.method !== 'GET' || request.mode !== 'navigate') return;

  event.respondWith(
    // The offline page is cached once, at install, and never overwritten.
    // Storing every page under its name used to keep whatever came last —
    // a 500, or an admin screen with other players on it — and replay it
    // offline with script files a deploy had since removed: a blank screen.
    fetch(request)
      .catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return (
          cached ??
          new Response('<h1>Offline</h1><p>No internet connection.</p>', {
            status: 503,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          })
        );
      }),
  );
});
