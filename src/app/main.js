/* BelezaPro — src/app/main.js
 * Etapa 5 — CONTRATO DA CAMADA APP:
 *   app/ ORQUESTRA (boot, SW, deferred loads, overlay, padding shell).
 *   modules/ DECIDE negócio (agenda, clientes, vendas, caixa, …).
 *   core/ PERSISTE e SINCRONIZA.
 * PROIBIDO nesta camada: regras de preço, comissão, CRUD de domínio,
 * validações de formulário de cliente/agenda/venda, HTML de listagens.
 * Carregar POR ÚLTIMO (após core + modules + ui-coordinator).
 */

// ====================================================================
//  INICIALIZAÇÃO (extraído do app.js na Fase A da modularização)
//  Carregado por último — depende de tudo o resto já estar definido.
//
//  DEPENDÊNCIAS EXTERNAS (globais, sem import/export; ver
//  BelezaPro_PLANO_TECNICO para o porquê):
//    - state                     → core-state.js
//    - openDB()                  → db-indexeddb.js
//    - checkSession()            → auth-supabase.js
//    - hideSplash()              → src/app/hide-splash.js (F3.6-B)
//    - IA diferida F3.6-C        → bpLoadDeferredIA()
//    - Desktop diferido F3.6-D   → bpLoadDeferredDesktop() (≥1024px)
//    - atualizarIAOffline()      → detalhes-acessibilidade.js
//    - aplicarAcessibilidade()   → detalhes-acessibilidade.js
//    - toast()                   → core-utils.js
//
//  CORREÇÃO (Fase C — divisão do app.js em 12 módulos): esta lista
//  referia todas as 6 dependências a "app.js"; 3 delas (state, openDB,
//  checkSession) nunca estiveram lá — já estava desatualizada antes
//  da divisão. As outras 3 estavam certas e ficaram obsoletas agora.
//  Se qualquer uma destas for movida ou renomeada no futuro, atualizar
//  esta lista.
// ====================================================================
async function init() {
  /* Splash BeautyPro banido */
  try {
    var _sp = document.getElementById('splash-screen');
    if (_sp) {
      _sp.style.cssText = 'display:none!important;opacity:0;visibility:hidden;pointer-events:none;';
      _sp.setAttribute('hidden', '');
      _sp.setAttribute('aria-hidden', 'true');
    }
    if (typeof hideSplash === 'function') hideSplash();
  } catch (_) {}
  /* Anti-flash login: reforço imediato se sessão local */
  try {
    if (localStorage.getItem('bp_session_active') === '1' && localStorage.getItem('bp_salao_id_cache')) {
      document.documentElement.classList.add('bp-has-session');
      var _lv = document.getElementById('login-view');
      if (_lv) { _lv.style.display = 'none'; _lv.classList.remove('active'); }
    }
  } catch (_) {}
  /* Overlay — política de produto (BP-BOOT-POLICY):
   * - reload / sessão já activa: máx. 2s
   * - login / troca de conta: até sync ou 15s
   * - offline com cache: flash curto, fecha
   * - resume (visibility): NUNCA overlay aqui
   */
  try {
    if (typeof bpResolveBootPolicy === 'function' && typeof bpShowBootOverlay === 'function') {
      var pol = bpResolveBootPolicy();
      if (pol && pol.show) {
        bpShowBootOverlay({ reason: pol.reason, maxMs: pol.maxMs, offline: pol.offline });
      }
    }
  } catch (_) {}
  // Estado inicial: classes no <html> (gate CSS). Sem forçar display:flex no login.
  try {
    if (!document.documentElement.classList.contains('bp-has-session')) {
      var _lv0 = document.getElementById('login-view');
      var _av0 = document.getElementById('app-view');
      if (_lv0) _lv0.style.display = '';
      if (_av0) _av0.style.display = 'none';
    } else {
      var _lv1 = document.getElementById('login-view');
      if (_lv1) { _lv1.style.display = 'none'; _lv1.classList.remove('active'); }
    }
  } catch (_) {}

  // Ponto 1 — indicador Online/Offline atualizado já aqui, ANTES de
  // qualquer chamada de rede (openDB/checkSession). atualizarIndicadorSync()
  // só depende de navigator.onLine (instantâneo) e da fila local em
  // localStorage (instantâneo) — não precisa de sessão nem de perfil.
  // O HTML tem "Offline" fixo por defeito (index.html), por isso sem esta
  // chamada antecipada o texto ficava errado durante todo o checkSession().
  if (typeof atualizarIndicadorSync === 'function') atualizarIndicadorSync();
  try { if (typeof bpStartHealthMonitor === 'function') bpStartHealthMonitor({ intervalMs: 30000 }); } catch (_) {}
  if (typeof initStoreBindings === 'function') initStoreBindings();

  /* Etapa 5: migração de fila → bpRunBootMigrations() */
  if (typeof bpRunBootMigrations === 'function') bpRunBootMigrations();

  // Abrir IndexedDB local (offline-first)
  // Item 2.4: qualquer falha aqui é comunicada de forma clara — nunca
  // silenciosa — e nunca deixa o utilizador perante um ecrã sem saída.
  let dbDisponivel = true;
  try {
    await openDB();
  } catch (e) {
    dbDisponivel = false;
    console.error('Erro ao abrir a base de dados local:', e);
    toast('Não foi possível carregar os dados do dispositivo. Tente recarregar a aplicação.', 'error');
  }

  /* Etapa 8 fase 3: restore filtros/chart → bpRestoreUiChrome via bpRunBootMigrations */

  // Verificar sessão Supabase — se existir, entra directamente
  // (se a base de dados local não abriu, ainda tentamos: sem sessão,
  // o utilizador fica no ecrã de login, que não depende do IndexedDB)
  try {
    if (typeof bpProbePersistence === 'function') {
      bpProbePersistence().then(function (p) {
        if (p && !p.idb && !p.ls) {
          console.warn('[persist] armazenamento local indisponível — modo degradado');
        }
      });
    }
  } catch (_) {}
  try {
    await checkSession();
  } catch (errBoot) {
    console.error('[Boot] Erro:', errBoot);
  } finally {
    /* Garantir fecho do overlay em todos os caminhos */
    try {
      if (typeof bpHideBootOverlay === 'function') bpHideBootOverlay();
    } catch (_) {}
    try { document.documentElement.classList.remove('bp-booting'); } catch (_) {}
  }
  try { if (typeof bpTouchSessionLocal === 'function' && typeof bpHasLocalSession === 'function' && bpHasLocalSession()) bpTouchSessionLocal(); } catch (_) {}
  if (!dbDisponivel) {
    // Reforça a mensagem já dada acima, para o caso de o toast anterior
    // ter sido perdido durante a transição de ecrãs.
    setTimeout(() => toast('Não foi possível aceder aos dados locais deste dispositivo. Tenta recarregar a página.', 'error'), 1400);
  }

  // Splash (removida após verificação de sessão)
  // Splash: hideSplash já pode ter corrido no checkSession; fallback curto
  setTimeout(function () {
    if (typeof hideSplash === 'function') hideSplash();
    if (typeof bpHideSplashNow === 'function') bpHideSplashNow();
  }, 400);

  // Timeout de emergência: se splash persistir além de 3s, força remoção
  setTimeout(function() {
    var splash = document.getElementById('splash-screen');
    if (splash && splash.style.display !== 'none') {
      splash.style.opacity = '0';
      setTimeout(function () { splash.style.display = 'none'; }, 200);
      console.log('Splash removida por timeout de emergência');
    }
  }, 5000);

  // IA offline
  setTimeout(function () { if (typeof atualizarIAOffline === 'function') atualizarIAOffline(); }, 500);

  // Acessibilidade
  setTimeout(function () { if (typeof aplicarAcessibilidade === 'function') aplicarAcessibilidade(); }, 600);

  /* F3.5 — diferir charts (não são necessários para o 1.º HTML/updateUI).
     Dashboard já guarda typeof initKpiTemporalUi / actualizarKpiMiniChart. */
  setTimeout(function () {
    if (typeof window.bpLoadDeferredCharts === 'function') {
      window.bpLoadDeferredCharts();
    }
  }, 0);

  /* F3.6-C — diferir IA (hideSplash já não depende de ia-module). */
  setTimeout(function () {
    if (typeof window.bpLoadDeferredIA === 'function') {
      window.bpLoadDeferredIA();
    }
  }, 0);

  /* F3.6-D — desktop só se viewport ≥1024px (mobile não paga estes scripts). */
  setTimeout(function () {
    if (typeof window.bpLoadDeferredDesktop === 'function') {
      window.bpLoadDeferredDesktop();
    }
  }, 0);

  /* E1/E5 — marketing diferido (fora do 1.º ecrã; menu faz load-on-demand se preciso). */
  setTimeout(function () {
    if (typeof window.bpLoadDeferredMarketing === 'function') {
      window.bpLoadDeferredMarketing();
    }
  }, 0);

  /* E6 — ops-crm diferido (menu-only; sem path crítico de venda/agenda). */
  setTimeout(function () {
    if (typeof window.bpLoadDeferredOps === 'function') {
      window.bpLoadDeferredOps();
    }
  }, 0);

  /* E7 — equipa diferido (ranking/horários/chat; menu-only). */
  setTimeout(function () {
    if (typeof window.bpLoadDeferredEquipa === 'function') {
      window.bpLoadDeferredEquipa();
    }
  }, 0);

  /* E8 — finance + gestão + expirar (fora do parse; expirar arranca watcher no onload). */
  setTimeout(function () {
    if (typeof window.bpLoadDeferredFinance === 'function') window.bpLoadDeferredFinance();
    if (typeof window.bpLoadDeferredGestao === 'function') window.bpLoadDeferredGestao();
    if (typeof window.bpLoadDeferredExpirar === 'function') window.bpLoadDeferredExpirar();
  }, 0);

  console.log('BeautyPro inicializado com sucesso!');
  // Boot quiet: evitar “vibração” de KPIs no 1.º updateUI pós-pull
  try { window.__bpQuietUI = true; setTimeout(function () { window.__bpQuietUI = false; }, 2500); } catch (_) {}


  // ================================================================
  // CORREÇÃO (sync lento sem reload): existiam DOIS throttles de 90s
  // (este, e outro em security-hardening.js/bpSilentPull) que limitavam
  // o pull real ao Supabase a, no máximo, 1x a cada 90s quando não havia
  // fila local pendente. Por isso o dispositivo B só via as alterações
  // do dispositivo A quase de imediato ao recarregar a página (o reload
  // ignora o throttle, ver checkSession()/bpSilentPull(true) em
  // auth-supabase.js), mas com a app apenas aberta podia demorar até
  // 90s. Agora faz pull a cada poucos segundos, sem throttle, com uma
  // guarda simples para nunca sobrepor dois pulls em curso.
  // ================================================================
  // Pull silencioso: 45s, sem vibração de UI se modal aberto ou dados iguais
  const SYNC_POLL_MS = 45000;
  let bpPullEmCurso = false;
  function bpModalAberto() {
    try {
      return !!document.querySelector('.modal-overlay.open, .modal-sheet.open, .bp-shell-modal.open');
    } catch (_) { return false; }
  }
  setInterval(() => {
    if (!(navigator.onLine && document.visibilityState === 'visible' && state?.config?.salaoId)) return;
    if (bpPullEmCurso || bpModalAberto()) return;
    bpPullEmCurso = true;
    carregarDoSupabase().then(atualizado => {
      window.BPRuntime = window.BPRuntime || {}; window.BPRuntime.lastSupabasePull = Date.now();
      // Só repintar se houve mudança real E nenhum modal aberto
      if (atualizado && !bpModalAberto()) {
        if (typeof renderBadges === 'function') renderBadges();
        // updateUI completo só se não houver formulário aberto
        if (typeof updateUI === 'function') updateUI();
      }
    }).catch(() => {}).finally(() => { bpPullEmCurso = false; });
  }, SYNC_POLL_MS);

  // Ponto 3 — Forçar pull quando a app volta ao foco (visível)
  // Isto garante que ao trocar de app e voltar, os dados são atualizados
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || !navigator.onLine || !state?.config?.salaoId) return;
    if (bpPullEmCurso) return;
    bpPullEmCurso = true;
    try {
      const atualizado = await carregarDoSupabase();
      if (atualizado && !bpModalAberto()) {
        if (typeof renderBadges === 'function') renderBadges();
        if (typeof updateUI === 'function') updateUI();
      }
      if (typeof aplicarPermissoes === 'function') aplicarPermissoes();
    } catch (e) {
      console.warn('[Sync] foco:', e);
    } finally {
      bpPullEmCurso = false;
    }
  });

  /* Etapa 8 fase 2: FAB scroll → modules/agenda/agenda-events.js */

  // ============================================================
  //  CORREÇÃO: HEADER FIXO – ajuste automático do padding-top
  //  para que o conteúdo nunca fique por baixo do header
  //  (com fallback para garantir que funciona mesmo se o header
  //  ainda não estiver completamente renderizado)
  // ============================================================
  function ajustarPaddingHeader() {
    const header = document.querySelector('.app-header');
    const main = document.querySelector('.main-content');
    if (header && main) {
      const altura = header.offsetHeight;
      if (altura > 0) {
        main.style.paddingTop = altura + 'px';
      } else {
        // Fallback: tentar novamente após 100ms se a altura for 0
        setTimeout(ajustarPaddingHeader, 100);
      }
    }
  }

  // Aplicar com um pequeno atraso para garantir que o DOM está completamente montado
  setTimeout(ajustarPaddingHeader, 50);

  // Reaplicar sempre que a janela for redimensionada
  window.addEventListener('resize', ajustarPaddingHeader);

  // Reaplicar também quando o conteúdo for carregado (ex: após login)
  // Usamos MutationObserver para detetar mudanças no header (ex: nome do salão)
  var _hdrPadT = null;
  const headerObserver = new MutationObserver(function () {
    // Debounce: mutações em série no header (nome do salão, badges) não devem
    // alterar paddingTop 2–5× seguidas — no Android isso vibra o layout sob o modal.
    if (_hdrPadT) clearTimeout(_hdrPadT);
    _hdrPadT = setTimeout(ajustarPaddingHeader, 50);
  });
  const headerEl = document.querySelector('.app-header');
  if (headerEl) {
    headerObserver.observe(headerEl, { childList: true, subtree: true, characterData: true });
  }
}

