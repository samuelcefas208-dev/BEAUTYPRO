/**
 * BELEZAPRO — política de armazenamento local (puro).
 * Caracteriza o comportamento documentado em db-indexeddb.js + chaves sync-queue.
 * NÃO altera o runtime. F2-02.
 */

/** Object stores IndexedDB (STORES em db-indexeddb.js) */
export const IDB_STORES = Object.freeze([
  'config',
  'clientes',
  'agendamentos',
  'movimentos',
  'profissionais',
  'servicos',
  'fechos_caixa',
]);

export const IDB_NAME = 'BelezaProDB';
export const IDB_VERSION = 8;

/** Prefixo do espelho localStorage por store de domínio */
export const MIRROR_KEY_PREFIX = 'bp_';

/** TTL do cache em memória (ms) */
export const MEM_TTL_MS = 800;

/**
 * Quando a escrita completa do mirror falha por quota,
 * o código tenta gravar apenas os últimos N itens (se length > N).
 */
export const MIRROR_QUOTA_FALLBACK_MAX_ITEMS = 200;

/** Chaves LS de sincronização (sync-queue.js) — não são espelho de entidades */
export const SYNC_QUEUE_KEY = 'bp_sync_queue';
export const DLQ_KEY = 'bp_dlq';
export const DELETED_ITEMS_KEY = 'bp_deleted_items';

/** DLQ: saveDlq faz slice(-200) */
export const DLQ_PERSIST_MAX_ITEMS = 200;

/**
 * @param {string} store
 * @returns {string}
 */
export function mirrorKeyForStore(store) {
  return MIRROR_KEY_PREFIX + store;
}

/**
 * Fonte de verdade local para dados de domínio.
 * @returns {'indexeddb'}
 */
export function domainDataSourceOfTruth() {
  return 'indexeddb';
}

/**
 * Papel do espelho bp_${store}.
 * @returns {'recovery_mirror'}
 */
export function mirrorRole() {
  return 'recovery_mirror';
}

/**
 * Papel das chaves de fila/DLQ/deleted.
 * @returns {'sync_infrastructure'}
 */
export function syncLocalStorageRole() {
  return 'sync_infrastructure';
}

/**
 * Espelha a política de truncagem em _writeLSMirror (só após falha).
 * @param {unknown[]} items
 * @param {boolean} primaryWriteFailed
 * @returns {unknown[]|null} array a gravar, ou null se não deve gravar
 */
export function mirrorPayloadAfterQuotaFailure(items, primaryWriteFailed) {
  if (!primaryWriteFailed) {
    return Array.isArray(items) ? items : [];
  }
  const arr = Array.isArray(items) ? items : [];
  if (arr.length > MIRROR_QUOTA_FALLBACK_MAX_ITEMS) {
    return arr.slice(-MIRROR_QUOTA_FALLBACK_MAX_ITEMS);
  }
  return null;
}

/**
 * Leitura: ordem de preferência conceptual (dbGetAll).
 * @returns {readonly string[]}
 */
export function readPreferenceOrder() {
  return Object.freeze(['memory_cache', 'indexeddb', 'localstorage_mirror']);
}
