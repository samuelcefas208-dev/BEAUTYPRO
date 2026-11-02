/**
 * F3.1 — contrato mínimo de ownership (caracterização).
 * Não substitui o runtime; documenta quem DEVE ser autoridade de cada hub.
 * Objectivo: reduzir multi-dono silencioso (ex.: renderClientes).
 */

/** Hubs críticos e autoridade única pretendida. */
export const OWNERSHIP_REGISTRY = Object.freeze({
  state: Object.freeze({
    authority: 'src/core/state/state.js + BeautyStore (store.js)',
    writersAllowed: Object.freeze(['loadState', 'BeautyStore.setState', 'CRUD após validação']),
    note: 'Evitar mutação ad-hoc em features/UI',
  }),
  dbPut: Object.freeze({
    authority: 'src/core/storage/db-indexeddb.js original; runtime efectivo = patch src/core/sync/sync-queue.js',
    writersAllowed: Object.freeze(['CRUD', 'sync patch']),
    note: 'Ordem de scripts: db-indexeddb antes de sync-queue',
  }),
  syncQueue: Object.freeze({
    authority: 'src/core/sync/sync-queue.js',
    writersAllowed: Object.freeze(['addToSyncQueue', 'saveSyncQueue', 'flush', 'bpReprocessDlq']),
    note: 'Outbox IDB sync_ops + LS dual-write (F2B.6)',
  }),
  renderClientes: Object.freeze({
    authority: 'src/modules/clientes/clientes-render.js',
    writersAllowed: Object.freeze(['modules/clientes', 'src/modules/clientes/clientes-render.js']),
    forbiddenReassign: true,
    enhanceHook: '__bpAfterRenderClientes',
    note: 'F3.2: media regista em __bpAfterRenderClientes; nao reassign window.renderClientes',
  }),
  renderProfissionais: Object.freeze({
    authority: 'src/modules/equipa/equipa-render.js',
    writersAllowed: Object.freeze(['modules/equipa', 'src/modules/equipa/equipa-render.js']),
    forbiddenReassign: true,
    enhanceHook: '__bpAfterRenderProfissionais',
    note: 'F3.2: media usa hook, nao reassign',
  }),
  renderCaixa: Object.freeze({
    authority: 'src/modules/caixa/caixa-render.js',
    writersAllowed: Object.freeze(['modules/caixa', 'src/modules/caixa/caixa-render.js']),
    forbiddenReassign: true,
  }),
  renderServicos: Object.freeze({
    authority: 'src/modules/servicos/servicos-render.js',
    writersAllowed: Object.freeze(['modules/servicos', 'src/modules/servicos/servicos-render.js']),
    forbiddenReassign: true,
  }),
  renderDashboard: Object.freeze({
    authority: 'src/modules/dashboard/dashboard-render.js',
    writersAllowed: Object.freeze(['modules/dashboard', 'src/modules/dashboard/dashboard-render.js', 'updateUI callers']),
  }),
  renderAgendaFull: Object.freeze({
    authority: 'src/modules/agenda/agenda-board.js',
    writersAllowed: Object.freeze(['modules/agenda', 'src/modules/agenda/agenda-board.js', 'updateUI callers']),
  }),
  salaoId: Object.freeze({
    authority: 'auth-supabase (profile) online; state.config.salaoId sessão',
    writersAllowed: Object.freeze(['checkSession', 'login', 'loadState']),
  }),
});

/**
 * @param {string} hub
 * @returns {boolean}
 */
export function isRegisteredHub(hub) {
  return Object.prototype.hasOwnProperty.call(OWNERSHIP_REGISTRY, hub);
}

/**
 * Pode um módulo reatribuir window[fnName]?
 * @param {string} fnName
 * @param {string} modulePath
 */
export function mayReassignWindowFn(fnName, modulePath) {
  if (fnName === 'renderClientes') {
    const owner = OWNERSHIP_REGISTRY.renderClientes;
    if (owner.forbiddenReassign) {
      return modulePath.indexOf('modules/clientes') >= 0 || modulePath.indexOf('clientes-render') >= 0;
    }
  }
  if (fnName === 'renderDashboard' || fnName === 'updateUI') {
    return modulePath.indexOf('modules/dashboard') >= 0 || modulePath.indexOf('dashboard-render') >= 0;
  }
  return true;
}

/**
 * Lista hubs com risco de multi-dono conhecido.
 * @returns {ReadonlyArray<string>}
 */
export function hubsWithMultiOwnerRisk() {
  return Object.freeze(['renderClientes', 'state']);
}