// PWA: registar o service worker (cache do app shell para offline real)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((e) => {
      console.warn('[PWA] Falha ao registar service worker:', e);
    });
    try {
      if (window.BPNotify && typeof window.BPNotify.maybePromptAfterLogin === 'function') {
        window.BPNotify.maybePromptAfterLogin();
      }
    } catch (_bpn) {}
  });
}

/* ===== BP-BOOT-POLICY — overlay de sincronização =====
 * Regras de produto (não alterar sem decisão humana):
 * 1) Reload com sessão activa → overlay ≤ 2s; pull continua em fundo
 * 2) Login / troca de conta → overlay até sync concluir ou 15s
 * 3) Rede fraca → aos 15s: fail UI + toast; não spin eterno
 * 4) Offline com dados locais → sem prender; fecha de imediato
 * 5) Voltar à app (visibility) → NUNCA abrir overlay
 * 6) Plano: cache local antes de pintar (evita flash trial)
 */
(function bpBootOverlayModule() {
  var RELOAD_MS = 2000;
  var SWITCH_MS = 15000;
  var SAFETY_MS = 20000;
  var timer = null;
  var safetyTimer = null;
  var active = false;
  var currentReason = 'reload';

  function el() { return document.getElementById('bp-boot-overlay'); }
  function actions() { return document.getElementById('bp-boot-actions'); }
  function spinner() { return document.querySelector('#bp-boot-overlay .bp-boot-spinner'); }
  function title() { return document.getElementById('bp-boot-title'); }
  function desc() { return document.getElementById('bp-boot-desc'); }

  function notifyWeakNetwork() {
    try {
      var _msgNet = 'Ligação lenta ou instável. Pode continuar a trabalhar; a sincronização retoma automaticamente quando a rede estabilizar.';
      if (typeof bpInfoEntendi === 'function') bpInfoEntendi(_msgNet, 'Ligação instável');
      else if (typeof toast === 'function') toast(_msgNet, 'warning');
    } catch (_) {}
    try {
      if (typeof bpMaybeShowOfflineInfoModal === 'function' && typeof navigator !== 'undefined' && !navigator.onLine) {
        bpMaybeShowOfflineInfoModal();
      }
    } catch (_) {}
  }

  /** Resolve se deve mostrar overlay e com que teto. */
  function resolveBootPolicy() {
    var loggedOut = false;
    var hasSalao = false;
    var sessionActive = false;
    var switchFlag = false;
    try { loggedOut = localStorage.getItem('bp_logged_out') === '1'; } catch (_) {}
    try { hasSalao = !!localStorage.getItem('bp_salao_id_cache'); } catch (_) {}
    try { sessionActive = localStorage.getItem('bp_session_active') === '1'; } catch (_) {}
    try { switchFlag = sessionStorage.getItem('bp_account_switch') === '1'; } catch (_) {}

    var offline = (typeof navigator !== 'undefined' && !navigator.onLine);

    if (loggedOut || !hasSalao) {
      return { show: false, reason: 'none', maxMs: 0, offline: offline };
    }

    /* Troca de conta / login fresco nesta sessão de separador */
    if (switchFlag) {
      return { show: true, reason: 'switch', maxMs: SWITCH_MS, offline: offline };
    }

    /* Primeiro boot após login (sem flag de conclusão nesta tab) */
    var completed = false;
    try { completed = sessionStorage.getItem('bp_boot_completed') === '1'; } catch (_) {}

    if (!sessionActive && hasSalao) {
      /* Cache órfão raro — tratar como reload curto */
      return { show: !offline, reason: 'reload', maxMs: RELOAD_MS, offline: offline };
    }

    if (!completed) {
      /* Primeira abertura do separador com sessão: teto 15s se online */
      if (offline) {
        return { show: true, reason: 'offline', maxMs: 400, offline: true };
      }
      return { show: true, reason: 'cold', maxMs: SWITCH_MS, offline: false };
    }

    /* Já houve boot nesta tab → reload F5: máx. 2s */
    if (offline) {
      return { show: true, reason: 'offline', maxMs: 400, offline: true };
    }
    return { show: true, reason: 'reload', maxMs: RELOAD_MS, offline: false };
  }

  function showSpinnerState(opts) {
    opts = opts || {};
    var a = actions();
    if (a) a.hidden = true;
    var s = spinner();
    if (s) s.style.display = '';
    if (opts.offline) {
      if (title()) title().textContent = 'Modo offline';
      if (desc()) desc().textContent = 'Dados disponíveis no dispositivo…';
    } else if (opts.reason === 'reload') {
      if (title()) title().textContent = 'A sincronizar';
      if (desc()) desc().textContent = 'A actualizar…';
    } else {
      if (title()) title().textContent = 'A sincronizar';
      if (desc()) desc().textContent = 'A actualizar os dados do salão…';
    }
  }

  function showFailState() {
    var a = actions();
    if (a) a.hidden = false;
    var s = spinner();
    if (s) s.style.display = 'none';
    if (title()) title().textContent = 'Sem ligação estável';
    if (desc()) desc().textContent = '';
    notifyWeakNetwork();
  }

  function openBoot(opts) {
    opts = opts || {};
    var reason = opts.reason || 'reload';
    var maxMs = typeof opts.maxMs === 'number' ? opts.maxMs : (reason === 'reload' ? RELOAD_MS : SWITCH_MS);
    var offline = !!opts.offline;
    currentReason = reason;

    var o = el();
    if (!o) return;
    active = true;
    try { document.documentElement.classList.add('bp-booting'); } catch (_) {}
    o.hidden = false;
    try { o.removeAttribute('hidden'); } catch (_) {}
    o.classList.add('is-open');
    o.style.display = 'flex';
    o.setAttribute('aria-hidden', 'false');
    showSpinnerState({ offline: offline, reason: reason });

    clearTimeout(timer);
    clearTimeout(safetyTimer);

    timer = setTimeout(function () {
      if (!active) return;
      /* Reload / offline flash: fechar — sync continua em fundo */
      if (reason === 'reload' || reason === 'offline') {
        closeBoot({ skipCheckmark: true, markCompleted: true });
        return;
      }
      /* switch / cold: ecrã de falha + notificação */
      showFailState();
    }, Math.max(0, maxMs));

    safetyTimer = setTimeout(function () {
      try {
        if (document.documentElement.classList.contains('bp-booting')) {
          console.warn('[boot] safety: fecho forçado após ' + SAFETY_MS + 'ms');
          closeBoot({ skipCheckmark: true, markCompleted: true });
        }
      } catch (_) {}
    }, SAFETY_MS);
  }

  function closeBoot(opts) {
    opts = opts || {};
    active = false;
    clearTimeout(timer);
    clearTimeout(safetyTimer);
    timer = null;
    safetyTimer = null;
    try { document.documentElement.classList.remove('bp-booting'); } catch (_) {}
    var o = el();
    if (o) {
      o.hidden = true;
      try { o.setAttribute('hidden', ''); } catch (_) {}
      o.classList.remove('is-open');
      o.style.display = 'none';
      o.style.pointerEvents = 'none';
      o.setAttribute('aria-hidden', 'true');
    }
    if (opts.markCompleted !== false) {
      try { sessionStorage.setItem('bp_boot_completed', '1'); } catch (_) {}
      try { sessionStorage.removeItem('bp_account_switch'); } catch (_) {}
    }
  }

  function retry() {
    showSpinnerState({ reason: currentReason });
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (!active) return;
      showFailState();
    }, SWITCH_MS);
    if (typeof carregarDoSupabase === 'function' && navigator.onLine) {
      carregarDoSupabase().then(function () {
        closeBoot({ markCompleted: true });
        try { window.__bpQuietUI = true; } catch (_) {}
        if (typeof updateUI === 'function') updateUI();
        try { setTimeout(function () { window.__bpQuietUI = false; }, 800); } catch (_) {}
      }).catch(function () {
        showFailState();
      });
    }
  }

  function continueOffline() {
    closeBoot({ skipCheckmark: true, markCompleted: true });
  }

  function bind() {
    var r = document.getElementById('bp-boot-retry');
    var o = document.getElementById('bp-boot-offline');
    if (r && !r.dataset.bound) {
      r.dataset.bound = '1';
      r.addEventListener('click', function (e) { e.preventDefault(); retry(); });
    }
    if (o && !o.dataset.bound) {
      o.dataset.bound = '1';
      o.addEventListener('click', function (e) { e.preventDefault(); continueOffline(); });
    }
  }

  window.bpResolveBootPolicy = resolveBootPolicy;
  window.bpShowBootOverlay = function (opts) {
    if (!opts || typeof opts !== 'object') {
      var pol = resolveBootPolicy();
      if (!pol.show) return;
      opts = { reason: pol.reason, maxMs: pol.maxMs, offline: pol.offline };
    }
    if (opts.show === false) return;
    openBoot(opts);
  };
  window.bpHideBootOverlay = function (opts) {
    closeBoot(opts || { markCompleted: true });
  };
  window.bpBootContinueOffline = continueOffline;
  window.bpBootShowFail = function () {
    if (!active) return;
    /* Em reload não mostrar fail — já devia ter fechado */
    if (currentReason === 'reload' || currentReason === 'offline') {
      closeBoot({ markCompleted: true });
      return;
    }
    showFailState();
  };
  window.bpMarkAccountSwitch = function () {
    try { sessionStorage.setItem('bp_account_switch', '1'); } catch (_) {}
    try { sessionStorage.removeItem('bp_boot_completed'); } catch (_) {}
  };
  window.bpClearBootSessionFlags = function () {
    try {
      sessionStorage.removeItem('bp_boot_completed');
      sessionStorage.removeItem('bp_account_switch');
    } catch (_) {}
  };

  window.addEventListener('offline', function () {
    closeBoot({ skipCheckmark: true, markCompleted: true });
    setTimeout(function () {
      try {
        if (typeof bpMaybeShowOfflineInfoModal === 'function') bpMaybeShowOfflineInfoModal(true);
      } catch (_) {}
    }, 200);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
  setTimeout(bind, 500);

  try {
    if (typeof bpShowLoginShell === 'function') {
      var _origLogin = bpShowLoginShell;
      window.bpShowLoginShell = function () {
        try { closeBoot({ markCompleted: false }); } catch (_) {}
        try { if (typeof bpClearBootSessionFlags === 'function') bpClearBootSessionFlags(); } catch (_) {}
        return _origLogin.apply(this, arguments);
      };
    }
  } catch (_) {}
})();


