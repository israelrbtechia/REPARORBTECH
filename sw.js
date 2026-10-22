/* Cache offline do app */
const CACHE = 'rbtech-v16';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/config.js', 'js/vendor/supabase.js', 'js/cloud.js', 'js/vendor/jspdf.umd.min.js', 'js/pdf.js',
  'acompanhar.html', 'js/acompanhar.js', 'js/importar.js', 'js/pages/pedidos.js', 'js/pages/aparelhos.js', 'js/pages/metas.js', 'pedido.html', 'js/pedido.js',
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
// Rede primeiro (para receber atualizações), cache como fallback offline.
// Requisições para outros domínios (Supabase, fontes) não passam pelo cache.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
      return r;
    }).catch(async () => (await caches.match(e.request, { ignoreSearch: true })) || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))
  );
});
