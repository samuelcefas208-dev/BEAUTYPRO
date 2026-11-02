/* BelezaPro C-1 — UI a11y/nav; carregar APÓS app.bundle.js (CORE já definiu openModal base) */

// ====================================================================
//  ui-events-navegacao.js — extraído do app.js (Fase C da modularização)
//  Conteúdo: Ativação de abas e sistema de permissões por papel
//  Linhas originais: 1629-1683
//  Carregar depois de core-*.js, db-indexeddb.js, sync-*.js, auth-supabase.js
// ====================================================================

function ativarAbaAtiva() {
  try { if (typeof bpHideChartTooltip === 'function') bpHideChartTooltip(); } catch (_) {}
  /* Sair do modo ops se o utilizador escolheu outra aba na bottom-nav */
  try {
    if (activeTab && activeTab !== 'ops' && window.__bpOpsStack && window.__bpOpsStack.length) {
      window.__bpOpsStack = [];
      document.querySelectorAll('.bp-ops-overlay.open').forEach(function (el) {
        el.classList.remove('open', 'bp-ops-stacked');
        el.style.display = '';
        try { el.hidden = true; el.setAttribute('aria-hidden', 'true'); } catch (_) {}
      });
      window.__bpOpsReturnTab = null;
      try { document.body.classList.remove('bp-ops-open'); } catch (_) {}
    }
  } catch (_) {}
  const pane = document.getElementById('tab-' + activeTab);
  if (!pane) return;
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  pane.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.remove('active');
    n.setAttribute('aria-selected', 'false');
  });
  const navBtn = document.querySelector('.nav-item[data-tab="' + activeTab + '"]');
  if (navBtn) {
    navBtn.classList.add('active');
    navBtn.setAttribute('aria-selected', 'true');
  }
}

// ====================================================================
//  RBAC + F6 acessos por papel (mesmo salao_id)
//  admin = proprietário | gerente | operador
//  Verdade: profiles.role no servidor; matriz local/salao_config.acessos
// ====================================================================

/** Abas principais que o admin pode restringir a gerente/operador */
var BP_ACCESS_TABS = [
  { id: 'dashboard', label: 'Resumo' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'caixa', label: 'Caixa' },
  { id: 'equipa', label: 'Equipa' },
  { id: 'ia', label: 'Agente IA' }
];

/** Predefinição: o que cada papel vê (admin vê tudo). */
function bpAccessDefaults() {
  return {
    admin: { dashboard: true, agenda: true, clientes: true, caixa: true, equipa: true, ia: true },
    gerente: { dashboard: true, agenda: true, clientes: true, caixa: true, equipa: true, ia: true },
    operador: { dashboard: true, agenda: true, clientes: true, caixa: true, equipa: false, ia: false }
  };
}

function bpAccessStorageKey() {
  var sid = '';
  try {
    sid = (state && state.config && state.config.salaoId) || localStorage.getItem('bp_salao_id_cache') || '';
  } catch (_) {}
  return 'bp_acessos_' + String(sid || 'none');
}

/** Overrides guardados (só gerente/operador). */
function bpLoadAccessOverrides() {
  try {
    var raw = localStorage.getItem(bpAccessStorageKey());
    if (!raw) return {};
    var o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : {};
  } catch (_) {
    return {};
  }
}

function bpSaveAccessOverrides(overrides) {
  try {
    localStorage.setItem(bpAccessStorageKey(), JSON.stringify(overrides || {}));
  } catch (_) {}
  /* Melhor esforço: salao_config.acessos (se a coluna existir) */
  try {
    if (typeof supabaseClient === 'undefined' || !state || !state.config || !state.config.salaoId) return;
    if (!navigator.onLine) return;
    supabaseClient.auth.getSession().then(function (res) {
      var session = res && res.data && res.data.session;
      if (!session) return;
      return supabaseClient
        .from('salao_config')
        .upsert({ salao_id: state.config.salaoId, acessos: overrides || {} }, { onConflict: 'salao_id' });
    }).catch(function () {});
  } catch (_) {}
}

/** Matriz efectiva para um papel. */
function bpAccessMatrixFor(role) {
  role = normalizarRole(role);
  var defaults = bpAccessDefaults();
  var base = defaults[role] ? Object.assign({}, defaults[role]) : Object.assign({}, defaults.operador);
  if (role === 'admin') {
    BP_ACCESS_TABS.forEach(function (tab) {
      base[tab.id] = true;
    });
    return base;
  }
  var over = bpLoadAccessOverrides();
  var part = over[role] || {};
  Object.keys(part).forEach(function (k) {
    if (typeof part[k] === 'boolean') base[k] = part[k];
  });
  return base;
}

