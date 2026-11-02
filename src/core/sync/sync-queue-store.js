/* BelezaPro E17 — core/sync-queue-store.js
 * Persistência LS da fila (get/save) + limites soft/hard.
 * ORDEM: após sync-policy; antes de sync-queue.
 */
var MAX_SYNC_ATTEMPTS = 5;
var QUEUE_SOFT_WARN = 1000;
var QUEUE_HARD_BLOCK = 5000;
var LS_WARN_BYTES = Math.floor(4.5 * 1024 * 1024);

/* E15 — slimPayload / classify → core/sync-policy.js */
/* E16 — DLQ storage → core/sync-dlq.js */
/* E16 — tombstone → core/sync-tombstone.js */

function getSyncQueueFromLs() {
  try {
    let raw = localStorage.getItem(SYNC_QUEUE_KEY) || '[]';
    if (typeof storageGetSecure === 'function' && raw.startsWith('bp1:')) {
      raw = storageGetSecure(SYNC_QUEUE_KEY, '[]');
    }
    return JSON.parse(raw || '[]');
  } catch (e) { logErroSilencioso('getSyncQueue', e); return []; }
}

function getSyncQueue() {
  return getSyncQueueFromLs();
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
          /* Compressão de campos grandes ≠ degradação a só id */
        }
        return o;
      });
      str = JSON.stringify(q);
    }
    if (typeof storageSetSecure === 'function') storageSetSecure(SYNC_QUEUE_KEY, str);
    else localStorage.setItem(SYNC_QUEUE_KEY, str);
    try { sessionStorage.setItem(SYNC_QUEUE_KEY + '_len', String((q && q.length) || 0)); } catch (_) {}
    /* F2B.6 dual-write outbox IDB */
    mirrorQueueToIdb(q);
  } catch (e) {
    if (typeof logErroSilencioso === 'function') logErroSilencioso('saveSyncQueue', e);
    try {
      /* F2-B.1: fallback mínimo NÃO finge op completa — marca degradação e preserva salaoId (F1) */
      var minimal = (q || []).map(function (op) {
        var entityId = op && op.payload && op.payload.id != null ? op.payload.id : null;
        var isDel = op && op.operacao === 'delete';
        return {
          id: op && op.id,
          tabela: op && op.tabela,
          operacao: op && op.operacao,
          salaoId: op && op.salaoId != null ? op.salaoId : null,
          ts: op && op.ts,
          attempts: op && op.attempts,
          failed: op && op.failed,
          nextRetry: op && op.nextRetry,
          lastError: op && op.lastError,
          payload: entityId != null ? { id: entityId } : null,
          /* DELETE com só id continua válido; upsert fica explicitamente degradado */
          payloadDegraded: !isDel,
          payloadDegradedReason: isDel ? null : 'ls_quota_fallback'
        };
      });
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(minimal));
      mirrorQueueToIdb(minimal);
      try { console.warn('[sync] Fila guardada em modo degradado (quota). Upserts exigem recuperação antes do envio.'); } catch (_) {}
      if (typeof toast === 'function') {
        toast('Armazenamento quase cheio. Algumas operações ficaram em modo reduzido — sincronize quando houver espaço.', 'warning');
      }
    } catch (e2) {
      if (typeof logErroSilencioso === 'function') logErroSilencioso('saveSyncQueue.fallback', e2);
      if (typeof toast === 'function') {
        toast('Armazenamento do dispositivo quase cheio. Liberte espaço — a fila tem ' + ((q && q.length) || 0) + ' ops.', 'warning');
      }
    }
  }
}



if (typeof window !== 'undefined') {
  window.getSyncQueue = getSyncQueue;
  window.getSyncQueueFromLs = getSyncQueueFromLs;
  window.saveSyncQueue = saveSyncQueue;
  window.MAX_SYNC_ATTEMPTS = MAX_SYNC_ATTEMPTS;
  window.QUEUE_SOFT_WARN = QUEUE_SOFT_WARN;
  window.QUEUE_HARD_BLOCK = QUEUE_HARD_BLOCK;
  window.LS_WARN_BYTES = LS_WARN_BYTES;
}
