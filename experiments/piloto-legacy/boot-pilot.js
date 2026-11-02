/**
 * BelezaPro — JS-5.5/5.6 entry do piloto (type=module)
 * .js (não .mjs) para servidores locais (Spck).
 * Após instalar o motor ESM, re-renderiza o gráfico se já existir no DOMr
 * (evita 1.ª pintura só com legado por corrida de arranque).
 */
(async function bpBootPilot() {
  'use strict';
  try {
    const [boundary, slice] = await Promise.all([
      import('./charts-boundary/index.js'),
      import('./charts-slice/analise-temporal.js'),
    ]);
    const handle = boundary.mountPilot({
      legacyProbe: true,
      slice: slice,
    });
    try {
      if (typeof console !== 'undefined' && console.info) {
        console.info(
          '[BP-PILOT] OK',
          handle.id,
          handle.version,
          'slice=',
          handle.slice && handle.slice.id,
          'engine=',
          typeof window.__BP_getChartsEngine === 'function'
            ? window.__BP_getChartsEngine()
            : '?',
          handle.legacy
        );
      }
    } catch (_) {}

    // JS-5.6: se o chart já pintou com legado, refrescar com motor ESM
    try {
      var redraw =
        typeof window.renderizarGrafico === 'function'
          ? window.renderizarGrafico
          : typeof renderizarGrafico === 'function'
            ? renderizarGrafico
            : null;
      if (redraw) {
        redraw();
        if (typeof console !== 'undefined' && console.info) {
          console.info('[BP-PILOT] chart refresh após motor ESM');
        }
      }
    } catch (eRedraw) {
      try {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[BP-PILOT] refresh chart ignorado', eRedraw && eRedraw.message);
        }
      } catch (_) {}
    }
  } catch (err) {
    try {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          '[BP-PILOT] falha (legado intacto)',
          err && err.message ? err.message : err
        );
      }
    } catch (_) {}
  }
})();
