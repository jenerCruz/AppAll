const CACHE_NAME = 'pmc-oaxaca-v4'; // Incrementa la versión si cambias los activos
const FILES_TO_CACHE = [
  './', // index.html o la raíz si aplica
  // Estructura Principal de la PWA
  './app_principal.html',
  './manifest.json',
  
  // Assets Compartidos
  './assets/js/tailwind.min.css',
  './assets/js/lucide.min.js',
  './assets/js/chart.umd.js',
  
  // App Asistencias (app1)
  './app1.html',
  './app1.js',
  
  // App Ventas (app2)
  './app2.html',
  './app2.js',
  
  // Fallbacks o iconos si los usáramos
  // './assets/icons/icon-512x512.png', 
];

// Instalación del Service Worker: Cacha los archivos esenciales
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Pre-caching archivos estáticos.');
        return cache.addAll(FILES_TO_CACHE);
      })
      .catch(err => {
        console.error('[ServiceWorker] Falló el pre-caching:', err);
      })
  );
});

// Activación del Service Worker: Limpia cachés antiguas
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activado. Limpiando cachés antiguas.');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[ServiceWorker] Eliminando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Estrategia Cache-first para assets estáticos
self.addEventListener('fetch', (event) => {
  // Ignora peticiones a la API de Gist (siempre deben ir a la red)
  if (event.request.url.includes('api.github.com/gists') || event.request.method !== 'GET') {
    return;
  }

  // Intentar responder con caché, si falla, ir a la red
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Si el recurso está en caché, lo devuelve
        if (response) {
          return response;
        }
        
        // Si no está en caché, va a la red y lo cachea para futuro
        return fetch(event.request).then((res) => {
            // Asegúrate de que la respuesta sea válida antes de cachearla
            if (!res || res.status !== 200 || res.type !== 'basic') {
              return res;
            }

            const responseToCache = res.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
            });
            return res;
        }).catch(err => {
            console.warn('[ServiceWorker] Falló la red y el caché:', err);
            // Podrías devolver una página de error offline aquí si existiera
        });
      })
  );
});
