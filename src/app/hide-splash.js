/* BelezaPro F3.6-B — hideSplash fora da IA
 * Carregar CEDO (após core/utils, antes de auth e ia-module).
 * Sem dependência de Auth, Sync, IDB, state ou IA.
 */
(function (g) {
  'use strict';

  /** Splash BeautyPro — nunca mostrar (política actual do produto). */
  function hideSplash() {
    var splash = document.getElementById('splash-screen');
    if (!splash) return;
    splash.style.cssText = 'display:none!important;opacity:0;visibility:hidden;pointer-events:none;';
    splash.setAttribute('hidden', '');
    splash.setAttribute('aria-hidden', 'true');
    try { localStorage.setItem('bp_splash_seen', '1'); } catch (_) {}
  }

  function bpControlSplashOnBoot() {
    hideSplash();
  }

  g.hideSplash = hideSplash;
  if (g.hideSplash) g.hideSplash._bpOwner = 'app';
  g.bpControlSplashOnBoot = bpControlSplashOnBoot;
})(typeof window !== 'undefined' ? window : this);
