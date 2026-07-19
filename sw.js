// Service Worker do Recanto das Aves
// Objetivo: o app (HTML/CSS/JS + ícones) abrir e funcionar mesmo sem internet.
// Importante: chamadas para a Microsoft (login e planilha) NUNCA passam por aqui —
// isso evita qualquer interferência no login com a Microsoft e garante que a
// sincronização sempre use a rede de verdade quando ela existir.

// Aumente este número sempre que publicar uma nova versão do app, para que os
// aparelhos já instalados baixem os arquivos atualizados.
const CACHE_VERSION = 'recanto-aves-v2';

const ARQUIVOS_ESSENCIAIS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

// Domínios que o Service Worker NUNCA deve interceptar (login e planilha
// precisam sempre ir direto para a rede, sem cache no meio do caminho).
const DOMINIOS_IGNORADOS = [
  'login.microsoftonline.com',
  'graph.microsoft.com',
  'login.live.com',
  'alcdn.msauth.net'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(ARQUIVOS_ESSENCIAIS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomes) => Promise.all(
      nomes
        .filter((nome) => nome !== CACHE_VERSION)
        .map((nome) => caches.delete(nome))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Só cuida de requisições GET.
  if(req.method !== 'GET') return;

  const url = new URL(req.url);

  // Nunca intercepta chamadas de login/planilha da Microsoft, nem requisições
  // de outra origem que não sejam as fontes/ícones do próprio app — deixa o
  // navegador cuidar delas normalmente.
  if(DOMINIOS_IGNORADOS.some((dominio) => url.hostname.includes(dominio))){
    return;
  }

  // Navegação (abrir/recarregar o app): tenta a rede primeiro, para sempre
  // pegar a versão mais nova quando online; se falhar (offline), usa o cache.
  if(req.mode === 'navigate'){
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', copia));
          return resp;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Arquivos do próprio app (ícones, manifest, fontes, script do login):
  // cache primeiro (mais rápido e funciona offline), busca na rede como reforço
  // e atualiza o cache em segundo plano.
  event.respondWith(
    caches.match(req).then((respostaCache) => {
      const buscaRede = fetch(req).then((resp) => {
        if(resp && resp.status === 200){
          const copia = resp.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copia));
        }
        return resp;
      }).catch(() => respostaCache);

      return respostaCache || buscaRede;
    })
  );
});
