/* BelezaPro D-2 — core/utils.js
 * Extraído de app.bundle.js (FILE: core-utils.js).
 * Carregar: DEPOIS de core/constants.js e ANTES de app.bundle.js.
 *
 * Dependências em runtime (não no parse):
 *   - state (typeof) — core-state no bundle
 *   - supabaseClient (typeof) — auth no bundle
 *   - SUPABASE_URL / SUPABASE_ANON_KEY — core/constants.js
 * Side effects no load: listeners document (modal/teclado); reciboCounter localStorage.
 * Ver docs/D2_CORE_UTILS.md
 */

// ====================================================================
//  CORE — UTILITÁRIOS (extraído do app.js na Fase A da modularização)
// ====================================================================
var uuid = window.uuid =  () => (crypto.randomUUID ? crypto.randomUUID() : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
let reciboCounter = parseInt(localStorage.getItem('bp_recibo_counter') || '0', 10);

function bpReciboStorageKey() {
  const salaoKey = (typeof state !== 'undefined' && state.config && state.config.salaoId)
    ? String(state.config.salaoId).slice(0, 8)
    : 'local';
  return { salaoKey: salaoKey, storageKey: 'bp_recibo_counter_' + salaoKey };
}

/** Extrai sequência numérica do final de um recibo (ex. ABCD-0012 → 12). */
function bpParseReciboSeq(val) {
  const m = String(val || '').match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : 0;
}

function bpGetLocalReciboSeq() {
  const keys = bpReciboStorageKey();
  let n = parseInt(localStorage.getItem(keys.storageKey) || localStorage.getItem('bp_recibo_counter') || '0', 10);
  if (isNaN(n) || n < 0) n = 0;
  return n;
}

function bpSetLocalReciboSeq(n) {
  const keys = bpReciboStorageKey();
  const v = Math.max(0, parseInt(n, 10) || 0);
  try { localStorage.setItem(keys.storageKey, String(v)); } catch (_) {}
  try { localStorage.setItem('bp_recibo_counter', String(v)); } catch (_) {}
  reciboCounter = v;
  try {
    if (typeof state !== 'undefined' && state.config) state.config.reciboCounter = v;
  } catch (_) {}
  return v;
}

/**
 * ET4.5: reconcilia contador com movimentos locais + remoto (max).
 * Garante que multi-dispositivo sobe o piso do contador.
 */
function bpReconcileReciboCounterFromMovimentos() {
  let maxSeq = bpGetLocalReciboSeq();
  try {
    const list = (typeof state !== 'undefined' && state.movimentos) ? state.movimentos : [];
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      if (!m) continue;
      if (m.tipo && m.tipo !== 'venda') continue;
      const s = bpParseReciboSeq(m.reciboNum);
      if (s > maxSeq) maxSeq = s;
    }
  } catch (_) {}
  if (maxSeq > bpGetLocalReciboSeq()) bpSetLocalReciboSeq(maxSeq);
  return maxSeq;
}

/**
 * Tenta persistir o contador em salao_config.recibo_counter (se a coluna existir).
 * Se o schema ainda não tiver a coluna, falha em silêncio — o contador continua
 * nos movimentos (reciboNum) e no localStorage até a migração SQL.
 */
async function bpPushReciboCounterToSupabase(n) {
  try {
    if (!navigator.onLine) return false;
    if (typeof state === 'undefined' || !state.config || !state.config.salaoId) return false;
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return false;
    const { data: { session } } = await supabaseClient.auth.getSession();
    const accessToken = session && session.access_token;
    if (!accessToken || typeof SUPABASE_URL === 'undefined') return false;
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    };
    const body = {
      salao_id: state.config.salaoId,
      recibo_counter: n,
      updated_at: new Date().toISOString()
    };
    // PATCH se linha existir; fallback POST merge
    let resp = await fetch(
      SUPABASE_URL + '/rest/v1/salao_config?salao_id=eq.' + encodeURIComponent(state.config.salaoId),
      { method: 'PATCH', headers: headers, body: JSON.stringify({ recibo_counter: n, updated_at: body.updated_at }) }
    );
    if (resp.status === 404 || resp.status === 400 || resp.status === 409) {
      resp = await fetch(SUPABASE_URL + '/rest/v1/salao_config', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });
    }
    return resp.ok;
  } catch (e) {
    if (typeof logErroSilencioso === 'function') logErroSilencioso('bpPushReciboCounter', e);
    return false;
  }
}

