/* BelezaPro D-5.3 — core/auth-supabase.js
 * Extraído de app.bundle.js (FILE: auth-supabase.js).
 *
 * ORDEM:
 *   … → db-indexeddb → supabase-resilience → auth-supabase → app.bundle.js → …
 *
 * Depende em RUNTIME (após todos os scripts):
 *   carregarDoSupabase, loadState, saveConfig, detetarTrocaDeSalao (ainda no bundle)
 *   dbGetAll (core/db-indexeddb), state, toast, SUPABASE_* (core)
 *
 * CRÍTICO: supabaseClient é var + window (sync-queue/rest usam).
 * CDN: global `supabase` deve existir antes deste script (index.html).
 *
 * Ver docs/D5_3_AUTH_SUPABASE.md
 */

// ====================================================================
//  SUPABASE — CONFIGURAÇÃO (SUPABASE_URL/ANON_KEY movidas para core-constants.js)
//  (extraído do app.js na Fase B da modularização)
// ====================================================================
var createClient = supabase.createClient; // supabase global from CDN
var supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});


/** Domínio público da app (Redirect URLs no Supabase). */
function bpAuthPublicSite() {
  try {
    if (typeof BP_AUTH_SITE_URL === 'string' && BP_AUTH_SITE_URL.trim()) {
      return BP_AUTH_SITE_URL.trim().replace(/\/$/, '');
    }
  } catch (_) {}
  try {
    var h = (location.hostname || '').toLowerCase();
    if (h && !/spck\.io|run\.spck|localhost|127\.0\.0\.1/.test(h)) {
      return location.origin;
    }
  } catch (_) {}
  return 'https://tatilson.vercel.app';
}

/**
 * URL de retorno Auth.
 * Recovery/OAuth: preferir domínio publicado (allowlist), não preview SPCK.
 */
function bpAuthRedirectTo(extraQuery) {
  var base = bpAuthPublicSite();
  var path = '/';
  try {
    var h = (location.hostname || '').toLowerCase();
    if (h && !/spck\.io|run\.spck|localhost|127\.0\.0\.1/.test(h) && location.pathname) {
      path = location.pathname;
    }
  } catch (_) {}
  var url = base.replace(/\/$/, '') + (path.indexOf('/') === 0 ? path : '/' + path);
  if (extraQuery) {
    var q = String(extraQuery).replace(/^\?/, '').replace(/^&/, '');
    url += (url.indexOf('?') >= 0 ? '&' : '?') + q;
  }
  return url;
}


/** Remove query de recovery/OAuth da barra de endereço (sem recarregar). */
function bpAuthCleanUrlParams() {
  try {
    if (typeof history === 'undefined' || !history.replaceState) return;
    var u = new URL(location.href);
    ['bp_recovery', 'type', 'code', 'error', 'error_description', 'error_code'].forEach(function (k) {
      u.searchParams.delete(k);
    });
    if (u.hash && /access_token|refresh_token|type=recovery/i.test(u.hash)) {
      u.hash = '';
    }
    history.replaceState({}, '', u.pathname + (u.search || '') + (u.hash || ''));
  } catch (_) {}
}

function bpAuthHostIsUnreliableForOAuth() {
  try {
    var h = (location.hostname || '').toLowerCase();
    return /spck\.io|run\.spck|localhost|127\.0\.0\.1/.test(h);
  } catch (_) {
    return false;
  }
}

async function bpWaitSessionFromUrl(maxMs) {
  maxMs = maxMs || 4000;
  var params = new URLSearchParams((typeof location !== 'undefined' && location.search) || '');
  var hash = (typeof location !== 'undefined' && location.hash) || '';
  var looks =
    params.has('code') ||
    params.has('bp_recovery') ||
    /type=recovery|access_token|refresh_token/i.test(hash) ||
    params.get('type') === 'recovery';
  try {
    var first = await supabaseClient.auth.getSession();
    if (first && first.data && first.data.session) return first.data.session;
  } catch (_) {}
  if (!looks) return null;
  var start = Date.now();
  while (Date.now() - start < maxMs) {
    await new Promise(function (r) { setTimeout(r, 120); });
    try {
      var res = await supabaseClient.auth.getSession();
      if (res && res.data && res.data.session) return res.data.session;
    } catch (_) {}
  }
  if (params.get('code')) {
    try {
      var ex = await supabaseClient.auth.exchangeCodeForSession(params.get('code'));
      if (ex && ex.data && ex.data.session) return ex.data.session;
      if (ex && ex.error) console.warn('[auth] exchangeCode', ex.error.message);
    } catch (e) {
      console.warn('[auth] exchangeCode', e && e.message);
    }
  }
  return null;
}

/**
 * Entrada única após Auth válida: profile → app; sem profile → login + orientação (F5).
 * source: 'password' | 'google' | 'boot' | 'signed_in'
 */
async function bpEnterFromSession(session, source) {
  try {
    if (session && session.user && session.user.id) {
      localStorage.setItem('bp_uid_cache', session.user.id);
    }
  } catch (_) {}

  source = source || 'session';
  if (!session || !session.user) return { ok: false, reason: 'no_session' };

  /* Recovery: não entrar na app — painel de nova password */
  try {
    var params = new URLSearchParams(location.search || '');
    if (params.get('bp_recovery') === '1' || params.get('type') === 'recovery') {
      if (typeof bpShowLoginShell === 'function') bpShowLoginShell();
      if (typeof bpShowAuthPanel === 'function') bpShowAuthPanel('recovery');
      else if (typeof bpShowRecoveryPanel === 'function') bpShowRecoveryPanel(true);
      return { ok: false, reason: 'recovery' };
    }
  } catch (_) {}

  var profile = null;
  var profileError = null;
  try {
    var pr = await supabaseClient
      .from('profiles')
      .select('salao_id, role, nome, bloqueado, ativo, is_owner')
      .eq('user_id', session.user.id)
      .maybeSingle();
    profileError = pr && pr.error;
    profile = pr && pr.data;
  } catch (e) {
    profileError = e;
  }


  if (profile && (profile.bloqueado === true || profile.ativo === false)) {
    try {
      if (typeof bpShowLoginShell === 'function') bpShowLoginShell();
      if (typeof bpShowAuthPanel === 'function') bpShowAuthPanel('login');
    } catch (_) {}
    var orgName = '';
    try {
      if (profile.salao_id) {
        var sn = await supabaseClient.from('saloes').select('nome').eq('id', profile.salao_id).maybeSingle();
        orgName = (sn && sn.data && sn.data.nome) || '';
      }
    } catch (_) {}
    var msgBloq =
      'O seu acesso' +
      (orgName ? ' a «' + orgName + '»' : '') +
      ' está suspenso. Contacte o responsável da organização para repor o acesso.';
    if (typeof toast === 'function') toast(msgBloq, 'error');
    try {
      if (typeof bpLoginShowError === 'function') bpLoginShowError(msgBloq);
    } catch (_) {}
    try {
      await supabaseClient.auth.signOut({ scope: 'local' });
    } catch (_) {}
    return { ok: false, reason: 'blocked', session: session };
  }

  if (!profile || !profile.salao_id) {
    try {
      if (typeof bpShowLoginShell === 'function') bpShowLoginShell();
      if (typeof bpShowAuthPanel === 'function') bpShowAuthPanel('onboarding');
    } catch (_) {}
    try {
      var meta = (session.user && session.user.user_metadata) || {};
      var emp =
        meta.empresa || meta.organization || meta.full_name || '';
      var nif = meta.nif_bi || meta.nif || '';
      var empEl = document.getElementById('onboarding-empresa');
      var nifEl = document.getElementById('onboarding-nif');
      if (empEl && emp && !empEl.value) empEl.value = String(emp);
      if (nifEl && nif && !nifEl.value) nifEl.value = String(nif);
    } catch (_) {}
    if (typeof toast === 'function') {
      toast('Indique os dados da organização para criar o espaço de trabalho.', 'info');
    }
    return { ok: false, reason: 'no_profile', session: session };
  }

  try {
    var lv = document.getElementById('login-view');
    var av = document.getElementById('app-view');
    if (lv) lv.style.display = 'none';
    if (av) av.style.display = 'flex';
  } catch (_) {}

  try {
    state.config.salaoId = profile.salao_id;
    state.config.storeName = profile.nome || state.config.storeName || 'Salão';
    state.config.userRole = profile.role;
    if (typeof bpMarkSessionLocal === 'function') bpMarkSessionLocal(profile.salao_id);
    try {
      if (profile.role) localStorage.setItem('bp_user_role', profile.role);
    } catch (_) {}
  } catch (_) {}

  try {
    if (typeof bpMarkAccountSwitch === 'function') bpMarkAccountSwitch();
    else {
      sessionStorage.setItem('bp_account_switch', '1');
      sessionStorage.removeItem('bp_boot_completed');
    }
  } catch (_) {}

  try {
    if (navigator.onLine && typeof bpShowBootOverlay === 'function') {
      bpShowBootOverlay({ reason: 'switch', maxMs: 15000, offline: false });
    }
  } catch (_) {}

  try {
    if (typeof bpFetchAcessosRemote === 'function') {
        bpFetchAcessosRemote().then(function () {
          if (typeof aplicarPermissoes === 'function') aplicarPermissoes();
        });
      } else if (typeof aplicarPermissoes === 'function') aplicarPermissoes();
  } catch (_) {}

  try {
    if (typeof detetarTrocaDeSalao === 'function') {
      var trocou = await detetarTrocaDeSalao(profile.salao_id);
      if (typeof sincronizarConfigDoServidor === 'function') await sincronizarConfigDoServidor();
      if (typeof loadState === 'function') await loadState(trocou);
    } else {
      if (typeof loadState === 'function') await loadState(false);
    }
  } catch (eLoad) {
    console.warn('[auth] loadState', eLoad && eLoad.message);
  }

  try {
    if (typeof ativarAbaAtiva === 'function') ativarAbaAtiva();
    if (typeof atualizarIndicadorSync === 'function') atualizarIndicadorSync();
    if (typeof bpHideBootOverlay === 'function') bpHideBootOverlay();
  } catch (_) {}

  if (typeof toast === 'function') {
    toast('Bem-vindo(a)' + (profile.nome ? ', ' + profile.nome : '') + '!', 'success');
  }
  try {
    if (typeof carregarHistoricoIA === 'function') carregarHistoricoIA();
  } catch (_) {}

  /* Limpar query OAuth da barra de endereço sem recarregar */
  try {
    if (location.search && (location.search.indexOf('code=') >= 0 || location.search.indexOf('bp_recovery=') >= 0)) {
      var clean = location.pathname || '/';
      history.replaceState(null, '', clean);
    }
  } catch (_) {}

  return { ok: true, profile: profile, source: source };
}

if (typeof window !== 'undefined') {
  window.bpEnterFromSession = bpEnterFromSession;
  window.bpWaitSessionFromUrl = bpWaitSessionFromUrl;
  window.bpAuthRedirectTo = bpAuthRedirectTo;
}


