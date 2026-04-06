/* global Response, URL, caches, fetch, self */

const CACHE_VERSION = 'v2';
const APP_SHELL_CACHE = `hub-os-app-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `hub-os-static-${CACHE_VERSION}`;
const API_CACHE = `hub-os-api-${CACHE_VERSION}`;
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => ![APP_SHELL_CACHE, STATIC_CACHE, API_CACHE].includes(key))
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

const cacheFirst = async (request, cacheName, event) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    event.waitUntil(cache.put(request, response.clone()));
  }
  return response;
};

const networkFirst = async (request, cacheName, event) => {
  const cache = await caches.open(cacheName);
  const authorizationHeader = request.headers.get('Authorization');
  const allowCacheWrite = !authorizationHeader || !authorizationHeader.trim();
  try {
    const response = await fetch(request);
    if (response.ok && allowCacheWrite) {
      event.waitUntil(cache.put(request, response.clone()));
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw new Error('Network request failed.');
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE, event));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        const cached = await caches.match('/');
        if (cached) {
          return cached;
        }
        const indexShell = await caches.match('/index.html');
        if (indexShell) {
          return indexShell;
        }
        return new Response('Offline - app shell unavailable', {
          status: 503,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
          },
        });
      }
    })());
    return;
  }

  if (
    requestUrl.pathname.startsWith('/assets/')
    || ['style', 'script', 'worker', 'font'].includes(request.destination)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, event));
  }
});
