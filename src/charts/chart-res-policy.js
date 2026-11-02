/* Política pura da resolução do gráfico (sem DOM).
   0% = mínimo (14 se período >7; 7 se semana/7 dias)
   100% = todos os dias do período (sem agregar) */
(function (root) {
  var VIEW_SLOTS = 12;
  var MIN_BARS_LONG = 14;
  var MIN_BARS_WEEK = 7;

  function periodDays(inicio, fim, diasEntreFn) {
    if (!inicio || !fim) return 0;
    if (typeof diasEntreFn === 'function') return diasEntreFn(inicio, fim);
    try {
      var a = new Date(inicio + 'T00:00:00').getTime();
      var b = new Date(fim + 'T00:00:00').getTime();
      return Math.max(1, Math.round((b - a) / 86400000) + 1);
    } catch (_) { return 0; }
  }

  function isExactDayType(tipo, modoHora) {
    if (modoHora) return true;
    return tipo === 'hora' || tipo === 'dia';
  }

  function isWeekType(tipo, dias) {
    if (tipo === '7dias' || tipo === 'semana') return true;
    return (parseInt(dias, 10) || 0) <= 7;
  }

  function resLimits(tipo, dias) {
    var max = Math.max(1, parseInt(dias, 10) || 1);
    var min;
    if (isWeekType(tipo, max)) min = MIN_BARS_WEEK;
    else min = MIN_BARS_LONG;
    if (min > max) min = max;
    return { min: min, max: max, applies: max > min };
  }

  function resApplies(tipo, dias, modoHora) {
    if (isExactDayType(tipo, modoHora)) return false;
    var lim = resLimits(tipo, dias);
    return lim.applies === true;
  }

  function clampRes(raw, tipo, dias, modoHora) {
    if (!resApplies(tipo, dias, modoHora)) return 0;
    var lim = resLimits(tipo, dias);
    var n = parseInt(raw, 10) || 0;
    if (!n) n = lim.min;
    if (n < lim.min) n = lim.min;
    if (n > lim.max) n = lim.max;
    return n;
  }

  /** 0% = mínimo; 100% = todos os dias */
  function resPercent(res, min, max) {
    min = Number(min) || 0;
    max = Number(max) || 0;
    res = Number(res) || 0;
    if (max <= min) return res >= max ? 100 : 0;
    var p = Math.round(((res - min) / (max - min)) * 100);
    if (p < 0) p = 0;
    if (p > 100) p = 100;
    return p;
  }

  function visibleSlots() { return VIEW_SLOTS; }

  function shouldScrollX(barCount) {
    return (parseInt(barCount, 10) || 0) > VIEW_SLOTS;
  }

  /* Rail bem à direita, depois da área de plot (espaço para linha + bolinha) */
  function railPadRight(applies) {
    return applies ? 28 : 12;
  }

  function allowPeriodSwipe(applies, scrollX) {
    if (applies) return false;
    if (scrollX) return false;
    return true;
  }

  var api = {
    VIEW_SLOTS: VIEW_SLOTS,
    MIN_BARS_LONG: MIN_BARS_LONG,
    MIN_BARS_WEEK: MIN_BARS_WEEK,
    periodDays: periodDays,
    isExactDayType: isExactDayType,
    isWeekType: isWeekType,
    resApplies: resApplies,
    resLimits: resLimits,
    clampRes: clampRes,
    resPercent: resPercent,
    visibleSlots: visibleSlots,
    shouldScrollX: shouldScrollX,
    railPadRight: railPadRight,
    allowPeriodSwipe: allowPeriodSwipe
  };

  root.bpChartResPolicy = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
