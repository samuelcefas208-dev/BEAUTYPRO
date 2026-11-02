/* BelezaPro D-5.4 — core/sync-queue.js
 * Extraído de app.bundle.js (FILE: sync-queue.js).
 *
 * ORDEM:
 *   … → db-indexeddb → resilience → auth → sync-queue → app.bundle.js (sync-rest + crud)
 *
 * CRÍTICO:
 * - No load, captura dbPut/dbDelete originais e substitui (offline-first + fila).
 * - supabaseUpsert/Delete/Deactivate vêm de sync-rest (runtime, após bundle).
 * - STORE_TO_TABLE vem de core/constants.js.
 * - state.config.salaoId gate mantido (isolamento multi-tenant).
 *
 * Ver docs/D5_4_SYNC_QUEUE.md
 */

// ====================================================================
//  FILA DE SINCRONIZAÇÃO (extraído do app.js na Fase B da modularização)
// ====================================================================

// ================================================================
//  LISTA NEGRA DE ELIMINADOS (evita reimportação)
// ================================================================

/* FASE 1.2 — IIFE: isola const/var e evita SyntaxError DELETED_KEY com app.bundle.js */
(function (global) {
  /* sem "use strict": precisa de state/dbPut/STORE_TO_TABLE globais do runtime */
  if (global.__BP_SYNC_QUEUE_V12__) {
    try { console.info("[sync-queue] skip re-load"); } catch (_) {}
    return;
  }
  global.__BP_SYNC_QUEUE_V12__ = true;

var DELETED_KEY = 'bp_deleted_items';
var DLQ_KEY = 'bp_dlq';
var MAX_SYNC_ATTEMPTS = 5;
var QUEUE_SOFT_WARN = 1000;
var QUEUE_HARD_BLOCK = 5000;
var LS_WARN_BYTES = Math.floor(4.5 * 1024 * 1024);

/** Remove data URLs e campos binários — fila só metadados (P0). */
function slimPayload(payload) {
  if (payload == null || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) {
    return payload.map(function (x) { return slimPayload(x); });
  }
  var out = {};
  var keys = Object.keys(payload);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var v = payload[k];
    if (v == null) { out[k] = v; continue; }
    if (typeof v === 'string') {
      if (v.indexOf('data:') === 0) continue; // base64 / data URL
      if (v.length > 12000 && /^[A-Za-z0-9+/=\\s]+$/.test(v.slice(0, 80))) continue; // blob textual enorme
      out[k] = v;
      continue;
    }
    if (typeof v === 'object') {
      if (k === 'foto' || k === 'imagem' || k === 'foto_base64' || k === 'image') continue;
      out[k] = slimPayload(v);
      continue;
    }
    out[k] = v;
  }
  return out;
}

/** FASE 1 — helpers puros (testáveis) para soft-delete na fila */
function bpIsSoftIntent(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.ativo === false || payload.ativo === 0 || payload.ativo === 'false') return true;
  if (payload.deleted_at) return true;
  var st = payload.status != null ? String(payload.status).toLowerCase() : '';
  if (st === 'cancelado' || st === 'cancelled') return true;
  return false;
}

function bpBuildSoftPayload(tabela, payload, id) {
  var now = new Date().toISOString();
  var base = Object.assign({}, payload || {}, { id: id || (payload && payload.id) });
  if (!base.id) return base;
  if (tabela === 'clientes' || tabela === 'profissionais' || tabela === 'servicos') {
    base.ativo = false;
    if (!base.deleted_at) base.deleted_at = now;
  }
  if (tabela === 'profissionais' && !base.data_desativacao) base.data_desativacao = now;
  if (tabela === 'agendamentos') {
    if (!base.deleted_at) base.deleted_at = now;
    if (!base.status || String(base.status).toLowerCase() === 'agendado') base.status = 'cancelado';
  }
  if (tabela === 'movimentos') {
    if (!base.status || String(base.status).toLowerCase() === 'activo' || String(base.status).toLowerCase() === 'ativo') {
      base.status = 'cancelado';
    }
    if (!base.cancelado_em) base.cancelado_em = now.slice(0, 10);
  }
  // Tabelas genéricas: pelo menos deleted_at
  if (!base.deleted_at && tabela !== 'movimentos') base.deleted_at = now;
  base.updated_at = now;
  return base;
}

