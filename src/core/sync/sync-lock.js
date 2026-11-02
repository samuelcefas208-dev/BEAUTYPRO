/* BelezaPro E17 — core/sync-lock.js
 * Lock multi-tab no flush (navigator.locks + fallback LS).
 * ORDEM: antes de sync-queue.js
 */
/**
 * F2B.7 — lock multi-tab no flush (navigator.locks; fallback LS TTL).
 */
function withSyncFlushLock(fn) {
  var LOCK_KEY = 'bp_sync_flush_lock';
  var LOCK_TTL = 60000;
  if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
    return navigator.locks.request('bp-sync-flush', { mode: 'exclusive' }, function () {
      return Promise.resolve().then(fn);
    });
  }
  return (async function () {
    var now = Date.now();
    try {
      var raw = localStorage.getItem(LOCK_KEY);
      if (raw) {
        var prev = JSON.parse(raw);
        if (prev && prev.ts && (now - prev.ts) < LOCK_TTL) {
          if (!window.__bpTabId) {
            window.__bpTabId = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8);
          }
          if (prev.owner && prev.owner !== window.__bpTabId) {
            return;
          }
        }
      }
      if (!window.__bpTabId) {
        window.__bpTabId = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8);
      }
      localStorage.setItem(LOCK_KEY, JSON.stringify({ ts: now, owner: window.__bpTabId }));
    } catch (_) {}
    try {
      return await fn();
    } finally {
      try {
        var cur = JSON.parse(localStorage.getItem(LOCK_KEY) || 'null');
        if (cur && cur.owner === window.__bpTabId) localStorage.removeItem(LOCK_KEY);
      } catch (_) {}
    }
  })();
}


if (typeof window !== 'undefined') {
  window.withSyncFlushLock = withSyncFlushLock;
}