async function bpPullReciboCounterFromSupabase() {
  try {
    if (!navigator.onLine) return null;
    if (typeof state === 'undefined' || !state.config || !state.config.salaoId) return null;
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return null;
    const { data: { session } } = await supabaseClient.auth.getSession();
    const accessToken = session && session.access_token;
    if (!accessToken || typeof SUPABASE_URL === 'undefined') return null;
    const resp = await fetch(
      SUPABASE_URL + '/rest/v1/salao_config?salao_id=eq.' + encodeURIComponent(state.config.salaoId) + '&select=recibo_counter',
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + accessToken } }
    );
    if (!resp.ok) return null;
    const rows = await resp.json();
    if (!rows || !rows.length) return null;
    const remote = parseInt(rows[0].recibo_counter, 10);
    return isNaN(remote) ? null : remote;
  } catch (e) {
    return null;
  }
}

/** Sobe o contador local para max(local, movimentos, remoto) e empurra se necessário. */
async function bpSyncReciboCounter() {
  let local = bpReconcileReciboCounterFromMovimentos();
  const remote = await bpPullReciboCounterFromSupabase();
  if (remote != null && remote > local) {
    local = bpSetLocalReciboSeq(remote);
  }
  // Empurrar se local >= remoto (inclui empate após venda)
  if (navigator.onLine) {
    try { await bpPushReciboCounterToSupabase(local); } catch (_) {}
  }
  return local;
}

function nextReciboNum() {
  // ET4.5: sequência por salão; reconcilia com movimentos; tenta sync Supabase
  bpReconcileReciboCounterFromMovimentos();
  const keys = bpReciboStorageKey();
  let n = bpGetLocalReciboSeq() + 1;
  bpSetLocalReciboSeq(n);
  // Fire-and-forget push (não bloqueia a venda)
  try {
    if (typeof bpPushReciboCounterToSupabase === 'function') {
      Promise.resolve(bpPushReciboCounterToSupabase(n)).catch(function () {});
    }
  } catch (_) {}
  const prefix = keys.salaoKey !== 'local' ? keys.salaoKey.slice(-4).toUpperCase() + '-' : '';
  return prefix + String(n).padStart(4, '0');
}

if (typeof window !== 'undefined') {
  window.nextReciboNum = nextReciboNum;
  window.bpSyncReciboCounter = bpSyncReciboCounter;
  window.bpReconcileReciboCounterFromMovimentos = bpReconcileReciboCounterFromMovimentos;
}

function hoje() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const horaAgora = () => new Date().toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' });

const fmtKz = v => {
  const n = Math.round(Number(v) || 0);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Kz';
};

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, function (m) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m] || m;
  });
}
if (typeof window !== 'undefined') window.escHtml = escHtml;

