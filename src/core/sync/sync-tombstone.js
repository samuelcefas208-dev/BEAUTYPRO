/* BelezaPro E16 — core/sync-tombstone.js
 * Lista negra de eliminados (evita reimportação no pull).
 * ORDEM: antes de core/sync-queue.js
 */
const DELETED_KEY = 'bp_deleted_items';

function getDeletedItems() {
  try {
    const raw = JSON.parse(localStorage.getItem(DELETED_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    if (typeof logErroSilencioso === 'function') logErroSilencioso('getDeletedItems', e);
    return [];
  }
}

function saveDeletedItems(items) {
  try { localStorage.setItem(DELETED_KEY, JSON.stringify(items)); }
  catch (e) {
    if (typeof logErroSilencioso === 'function') logErroSilencioso('saveDeletedItems', e);
  }
}

function addDeletedItem(id, tabela) {
  if (!id || !tabela) return;
  const items = pruneDeletedItems(getDeletedItems());
  const existing = items.find(i => i.id === id && i.tabela === tabela);
  if (existing) {
    existing.ts = Date.now();
  } else {
    items.push({ id, tabela, ts: Date.now() });
  }
  const MAX_TOMBSTONES = 2000;
  saveDeletedItems(items.slice(-MAX_TOMBSTONES));
}

function touchDeletedItem(id, tabela) {
  addDeletedItem(id, tabela);
}

function isDeletedItem(id, tabela) {
  if (!id) return false;
  return pruneDeletedItems(getDeletedItems()).some(i => i.id === id && (!tabela || i.tabela === tabela));
}

/** Tombstones expiram após 30 dias. */
function pruneDeletedItems(items) {
  const TTL = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  return (items || []).filter(i => i && i.id && (now - (i.ts || 0)) < TTL);
}

function removeDeletedItem(id, tabela) {
  const items = getDeletedItems().filter(i => !(i.id === id && i.tabela === tabela));
  saveDeletedItems(items);
}

if (typeof window !== 'undefined') {
  window.getDeletedItems = getDeletedItems;
  window.saveDeletedItems = saveDeletedItems;
  window.addDeletedItem = addDeletedItem;
  window.touchDeletedItem = touchDeletedItem;
  window.isDeletedItem = isDeletedItem;
  window.pruneDeletedItems = pruneDeletedItems;
  window.removeDeletedItem = removeDeletedItem;
}
