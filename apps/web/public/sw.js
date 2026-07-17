// v2: a v1 fazia cache-first de TODO GET, inclusive as chamadas autenticadas
// à API — a primeira resposta de cada URL ficava congelada no Cache Storage
// (listas nunca atualizavam depois de criar um item) e, como a chave do cache
// é só a URL (Authorization não participa), trocar de usuário no mesmo
// navegador podia servir a resposta cacheada do usuário anterior. O bump do
// CACHE_NAME faz o activate expurgar o cache envenenado da v1.
const CACHE_NAME = 'condly-cache-v2';
const PRECACHE_URLS = ['/', '/manifest.json'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Nunca interceptar requisições de outra origem (a API): as respostas são
  // dinâmicas, autenticadas e por usuário — deixá-las passar direto pra rede
  // é a única opção correta aqui.
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Same-origin (shell/assets do app): network-first com fallback pro cache —
  // continua funcionando offline sem nunca servir asset desatualizado
  // quando há rede.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? Response.error())),
  );
});
