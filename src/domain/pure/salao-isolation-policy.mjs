/**
 * BELEZAPRO — política de isolamento por salao_id (puro).
 * Caracteriza o comportamento documentado em:
 *   auth-supabase.js, crud-operations.js, sync-rest.js, sync-queue.js, db-indexeddb.js
 * NÃO altera o runtime. F2-04.
 * NÃO é prova de RLS live nem de isolamento no browser.
 */

/** Chave LS da fila de sincronização (sync-queue.js) */
export const SYNC_QUEUE_KEY = 'bp_sync_queue';

/** Tombstones de delete (sync-queue.js) */
export const DELETED_ITEMS_KEY = 'bp_deleted_items';

/** Dead-letter queue — F1: limpa na troca de salão (V-F0-001) */
export const DLQ_KEY = 'bp_dlq';

/** Cache de salão para boot offline */
export const SALAO_ID_CACHE_KEY = 'bp_salao_id_cache';

/**
 * Stores de domínio limpas em loadState(true) quando há troca de salão.
 * Observado em crud-operations.js — config IDB NÃO está nesta lista.
 */
export const IDB_STORES_CLEARED_ON_SALAO_SWITCH = Object.freeze([
  'clientes',
  'agendamentos',
  'movimentos',
  'profissionais',
  'servicos',
  'fechos_caixa',
]);

/**
 * Store config: usada para ler o salaoId anterior na detecção de troca;
 * não entra no Promise.all(dbClear) da troca.
 */
export const IDB_CONFIG_STORE = 'config';

/**
 * Chaves / padrões LS limpos na troca (bloco trocouDeSalao em loadState).
 * F1: inclui bp_dlq (V-F0-001).
 */
export const LS_KEYS_CLEARED_ON_SALAO_SWITCH = Object.freeze([
  SYNC_QUEUE_KEY,
  DELETED_ITEMS_KEY,
  DLQ_KEY,
  'bp_plano_cache',
]);

/**
 * Preferências UI / carrinho removidas na troca (lista fixa no código).
 */
export const LS_UI_PREFS_CLEARED_ON_SALAO_SWITCH = Object.freeze([
  'bp_filtro_clientes',
  'bp_chart_periodo',
  'bp_chart_offset',
  'bp_chart_mostrar_valores',
  'bp_hist_periodo',
  'bp_caixa_data_exata',
  'bp_carrinho',
  'bp_last_venda_id',
  'bp_cart_items',
]);

/**
 * Sync remoto permitido somente quando existe salaoId na sessão.
 * Espelha o gate do override dbPut/dbDelete em sync-queue.js.
 * @param {string|null|undefined} salaoId
 * @returns {boolean}
 */
export function isRemoteSyncAllowed(salaoId) {
  return salaoId != null && String(salaoId).trim() !== '';
}

/**
 * Valor canónico de salao_id no payload enviado ao Supabase.
 * toSupabaseFormat usa state.config.salaoId; não confia em item.salao_id.
 * @param {string} sessionSalaoId
 * @param {object} [item]
 * @returns {string}
 */
export function canonicalSalaoIdForPayload(sessionSalaoId, item) {
  void item;
  if (!isRemoteSyncAllowed(sessionSalaoId)) {
    throw new Error('Salão não identificado. Faça logout e login novamente.');
  }
  return String(sessionSalaoId);
}

/**
 * Constrói um payload mínimo de domínio com salao_id canónico da sessão.
 * Caracteriza a regra: o id do item local não dita o salao_id remoto.
 * @param {string} sessionSalaoId
 * @param {object} item
 * @returns {object}
 */
export function applyCanonicalSalaoId(sessionSalaoId, item) {
  const salao_id = canonicalSalaoIdForPayload(sessionSalaoId, item);
  const base = item && typeof item === 'object' ? { ...item } : {};
  return Object.assign({}, base, { salao_id });
}

/**
 * Detecção de troca (espelho de detetarTrocaDeSalao).
 * @param {string|null|undefined} anteriorSalaoId — valor em IDB config
 * @param {string|null|undefined} novoSalaoId
 * @returns {boolean}
 */
export function isSalaoSwitch(anteriorSalaoId, novoSalaoId) {
  return !!(
    anteriorSalaoId &&
    novoSalaoId &&
    String(anteriorSalaoId) !== String(novoSalaoId)
  );
}

/**
 * Conjunto de chaves LS que o código limpa explicitamente na troca
 * (além de padrões namespaced por anteriorSalaoId).
 * @returns {ReadonlyArray<string>}
 */
export function lsKeysClearedOnSwitch() {
  return LS_KEYS_CLEARED_ON_SALAO_SWITCH;
}

/**
 * Chaves que o código NÃO limpa na troca de salão (pós-F1: DLQ passa a ser limpa).
 * @returns {ReadonlyArray<string>}
 */
export function lsKeysNotClearedOnSwitch() {
  return Object.freeze([]);
}

/**
 * Stores IDB abrangidas pela limpeza na troca.
 * @returns {ReadonlyArray<string>}
 */
export function idbStoresClearedOnSwitch() {
  return IDB_STORES_CLEARED_ON_SALAO_SWITCH;
}

/**
 * A store config é limpa na troca?
 * @returns {boolean} false — observado
 */
export function isConfigStoreClearedOnSwitch() {
  return IDB_STORES_CLEARED_ON_SALAO_SWITCH.indexOf(IDB_CONFIG_STORE) >= 0;
}

/**
 * A DLQ é limpa na troca de salão?
 * @returns {boolean} true — F1 (V-F0-001): loadState(true) remove bp_dlq
 */
export function isDlqClearedOnSalaoSwitch() {
  return true;
}

/**
 * Prefixo de plano namespaced por salão.
 * @param {string} salaoId
 * @returns {string}
 */
export function planoCacheKeyForSalao(salaoId) {
  return 'bp_plano_cache_' + String(salaoId);
}
