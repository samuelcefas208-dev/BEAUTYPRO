/* BelezaPro E17 — core/sync-recover.js
 * Integridade de payload na fila + recuperação de upsert (F2-B.1).
 * ORDEM: após sync-policy; antes de sync-queue.
 */
/**
 * F2-B.1 — Integridade de payload na fila.
 * DELETE com { id } é semanticamente completo (supabaseDelete só usa id).
 * UPSERT/outras com só id (ou flag) é degradado: não enviar como se fosse completo.
 */
function isDeleteOp(op) {
  return !!(op && op.operacao === 'delete');
}

function isPayloadDegraded(op) {
  if (!op) return true;
  if (op.payloadDegraded === true) return true;
  var p = op.payload;
  if (p == null) return true;
  if (typeof p !== 'object') return true;
  if (isDeleteOp(op)) {
    return p.id == null || p.id === '';
  }
  /* Upsert: só id (e eventualmente updated_at) → insuficiente para toSupabaseFormat */
  var keys = Object.keys(p).filter(function (k) {
    return p[k] !== undefined && p[k] !== null;
  });
  if (keys.length === 0) return true;
  if (keys.length === 1 && keys[0] === 'id') return true;
  if (keys.length === 2 && keys.indexOf('id') >= 0 && keys.indexOf('updated_at') >= 0) return true;
  return false;
}

/** Mapa tabela REST → store IDB (inverso de STORE_TO_TABLE). */
function tableToStoreName(tabela) {
  if (!tabela) return null;
  if (typeof STORE_TO_TABLE !== 'undefined' && STORE_TO_TABLE) {
    var keys = Object.keys(STORE_TO_TABLE);
    for (var i = 0; i < keys.length; i++) {
      if (STORE_TO_TABLE[keys[i]] === tabela) return keys[i];
    }
  }
  return tabela;
}

/**
 * Tenta recuperar payload de upsert a partir de state em memória ou IDB.
 * NÃO inventa dados: se a entidade não existir, devolve null.
 * [C] dbPut grava local antes do enqueue → entidade costuma existir no IDB.
 * Risco residual: versão no IDB pode ser mais recente que a op original (LWW local).
 */
async function tryRecoverUpsertPayload(op) {
  if (!op || !op.payload || op.payload.id == null) return null;
  var entityId = op.payload.id;
  var store = tableToStoreName(op.tabela);
  if (!store) return null;

  /* 1) state em memória (mesma origem que UI) */
  try {
    if (typeof state !== 'undefined' && state && Array.isArray(state[store])) {
      var fromState = state[store].find(function (it) { return it && it.id === entityId; });
      if (fromState && typeof fromState === 'object') {
        return slimPayload(Object.assign({}, fromState));
      }
    }
  } catch (_) {}

  /* 2) IDB via dbGetAll (não há dbGet por id exposto) */
  try {
    if (typeof dbGetAll === 'function') {
      var all = await dbGetAll(store);
      if (Array.isArray(all)) {
        var fromIdb = all.find(function (it) { return it && it.id === entityId; });
        if (fromIdb && typeof fromIdb === 'object') {
          return slimPayload(Object.assign({}, fromIdb));
        }
      }
    }
  } catch (_) {}

  return null;
}


if (typeof window !== 'undefined') {
  window.isDeleteOp = isDeleteOp;
  window.isPayloadDegraded = isPayloadDegraded;
  window.tableToStoreName = tableToStoreName;
  window.tryRecoverUpsertPayload = tryRecoverUpsertPayload;
}
