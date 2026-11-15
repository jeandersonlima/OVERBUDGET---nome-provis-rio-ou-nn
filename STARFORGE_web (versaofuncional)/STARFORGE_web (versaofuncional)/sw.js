const VERSION = 'starforge-v8'; // mude este número a cada publicação para forçar a atualização
const CORE = [
  './',
  './index.html',
  './game.js',
  './game_config.json',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.ico',
  './src/core/catalog.js',
  './src/core/explorationRules.js',
  './src/core/failureMessages.js',
  './src/core/layout.js',
  './src/core/manualContent.js',
  './src/core/missionRules.js',
  './src/core/missionState.js',
  './src/core/planetaryGridRules.js',
  './src/game/app.js',
  './src/game/launchParticles.js',
  './src/game/responsive.js',
  './src/render/artAssets.js',
  './src/render/planetarySurfaceRenderer.js',
  './src/render/sceneRenderer.js',
  './src/render/surfaceRenderer.js',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.18.48.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.18.55.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.19.01.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.19.05.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.19.10.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.19.15.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.19.20.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.19.27.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.20.21.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.20.41.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.20.45.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.20.51.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.21.11.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.21.35.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.21.57.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.22.57.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.23.00.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.23.12.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.23.18.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.23.37.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.23.41.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.24.12.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.24.17.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.24.22.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.24.46.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.24.51.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.24.55.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.25.14.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.25.17.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.25.23.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.25.23 (1).jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.25.26.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.25.26 (1).jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.25.39.jpeg',
  './assets.jogo/WhatsApp Image 2026-11-15 at 17.25.41.jpeg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => Promise.all(CORE.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Rede primeiro (sempre a versão mais nova); sem internet, usa o cache (jogo offline).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