function bpPodeAba(tabId) {
  var role = normalizarRole(
    typeof state !== 'undefined' && state.config ? state.config.userRole : null
  );
  if (role === 'admin') return true;
  var m = bpAccessMatrixFor(role);
  if (Object.prototype.hasOwnProperty.call(m, tabId)) return !!m[tabId];
  return true;
}

function normalizarRole(role) {
  if (typeof RBAC_ROLES !== 'undefined' && RBAC_ROLES.includes(role)) return role;
  try {
    var cached = localStorage.getItem('bp_user_role');
    if (cached && (typeof RBAC_ROLES === 'undefined' || RBAC_ROLES.includes(cached))) return cached;
  } catch (_) {}
  if (role) {
    try {
      console.warn('[RBAC] role desconhecido ("' + role + '") — acesso mínimo operador.');
    } catch (_) {}
  }
  return 'operador';
}

/**
 * bpPode('admin') | bpPode(['admin','gerente'])
 */
function bpPode(rolesPermitidos) {
  var role = normalizarRole(
    typeof state !== 'undefined' && state.config && state.config.userRole
      ? state.config.userRole
      : null
  );
  var allowed = rolesPermitidos;
  if (allowed == null) return true;
  if (typeof allowed === 'string') {
    allowed = allowed.split(',').map(function (r) {
      return r.trim();
    }).filter(Boolean);
  }
  if (!Array.isArray(allowed) || allowed.length === 0) return true;
  return allowed.indexOf(role) !== -1;
}

function bpExigirRole(rolesPermitidos, mensagem) {
  if (bpPode(rolesPermitidos)) return true;
  var msg =
    mensagem ||
    'Esta operação está reservada a outro nível de acesso. Se precisar, fale com o proprietário do espaço.';
  if (typeof toast === 'function') toast(msg, 'warning');
  return false;
}

function aplicarPermissoes() {
  var role = normalizarRole(state && state.config ? state.config.userRole : null);
  if (state && state.config) state.config.userRole = role;
  try {
    if (role && typeof RBAC_ROLES !== 'undefined' && RBAC_ROLES.includes(role)) {
      localStorage.setItem('bp_user_role', role);
    }
  } catch (_) {}

  var matrix = bpAccessMatrixFor(role);

  document.querySelectorAll('[data-role]').forEach(function (el) {
    var allowed = (el.dataset.role || '').split(',').map(function (r) {
      return r.trim();
    }).filter(Boolean);
    var permitido = allowed.indexOf(role) !== -1;
    /* Aba: cruzar com matriz F6 */
    var tab = el.getAttribute('data-tab');
    if (tab && Object.prototype.hasOwnProperty.call(matrix, tab) && !matrix[tab]) {
      permitido = false;
    }
    var paneTab = el.id && String(el.id).indexOf('tab-') === 0 ? String(el.id).slice(4) : null;
    if (paneTab && Object.prototype.hasOwnProperty.call(matrix, paneTab) && !matrix[paneTab]) {
      permitido = false;
    }
    if (el.dataset.roleMode === 'disable') {
      el.disabled = !permitido;
      el.style.opacity = permitido ? '' : '0.45';
      el.style.pointerEvents = permitido ? '' : 'none';
      el.title = permitido ? '' : 'Indisponível para o seu nível de acesso';
    } else {
      el.style.display = permitido ? '' : 'none';
    }
  });

  /* Nav sem data-role mas com data-tab */
  document.querySelectorAll('.nav-item[data-tab]').forEach(function (el) {
    var tab = el.getAttribute('data-tab');
    if (!tab || tab === 'ops') return;
    if (!Object.prototype.hasOwnProperty.call(matrix, tab)) return;
    if (el.getAttribute('data-role')) return; /* já tratado */
    el.style.display = matrix[tab] ? '' : 'none';
  });

  /* Se a aba activa ficou inacessível, voltar ao Resumo */
  try {
    var active = typeof activeTab !== 'undefined' ? activeTab : null;
    if (active && active !== 'ops' && Object.prototype.hasOwnProperty.call(matrix, active) && !matrix[active]) {
      var dash = document.querySelector('.nav-item[data-tab="dashboard"]');
      if (dash && dash.style.display !== 'none') {
        dash.click();
        if (typeof toast === 'function') {
          toast('Esta área não está disponível no seu acesso. A abrir o Resumo.', 'info');
        }
      }
    }
  } catch (_) {}

  /* Botão Acessos: só admin */
  try {
    var btnAcc = document.getElementById('bp-acessos-btn');
    if (btnAcc) btnAcc.style.display = role === 'admin' ? '' : 'none';
  } catch (_) {}
}

