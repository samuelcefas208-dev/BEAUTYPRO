/**
 * BelezaPro — JS-5.5 Charts Boundary + production bridge
 * Contrato: chart-module → __BP_getBuildAnaliseTemporal() → ESM | legado
 */
'use strict';

export const PILOT_ID = 'charts-boundary';
export const PILOT_VERSION = 'js5.5-0.2.0';

export function probeLegacyCharts() {
  const g = typeof window !== 'undefined' ? window : {};
  return {
    hasRenderizarGrafico:
      typeof g.renderizarGrafico === 'function' ||
      typeof renderizarGrafico === 'function',
    hasBuildAnaliseTemporal:
      typeof g.buildAnaliseTemporal === 'function' ||
      typeof buildAnaliseTemporal === 'function',
    hasUltimaAnalise: typeof g.__bpUltimaAnaliseTemporal !== 'undefined',
    hasChartChromeFlag: typeof g.__bpChartChromeBound !== 'undefined',
  };
}

/**
 * Instala resolução de motor Charts.
 * window.__BP_CHARTS_ENGINE = 'esm' | 'legacy'  (default: esm se slice presente)
 * Rollback: window.__BP_CHARTS_ENGINE = 'legacy'
 */
export function installChartsEngine(slice) {
  if (typeof window === 'undefined') return null;

  if (!window.__BP_CHARTS_LEGACY) {
    window.__BP_CHARTS_LEGACY = {
      buildAnaliseTemporal:
        typeof window.buildAnaliseTemporal === 'function'
          ? window.buildAnaliseTemporal
          : typeof buildAnaliseTemporal === 'function'
            ? buildAnaliseTemporal
            : null,
      buildSerieTemporal:
        typeof window.buildSerieTemporal === 'function'
          ? window.buildSerieTemporal
          : null,
      gerarInsightsTemporais:
        typeof window.gerarInsightsTemporais === 'function'
          ? window.gerarInsightsTemporais
          : null,
      detalheDiaVendas:
        typeof window.detalheDiaVendas === 'function'
          ? window.detalheDiaVendas
          : null,
      analiseParaExport:
        typeof window.analiseParaExport === 'function'
          ? window.analiseParaExport
          : null,
    };
  }

  const legacy = window.__BP_CHARTS_LEGACY;

  function resolveMode() {
    const forced = window.__BP_CHARTS_ENGINE;
    if (forced === 'legacy') return 'legacy';
    if (forced === 'esm') return slice ? 'esm' : 'legacy';
    return slice ? 'esm' : 'legacy';
  }

  window.__BP_getBuildAnaliseTemporal = function () {
    if (resolveMode() === 'esm' && slice && typeof slice.buildAnaliseTemporal === 'function') {
      return function (intervalo, movs, opts) {
        opts = opts || {};
        if (typeof opts.hoje !== 'function' && typeof window.hoje === 'function') {
          opts = Object.assign({}, opts, { hoje: window.hoje });
        }
        if (typeof opts.fmtKz !== 'function' && typeof window.fmtKz === 'function') {
          opts = Object.assign({}, opts, { fmtKz: window.fmtKz });
        }
        return slice.buildAnaliseTemporal(intervalo, movs, opts);
      };
    }
    return legacy.buildAnaliseTemporal;
  };

  window.__BP_getChartsEngine = function () {
    return resolveMode();
  };

  window.__BP_setChartsEngine = function (mode) {
    window.__BP_CHARTS_ENGINE = mode === 'legacy' ? 'legacy' : 'esm';
    return resolveMode();
  };



  window.__BP_getAnaliseParaExport = function () {
    if (resolveMode() === 'esm' && slice && typeof slice.analiseParaExport === 'function') {
      return slice.analiseParaExport;
    }
    return legacy.analiseParaExport ||
      (typeof window.analiseParaExport === 'function' ? window.analiseParaExport : null);
  };
  window.__BP_getDetalheDiaVendas = function () {
    if (resolveMode() === 'esm' && slice && typeof slice.detalheDiaVendas === 'function') {
      return function (dataIso, movs, opts) {
        var deps = {};
        if (typeof window.getProfissionalNome === 'function') {
          deps.getProfissionalNome = window.getProfissionalNome;
        }
        return slice.detalheDiaVendas(dataIso, movs, opts, deps);
      };
    }
    return legacy.detalheDiaVendas ||
      (typeof window.detalheDiaVendas === 'function' ? window.detalheDiaVendas : null);
  };
  return {
    mode: resolveMode(),
    hasSlice: !!slice,
    hasLegacy: !!legacy.buildAnaliseTemporal,
  };
}

export function mountPilot(opts) {
  const options = opts || {};
  const loadedAt = Date.now();
  const legacy = options.legacyProbe === false ? null : probeLegacyCharts();
  const slice = options.slice || null;
  const engine = installChartsEngine(slice);

  const handle = {
    id: PILOT_ID,
    version: PILOT_VERSION,
    loadedAt,
    legacy,
    engine,
    slice: slice
      ? {
          id: slice.SLICE_ID,
          version: slice.SLICE_VERSION,
          buildSerieTemporal: slice.buildSerieTemporal,
          buildAnaliseTemporal: slice.buildAnaliseTemporal,
          intervaloAnteriorEspelhado: slice.intervaloAnteriorEspelhado,
          gerarInsightsTemporais: slice.gerarInsightsTemporais,
          detalheDiaVendas: slice.detalheDiaVendas,
          analiseParaExport: slice.analiseParaExport,
        }
      : null,
    boundary:
      'JS-5.5: chart-module → __BP_getBuildAnaliseTemporal → ESM|legado; rollback __BP_setChartsEngine("legacy")',
  };
  window.__BP_PILOT_CHARTS = handle;
  return handle;
}

export default {
  PILOT_ID,
  PILOT_VERSION,
  probeLegacyCharts,
  installChartsEngine,
  mountPilot,
};
