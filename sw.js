/* Cache offline do app */
const CACHE = 'rbtech-v1';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/util.js', 'js/store.js', 'js/print.js', 'js/ui.js', 'js/app.js',
  'js/pages/dashboard.js', 'js/pages/os.js', 'js/pages/orcamentos.js', 'js/pages/clientes.js',
  'js/pages/estoque.js', 'js/pages/vendas.js', 'js/pages/financeiro.js', 'js/pages/outros.js',
  'assets/logo.jpg', 'assets/icon-180.png', 'assets/icon-192.png', 'assets/icon-512.png',
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
// Rede primeiro (para receber atualizações), cache como fallback offline
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok && new URL(e.request.url).origin === location.origin) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
