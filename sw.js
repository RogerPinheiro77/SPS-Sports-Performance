// SPS Sports Performance — Service Worker
// Cache estratégico: app shell + CDN assets

const CACHE = 'sps-v30';
const ASSETS = [
  './',
  './index.html',
  './assets/logo_sps.jpg',
  './assets/icon_atleta_192.png',
  './assets/icon_atleta_512.png',
  './assets/icon_atleta_apple.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js'
];

// Instalar: pré-cachear assets essenciais
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(
        ASSETS.map(url => c.add(new Request(url, { mode: 'no-cors' })))
      ))
      .then(() => self.skipWaiting())
  );
});

// Ativar: limpar caches antigos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(
        ks.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: network-first para o app shell (HTML/navegação) — garante que o
// utilizador vê sempre a versão mais recente após um deploy, com a cache só
// como fallback offline. Cache-first para assets estáticos versionados (CDN).
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Não interceptar chamadas Supabase nem APIs externas (dados sempre frescos)
  if (url.includes('supabase.co') || url.includes('api.qrserver')) {
    return;
  }

  const isAppShell = e.request.mode === 'navigate' ||
    url.endsWith('/') || url.endsWith('/index.html');

  if (isAppShell) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          if (r && r.ok) {
            const clone = r.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request)
        .then(r => {
          if (r && r.ok) {
            const clone = r.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return r;
        })
        .catch(() => cached);
      return cached || net;
    })
  );
});