/** E14 — URL segura para atributo src de <img>. Só http(s), data:image, blob:. */
function bpSafeImgSrc(src) {
  if (src == null || src === '') return '';
  var s = String(src).trim();
  if (!/^(https?:|data:image\/|blob:)/i.test(s)) return '';
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
if (typeof window !== 'undefined') window.bpSafeImgSrc = bpSafeImgSrc;

/** Log de erros não críticos (fila sync, localStorage). Nunca lança. */
function logErroSilencioso(contexto, err) {
  try {
    const msg = (err && (err.message || String(err))) || 'erro desconhecido';
    console.warn('[BeautyPro]', contexto + ':', msg);
  } catch (_) {}
}



let toastTimer;

/**
 * Toast único: topo, 4s, sem barra lateral (ver modais-toast-fab.css).
 * type: success | error | warning | info | (default)
 * opts.duration ms opcional
 */
function bpToastMsgPT(msg) {
  var s = String(msg == null ? '' : msg);
  if (!s) return s;
  var low = s.toLowerCase();
  /* Supabase devolve o mesmo erro para email inexistente e palavra-passe errada
     (anti-enumeração). Mensagem honesta: cobre ambos, nunca acusa só a passe. */
  if (/invalid login credentials|invalid_credentials|invalid email or password/.test(low)) {
    return 'Email ou palavra-passe incorrectos.';
  }
  if (/email not confirmed/.test(low)) return 'Confirme o email antes de entrar.';
  if (/user not found|user_not_found|no user found/.test(low)) return 'Email não encontrado.';
  if (/too many requests|rate limit/.test(low)) return 'Demasiadas tentativas. Aguarde um momento.';
  if (/network request failed|failed to fetch|networkerror/.test(low)) return 'Sem ligação à rede. Tente novamente.';
  if (/session.*expired|jwt expired/.test(low)) return 'A sessão expirou. Entre novamente.';
  if (/not allowed|permission denied|row-level security/.test(low)) return 'Sem permissão para esta operação.';
  if (/^erro ao entrar:\s*/i.test(s)) {
    var rest = s.replace(/^erro ao entrar:\s*/i, '');
    var mapped = bpToastMsgPT(rest);
    if (mapped !== rest) return mapped.indexOf('Erro ao entrar') === 0 ? mapped : ('Erro ao entrar: ' + mapped);
    if (!/[àáãâéêíóôõúç]/i.test(rest) && /[a-z]{4,}/i.test(rest)) {
      return 'Email ou palavra-passe incorrectos.';
    }
  }
  return s;
}

function toast(msg, type, opts) {
  const el = document.getElementById('toast');
  if (!el) return;
  clearTimeout(toastTimer);
  el.classList.remove('show');
  /* Normalizar: uma linha — colapsar quebras e espaços excessivos */
  var text = bpToastMsgPT(String(msg == null ? '' : msg))
    .replace(/\s+/g, ' ')
    .trim();
  const t = type || '';
  el.className = 'toast' + (t ? ' ' + t : '');
  el.setAttribute('role', t === 'error' ? 'alert' : 'status');
  el.setAttribute('aria-live', t === 'error' ? 'assertive' : 'polite');
  el.textContent = text;
  void el.offsetWidth;
  el.classList.add('show');
  /* sucesso/info 2,5s · aviso 4s · erro 4,5s */
  var dur = 2500;
  if (t === 'success' || t === 'info' || t === '') dur = 2500;
  else if (t === 'warning') dur = 4000;
  else if (t === 'error') dur = 4500;
  else dur = 3000;
  if (opts && opts.duration != null) {
    var d = Number(opts.duration);
    if (!isNaN(d) && d > 0) dur = d;
  }
  toastTimer = setTimeout(function () { el.classList.remove('show'); }, dur);
}

function bpFocarCampoForm(fieldId) {
  if (!fieldId) return;
  try {
    var el = document.getElementById(fieldId);
    if (!el) return;
    el.setAttribute('aria-invalid', 'true');
    el.classList.add('bp-field-invalid');
    if (typeof el.focus === 'function') el.focus();
    if (typeof el.scrollIntoView === 'function') {
      try { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (_) {}
    }
    clearTimeout(el._bpInvalidTimer);
    el._bpInvalidTimer = setTimeout(function () {
      try {
        el.removeAttribute('aria-invalid');
        el.classList.remove('bp-field-invalid');
      } catch (_) {}
    }, 6000);
  } catch (_) {}
}

function bpNotifyFormError(message, fieldId, type) {
  var msg = String(message || 'Verifique os campos obrigatórios e tente novamente.');
  var title = 'Quase lá';
  var goField = function () {
    setTimeout(function () { bpFocarCampoForm(fieldId); }, 80);
  };
  // Modal centrado com CTA «Entendi»; ao fechar, foca o campo
  if (typeof mostrarErro === 'function' && document.getElementById('modal-erro')) {
    mostrarErro(msg, null, title, goField, { okLabel: 'Entendi' });
    return;
  }
  if (typeof showConfirmModal === 'function') {
    showConfirmModal(title, msg, false, {
      confirmLabel: 'Entendi',
      cancelLabel: 'Voltar',
      variant: 'default'
    }).then(function () { goField(); }).catch(function () { goField(); });
    return;
  }
  if (typeof toast === 'function') toast(msg, type || 'warning', { duration: 4000 });
  goField();
}
if (typeof window !== 'undefined') {
  window.bpNotifyFormError = bpNotifyFormError;
  window.bpFocarCampoForm = bpFocarCampoForm;
}

function animateKpi(id, txt) {
  if (typeof window !== 'undefined' && window.__bpQuietUI) {
    var elQ = document.getElementById(id);
    if (elQ) elQ.textContent = txt;
    return;
  }

  const el = document.getElementById(id);
  if (!el) { return; }
  if (el.textContent === txt) { return; }
  el.textContent = txt;
  el.classList.remove('kpi-pulse');
  void el.offsetWidth;
  el.classList.add('kpi-pulse');
  setTimeout(() => el.classList.remove('kpi-pulse'), 500);
}

function addRipple(el, e) {
  // Efeito de toque desativado a pedido — feedback visual agora é
  // só a opacidade discreta definida em :active (ver CSS).
  return;
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  var isOps = false;
  try {
    isOps = el.classList.contains('bp-ops-overlay') || (typeof _bpIsOpsModalId === 'function' && _bpIsOpsModalId(id));
  } catch (_) {}

  el.classList.remove('open', 'is-open', 'bp-ops-stacked');
  el.style.display = '';
  el.style.pointerEvents = '';
  try { el.hidden = true; } catch (_) {}
  try { el.setAttribute('hidden', ''); } catch (_) {}
  try { el.setAttribute('aria-hidden', 'true'); } catch (_) {}

  try {
    if (typeof window !== 'undefined' && window.__bpOpsStack && window.__bpOpsStack.length) {
      var st = window.__bpOpsStack;
      var idx = st.lastIndexOf(id);
      if (idx >= 0) st.splice(idx, 1);
      var prev = st.length ? st[st.length - 1] : null;
      if (prev) {
        var prevEl = document.getElementById(prev);
        if (prevEl) {
          prevEl.classList.remove('bp-ops-stacked');
          try { prevEl.hidden = false; prevEl.removeAttribute('hidden'); } catch (_) {}
          prevEl.setAttribute('aria-hidden', 'false');
          prevEl.classList.add('open');
          prevEl.style.display = 'flex';
          try {
            _bpOpsMountOverlay(prevEl);
            var titleEl = prevEl.querySelector('.bp-sheet-title');
            var eyeEl = prevEl.querySelector('.bp-sheet-eyebrow');
            _bpOpsActivateTab(
              titleEl ? titleEl.textContent : 'Operações',
              eyeEl ? eyeEl.textContent : 'Gestão'
            );
          } catch (_) {}
        }
      } else if (isOps) {
        try { _bpOpsLeaveTabIfEmpty(); } catch (_) {}
      }
    } else if (isOps) {
      try { _bpOpsLeaveTabIfEmpty(); } catch (_) {}
    }
  } catch (_) {}

  var stillOpen = false;
  try {
    stillOpen = !!document.querySelector('.modal-overlay.open');
  } catch (_) {}
  if (!stillOpen) {
    document.body.classList.remove('bp-modal-open');
    document.body.classList.remove('bp-ops-open');
    try {
      var y = document.body.dataset.bpScrollY;
      if (y != null && y !== '') delete document.body.dataset.bpScrollY;
    } catch (_) {}
  }
}


function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  var already = el.classList.contains('open') && (el.style.display === 'flex' || el.style.display === 'block');
  if (already) {
    try {
      if (_bpIsOpsModalId(id)) {
        _bpOpsMountOverlay(el);
        var tEl = el.querySelector('.bp-sheet-title');
        var eEl = el.querySelector('.bp-sheet-eyebrow');
        _bpOpsActivateTab(tEl ? tEl.textContent : '', eEl ? eEl.textContent : 'Gestão');
      }
    } catch (_) {}
    return;
  }

  var isOps = false;
  try {
    isOps = typeof _bpIsOpsModalId === 'function' ? _bpIsOpsModalId(id) : (id && String(id).indexOf('modal-bp-') === 0);
  } catch (_) {}

  if (isOps) {
    try {
      el.classList.add('bp-ops-overlay');
      var stack = (typeof window !== 'undefined' && window.__bpOpsStack) ? window.__bpOpsStack : (window.__bpOpsStack = []);
      document.querySelectorAll('.bp-ops-overlay.open').forEach(function (other) {
        if (other.id === id) return;
        other.classList.remove('open');
        other.style.display = 'none';
        other.setAttribute('aria-hidden', 'true');
        other.classList.add('bp-ops-stacked');
      });
      if (stack[stack.length - 1] !== id) stack.push(id);
      _bpOpsMountOverlay(el);
      var titleEl = el.querySelector('.bp-sheet-title');
      var eyeEl = el.querySelector('.bp-sheet-eyebrow');
      _bpOpsActivateTab(
        titleEl ? titleEl.textContent : 'Operações',
        eyeEl ? eyeEl.textContent : 'Gestão'
      );
    } catch (eOps) {
      try { console.warn('[BP Ops]', eOps); } catch (_) {}
    }
  }

  try { el.hidden = false; } catch (_) {}
  try { el.removeAttribute('hidden'); } catch (_) {}
  try { el.setAttribute('aria-hidden', 'false'); } catch (_) {}
  el.classList.add('open');
  el.style.display = isOps ? 'flex' : 'flex';
  if (!isOps && !document.body.classList.contains('bp-modal-open')) {
    try { document.body.dataset.bpScrollY = String(window.scrollY || 0); } catch (_) {}
    document.body.classList.add('bp-modal-open');
  }
}



// Fechar ao tocar no backdrop (só o próprio overlay, não o sheet) — não aplica a ops-em-aba
document.addEventListener('click', function (e) {
  const t = e.target;
  if (!t || !t.classList || !t.classList.contains('modal-overlay')) return;
  if (!t.classList.contains('open')) return;
  if (t.id === 'modal-confirm' || t.id === 'modal-erro' || t.id === 'modal-offline-info') return;
  if (t.classList.contains('bp-ops-overlay')) return;
  closeModal(t.id);
}, true);
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  var erroEl = document.getElementById('modal-erro');
  if (erroEl && erroEl.classList.contains('open')) {
    if (typeof erroEl._bpFinish === 'function') {
      try { erroEl._bpFinish(false); } catch (_) { closeModal('modal-erro'); }
    } else {
      closeModal('modal-erro');
    }
    e.preventDefault();
    return;
  }
  var confirmEl = document.getElementById('modal-confirm');
  if (confirmEl && confirmEl.classList.contains('open')) return;
  var offEl = document.getElementById('modal-offline-info');
  if (offEl && offEl.classList.contains('open')) return;
  /* Ops em aba: Escape = ← */
  try {
    if (window.__bpOpsStack && window.__bpOpsStack.length) {
      var top = window.__bpOpsStack[window.__bpOpsStack.length - 1];
      closeModal(top);
      e.preventDefault();
      return;
    }
  } catch (_) {}
  const open = document.querySelector('.modal-overlay.open');
  if (!open) return;
  closeModal(open.id);
});