// ====================================================================
//  SUPABASE AUTH — LOGIN E SESSÃO
// ====================================================================
// HIERARQUIA DE ACESSO (mesmo salao_id — NÃO são espaços físicos):
//   admin (proprietário) → gerente → operador
// O proprietário é a autoridade máxima; pode restringir o que papéis
// inferiores consultam ou alteram. Autorização de dados = RLS + role
// em profiles no servidor — nunca só localStorage.
// ====================================================================
// ====================================================================
//  ITEM 3.1 — Escuta activa de alterações de estado de autenticação
//  Reage a expiração/revogação de sessão em tempo real, não apenas
//  no arranque. Distingue explicitamente de um logout voluntário
//  (que já dispara o seu próprio toast no handler do botão "Sair").
// ====================================================================
var logoutVoluntarioEmCurso = false;

/** Sessão local persistente — entrada offline sem re-login. */
/**
 * Sessão local robusta (OWASP Session Mgmt + offline-first SaaS)
 * - Flags legadas mantidas para o gate no <head>
 * - Meta JSON dual-write (localStorage + sessionStorage)
 * - Integridade: salao_id obrigatório, logout explícito (bp_logged_out)
 * - Renovação em TOKEN_REFRESHED / operações
 * Referências: OWASP Session Management Cheat Sheet, NIST SP 800-63B
 */
var BP_SESSION_META_KEY = 'bp_session_meta';
var BP_SESSION_META_SS = 'bp_session_meta_ss';

function _bpSessionUaHint() {
  try {
    var ua = String(navigator.userAgent || '');
    var h = 0;
    for (var i = 0; i < ua.length; i++) h = ((h << 5) - h + ua.charCodeAt(i)) | 0;
    return String(h);
  } catch (_) {
    return '0';
  }
}

function _bpWriteSessionMeta(meta) {
  var raw = JSON.stringify(meta);
  try { localStorage.setItem(BP_SESSION_META_KEY, raw); } catch (_) {}
  try { sessionStorage.setItem(BP_SESSION_META_SS, raw); } catch (_) {}
}

function _bpReadSessionMeta() {
  var raw = null;
  try { raw = localStorage.getItem(BP_SESSION_META_KEY); } catch (_) {}
  if (!raw) {
    try { raw = sessionStorage.getItem(BP_SESSION_META_SS); } catch (_) {}
  }
  if (!raw) return null;
  try {
    var o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : null;
  } catch (_) {
    return null;
  }
}

function bpMarkSessionLocal(salaoId) {
  try {
    var sid = salaoId != null ? String(salaoId).trim() : '';
    if (!sid) {
      try { sid = String(localStorage.getItem('bp_salao_id_cache') || '').trim(); } catch (_) {}
    }
    if (!sid) {
      // Sem salão não há sessão local válida (evita bp-has-session órfão)
      return;
    }
    localStorage.setItem('bp_salao_id_cache', sid);
    localStorage.setItem('bp_session_active', '1');
    localStorage.removeItem('bp_logged_out');
    try {
      /* Login fresco: próximo boot usa política switch (overlay até sync / 15s) */
      if (typeof bpMarkAccountSwitch === 'function') bpMarkAccountSwitch();
      else sessionStorage.setItem('bp_account_switch', '1');
    } catch (_) {}
    var role = '';
    try { role = localStorage.getItem('bp_user_role') || ''; } catch (_) {}
    var meta = {
      v: 1,
      salaoId: sid,
      role: role,
      markedAt: Date.now(),
      ua: _bpSessionUaHint()
    };
    _bpWriteSessionMeta(meta);
    try { document.documentElement.classList.add('bp-has-session'); } catch (_) {}
  } catch (_) {}
}

function bpTouchSessionLocal() {
  try {
    if (!bpHasLocalSession()) return;
    var meta = _bpReadSessionMeta() || {};
    meta.v = 1;
    meta.markedAt = Date.now();
    try { meta.salaoId = meta.salaoId || localStorage.getItem('bp_salao_id_cache') || ''; } catch (_) {}
    try { meta.role = meta.role || localStorage.getItem('bp_user_role') || ''; } catch (_) {}
    meta.ua = _bpSessionUaHint();
    _bpWriteSessionMeta(meta);
    localStorage.setItem('bp_session_active', '1');
  } catch (_) {}
}

function bpClearSessionLocal() {
  try {
    localStorage.setItem('bp_logged_out', '1');
    try { if (typeof bpClearBootSessionFlags === 'function') bpClearBootSessionFlags(); } catch (_) {}
    try { sessionStorage.removeItem('bp_boot_completed'); sessionStorage.removeItem('bp_account_switch'); } catch (_) {}
    localStorage.removeItem('bp_session_active');
    localStorage.removeItem('bp_salao_id_cache');
    localStorage.removeItem('bp_user_role');
    localStorage.removeItem('bp_plano_cache');
    localStorage.removeItem(BP_SESSION_META_KEY);
    try { sessionStorage.removeItem(BP_SESSION_META_SS); } catch (_) {}
    var toRm = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && (k.indexOf('bp_plano_cache_') === 0 || k.indexOf('bp_ia_historico_') === 0 || k.indexOf('bp_ia_chat_') === 0 || k.indexOf('ia_perguntas_') === 0 || k.indexOf('bp_ia_perguntas_') === 0)) toRm.push(k);
    }
    toRm.forEach(function (k) { try { localStorage.removeItem(k); } catch (_) {} });
    try { document.documentElement.classList.remove('bp-has-session'); } catch (_) {}
  } catch (_) {}
}

function bpHasLocalSession() {
  try {
    if (localStorage.getItem('bp_logged_out') === '1') return false;
    var active = localStorage.getItem('bp_session_active') === '1';
    var salao = localStorage.getItem('bp_salao_id_cache');
    if (active && salao) return true;
    // Recuperação: meta dual-write (se flags parciais falharam)
    var meta = _bpReadSessionMeta();
    if (meta && meta.salaoId) {
      try {
        localStorage.setItem('bp_salao_id_cache', String(meta.salaoId));
        localStorage.setItem('bp_session_active', '1');
        if (meta.role) localStorage.setItem('bp_user_role', String(meta.role));
      } catch (_) {}
      return true;
    }
  } catch (_) {}
  return false;
}

function bpShowAppShell() {
  try {
    document.documentElement.classList.add('bp-has-session');
    var login = document.getElementById('login-view');
    var app = document.getElementById('app-view');
    if (login) {
      login.style.display = 'none';
      login.classList.remove('active');
    }
    if (app) app.style.display = 'flex';
  } catch (_) {}
  bpHideSplashNow();
}

function bpShowLoginShell() {
  try {
    document.documentElement.classList.remove('bp-has-session');
    var login = document.getElementById('login-view');
    var app = document.getElementById('app-view');
    if (app) app.style.display = 'none';
    if (login) {
      login.style.display = 'flex';
      login.classList.add('active');
    }
  } catch (_) {}
  bpHideSplashNow();
}

supabaseClient.auth.onAuthStateChange((event, session) => {
  /* Link de email "reset password" → ecrã de nova palavra-passe (F2) */
  if (event === 'PASSWORD_RECOVERY') {
    try {
      if (typeof bpShowLoginShell === 'function') bpShowLoginShell();
      else {
        var lv = document.getElementById('login-view');
        var av = document.getElementById('app-view');
        if (lv) { lv.style.display = 'flex'; lv.classList.add('active'); }
        if (av) av.style.display = 'none';
      }
      if (typeof bpShowRecoveryPanel === 'function') bpShowRecoveryPanel(true);
    } catch (eRec) {
      try { console.warn('[auth] PASSWORD_RECOVERY UI', eRec); } catch (_) {}
    }
  }
  if (event === 'SIGNED_OUT' && !logoutVoluntarioEmCurso) {
    // Offline OU ainda com sessão local válida: não expulsar (offline-first)
    if (bpHasLocalSession()) {
      console.warn('[auth] SIGNED_OUT ignorado — sessão local válida');
      try { if (typeof bpTouchSessionLocal === 'function') bpTouchSessionLocal(); } catch (_) {}
      return;
    }
    document.querySelectorAll('.modal-overlay.active, .modal-overlay.open').forEach(function (m) {
      m.classList.remove('active');
      m.classList.remove('open');
    });
    bpShowLoginShell();
    if (typeof toast === 'function') toast('A sessão expirou. Inicia sessão novamente.', 'error');
  }
  // ET4.2-P0-auth: refrescar permissões quando a sessão muda (sem expulsar offline-first)
  if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
    try {
      if (typeof bpTouchSessionLocal === 'function') bpTouchSessionLocal();
      if (typeof aplicarPermissoes === 'function') aplicarPermissoes();
      if (typeof atualizarIndicadorSync === 'function') atualizarIndicadorSync();
    } catch (_) {}
  }
  if (event === 'SIGNED_IN' && session) {
    /* Step-up (Acessos): validar senha sem reentrar app nem disparar sync de login */
    if (typeof window !== 'undefined' && window.__bpAuthReauthInProgress) {
      try { if (typeof bpTouchSessionLocal === 'function') bpTouchSessionLocal(); } catch (_) {}
      return;
    }
    try {
      if (typeof bpTouchSessionLocal === 'function') bpTouchSessionLocal();
    } catch (_) {}
    /* Google / magic link: fechar circuito de entrada (não só refrescar UI) */
    try {
      var lv = document.getElementById('login-view');
      var onLogin =
        lv &&
        (lv.style.display === 'flex' ||
          lv.classList.contains('active') ||
          (lv.offsetParent !== null && (!document.getElementById('app-view') || document.getElementById('app-view').style.display === 'none')));
      if (onLogin || (lv && document.getElementById('app-view') && document.getElementById('app-view').style.display === 'none')) {
        if (typeof bpEnterFromSession === 'function') {
          bpEnterFromSession(session, 'signed_in');
        }
      } else if (typeof aplicarPermissoes === 'function') {
        aplicarPermissoes();
      }
    } catch (eSi) {
      try { console.warn('[auth] SIGNED_IN enter', eSi); } catch (_) {}
    }
  }
  logoutVoluntarioEmCurso = false;
});

/** Timeout de rede no boot — nunca bloquear a UI offline-first. */
function bpWithTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_' + (label || 'op'))), ms))
  ]);
}

(function bpApplyRoleCacheEarly() {
  try {
    const r = localStorage.getItem('bp_user_role');
    if (r && typeof state !== 'undefined' && state.config && (!state.config.userRole || state.config.userRole === 'operador')) {
      if (typeof RBAC_ROLES === 'undefined' || RBAC_ROLES.includes(r)) state.config.userRole = r;
    }
  } catch (_) {}
})();
function bpHideSplashNow() {
  try {
    const splash = document.getElementById('splash-screen');
    if (splash && splash.style.display !== 'none') {
      splash.style.opacity = '0';
      setTimeout(function () { splash.style.display = 'none'; }, 280);
    }
  } catch (_) {}
}

async function bpLoadSalaoIdLocal() {
  try {
    if (typeof dbGetAll !== 'function') return null;
    const configs = await dbGetAll('config');
    const row = (configs || []).find(c => c.key === 'salaoId' || c.id === 'salaoId');
    return row && row.value ? row.value : null;
  } catch (_) { return null; }
}

/**
 * Boot offline-first:
 * 1) Sessão local com timeout curto
 * 2) Abrir app com dados IndexedDB
 * 3) Rede (perfil/config/pull) em background — sem bloquear
 */
