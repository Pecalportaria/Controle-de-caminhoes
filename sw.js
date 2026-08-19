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
const CACHE_NAME = 'transpecal-cache-v2';

// Arquivos essenciais para o app abrir (o resto — fontes, Firebase — vai
// sendo guardado automaticamente conforme é usado, na função fetch abaixo).
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
];

// Requisições que devem SEMPRE tentar buscar a versão mais nova primeiro
// (só usando o cache guardado se estiver realmente sem internet). Cobre a
// própria página (navegação) e o index.html — assim uma atualização do app
// aparece na hora, em vez de só na segunda abertura.
function ehConteudoQueDeveSerSempreAtual(req) {
  if (req.mode === 'navigate') return true;
  try {
    const url = new URL(req.url);
    return url.pathname.endsWith('/index.html') || url.pathname === '/' || url.pathname.endsWith('/sw.js');
  } catch (e) {
    return false;
  }
}

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

  // A página principal (e o próprio sw.js): busca a versão mais nova na
  // internet primeiro; só cai para a cópia guardada se estiver offline.
  // Isso garante que uma atualização do app apareça imediatamente, e o
  // cache serve só como "plano B" para quando não houver conexão.
  if (ehConteudoQueDeveSerSempreAtual(req)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copia)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // Demais arquivos (fontes, ícones, SDK do Firebase, etc.): cache primeiro
  // (resposta instantânea, funciona offline), atualizando em segundo plano.
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
        .catch(() => cacheado);

      return cacheado || buscarEAtualizarCache;
    })
  );
});
