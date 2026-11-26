// Service worker de MAMAYS: la app abre aunque no haya señal (los datos se actualizan al volver la conexión)
const CACHE = 'mamays-v2-1'
const SHELL = ['./', './index.html', './manifest.webmanifest', './config.js', './icons/icon-192.png', './icons/icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  // Solo cacheamos archivos propios; Supabase, mapas y demás siempre van a la red
  if (req.method !== 'GET' || url.origin !== location.origin) return
  // config.js: primero la red, para que los cambios de configuración se apliquen al instante
  if (url.pathname.endsWith('/config.js') || req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); return r }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html'))))
    return
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)) }
    return r
  })))
})