/** F3.5 — carrega charts uma vez, depois re-pinta KPIs se as funções existirem. */
/** E12 — loader genérico de scripts diferidos (uma fronteira).
 *  name: chave estável · files: string|string[] · onReady: após load · onLoaded: hook interno (antes da fila onReady)
 */
window.bpLoadDeferred = function bpLoadDeferred(name, files, onReady, onLoaded) {
  if (!name) return;
  if (!window.__bpDeferred) window.__bpDeferred = {};
  var entry = window.__bpDeferred[name];
  if (!entry) {
    entry = window.__bpDeferred[name] = { done: false, loading: false, queue: [] };
  }
  if (entry.done) {
    if (typeof onReady === 'function') {
      try { onReady(); } catch (e) { try { console.warn('[defer]', name, 'onReady', e); } catch (_) {} }
    }
    return;
  }
  if (typeof onReady === 'function') entry.queue.push(onReady);
  if (entry.loading) return;
  entry.loading = true;
  var list = Array.isArray(files) ? files : (files ? [files] : []);
  function loadNext(i) {
    if (i >= list.length) {
      entry.done = true;
      entry.loading = false;
      if (typeof onLoaded === 'function') {
        try { onLoaded(); } catch (e) { try { console.warn('[defer]', name, 'onLoaded', e); } catch (_) {} }
      }
      var q = entry.queue;
      entry.queue = [];
      for (var j = 0; j < q.length; j++) {
        try { q[j](); } catch (e) { try { console.warn('[defer]', name, 'onReady', e); } catch (_) {} }
      }
      return;
    }
    var s = document.createElement('script');
    s.src = list[i];
    s.onload = function () { loadNext(i + 1); };
    s.onerror = function () {
      try { console.warn('[defer]', name, 'falha', list[i]); } catch (_) {}
      loadNext(i + 1);
    };
    document.head.appendChild(s);
  }
  loadNext(0);
};

