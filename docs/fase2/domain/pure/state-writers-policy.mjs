/**
 * F4.1 — política de escritores de state (caracterização).
 * Não executa no browser; não altera runtime.
 */

/** Chaves de lista de negócio (SSOT via CRUD + sync-rest). */
export const BUSINESS_LIST_KEYS = Object.freeze([
  'clientes',
  'agendamentos',
  'movimentos',
  'profissionais',
  'servicos',
  'fechos_caixa',
]);

/** Chaves de filtro / período UI (escrita local permitida). */
export const UI_FILTER_KEYS = Object.freeze([
  'filtroClientes',
  'histPeriodo',
  'agendaDataAtual',
  'chartPeriodo',
  'chartOffset',
  'chartMostrarValores',
  'dashPeriodo',
  'dashOffset',
  'dashCustomInicio',
  'dashCustomFim',
]);

/** Módulos observados que podem substituir listas em massa [C grep]. */
export const BULK_LIST_WRITER_MODULES = Object.freeze([
  'core/crud-operations.js',
  'core/sync-rest.js',
]);

/** Módulos observados que escrevem filtros UI [C grep]. */
export const UI_FILTER_WRITER_MODULES = Object.freeze([
  'ui/ui-render-dashboard-agenda.js',
  'ui/eventos-caixa-vendas.js',
  'charts/chart-module.js',
  'boot/main.js',
  'core/crud-operations.js', // defaults no loadState
]);

/**
 * Uma feature nova pode substituir state.clientes (ou outra lista) em massa?
 * @param {string} modulePath
 * @param {string} key
 */
export function mayBulkReplaceList(modulePath, key) {
  if (!BUSINESS_LIST_KEYS.includes(key)) return false;
  return BULK_LIST_WRITER_MODULES.includes(modulePath);
}

/**
 * UI pode escrever chave de filtro/periodo?
 */
export function mayWriteUiFilter(modulePath, key) {
  if (!UI_FILTER_KEYS.includes(key)) return false;
  return UI_FILTER_WRITER_MODULES.includes(modulePath);
}

/**
 * Feature genérica (ex.: features/*) deve evitar bulk replace de listas.
 */
export function isFeatureModule(modulePath) {
  return typeof modulePath === 'string' && modulePath.indexOf('features/') === 0;
}

export function featureShouldAvoidBulkListWrite(modulePath, key) {
  if (!isFeatureModule(modulePath)) return false;
  return BUSINESS_LIST_KEYS.includes(key);
}

/**
 * Preferência para código novo: usar store API se precisa de notify.
 */
export function prefersStoreApiForNewCode() {
  return true;
}
