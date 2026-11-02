/* BelezaPro E15 — core/sync-policy.js
 * Política pura da fila (sem I/O de UI, sem flush).
 * ORDEM: antes de core/sync-queue.js
 * F2B.2 slim · F2B.3 classify — preservados byte-a-byte.
 */
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

/**
 * F2B.3 — Classificação de falha (conservadora).
 * transient → fica na fila com backoff (attempts = diagnóstico).
 * requires_attention → DLQ preservada; sem descarte silencioso.
 */
function classifySyncFailure(msg, err) {
  var m = (msg != null ? String(msg) : '').toLowerCase();
  var status = err && (err.status || err.statusCode);

  if (m.indexOf('payload_degraded') >= 0) return 'requires_attention';
  if (m.indexOf('duplicado') >= 0) return 'requires_attention';
  if (m.indexOf('tenant') >= 0) return 'requires_attention';
  if (m.indexOf('salao') >= 0 && m.indexOf('identific') >= 0) return 'requires_attention';

  if (m === 'session_expired') return 'transient';
  if (m === 'limite_plano_atingido') return 'transient';
  if (status === 429 || m.indexOf('rate') >= 0) return 'transient';
  if (status >= 500 && status <= 599) return 'transient';
  if (m.indexOf('network') >= 0 || m.indexOf('fetch') >= 0 || m.indexOf('timeout') >= 0) return 'transient';
  if (m.indexOf('failed to fetch') >= 0 || m.indexOf('networkerror') >= 0) return 'transient';
  if (m.indexOf('offline') >= 0) return 'transient';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'transient';
  if (status === 401 || status === 403) return 'transient';
  if (status === 409) return 'requires_attention';

  /* Desconhecido: não abandonar */
  return 'transient';
}

if (typeof window !== 'undefined') {
  window.slimPayload = slimPayload;
  window.classifySyncFailure = classifySyncFailure;
}
