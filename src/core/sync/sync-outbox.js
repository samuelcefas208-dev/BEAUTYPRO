/* BelezaPro E17 — core/sync-outbox.js
 * Outbox IDB: hidratar + espelhar (F2B.6 / F2B.7).
 * ORDEM: após sync-queue-store.js
 */
/**
 * F2B.6 — hidratar fila a partir da outbox IDB (fonte mais durável).
 * Preferir IDB se tiver ops; fundir com LS por op.id; regravar LS.
 */
async function hydrateQueueFromIdb() {
  try {
    if (typeof idbSyncOpsGetAll !== 'function') return getSyncQueueFromLs();
    var idbOps = await idbSyncOpsGetAll();
    if (!Array.isArray(idbOps) || !idbOps.length) return getSyncQueueFromLs();
    var lsOps = getSyncQueueFromLs();
    var byId = Object.create(null);
    lsOps.forEach(function (op) {
      if (op && op.id != null) byId[op.id] = op;
    });
    idbOps.forEach(function (op) {
      if (op && op.id != null) byId[op.id] = op;
    });
    var merged = Object.keys(byId).map(function (k) { return byId[k]; });
    try {
      if (typeof storageSetSecure === 'function') storageSetSecure(SYNC_QUEUE_KEY, JSON.stringify(merged));
      else localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(merged));
    } catch (_) {}
    return merged;
  } catch (e) {
    return getSyncQueueFromLs();
  }
}

/** Espelha a fila para IDB outbox. F2B.7: devolve Promise. */
function mirrorQueueToIdb(q) {
  try {
    if (typeof idbSyncOpsReplaceAll === 'function') {
      return Promise.resolve(idbSyncOpsReplaceAll(q || [])).catch(function () { return false; });
    }
  } catch (_) {}
  return Promise.resolve(false);
}


if (typeof window !== 'undefined') {
  window.hydrateQueueFromIdb = hydrateQueueFromIdb;
  window.mirrorQueueToIdb = mirrorQueueToIdb;
}
