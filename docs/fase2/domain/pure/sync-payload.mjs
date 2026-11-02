/**
 * BELEZAPRO — slimPayload (puro).
 * Espelha sync-queue.js — remove data URLs / blobs da fila.
 */

export const MAX_SYNC_ATTEMPTS = 5;
export const QUEUE_SOFT_WARN = 1000;
export const QUEUE_HARD_BLOCK = 5000;
export const DLQ_KEY = 'bp_dlq';
export const SYNC_QUEUE_KEY = 'bp_sync_queue';

/** Remove data URLs e campos binários — fila só metadados. */
export function slimPayload(payload) {
  if (payload == null || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) {
    return payload.map((x) => slimPayload(x));
  }
  const out = {};
  for (const k of Object.keys(payload)) {
    const v = payload[k];
    if (v == null) {
      out[k] = v;
      continue;
    }
    if (typeof v === 'string') {
      if (v.indexOf('data:') === 0) continue;
      if (v.length > 12000 && /^[A-Za-z0-9+/=\\s]+$/.test(v.slice(0, 80))) continue;
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
 * Deve ir para DLQ após N tentativas?
 * @param {number} attempts
 * @param {number} [max]
 */
export function shouldMoveToDlq(attempts, max = MAX_SYNC_ATTEMPTS) {
  return Number(attempts) >= max;
}

/**
 * @param {number} queueLength
 */
export function queuePressureLevel(queueLength) {
  if (queueLength >= QUEUE_HARD_BLOCK) return 'hard_block';
  if (queueLength >= QUEUE_SOFT_WARN) return 'soft_warn';
  return 'ok';
}
