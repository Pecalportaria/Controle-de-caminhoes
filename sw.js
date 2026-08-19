// Service Worker do TransPecal
// Permite abrir e usar o app mesmo sem internet, guardando neste aparelho
// uma cópia dos arquivos necessários (a página, os ícones, etc.). Assim que
// o app for aberto pelo menos uma vez com internet, essa cópia fica salva
// e passa a ser usada automaticamente quando não houver conexão.
//
// Isso NÃO substitui a internet para sincronizar dados novos entre
// aparelhos — os registros continuam sincronizando pelo Firestore quando a
// conexão voltar (a persistência offline dele já está habilitada no
// próprio index.html). Este arquivo cuida apenas de o APP conseguir abrir.
//
// Se quiser forçar todos os aparelhos a buscar uma versão nova do app da
// próxima vez (ex: depois de uma atualização importante), basta mudar o
// número da versão abaixo (v1 → v2, etc.).
const CACHE_NAME = 'transpecal-cache-v1';

// Arquivos essenciais para o app abrir (o resto — fontes, Firebase — vai
// sendo guardado automaticamente conforme é usado, na função fetch abaixo).
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Guarda cada arquivo individualmente: se um faltar (ex: ícone ainda
      // não publicado), não impede que os outros — principalmente o
      // index.html — fiquem salvos para uso offline.
      Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => {})))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(
        nomes.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Só cuidamos de requisições de leitura (GET). As chamadas do Firestore
  // usam WebSocket/streams e não passam por aqui.
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cacheado) => {
      const buscarEAtualizarCache = fetch(req)
        .then((res) => {
          if (res) {
            const copia = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copia)).catch(() => {});
          }
          return res;
        })
        .catch(() => {
          // Sem internet: usa o que tiver em cache; se for a navegação
          // principal do app e não achar nada específico, cai para o
          // index.html salvo como último recurso.
          if (cacheado) return cacheado;
          if (req.mode === 'navigate') return caches.match('./index.html');
          return undefined;
        });

      // Responde com o cache na hora, se existir (rápido e funciona
      // offline), e atualiza o cache em segundo plano para a próxima vez.
      return cacheado || buscarEAtualizarCache;
    })
  );
});
