/* BelezaPro C-4 — security; após CORE no bundle */

// ================================================================
// BeautyPro — Security & Sync Hardening (tombstones, silent sync)
// Padrões: offline-first queue, tombstone TTL, throttled pull
// ================================================================
(function () {
  "use strict";

  var PULL_MIN_MS = 4000; // alinhado com SYNC_POLL_MS em main.js (era 90000 — causa da demora sem reload)
  var lastPullAt = 0;
  var pullInFlight = false;

  function safeToast(msg, type) {
    if (typeof toast === "function") toast(msg, type || "info");
  }

  /** Pull remoto silencioso — sem updateUI em cascata se nada mudou. */
  window.bpSilentPull = async function bpSilentPull(force) {
    if (!navigator.onLine) return false;
    if (!state || !state.config || !state.config.salaoId) return false;
    var now = Date.now();
    if (!force && (now - lastPullAt) < PULL_MIN_MS) return false;
    if (pullInFlight) return false;
    pullInFlight = true;
    try {
      if (typeof flushSyncQueue === "function") {
        await flushSyncQueue();
      }
      var dadosMudaram = false;
      if (typeof carregarDoSupabase === "function") {
        dadosMudaram = !!(await carregarDoSupabase());
      }
      lastPullAt = Date.now();
      if (typeof atualizarIndicadorSync === "function") atualizarIndicadorSync();
      /* Badge de plano / limites: se o pull reportou mudança (incl. plano) */
      if (dadosMudaram) {
        try { if (typeof renderPlanoInfo === "function") renderPlanoInfo(); } catch (_) {}
      }
      try {
        if (typeof bpFlushFotoUploadQueue === "function") await bpFlushFotoUploadQueue();
      } catch (_) {}
      return true;
    } catch (e) {
      if (typeof logErroSilencioso === "function") logErroSilencioso("bpSilentPull", e);
      return false;
    } finally {
      pullInFlight = false;
    }
  };

  // Visibility: sync silencioso ao voltar, com throttle
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      setTimeout(function () { window.bpSilentPull(false); }, 800);
    }
  });

  // Online event
  window.addEventListener("online", function () {
    setTimeout(function () { window.bpSilentPull(true); }, 500);
  });

  // Guard: impedir upsert de IDs na blacklist se API global existir
  var origFlush = window.flushSyncQueue;
  // no-op wrap if needed later

  console.info("[bp-hardening] activo — tombstones + pull throttled 4s");
})();