function setButtonLoading(button, isLoading) {
  if (!button) return;
  if (isLoading) {
    button.classList.add('is-loading');
    button.disabled = true;
    try { button.setAttribute('aria-busy', 'true'); } catch (_) {}
  } else {
    button.classList.remove('is-loading');
    button.disabled = false;
    try { button.removeAttribute('aria-busy'); } catch (_) {}
  }
}

// ====================================================================
//  MODAL DE CONFIRMAÇÃO CENTRADO (Fase 1)
// ====================================================================
/**
 * ET4.8 — confirmação.
 * danger=true → destrutivo (CTA = opts.confirmLabel || "Eliminar")
 * danger=false → simples (CTA = opts.confirmLabel || "Continuar")
 * opts: { confirmLabel, cancelLabel, variant }
 */
function showConfirmModal(title, message, danger = true, opts) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modal-confirm');
    const titleEl = document.getElementById('confirm-title');
    const msgEl = document.getElementById('confirm-message');
    const okBtn = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    if (!overlay || !titleEl || !msgEl || !okBtn || !cancelBtn) { resolve(confirm(message || title)); return; }
    opts = opts || {};
    const variant = opts.variant || (danger ? 'destructive' : 'default');
    titleEl.textContent = title || 'Tem a certeza?';
    try { msgEl.classList.remove('confirm-message--summary'); } catch (_) {}
    try { msgEl.style.whiteSpace = ''; } catch (_) {}
    if (opts.summaryLayout && message) {
      var _esc = function (s) {
        return String(s == null ? '' : s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      };
      var lines = String(message).split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      var rows = [];
      var notes = [];
      lines.forEach(function (line) {
        var idx = line.indexOf(':');
        if (idx > 0 && idx < 24) {
          var lab = line.slice(0, idx).trim();
          var val = line.slice(idx + 1).trim();
          rows.push(
            '<div class="bp-confirm-summary-row">' +
            '<span class="bp-confirm-summary-label">' + _esc(lab) + '</span>' +
            '<span class="bp-confirm-summary-value">' + _esc(val) + '</span></div>'
          );
        } else {
          notes.push(_esc(line));
        }
      });
      try { msgEl.classList.add('confirm-message--summary'); msgEl.style.whiteSpace = 'normal'; } catch (_) {}
      msgEl.innerHTML =
        (rows.length ? '<div class="bp-confirm-summary">' + rows.join('') + '</div>' : '') +
        (notes.length ? '<p class="bp-confirm-summary-note">' + notes.join(' ') + '</p>' : '');
    } else {
      msgEl.textContent = message || 'Esta acção não pode ser desfeita.';
    }
    cancelBtn.textContent = opts.cancelLabel || 'Cancelar';
    cancelBtn.className = 'btn btn-secondary btn-modal-compact';
    if (variant === 'destructive' || danger) {
      okBtn.className = 'btn btn-danger btn-modal-compact';
      okBtn.textContent = opts.confirmLabel || 'Eliminar';
    } else if (variant === 'quiet') {
      // Quiet = tipografia limpa; CTA pode ser vermelho (ex. Sair) via confirmTone
      var quietTone = opts.confirmTone || 'neutral';
      if (quietTone === 'danger') {
        okBtn.className = 'btn btn-danger btn-modal-compact';
      } else {
        okBtn.className = 'btn btn-modal-compact btn-modal-quiet';
      }
      okBtn.textContent = opts.confirmLabel || 'Continuar';
    } else {
      okBtn.className = 'btn btn-primary btn-modal-compact';
      okBtn.textContent = opts.confirmLabel || 'Continuar';
    }
    /* Controlo financeiro / confirmações ink: texto preto, sem fundo dourado */
    if (opts.inkButtons) {
      okBtn.className = 'btn btn-modal-compact bp-btn-ink-strong';
      cancelBtn.className = 'btn btn-modal-compact bp-btn-ink-muted';
      okBtn.textContent = opts.confirmLabel || okBtn.textContent || 'Entendi';
      cancelBtn.textContent = opts.cancelLabel || cancelBtn.textContent || 'Voltar';
    }
    try {
      overlay.classList.toggle('modal-confirm--quiet', variant === 'quiet');
      overlay.classList.toggle('modal-confirm--destructive', variant === 'destructive' || !!danger);
    } catch (_) {}
    try {
      const lab = overlay.querySelector('label');
      if (lab && lab.querySelector('#keep-logged')) lab.style.display = 'none';
    } catch (_) {}
    var settled = false;
    var finish = function (val) {
      if (settled) return;
      settled = true;
      try { document.removeEventListener('keydown', onEsc, true); } catch (_) {}
      closeModal('modal-confirm');
      resolve(val);
    };
    var onEsc = function (e) {
      if (e.key !== 'Escape') return;
      if (!overlay.classList.contains('open')) return;
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    };
    const newOk2 = function () { finish(true); };
    const newCancel2 = function () { finish(false); };
    okBtn.onclick = newOk2;
    cancelBtn.onclick = newCancel2;
    overlay.onclick = function (e) {
      if (e.target === overlay) finish(false);
    };
    document.addEventListener('keydown', onEsc, true);
    openModal('modal-confirm');
    setTimeout(function () {
      try {
        if (okBtn && typeof okBtn.focus === 'function') okBtn.focus();
      } catch (_) {}
    }, 150);
  });
}