async function checkSession() {
  // 1) Entrada INSTANTÂNEA com cache local (sem esperar rede)
  var cachedSalao = null;
  try { cachedSalao = localStorage.getItem('bp_salao_id_cache'); } catch (_) {}
  if (!cachedSalao) {
    try { cachedSalao = await bpLoadSalaoIdLocal(); } catch (_) {}
  }
  var forceLogin = false;
  try { forceLogin = localStorage.getItem('bp_logged_out') === '1'; } catch (_) {}

  if (!forceLogin && cachedSalao) {
    state.config.salaoId = cachedSalao;
    try {
      var role = localStorage.getItem('bp_user_role');
      if (role) state.config.userRole = role;
    } catch (_) {}

    /* Overlay só se a política de produto o exigir (não duplicar se init já abriu) */
    var bootOnline = (typeof navigator !== 'undefined' && navigator.onLine);
    try {
      if (typeof bpResolveBootPolicy === 'function' && typeof bpShowBootOverlay === 'function') {
        var _pol = bpResolveBootPolicy();
        if (_pol && _pol.show) {
          bpShowBootOverlay({ reason: _pol.reason, maxMs: _pol.maxMs, offline: _pol.offline });
        }
      } else if (bootOnline && typeof bpShowBootOverlay === 'function') {
        bpShowBootOverlay({ reason: 'reload', maxMs: 2000 });
      }
    } catch (_) {}

    bpShowAppShell();
    bpMarkSessionLocal(cachedSalao);

    /* Plano: aplicar cache namespaced ANTES de pintar UI (anti-flash trial) */
    try {
      var _pc = localStorage.getItem('bp_plano_cache_' + cachedSalao);
      if (_pc && state && state.config) state.config.plano = _pc;
    } catch (_) {}

    // Dados locais sob o overlay (se online)
    try {
      await loadState(false);
    } catch (e) {
      console.warn('[boot] loadState local', e);
    }
    /* Reaplicar cache de plano se loadState não trouxe valor */
    try {
      if (state && state.config && (!state.config.plano || state.config.plano === 'trial')) {
        var _pc2 = localStorage.getItem('bp_plano_cache_' + cachedSalao);
        if (_pc2) state.config.plano = _pc2;
      }
    } catch (_) {}
    try {
      if (typeof ativarAbaAtiva === 'function') ativarAbaAtiva();
      if (typeof aplicarPermissoes === 'function') aplicarPermissoes();
      if (typeof atualizarIndicadorSync === 'function') atualizarIndicadorSync();
      if (typeof renderPlanoInfo === 'function') renderPlanoInfo();
      if (typeof updateUI === 'function') updateUI();
    } catch (_) {}

    // Rede imediata — overlay já está aberto; sem setTimeout artificial
    if (bootOnline) {
      Promise.resolve()
        .then(function () {
          return bpWithTimeout(supabaseClient.auth.getSession(), 1500, 'getSession_bg');
        })
        .then(function (res) {
          var session = res && res.data ? res.data.session : null;
          if (!session) return null;
          return bpWithTimeout(
            supabaseClient.from('profiles').select('salao_id, role, nome, bloqueado, ativo, is_owner').eq('user_id', session.user.id).single(),
            2000,
            'profile_bg'
          );
        })
        .then(function (pr) {
          if (!pr || !pr.data) return;
          var profile = pr.data;
          if (profile.salao_id) {
            state.config.salaoId = profile.salao_id;
            bpMarkSessionLocal(profile.salao_id);
          }
          if (profile.role) {
            state.config.userRole = profile.role;
            try { localStorage.setItem('bp_user_role', profile.role); } catch (_) {}
          }
          if (profile.nome) state.config.storeName = profile.nome || state.config.storeName;
          if (typeof saveConfig === 'function') return saveConfig();
        })
        .then(function () {
          if (typeof sincronizarConfigDoServidor === 'function') return sincronizarConfigDoServidor();
        })
        .then(function () {
          var pullP = null;
          if (typeof bpSilentPull === 'function') pullP = bpSilentPull(true);
          else if (typeof carregarDoSupabase === 'function') pullP = carregarDoSupabase();
          if (!pullP) return null;
          return pullP;
        })
        .then(function () {
          try { if (typeof bpHideBootOverlay === 'function') bpHideBootOverlay(); } catch (_) {}
          try { window.__bpQuietUI = true; } catch (_) {}
          if (typeof updateUI === 'function') updateUI();
          if (typeof atualizarIndicadorSync === 'function') atualizarIndicadorSync();
          try { setTimeout(function () { window.__bpQuietUI = false; }, 1500); } catch (_) {}
          try { if (typeof bpCheckExpiringAppointments === 'function') bpCheckExpiringAppointments(); } catch (_) {}
        })
        .catch(function (err) {
          if (navigator.onLine !== false) console.warn('[boot] sync online', err && err.message);
          try { if (typeof bpBootShowFail === 'function') bpBootShowFail(); } catch (_) {}
          /* Mesmo em falha: não deixar overlay eterno — fail UI ou fechar em 2s */
          setTimeout(function () {
            try {
              if (document.documentElement.classList.contains('bp-booting')) {
                if (typeof bpHideBootOverlay === 'function') bpHideBootOverlay();
              }
            } catch (_) {}
          }, 2000);
        });
    } else {
      /* Offline com cache: fechar overlay imediatamente após dados locais */
      try { if (typeof bpHideBootOverlay === 'function') bpHideBootOverlay(); } catch (_) {}
    }

    return;
  }

  // 2) Sem cache local: só aqui tentamos rede (timeout curto)
  try {
    var session = null;
    if (navigator.onLine) {
      try {
        if (typeof bpWaitSessionFromUrl === 'function') {
          session = await bpWithTimeout(bpWaitSessionFromUrl(4500), 5000, 'waitSessionUrl');
        }
        if (!session) {
          var res = await bpWithTimeout(supabaseClient.auth.getSession(), 1800, 'getSession');
          session = res && res.data ? res.data.session : null;
        }
      } catch (e) {
        if (navigator.onLine !== false) console.warn('[boot] getSession falhou/timeout', e && e.message);
        session = null;
      }
    }

    if (!session) {
      // Offline e sem cache = login; online sem sessão = login
      bpShowLoginShell();
      return;
    }

    /* Recovery ou Google: caminho único */
    try {
      var paramsBoot = new URLSearchParams(location.search || '');
      if (paramsBoot.get('bp_recovery') === '1' || paramsBoot.get('type') === 'recovery') {
        bpShowLoginShell();
        if (typeof bpShowAuthPanel === 'function') bpShowAuthPanel('recovery');
        else if (typeof bpShowRecoveryPanel === 'function') bpShowRecoveryPanel(true);
        return;
      }
    } catch (_) {}

    /* Se estamos no ecrã de login após OAuth, entrar via helper */
    try {
      var lvBoot = document.getElementById('login-view');
      if (lvBoot && (lvBoot.style.display !== 'none') && typeof bpEnterFromSession === 'function') {
        var ent = await bpEnterFromSession(session, 'boot');
        if (ent && ent.ok) return;
        if (ent && ent.reason === 'no_profile') return;
        if (ent && ent.reason === 'recovery') return;
      }
    } catch (eEnt) {
      console.warn('[boot] enterFromSession', eEnt && eEnt.message);
    }

    bpShowAppShell();
    try {
      if (typeof bpMarkAccountSwitch === 'function') bpMarkAccountSwitch();
      else sessionStorage.setItem('bp_account_switch', '1');
    } catch (_) {}
    if (navigator.onLine) {
      try {
        if (typeof bpShowBootOverlay === 'function') {
          bpShowBootOverlay({ reason: 'switch', maxMs: 15000, offline: false });
        }
      } catch (_) {}
    }

    var profile = null;
    try {
      var pr = await bpWithTimeout(
        supabaseClient.from('profiles').select('salao_id, role, nome, bloqueado, ativo, is_owner').eq('user_id', session.user.id).single(),
        2500,
        'profile'
      );
      profile = pr && pr.data;
    } catch (e) {
      console.warn('[boot] profile', e && e.message);
    }

    if (profile && profile.salao_id) {
      state.config.salaoId = profile.salao_id;
      state.config.storeName = profile.nome || state.config.storeName || 'Salão';
      state.config.userRole = profile.role;
      try { if (profile.role) localStorage.setItem('bp_user_role', profile.role); } catch (_) {}
      bpMarkSessionLocal(profile.salao_id);
      if (typeof saveConfig === 'function') {
        try { await saveConfig(); } catch (_) {}
      }
    } else {
      var localSalao = cachedSalao || (await bpLoadSalaoIdLocal());
      if (localSalao) {
        state.config.salaoId = localSalao;
        bpMarkSessionLocal(localSalao);
      }
    }

    var trocouDeSalao = false;
    try {
      if (typeof detetarTrocaDeSalao === 'function' && state.config.salaoId) {
        trocouDeSalao = await detetarTrocaDeSalao(state.config.salaoId);
        if (trocouDeSalao) {
          try {
            if (typeof bpMarkAccountSwitch === 'function') bpMarkAccountSwitch();
            else sessionStorage.setItem('bp_account_switch', '1');
          } catch (_) {}
        }
      }
    } catch (_) {}

    if (typeof aplicarPermissoes === 'function') aplicarPermissoes();
    try { await loadState(trocouDeSalao); } catch (e) { console.warn('[boot] loadState', e); }
    if (typeof ativarAbaAtiva === 'function') ativarAbaAtiva();
    if (typeof atualizarIndicadorSync === 'function') atualizarIndicadorSync();

    if (navigator.onLine) {
      Promise.resolve()
        .then(function () { return typeof sincronizarConfigDoServidor === 'function' ? sincronizarConfigDoServidor() : null; })
        .then(function () {
          var pullP = null;
          if (typeof bpSilentPull === 'function') pullP = bpSilentPull(true);
          else if (typeof carregarDoSupabase === 'function') pullP = carregarDoSupabase();
          return pullP;
        })
        .then(function () {
          try { if (typeof bpHideBootOverlay === 'function') bpHideBootOverlay(); } catch (_) {}
          if (typeof updateUI === 'function') updateUI();
        })
        .catch(function (err) {
          if (navigator.onLine !== false) console.warn('[boot] pull inicial', err && err.message);
          try { if (typeof bpBootShowFail === 'function') bpBootShowFail(); } catch (_) {}
        });
    } else {
      try { if (typeof bpHideBootOverlay === 'function') bpHideBootOverlay(); } catch (_) {}
    }
  } catch (err) {
    console.error('[boot] checkSession', err);
    // Último recurso: cache local mesmo com erro
    try {
      var fallback = null;
      try { fallback = localStorage.getItem('bp_salao_id_cache'); } catch (_) {}
      if (!fallback) fallback = await bpLoadSalaoIdLocal();
      if (fallback && !forceLogin) {
        state.config.salaoId = fallback;
        bpShowAppShell();
        try { await loadState(false); } catch (_) {}
        if (typeof ativarAbaAtiva === 'function') ativarAbaAtiva();
        return;
      }
    } catch (_) {}
    bpShowLoginShell();
  }
}


