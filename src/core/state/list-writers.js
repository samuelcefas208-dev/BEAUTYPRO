/* BelezaPro E10/E11 — escritores de lista com fronteira
 * ORDEM: após core/store.js (usa BeautyStore + state).
 * Responsabilidade tirada de crud-operations:
 *   · dual write store vs state.*
 *   · um caminho de notificação UI
 * opts.silent = true → não notifica (ex.: cascade; caller notifica 1x no fim)
 */
(function (g) {
  'use strict';

  function _idEq(a, b) {
    if (a == null || b == null) return false;
    return a === b || String(a) === String(b);
  }

  /**
   * Um disparo de UI após mutação de listas.
   * usedStoreApi=true → subscribe (initStoreBindings) já notificou.
   */
  function bpNotifyLists(usedStoreApi) {
    if (usedStoreApi && g.BeautyStore && typeof g.BeautyStore.subscribe === 'function') return;
    if (typeof g.updateUI === 'function') g.updateUI();
  }

  /** push item → lista; notifica uma vez (salvo silent) */
  function bpListPush(nomeLista, item, opts) {
    if (!nomeLista || item == null) return false;
    var silent = !!(opts && opts.silent);
    var via = !!(g.BeautyStore && typeof g.BeautyStore.pushToList === 'function');
    if (via) {
      g.BeautyStore.pushToList(nomeLista, item);
    } else {
      if (typeof g.state === 'undefined') return false;
      if (!Array.isArray(g.state[nomeLista])) g.state[nomeLista] = [];
      g.state[nomeLista].push(item);
    }
    if (!silent) bpNotifyLists(via);
    return true;
  }

  /** merge parcial por id → lista; notifica uma vez (salvo silent) */
  function bpListUpdate(nomeLista, id, data, opts) {
    if (!nomeLista || id == null || !data || typeof data !== 'object') return false;
    var silent = !!(opts && opts.silent);
    var via = !!(g.BeautyStore && typeof g.BeautyStore.updateInList === 'function');
    if (via) {
      g.BeautyStore.updateInList(nomeLista, id, data);
    } else if (typeof g.state !== 'undefined' && Array.isArray(g.state[nomeLista])) {
      var i = g.state[nomeLista].findIndex(function (x) { return x && _idEq(x.id, id); });
      if (i === -1) return false;
      g.state[nomeLista][i] = Object.assign({}, g.state[nomeLista][i], data);
    } else {
      return false;
    }
    if (!silent) bpNotifyLists(via);
    return true;
  }

  /** remove por id → lista; notifica uma vez (salvo silent) */
  function bpListRemove(nomeLista, id, opts) {
    if (!nomeLista || id == null) return false;
    var silent = !!(opts && opts.silent);
    var via = !!(g.BeautyStore && typeof g.BeautyStore.removeFromList === 'function');
    if (via) {
      g.BeautyStore.removeFromList(nomeLista, id);
    } else if (typeof g.state !== 'undefined' && Array.isArray(g.state[nomeLista])) {
      g.state[nomeLista] = g.state[nomeLista].filter(function (x) { return !x || !_idEq(x.id, id); });
    } else {
      return false;
    }
    if (!silent) bpNotifyLists(via);
    return true;
  }

  /** Substitui lista inteira (loadState / merge) + notifica */
  function bpListReplace(nomeLista, arr, opts) {
    if (!nomeLista || !Array.isArray(arr)) return false;
    var silent = !!(opts && opts.silent);
    var via = !!(g.BeautyStore && typeof g.BeautyStore.setList === 'function');
    if (via) {
      g.BeautyStore.setList(nomeLista, arr);
    } else if (typeof g.state !== 'undefined') {
      g.state[nomeLista] = arr;
    } else {
      return false;
    }
    if (!silent) bpNotifyLists(via);
    return true;
  }

  g.bpNotifyLists = bpNotifyLists;
  g.bpListPush = bpListPush;
  g.bpListUpdate = bpListUpdate;
  g.bpListRemove = bpListRemove;
  g.bpListReplace = bpListReplace;
  g._bpNotifyLists = bpNotifyLists;
})(typeof window !== 'undefined' ? window : this);