// ====================================================================
//  MODAL DE ERRO (Fase 7)
// ====================================================================
function mostrarErro(mensagem, acaoTentar = null, titulo, onClose, opts) {
  const modal = document.getElementById('modal-erro');
  const msgEl = document.getElementById('erro-message');
  const titleEl = document.getElementById('erro-title');
  const tentarBtn = document.getElementById('erro-tentar-btn');
  const cancelarBtn = document.getElementById('erro-cancelar-btn');
  if (!modal) {
    if (typeof onClose === 'function') {
      try { onClose(); } catch (_) {}
    }
    return;
  }
  opts = opts || {};
  if (titleEl) titleEl.textContent = titulo || 'Não foi possível concluir';
  if (msgEl) msgEl.textContent = mensagem || 'Algo impediu esta operação. Podes tentar de novo; se o problema continuar, verifica a ligação ou tenta mais tarde.';
  var okText = opts.okLabel || 'Fechar';
  if (cancelarBtn) {
    cancelarBtn.textContent = okText;
    // Validação: CTA tipográfico ink — sem caixa / contorno dourado
    try {
      cancelarBtn.className = 'btn btn-modal-compact bp-btn-ink-strong';
      cancelarBtn.style.border = 'none';
      cancelarBtn.style.boxShadow = 'none';
      cancelarBtn.style.background = 'transparent';
      cancelarBtn.style.color = '#0d0c0b';
      cancelarBtn.style.fontWeight = '700';
    } catch (_) {}
  }
  if (tentarBtn) {
    tentarBtn.textContent = 'Tentar novamente';
    tentarBtn.style.display = typeof acaoTentar === 'function' ? '' : 'none';
  }
  var settled = false;
  var finish = function (runTry) {
    if (settled) return;
    settled = true;
    try { modal._bpFinish = null; } catch (_) {}
    closeModal('modal-erro');
    if (runTry && typeof acaoTentar === 'function') {
      try { acaoTentar(); } catch (_) {}
    } else if (typeof onClose === 'function') {
      try { onClose(); } catch (_) {}
    }
  };
  try { modal._bpFinish = finish; } catch (_) {}
  if (tentarBtn) tentarBtn.onclick = function () { finish(true); };
  if (cancelarBtn) cancelarBtn.onclick = function () { finish(false); };
  modal.onclick = function (e) { if (e.target === modal) finish(false); };
  openModal('modal-erro');
  setTimeout(function () {
    try {
      if (cancelarBtn && typeof cancelarBtn.focus === 'function') cancelarBtn.focus();
    } catch (_) {}
  }, 120);
}