async function getAuthHeaders() {
  // 1) Sessão actual
  let session = null;
  try {
    const res = await supabaseClient.auth.getSession();
    session = res && res.data ? res.data.session : null;
  } catch (_) {
    session = null;
  }

  // 2) Se não há token, tenta renovar (evita "sessão expirada" em cada pedido)
  if (!session || !session.access_token) {
    try {
      const refreshed = await supabaseClient.auth.refreshSession();
      session = refreshed && refreshed.data ? refreshed.data.session : null;
      if (session && session.access_token) {
        try {
          if (typeof bpTouchSessionLocal === 'function') bpTouchSessionLocal();
        } catch (_) {}
      }
    } catch (_) {
      session = null;
    }
  }

  // 3) Token próximo de expirar (< 60s) → renovar proactivamente
  if (session && session.access_token && session.expires_at) {
    var expiresAtMs = Number(session.expires_at) * 1000;
    if (isFinite(expiresAtMs) && expiresAtMs - Date.now() < 60 * 1000) {
      try {
        const refreshed = await supabaseClient.auth.refreshSession();
        var s2 = refreshed && refreshed.data ? refreshed.data.session : null;
        if (s2 && s2.access_token) {
          session = s2;
          try {
            if (typeof bpTouchSessionLocal === 'function') bpTouchSessionLocal();
          } catch (_) {}
        }
      } catch (_) {}
    }
  }

  if (!session || !session.access_token) {
    throw new Error('SESSION_EXPIRED');
  }
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${session.access_token}`
  };
}

async function garantirSalaoRemoto() {
  if (!state.config.salaoId) return;
  try {
    const authHeaders = await getAuthHeaders();
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/saloes?id=eq.${encodeURIComponent(state.config.salaoId)}`,
      { headers: authHeaders }
    );
    const rows = await resp.json();
    if (rows.length === 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/saloes`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          ...authHeaders,
          'Prefer':        'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          id:   state.config.salaoId,
          nome: state.config.storeName,
        }),
      });
    }
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED') {
      await supabaseClient.auth.signOut();
      return;
    }
  }
}

async function sincronizarConfigDoServidor() {
  if (!state.config.salaoId || !navigator.onLine) return;
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) return;
    const authHeaders = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken}`,
    };
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/salao_config?salao_id=eq.${state.config.salaoId}&select=plano,trial_inicio`,
      { headers: authHeaders }
    );
    if (!resp.ok) return;
    const rows = await resp.json();
    if (rows.length > 0) {
      var planoAnterior = state.config.plano;
      var trialAnterior = state.config.trialInicio;
      state.config.plano       = rows[0].plano || 'trial';
      state.config.trialInicio = rows[0].trial_inicio || state.config.trialInicio;
      try {
        if (state.config.salaoId) {
          localStorage.setItem('bp_plano_cache_' + state.config.salaoId, state.config.plano);
        }
        localStorage.removeItem('bp_plano_cache'); // legacy global
      } catch (_) {}
      await saveConfig();
      if (state.config.plano !== planoAnterior || state.config.trialInicio !== trialAnterior) {
        if (typeof renderPlanoInfo === 'function') renderPlanoInfo();
      }
      // ET4.5: reconciliar contador de recibos com servidor + movimentos
      try {
        if (typeof bpSyncReciboCounter === 'function') await bpSyncReciboCounter();
      } catch (_) {}
      try {
        if (typeof bpPullIAUsoFromSupabase === 'function') await bpPullIAUsoFromSupabase();
      } catch (_) {}
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/salao_config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          salao_id: state.config.salaoId,
          plano: state.config.plano || 'trial',
          trial_inicio: state.config.trialInicio || new Date().toISOString(),
        }),
      });
    }
  } catch (err) {
    console.error('Falha ao sincronizar configuração do salão:', err);
  }
}

// Login

function bpLoginShowError(msg) {
  var el = document.getElementById('login-error');
  if (!el) {
    if (typeof toast === 'function') toast(msg, 'error');
    return;
  }
  el.textContent = msg || '';
  if (msg) {
    el.hidden = false;
    el.removeAttribute('hidden');
  } else {
    el.hidden = true;
    el.setAttribute('hidden', '');
  }
}

function bpLoginMapAuthError(error) {
  var raw = (error && (error.message || error.error_description || error.code)) ? String(error.message || error.error_description || error.code) : '';
  var low = raw.toLowerCase();
  if (low.indexOf('email not confirmed') >= 0 || low.indexOf('not confirmed') >= 0) {
    return 'Confirme o email antes de iniciar sessão. Verifique a caixa de entrada.';
  }
  if (low.indexOf('invalid login') >= 0 || low.indexOf('invalid credentials') >= 0 || low.indexOf('invalid_grant') >= 0) {
    return bpAuthT('login_bad');
  }
  if (low.indexOf('too many') >= 0 || low.indexOf('rate') >= 0) {
    return 'Demasiadas tentativas. Aguarde um momento e tente novamente.';
  }
  if (low.indexOf('network') >= 0 || low.indexOf('fetch') >= 0) {
    return bpAuthT('login_network');
  }
  return 'Não foi possível iniciar sessão. Tente novamente.';
}

document.getElementById('login-btn').addEventListener('click', async function() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();
  try { bpLoginShowError(''); } catch (_) {}
  /* Ordem: email → senha (nunca acusar senha se o email ainda é inválido) */
  if (!email) {
    bpLoginShowError(bpAuthT('login_empty_email'));
    try { document.getElementById('login-email').focus(); } catch (e) {}
    return;
  }
  var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  if (!emailOk) {
    bpLoginShowError(bpAuthT('err_email'));
    try { document.getElementById('login-email').focus(); } catch (e) {}
    return;
  }
  if (!password) {
    bpLoginShowError(bpAuthT('login_empty_pass'));
    try { document.getElementById('login-password').focus(); } catch (e) {}
    return;
  }
  setButtonLoading(this, true);
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data || !data.session) throw new Error('Sessão não criada');
    const entered = await bpEnterFromSession(data.session, 'password');
    if (!entered || !entered.ok) {
      /* sem profile: UI já orientada em bpEnterFromSession */
      return;
    }
    var profile = entered.profile;
    // Onboarding (Fase 2)
    if (!localStorage.getItem('bp_onboarding_seen')) {
      // ============================================================
      // CORREÇÃO: remover splash manualmente
      // ============================================================
      try { if (typeof hideSplash === 'function') hideSplash(); } catch (_) {}
      const onbEl = document.getElementById('onboarding-screen');
      onbEl.style.display = 'flex';
      // Bloqueia toques nos primeiros 500ms
      onbEl.style.pointerEvents = 'none';
      setTimeout(() => { onbEl.style.pointerEvents = 'auto'; }, 500);
      showOnboardingSlide(0);
    }
    if (typeof aplicarAcessibilidade === 'function') aplicarAcessibilidade();
  } catch (err) {
    if (typeof Sentry !== 'undefined' && Sentry.captureException) {
      Sentry.captureException(err, { tags: { action: 'login' }, extra: { email } });
    }
    /*
     * Auth falhou após formato de email válido.
     * Supabase (e a maioria dos IdP) devolve o mesmo código para
     * email inexistente e palavra-passe errada (anti-enumeração).
     * Mensagem honesta cobre ambos; se o backend distinguir
     * "user not found", bpToastMsgPT mapeia para "Email não encontrado.".
     */
    var raw = (err && err.message) ? String(err.message) : '';
    var low = raw.toLowerCase();
    var _loginMsg;
    if (/email not confirmed/.test(low)) {
      _loginMsg = 'Confirme o email antes de entrar.';
    } else if (/too many requests|rate limit/.test(low)) {
      _loginMsg = 'Demasiadas tentativas. Aguarde um momento.';
    } else if (/network|fetch|offline/.test(low)) {
      _loginMsg = 'Sem ligação à rede. Tente novamente.';
    } else if (/user not found|user_not_found|no user found|invalid login|invalid_credentials|invalid email or password/.test(low)) {
      _loginMsg = 'Email ou palavra-passe incorrectos.';
      try { document.getElementById('login-password').focus(); } catch (e) {}
    } else if (typeof bpToastMsgPT === 'function') {
      _loginMsg = bpToastMsgPT(raw);
      if (!_loginMsg || (!/[àáãâéêíóôõúç]/i.test(_loginMsg) && /invalid|credential/i.test(_loginMsg))) {
        _loginMsg = 'Email ou palavra-passe incorrectos.';
      }
    } else {
      _loginMsg = 'Email ou palavra-passe incorrectos.';
    }
    try { bpLoginShowError(_loginMsg); } catch (_) {}
    if (typeof toast === 'function') toast(_loginMsg, 'error');
  } finally {
    setButtonLoading(this, false);
  }
});

/* F1 — mostrar/ocultar palavra-passe, recuperar, Google */
(function bpBindLoginExtras() {
  function bind() {
    var tog = document.getElementById('login-pass-toggle');
    var inp = document.getElementById('login-password');
    if (tog && inp && !tog.dataset.bpBound) {
      tog.dataset.bpBound = '1';
      tog.addEventListener('click', function () {
        var show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        var icShow = tog.querySelector('.login-pass-icon-show');
        var icHide = tog.querySelector('.login-pass-icon-hide');
        if (icShow && icHide) {
          if (show) {
            icShow.setAttribute('hidden', '');
            icHide.removeAttribute('hidden');
          } else {
            icHide.setAttribute('hidden', '');
            icShow.removeAttribute('hidden');
          }
        }
        tog.setAttribute('aria-label', show ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe');
        tog.setAttribute('title', show ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe');
      });
    }

    var forgot = document.getElementById('login-forgot-btn');
    if (forgot && !forgot.dataset.bpBound) {
      forgot.dataset.bpBound = '1';
      forgot.addEventListener('click', async function () {
        var email = (document.getElementById('login-email') && document.getElementById('login-email').value || '').trim();
        try { bpLoginShowError(''); } catch (_) {}
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
          var m = 'Indique o email da conta para recuperar a palavra-passe.';
          try { bpLoginShowError(m); } catch (_) {}
          if (typeof toast === 'function') toast(m, 'warning');
          try { document.getElementById('login-email').focus(); } catch (_) {}
          return;
        }
        if (!navigator.onLine) {
          var off = 'É necessária ligação à internet para recuperar a palavra-passe.';
          try { bpLoginShowError(off); } catch (_) {}
          if (typeof toast === 'function') toast(off, 'warning');
          return;
        }
        forgot.disabled = true;
        try {
          var redirectTo = typeof bpAuthRedirectTo === 'function'
            ? bpAuthRedirectTo('bp_recovery=1')
            : ('https://tatilson.vercel.app/?bp_recovery=1');
          var res = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });
          if (res && res.error) throw res.error;
          var ok =
            'Se existir conta com este email, receberá um link para redefinir a palavra-passe. ' +
            'Abra o link no telemóvel/PC (preferência: tatilson.vercel.app).';
          try { bpLoginShowError(''); } catch (_) {}
          if (typeof toast === 'function') toast('Email de recuperação enviado (se a conta existir).', 'success');
          try {
            var lead = document.getElementById('login-error');
            if (lead) {
              lead.textContent = ok;
              lead.hidden = false;
              lead.removeAttribute('hidden');
            }
          } catch (_) {}
        } catch (err) {
          var raw = err && err.message ? String(err.message) : '';
          var msg = 'Não foi possível enviar a recuperação. Tente mais tarde.';
          if (/redirect/i.test(raw) || /not allowed|whitelist|allowlist/i.test(raw)) {
            msg =
              'URL de retorno não autorizada no Supabase. Em Authentication → URL Configuration, adicione https://tatilson.vercel.app/**';
          } else if (/rate|limit|too many/i.test(raw)) {
            msg = 'Demasiadas tentativas. Aguarde alguns minutos.';
          } else if (/network|fetch|failed/i.test(raw)) {
            msg = 'Falha de rede. Verifique a ligação e tente de novo.';
          } else if (/email/i.test(raw) && /invalid/i.test(raw)) {
            msg = bpAuthT('err_email');
          }
          try { console.warn('[auth] resetPassword', raw); } catch (_) {}
          try { bpLoginShowError(msg); } catch (_) {}
          if (typeof toast === 'function') toast(msg, 'error');
        } finally {
          forgot.disabled = false;
        }
      });
    }

    var gBtn = document.getElementById('login-google-btn');
    if (gBtn && !gBtn.dataset.bpBound) {
      gBtn.dataset.bpBound = '1';
      gBtn.addEventListener('click', async function () {
        try { bpLoginShowError(''); } catch (_) {}
        if (!navigator.onLine) {
          var off = 'É necessária ligação à internet para continuar com Google.';
          try { bpLoginShowError(off); } catch (_) {}
          if (typeof toast === 'function') toast(off, 'warning');
          return;
        }
        gBtn.disabled = true;
        try {
          if (typeof bpAuthHostIsUnreliableForOAuth === 'function' && bpAuthHostIsUnreliableForOAuth()) {
            var warnHost =
              'O acesso com Google deve ser concluído em https://tatilson.vercel.app (ou o domínio configurado no Supabase). Este ambiente de preview não fecha o circuito OAuth.';
            try { bpLoginShowError(warnHost); } catch (_) {}
            if (typeof toast === 'function') toast(warnHost, 'warning');
            gBtn.disabled = false;
            return;
          }
          var redirectTo = typeof bpAuthRedirectTo === 'function' ? bpAuthRedirectTo('') : ((location.origin || '') + (location.pathname || '/'));
          var res = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: redirectTo,
              queryParams: { prompt: 'select_account', access_type: 'online' }
            }
          });
          if (res && res.error) throw res.error;
          if (res && res.data && res.data.url) {
            window.location.href = res.data.url;
            return;
          }
          /* Redirect em curso via client */
        } catch (err) {
          var raw = err && err.message ? String(err.message) : '';
          var msg = /provider|not enabled|unsupported/i.test(raw)
            ? 'O acesso com Google ainda não está activo neste projecto. Use email e palavra-passe.'
            : 'Não foi possível continuar com Google. Tente email e palavra-passe.';
          try { bpLoginShowError(msg); } catch (_) {}
          if (typeof toast === 'function') toast(msg, 'warning');
          gBtn.disabled = false;
        }
      });
    }

    var pass = document.getElementById('login-password');
    if (pass && !pass.dataset.bpEnter) {
      pass.dataset.bpEnter = '1';
      pass.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          var b = document.getElementById('login-btn');
          if (b) b.click();
        }
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();

if (typeof window !== 'undefined') {
  window.bpMarkSessionLocal = bpMarkSessionLocal;
  window.bpClearSessionLocal = bpClearSessionLocal;
  window.bpHasLocalSession = bpHasLocalSession;
  window.bpTouchSessionLocal = bpTouchSessionLocal;
  window.bpAuthPublicSite = bpAuthPublicSite;
  window.bpAuthRedirectTo = bpAuthRedirectTo;
  window.bpAuthCleanUrlParams = bpAuthCleanUrlParams;
}

/* D-5.3: API pública Auth (Sync/CRUD/UI consomem em runtime) */
if (typeof window !== 'undefined') {
  window.supabaseClient = supabaseClient;
  window.logoutVoluntarioEmCurso = logoutVoluntarioEmCurso;
  window.getAuthHeaders = getAuthHeaders;
  window.checkSession = checkSession;
  window.garantirSalaoRemoto = garantirSalaoRemoto;
  window.sincronizarConfigDoServidor = sincronizarConfigDoServidor;
  window.bpShowAppShell = bpShowAppShell;
  window.bpShowLoginShell = bpShowLoginShell;
  window.bpLoadSalaoIdLocal = bpLoadSalaoIdLocal;
  window.bpHideSplashNow = bpHideSplashNow;
  window.bpWithTimeout = bpWithTimeout;
  window.bpMarkSessionLocal = bpMarkSessionLocal;
  window.bpClearSessionLocal = bpClearSessionLocal;
  window.bpHasLocalSession = bpHasLocalSession;
  window.bpTouchSessionLocal = bpTouchSessionLocal;
}



function bpRecoveryShowError(msg) {
  var el = document.getElementById('recovery-error');
  if (!el) {
    if (typeof toast === 'function') toast(msg, 'error');
    return;
  }
  el.textContent = msg || '';
  if (msg) {
    el.hidden = false;
    el.removeAttribute('hidden');
  } else {
    el.hidden = true;
    el.setAttribute('hidden', '');
  }
}

function bpPasswordStrongEnough(pw) {
  return !!(pw && pw.length >= 8);
}

(function bpBindRecoveryUi() {
  function bindToggle(btnId) {
    var tog = document.getElementById(btnId);
    if (!tog || tog.dataset.bpBound) return;
    tog.dataset.bpBound = '1';
    tog.addEventListener('click', function () {
      var targetId = tog.getAttribute('data-target') || 'login-password';
      var inp = document.getElementById(targetId);
      if (!inp) return;
      var show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      var icShow = tog.querySelector('.login-pass-icon-show');
      var icHide = tog.querySelector('.login-pass-icon-hide');
      if (icShow && icHide) {
        if (show) {
          icShow.setAttribute('hidden', '');
          icHide.removeAttribute('hidden');
        } else {
          icHide.setAttribute('hidden', '');
          icShow.removeAttribute('hidden');
        }
      }
      tog.setAttribute('aria-label', show ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe');
    });
  }

  function bind() {
    bindToggle('recovery-pass-toggle');

    var back = document.getElementById('recovery-back-login');
    if (back && !back.dataset.bpBound) {
      back.dataset.bpBound = '1';
      back.addEventListener('click', function () {
        bpShowRecoveryPanel(false);
        try {
          if (typeof supabaseClient !== 'undefined' && supabaseClient.auth) {
            supabaseClient.auth.signOut({ scope: 'local' }).catch(function () {});
          }
        } catch (_) {}
      });
    }

    var submit = document.getElementById('recovery-submit-btn');
    if (submit && !submit.dataset.bpBound) {
      submit.dataset.bpBound = '1';
      submit.addEventListener('click', async function () {
        bpRecoveryShowError('');
        var p1 = (document.getElementById('recovery-password') && document.getElementById('recovery-password').value) || '';
        var p2 = (document.getElementById('recovery-password-2') && document.getElementById('recovery-password-2').value) || '';
        if (!bpPasswordStrongEnough(p1)) {
          bpRecoveryShowError('A palavra-passe deve ter pelo menos 8 caracteres.');
          return;
        }
        if (p1 !== p2) {
          bpRecoveryShowError(bpAuthT('err_pass2'));
          return;
        }
        if (!navigator.onLine) {
          bpRecoveryShowError('É necessária ligação à internet para guardar a nova palavra-passe.');
          return;
        }
        if (typeof setButtonLoading === 'function') setButtonLoading(submit, true);
        else submit.disabled = true;
        try {
          var sess = await supabaseClient.auth.getSession();
          var session = sess && sess.data && sess.data.session;
          if (!session) {
            bpRecoveryShowError('Link inválido ou expirado. Peça um novo email de recuperação.');
            return;
          }
          var res = await supabaseClient.auth.updateUser({ password: p1 });
          if (res && res.error) throw res.error;
          if (typeof toast === 'function') {
            toast('Palavra-passe actualizada. Já pode iniciar sessão.', 'success');
          }
          try {
            if (typeof bpInfoEntendi === 'function') {
              bpInfoEntendi(
                'A palavra-passe foi actualizada. Use o email e a nova palavra-passe para iniciar sessão.',
                'Palavra-passe actualizada'
              );
            }
          } catch (_) {}
          try {
            await supabaseClient.auth.signOut({ scope: 'local' });
          } catch (_) {}
          try {
            if (typeof bpAuthCleanUrlParams === 'function') bpAuthCleanUrlParams();
          } catch (_) {}
          bpShowRecoveryPanel(false);
          try {
            var pe = document.getElementById('recovery-password');
            var pe2 = document.getElementById('recovery-password-2');
            if (pe) pe.value = '';
            if (pe2) pe2.value = '';
          } catch (_) {}
          try {
            var loginPass = document.getElementById('login-password');
            if (loginPass) loginPass.value = '';
            var em = document.getElementById('login-email');
            if (em) em.focus();
          } catch (_) {}
        } catch (err) {
          var raw = err && err.message ? String(err.message) : '';
          var msg = /session|expired|token/i.test(raw)
            ? 'Link inválido ou expirado. Peça um novo email de recuperação.'
            : 'Não foi possível actualizar a palavra-passe.';
          if (/same password|should be different/i.test(raw)) {
            msg = 'Escolha uma palavra-passe diferente da anterior.';
          }
          bpRecoveryShowError(msg);
        } finally {
          if (typeof setButtonLoading === 'function') setButtonLoading(submit, false);
          else submit.disabled = false;
        }
      });
    }

    try {
      if (typeof location !== 'undefined' && /bp_recovery=1/.test(location.search || '')) {
        setTimeout(async function () {
          try {
            var s = await supabaseClient.auth.getSession();
            if (s && s.data && s.data.session) {
              if (typeof bpShowLoginShell === 'function') bpShowLoginShell();
              bpShowRecoveryPanel(true);
              try {
                if (typeof bpAuthCleanUrlParams === 'function') bpAuthCleanUrlParams();
              } catch (_) {}
            }
          } catch (_) {}
        }, 400);
      }
    } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();

if (typeof window !== 'undefined') {
  window.bpShowRecoveryPanel = bpShowRecoveryPanel;
}


/** F4 — painéis login | recovery | signup (só um visível) */
function bpShowAuthPanel(mode) {
  var main = document.getElementById('login-card-main');
  var rec = document.getElementById('login-recovery-card');
  var sig = document.getElementById('login-signup-card');
  var onb = document.getElementById('login-onboarding-card');
  function setEl(el, on) {
    if (!el) return;
    if (on) {
      el.hidden = false;
      el.removeAttribute('hidden');
      el.style.display = '';
    } else {
      el.hidden = true;
      el.setAttribute('hidden', '');
      el.style.display = 'none';
    }
  }
  setEl(main, mode === 'login');
  setEl(rec, mode === 'recovery');
  setEl(sig, mode === 'signup');
  if (mode === 'signup') {
    try {
      var draft = typeof bpSignupLoadDraft === 'function' ? bpSignupLoadDraft() : null;
      var startStep = 1;
      if (draft && draft.step >= 1 && draft.step <= 6) {
        startStep = draft.step | 0;
        if (startStep < 1) startStep = 1;
      }
      if (typeof bpSignupSetStep === 'function') bpSignupSetStep(startStep);
      if (typeof bpSignupSyncCta === 'function') bpSignupSyncCta();
    } catch (e) {
      try { console.warn('[signup] setStep', e); } catch (_) {}
      try { if (typeof bpSignupSetStep === 'function') bpSignupSetStep(1); } catch (_) {}
    }
  }
  setEl(onb, mode === 'onboarding');
  try {
    ['login-error', 'recovery-error', 'signup-error'].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) {
        e.textContent = '';
        e.hidden = true;
        e.setAttribute('hidden', '');
      }
    });
    var ok = document.getElementById('signup-success');
    if (ok) {
      ok.textContent = '';
      ok.hidden = true;
      ok.setAttribute('hidden', '');
    }
  } catch (_) {}
}

/* Compat F2 */
function bpShowRecoveryPanel(show) {
  bpShowAuthPanel(show ? 'recovery' : 'login');
}

function bpSignupShowError(msg) {
  var el = document.getElementById('signup-error');
  if (!el) {
    try { console.warn('[signup]', msg); } catch (_) {}
    return;
  }
  el.textContent = msg || '';
  if (msg) {
    el.hidden = false;
    el.removeAttribute('hidden');
  } else {
    el.hidden = true;
    el.setAttribute('hidden', '');
  }
}

function bpSignupShowSuccess(msg) {
  var el = document.getElementById('signup-success');
  if (!el) return;
  el.textContent = msg || '';
  if (msg) {
    el.hidden = false;
    el.removeAttribute('hidden');
  } else {
    el.hidden = true;
    el.setAttribute('hidden', '');
  }
}


/** Criar conta — 6 passos, erros no campo, sem toast neste circuito */
function bpAuthT(key, vars) {
  try {
    if (window.bpAuthI18n && typeof window.bpAuthI18n.t === 'function') {
      return window.bpAuthI18n.t(key, vars);
    }
  } catch (_) {}
  return key;
}

var __bpSignupStep = 1;
var __bpSignupMax = 6;
/** Rascunho do wizard — nunca inclui palavra-passe */
var BP_SIGNUP_DRAFT_KEY = 'bp_signup_draft_v1';
/** Versão dos termos aceites no acto de criar (fonte única no cliente) */
var BP_SIGNUP_TERMS_VERSION = '1.0.0';
/** Dias do plano gratuito — fonte única no cliente (pode ser sobrescrito por window.BP_FREE_TRIAL_DAYS) */
var BP_FREE_TRIAL_DAYS = (typeof window !== 'undefined' && window.BP_FREE_TRIAL_DAYS != null)
  ? (parseInt(window.BP_FREE_TRIAL_DAYS, 10) || 14)
  : 14;




function bpSignupGetTermsVersion() {
  var box = document.getElementById('signup-terms-box');
  var fromDom = box && box.getAttribute('data-terms-version');
  return (fromDom && String(fromDom).trim()) || BP_SIGNUP_TERMS_VERSION || '1.0.0';
}

function bpSignupSaveDraft() {
  try {
    var data = {
      v: 1,
      step: __bpSignupStep | 0,
      empresa: ((document.getElementById('signup-empresa') && document.getElementById('signup-empresa').value) || '').trim(),
      localizacao: ((document.getElementById('signup-localizacao') && document.getElementById('signup-localizacao').value) || '').trim(),
      nif: ((document.getElementById('signup-nif') && document.getElementById('signup-nif').value) || '').trim(),
      email: ((document.getElementById('signup-email') && document.getElementById('signup-email').value) || '').trim(),
      terms: !!(document.getElementById('signup-terms') && document.getElementById('signup-terms').checked),
      savedAt: Date.now()
      /* password intencionalmente omitida */
    };
    sessionStorage.setItem(BP_SIGNUP_DRAFT_KEY, JSON.stringify(data));
  } catch (_) {}
}

function bpSignupClearDraft() {
  try {
    sessionStorage.removeItem(BP_SIGNUP_DRAFT_KEY);
  } catch (_) {}
}

function bpSignupLoadDraft() {
  try {
    var raw = sessionStorage.getItem(BP_SIGNUP_DRAFT_KEY);
    if (!raw) return null;
    var data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    function setVal(id, val) {
      var el = document.getElementById(id);
      if (!el || val == null || val === '') return;
      if (el.type === 'checkbox') {
        el.checked = !!val;
      } else if (!String(el.value || '').trim()) {
        el.value = String(val);
      } else {
        /* já tem valor digitado nesta sessão — não sobrescrever */
      }
    }
    /* Sempre restaurar se o campo estiver vazio; email/empresa úteis após reload */
    setVal('signup-empresa', data.empresa);
    setVal('signup-localizacao', data.localizacao);
    setVal('signup-nif', data.nif);
    setVal('signup-email', data.email);
    if (data.terms) {
      var ck = document.getElementById('signup-terms');
      if (ck) ck.checked = true;
    }
    /* Nunca restaurar password */
    var pwd = document.getElementById('signup-password');
    var pwd2 = document.getElementById('signup-password-2');
    if (pwd) pwd.value = '';
    if (pwd2) pwd2.value = '';
    return data;
  } catch (_) {
    return null;
  }
}


function bpSignupClearFieldErrors() {
  ['signup-empresa', 'signup-localizacao', 'signup-nif', 'signup-email', 'signup-password', 'signup-password-2', 'signup-terms'].forEach(function (id) {
    var err = document.getElementById('err-' + id);
    if (err) {
      err.textContent = '';
      err.hidden = true;
    }
    var grp = document.querySelector('.input-group[data-field="' + id + '"]');
    if (grp) grp.classList.remove('is-invalid');
  });
}

function bpSignupFieldError(fieldId, msg) {
  var err = document.getElementById('err-' + fieldId);
  if (err) {
    err.textContent = msg || '';
    err.hidden = !msg;
  }
  var grp = document.querySelector('.input-group[data-field="' + fieldId + '"]');
  if (grp) {
    if (msg) grp.classList.add('is-invalid');
    else grp.classList.remove('is-invalid');
  }
  var input = document.getElementById(fieldId);
  if (msg && input) {
    try { input.focus(); } catch (_) {}
  }
}

function bpSignupSetStep(step) {
  step = Math.max(1, Math.min(__bpSignupMax, step | 0));
  __bpSignupStep = step;
  try { window.__bpSignupStep = step; } catch (_) {}
  var card = document.getElementById('login-signup-card');
  if (!card) return;

  card.querySelectorAll('[data-signup-pane]').forEach(function (pane) {
    var n = parseInt(pane.getAttribute('data-signup-pane'), 10);
    var on = n === step;
    pane.hidden = !on;
    pane.classList.toggle('is-active', on);
  });
  card.querySelectorAll('[data-signup-visual]').forEach(function (v) {
    var n = parseInt(v.getAttribute('data-signup-visual'), 10);
    v.hidden = n !== step;
  });
  card.querySelectorAll('[data-signup-step-ind]').forEach(function (el) {
    var n = parseInt(el.getAttribute('data-signup-step-ind'), 10);
    el.classList.toggle('is-active', n === step);
    el.classList.toggle('is-done', n < step);
  });

  var prev = document.getElementById('signup-prev-btn');
  var next = document.getElementById('signup-next-btn');
  var submit = document.getElementById('signup-submit-btn');
  if (prev) prev.hidden = step <= 1;
  if (next) next.hidden = step >= __bpSignupMax;
  if (submit) submit.hidden = step < __bpSignupMax;

  var titleEl = document.getElementById('signup-step-title');
  var lead = document.getElementById('signup-wizard-lead');
  if (titleEl) titleEl.textContent = bpAuthT('t' + step);
  if (lead) lead.textContent = bpAuthT('l' + step);
  var stepLabel = document.getElementById('signup-step-label');
  if (stepLabel) {
    stepLabel.textContent = bpAuthT('step_of', { n: step, max: __bpSignupMax, name: bpAuthT('s' + step) });
  }
  var nextLab = document.getElementById('signup-next-btn');
  if (nextLab && step < __bpSignupMax) nextLab.textContent = bpAuthT('continue');
  var subLab = document.getElementById('signup-submit-btn');
  if (subLab) subLab.textContent = bpAuthT('create');

  if (step === 6) {
    function val(id) {
      var el = document.getElementById(id);
      return el && el.value ? String(el.value).trim() : '';
    }
    var se = document.getElementById('signup-sum-empresa');
    var sn = document.getElementById('signup-sum-nif');
    var sm = document.getElementById('signup-sum-email');
    var st = document.getElementById('signup-sum-terms');
    if (se) se.textContent = val('signup-empresa') || '—';
    var sl = document.getElementById('signup-sum-localizacao');
    if (sl) sl.textContent = val('signup-localizacao') || '—';
    if (sn) sn.textContent = val('signup-nif') || 'Não indicado';
    if (sm) sm.textContent = val('signup-email') || '—';
    if (st) {
      var ck = document.getElementById('signup-terms');
      st.textContent = ck && ck.checked ? bpAuthT('sum_terms_ok') : bpAuthT('sum_terms_no');
    }
    document.querySelectorAll('[data-i18n-sum]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-sum');
      if (k) el.textContent = bpAuthT(k);
    });
    document.querySelectorAll('.bp-signup-alter').forEach(function (el) {
      el.textContent = bpAuthT('alter');
    });
    if (sn && (!val('signup-nif'))) sn.textContent = bpAuthT('sum_nif_none');
  }

  bpSignupClearFieldErrors();
  bpSignupShowError('');
  bpSignupShowSuccess('');
  if (typeof bpSignupSyncCta === 'function') bpSignupSyncCta();
  if (typeof bpSignupSaveDraft === 'function') bpSignupSaveDraft();
}

function bpSignupNormalizeNif(raw) {
  return String(raw || '').trim().replace(/\s+/g, '');
}

function bpSignupValidateStep(step) {
  bpSignupClearFieldErrors();
  bpSignupShowError('');
  if (step === 1 || step === 2) return true;

  if (step === 3) {
    var emp = ((document.getElementById('signup-empresa') && document.getElementById('signup-empresa').value) || '').trim();
    var loc = ((document.getElementById('signup-localizacao') && document.getElementById('signup-localizacao').value) || '').trim();
    var nif = bpSignupNormalizeNif(document.getElementById('signup-nif') && document.getElementById('signup-nif').value);
    var ok = true;
    if (!emp) {
      bpSignupFieldError('signup-empresa', bpAuthT('err_empresa'));
      ok = false;
    } else if (emp.length < 2) {
      bpSignupFieldError('signup-empresa', bpAuthT('err_empresa_short'));
      ok = false;
    } else if (emp.length > 120) {
      bpSignupFieldError('signup-empresa', 'O nome é demasiado longo (máx. 120).');
      ok = false;
    }
    if (!loc) {
      bpSignupFieldError('signup-localizacao', bpAuthT('err_loc'));
      ok = false;
    } else if (loc.length < 2) {
      bpSignupFieldError('signup-localizacao', bpAuthT('err_loc_short'));
      ok = false;
    } else if (loc.length > 120) {
      bpSignupFieldError('signup-localizacao', 'A localização é demasiado longa.');
      ok = false;
    }
    if (nif) {
      if (nif.length < 5) {
        bpSignupFieldError('signup-nif', 'NIF/BI parece incompleto. Deixe em branco ou complete.');
        ok = false;
      } else if (!/^[A-Za-z0-9./-]{5,32}$/.test(nif)) {
        bpSignupFieldError('signup-nif', bpAuthT('err_nif'));
        ok = false;
      }
    }
    if (!ok) bpSignupShowError(bpAuthT('err_fix'));
    return ok;
  }

  if (step === 4) {
    var email = ((document.getElementById('signup-email') && document.getElementById('signup-email').value) || '').trim().toLowerCase();
    var p1 = (document.getElementById('signup-password') && document.getElementById('signup-password').value) || '';
    var p2 = (document.getElementById('signup-password-2') && document.getElementById('signup-password-2').value) || '';
    var ok = true;
    if (!email) {
      bpSignupFieldError('signup-email', bpAuthT('err_email'));
      ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      bpSignupFieldError('signup-email', bpAuthT('err_email'));
      ok = false;
    } else if (email.length > 254) {
      bpSignupFieldError('signup-email', 'Email demasiado longo.');
      ok = false;
    }
    if (!p1) {
      bpSignupFieldError('signup-password', bpAuthT('err_pass'));
      ok = false;
    } else if (p1.length < 8) {
      bpSignupFieldError('signup-password', bpAuthT('err_pass'));
      ok = false;
    } else if (typeof bpPasswordStrongEnough === 'function' && !bpPasswordStrongEnough(p1)) {
      bpSignupFieldError('signup-password', 'Palavra-passe demasiado fraca. Use pelo menos 8 caracteres.');
      ok = false;
    } else if (/\s/.test(p1)) {
      bpSignupFieldError('signup-password', 'Evite espaços na palavra-passe.');
      ok = false;
    }
    if (!p2) {
      bpSignupFieldError('signup-password-2', bpAuthT('err_pass2'));
      ok = false;
    } else if (p1 !== p2) {
      bpSignupFieldError('signup-password-2', bpAuthT('err_pass2'));
      ok = false;
    }
    if (!ok) bpSignupShowError(bpAuthT('err_fix'));
    return ok;
  }

  if (step === 5) {
    var ck = document.getElementById('signup-terms');
    if (!ck || !ck.checked) {
      bpSignupFieldError('signup-terms', bpAuthT('err_terms'));
      bpSignupShowError(bpAuthT('err_terms'));
      return false;
    }
    return true;
  }

  return true;
}



/** Validação silenciosa (CTA disabled) — não escreve erros no DOM */
function bpSignupStepIsValid(step) {
  step = step | 0;
  if (step <= 2) return true;
  if (step === 3) {
    var emp = ((document.getElementById('signup-empresa') && document.getElementById('signup-empresa').value) || '').trim();
    var loc = ((document.getElementById('signup-localizacao') && document.getElementById('signup-localizacao').value) || '').trim();
    var nif = bpSignupNormalizeNif(document.getElementById('signup-nif') && document.getElementById('signup-nif').value);
    if (emp.length < 2 || emp.length > 120) return false;
    if (loc.length < 2 || loc.length > 120) return false;
    if (nif && (nif.length < 5 || !/^[A-Za-z0-9./-]{5,32}$/.test(nif))) return false;
    return true;
  }
  if (step === 4) {
    var email = ((document.getElementById('signup-email') && document.getElementById('signup-email').value) || '').trim().toLowerCase();
    var p1 = (document.getElementById('signup-password') && document.getElementById('signup-password').value) || '';
    var p2 = (document.getElementById('signup-password-2') && document.getElementById('signup-password-2').value) || '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return false;
    if (p1.length < 8 || /\s/.test(p1)) return false;
    if (typeof bpPasswordStrongEnough === 'function' && !bpPasswordStrongEnough(p1)) return false;
    if (p1 !== p2) return false;
    return true;
  }
  if (step === 5) {
    var ck = document.getElementById('signup-terms');
    return !!(ck && ck.checked);
  }
  return true;
}

function bpSignupSyncCta() {
  var next = document.getElementById('signup-next-btn');
  var submit = document.getElementById('signup-submit-btn');
  var step = __bpSignupStep | 0;
  if (next && step >= 1 && step <= 5) {
    var ok = bpSignupStepIsValid(step);
    next.disabled = !ok;
    next.setAttribute('aria-disabled', ok ? 'false' : 'true');
  }
  if (submit && step === 6) {
    var allOk = bpSignupStepIsValid(3) && bpSignupStepIsValid(4) && bpSignupStepIsValid(5);
    submit.disabled = !allOk;
    submit.setAttribute('aria-disabled', allOk ? 'false' : 'true');
  }
}



function bpGetFreeTrialDays() {
  var n = (typeof window !== 'undefined' && window.BP_FREE_TRIAL_DAYS != null)
    ? parseInt(window.BP_FREE_TRIAL_DAYS, 10)
    : (typeof BP_FREE_TRIAL_DAYS !== 'undefined' ? BP_FREE_TRIAL_DAYS : 14);
  n = parseInt(n, 10);
  if (!isFinite(n) || n < 1) n = 14;
  if (n > 365) n = 365;
  return n;
}

function bpPlanModalHide() {
  var m = document.getElementById('bp-plan-modal');
  if (!m) return;
  m.hidden = true;
  m.setAttribute('hidden', '');
  m.setAttribute('aria-hidden', 'true');
}

function bpPlanModalShow(opts) {
  opts = opts || {};
  var m = document.getElementById('bp-plan-modal');
  if (!m) return false;
  var days = bpGetFreeTrialDays();
  var daysEl = document.getElementById('bp-plan-days');
  if (daysEl) daysEl.textContent = String(days);
  var lead = document.getElementById('bp-plan-lead');
  if (lead) {
    lead.textContent = opts.lead || 'A sua conta foi criada.';
  }
  var body = document.getElementById('bp-plan-body');
  if (body) {
    var txt = bpAuthT('plan_body', { days: days });
    body.textContent = '';
    body.appendChild(document.createTextNode(txt));
  }
  var title = document.getElementById('bp-plan-title');
  if (title) title.textContent = bpAuthT('plan_title');
  var cont = document.getElementById('bp-plan-continue');
  if (cont) cont.textContent = bpAuthT('plan_continue');
  var view = document.getElementById('bp-plan-view');
  if (view) view.textContent = bpAuthT('plan_view');
  var note = document.getElementById('bp-plan-note');
  if (note) note.textContent = bpAuthT('plan_note');
  m.hidden = false;
  m.removeAttribute('hidden');
  m.setAttribute('aria-hidden', 'false');
  try {
    var btn = document.getElementById('bp-plan-continue');
    if (btn) btn.focus();
  } catch (_) {}
  return true;
}

function bpPlanModalGoLogin(email, msg) {
  bpPlanModalHide();
  if (typeof bpShowAuthPanel === 'function') bpShowAuthPanel('login');
  try {
    if (email) {
      var le = document.getElementById('login-email');
      if (le) le.value = email;
    }
    if (msg) {
      var err = document.getElementById('login-error');
      if (err) {
        err.textContent = msg;
        err.hidden = false;
        err.removeAttribute('hidden');
      }
    }
  } catch (_) {}
}


(function bpBindSignupUi() {
  function bindToggle(btnId) {
    var tog = document.getElementById(btnId);
    if (!tog || tog.dataset.bpBound) return;
    tog.dataset.bpBound = '1';
    tog.addEventListener('click', function () {
      var targetId = tog.getAttribute('data-target') || 'signup-password';
      var inp = document.getElementById(targetId);
      if (!inp) return;
      var show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      var icShow = tog.querySelector('.login-pass-icon-show');
      var icHide = tog.querySelector('.login-pass-icon-hide');
      if (icShow && icHide) {
        if (show) {
          icShow.setAttribute('hidden', '');
          icHide.removeAttribute('hidden');
        } else {
          icHide.setAttribute('hidden', '');
          icShow.removeAttribute('hidden');
        }
      }
      tog.setAttribute('aria-label', show ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe');
    });
  }

  function bind() {
    bindToggle('signup-pass-toggle');

    var open = document.getElementById('signup-link');
    if (open && !open.dataset.bpBound) {
      open.dataset.bpBound = '1';
      open.addEventListener('click', function () {
        bpShowAuthPanel('signup');
        if (typeof bpSignupSetStep === 'function') bpSignupSetStep(1);
      });
    }


    var watchIds = ['signup-empresa', 'signup-localizacao', 'signup-nif', 'signup-email', 'signup-password', 'signup-password-2', 'signup-terms'];
    watchIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.dataset.bpWatch) return;
      el.dataset.bpWatch = '1';
      var ev = (el.type === 'checkbox') ? 'change' : 'input';
      el.addEventListener(ev, function () {
        if (typeof bpSignupSyncCta === 'function') bpSignupSyncCta();
        if (typeof bpSignupSaveDraft === 'function') bpSignupSaveDraft();
      });
    });


    var planContinue = document.getElementById('bp-plan-continue');
    if (planContinue && !planContinue.dataset.bpBound) {
      planContinue.dataset.bpBound = '1';
      planContinue.addEventListener('click', function () {
        var em = window.__bpSignupPendingEmail || '';
        var msg = window.__bpSignupPendingMsg || 'Conta criada. Pode iniciar sessão.';
        if (typeof bpPlanModalGoLogin === 'function') {
          bpPlanModalGoLogin(em, msg);
        } else {
          bpPlanModalHide();
          if (typeof bpShowAuthPanel === 'function') bpShowAuthPanel('login');
        }
      });
    }
    var planView = document.getElementById('bp-plan-view');
    if (planView && !planView.dataset.bpBound) {
      planView.dataset.bpBound = '1';
      planView.addEventListener('click', function () {
        var em = window.__bpSignupPendingEmail || '';
        var msg = 'Conta criada. Os planos detalhados ficam disponíveis após iniciar sessão, conforme a política BeautyPro.';
        if (typeof bpPlanModalGoLogin === 'function') {
          bpPlanModalGoLogin(em, msg);
        } else {
          bpPlanModalHide();
        }
      });
    }
    var planBd = document.getElementById('bp-plan-modal-backdrop');
    if (planBd && !planBd.dataset.bpBound) {
      planBd.dataset.bpBound = '1';
      /* Backdrop não fecha sozinho — utilizador confirma (política de informar o plano) */
    }


    document.querySelectorAll('.bp-signup-alter').forEach(function (btn) {
      if (btn.dataset.bpBound) return;
      btn.dataset.bpBound = '1';
      btn.addEventListener('click', function () {
        var st = parseInt(btn.getAttribute('data-goto-step'), 10);
        if (st >= 1 && st <= 6 && typeof bpSignupSetStep === 'function') bpSignupSetStep(st);
      });
    });
    try {
      if (window.bpAuthI18n) {
        if (typeof window.bpAuthI18n.buildSelector === 'function') {
          window.bpAuthI18n.buildSelector(document.getElementById('bp-auth-lang-host'));
        }
        if (typeof window.bpAuthI18n.apply === 'function') window.bpAuthI18n.apply();
      }
    } catch (_) {}

    var nextBtn = document.getElementById('signup-next-btn');
    if (nextBtn && !nextBtn.dataset.bpBound) {
      nextBtn.dataset.bpBound = '1';
      nextBtn.addEventListener('click', function () {
        if (typeof bpSignupValidateStep === 'function' && !bpSignupValidateStep(__bpSignupStep)) return;
        if (typeof bpSignupSetStep === 'function') bpSignupSetStep(__bpSignupStep + 1);
      });
    }
    var prevBtn = document.getElementById('signup-prev-btn');
    if (prevBtn && !prevBtn.dataset.bpBound) {
      prevBtn.dataset.bpBound = '1';
      prevBtn.addEventListener('click', function () {
        if (typeof bpSignupSetStep === 'function') bpSignupSetStep(__bpSignupStep - 1);
      });
    }

    var back = document.getElementById('signup-back-login');
    if (back && !back.dataset.bpBound) {
      back.dataset.bpBound = '1';
      back.addEventListener('click', function () {
        bpShowAuthPanel('login');
      });
    }

    var submit = document.getElementById('signup-submit-btn');
    if (submit && !submit.dataset.bpBound) {
      submit.dataset.bpBound = '1';
      submit.addEventListener('click', async function () {
        bpSignupShowError('');
        bpSignupShowSuccess('');
        if (typeof bpSignupValidateStep === 'function') {
          if (!bpSignupValidateStep(3) || !bpSignupValidateStep(4) || !bpSignupValidateStep(5)) {
            if (!bpSignupValidateStep(3)) bpSignupSetStep(3);
            else if (!bpSignupValidateStep(4)) bpSignupSetStep(4);
            else bpSignupSetStep(5);
            return;
          }
        }
        if (!navigator.onLine) {
          bpSignupShowError('É necessária ligação à internet para criar a conta. Verifique a rede e tente de novo.');
          return;
        }
        var empresa = ((document.getElementById('signup-empresa') && document.getElementById('signup-empresa').value) || '').trim();
        var nif = ((document.getElementById('signup-nif') && document.getElementById('signup-nif').value) || '').trim();
        var email = ((document.getElementById('signup-email') && document.getElementById('signup-email').value) || '').trim().toLowerCase();
        var p1 = (document.getElementById('signup-password') && document.getElementById('signup-password').value) || '';
        var p2 = (document.getElementById('signup-password-2') && document.getElementById('signup-password-2').value) || '';
        if (!empresa) {
          bpSignupShowError('Indique o nome da empresa ou organização.');
          try { document.getElementById('signup-empresa').focus(); } catch (_) {}
          return;
        }
        if (!email || email.indexOf('@') < 1) {
          bpSignupShowError('Indique um email válido.');
          return;
        }
        if (typeof bpPasswordStrongEnough === 'function' && !bpPasswordStrongEnough(p1)) {
          bpSignupShowError('A palavra-passe deve ter pelo menos 8 caracteres.');
          return;
        }
        if (p1.length < 8) {
          bpSignupShowError('A palavra-passe deve ter pelo menos 8 caracteres.');
          return;
        }
        if (p1 !== p2) {
          bpSignupShowError(bpAuthT('err_pass2'));
          return;
        }
        if (!navigator.onLine) {
          bpSignupShowError('É necessária ligação à internet para criar a conta.');
          return;
        }
        if (typeof setButtonLoading === 'function') setButtonLoading(submit, true);
        else submit.disabled = true;
        try {
          var redirectTo = typeof bpAuthRedirectTo === 'function'
            ? bpAuthRedirectTo('')
            : ((location.origin || '') + (location.pathname || '/'));
          var opts = {
            email: email,
            password: p1,
            options: {
              emailRedirectTo: redirectTo,
              data: {
                empresa: empresa,
                organization: empresa,
                nif_bi: nif || null,
                localizacao: ((document.getElementById('signup-localizacao') && document.getElementById('signup-localizacao').value) || '').trim() || null,
                terms_version: (typeof bpSignupGetTermsVersion === 'function' ? bpSignupGetTermsVersion() : (typeof BP_SIGNUP_TERMS_VERSION !== 'undefined' ? BP_SIGNUP_TERMS_VERSION : '1.0.0')),
                terms_accepted_at: new Date().toISOString(),
                full_name: empresa
              }
            }
          };
          var res = await supabaseClient.auth.signUp(opts);
          if (res && res.error) throw res.error;
          var session = res.data && res.data.session;
          var user = res.data && res.data.user;
          /* Confirmação de email activa: session null até clicar no link */
          if (!session && user) {
            if (typeof bpSignupClearDraft === 'function') bpSignupClearDraft();
            window.__bpSignupPendingEmail = email;
            window.__bpSignupPendingMsg = 'Confirme o email (link na caixa de entrada) e depois inicie sessão.';
            if (typeof bpPlanModalShow === 'function') {
              bpPlanModalShow({ lead: 'Conta criada. Confirme o email quando estiver pronto.' });
            } else {
              bpPlanModalGoLogin(email, window.__bpSignupPendingMsg);
            }
            return;
          }
          if (session && user) {
            if (typeof bpSignupClearDraft === 'function') bpSignupClearDraft();
            try {
              await supabaseClient.auth.signOut({ scope: 'local' });
            } catch (_) {}
            window.__bpSignupPendingEmail = email;
            window.__bpSignupPendingMsg = 'Inicie sessão para configurar a organização.';
            if (typeof bpPlanModalShow === 'function') {
              bpPlanModalShow({ lead: 'A sua conta foi criada.' });
            } else {
              bpPlanModalGoLogin(email, window.__bpSignupPendingMsg);
            }
            return;
          }
          window.__bpSignupPendingEmail = email;
          window.__bpSignupPendingMsg = 'Pedido registado. Verifique o email ou tente iniciar sessão.';
          if (typeof bpPlanModalShow === 'function') {
            bpPlanModalShow({ lead: 'Pedido registado.' });
          } else if (typeof bpShowAuthPanel === 'function') {
            bpShowAuthPanel('login');
          }
        } catch (err) {
          var raw = err && err.message ? String(err.message) : '';
          var msg = bpAuthT('err_server');
          if (/already|registered|exists|User already/i.test(raw)) {
            msg = bpAuthT('err_exists');
            bpSignupSetStep(4);
            bpSignupFieldError('signup-email', 'Este email já tem conta.');
          } else if (/password/i.test(raw) && /weak|least|character/i.test(raw)) {
            msg = 'Palavra-passe rejeitada pelo servidor. Use pelo menos 8 caracteres.';
            bpSignupSetStep(4);
            bpSignupFieldError('signup-password', 'Palavra-passe demasiado fraca.');
          } else if (/rate|limit|too many/i.test(raw)) {
            msg = 'Demasiadas tentativas. Aguarde um momento e tente de novo.';
          } else if (/email/i.test(raw) && /invalid/i.test(raw)) {
            msg = bpAuthT('err_email');
            bpSignupSetStep(4);
            bpSignupFieldError('signup-email', bpAuthT('err_email'));
          } else if (/network|fetch|Failed to fetch|timeout/i.test(raw)) {
            msg = bpAuthT('err_network');
          } else if (/confirm|verify/i.test(raw)) {
            msg = 'Conta criada, mas é necessário confirmar o email antes de entrar.';
          }
          bpSignupShowError(msg);
        } finally {
          if (typeof setButtonLoading === 'function') setButtonLoading(submit, false);
          else submit.disabled = false;
        }
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();

if (typeof window !== 'undefined') {
  window.bpShowAuthPanel = bpShowAuthPanel;
  window.bpPlanModalShow = bpPlanModalShow;
  window.bpGetFreeTrialDays = bpGetFreeTrialDays;
  window.bpShowRecoveryPanel = bpShowRecoveryPanel;
}


/** F5 — chama Edge provision-empresa (JWT do utilizador; service role só no servidor). */
async function bpProvisionEmpresa(empresa, nifBi) {
  empresa = (empresa || '').trim();
  nifBi = (nifBi || '').trim() || null;
  if (!empresa) throw new Error('Indique o nome da empresa ou organização.');
  var sessRes = await supabaseClient.auth.getSession();
  var session = sessRes && sessRes.data && sessRes.data.session;
  if (!session || !session.access_token) throw new Error('Sessão inválida. Inicie sessão novamente.');
  var url =
    (typeof PROVISION_EDGE_URL !== 'undefined' && PROVISION_EDGE_URL) ||
    (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL + '/functions/v1/provision-empresa' : '');
  if (!url) throw new Error('URL de provisionamento não configurada.');
  var resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + session.access_token,
      apikey: typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : ''
    },
    body: JSON.stringify({ empresa: empresa, nif_bi: nifBi })
  });
  var body = null;
  try {
    body = await resp.json();
  } catch (_) {
    body = null;
  }
  if (!resp.ok) {
    var errMsg =
      (body && (body.error || body.message)) ||
      ('Falha ao criar organização (' + resp.status + ')');
    throw new Error(errMsg);
  }
  return body;
}

(function bpBindOnboardingUi() {
  function showErr(msg) {
    var el = document.getElementById('onboarding-error');
    if (!el) {
      if (typeof toast === 'function') toast(msg, 'error');
      return;
    }
    el.textContent = msg || '';
    if (msg) {
      el.hidden = false;
      el.removeAttribute('hidden');
    } else {
      el.hidden = true;
      el.setAttribute('hidden', '');
    }
  }

  function bind() {
    var submit = document.getElementById('onboarding-submit-btn');
    if (submit && !submit.dataset.bpBound) {
      submit.dataset.bpBound = '1';
      submit.addEventListener('click', async function () {
        showErr('');
        var empresa = (document.getElementById('onboarding-empresa') && document.getElementById('onboarding-empresa').value) || '';
        var nif = (document.getElementById('onboarding-nif') && document.getElementById('onboarding-nif').value) || '';
        if (!navigator.onLine) {
          showErr('É necessária ligação à internet para criar o espaço de trabalho.');
          return;
        }
        if (typeof setButtonLoading === 'function') setButtonLoading(submit, true);
        else submit.disabled = true;
        try {
          var result = await bpProvisionEmpresa(empresa, nif);
          if (typeof toast === 'function') toast('Organização criada.', 'success');
          var sess = await supabaseClient.auth.getSession();
          var session = sess && sess.data && sess.data.session;
          if (session && typeof bpEnterFromSession === 'function') {
            await bpEnterFromSession(session, 'provision');
          }
        } catch (err) {
          var msg = (err && err.message) ? String(err.message) : 'Não foi possível criar a organização.';
          showErr(msg);
          if (typeof toast === 'function') toast(msg, 'error');
        } finally {
          if (typeof setButtonLoading === 'function') setButtonLoading(submit, false);
          else submit.disabled = false;
        }
      });
    }

    var out = document.getElementById('onboarding-logout-btn');
    if (out && !out.dataset.bpBound) {
      out.dataset.bpBound = '1';
      out.addEventListener('click', async function () {
        try {
          await supabaseClient.auth.signOut();
        } catch (_) {}
        if (typeof bpShowAuthPanel === 'function') bpShowAuthPanel('login');
        if (typeof toast === 'function') toast('Sessão terminada.', 'info');
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();

if (typeof window !== 'undefined') {
  window.bpProvisionEmpresa = bpProvisionEmpresa;
  window.bpSignupSetStep = bpSignupSetStep;
  window.bpShowAuthPanel = bpShowAuthPanel;
}
