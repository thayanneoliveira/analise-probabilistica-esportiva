/*
 * QuantiScore Service Worker
 *
 * Este service worker simples armazena em cache os recursos essenciais da
 * aplicação para permitir o acesso offline. Ele responde com arquivos em
 * cache quando disponíveis e recorre à rede quando necessário. Ao atualizar
 * o cacheName você força a atualização dos caches no próximo carregamento.
 */

const CACHE_NAME = 'quantiscore-cache-v1';

// Lista de recursos essenciais a serem armazenados em cache
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/sw.js',
  '/icon-192.png',
  '/icon-512.png',
  '/2600b8aa-6099-4422-852c-2811f2a37cc9.png',
  // CDN requests como Chart.js não podem ser armazenados via cacheAddAll,
  // mas serão buscados normalmente quando necessário.
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});