/**
 * Informação que exige reconhecimento do utilizador (CTA «Entendi»).
 * Reutiliza #modal-erro — mesmo contrato de bpNotificarValidacaoVenda / bpNotifyFormError.
 * Fallback: toast warning se o modal não estiver disponível.
 */
function bpInfoEntendi(mensagem, titulo) {
  var msg = String(mensagem == null ? '' : mensagem).trim();
  if (!msg) return;
  var title = (titulo && String(titulo).trim()) || 'Atenção';
  if (typeof mostrarErro === 'function' && document.getElementById('modal-erro')) {
    mostrarErro(msg, null, title, null, { okLabel: 'Entendi' });
    return;
  }
  if (typeof toast === 'function') toast(msg, 'warning');
}


/** Observabilidade cliente: contexto estruturado para debug (P2) */
function logContexto(acao, extra) {
  try {
    const ctx = {
      acao,
      tab: (typeof activeTab !== 'undefined' ? activeTab : null),
      salao: (state && state.config && state.config.salaoId) ? String(state.config.salaoId).slice(0, 8) : null,
      online: navigator.onLine,
      ts: new Date().toISOString(),
      ...(extra || {})
    };
    console.info('[BeautyPro:ctx]', ctx);
    return ctx;
  } catch (_) { return null; }
}

function reportarErro(acao, err, extra) {
  try {
    const msg = err && (err.message || String(err));
    logContexto(acao, { nivel: 'error', erro: msg, ...(extra || {}) });
    console.error('[BeautyPro]', acao, err);
  } catch (_) {}
}