window.bpLoadDeferredCharts = function bpLoadDeferredCharts() {
  window.bpLoadDeferred('charts', [
    'src/charts/analise-temporal.js?v=20260905-res12l',
    'src/charts/chart-module.js?v=20261021-p4'
  ], null, function () {
    try {
      if (typeof initChartControls === 'function') initChartControls();
      if (typeof initKpiTemporalUi === 'function') initKpiTemporalUi();
      if (typeof actualizarKpiMiniChart === 'function') actualizarKpiMiniChart();
      if (typeof actualizarDashChartExec === 'function' && typeof window._bpLastAnalise !== 'undefined') {
        actualizarDashChartExec(window._bpLastAnalise);
      }
    } catch (e) {
      try { console.warn('[F3.5] charts loaded, paint failed', e); } catch (_) {}
    }
  });
};

/* C-7: boot seguro se o script carregar após DOMContentLoaded */
(function () {
  function run() {
    if (typeof init === 'function') {
      try { var p = init(); if (p && typeof p.catch === 'function') p.catch(function (e) { console.warn('[boot]', e); }); }
      catch (e) { console.warn('[boot]', e); }
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();

/** F3.6-C — carrega IA uma vez após init (não bloqueia parse inicial). */
window.bpLoadDeferredIA = function bpLoadDeferredIA() {
  window.bpLoadDeferred('ia', [
    'src/modules/ia/ia-contract.js?v=20260909-ia-final',
    'src/modules/ia/ia-insights.js?v=20260909-ia-final',
    'src/modules/ia/ia-habilidade.js?v=20260912-gen-fsm1',
    'src/modules/ia/ia-module.js?v=20261021-full',
    'src/modules/ia/ia-sugestoes.js?v=20260912-fix7',
    'src/modules/ia/ia-loop.js?v=20260907-f4',
    'src/modules/ia/ia-relatorio.js?v=20261021-full',
    'src/modules/ia/ia-visao-sectorial.js?v=20261021-visao',
    'src/modules/ia/benza-tools.js?v=20260907-f4'
  ], null, function () {
    try {
      if (typeof atualizarIAOffline === 'function') atualizarIAOffline();
      if (typeof actualizarContadorIA === 'function') actualizarContadorIA();
      try {
        if (typeof actualizarInsightsIA === 'function') actualizarInsightsIA();
        if (typeof actualizarResumoIA === 'function') actualizarResumoIA();
        else if (typeof renderIAResumo === 'function') renderIAResumo();
      } catch (_) {}
      try {
        document.dispatchEvent(new CustomEvent('bp:ia-ready', { detail: { version: (window.BP_IA && window.BP_IA.VERSION) || 'f1f2' } }));
      } catch (_) {}
    } catch (e) {
      try { console.warn('[F3.6-C] IA loaded, paint failed', e); } catch (_) {}
    }
  });
};

/** E1 — carrega marketing uma vez após init (fora do parse síncrono).
 *  onReady opcional: corre após load (menu evita race). */
window.bpLoadDeferredMarketing = function bpLoadDeferredMarketing(onReady) {
  window.bpLoadDeferred('marketing', 'src/modules/marketing/marketing.js?v=20260829-e1', onReady);
};


/** E6 — carrega ops-crm uma vez após init (fora do parse síncrono). */
window.bpLoadDeferredOps = function bpLoadDeferredOps(onReady) {
  window.bpLoadDeferred('ops', 'src/modules/crm/crm-comercial.js?v=20260829-e6', onReady);
};

/** E7 — carrega equipa uma vez após init (fora do parse síncrono). */
window.bpLoadDeferredEquipa = function bpLoadDeferredEquipa(onReady) {
  window.bpLoadDeferred('equipa', 'src/modules/equipa/equipa.js?v=20260901-e8', onReady);
};

/** E8 — finance: comissões depois extra (ordem). Callers já usam typeof. */
window.bpLoadDeferredFinance = function bpLoadDeferredFinance(onReady) {
  window.bpLoadDeferred('finance', [
    'src/modules/financeiro/comissoes.js?v=20260829-e18',
    'src/modules/financeiro/financeiro.js?v=20260829-e18'
  ], onReady);
};

/** E8 — gestão (menu-only). */
window.bpLoadDeferredGestao = function bpLoadDeferredGestao(onReady) {
  window.bpLoadDeferred('gestao', 'src/modules/configuracoes/gestao.js?v=20261021-ab', onReady);
};

/** E8 — expirar-agendamento: após load, arranca watcher. */
window.bpLoadDeferredExpirar = function bpLoadDeferredExpirar(onReady) {
  window.bpLoadDeferred('expirar', 'src/modules/agenda/expirar-agendamento.js?v=20260829-e8', onReady, function () {
    try {
      if (typeof bpStartExpiringWatcher === 'function') bpStartExpiringWatcher();
    } catch (e) {
      try { console.warn('[E8] expirar watcher', e); } catch (_) {}
    }
  });
};

/** F3.6-D — carrega desktop shell/enterprise só quando ≥1024px. */
window.bpLoadDeferredDesktop = function bpLoadDeferredDesktop() {
  function needDesktop() {
    try {
      return !!(window.matchMedia && window.matchMedia('(min-width: 1024px)').matches);
    } catch (e) {
      return false;
    }
  }
  if (!needDesktop()) {
    if (!window.__bpDesktopResizeHook) {
      window.__bpDesktopResizeHook = true;
      var _t = null;
      window.addEventListener('resize', function () {
        if (_t) clearTimeout(_t);
        _t = setTimeout(function () {
          if (needDesktop()) window.bpLoadDeferredDesktop();
        }, 200);
      });
    }
    return;
  }
  window.bpLoadDeferred('desktop', [
    'src/app/desktop-shell.js?v=20260829-f36d',
    'src/app/desktop-enterprise.js?v=20260829-f36d'
  ]);
};

