const CACHE_NAME = 'panel-pwa-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/styles.css',
  '/assets/images/tamagotchi.gif',
  '/assets/avatars/avatar1.jpg',
  '/assets/avatars/avatar2.jpg',
  '/assets/avatars/avatar3.jpg',
  '/assets/avatars/avatar4.jpg',
  '/apps/app1/index.html',
  '/apps/app2/index.html',
  '/apps/app2/sw.js',
  'apps/app2/manifest.json",
  'apps/app2/assets/js/app_ventas.js'
  
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