/**
 * Armazenamento com ofuscação básica (P2). Não substitui RLS nem HTTPS.
 * Protege leitura casual de extensão; não é criptografia forte.
 */
function storageSetSecure(key, value) {
  try {
    const raw = typeof value === 'string' ? value : JSON.stringify(value);
    const encoded = btoa(unescape(encodeURIComponent(raw)));
    localStorage.setItem(key, 'bp1:' + encoded);
  } catch (e) {
    try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); } catch (_) {}
  }
}
function storageGetSecure(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    if (v == null) return fallback;
    if (v.startsWith('bp1:')) {
      return decodeURIComponent(escape(atob(v.slice(4))));
    }
    return v;
  } catch (_) {
    return fallback;
  }
}


// ====================================================================
//  MODAIS DO MENU ☰ — shell profissional partilhada (SaaS-grade)
// ====================================================================
/**
 * BP Ops Shell — ecrã completo previsível para módulos da Central / Gestão.
 * Todos os ensureShell* que delegam aqui herdam: full-screen + ← + pilha.
 * Modais curtos (confirm, erro, cliente, …) NÃO usam esta função.
 */
function _bpOpsEsc(s) {
  return typeof escHtml === 'function' ? escHtml(String(s == null ? '' : s)) : String(s == null ? '' : s);
}

function _bpIsOpsModalId(id) {
  return !!(id && String(id).indexOf('modal-bp-') === 0);
}

function _bpOpsStack() {
  if (typeof window === 'undefined') return [];
  if (!window.__bpOpsStack) window.__bpOpsStack = [];
  return window.__bpOpsStack;
}

function _bpOpsSyncBodyClass() {
  try {
    var any = document.querySelector('.bp-ops-overlay.open');
    document.body.classList.toggle('bp-ops-open', !!any);
  } catch (_) {}
}

function _bpOpsBuildSheetHtml(id, title, eyebrow, subtitle, opts) {
  opts = opts || {};
  var eye = eyebrow || 'BeautyPro';
  var sub = subtitle || '';
  var closeLabel = opts.closeLabel || 'Fechar';
  var primaryHtml = opts.primaryHtml || '';
  return (
    '<div class="bp-sheet modal-sheet bp-ops-sheet">' +
      '<div class="bp-ops-topbar">' +
        '<button type="button" class="bp-ops-back" data-close="' + id + '" aria-label="Voltar">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
            '<path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
        '</button>' +
        '<div class="bp-ops-topbar-text">' +
          '<div class="bp-sheet-eyebrow">' + _bpOpsEsc(eye) + '</div>' +
          '<h2 class="bp-sheet-title modal-title" id="' + id + '-title">' + _bpOpsEsc(title) + '</h2>' +
        '</div>' +
      '</div>' +
      '<p class="bp-sheet-subtitle"' + (sub ? '' : ' hidden') + '>' + _bpOpsEsc(sub) + '</p>' +
      '<div class="bp-sheet-body" id="' + id + '-body"></div>' +
      '<div class="bp-sheet-footer modal-actions">' +
        '<button type="button" class="btn btn-secondary" data-close="' + id + '">' + _bpOpsEsc(closeLabel) + '</button>' +
        primaryHtml +
      '</div>' +
    '</div>'
  );
}

function _bpOpsEnsureChrome(el, id, title, eyebrow, subtitle) {
  if (!el) return;
  el.classList.add('bp-ops-overlay');
  if (!el.querySelector('.bp-ops-back')) {
    var sheet = el.querySelector('.bp-sheet, .modal-sheet');
    if (sheet) {
      sheet.classList.add('bp-ops-sheet');
      var handle = sheet.querySelector('.bp-sheet-handle, .handle');
      if (handle) handle.setAttribute('hidden', '');
      var header = sheet.querySelector('.bp-sheet-header');
      var titleEl = sheet.querySelector('.bp-sheet-title');
      var eyeEl = sheet.querySelector('.bp-sheet-eyebrow');
      var subEl = sheet.querySelector('.bp-sheet-subtitle');
      var t = (titleEl && titleEl.textContent) || title || '';
      var eye = (eyeEl && eyeEl.textContent) || eyebrow || 'BeautyPro';
      var sub = (subEl && subEl.textContent) || subtitle || '';
      var top = document.createElement('div');
      top.className = 'bp-ops-topbar';
      top.innerHTML =
        '<button type="button" class="bp-ops-back" data-close="' + id + '" aria-label="Voltar">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
            '<path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
        '</button>' +
        '<div class="bp-ops-topbar-text">' +
          '<div class="bp-sheet-eyebrow">' + _bpOpsEsc(eye) + '</div>' +
          '<h2 class="bp-sheet-title modal-title" id="' + id + '-title">' + _bpOpsEsc(t) + '</h2>' +
        '</div>';
      if (header) header.replaceWith(top);
      else sheet.insertBefore(top, sheet.firstChild);
    }
  }
  var tEl = el.querySelector('.bp-sheet-title');
  var eEl = el.querySelector('.bp-sheet-eyebrow');
  var sEl = el.querySelector('.bp-sheet-subtitle');
  if (tEl && title) tEl.textContent = title;
  if (eEl && eyebrow) eEl.textContent = eyebrow;
  if (sEl) {
    if (subtitle) {
      sEl.textContent = subtitle;
      sEl.hidden = false;
    } else if (subtitle === '') {
      sEl.textContent = '';
      sEl.hidden = true;
    }
  }
}

