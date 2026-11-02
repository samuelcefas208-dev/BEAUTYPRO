/* BelezaPro E17 — core/sync-scheduler.js
 * Triggers de flush: toque no indicador, online, visibility, intervalo 25s.
 * ORDEM: DEPOIS de sync-queue.js (usa flush/retry).
 */
(function bindSyncRetryClick() {
  function bind() {
    var el = document.getElementById('sync-status-container');
    if (!el || el.dataset.bpSyncRetryBound) return;
    el.dataset.bpSyncRetryBound = '1';
    el.style.cursor = 'pointer';
    el.setAttribute('role', 'button');
    el.title = 'Toque para sincronizar agora';
    el.addEventListener('contextmenu', function (ev) {
      ev.preventDefault();
      if (typeof bpOpenDlqModal === 'function') bpOpenDlqModal();
    });
    el.addEventListener('click', function () {
      if (!navigator.onLine) {
        if (typeof toast === 'function') toast('Sem ligação à internet neste momento. As alterações serão enviadas quando voltares a ter rede.', 'warning');
        return;
      }
      if (typeof toast === 'function') toast('A sincronizar alterações…', 'info');
      Promise.resolve()
        .then(function () { return bpRetryFailedSync(); })
        .then(function () {
          var rest = (typeof getSyncQueue === 'function') ? getSyncQueue().length : 0;
          var dlq = (typeof bpGetDlqCount === 'function') ? bpGetDlqCount() : 0;
          if (typeof toast === 'function') {
            if (rest === 0 && dlq === 0) toast('Tudo sincronizado.', 'success');
            else if (rest === 0 && dlq > 0) toast(dlq + ' operação(ões) falhada(s). Toque longo no indicador ou use «Reprocessar falhadas».', 'warning');
            else toast('Ainda restam ' + rest + ' operação(ões). Toque de novo ou verifique a ligação.', 'warning');
          }
        })
        .catch(function (e) {
          if (typeof logErroSilencioso === 'function') logErroSilencioso('syncRetryClick', e);
        });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
  setTimeout(bind, 800);
})();

window.addEventListener('online', function () {
  try { sessionStorage.removeItem('bp_offline_info_ack'); } catch (_) {}
  setTimeout(function () {
    if (typeof bpRetryFailedSync === 'function') bpRetryFailedSync();
  }, 600);
});

document.addEventListener('visibilitychange', function () {
  if (document.hidden) return;
  if (!navigator.onLine) return;
  setTimeout(function () {
    if (typeof getSyncQueue === 'function' && getSyncQueue().length && typeof flushSyncQueue === 'function') {
      flushSyncQueue();
    }
  }, 400);
});

setInterval(function () {
  if (!navigator.onLine) return;
  if (typeof getSyncQueue !== 'function') return;
  var q = getSyncQueue();
  if (!q || !q.length) return;
  if (typeof flushSyncQueue === 'function') flushSyncQueue();
}, 25000);