/** UI F6 — modal simples de acessos (admin). */
function bpOpenAcessosModal() {
  if (!bpPode('admin')) {
    bpExigirRole(['admin'], 'Só o proprietário gere os acessos da equipa.');
    return;
  }
  var existing = document.getElementById('bp-acessos-overlay');
  if (existing) {
    existing.classList.add('open');
    existing.style.display = 'flex';
    try {
      existing.hidden = false;
    } catch (_) {}
    bpRenderAcessosForm();
    return;
  }
  var ov = document.createElement('div');
  ov.id = 'bp-acessos-overlay';
  ov.className = 'modal-overlay open';
  ov.style.display = 'flex';
  ov.innerHTML =
    '<div class="modal-content bp-acessos-modal" role="dialog" aria-labelledby="bp-acessos-title">' +
    '<div class="modal-header">' +
    '<h2 id="bp-acessos-title" class="modal-title">Acessos da equipa</h2>' +
    '<button type="button" class="modal-close" id="bp-acessos-close" aria-label="Fechar">&times;</button>' +
    '</div>' +
    '<p class="bp-acessos-lead">Defina o que gerente e operador podem abrir neste espaço. O proprietário mantém acesso total.</p>' +
    '<div id="bp-acessos-body" class="bp-acessos-body"></div>' +
    '<div class="modal-footer bp-acessos-footer">' +
    '<button type="button" class="btn btn-secondary" id="bp-acessos-cancel">Cancelar</button>' +
    '<button type="button" class="btn btn-primary" id="bp-acessos-save">Guardar</button>' +
    '</div></div>';
  document.body.appendChild(ov);
  function close() {
    ov.classList.remove('open');
    ov.style.display = 'none';
    try {
      ov.hidden = true;
    } catch (_) {}
  }
  ov.querySelector('#bp-acessos-close').addEventListener('click', close);
  ov.querySelector('#bp-acessos-cancel').addEventListener('click', close);
  ov.addEventListener('click', function (e) {
    if (e.target === ov) close();
  });
  ov.querySelector('#bp-acessos-save').addEventListener('click', function () {
    var body = document.getElementById('bp-acessos-body');
    if (!body) return;
    var overrides = bpLoadAccessOverrides();
    ['gerente', 'operador'].forEach(function (role) {
      overrides[role] = overrides[role] || {};
      BP_ACCESS_TABS.forEach(function (tab) {
        var inp = body.querySelector('input[data-role="' + role + '"][data-tab="' + tab.id + '"]');
        if (inp) overrides[role][tab.id] = !!inp.checked;
      });
    });
    bpSaveAccessOverrides(overrides);
    aplicarPermissoes();
    close();
    if (typeof toast === 'function') {
      toast('Acessos actualizados. A equipa verá as áreas de acordo com estas regras.', 'success');
    }
  });
  bpRenderAcessosForm();
}

function bpRenderAcessosForm() {
  var body = document.getElementById('bp-acessos-body');
  if (!body) return;
  var defaults = bpAccessDefaults();
  var over = bpLoadAccessOverrides();
  var html = '<div class="bp-acessos-grid">';
  ['gerente', 'operador'].forEach(function (role) {
    var label = role === 'gerente' ? 'Gerente' : 'Operador';
    html += '<div class="bp-acessos-col"><h3 class="bp-acessos-role">' + label + '</h3><ul class="bp-acessos-list">';
    BP_ACCESS_TABS.forEach(function (tab) {
      var checked = defaults[role][tab.id];
      if (over[role] && typeof over[role][tab.id] === 'boolean') checked = over[role][tab.id];
      html +=
        '<li><label class="bp-acessos-item">' +
        '<input type="checkbox" data-role="' +
        role +
        '" data-tab="' +
        tab.id +
        '"' +
        (checked ? ' checked' : '') +
        '/>' +
        '<span>' +
        tab.label +
        '</span></label></li>';
    });
    html += '</ul></div>';
  });
  html += '</div>';
  body.innerHTML = html;
}

if (typeof window !== 'undefined') {
  window.bpPode = bpPode;
  window.bpExigirRole = bpExigirRole;
  window.bpPodeAba = bpPodeAba;
  window.bpOpenAcessosModal = bpOpenAcessosModal;
  window.bpAccessMatrixFor = bpAccessMatrixFor;
  window.aplicarPermissoes = aplicarPermissoes;
  window.normalizarRole = normalizarRole;
}


// ====================================================================
//  EVENT LISTENERS
// ====================================================================
// (Login handler movido para auth-supabase.js)



(function bpBindAcessosBtn() {
  function bind() {
    var b = document.getElementById('bp-acessos-btn');
    if (!b || b.dataset.bpBound) return;
    b.dataset.bpBound = '1';
    b.addEventListener('click', function () {
      if (typeof bpOpenAcessosModal === 'function') bpOpenAcessosModal();
    });
    try {
      if (typeof aplicarPermissoes === 'function') aplicarPermissoes();
    } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
