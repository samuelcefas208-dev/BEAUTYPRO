/* BelezaPro E15 — core/sync-ui.js
 * UI da sincronização (banner, indicador, modal offline, modal DLQ).
 * ORDEM: DEPOIS de core/sync-queue.js (usa getSyncQueue, getDlq, flush…).
 */
function actualizarBannerOffline() {
  // Banner topo continua desactivado (relatório: não intrusivo permanente).
  const banner = document.getElementById('offline-banner');
  if (banner) {
    banner.classList.remove('show');
    banner.style.display = 'none';
    banner.setAttribute('aria-hidden', 'true');
  }
  // ET4.10: aviso offline centrado, uma vez por sessão, CTA Entendi.
  try {
    if (typeof bpMaybeShowOfflineInfoModal === 'function') bpMaybeShowOfflineInfoModal();
  } catch (_) {}
}

/** Offline info modal — centro, obrigatório ler, depois desaparece (sessionStorage). */
function bpMaybeShowOfflineInfoModal(force) {
  try {
    if (typeof navigator === 'undefined') return;
    if (navigator.onLine && !force) return;
    if (!force && sessionStorage.getItem('bp_offline_info_ack') === '1') return;
    var modal = document.getElementById('modal-offline-info');
    if (!modal) return;
    if (modal.classList.contains('open') && (modal.style.display === 'flex' || getComputedStyle(modal).display === 'flex')) return;
    /* Garantir visibilidade acima do boot overlay e de outros sheets */
    try { modal.hidden = false; modal.removeAttribute('hidden'); } catch (_) {}
    try { modal.setAttribute('aria-hidden', 'false'); } catch (_) {}
    modal.classList.add('open');
    modal.style.display = 'flex';
    modal.style.zIndex = '10060';
    if (typeof openModal === 'function') {
      try { openModal('modal-offline-info'); } catch (_) {}
    }
  } catch (_) {}
}

function bpAckOfflineInfoModal() {
  try { sessionStorage.setItem('bp_offline_info_ack', '1'); } catch (_) {}
  try {
    if (typeof closeModal === 'function') closeModal('modal-offline-info');
    else {
      var modal = document.getElementById('modal-offline-info');
      if (modal) {
        modal.classList.remove('open');
        modal.style.display = 'none';
        modal.hidden = true;
      }
    }
  } catch (_) {}
}

if (typeof window !== 'undefined') {
  window.bpMaybeShowOfflineInfoModal = bpMaybeShowOfflineInfoModal;
  window.bpAckOfflineInfoModal = bpAckOfflineInfoModal;
}

(function bpBindOfflineInfoModal() {
  function bind() {
    var ok = document.getElementById('modal-offline-info-ok');
    if (!ok || ok.dataset.bpBound) return;
    ok.dataset.bpBound = '1';
    ok.addEventListener('click', function () {
      if (typeof bpAckOfflineInfoModal === 'function') bpAckOfflineInfoModal();
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
  // Uma vez por sessão de separador: se ainda não leu, mostra ao ficar offline.
  window.addEventListener('offline', function () {
    try { sessionStorage.removeItem('bp_offline_info_ack'); } catch (_) {}
    setTimeout(function () {
      if (typeof bpMaybeShowOfflineInfoModal === 'function') bpMaybeShowOfflineInfoModal(true);
    }, 350);
  });
  // Arranque já offline — mostrar modal (forçado se ainda offline)
  function bpBootOfflineInfo() {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (typeof bpMaybeShowOfflineInfoModal === 'function') bpMaybeShowOfflineInfoModal(true);
      } else if (typeof actualizarBannerOffline === 'function') {
        actualizarBannerOffline();
      }
    } catch (_) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(bpBootOfflineInfo, 500);
    });
  } else {
    setTimeout(bpBootOfflineInfo, 500);
  }
})();


function _bpEnsureSyncSpin(container) {
  if (!container) return null;
  var spin = container.querySelector('.sync-spin');
  if (spin) return spin;
  spin = document.createElement('span');
  spin.className = 'sync-spin';
  spin.setAttribute('aria-hidden', 'true');
  spin.innerHTML =
    '<svg class="sync-spin-svg" viewBox="0 0 24 24" width="14" height="14" fill="none" focusable="false">' +
    '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" opacity="0.25"/>' +
    '<path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>' +
    '</svg>';
  var text = container.querySelector('#sync-text') || container.firstChild;
  if (text) container.insertBefore(spin, text);
  else container.appendChild(spin);
  return spin;
}

