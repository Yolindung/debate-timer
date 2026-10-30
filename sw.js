const CACHE = 'debate-timer-pwa-v6';
const ROOT = new URL('./', self.location).href;
const VS = new URL('./assets/vs.webp', self.location).href;

async function cacheOne(cache, url) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, { cache: 'reload', signal: controller.signal });
      if (response && response.ok) {
        await cache.put(url, response);
        return true;
      }
    } catch (err) {
      /* Retry once below. */
    } finally {
      clearTimeout(timeout);
    }
    if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 900));
  }
  return false;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Only the page and the single external VS image are required for offline use.
    await cacheOne(cache, ROOT);
    await new Promise(resolve => setTimeout(resolve, 300));
    await cacheOne(cache, VS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(async () => (
          (await caches.match(request, { ignoreVary: true })) ||
          (await caches.match(ROOT, { ignoreVary: true })) ||
          (await caches.match(new URL('./index.html', self.location).href, { ignoreVary: true })) ||
          Response.error()
        ))
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreVary: true }).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      });
    })
  );
});