/** Normaliza ops legadas operacao=delete → upsert soft (idempotente). */
function bpNormalizeQueueOps(ops) {
  if (!Array.isArray(ops)) return [];
  return ops.map(function (op) {
    if (!op || !op.payload) return op;
    if (op.operacao === 'delete') {
      return Object.assign({}, op, {
        operacao: 'upsert',
        payload: bpBuildSoftPayload(op.tabela, op.payload, op.payload.id)
      });
    }
    return op;
  });
}


function getDlq() {
  try {
    var raw = JSON.parse(localStorage.getItem(DLQ_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch (e) { return []; }
}

function saveDlq(items) {
  try {
    localStorage.setItem(DLQ_KEY, JSON.stringify((items || []).slice(-200)));
  } catch (e) {
    if (typeof logErroSilencioso === 'function') logErroSilencioso('saveDlq', e);
  }
}

function moveOpToDlq(op, reason) {
  var dlq = getDlq();
  dlq.push({
    id: op && op.id,
    tabela: op && op.tabela,
    operacao: op && op.operacao,
    payload: op && op.payload,
    ts: Date.now(),
    attempts: op && op.attempts,
    error: reason || (op && op.lastError) || 'max_attempts',
    originalTs: op && op.ts
  });
  saveDlq(dlq);
}

function bpGetDlqCount() {
  return getDlq().length;
}
if (typeof window !== 'undefined') {
  window.slimPayload = slimPayload;
  window.bpGetDlqCount = bpGetDlqCount;
  window.getDlq = getDlq;
}


function getDeletedItems() {
  try {
    const raw = JSON.parse(localStorage.getItem(DELETED_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch (e) { logErroSilencioso('getDeletedItems', e); return []; }
}

function saveDeletedItems(items) {
  try { localStorage.setItem(DELETED_KEY, JSON.stringify(items)); }
  catch (e) { logErroSilencioso('saveDeletedItems', e); }
}

function addDeletedItem(id, tabela) {
  if (!id || !tabela) return;
  const items = pruneDeletedItems(getDeletedItems());
  const existing = items.find(i => i.id === id && i.tabela === tabela);
  if (existing) {
    existing.ts = Date.now();
  } else {
    items.push({ id, tabela, ts: Date.now() });
  }
  // Cap de segurança (DoS local / storage overflow)
  const MAX_TOMBSTONES = 2000;
  saveDeletedItems(items.slice(-MAX_TOMBSTONES));
}

function touchDeletedItem(id, tabela) {
  addDeletedItem(id, tabela);
}

function isDeletedItem(id, tabela) {
  if (!id) return false;
  return pruneDeletedItems(getDeletedItems()).some(i => i.id === id && (!tabela || i.tabela === tabela));
}

/** Tombstones expiram após 30 dias (ISO / práticas de sync offline). */
function pruneDeletedItems(items) {
  const TTL = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  return (items || []).filter(i => i && i.id && (now - (i.ts || 0)) < TTL);
}

function removeDeletedItem(id, tabela) {
  // Remoção explícita apenas em cenários de undelete administrativo.
  const items = getDeletedItems().filter(i => !(i.id === id && i.tabela === tabela));
  saveDeletedItems(items);
}

function getSyncQueue() {
  try {
    let raw = localStorage.getItem(SYNC_QUEUE_KEY) || '[]';
    if (typeof storageGetSecure === 'function' && raw.startsWith('bp1:')) {
      raw = storageGetSecure(SYNC_QUEUE_KEY, '[]');
    }
    return JSON.parse(raw || '[]');
  } catch (e) { logErroSilencioso('getSyncQueue', e); return []; }
}

function saveSyncQueue(q) {
  q = (q || []).map(function (op) {
    if (!op || typeof op !== 'object') return op;
    var copy = Object.assign({}, op);
    if (copy.payload) copy.payload = slimPayload(copy.payload);
    return copy;
  });
  try {
    var str = JSON.stringify(q);
    if (typeof LS_WARN_BYTES !== 'undefined' && str.length > LS_WARN_BYTES) {
      try { console.warn('[sync] Fila > 4.5MB (' + str.length + ' bytes). A comprimir payloads.'); } catch (_) {}
      q = q.map(function (op) {
        if (!op) return op;
        var o = Object.assign({}, op);
        o.payload = slimPayload(o.payload);
        if (o.payload && typeof o.payload === 'object') {
          var p = Object.assign({}, o.payload);
          delete p.itens;
          delete p.notas;
          o.payload = p;
        }
        return o;
      });
      str = JSON.stringify(q);
    }
    if (typeof storageSetSecure === 'function') storageSetSecure(SYNC_QUEUE_KEY, str);
    else localStorage.setItem(SYNC_QUEUE_KEY, str);
    try { sessionStorage.setItem(SYNC_QUEUE_KEY + '_len', String((q && q.length) || 0)); } catch (_) {}
  } catch (e) {
    if (typeof logErroSilencioso === 'function') logErroSilencioso('saveSyncQueue', e);
    try {
      var minimal = (q || []).map(function (op) {
        return {
          id: op && op.id,
          tabela: op && op.tabela,
          operacao: op && op.operacao,
          ts: op && op.ts,
          attempts: op && op.attempts,
          failed: op && op.failed,
          nextRetry: op && op.nextRetry,
          lastError: op && op.lastError,
          payload: slimPayload(op && op.payload ? { id: op.payload.id } : null)
        };
      });
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(minimal));
    } catch (e2) {
      if (typeof logErroSilencioso === 'function') logErroSilencioso('saveSyncQueue.fallback', e2);
      if (typeof toast === 'function') {
        toast('Armazenamento do dispositivo quase cheio. Liberte espaço — a fila tem ' + ((q && q.length) || 0) + ' ops.', 'warning');
      }
    }
  }
}


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
function bpMaybeShowOfflineInfoModal() {
  try {
    if (typeof navigator === 'undefined' || navigator.onLine) return;
    if (sessionStorage.getItem('bp_offline_info_ack') === '1') return;
    var modal = document.getElementById('modal-offline-info');
    if (!modal) return;
    if (modal.classList.contains('open')) return;
    modal.hidden = false;
    if (typeof openModal === 'function') openModal('modal-offline-info');
    else {
      modal.classList.add('open');
      modal.style.display = 'flex';
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
    setTimeout(function () {
      if (typeof bpMaybeShowOfflineInfoModal === 'function') bpMaybeShowOfflineInfoModal();
    }, 200);
  });
  // Arranque já offline
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(function () {
        if (typeof actualizarBannerOffline === 'function') actualizarBannerOffline();
      }, 400);
    });
  } else {
    setTimeout(function () {
      if (typeof actualizarBannerOffline === 'function') actualizarBannerOffline();
    }, 400);
  }
})();


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

  let stateKey = 'ok';
  let label = '';
  if (offline) {
    stateKey = 'offline';
    label = pendentes > 0 ? ('Sem rede · ' + pendentes + ' pend.') : 'Sem rede';
  } else if (pendentes > 0) {
    stateKey = 'pending';
    if (backoff > 0 && ready === 0) {
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
  if (text) text.textContent = label;
  if (container) {
    container.classList.toggle('is-visible', show);
    container.style.display = show ? 'flex' : 'none';
    container.setAttribute('data-state', stateKey);
    container.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (show) container.setAttribute('title', label);
    else container.removeAttribute('title');
  }
  // Evento único para outros módulos (sem DOM scraping)
  try {
    window.dispatchEvent(new CustomEvent('bp:sync-state', { detail: { state: stateKey, pendentes: pendentes, falhados: falhados, offline: offline } }));
  } catch (_) {}

  if (typeof actualizarBannerOffline === 'function') actualizarBannerOffline();
}

/** Alias estável — única API pública de UI de sync */
function setSyncUi() { atualizarIndicadorSync(); }
if (typeof window !== 'undefined') {
  window.setSyncUi = setSyncUi;
  window.atualizarIndicadorSync = atualizarIndicadorSync;
}

function addToSyncQueue(tabela, operacao, payload) {
  payload = slimPayload(payload);
  var entityId = payload && payload.id;

  // FASE 1: delete legado → soft upsert (nunca HTTP DELETE)
  if (operacao === 'delete' && entityId) {
    operacao = 'upsert';
    payload = slimPayload(bpBuildSoftPayload(tabela, payload, entityId));
    try { if (typeof addDeletedItem === 'function') addDeletedItem(entityId, tabela); } catch (_) {}
  }

  var softIntent = bpIsSoftIntent(payload);

  // Tombstone bloqueia reactivação acidental, mas NÃO bloqueia soft explícito
  if (!softIntent && entityId && typeof isDeletedItem === 'function' && isDeletedItem(entityId, tabela)) {
    try { console.info('[sync] upsert ignorado — tombstone activo', tabela, entityId); } catch (_) {}
    return;
  }

  var q = bpNormalizeQueueOps(getSyncQueue());
  if (entityId) {
    // Soft ganha sobre qualquer op pendente do mesmo id (incl. delete legado)
    q = q.filter(function (item) {
      return !(item && item.tabela === tabela && item.payload && item.payload.id === entityId);
    });
  }
  if (typeof QUEUE_HARD_BLOCK !== 'undefined' && q.length >= QUEUE_HARD_BLOCK) {
    if (typeof toast === 'function') {
      toast('Fila de sincronização demasiado grande. Aguarde a sincronização antes de novas alterações.', 'error');
    }
    try { console.error('[sync] Fila >= HARD_BLOCK — bloqueio de novas ops'); } catch (_) {}
    if (typeof navigator !== 'undefined' && navigator.onLine && typeof flushSyncQueue === 'function') {
      try { flushSyncQueue(); } catch (_) {}
    }
    return;
  }
  if (typeof QUEUE_SOFT_WARN !== 'undefined' && q.length >= QUEUE_SOFT_WARN) {
    try { console.warn('[sync] Fila grande:', q.length, 'ops'); } catch (_) {}
  }
  q.push({
    id: typeof uuid === 'function' ? uuid() : String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8),
    tabela: tabela,
    operacao: operacao,
    payload: payload,
    ts: Date.now(),
    attempts: 0,
    failed: false,
    nextRetry: 0,
    lastError: null
  });
  saveSyncQueue(q);
  if (typeof atualizarIndicadorSync === 'function') atualizarIndicadorSync();
}


async function flushSyncQueue() {
  try { window.__bpSyncFlushing = true; } catch (_) {}
  try { if (typeof atualizarIndicadorSync === 'function') atualizarIndicadorSync(); } catch (_) {}

  if (!navigator.onLine) return flushSyncQueue._lastPromise || Promise.resolve();
  if (flushSyncQueue._promise) return flushSyncQueue._promise;
  flushSyncQueue._promise = (async function flushInternal() {
    const BATCH_SIZE = 25;
    const YIELD_MS = 30;
    const MAX_ATTEMPTS = (typeof MAX_SYNC_ATTEMPTS !== 'undefined') ? MAX_SYNC_ATTEMPTS : 5;
    try {
      let q = bpNormalizeQueueOps(getSyncQueue());
      if (q.length !== getSyncQueue().length) {
        try { saveSyncQueue(q); } catch (_) {}
      }
      if (!q.length) return;

      // Se só há backoff: após 30s no backoff, forçar ready (P1)
      var now = Date.now();
      var hasReady = q.some(function (op) {
        return op && op.failed !== true && (!op.nextRetry || op.nextRetry <= now);
      });
      if (!hasReady) {
        var inBackoff = q.filter(function (op) {
          return op && op.failed !== true && op.nextRetry && op.nextRetry > now;
        });
        if (inBackoff.length) {
          inBackoff.forEach(function (op) {
            var waited = now - (op.nextRetry - (op._backoffSpan || 0));
            // Se nextRetry está no futuro há >30s desde a última falha, promover
            if (op.nextRetry - now < 0) return;
            var age = now - (op.tsLastFail || op.ts || 0);
            if (age >= 30000 || (op.nextRetry - now) > 30000) {
              op.nextRetry = 0;
            }
          });
          // Promoção mais simples e fiável: se o flush é pedido e o backoff mais antigo > 30s
          var minRetry = Math.min.apply(null, inBackoff.map(function (op) { return op.nextRetry || 0; }));
          if (minRetry && (now - (minRetry - 60000)) >= 0) {
            // se qualquer nextRetry já passou de 30s de atraso máximo, zerar todos os ready-stuck
          }
          var oldestFail = Math.min.apply(null, inBackoff.map(function (op) { return op.tsLastFail || op.ts || now; }));
          if (now - oldestFail >= 30000) {
            inBackoff.forEach(function (op) { op.nextRetry = 0; });
            saveSyncQueue(q);
            q = getSyncQueue();
          }
        }
      }

      const itensFalhos = [];
      let processed = 0;
      let interrompido = false;
      let sessionExpired = false;

      while (q.length && navigator.onLine && !interrompido && !sessionExpired) {
        const batch = [];
        const defer = [];
        now = Date.now();
        for (let i = 0; i < q.length; i++) {
          const op = q[i];
          if (!op) continue;
          if (op.failed === true) {
            // failed legado → DLQ
            moveOpToDlq(op, op.lastError || 'failed_flag');
            continue;
          }
          if (op.nextRetry && now < op.nextRetry) {
            defer.push(op);
            continue;
          }
          if (batch.length < BATCH_SIZE) batch.push(op);
          else defer.push(op);
        }

        if (!batch.length) {
          saveSyncQueue(defer);
          break;
        }

        const restantesBatch = [];
        for (let i = 0; i < batch.length; i++) {
          if (!navigator.onLine) {
            interrompido = true;
            restantesBatch.push.apply(restantesBatch, batch.slice(i));
            break;
          }
          const op = batch[i];
          try {
            if (op.operacao === 'delete') {
              await supabaseDelete(op.tabela, op.payload.id);
              if (typeof removeDeletedItem === 'function') {
                removeDeletedItem(op.payload.id, op.tabela);
              }
            } else {
              if (typeof isDeletedItem === 'function' && isDeletedItem(op.payload && op.payload.id, op.tabela)) {
                processed++;
                continue;
              }
              const payload = op.payload || {};
              const isDeact = payload.ativo === false || payload.ativo === 0 || payload.ativo === 'false';
              if (isDeact && (op.tabela === 'profissionais' || op.tabela === 'servicos') && typeof supabaseDeactivate === 'function') {
                await supabaseDeactivate(op.tabela, payload.id, {
                  data_desativacao: payload.data_desativacao || null,
                  updated_at: payload.updated_at || new Date().toISOString()
                });
              } else {
                await supabaseUpsert(op.tabela, slimPayload(op.payload));
              }
            }
            processed++;
          } catch (err) {
            var msg = (err && err.message) ? String(err.message) : String(err || '');
            op.lastError = msg.slice(0, 300);
            op.tsLastFail = Date.now();

            if (msg === 'SESSION_EXPIRED') {
              sessionExpired = true;
              restantesBatch.push(op);
              restantesBatch.push.apply(restantesBatch, batch.slice(i + 1));
              break;
            }
            if (msg === 'LIMITE_PLANO_ATINGIDO') {
              if (typeof toast === 'function') toast('Operação bloqueada: limite do plano atingido. Fica na fila até o plano permitir.', 'error');
              op.failed = false;
              op.attempts = (op.attempts || 0) + 1;
              var d1 = Math.min(300000, 60000 + (op.attempts * 15000));
              op.nextRetry = Date.now() + d1 + Math.random() * 1000;
              op._backoffSpan = d1;
              restantesBatch.push(op);
              continue;
            }
            if (msg === 'DUPLICADO_BLOQUEADO' || msg.indexOf('DUPLICADO') >= 0) {
              if (typeof logErroSilencioso === 'function') logErroSilencioso('flushSyncQueue.duplicado', err);
              moveOpToDlq(op, msg);
              itensFalhos.push(op.id || 'item');
              continue;
            }

            op.attempts = (op.attempts || 0) + 1;
            op.failed = false;
            if (op.attempts >= MAX_ATTEMPTS) {
              moveOpToDlq(op, msg);
              itensFalhos.push(op.id || 'item');
              continue;
            }
            var delay = Math.min(60000, Math.pow(2, Math.min(op.attempts, 6)) * 1000) + Math.random() * 1000;
            op.nextRetry = Date.now() + delay;
            op._backoffSpan = delay;
            restantesBatch.push(op);
          }
        }

        q = restantesBatch.concat(defer);
        saveSyncQueue(q);
        if (typeof atualizarIndicadorSync === 'function') atualizarIndicadorSync();
        await new Promise(function (r) { setTimeout(r, YIELD_MS); });
      }

      if (sessionExpired) {
        if (typeof toast === 'function') toast('Sessão expirada. Faça login novamente.', 'error');
        try {
          if (typeof supabaseClient !== 'undefined' && supabaseClient.auth && supabaseClient.auth.signOut) {
            await supabaseClient.auth.signOut();
          }
        } catch (_) {}
        try {
          if (typeof bpClearSessionLocal === 'function') bpClearSessionLocal();
        } catch (_) {}
        try {
          if (typeof bpShowLoginShell === 'function') bpShowLoginShell();
          else {
            var lv = document.getElementById('login-view');
            var av = document.getElementById('app-view');
            if (lv) lv.style.display = 'flex';
            if (av) av.style.display = 'none';
          }
        } catch (_) {}
      }

      if (itensFalhos.length > 0 && typeof toast === 'function') {
        toast('Algumas operações falharam repetidamente (' + itensFalhos.length + '). Veja «operações falhadas».', 'warning');
      }
      if (processed > 0) {
        try { console.info('[sync] flush processou', processed, 'ops; restam', getSyncQueue().length, 'dlq', getDlq().length); } catch (_) {}
      }
      if (typeof atualizarIndicadorSync === 'function') atualizarIndicadorSync();
      // Após sync de metadados, processar uploads de foto se existir
      if (typeof bpFlushFotoUploadQueue === 'function' && navigator.onLine) {
        try { await bpFlushFotoUploadQueue(); } catch (_) {}
      }
    } finally {
      flushSyncQueue._promise = null;
      try { window.__bpSyncFlushing = false; } catch (_) {}
      try { if (typeof atualizarIndicadorSync === 'function') atualizarIndicadorSync(); } catch (_) {}
    }
  })();
  flushSyncQueue._lastPromise = flushSyncQueue._promise;
  return flushSyncQueue._promise;
}


// ====================================================================
//  OVERRIDE PARA SUPABASE (mantido)
// ====================================================================
var _dbPutOriginal    = global.dbPut || (typeof dbPut === 'function' ? dbPut : null);
var _dbDeleteOriginal = global.dbDelete || (typeof dbDelete === 'function' ? dbDelete : null);
if (!_dbPutOriginal || !_dbDeleteOriginal) {
  try { console.error('[sync-queue] dbPut/dbDelete ainda não definidos — carregue db-indexeddb antes'); } catch (_) {}
}

dbPut = async function(store, item) {
  // Escrever localmente primeiro (offline-first)
  await _dbPutOriginal(store, item);

  const tabela = STORE_TO_TABLE[store];
  // ET4-P0-04: sem salaoId não há sync remoto (isolamento multi-tenant)
  if (!tabela || !state.config || !state.config.salaoId) {
    if (tabela && (!state.config || !state.config.salaoId)) {
      try { console.warn('[sync-queue] dbPut sem salaoId — apenas local:', store, item && item.id); } catch (_) {}
    }
    return item;
  }

  if (navigator.onLine) {
    try {
      await supabaseUpsert(tabela, slimPayload(item));
      const rest = getSyncQueue().filter(function (op) {
        return !(op.tabela === tabela && op.payload && op.payload.id === item.id);
      });
      if (rest.length !== getSyncQueue().length) saveSyncQueue(rest);
    } catch (err) {
      if (err.message === 'LIMITE_PLANO_ATINGIDO') {
        await _dbDeleteOriginal(store, item.id);
        throw err;
      }
      addToSyncQueue(tabela, 'upsert', item);
    }
  } else {
    addToSyncQueue(tabela, 'upsert', item);
  }
  if (typeof atualizarIndicadorSync === 'function') atualizarIndicadorSync();
  return item;
};

dbDelete = async function(store, id) {
  /* FASE 1: soft-delete local + remoto. Nunca HTTP DELETE / nunca apagar IDB de forma irreversível sem flags. */
  var tabela = (typeof STORE_TO_TABLE !== 'undefined' && STORE_TO_TABLE[store]) ? STORE_TO_TABLE[store] : store;
  if (!tabela) return;
  var listKey = store; // state usa o nome do store
  var list = (typeof state !== 'undefined' && state && state[listKey]) ? state[listKey] : [];
  if ((!list || !list.length) && state && state[tabela]) list = state[tabela];
  var item = null;
  for (var i = 0; i < list.length; i++) {
    if (list[i] && list[i].id === id) { item = list[i]; break; }
  }
  var now = new Date().toISOString();
  var soft = Object.assign({}, item || {}, {
    id: id,
    ativo: false,
    deleted_at: now,
    updated_at: now
  });
  if (tabela === 'agendamentos' && (!soft.status || soft.status === 'agendado')) soft.status = 'cancelado';
  if (tabela === 'movimentos' && (!soft.status || soft.status === 'activo')) soft.status = 'cancelado';
  if (tabela === 'profissionais' && !soft.data_desativacao) soft.data_desativacao = now;

  try {
    if (typeof addDeletedItem === 'function') addDeletedItem(id, tabela);
  } catch (_) {}

  // Manter no IDB com flags soft (não _dbDeleteOriginal)
  try {
    await _dbPutOriginal(store, soft);
  } catch (ePut) {
    try { console.warn('[sync-queue] soft dbPut falhou, fallback dbDelete local', ePut); } catch (_) {}
    try { await _dbDeleteOriginal(store, id); } catch (_) {}
  }

  if (!(state.config && state.config.salaoId)) {
    try { console.warn('[sync-queue] dbDelete soft sem salaoId — apenas local:', store, id); } catch (_) {}
    return;
  }

  if (navigator.onLine) {
    try {
      if (typeof supabaseSoftDelete === 'function') await supabaseSoftDelete(tabela, id, soft);
      else if (typeof supabaseDelete === 'function') await supabaseDelete(tabela, id);
      else if (typeof supabaseUpsert === 'function') await supabaseUpsert(tabela, slimPayload(soft));
    } catch (err) {
      addToSyncQueue(tabela, 'upsert', soft);
    }
  } else {
    addToSyncQueue(tabela, 'upsert', soft);
  }
}

/** Contingência: reabrir ops failed e limpar backoff (nextRetry). */
async function bpRetryFailedSync() {
  const q = getSyncQueue();
  let changed = false;
  for (const op of q) {
    if (!op) continue;
    if (op.failed || op.nextRetry || (op.attempts && op.attempts > 0)) {
      op.failed = false;
      op.attempts = 0;
      op.nextRetry = 0;
      op.tsLastFail = 0;
      changed = true;
    }
  }
  if (changed) saveSyncQueue(q);
  if (typeof flushSyncQueue === 'function') await flushSyncQueue();
  if (typeof atualizarIndicadorSync === 'function') atualizarIndicadorSync();
}

/** Reprocessar DLQ → fila principal (após utilizador corrigir causa). */
async function bpReprocessDlq() {
  var dlq = getDlq();
  if (!dlq.length) {
    if (typeof toast === 'function') toast('Não há operações falhadas.', 'info');
    return;
  }
  var q = getSyncQueue();
  dlq.forEach(function (item) {
    q.push({
      id: item.id || (typeof uuid === 'function' ? uuid() : String(Date.now())),
      tabela: item.tabela,
      operacao: item.operacao,
      payload: slimPayload(item.payload),
      ts: Date.now(),
      attempts: 0,
      failed: false,
      nextRetry: 0,
      lastError: null
    });
  });
  saveSyncQueue(q);
  saveDlq([]);
  if (typeof toast === 'function') toast('A reprocessar ' + dlq.length + ' operação(ões) falhada(s)…', 'info');
  if (typeof flushSyncQueue === 'function') await flushSyncQueue();
  if (typeof atualizarIndicadorSync === 'function') atualizarIndicadorSync();
}
if (typeof window !== 'undefined') window.bpReprocessDlq = bpReprocessDlq;

if (typeof window !== 'undefined') {
  window.bpRetryFailedSync = bpRetryFailedSync;
  // Toque no indicador: reabre tudo e faz flush
  (function bindSyncRetryClick() {
    function bind() {
      var el = document.getElementById('sync-status-container');
      if (!el || el.dataset.bpSyncRetryBound) return;
      el.dataset.bpSyncRetryBound = '1';
      el.style.cursor = 'pointer';
      el.setAttribute('role', 'button');
      el.title = 'Toque para sincronizar agora';
      el.addEventListener('contextmenu', function (ev) {
        ev.preventDefault();
        if (typeof bpOpenDlqModal === 'function') bpOpenDlqModal();
      });
      el.addEventListener('click', function () {
        if (!navigator.onLine) {
          if (typeof toast === 'function') toast('Sem ligação à internet neste momento. As alterações serão enviadas quando voltares a ter rede.', 'warning');
          return;
        }
        if (typeof toast === 'function') toast('A sincronizar alterações…', 'info');
        Promise.resolve()
          .then(function () { return bpRetryFailedSync(); })
          .then(function () {
            var rest = (typeof getSyncQueue === 'function') ? getSyncQueue().length : 0;
            var dlq = (typeof bpGetDlqCount === 'function') ? bpGetDlqCount() : 0;
            if (typeof toast === 'function') {
              if (rest === 0 && dlq === 0) toast('Tudo sincronizado.', 'success');
              else if (rest === 0 && dlq > 0) toast(dlq + ' operação(ões) falhada(s). Toque longo no indicador ou use «Reprocessar falhadas».', 'warning');
              else toast('Ainda restam ' + rest + ' operação(ões). Toque de novo ou verifique a ligação.', 'warning');
            }
          })
          .catch(function (e) {
            if (typeof logErroSilencioso === 'function') logErroSilencioso('syncRetryClick', e);
          });
      });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
    else bind();
    setTimeout(bind, 800);
  })();

  // Rede recuperada → limpar backoff e flush imediato
  window.addEventListener('online', function () {
    try { sessionStorage.removeItem('bp_offline_info_ack'); } catch (_) {}
    setTimeout(function () {
      if (typeof bpRetryFailedSync === 'function') bpRetryFailedSync();
    }, 600);
  });

  // App volta ao primeiro plano com rede → flush
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    if (!navigator.onLine) return;
    setTimeout(function () {
      if (typeof getSyncQueue === 'function' && getSyncQueue().length && typeof flushSyncQueue === 'function') {
        flushSyncQueue();
      }
    }, 400);
  });

  // Enquanto houver pendentes e rede, tentar de 25 em 25s (não só no evento online)
  setInterval(function () {
    if (!navigator.onLine) return;
    if (typeof getSyncQueue !== 'function') return;
    var q = getSyncQueue();
    if (!q || !q.length) return;
    if (typeof flushSyncQueue === 'function') flushSyncQueue();
  }, 25000);
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

/* D-5.4: API pública fila + rebind pós monkey-patch */
if (typeof window !== 'undefined') {
  window.dbPut = dbPut;
  window.dbDelete = dbDelete;
  window.slimPayload = slimPayload;
  window.getDlq = getDlq;
  window.saveDlq = saveDlq;
  window.moveOpToDlq = moveOpToDlq;
  window.bpGetDlqCount = bpGetDlqCount;
  window.getDeletedItems = getDeletedItems;
  window.saveDeletedItems = saveDeletedItems;
  window.addDeletedItem = addDeletedItem;
  window.touchDeletedItem = touchDeletedItem;
  window.isDeletedItem = isDeletedItem;
  window.pruneDeletedItems = pruneDeletedItems;
  window.removeDeletedItem = removeDeletedItem;
  window.getSyncQueue = getSyncQueue;
  window.saveSyncQueue = saveSyncQueue;
  window.actualizarBannerOffline = actualizarBannerOffline;
  window.bpMaybeShowOfflineInfoModal = bpMaybeShowOfflineInfoModal;
  window.bpAckOfflineInfoModal = bpAckOfflineInfoModal;
  window.atualizarIndicadorSync = atualizarIndicadorSync;
  window.setSyncUi = setSyncUi;
  window.addToSyncQueue = addToSyncQueue;
  window.bpIsSoftIntent = bpIsSoftIntent;
  window.bpBuildSoftPayload = bpBuildSoftPayload;
  window.bpNormalizeQueueOps = bpNormalizeQueueOps;
  window.flushSyncQueue = flushSyncQueue;
  window.bpRetryFailedSync = bpRetryFailedSync;
  window.bpReprocessDlq = bpReprocessDlq;
  window.bpOpenDlqModal = bpOpenDlqModal;
}



  // Re-export bindings that bundle / UI esperam no global
  global.dbPut = dbPut;
  global.dbDelete = dbDelete;
})(typeof window !== "undefined" ? window : this);
