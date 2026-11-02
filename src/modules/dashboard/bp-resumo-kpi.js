/* bp-resumo-kpi.js — espelha contagens do período nos botões do Resumo */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function digits(v) {
    var d = String(v == null ? '' : v).replace(/[^\d]/g, '');
    return d === '' ? '0' : String(parseInt(d, 10));
  }

  function getState() {
    try {
      if (typeof state !== 'undefined' && state) return state;
    } catch (e) {}
    try {
      if (typeof window !== 'undefined' && window.state) return window.state;
    } catch (e2) {}
    return null;
  }

  function getIntervalo() {
    try {
      if (typeof getIntervaloDashAtual === 'function') {
        var iv = getIntervaloDashAtual();
        if (iv && iv.inicio != null && iv.fim != null) return iv;
      }
    } catch (e) {}
    return null;
  }

  function fromState() {
    var iv = getIntervalo();
    if (!iv) return null;
    if (typeof getMetricasPeriodo === 'function') {
      var M = getMetricasPeriodo(iv.inicio, iv.fim);
      return {
        clientes: M.clientesAtendidos,
        servicos: M.vendas,
        servicosUnidades: M.servicosUnidades,
        faturamento: M.faturamento
      };
    }
    return null;
  }

  function setView(id, value) {
    var el = $(id);
    if (!el) return;
    var v = String(value);
    if (el.textContent !== v) el.textContent = v;
  }

  function sync() {
    var computed = null;
    try { computed = fromState(); } catch (e) { computed = null; }

    var cliSrc = $('kpi-clientes-status');
    var servSrc = $('kpi-revenue-count');

    var cliDom = cliSrc ? digits(cliSrc.textContent) : null;
    var servDom = servSrc ? digits(servSrc.textContent) : null;

    /* Preferir DOM do bundle (já filtrado); se 0 e state tem valor, usar state */
    var cli = cliDom;
    var serv = servDom;

    /* Fase 2: métrica oficial manda; DOM só se BPMetrics ainda não calculou */
    if (computed) {
      cli = String(computed.clientes);
      serv = String(computed.servicos);
    }

    if (cli != null) setView('kpi-clientes-view', cli);
    if (serv != null) setView('kpi-servicos-view', serv);
  }

  function hookRender() {
    try {
      if (typeof renderDashboard === 'function' && !renderDashboard.__bpMirror) {
        var orig = renderDashboard;
        renderDashboard = function () {
          var r = orig.apply(this, arguments);
          try { sync(); } catch (e) {}
          setTimeout(sync, 0);
          setTimeout(sync, 50);
          setTimeout(sync, 200);
          return r;
        };
        renderDashboard.__bpMirror = true;
      }
    } catch (e) {}
  }

  function boot() {
    hookRender();
    sync();
  }

  boot();
  setInterval(boot, 250);
  document.addEventListener('click', function () {
    setTimeout(sync, 0);
    setTimeout(sync, 100);
    setTimeout(sync, 300);
  }, true);
})();
