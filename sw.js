// Service worker mínimo — necessário para o navegador permitir instalar como app.
// Não faz cache agressivo para não atrapalhar as atualizações do Firebase em tempo real.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

// Deixa todas as requisições passarem direto para a rede (sem cache offline),
// já que o app depende de dados em tempo real.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
