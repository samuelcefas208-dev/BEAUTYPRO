// BeautyPro Service Worker — alinhado ao index.html (E20: APP_SHELL inclui cadeia sync + list-writers)
// v20260824-f7-7: Agenda título+sticky, IA sticky, gap lista;  força actualização do shell após correcção da Benza (lista = aba Clientes)
/* P3 perf: precache leve — ícones 1MB+ ficam em runtime (evita install lento) */
const CACHE_NAME = "belezapro-shell-v=20260928-full2";
const APP_SHELL = [
  './src/core/shared/constants.js',
  './src/core/shared/utils.js',
  './src/core/state/state.js',
  './src/core/state/store.js',
  './src/core/storage/db-indexeddb.js',
  './src/core/api/supabase-resilience.js',
  './src/core/auth/auth-supabase.js',
  './src/core/state/list-writers.js',
  './src/core/sync/sync-policy.js',
  './src/core/sync/sync-tombstone.js',
  './src/core/sync/sync-dlq.js',
  './src/core/sync/sync-queue-store.js',
  './src/core/sync/sync-outbox.js',
  './src/core/sync/sync-lock.js',
  './src/core/sync/sync-recover.js',
  './src/core/sync/sync-queue.js',
  './src/core/sync/sync-ui.js',
  './src/core/sync/sync-scheduler.js',
  './src/core/sync/sync-rest.js',
  './src/core/shared/plano-limites.js',
  './src/core/shared/crud-operations.js',
  './',
  './index.html',
  './styles/foundation/base-variaveis.css',
  './styles/components/components.css',
  './styles/layout/layout-nav-tabs.css',
  './styles/modules/kpis.css',
  './styles/modules/caixa.css',
  './styles/components/list-items.css',
  './styles/modules/equipa.css',
  './styles/modules/dashboard.css',
  './styles/modules/menus-agenda.css',
  './styles/components/modais-toast-fab.css',
  './styles/modules/login.css',
  './styles/modules/venda-carrinho.css',
  
  './styles/modules/ia.css',
  './styles/modules/plano-filtros-grafico.css',
  './styles/themes/impressao-acessibilidade.css',
  './styles/foundation/tokens.css',
  './styles/foundation/design-system.css',
  './styles/themes/dark-mode.css',
  './styles/modules/splash-sparkline.css',
  './styles/modules/premium-panels.css',
  './styles/foundation/desktop-responsive.css',
  './manifest.json',
  './assets/img/logo.png',
  './assets/img/ia-empty-duo.png',
  './src/modules/dashboard/bp-resumo-kpi.js',
  './src/app/desktop-shell.js',
  './src/app/desktop-enterprise.js',
  './src/media/avatars-realistas.js',
  './src/media/media-galeria.js',
  './src/media/avatars-listas.js',
  './src/modules/ia/ia-module.js',
  './src/modules/ia/benza-tools.js',
  './src/ui/menu-accordion.js',
  './src/modules/agenda/agenda-render.js',
  './src/ui/accessibility.js',
  './src/ui/navegacao-events.js',
  './src/modules/financeiro/comissoes.js',
  './src/modules/financeiro/financeiro.js',
  './src/modules/marketing/marketing.js',
  './src/modules/crm/crm-comercial.js',
  './src/modules/equipa/equipa.js',
  './src/modules/configuracoes/gestao.js',
  './src/modules/agenda/expirar-agendamento.js',
  './src/modules/vendas/vendas-modais.js',
  './src/ui/security.js',
  './src/modules/caixa/caixa-events.js',
  './src/app/app-shell-events.js',
  './src/ui/shared-formatters.js',
  './src/modules/dashboard/dashboard-render.js',
  './src/modules/agenda/agenda-board.js',
  './src/app/ui-coordinator.js',
  './src/ui/list-helpers.js',
  './src/modules/clientes/clientes-render.js',
  './src/modules/caixa/caixa-render.js',
  './src/modules/equipa/equipa-render.js',
  './src/modules/servicos/servicos-render.js',
  './src/charts/analise-temporal.js',
  './src/charts/chart-module.js',
  './experiments/piloto-legacy/boot-pilot.js',
  './experiments/piloto-legacy/charts-boundary/index.js',
  './experiments/piloto-legacy/charts-slice/analise-temporal.js',
  './src/app/hide-splash.js',
  './src/app/main.js',
  './src/modules/notificacoes/push.js',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url).catch(() => null)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(nomes.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url || '';

  // Nunca cachear REST/Storage Supabase
  if (url.indexOf('supabase.co') !== -1) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Etapa 8 fase 3: network-first só shell real (sem app.bundle legado)
  var isShellCritical =
    url.indexOf('index.html') !== -1 ||
    url.indexOf('/sw.js') !== -1 ||
    (event.request.mode === 'navigate');

  if (isShellCritical) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(function (res) { return res; })
        .catch(function () {
          return caches.match(event.request);
        })
    );
    return;
  }

  /* CSS + módulos IA: network-first (evita identidade/CSS antigo preso no cache) */
  var isStyleOrModule =
    url.indexOf('.css') !== -1 ||
    url.indexOf('/src/modules/ia/') !== -1;

  if (isStyleOrModule) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(function (res) {
          if (res && res.status === 200) {
            var clone = res.clone();
            caches.open(CACHE_NAME).then(function (c) { c.put(event.request, clone); });
          }
          return res;
        })
        .catch(function () {
          return caches.match(event.request);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var network = fetch(event.request)
        .then(function (res) {
          if (res && res.status === 200) {
            var clone = res.clone();
            caches.open(CACHE_NAME).then(function (c) { c.put(event.request, clone); });
          }
          return res;
        })
        .catch(function () { return cached; });
      return cached || network;
    })
  );
});

/* --- Push / notificações (BelezaPro modules/notificacoes) --- */
self.addEventListener('push', function (event) {
  var title = 'BelezaPro';
  var options = {
    body: 'Nova actualização',
    icon: './assets/img/icon-192.png',
    badge: './assets/img/icon-192.png',
    data: { url: './index.html' },
  };
  try {
    if (event.data) {
      var payload = event.data.json();
      if (payload.title) title = payload.title;
      if (payload.body) options.body = payload.body;
      if (payload.tag) options.tag = payload.tag;
      if (payload.data) options.data = payload.data;
    }
  } catch (e) {
    try {
      options.body = event.data ? event.data.text() : options.body;
    } catch (e2) {}
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = './index.html';
  try {
    if (event.notification && event.notification.data && event.notification.data.url) {
      target = event.notification.data.url;
    }
  } catch (e) {}
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
