const CACHE_NAME = 'gestor-menus-saludables-v3';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './app.js',
  './db.js',
  './logic.js',
  './ui.js',
  './icono.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    ).then(() => self.clients.claim())
  );
});

function shouldHandleRequest(request) {
  if (request.method !== 'GET') return false;
  const requestUrl = new URL(request.url);
  const sameOrigin = requestUrl.origin === self.location.origin;
  const googleFontCss = requestUrl.origin === 'https://fonts.googleapis.com';
  const googleFontFiles = requestUrl.origin === 'https://fonts.gstatic.com';
  const html2pdfLib = requestUrl.origin === 'https://cdnjs.cloudflare.com';
  return sameOrigin || googleFontCss || googleFontFiles || html2pdfLib;
}

self.addEventListener('fetch', (event) => {
  if (!shouldHandleRequest(event.request)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(event.request);
      const networkPromise = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => undefined);

      if (cachedResponse) {
        event.waitUntil(networkPromise);
        return cachedResponse;
      }

      return networkPromise || new Response('Offline', { status: 503, statusText: 'Offline' });
    })()
  );
});
