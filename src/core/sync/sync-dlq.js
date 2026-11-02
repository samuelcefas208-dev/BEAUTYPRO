/* BelezaPro E16 — core/sync-dlq.js
 * Dead Letter Queue (armazenamento). UI do modal em sync-ui.js.
 * ORDEM: antes de core/sync-queue.js · F2B.3 zero silent drop
 */
const DLQ_KEY = 'bp_dlq';

function getDlq() {
  try {
    var raw = JSON.parse(localStorage.getItem(DLQ_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch (e) { return []; }
}

function saveDlq(items) {
  /* F2B.3: zero silent drop — proibido slice(-200) */
  try {
    localStorage.setItem(DLQ_KEY, JSON.stringify(items || []));
  } catch (e) {
    if (typeof logErroSilencioso === 'function') logErroSilencioso('saveDlq', e);
    try {
      console.error('[sync] DLQ não persistida (quota). Sem descarte intencional. ops=', (items && items.length) || 0);
    } catch (_) {}
    if (typeof toast === 'function') {
      toast('Armazenamento cheio: fila de atenção não gravada. Liberte espaço — nada foi apagado de propósito.', 'error');
    }
  }
}

function moveOpToDlq(op, reason) {
  var dlq = getDlq();
  var sid = null;
  try {
    if (op && op.salaoId != null && String(op.salaoId).trim() !== '') sid = String(op.salaoId).trim();
  } catch (_) {}
  if (!sid) {
    try {
      if (typeof state !== 'undefined' && state && state.config && state.config.salaoId != null) {
        sid = String(state.config.salaoId).trim();
      }
    } catch (_) {}
  }
  var reasonStr = reason || (op && op.lastError) || 'requires_attention';
  dlq.push({
    id: op && op.id,
    tabela: op && op.tabela,
    operacao: op && op.operacao,
    payload: op && op.payload,
    salaoId: sid || null,
    ts: Date.now(),
    attempts: op && op.attempts,
    error: reasonStr,
    originalTs: op && op.ts,
    status: 'requires_attention',
    failureClass: (op && op.failureClass) || 'requires_attention',
    payloadDegraded: op && op.payloadDegraded,
    payloadDegradedReason: op && op.payloadDegradedReason
  });
  saveDlq(dlq);
}

function bpGetDlqCount() {
  return getDlq().length;
}

if (typeof window !== 'undefined') {
  window.getDlq = getDlq;
  window.saveDlq = saveDlq;
  window.moveOpToDlq = moveOpToDlq;
  window.bpGetDlqCount = bpGetDlqCount;
}
