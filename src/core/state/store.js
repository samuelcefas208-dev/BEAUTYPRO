/* BelezaPro D-4 — core/store.js
 * Extraído de app.bundle.js (FILE: core-store.js).
 *
 * ORDEM: deve carregar DEPOIS de core/state.js (usa `state`).
 * Depende de: state (core/state.js).
 * Expõe: BeautyStore, setState, batch, subscribe, setConfig, setList, …
 * Ver docs/D4_CORE_STATE_STORE.md
 */

// ====================================================================
//  CORE — STORE SIMPLES (Fase D — Evolução Arquitectural)
//  Padrão mínimo de gerenciamento de estado com subscribe/setState.
//  Mantém 100% de compatibilidade com o `state` global existente.
//  Não quebra nenhum código que leia/escreva em `state` directamente.
// ====================================================================

const _listeners = new Set();
let _batchDepth = 0;
let _pendingNotify = false;

/**
 * Notifica todos os subscribers (com batching simples).
 */
function _notify() {
  if (_batchDepth > 0) {
    _pendingNotify = true;
    return;
  }
  _pendingNotify = false;
  _listeners.forEach(fn => {
    try { fn(state); } catch (e) { console.warn('[Store] listener error:', e); }
  });
}

/**
 * Executa várias mutações e notifica só no final.
 */
function batch(fn) {
  _batchDepth++;
  try {
    fn();
  } finally {
    _batchDepth--;
    if (_batchDepth === 0 && _pendingNotify) _notify();
  }
}

/**
 * Substitui parcialmente o estado e notifica.
 * Uso: setState({ clientes: novosClientes }) ou setState(s => ({ ... }))
 */
function setState(partialOrFn) {
  const partial = typeof partialOrFn === 'function' ? partialOrFn(state) : partialOrFn;
  if (!partial || typeof partial !== 'object') return;
  Object.keys(partial).forEach(key => {
    state[key] = partial[key];
  });
  _notify();
}

/**
 * Atualiza uma chave aninhada de config de forma segura.
 */
function setConfig(partial) {
  state.config = { ...state.config, ...partial };
  _notify();
}

/**
 * Substitui uma lista inteira (clientes, agendamentos, etc.) e notifica.
 */
function setList(nomeLista, novaLista) {
  if (!Array.isArray(novaLista)) return;
  state[nomeLista] = novaLista;
  _notify();
}

/**
 * Adiciona item a uma lista e notifica.
 */
function pushToList(nomeLista, item) {
  if (!Array.isArray(state[nomeLista])) state[nomeLista] = [];
  state[nomeLista].push(item);
  _notify();
}

/**
 * Remove item de uma lista por id e notifica.
 */
function removeFromList(nomeLista, id) {
  if (!Array.isArray(state[nomeLista])) return;
  state[nomeLista] = state[nomeLista].filter(item => item.id !== id);
  _notify();
}

/**
 * Atualiza um item dentro de uma lista por id.
 */
function updateInList(nomeLista, id, data) {
  if (!Array.isArray(state[nomeLista])) return;
  const idx = state[nomeLista].findIndex(item => item.id === id);
  if (idx === -1) return;
  state[nomeLista][idx] = { ...state[nomeLista][idx], ...data };
  _notify();
}

function getState() {
  return state;
}

function subscribe(listener) {
  if (typeof listener !== 'function') return () => {};
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

// Expor globalmente para compatibilidade e uso futuro
window.BeautyStore = {
  getState,
  setState,
  setConfig,
  setList,
  pushToList,
  removeFromList,
  updateInList,
  subscribe,
  batch,
};

/* D-4: API pública em window */
if (typeof window !== 'undefined') {
  window.batch = batch;
  window.setState = setState;
  window.setConfig = setConfig;
  window.setList = setList;
  window.pushToList = pushToList;
  window.removeFromList = removeFromList;
  window.updateInList = updateInList;
  window.getState = getState;
  window.subscribe = subscribe;
  if (!window.BeautyStore) {
    window.BeautyStore = {
      getState, setState, setConfig, setList,
      pushToList, removeFromList, updateInList,
      subscribe, batch
    };
  }
}

