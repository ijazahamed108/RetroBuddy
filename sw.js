/* RetroBuddy service worker: offline app shell, cached ROMs and emulator runtime. */
const VERSION = 'v1.0.0';
const SHELL_CACHE = `rb-shell-${VERSION}`;
const ROM_CACHE = 'rb-roms-v1';
const EMULATOR_CACHE = 'rb-emulatorjs-4.2.3';
const EMULATOR_ORIGIN = 'https://cdn.emulatorjs.org';

const SHELL_FILES = [
  './',
  'index.html',
  'play.html',
  '404.html',
  'manifest.webmanifest',
  'games/games.json',
  'assets/css/main.css',
  'assets/css/play.css',
  'assets/js/app.js',
  'assets/js/play.js',
  'assets/js/catalog.js',
  'assets/js/storage.js',
  'assets/js/systems.js',
  'assets/js/util.js',
  'assets/js/pwa.js',
  'assets/fonts/PressStart2P-Regular.ttf',
  'assets/icons/favicon.svg',
  'assets/icons/cartridge.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
];

const ROM_PATTERN = /\/games\/[^/]+\/[^/]+\.(nes|gb|gbc|gba|sfc|smc|md|gen|bin|sms|gg|zip|7z)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, ROM_CACHE, EMULATOR_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('rb-') && !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const fallback = await cache.match('index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

async function cacheFirst(request, cacheName, { allowOpaque = false } = {}) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || (allowOpaque && response.type === 'opaque')) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName, event) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  if (cached) {
    event.waitUntil(network.catch(() => {}));
    return cached;
  }
  return network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);

  if (url.origin === EMULATOR_ORIGIN) {
    // Version-pinned URLs never change, so cache them forever. version.json is a live update check.
    if (url.pathname.endsWith('/version.json')) return;
    event.respondWith(cacheFirst(request, EMULATOR_CACHE, { allowOpaque: true }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || url.pathname.endsWith('/games.json')) {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }
  if (ROM_PATTERN.test(url.pathname)) {
    event.respondWith(cacheFirst(request, ROM_CACHE));
    return;
  }
  event.respondWith(staleWhileRevalidate(request, SHELL_CACHE, event));
});
