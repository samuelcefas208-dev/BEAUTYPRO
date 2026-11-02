/* BelezaPro — Camada canónica de métricas de período
 * Contrato 2026-09-08 (produto):
 * - Faturamento = SUM(valor_norm) vendas tipo=venda, status/estado
 *   NÃO em {cancelado,cancelada,anulado,anulada}, data in [inicio,fim]
 * - valor < 0 ou inválido → 0
 * - sem status → venda válida
 * - dívida/pendente de profissionais NÃO entram neste módulo (fora de âmbito)
 * - BPMetrics interpreta state.*; não duplica dados
 */
(function (global) {
  'use strict';

  var CANCEL = { cancelado: 1, cancelada: 1, anulado: 1, anulada: 1 };

  function _num(v) {
    if (typeof v === 'number' && isFinite(v)) return v < 0 ? 0 : v;
    if (v == null || v === '') return 0;
    var n = Number(v);
    if (!isFinite(n) || n < 0) return 0;
    return n;
  }

  /** Normaliza um campo de estado de movimento (status ou estado). */
  function _normSt(v) {
    return String(v == null ? '' : v).toLowerCase().trim();
  }

  /**
   * Cancelamento: status OU estado na família cancelado/anulado.
   * (Não usar só um campo — dados legados misturam os dois.)
   */
  function _isCancelSt(m) {
    if (!m) return false;
    return !!(CANCEL[_normSt(m.status)] || CANCEL[_normSt(m.estado)]);
  }

  function _stAg(a) {
    if (typeof global._statusAg === 'function') {
      try { return String(global._statusAg(a) || '').toLowerCase().trim(); } catch (_) {}
    }
    return _normSt((a && (a.status != null ? a.status : a.estado)) || 'agendado') || 'agendado';
  }

  function isVendaCancelada(m) {
    if (!m || m.tipo !== 'venda') return false;
    return _isCancelSt(m);
  }

  function isVendaValida(m) {
    if (!m || m.tipo !== 'venda') return false;
    return !_isCancelSt(m);
  }

  function inPeriodo(data, inicio, fim) {
    if (data == null || data === '') return false;
    var d = String(data).slice(0, 10);
    if (inicio && d < String(inicio).slice(0, 10)) return false;
    if (fim && d > String(fim).slice(0, 10)) return false;
    return true;
  }

  function somarValor(lista) {
    var s = 0;
    if (!lista || !lista.length) return 0;
    for (var i = 0; i < lista.length; i++) s += _num(lista[i] && lista[i].valor);
    return s;
  }

  function getState() {
    try {
      if (typeof global.state !== 'undefined' && global.state) return global.state;
    } catch (_) {}
    return null;
  }

  function filtrarVendasValidas(movs, inicio, fim) {
    var out = [], list = Array.isArray(movs) ? movs : [];
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (!isVendaValida(m)) continue;
      if ((inicio || fim) && !inPeriodo(m.data, inicio, fim)) continue;
      out.push(m);
    }
    return out;
  }

  function filtrarVendasCanceladas(movs, inicio, fim) {
    var out = [], list = Array.isArray(movs) ? movs : [];
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (!isVendaCancelada(m)) continue;
      if ((inicio || fim) && !inPeriodo(m.data, inicio, fim)) continue;
      out.push(m);
    }
    return out;
  }

  /** Série diária de faturamento oficial (para gráficos). */
  function serieFaturamentoDiario(inicio, fim) {
    var st = getState();
    var movs = st && Array.isArray(st.movimentos) ? st.movimentos : [];
    var ini = inicio ? String(inicio).slice(0, 10) : '';
    var fi = fim ? String(fim).slice(0, 10) : '';
    var by = {};
    for (var i = 0; i < movs.length; i++) {
      var m = movs[i];
      if (!isVendaValida(m)) continue;
      if (!inPeriodo(m.data, ini, fi)) continue;
      var d = String(m.data).slice(0, 10);
      by[d] = (by[d] || 0) + _num(m.valor);
    }
    var days = [];
    if (ini && fi) {
      var cur = new Date(ini + 'T12:00:00');
      var end = new Date(fi + 'T12:00:00');
      var guard = 0;
      while (cur <= end && guard < 400) {
        var y = cur.getFullYear();
        var mo = String(cur.getMonth() + 1).padStart(2, '0');
        var da = String(cur.getDate()).padStart(2, '0');
        var key = y + '-' + mo + '-' + da;
        days.push({ data: key, receita: by[key] || 0 });
        cur.setDate(cur.getDate() + 1);
        guard++;
      }
    } else {
      Object.keys(by).sort().forEach(function (k) {
        days.push({ data: k, receita: by[k] });
      });
    }
    return days;
  }

  function getMetricasPeriodo(inicio, fim, opts) {
    opts = opts || {};
    var st = getState();
    if (!st) {
      return {
        ok: false,
        erro: 'BPMetrics: state indisponível',
        inicio: inicio || '',
        fim: fim || '',
        faturamento: 0,
        faturamentoBruto: 0,
        faturamentoCancelado: 0,
        despesas: 0,
        liquido: 0,
        vendas: 0,
        vendasCanceladas: 0,
        ticketMedio: 0,
        servicosUnidades: 0,
        topServicos: [],
        clientesCadastrados: 0,
        clientesActivos: 0,
        clientesAtendidos: 0,
        agendamentos: 0,
        agendamentosAtivos: 0,
        agendamentosConcluidos: 0,
        agendamentosCancelados: 0,
        agendamentosPendentes: 0,
        agendamentosNaoRealizados: 0,
        taxaCancelamento: 0,
        taxaCancelamentoDetalhe: null
      };
    }

    var movs = Array.isArray(st.movimentos) ? st.movimentos : [];
    var ags = Array.isArray(st.agendamentos) ? st.agendamentos : [];
    var clientes = Array.isArray(st.clientes) ? st.clientes : [];
    var ini = inicio ? String(inicio).slice(0, 10) : '';
    var fi = fim ? String(fim).slice(0, 10) : '';

    var vendasValidas = filtrarVendasValidas(movs, ini, fi);
    var vendasCanceladas = filtrarVendasCanceladas(movs, ini, fi);
    var despesas = [];
    for (var i = 0; i < movs.length; i++) {
      var m = movs[i];
      if (!m || m.tipo !== 'despesa') continue;
      if (!inPeriodo(m.data, ini, fi)) continue;
      despesas.push(m);
    }

    var faturamento = somarValor(vendasValidas);
    var faturamentoCancelado = somarValor(vendasCanceladas);
    var faturamentoBruto = faturamento + faturamentoCancelado;
    var despesasTotal = somarValor(despesas);
    var vendas = vendasValidas.length;
    var ticketMedio = vendas > 0 ? faturamento / vendas : 0;

    var servicosUnidades = 0;
    var byServ = {};
    for (i = 0; i < vendasValidas.length; i++) {
      m = vendasValidas[i];
      var itens = m.itens;
      if (itens && Array.isArray(itens) && itens.length) {
        for (var j = 0; j < itens.length; j++) {
          var it = itens[j];
          if (!it) continue;
          var q = _num(it.quantidade);
          if (q < 1) q = 1;
          servicosUnidades += q;
          var nome = it.nome || it.servico || m.descricao || 'Serviço';
          byServ[nome] = (byServ[nome] || 0) + q;
        }
      } else {
        servicosUnidades += 1;
        var n2 = m.servicoNome || m.servico || m.descricao || 'Serviço';
        byServ[n2] = (byServ[n2] || 0) + 1;
      }
    }

    var idsCli = {};
    for (i = 0; i < vendasValidas.length; i++) {
      m = vendasValidas[i];
      if (m.cliente_id) idsCli['id:' + String(m.cliente_id)] = 1;
      else if (m.cliente) idsCli['n:' + String(m.cliente).toLowerCase().trim()] = 1;
    }
    var clientesAtendidos = 0;
    for (var k in idsCli) {
      if (Object.prototype.hasOwnProperty.call(idsCli, k)) clientesAtendidos++;
    }

    var clientesCadastrados = clientes.length;
    var clientesActivos = 0;
    for (i = 0; i < clientes.length; i++) {
      var c = clientes[i];
      if (!c) continue;
      if (c.ativo === false || c.ativo === 0 || c.ativo === 'false') continue;
      clientesActivos++;
    }

    var agPeriodo = [];
    for (i = 0; i < ags.length; i++) {
      if (ags[i] && inPeriodo(ags[i].data, ini, fi)) agPeriodo.push(ags[i]);
    }
    var agCriados = agPeriodo.length;
    var agConcluidos = 0, agCancelados = 0, agPendentes = 0, agNaoRealizados = 0;
    for (i = 0; i < agPeriodo.length; i++) {
      var sa = _stAg(agPeriodo[i]);
      if (sa === 'realizado') agConcluidos++;
      else if (sa === 'cancelado') agCancelados++;
      else if (sa === 'nao_realizado' || sa === 'nao-realizado' || sa === 'expirado') agNaoRealizados++;
      else agPendentes++;
    }
    var agAtivos = agCriados - agCancelados;
    var taxaCancelamento = agCriados > 0 ? (agCancelados / agCriados) * 100 : 0;

    var topServicos = Object.keys(byServ).map(function (nome) {
      return { nome: nome, n: byServ[nome] };
    }).sort(function (a, b) { return b.n - a.n; });

    var out = {
      ok: true,
      inicio: ini,
      fim: fi,
      faturamento: faturamento,
      faturamentoBruto: faturamentoBruto,
      faturamentoCancelado: faturamentoCancelado,
      despesas: despesasTotal,
      liquido: faturamento - despesasTotal,
      vendas: vendas,
      vendasCanceladas: vendasCanceladas.length,
      ticketMedio: ticketMedio,
      servicosUnidades: servicosUnidades,
      topServicos: topServicos,
      clientesCadastrados: clientesCadastrados,
      clientesActivos: clientesActivos,
      clientesAtendidos: clientesAtendidos,
      agendamentos: agCriados,
      agendamentosAtivos: agAtivos,
      agendamentosConcluidos: agConcluidos,
      agendamentosCancelados: agCancelados,
      agendamentosPendentes: agPendentes,
      agendamentosNaoRealizados: agNaoRealizados,
      taxaCancelamento: Math.round(taxaCancelamento * 10) / 10,
      taxaCancelamentoDetalhe: {
        cancelados: agCancelados,
        total: agCriados,
        formula: 'cancelados / total_agendamentos_periodo * 100',
        periodo: { inicio: ini, fim: fi }
      }
    };

    if (opts.includeRows) {
      out.vendasValidas = vendasValidas;
      out.vendasCanceladasRows = vendasCanceladas;
    }
    return out;
  }

  function getFaturamentoPeriodo(inicio, fim) {
    var M = getMetricasPeriodo(inicio, fim);
    return M.ok === false ? 0 : M.faturamento;
  }

  /**
   * Reconciliação read-only (prova dos 18.000 Kz, etc.)
   * Uso no dispositivo: BPMetrics.reconciliarPeriodo(inicio, fim)
   */
  function reconciliarPeriodo(inicio, fim) {
    var M = getMetricasPeriodo(inicio, fim, { includeRows: true });
    var rows = (M.vendasCanceladasRows || []).map(function (m) {
      return {
        id: m.id || null,
        data: m.data,
        valor: _num(m.valor),
        status: m.status != null ? m.status : m.estado,
        cliente: m.cliente || null,
        descricao: m.descricao || m.servico || null
      };
    });
    var somaCancel = 0;
    for (var i = 0; i < rows.length; i++) somaCancel += rows[i].valor;
    var report = {
      periodo: { inicio: M.inicio, fim: M.fim },
      faturamento: M.faturamento,
      faturamentoCancelado: M.faturamentoCancelado,
      faturamentoBruto: M.faturamentoBruto,
      deltaBrutoMenosValido: M.faturamentoBruto - M.faturamento,
      somaLinhasCanceladas: somaCancel,
      nVendasValidas: M.vendas,
      nVendasCanceladas: M.vendasCanceladas,
      linhasCanceladas: rows,
      provaCanceladasExplicamDelta: Math.abs(somaCancel - (M.faturamentoBruto - M.faturamento)) < 0.01
    };
    try {
      if (typeof console !== 'undefined' && console.info) {
        console.info('[BPMetrics.reconciliarPeriodo]', JSON.stringify(report, null, 2));
      }
    } catch (_) {}
    return report;
  }

  /** Últimos 30 dias civis: hoje-29 … hoje (contrato). */
  function intervaloUltimos30Dias() {
    var hojeStr = '';
    try {
      if (typeof global.hoje === 'function') hojeStr = String(global.hoje());
    } catch (_) {}
    if (!hojeStr || hojeStr.length < 10) {
      var d = new Date();
      hojeStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    var base = new Date(hojeStr.slice(0, 10) + 'T12:00:00');
    var ini = new Date(base.getTime());
    ini.setDate(ini.getDate() - 29);
    var y = ini.getFullYear();
    var mo = String(ini.getMonth() + 1).padStart(2, '0');
    var da = String(ini.getDate()).padStart(2, '0');
    return { inicio: y + '-' + mo + '-' + da, fim: hojeStr.slice(0, 10) };
  }

  function reconciliarUltimos30Dias() {
    var iv = intervaloUltimos30Dias();
    return reconciliarPeriodo(iv.inicio, iv.fim);
  }

  var API = {
    VERSION: '20260908-phase1',
    CONTRACT: '2026-09-08',
    getMetricasPeriodo: getMetricasPeriodo,
    getFaturamentoPeriodo: getFaturamentoPeriodo,
    isVendaValida: isVendaValida,
    isVendaCancelada: isVendaCancelada,
    filtrarVendasValidas: filtrarVendasValidas,
    filtrarVendasCanceladas: filtrarVendasCanceladas,
    somarValor: somarValor,
    inPeriodo: inPeriodo,
    serieFaturamentoDiario: serieFaturamentoDiario,
    reconciliarPeriodo: reconciliarPeriodo,
    reconciliarUltimos30Dias: reconciliarUltimos30Dias,
    intervaloUltimos30Dias: intervaloUltimos30Dias,
    DEFINICAO: {
      faturamento: 'SUM(valor_norm>=0) tipo=venda, status/estado não cancelado|cancelada|anulado|anulada',
      ultimos30Dias: 'hoje-29 … hoje (30 dias civis inclusivos)',
      foraDeAmbito: 'dívida/pendente de profissionais; comissões não alteradas neste módulo'
    }
  };

  var root = typeof globalThis !== 'undefined' ? globalThis : global;
  root.BPMetrics = API;
  root.getMetricasPeriodo = getMetricasPeriodo;
  root.getFaturamentoPeriodo = getFaturamentoPeriodo;
})(typeof globalThis !== 'undefined' ? globalThis : this);