function atualizarIndicadorSync() {
  const text = document.getElementById('sync-text');
  const container = document.getElementById('sync-status-container');
  const fila = (typeof getSyncQueue === 'function') ? getSyncQueue() : [];
  const now = Date.now();
  const ready = fila.filter(function (op) {
    return op && op.failed !== true && (!op.nextRetry || op.nextRetry <= now);
  }).length;
  const backoff = fila.filter(function (op) {
    return op && op.failed !== true && op.nextRetry && op.nextRetry > now;
  }).length;
  const pendentes = ready + backoff;
  const falhados = fila.filter(function (op) { return op && op.failed === true; }).length;
  const dlqN = (typeof bpGetDlqCount === 'function') ? bpGetDlqCount() : 0;
  const offline = (typeof navigator !== 'undefined' && !navigator.onLine);
  const flushing = !!(typeof window !== 'undefined' && window.__bpSyncFlushing);

  let stateKey = 'ok';
  let label = '';
  if (offline) {
    stateKey = 'offline';
    label = pendentes > 0 ? ('Sem rede · ' + pendentes + ' pend.') : 'Sem rede';
  } else if (flushing || pendentes > 0) {
    stateKey = 'pending';
    if (flushing) {
      label = pendentes > 0 ? ('A sincronizar · ' + pendentes) : 'A sincronizar…';
    } else if (backoff > 0 && ready === 0) {
      label = pendentes + ' em espera';
    } else {
      label = pendentes === 1 ? '1 pendente' : (pendentes + ' pendentes');
    }
  } else if (dlqN > 0 || falhados > 0) {
    stateKey = 'error';
    var nFail = dlqN + falhados;
    label = nFail === 1 ? '1 falhada' : (nFail + ' falhadas');
  } else if (typeof bpGetServiceHealth === 'function') {
    try {
      var health = bpGetServiceHealth();
      if (typeof bpNotifyHealthIfNeeded === 'function') bpNotifyHealthIfNeeded(health);
    } catch (_) {}
  }

  const show = stateKey !== 'ok';
  const shouldSpin = stateKey === 'pending' && !offline && (flushing || ready > 0);
  if (text) text.textContent = label;
  if (container) {
    _bpEnsureSyncSpin(container);
    container.classList.toggle('is-visible', show);
    container.classList.toggle('is-syncing', shouldSpin);
    container.style.display = show ? 'flex' : 'none';
    container.setAttribute('data-state', stateKey);
    container.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (show) container.setAttribute('title', label);
    else container.removeAttribute('title');
  }
  try {
    window.dispatchEvent(new CustomEvent('bp:sync-state', {
      detail: { state: stateKey, pendentes: pendentes, falhados: falhados, offline: offline, flushing: flushing, spinning: shouldSpin }
    }));
  } catch (_) {}

  if (typeof actualizarBannerOffline === 'function') actualizarBannerOffline();
}

/** Alias estável — única API pública de UI de sync */
function setSyncUi() { atualizarIndicadorSync(); }
if (typeof window !== 'undefined') {
  window.setSyncUi = setSyncUi;
  window.atualizarIndicadorSync = atualizarIndicadorSync;
}


function bpOpenDlqModal() {
  var dlq = getDlq();
  var body = '';
  if (!dlq.length) {
    body = '<p class="bp-dash-next-empty">Não há operações falhadas.</p>';
  } else {
    body = dlq.slice(-30).map(function (item) {
      return '<div class="bp-dash-lista-item"><div><div>' +
        (item.tabela || '') + ' · ' + (item.operacao || '') +
        '</div><div class="bp-dash-next-meta">' +
        String(item.error || '').slice(0, 120) +
        '</div></div></div>';
    }).join('');
  }
  var existing = document.getElementById('modal-sync-dlq');
  if (!existing) {
    var wrap = document.createElement('div');
    wrap.id = 'modal-sync-dlq';
    wrap.className = 'modal-overlay';
    wrap.setAttribute('role', 'dialog');
    wrap.innerHTML =
      '<div class="modal-sheet">' +
      '<div class="handle"></div>' +
      '<div class="modal-title">Operações falhadas</div>' +
      '<div id="modal-sync-dlq-body" class="bp-dash-lista-body"></div>' +
      '<button type="button" class="btn btn-primary btn-block" id="modal-sync-dlq-retry">Reprocessar falhadas</button>' +
      '<button type="button" class="btn btn-secondary btn-block mt-2" data-close="modal-sync-dlq">Fechar</button>' +
      '</div>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) {
      if (e.target === wrap || (e.target.getAttribute && e.target.getAttribute('data-close') === 'modal-sync-dlq')) {
        if (typeof closeModal === 'function') closeModal('modal-sync-dlq');
        else { wrap.classList.remove('open'); wrap.style.display = 'none'; }
      }
    });
    document.getElementById('modal-sync-dlq-retry').addEventListener('click', function () {
      if (typeof closeModal === 'function') closeModal('modal-sync-dlq');
      if (typeof bpReprocessDlq === 'function') bpReprocessDlq();
    });
  }
  var b = document.getElementById('modal-sync-dlq-body');
  if (b) b.innerHTML = body;
  if (typeof openModal === 'function') openModal('modal-sync-dlq');
  else {
    var m = document.getElementById('modal-sync-dlq');
    m.classList.add('open');
    m.style.display = 'flex';
  }
}
if (typeof window !== 'undefined') window.bpOpenDlqModal = bpOpenDlqModal;


if (typeof window !== 'undefined') {
  window.actualizarBannerOffline = actualizarBannerOffline;
  window.bpMaybeShowOfflineInfoModal = bpMaybeShowOfflineInfoModal;
  window.bpAckOfflineInfoModal = bpAckOfflineInfoModal;
  window.atualizarIndicadorSync = atualizarIndicadorSync;
  window.setSyncUi = setSyncUi;
  window.bpOpenDlqModal = bpOpenDlqModal;
}
