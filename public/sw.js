const CACHE_NAME = 'morslab-shell-v2.2.0';
const root = new URL('./', self.location.href).href;
const asset = (path) => new URL(path, root).href;
const APP_SHELL = ['./', './index.html', './fonts/manrope-variable.ttf', './manifest.webmanifest', './favicon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './licenses/MorsLab-LICENSE.txt', './licenses/MorsLab-NOTICE.txt', './licenses/Manrope-OFL.txt'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL.map(asset))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith('morslab-shell-') && name !== CACHE_NAME).map((name) => caches.delete(name)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(asset('./index.html'), copy)));
      }
      return response;
    }).catch(async () => (await caches.match(asset('./index.html'))) || (await caches.match(root)) || Response.error()));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
    }
    return response;
  })));
});