function ensureBpSheetModal(id, title, eyebrow, subtitle, opts) {
  opts = opts || {};
  var el = document.getElementById(id);
  if (el) {
    _bpOpsEnsureChrome(el, id, title, eyebrow, subtitle);
    return el;
  }

  el = document.createElement('div');
  el.id = id;
  el.className = 'modal-overlay bp-ops-overlay';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', id + '-title');
  el.innerHTML = _bpOpsBuildSheetHtml(id, title, eyebrow, subtitle, opts);
  document.body.appendChild(el);

  el.addEventListener('click', function (e) {
    /* Full-screen ops: não fecha ao tocar no fundo — só ← / Fechar / data-close */
    var closeId = e.target && e.target.getAttribute && e.target.getAttribute('data-close');
    if (!closeId && e.target && e.target.closest) {
      var btn = e.target.closest('[data-close]');
      if (btn) closeId = btn.getAttribute('data-close');
    }
    if (closeId === id) {
      if (typeof closeModal === 'function') closeModal(id);
      else el.classList.remove('open');
    }
  });

  return el;
}

function openBpSheetModal(id) {
  if (typeof openModal === 'function') openModal(id);
  else {
    var el = document.getElementById(id);
    if (el) {
      el.classList.add('open');
      el.style.display = 'flex';
    }
  }
}

function bpOpsPop() {
  var stack = _bpOpsStack();
  if (!stack.length) return false;
  var top = stack[stack.length - 1];
  if (typeof closeModal === 'function') closeModal(top);
  return true;
}

if (typeof window !== 'undefined') {
  window.ensureBpSheetModal = ensureBpSheetModal;
  window.openBpSheetModal = openBpSheetModal;
  window.bpOpsPop = bpOpsPop;
  window._bpIsOpsModalId = _bpIsOpsModalId;
}


/** JSON.stringify com limite de tamanho (evitar QuotaExceeded). */
function safeStringify(obj, maxBytes) {
  maxBytes = maxBytes || (4.5 * 1024 * 1024);
  try {
    var s = JSON.stringify(obj);
    if (s.length <= maxBytes) return s;
    return JSON.stringify({ _truncated: true, length: s.length });
  } catch (e) {
    return 'null';
  }
}
if (typeof window !== 'undefined') window.safeStringify = safeStringify;


/** Etapa 1 — overlay checkmark / offline após boot */
function showCheckmark(opts) {
  /* Funcionalidade eliminada — sem modal de sucesso */
  return Promise.resolve();
}
function hideCheckmark() {
  var el = document.getElementById('bp-checkmark-overlay');
  if (el) {
    el.hidden = true;
    el.style.display = 'none';
  }
  return Promise.resolve();
}

if (typeof window !== 'undefined') {
  window.showCheckmark = showCheckmark;
  window.hideCheckmark = hideCheckmark;
}

/* D-2: espelho global explícito (scripts clássicos + consumidores externos) */
if (typeof window !== 'undefined') {
  window.toast = toast;
  window.bpToastMsgPT = bpToastMsgPT;
  window.hoje = hoje;
  window.uuid = typeof uuid === 'function' ? uuid : window.uuid;
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.showConfirmModal = showConfirmModal;
  window.mostrarErro = mostrarErro;
  window.bpInfoEntendi = bpInfoEntendi;
  window.setButtonLoading = setButtonLoading;
  window.addRipple = addRipple;
  window.animateKpi = animateKpi;
  window.logErroSilencioso = logErroSilencioso;
  window.logContexto = logContexto;
  window.reportarErro = reportarErro;
  window.storageGetSecure = storageGetSecure;
  window.storageSetSecure = storageSetSecure;
}



(function _bpOpsWireTabBack() {
  if (typeof document === 'undefined') return;
  function bind() {
    var btn = document.getElementById('bp-ops-tab-back');
    if (!btn || btn.dataset.bpOpsBound) return;
    btn.dataset.bpOpsBound = '1';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var stack = window.__bpOpsStack || [];
      var top = stack.length ? stack[stack.length - 1] : null;
      if (top && typeof closeModal === 'function') closeModal(top);
      else if (typeof _bpOpsLeaveTabIfEmpty === 'function') _bpOpsLeaveTabIfEmpty();
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
