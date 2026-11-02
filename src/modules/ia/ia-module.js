/* BelezaPro B4 — ia-module extraído do monólito
 * Carregar APÓS app.bundle.js (state, toast, fmtKz, crud, auth).
 * Antes de benza-tools.js.
 */

// ====================================================================
//  ia-module.js — extraído do app.js (Fase C da modularização)
//  Conteúdo: Contexto e lógica da Benza AI: resumo, insights, perguntas/respostas, histórico, onboarding, splash e testes
//  Linhas originais: 2318-2796
//  Carregar depois de core-*.js, db-indexeddb.js, sync-*.js, auth-supabase.js
// ====================================================================
// ====================================================================

/** Limita texto sem cortar a meio da última palavra. */
function _bpIaTrimTexto(s, max) {
  s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  if (!max || s.length <= max) return s;
  var cut = s.slice(0, max);
  var sp = cut.lastIndexOf(' ');
  if (sp > max * 0.6) cut = cut.slice(0, sp);
  return cut.replace(/[\s,;:.-]+$/, '') + '…';
}

/** Histórico compacto para API — mais memória sem explodir tokens. */
function _bpIaHistoricoCompacto(hist, maxTurns, maxCharsEach) {
  maxTurns = maxTurns || 40;
  maxCharsEach = maxCharsEach || 1200;
  var list = Array.isArray(hist) ? hist.slice(-maxTurns) : [];
  return list.map(function (t) {
    return {
      pergunta: _bpIaTrimTexto(t && t.pergunta, 400),
      resposta: _bpIaTrimTexto(t && t.resposta, maxCharsEach),
      fonte: (t && t.fonte) || undefined
    };
  });
}

/** Contexto de salão — mais completo, ainda seguro contra payloads gigantes. */
function _bpIaContextoCompacto(ctxRaw) {
  if (ctxRaw == null) return '';
  if (typeof ctxRaw === 'object' && ctxRaw.erro) return ctxRaw;
  var s = typeof ctxRaw === 'string' ? ctxRaw : String(ctxRaw);
  /* Teto alinhado com MAX_CONTEXT_CHARS da edge (60000). Não omitir clientes. */
  if (s.length > 58000) {
    s = _bpIaTrimTexto(s, 58000);
  }
  return s;
}


/** -------------------------------------------------------------------------
 * BPMetrics → contexto Benza (fonte única alinhada a Resumo/Caixa)
 * -------------------------------------------------------------------------- */
function _bpIaIsoOffset(n) {
  if (typeof _bpIaDataOffset === 'function') {
    try { return _bpIaDataOffset(n); } catch (_) {}
  }
  try {
    var base = (typeof hoje === 'function') ? String(hoje()).slice(0, 10) : '';
    if (!base || base.length < 10) {
      var now = new Date();
      base = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    }
    var d = new Date(base + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  } catch (_) {
    return '';
  }
}

function _bpIaGetMetricas(inicio, fim) {
  try {
    var fn = null;
    if (typeof BPMetrics !== 'undefined' && BPMetrics && typeof BPMetrics.getMetricasPeriodo === 'function') {
      fn = BPMetrics.getMetricasPeriodo.bind(BPMetrics);
    } else if (typeof getMetricasPeriodo === 'function') {
      fn = getMetricasPeriodo;
    }
    if (!fn) return null;
    var M = fn(String(inicio || '').slice(0, 10), String(fim || '').slice(0, 10));
    if (!M || M.ok === false) return null;
    return M;
  } catch (_) {
    return null;
  }
}


/** Ponto 1 — régua única: venda válida = BPMetrics (fallback alinhado à mesma regra). */
function _bpIaIsVendaValida(m) {
  if (typeof BPMetrics !== 'undefined' && BPMetrics && typeof BPMetrics.isVendaValida === 'function') {
    return BPMetrics.isVendaValida(m);
  }
  if (!m || m.tipo !== 'venda') return false;
  var st = String((m.status || m.estado || '')).toLowerCase().trim();
  if (st === 'cancelado' || st === 'cancelada' || st === 'anulado' || st === 'anulada') return false;
  if (m.cancelado_em) return false;
  return true;
}

function _bpIaFiltrarVendasValidas(movs, inicio, fim) {
  if (typeof BPMetrics !== 'undefined' && BPMetrics && typeof BPMetrics.filtrarVendasValidas === 'function') {
    return BPMetrics.filtrarVendasValidas(movs, inicio || null, fim || null);
  }
  var out = [];
  var list = Array.isArray(movs) ? movs : [];
  var ini = inicio ? String(inicio).slice(0, 10) : '';
  var fi = fim ? String(fim).slice(0, 10) : '';
  for (var i = 0; i < list.length; i++) {
    var m = list[i];
    if (!_bpIaIsVendaValida(m)) continue;
    var d = m.data != null ? String(m.data).slice(0, 10) : '';
    if (ini && d < ini) continue;
    if (fi && d > fi) continue;
    out.push(m);
  }
  return out;
}

function _bpIaSomarVendasValidas(movs, inicio, fim) {
  if (typeof BPMetrics !== 'undefined' && BPMetrics && typeof BPMetrics.somarValor === 'function') {
    return BPMetrics.somarValor(_bpIaFiltrarVendasValidas(movs, inicio, fim));
  }
  var s = 0;
  var list = _bpIaFiltrarVendasValidas(movs, inicio, fim);
  for (var i = 0; i < list.length; i++) s += _bpIaNum(list[i] && list[i].valor);
  return s;
}

function _bpIaLinhaMetricas(titulo, M) {
  if (!M) return '';
  var r = function (v) { return Math.round(Number(v) || 0); };
  return (
    titulo + '\n' +
    '- Faturamento (vendas válidas): ' + r(M.faturamento) + ' Kz\n' +
    '- Vendas (movimentos válidos): ' + (M.vendas || 0) + '\n' +
    '- Serviços (unidades): ' + (M.servicosUnidades || 0) + '\n' +
    '- Ticket médio: ' + r(M.ticketMedio) + ' Kz\n' +
    '- Despesas: ' + r(M.despesas) + ' Kz\n' +
    '- Agendamentos (total no período): ' + (M.agendamentos || 0) + '\n' +
    '- Ag. concluídos/realizados: ' + (M.agendamentosConcluidos || 0) + '\n' +
    '- Ag. activos/pendentes: ' + (M.agendamentosAtivos || 0) + '\n' +
    '- Ag. cancelados: ' + (M.agendamentosCancelados || 0) + '\n' +
    '- Clientes atendidos (com venda): ' + (M.clientesAtendidos || 0) + '\n'
  );
}

function _bpIaBlocoMetricasOficiais(Mh, M7, M30, meta) {
  /* Ponto 2: meta opcional { h, d7, d30, sem, mes } com labelComDatas. */
  meta = meta || {};
  if (!Mh && !M7 && !M30 && !(meta && meta.Msem) && !(meta && meta.Mmes)) return '';
  var th = (meta.h && meta.h.labelComDatas) ? ('OFICIAL — HOJE (' + meta.h.labelComDatas + '):') : 'OFICIAL — HOJE:';
  var t7 = (meta.d7 && meta.d7.labelComDatas) ? ('OFICIAL — ÚLTIMOS 7 DIAS (' + meta.d7.inicio + ' – ' + meta.d7.fim + '):') : 'OFICIAL — ÚLTIMOS 7 DIAS:';
  var t30 = (meta.d30 && meta.d30.labelComDatas) ? ('OFICIAL — ÚLTIMOS 30 DIAS (' + meta.d30.inicio + ' – ' + meta.d30.fim + '):') : 'OFICIAL — ÚLTIMOS 30 DIAS:';
  var tSem = (meta.sem && meta.sem.labelComDatas) ? ('OFICIAL — ESTA SEMANA / semana civil (' + meta.sem.inicio + ' – ' + meta.sem.fim + '):') : '';
  var tMes = (meta.mes && meta.mes.labelComDatas) ? ('OFICIAL — ESTE MÊS / mês civil (' + meta.mes.inicio + ' – ' + meta.mes.fim + '):') : '';
  return (
    '======== MÉTRICAS OFICIAIS (BPMetrics — mesma fonte que Resumo/Caixa) ========\n' +
    'REGRAS OBRIGATÓRIAS PARA A RESPOSTA:\n' +
    '1) VENDAS ≠ AGENDAMENTOS. É PROIBIDO igualar os dois números.\n' +
    '2) Faturamento = só vendas válidas (canceladas fora).\n' +
    '3) "Últimos 7/30 dias" ≠ "esta semana" / "este mês" (semana e mês são de calendário).\n' +
    '4) Usa os blocos OFICIAL abaixo — não inventes totais. Cita o intervalo de datas se perguntares o período.\n' +
    '\n' +
    (Mh ? _bpIaLinhaMetricas(th, Mh) : '') +
    (M7 ? '\n' + _bpIaLinhaMetricas(t7, M7) : '') +
    (M30 ? '\n' + _bpIaLinhaMetricas(t30, M30) : '') +
    (meta.Msem && tSem ? '\n' + _bpIaLinhaMetricas(tSem, meta.Msem) : '') +
    (meta.Mmes && tMes ? '\n' + _bpIaLinhaMetricas(tMes, meta.Mmes) : '') +
    '======== FIM MÉTRICAS OFICIAIS ========\n\n'
  );
}

function buildContextoIA() {
  if (!state.movimentos || !Array.isArray(state.movimentos) || !state.agendamentos || !Array.isArray(state.agendamentos)) {
    return { erro: 'Dados ainda não carregados. Tente novamente em instantes.' };
  }

  var hojeStr = hoje();
  var num = function (v) { return Number(v) || 0; };
  var stAg = function (a) {
    if (typeof _bpIaSt === 'function') return _bpIaSt(a);
    return String((a && (a.status || a.estado)) || 'agendado').toLowerCase();
  };
  var isActivo = function (x) {
    if (!x) return false;
    return x.ativo !== false && x.ativo !== 0 && x.ativo !== 'false';
  };

  /* Ponto 2: intervalos canónicos = calcularIntervaloPeriodo (Resumo). */
  function _bpIaIv(tipo, offset) {
    if (typeof calcularIntervaloPeriodo === 'function') {
      try { return calcularIntervaloPeriodo(tipo, offset || 0); } catch (_) {}
    }
    return null;
  }
  var ivHoje = _bpIaIv('dia', 0) || { inicio: hojeStr, fim: hojeStr, label: 'Hoje', labelComDatas: 'Hoje' };
  var iv7 = _bpIaIv('7dias', 0);
  var iv30 = _bpIaIv('30dias', 0);
  var ivSem = _bpIaIv('semana', 0);
  var ivSemAnt = _bpIaIv('semana', 1);
  var ivMes = _bpIaIv('mes', 0);
  var d7str = (iv7 && iv7.inicio) ? iv7.inicio : (_bpIaIsoOffset(-6) || hojeStr);
  var d30str = (iv30 && iv30.inicio) ? iv30.inicio : (_bpIaIsoOffset(-29) || hojeStr);
  var fim7 = (iv7 && iv7.fim) ? iv7.fim : hojeStr;
  var fim30 = (iv30 && iv30.fim) ? iv30.fim : hojeStr;

  var Mh = _bpIaGetMetricas(ivHoje.inicio || hojeStr, ivHoje.fim || hojeStr);
  var M7 = _bpIaGetMetricas(d7str, fim7);
  var M30 = _bpIaGetMetricas(d30str, fim30);
  var Msem = (ivSem && ivSem.inicio) ? _bpIaGetMetricas(ivSem.inicio, ivSem.fim) : null;
  var Mmes = (ivMes && ivMes.inicio) ? _bpIaGetMetricas(ivMes.inicio, (ivMes.fim > hojeStr ? hojeStr : ivMes.fim)) : null;
  var _bpIaMetaPeriodos = { h: ivHoje, d7: iv7, d30: iv30, sem: ivSem, mes: ivMes, Msem: Msem, Mmes: Mmes };
  var hojeD = new Date(hojeStr + 'T12:00:00');

  var vendasHoje;
  var vendas30;
  /* Ponto 1: sempre régua oficial (BPMetrics ou fallback alinhado). */
  vendasHoje = _bpIaFiltrarVendasValidas(state.movimentos, hojeStr, hojeStr);
  vendas30 = _bpIaFiltrarVendasValidas(state.movimentos, d30str, fim30);
  var despHoje = state.movimentos.filter(function (m) { return m.data === hojeStr && m.tipo === 'despesa'; });
  var agHoje = state.agendamentos.filter(function (a) { return a.data === hojeStr; });

  var byProf = {};
  vendas30.forEach(function (v) {
    if (v.profissional_id) {
      var nome = (typeof getProfissionalNome === 'function') ? getProfissionalNome(v.profissional_id) : (v.profissional || '—');
      byProf[nome] = (byProf[nome] || 0) + num(v.valor);
    }
  });

  var byServ = {};
  vendas30.forEach(function (v) {
    if (v.itens) {
      v.itens.forEach(function (i) {
        if (!i || !i.nome) return;
        byServ[i.nome] = (byServ[i.nome] || 0) + (num(i.quantidade) || 1);
      });
    }
  });

  var totalVendas30 = M30 ? Math.round(M30.faturamento || 0) : vendas30.reduce(function (s, v) { return s + num(v.valor); }, 0);
  var nVendas30 = M30 ? (M30.vendas || 0) : vendas30.length;
  var ticketMedio = M30 ? Math.round(M30.ticketMedio || 0) : (vendas30.length > 0 ? Math.round(totalVendas30 / vendas30.length) : 0);
  var totalVendasHoje = Mh ? Math.round(Mh.faturamento || 0) : vendasHoje.reduce(function (s, v) { return s + num(v.valor); }, 0);
  var nVendasHoje = Mh ? (Mh.vendas || 0) : vendasHoje.length;
  var totalDespHoje = Mh ? Math.round(Mh.despesas || 0) : despHoje.reduce(function (s, d) { return s + num(d.valor); }, 0);
  var clientesUnicos = Mh ? (Mh.clientesAtendidos || 0) : new Set(vendasHoje.map(function (v) { return v.cliente; }).filter(Boolean)).size;
  var agRealizadosHoje = Mh ? (Mh.agendamentosConcluidos || 0) : agHoje.filter(function (a) { return stAg(a) === 'realizado'; }).length;
  var agTotalHoje = Mh ? (Mh.agendamentos || 0) : agHoje.length;

  /* Ponto 2: "esta semana" = semana civil (não confundir com últimos 7 dias). */
  var iniSemanaAtualStr = (ivSem && ivSem.inicio) ? ivSem.inicio : (typeof _bpIaDataOffset === 'function' ? _bpIaDataOffset(-6) : hojeStr);
  var fimSemanaAtualStr = (ivSem && ivSem.fim) ? ivSem.fim : hojeStr;
  var iniSemanaAnteriorStr = (ivSemAnt && ivSemAnt.inicio) ? ivSemAnt.inicio : (typeof _bpIaDataOffset === 'function' ? _bpIaDataOffset(-13) : hojeStr);
  var fimSemanaAnteriorStr = (ivSemAnt && ivSemAnt.fim) ? ivSemAnt.fim : (typeof _bpIaDataOffset === 'function' ? _bpIaDataOffset(-7) : hojeStr);
  var vendasSemanaAtual = _bpIaFiltrarVendasValidas(state.movimentos, iniSemanaAtualStr, fimSemanaAtualStr);
  var vendasSemanaAnterior = _bpIaFiltrarVendasValidas(state.movimentos, iniSemanaAnteriorStr, fimSemanaAnteriorStr);
  var MsemAnt = _bpIaGetMetricas(iniSemanaAnteriorStr, fimSemanaAnteriorStr);
  var totalSemanaAtual = Msem ? Math.round(Msem.faturamento || 0) : Math.round(_bpIaSomarVendasValidas(state.movimentos, iniSemanaAtualStr, fimSemanaAtualStr));
  var totalSemanaAnterior = MsemAnt ? Math.round(MsemAnt.faturamento || 0) : Math.round(_bpIaSomarVendasValidas(state.movimentos, iniSemanaAnteriorStr, fimSemanaAnteriorStr));

  var fim14Str = (typeof _bpIaDataOffset === 'function') ? _bpIaDataOffset(14) : hojeStr;
  var ini14Str = (typeof _bpIaDataOffset === 'function') ? _bpIaDataOffset(-14) : hojeStr;

  var agProximos = state.agendamentos.filter(function (a) {
    if (!(a.data >= hojeStr && a.data <= fim14Str)) return false;
    return stAg(a) !== 'cancelado';
  });
  var agHistorico = state.agendamentos.filter(function (a) {
    return a.data >= ini14Str && a.data < hojeStr;
  });

  var ag30 = state.agendamentos.filter(function (a) { return a.data >= d30str && a.data <= hojeStr; });
  var ag30Cancelados = ag30.filter(function (a) { return stAg(a) === 'cancelado'; }).length;
  var taxaCancelamento = ag30.length > 0 ? Math.round((ag30Cancelados / ag30.length) * 100) : 0;

  var servicosOrdenados = Object.keys(byServ).map(function (k) { return [k, byServ[k]]; }).sort(function (a, b) { return a[1] - b[1]; });
  var servicoMenosVendido = servicosOrdenados[0];

  /* ---- Breakdown diário (últimos 30 dias — evita contexto infinito) ---- */
  var porDia = {};
  (state.movimentos || []).forEach(function (m) {
    if (!m || !m.data || m.data < d30str || m.data > hojeStr) return;
    if (!porDia[m.data]) porDia[m.data] = { vendas: 0, despesas: 0, nVendas: 0, nDespesas: 0 };
    if (_bpIaIsVendaValida(m)) {
      porDia[m.data].vendas += num(m.valor);
      porDia[m.data].nVendas += 1;
    } else if (m.tipo === 'despesa') {
      porDia[m.data].despesas += num(m.valor);
      porDia[m.data].nDespesas += 1;
    }
  });
  var diasOrdenados = Object.keys(porDia).sort();
  var linhasDia = diasOrdenados.map(function (d) {
    var x = porDia[d];
    return '- ' + d + ': vendas ' + x.vendas + ' Kz (' + x.nVendas + ') · despesas ' + x.despesas + ' Kz (' + x.nDespesas + ')';
  });

  /* ---- Clientes activos (sem limite) + eliminados ---- */
  var clientesActivos = (state.clientes || []).filter(isActivo);
  var clientesEliminados = (state.clientes || []).filter(function (c) { return c && !isActivo(c); });

  /* Gasto por nome E por cliente_id (evita falso "sem venda" / falso "com venda") */
  var gastoPorNome = {};
  var gastoPorId = {};
  var ultimaPorNome = {};
  var ultimaPorId = {};
  (state.movimentos || []).forEach(function (v) {
    if (!_bpIaIsVendaValida(v)) return;
    var val = num(v.valor);
    if (v.cliente_id) {
      var idKey = String(v.cliente_id);
      gastoPorId[idKey] = (gastoPorId[idKey] || 0) + val;
      if (!ultimaPorId[idKey] || v.data > ultimaPorId[idKey]) ultimaPorId[idKey] = v.data;
    }
    var cn = String(v.cliente || '').trim();
    if (cn) {
      gastoPorNome[cn] = (gastoPorNome[cn] || 0) + val;
      if (!ultimaPorNome[cn] || v.data > ultimaPorNome[cn]) ultimaPorNome[cn] = v.data;
    }
  });
  var gastoDe = function (c) {
    var byId = c && c.id ? (gastoPorId[String(c.id)] || 0) : 0;
    var byNome = gastoPorNome[String((c && c.nome) || '').trim()] || 0;
    return byId > 0 ? byId : byNome;
  };
  var ultimaDe = function (c) {
    var byId = c && c.id ? ultimaPorId[String(c.id)] : null;
    var byNome = ultimaPorNome[String((c && c.nome) || '').trim()] || null;
    if (byId && byNome) return byId > byNome ? byId : byNome;
    return byId || byNome || null;
  };

  var linhasClientes = clientesActivos.map(function (c) {
    var nome = c.nome || '—';
    var tel = c.telefone || 'sem telefone';
    var gasto = gastoDe(c);
    var ultima = ultimaDe(c);
    var dias = ultima ? Math.floor((hojeD - new Date(ultima + 'T12:00:00')) / 86400000) : null;
    return '- ' + nome + ' | tel: ' + tel + ' | gasto: ' + gasto + ' Kz | última visita: ' +
      (dias !== null ? 'há ' + dias + ' dias (' + ultima + ')' : 'sem compras registadas');
  });

  /* Listas explícitas — o modelo não pode “assumir” que só existem clientes com venda */
  var clientesSemVenda = clientesActivos.filter(function (c) {
    var nome = (c.nome || '').trim();
    return nome && !(gastoDe(c) > 0);
  });
  var clientesComVenda = clientesActivos.filter(function (c) {
    var nome = (c.nome || '').trim();
    return nome && (gastoDe(c) > 0);
  });
  var linhasSemVenda = clientesSemVenda.map(function (c) {
    return '- ' + (c.nome || '—') + ' | tel: ' + (c.telefone || 'sem telefone') + ' | 0 Kz | sem nenhuma venda registada';
  });
  var linhasComVenda = clientesComVenda.map(function (c) {
    var nome = c.nome || '—';
    var gasto = gastoDe(c);
    var ultima = ultimaDe(c);
    var dias = ultima ? Math.floor((hojeD - new Date(ultima + 'T12:00:00')) / 86400000) : null;
    return '- ' + nome + ' | tel: ' + (c.telefone || 'sem telefone') + ' | gasto: ' + gasto + ' Kz | última visita: ' +
      (dias !== null ? 'há ' + dias + ' dias (' + ultima + ')' : 'desconhecido');
  });

  var linhasEliminados = clientesEliminados.map(function (c) {
    return '- ' + (c.nome || '—') + ' (eliminado)';
  });

  /* ---- Serviços activos (catálogo completo) ---- */
  var servicosActivos = (state.servicos || []).filter(isActivo);
  var linhasServicos = servicosActivos.map(function (s) {
    var preco = s.precoBase != null ? s.precoBase : (s.preco != null ? s.preco : '—');
    return '- ' + (s.nome || '—') + ' | preço base: ' + preco + ' Kz';
  });

  /* ---- Profissionais activos (total + 30d + fin) ---- */
  var profsActivos = (state.profissionais || []).filter(isActivo);
  var linhasProfs = profsActivos.map(function (p) {
    var pid = p && p.id;
    var tot = { receita: 0, comissao: 0, meta: 0, progresso: 0, metaAtingida: false, taxa: 0 };
    var d30 = { receita: 0, comissao: 0 };
    try {
      if (typeof _bpStatsProf === 'function' && pid != null) {
        tot = _bpStatsProf(pid, 'total');
        d30 = _bpStatsProf(pid, '30d');
      }
    } catch (eProf) {}
    var fin = (typeof bpProfFinGet === 'function' && pid != null) ? bpProfFinGet(pid) : null;
    var taxa = tot.taxa || (p.taxa_comissao != null ? p.taxa_comissao : p.taxa) || 0;
    var meta = tot.meta || Number(p.meta_mensal != null ? p.meta_mensal : p.meta) || 0;
    var linha = '- ' + (p.nome || '—');
    if (p.especialidade) linha += ' | especialidade: ' + p.especialidade;
    if (p.contacto) linha += ' | contacto: ' + p.contacto;
    if (p.idade != null) linha += ' | idade: ' + p.idade;
    if (p.data_contratual || p.contrato) linha += ' | contrato: ' + (p.data_contratual || p.contrato);
    linha += ' | taxa: ' + taxa + '%';
    if (meta > 0) linha += ' | meta: ' + meta + ' Kz';
    linha += ' | RECEITA TOTAL: ' + (tot.receita || 0) + ' Kz';
    linha += ' | COMISSÃO TOTAL (a pagar ref.): ' + (tot.comissao || 0) + ' Kz';
    if (meta > 0) linha += ' | progresso meta: ' + (tot.progresso || 0) + '%' + (tot.metaAtingida ? ' (META ATINGIDA)' : '');
    linha += ' | receita 30 dias: ' + (d30.receita || 0) + ' Kz | comissão 30 dias: ' + (d30.comissao || 0) + ' Kz';
    if (fin) {
      if (fin.bloqueado) linha += ' | OPERAÇÕES: BLOQUEADAS (aguarda ADM)';
      if (fin.estado) linha += ' | estado financeiro: ' + fin.estado;
      if (fin.saldo_pendente > 0) linha += ' | saldo pendente: ' + fin.saldo_pendente + ' Kz';
      if (fin.observacao) linha += ' | observação ADM: ' + String(fin.observacao).slice(0, 120);
    }
    return linha;
  });

  /* ---- Agenda detalhada ---- */
  var linhasAgProx = agProximos
    .slice()
    .sort(function (a, b) { return String(a.data + a.hora).localeCompare(String(b.data + b.hora)); })
    .map(function (a) {
      return '- ' + a.data + ' ' + String(a.hora || '').slice(0, 5) +
        ' | ' + (a.cliente || '—') + ' | ' + (a.servico || '—') +
        ' | ' + (a.profissional || '—') + ' | status: ' + stAg(a);
    });

  var linhasAgHist = agHistorico
    .slice()
    .sort(function (a, b) { return String(b.data + b.hora).localeCompare(String(a.data + a.hora)); })
    .slice(0, 80)
    .map(function (a) {
      return '- ' + a.data + ' ' + String(a.hora || '').slice(0, 5) +
        ' | ' + (a.cliente || '—') + ' | ' + (a.servico || '—') +
        ' | status: ' + stAg(a);
    });

  var planoAtual = (typeof getPlanoAtual === 'function') ? getPlanoAtual() : (state.config && state.config.plano) || 'trial';
  var diasTrial = planoAtual === 'trial' && typeof getDiasTrialRestantes === 'function' ? getDiasTrialRestantes() : null;
  var waPlataforma = (typeof WHATSAPP_NUMBER !== 'undefined' && WHATSAPP_NUMBER) ? WHATSAPP_NUMBER : '953980750';

  return (
    'SALÃO: ' + (state.config && state.config.storeName ? state.config.storeName : '—') + '\n' +
    'DATA DE HOJE: ' + hojeStr + '\n' +
    'PLANO ACTUAL: ' + planoAtual + (diasTrial !== null ? ' (restam ' + diasTrial + ' dias de teste)' : '') + '\n' +
    '\n' +
    'CONTACTO DE SUPORTE DA PLATAFORMA BELEZAPRO (WhatsApp):\n' +
    '- Número: ' + waPlataforma + '\n' +
    '- Este número é APENAS suporte técnico da plataforma BelezaPro.\n' +
    '- NÃO é o telefone do dono nem do administrador deste salão.\n' +
    '- Oferece este número SOMENTE se o utilizador reportar problema com a plataforma (login, plano, bug, cobrança).\n' +
    '- Se perguntarem "número do administrador do salão" e não houver telefone do salão nos dados, diz que não tens o contacto do salão e oferece o suporte da plataforma se for questão técnica.\n' +
    '\n' +
    _bpIaBlocoMetricasOficiais(Mh, M7, M30, typeof _bpIaMetaPeriodos !== 'undefined' ? _bpIaMetaPeriodos : null) +
    'HOJE:\n' +
    '- Faturamento: ' + totalVendasHoje + ' Kz\n' +
    '- Vendas: ' + nVendasHoje + '\n' +
    '- Despesas: ' + totalDespHoje + ' Kz\n' +
    '- Agendamentos: ' + agTotalHoje + ' (' + agRealizadosHoje + ' realizados — NÃO são vendas)\n' +
    '- Clientes atendidos (vendas): ' + clientesUnicos + '\n' +
    '\n' +
    'ÚLTIMOS 30 DIAS:\n' +
    '- Total faturado: ' + totalVendas30 + ' Kz\n' +
    '- Total vendas: ' + nVendas30 + '\n' +
    '- Ticket médio: ' + ticketMedio + ' Kz\n' +
    '- Taxa de cancelamento de agendamentos: ' + taxaCancelamento + '%\n' +
    '\n' +
    'ESTA SEMANA vs SEMANA ANTERIOR:\n' +
    '- Esta semana (semana civil' + (iniSemanaAtualStr && fimSemanaAtualStr ? ' ' + iniSemanaAtualStr + ' – ' + fimSemanaAtualStr : '') + '): ' + totalSemanaAtual + ' Kz\n' +
    '- Semana anterior: ' + totalSemanaAnterior + ' Kz\n' +
    '- Variação: ' + (totalSemanaAnterior > 0 ? Math.round(((totalSemanaAtual - totalSemanaAnterior) / totalSemanaAnterior) * 100) : 0) + '%\n' +
    '\n' +
    'FATURAMENTO POR DIA (últimos 30 dias):\n' +
    (linhasDia.length ? linhasDia.join('\n') : '- Sem movimentos registados') + '\n' +
    '\n' +
    'POR PROFISSIONAL (30 dias):\n' +
    (Object.keys(byProf).length ? Object.keys(byProf).map(function (k) { return '- ' + k + ': ' + byProf[k] + ' Kz'; }).join('\n') : '- Sem dados') + '\n' +
    '\n' +
    'SERVIÇOS MAIS VENDIDOS (30 dias):\n' +
    (Object.keys(byServ).length
      ? Object.keys(byServ).sort(function (a, b) { return byServ[b] - byServ[a]; }).slice(0, 10).map(function (k) { return '- ' + k + ': ' + byServ[k] + 'x'; }).join('\n')
      : '- Sem dados') + '\n' +
    'SERVIÇO MENOS VENDIDO (30 dias): ' + (servicoMenosVendido ? (servicoMenosVendido[0] + ' (' + servicoMenosVendido[1] + 'x)') : 'Sem dados') + '\n' +
    '\n' +
    'CATÁLOGO DE SERVIÇOS ACTIVOS:\n' +
    (linhasServicos.length ? linhasServicos.join('\n') : '- Nenhum serviço activo') + '\n' +
    '\n' +
    'CLIENTES ELIMINADOS (' + clientesEliminados.length + ') — se perguntarem por estes nomes, diz que já foram eliminados:\n' +
    (linhasEliminados.length ? linhasEliminados.join('\n') : '- Nenhum') + '\n' +
    '\n' +
    'PROFISSIONAIS ACTIVOS:\n' +
    (linhasProfs.length ? linhasProfs.join('\n') : '- Nenhum') + '\n' +
    '\n' +
    'AGENDA — PRÓXIMOS 14 DIAS (' + agProximos.length + '):\n' +
    (linhasAgProx.length ? linhasAgProx.join('\n') : '- Sem marcações') + '\n' +
    '\n' +
    'AGENDA — HISTÓRICO 14 DIAS ANTERIORES (amostra):\n' +
    (linhasAgHist.length ? linhasAgHist.join('\n') : '- Sem histórico recente') + '\n' +
    '\n' +
    '======== FICHA DE CLIENTES (FONTE DE VERDADE DA ABA CLIENTES) ========\n' +
    'IMPORTANTE: Esta lista vem da ficha cadastral (state.clientes). NÃO uses só nomes de vendas.\n' +
    'RESUMO CLIENTES:\n' +
    '- Total activos na ficha: ' + clientesActivos.length + '\n' +
    '- Com pelo menos 1 venda: ' + clientesComVenda.length + '\n' +
    '- SEM nenhuma venda registada: ' + clientesSemVenda.length + '\n' +
    '\n' +
    'CLIENTES SEM NENHUMA VENDA (' + clientesSemVenda.length + ') — ESTÃO cadastrados; é PROIBIDO dizer que não existem:\n' +
    (linhasSemVenda.length ? linhasSemVenda.join('\n') : '- Nenhum (todos os activos já têm venda)') + '\n' +
    '\n' +
    'TODOS OS CLIENTES ACTIVOS DA FICHA (' + clientesActivos.length + '):\n' +
    (linhasClientes.length ? linhasClientes.join('\n') : '- Nenhum') + '\n' +
    '======== FIM FICHA DE CLIENTES ========\n'
  );
}

// ====================================================================
//  IA – perguntarIA, nome, histórico
// ====================================================================
let iaHistorico = [];
function bpResetIaHistorico() {
  iaHistorico = [];
  try {
    if (typeof window !== 'undefined') window.iaHistorico = iaHistorico;
  } catch (_) {}
  try {
    var chat = document.getElementById('ia-chat');
    if (chat) chat.innerHTML = '';
    if (typeof atualizarEstadoVazioIA === 'function') atualizarEstadoVazioIA();
  } catch (_) {}
}
if (typeof window !== 'undefined') {
  window.bpResetIaHistorico = bpResetIaHistorico;
  window.iaHistorico = iaHistorico;
}


function _bpIaDataOffset(dias) {
  /* Data local YYYY-MM-DD relativa a hoje() — evita UTC de toISOString */
  var base = (typeof hoje === 'function') ? hoje() : null;
  var d = base ? new Date(base + 'T12:00:00') : new Date();
  if (isNaN(d.getTime())) d = new Date();
  d.setDate(d.getDate() + (Number(dias) || 0));
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function _bpIaSt(a) {
  if (typeof _statusAg === 'function') return _statusAg(a);
  return String((a && (a.status || a.estado)) || 'agendado').toLowerCase();
}
function _bpIaNum(v) { var n = Number(v); return isFinite(n) ? n : 0; }
function _bpIaItemValor(it) {
  if (!it) return 0;
  var sub = _bpIaNum(it.subtotal);
  if (sub) return sub;
  var q = _bpIaNum(it.quantidade); if (!q) q = 1;
  var pu = it.precoUnit != null ? it.precoUnit : (it.preco != null ? it.preco : 0);
  return q * _bpIaNum(pu);
}

/** Soma valor de movimentos com filtro opcional (evita loops duplicados). */
function _bpIaSomaMovs(movs, pred) {
  var s = 0;
  var list = movs || [];
  for (var i = 0; i < list.length; i++) {
    var m = list[i];
    if (pred && !pred(m)) continue;
    s += _bpIaNum(m.valor);
  }
  return s;
}

/** Fluxo de um dia: vendas, despesas, fluxo. Fallback 0 se sem dados. */
function _bpIaFluxoDia(movs, dataStr) {
  /* Ponto 1: vendas só válidas (mesma régua BPMetrics). */
  var v = 0, d = 0;
  var list = movs || [];
  var ds = String(dataStr || '').slice(0, 10);
  for (var i = 0; i < list.length; i++) {
    var m = list[i];
    if (!m || String(m.data || '').slice(0, 10) !== ds) continue;
    if (_bpIaIsVendaValida(m)) v += _bpIaNum(m.valor);
    else if (m.tipo === 'despesa') d += _bpIaNum(m.valor);
  }
  return { vendas: v, despesas: d, fluxo: v - d };
}

/** Métricas base do dia com fallback seguro (nunca NaN/undefined). */
function _bpIaMetricasBase() {
  var movs = (state && Array.isArray(state.movimentos)) ? state.movimentos : [];
  var ags = (state && Array.isArray(state.agendamentos)) ? state.agendamentos : [];
  var hojeStr = (typeof hoje === 'function') ? hoje() : _bpIaDataOffset(0);
  var fluxo = _bpIaFluxoDia(movs, hojeStr);
  var fundo = _bpIaNum(state && state.config && state.config.fundo);
  return {
    movs: movs,
    ags: ags,
    hojeStr: hojeStr,
    vendas: fluxo.vendas,
    despesas: fluxo.despesas,
    fluxo: fluxo.fluxo,
    fundo: fundo,
    saldoEst: fundo + fluxo.fluxo,
    pronto: !!(state && Array.isArray(state.movimentos) && Array.isArray(state.agendamentos))
  };
}

function renderIAResumo() {
  var base = _bpIaMetricasBase();
  if (!base.pronto) {
    var listaWait = document.getElementById('ia-insights-list');
    if (listaWait) {
      var _loadTxt = (window.BP_IA_Insights && BP_IA_Insights.copy && BP_IA_Insights.copy.aCarregar)
        ? BP_IA_Insights.copy.aCarregar()
        : 'A preparar o que merece atenção…';
      listaWait.innerHTML = '<div class="ia-insight-row"><span>' + _loadTxt + '</span></div>';
    }
    try { if (window.BP_IA_Insights && typeof BP_IA_Insights.applyTitulo === 'function') BP_IA_Insights.applyTitulo(); } catch (_) {}
    return;
  }
  var movs = base.movs;
  var ags = base.ags;
  var hojeStr = base.hojeStr;
  var hojeD = new Date(hojeStr + 'T12:00:00');
  var vendasHoje = _bpIaFiltrarVendasValidas(movs, hojeStr, hojeStr);
  var totalHoje = base.vendas;
  var totalDespHoje = base.despesas;
  var fundo = base.fundo;
  var fluxoHoje = base.fluxo;
  var saldoEst = base.saldoEst;

  var agHoje = ags.filter(function (a) { return a.data === hojeStr; });
  var pendentesHoje = agHoje.filter(function (a) {
    var st = _bpIaSt(a);
    return st === 'agendado' || (!st);
  }).length;
  var clientesHoje = new Set(vendasHoje.map(function (v) { return v.cliente; }).filter(Boolean)).size;

  var elFat = document.getElementById('ia-resumo-fat');
  if (elFat) elFat.textContent = fmtKz(totalHoje);

  var dias7Fat = [];
  for (var i = 1; i <= 7; i++) {
    dias7Fat.push(_bpIaFluxoDia(movs, _bpIaDataOffset(-i)).vendas);
  }
  var media7 = dias7Fat.reduce(function (s, v) { return s + v; }, 0) / 7;
  var fatTrendEl = document.getElementById('ia-resumo-fat-trend');
  if (fatTrendEl) {
    if (media7 > 0) {
      var variacaoFat = Math.round(((totalHoje - media7) / media7) * 100);
      fatTrendEl.innerHTML = '<span style="color:' + (variacaoFat >= 0 ? 'var(--green)' : 'var(--red)') + '">' +
        (variacaoFat >= 0 ? '↑' : '↓') + ' ' + Math.abs(variacaoFat) + '%</span> vs média 7 dias';
    } else {
      fatTrendEl.textContent = totalHoje > 0 ? 'sem histórico de 7 dias' : 'sem vendas recentes';
    }
  }

  var elCli = document.getElementById('ia-resumo-clientes');
  if (elCli) elCli.textContent = String((state.clientes || []).length);
  var elCliSub = document.getElementById('ia-resumo-clientes-sub');
  if (elCliSub) elCliSub.textContent = clientesHoje + (clientesHoje === 1 ? ' atendido hoje' : ' atendidos hoje');

  var elAg = document.getElementById('ia-resumo-ag');
  if (elAg) elAg.textContent = String(agHoje.length);
  var elAgSub = document.getElementById('ia-resumo-ag-sub');
  if (elAgSub) elAgSub.textContent = pendentesHoje + (pendentesHoje === 1 ? ' pendente' : ' pendentes');

  /* ---- Insights: prioridade (1 atenção → 3 info), máx. 5 ---- */
  var insights = [];
  function pushIns(prio, icone, cor, texto) {
    insights.push({ prio: prio, icone: icone, cor: cor, texto: texto });
  }

  /* Ticket médio hoje vs dias com venda nos últimos 7 */
  var ticketHoje = vendasHoje.length > 0 ? totalHoje / vendasHoje.length : 0;
  var ticketsDias7 = [];
  for (var t = 1; t <= 7; t++) {
    var dts = _bpIaDataOffset(-t);
    var vd = _bpIaFiltrarVendasValidas(movs, dts, dts);
    if (vd.length > 0) {
      var sum = vd.reduce(function (s, v) { return s + _bpIaNum(v.valor); }, 0);
      ticketsDias7.push(sum / vd.length);
    }
  }
  if (ticketHoje > 0 && ticketsDias7.length > 0) {
    var mediaTicket7 = ticketsDias7.reduce(function (s, v) { return s + v; }, 0) / ticketsDias7.length;
    if (mediaTicket7 > 0) {
      var variacaoTicket = Math.round(((ticketHoje - mediaTicket7) / mediaTicket7) * 100);
      var down = variacaoTicket < -8;
      var _c = window.BP_IA_Insights && BP_IA_Insights.copy;
      pushIns(down ? 1 : 2, 'trend', variacaoTicket >= 0 ? 'var(--green)' : 'var(--red)',
        (_c && _c.ticketVariacao)
          ? _c.ticketVariacao(variacaoTicket >= 0, Math.abs(variacaoTicket))
          : ('Hoje, o valor médio por atendimento ' + (variacaoTicket >= 0 ? 'subiu' : 'desceu') +
            ' <strong>' + Math.abs(variacaoTicket) + '%</strong> face aos últimos dias com vendas.'));
    }
  } else if (totalHoje === 0 && media7 > 0) {
    var _c0 = window.BP_IA_Insights && BP_IA_Insights.copy;
    pushIns(1, 'trend', 'var(--text-secondary)',
      (_c0 && _c0.semVendasHoje)
        ? _c0.semVendasHoje(fmtKz(Math.round(media7)))
        : ('Hoje ainda não entrou dinheiro no caixa. Nos últimos 7 dias, em média, o salão fez <strong>' +
          fmtKz(Math.round(media7)) + '</strong> por dia.'));
  }

  /* Clientes inactivos > 30 dias */
  var ultimaCompraPorCliente = {};
  movs.forEach(function (v) {
    if (!_bpIaIsVendaValida(v) || !v.cliente) return;
    var nome = String(v.cliente).trim();
    if (!nome) return;
    if (!ultimaCompraPorCliente[nome] || v.data > ultimaCompraPorCliente[nome]) {
      ultimaCompraPorCliente[nome] = v.data;
    }
  });
  var inativos = 0;
  Object.keys(ultimaCompraPorCliente).forEach(function (nome) {
    var data = ultimaCompraPorCliente[nome];
    var dias = Math.floor((hojeD - new Date(data + 'T12:00:00')) / 86400000);
    if (dias > 30) inativos++;
  });
  if (inativos > 0) {
    var _ci = window.BP_IA_Insights && BP_IA_Insights.copy;
    pushIns(1, 'user', 'var(--text-secondary)',
      (_ci && _ci.clientesInactivos)
        ? _ci.clientesInactivos(inativos)
        : (inativos === 1
          ? 'Há <strong>1 cliente</strong> que não aparece há mais de 30 dias — vale a pena ligar ou mandar mensagem.'
          : 'Há <strong>' + inativos + ' clientes</strong> que não aparecem há mais de 30 dias — vale a pena retomar o contacto.'));
  }

  /* Serviço campeão da semana — % sobre soma dos itens (consistente) */
  var iniSemanaStr = _bpIaDataOffset(-6);
  var vendasSemana = _bpIaFiltrarVendasValidas(movs, iniSemanaStr, hojeStr);
  var receitaPorServico = {};
  var receitaItensSemana = 0;
  var receitaSemanaTotal = 0;
  vendasSemana.forEach(function (v) {
    receitaSemanaTotal += _bpIaNum(v.valor);
    if (v.itens && Array.isArray(v.itens) && v.itens.length) {
      v.itens.forEach(function (it) {
        if (!it || !it.nome) return;
        var val = _bpIaItemValor(it);
        receitaPorServico[it.nome] = (receitaPorServico[it.nome] || 0) + val;
        receitaItensSemana += val;
      });
    }
  });
  var servicosOrdenados = Object.keys(receitaPorServico).map(function (k) {
    return [k, receitaPorServico[k]];
  }).sort(function (a, b) { return b[1] - a[1]; });
  var baseServ = receitaItensSemana > 0 ? receitaItensSemana : receitaSemanaTotal;
  if (servicosOrdenados.length > 0 && baseServ > 0) {
    var nomeServico = servicosOrdenados[0][0];
    var receitaServico = servicosOrdenados[0][1];
    var pct = Math.round((receitaServico / baseServ) * 100);
    if (pct > 100) pct = 100;
    var conc = pct >= 45;
    var _cs = window.BP_IA_Insights && BP_IA_Insights.copy;
    pushIns(conc ? 1 : 2, 'star', 'var(--gold-dark)',
      (_cs && _cs.servicoConcentra)
        ? _cs.servicoConcentra(escHtml(nomeServico), pct, conc)
        : ('O serviço «<strong>' + escHtml(nomeServico) + '</strong>» representa <strong>' + pct +
          '%</strong> do que faturou esta semana' + (conc ? ' — quase tudo depende deste serviço.' : '.')));
  } else if (receitaSemanaTotal > 0) {
    var _cs2 = window.BP_IA_Insights && BP_IA_Insights.copy;
    pushIns(2, 'star', 'var(--text-secondary)',
      (_cs2 && _cs2.servicoSemItens) ? _cs2.servicoSemItens()
        : 'Há faturação esta semana, mas sem detalhe por serviço nas vendas — o ranking fica limitado.');
  }

  /* Fluxo diário (vendas − despesas) vs média 30 dias — explícito, não confunde com fundo */
  var fluxos30 = [];
  for (var f = 0; f <= 29; f++) {
    fluxos30.push(_bpIaFluxoDia(movs, _bpIaDataOffset(-f)).fluxo);
  }
  var fluxo0 = fluxos30[0];
  var mediaFluxo = fluxos30.slice(1).reduce(function (s, v) { return s + v; }, 0) / 29;
  var temMov30 = fluxos30.some(function (s) { return s !== 0; });
  if (temMov30) {
    var abaixo = fluxo0 < mediaFluxo;
    var _cf = window.BP_IA_Insights && BP_IA_Insights.copy;
    pushIns(abaixo ? 1 : 2, 'wallet', abaixo ? 'var(--red)' : 'var(--green)',
      (_cf && _cf.fluxoVsMedia)
        ? _cf.fluxoVsMedia(abaixo, fundo ? fmtKz(saldoEst) : '')
        : ('Depois das despesas, o dia está <strong>' + (abaixo ? 'abaixo' : 'acima') +
          '</strong> do habitual dos últimos 30 dias.' + (fundo ? ' Fundo de caixa: ' + fmtKz(saldoEst) + '.' : '')));
  } else if (fundo > 0 && totalHoje === 0) {
    var _cf2 = window.BP_IA_Insights && BP_IA_Insights.copy;
    pushIns(2, 'wallet', 'var(--text-secondary)',
      (_cf2 && _cf2.soFundo) ? _cf2.soFundo(fmtKz(fundo))
        : ('Hoje ainda não houve movimentos. O fundo de caixa está em <strong>' + fmtKz(fundo) + '</strong>.'));
  }

  /* Agenda amanhã — status via _statusAg */
  var amanhaStr = _bpIaDataOffset(1);
  var agAmanha = ags.filter(function (a) {
    if (a.data !== amanhaStr) return false;
    var st = _bpIaSt(a);
    return st !== 'cancelado';
  });
  var agAmanhaActivos = agAmanha.filter(function (a) {
    var st = _bpIaSt(a);
    return st === 'agendado';
  });
  var _ca = window.BP_IA_Insights && BP_IA_Insights.copy;
  if (agAmanhaActivos.length > 0) {
    pushIns(2, 'calendar', 'var(--text-secondary)',
      (_ca && _ca.agendaAmanha) ? _ca.agendaAmanha(agAmanhaActivos.length)
        : ('Amanhã já tem <strong>' + agAmanhaActivos.length + '</strong> marcações na agenda.'));
  } else {
    pushIns(1, 'calendar', 'var(--text-secondary)',
      (_ca && _ca.agendaAmanhaVazia) ? _ca.agendaAmanhaVazia()
        : 'Ainda <strong>não há marcações</strong> para amanhã — convém ir preenchendo a agenda.');
  }

  /* Pendentes de hoje em atraso (hora já passou e ainda agendado) */
  var agora = new Date();
  var atrasados = agHoje.filter(function (a) {
    if (_bpIaSt(a) !== 'agendado') return false;
    var hora = String(a.hora || '00:00').slice(0, 5);
    var ad = new Date(a.data + 'T' + hora + ':00');
    return !isNaN(ad.getTime()) && ad < agora;
  }).length;
  if (atrasados > 0) {
    var _cat = window.BP_IA_Insights && BP_IA_Insights.copy;
    pushIns(1, 'calendar', 'var(--red)',
      (_cat && _cat.atrasados) ? _cat.atrasados(atrasados)
        : (atrasados === 1
          ? 'Há <strong>1 marcação de hoje</strong> em atraso — finalize ou actualize o estado.'
          : 'Há <strong>' + atrasados + ' marcações de hoje</strong> em atraso — finalize ou actualize o estado.'));
  }

  insights.sort(function (a, b) { return a.prio - b.prio; });
  if (insights.length > 5) insights = insights.slice(0, 5);

  var iconesSvg = {
    trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="15" height="15" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
  };
  var listaEl = document.getElementById('ia-insights-list');
  if (listaEl) {
    var bgPorCor = {
      'var(--green)': 'var(--green-50)',
      'var(--red)': 'var(--red-50)',
      'var(--gold-dark)': 'var(--gold-50)',
      'var(--text-secondary)': 'var(--neutral-75)'
    };
    listaEl.innerHTML = insights.map(function (ins) {
      var _txt = ins.texto || ''; /* HTML interno; nomes já passaram por escHtml no pushIns */
      var _cor = String(ins.cor || '').replace(/[<>"']/g, '');
      return '<div class="ia-insight-row"><span class="ia-insight-icone" aria-hidden="true">' +
        (iconesSvg[ins.icone] || '') + '</span><span>' + _txt + '</span></div>';
    }).join('') || '<div class="ia-insight-row"><span>' +
      ((window.BP_IA_Insights && BP_IA_Insights.copy && BP_IA_Insights.copy.vazio)
        ? BP_IA_Insights.copy.vazio()
        : 'Ainda não há dados suficientes para apontar o que merece atenção.') +
      '</span></div>';
    try { if (window.BP_IA_Insights && typeof BP_IA_Insights.applyTitulo === 'function') BP_IA_Insights.applyTitulo(); } catch (_) {}
  }

  var fim7 = _bpIaDataOffset(7);
  var agProximos = ags.filter(function (a) {
    if (!a.data || a.data < hojeStr || a.data > fim7) return false;
    return _bpIaSt(a) === 'agendado';
  }).length;

  if (typeof renderIASugestoesAdaptativas === 'function') {
    renderIASugestoesAdaptativas({
      totalHoje: totalHoje,
      totalDespHoje: totalDespHoje,
      fluxoHoje: fluxoHoje,
      media7: media7,
      inativos: inativos,
      pendentesHoje: pendentesHoje,
      atrasados: atrasados,
      agAmanha: agAmanhaActivos.length,
      agProximos: agProximos,
      ticketHoje: ticketHoje,
      temServicoTop: servicosOrdenados.length > 0
    });
  }
}

try {
  window.renderIAResumo = renderIAResumo;
  window.actualizarInsightsIA = renderIAResumo;
  window.actualizarResumoIA = renderIAResumo;
} catch (_) {}

function renderIASugestoesAdaptativas(ctx) {
  var grid = document.querySelector('#tab-ia .ia-sugestoes-grid');
  if (!grid || !ctx) return;

  var pool = [];
  function add(score, label, pergunta, tone) {
    pool.push({ score: score, label: label, pergunta: pergunta, tone: tone || 'ia-sug-graphite' });
  }

  /* Atenção primeiro */
  if (ctx.atrasados > 0) {
    add(100, 'Marcações em atraso', 'Quais marcações de hoje estão pendentes?', 'ia-sug-gold');
  }
  if (ctx.totalHoje === 0 && ctx.media7 > 0) {
    add(95, 'Receita hoje', 'Qual foi a minha receita hoje?', 'ia-sug-green');
  } else {
    add(40, 'Receita hoje', 'Qual foi a minha receita hoje?', 'ia-sug-green');
  }
  if (ctx.inativos > 0) {
    add(90, 'Clientes inactivos', 'Quais clientes estão inativos?', 'ia-sug-gold');
  } else {
    add(35, 'Clientes VIP', 'Quem são os meus clientes VIP?', 'ia-sug-gold');
  }
  if (ctx.agAmanha === 0) {
    add(88, 'Agenda amanhã', 'O que tenho agendado para amanhã?', 'ia-sug-green');
  } else {
    add(50, 'Agenda amanhã', 'O que tenho agendado para amanhã?', 'ia-sug-green');
  }
  if (ctx.fluxoHoje < 0 || ctx.totalDespHoje > ctx.totalHoje) {
    add(85, 'Fluxo de caixa', 'Como está o fluxo de caixa?', 'ia-sug-gold');
  } else {
    add(45, 'Fluxo de caixa', 'Como está o fluxo de caixa?', 'ia-sug-gold');
  }
  if (ctx.temServicoTop) {
    add(55, 'Serviço campeão', 'Qual é o meu serviço mais vendido?', 'ia-sug-graphite');
  }
  add(42, 'Ticket médio', 'Qual é o meu ticket médio?', 'ia-sug-graphite');
  if (ctx.pendentesHoje > 0) {
    add(60, 'Agenda de hoje', 'Como está a minha agenda?', 'ia-sug-green');
  }
  /* Calendário externo (.ics) — reutiliza BPOps.downloadIcs se existir */
  if (ctx.agProximos > 0 && window.BPOps && typeof window.BPOps.downloadIcs === 'function') {
    add(72, 'Exportar calendário', '__bp_export_ics__', 'ia-sug-graphite');
  } else if (ctx.agAmanha > 0 && window.BPOps && typeof window.BPOps.downloadIcs === 'function') {
    add(65, 'Exportar calendário', '__bp_export_ics__', 'ia-sug-graphite');
  }

  pool.sort(function (a, b) { return b.score - a.score; });
  /* Intercalar: evitar dois tons iguais seguidos quando possível */
  var picked = [];
  var usedLabel = {};
  for (var i = 0; i < pool.length && picked.length < 6; i++) {
    var c = pool[i];
    if (usedLabel[c.label]) continue;
    if (picked.length && picked[picked.length - 1].tone === c.tone) {
      var swap = null;
      for (var j = i + 1; j < pool.length; j++) {
        if (!usedLabel[pool[j].label] && pool[j].tone !== c.tone) { swap = pool[j]; pool[j] = c; break; }
      }
      if (swap) c = swap;
    }
    usedLabel[c.label] = true;
    picked.push(c);
  }

  var svg = {
    'ia-sug-green': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 18 8.5 10.5 13.5 15.5 23 6"/><polyline points="17 6 23 6 23 12"/></svg>',
    'ia-sug-gold': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    'ia-sug-graphite': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9"/></svg>'
  };
  grid.innerHTML = picked.map(function (c) {
    /* F5.3: label/pergunta sempre escapados; tone só chaves do mapa svg */
    var _perg = (typeof escHtml === 'function')
      ? escHtml(String(c.pergunta || ''))
      : String(c.pergunta || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    var _lab = (typeof escHtml === 'function')
      ? escHtml(String(c.label || ''))
      : String(c.label || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    var _tone = (c.tone && svg[c.tone]) ? c.tone : 'ia-sug-graphite';
    return '<button type="button" class="ia-sugestao-card" data-pergunta="' + _perg + '">' +
      '<span class="ia-sugestao-icone ' + _tone + '">' + (svg[_tone] || svg['ia-sug-graphite']) + '</span>' +
      '<span>' + _lab + '</span></button>';
  }).join('');
}

function chaveIAPerguntas() {
  return 'ia_perguntas_' + ((state.config && state.config.salaoId) || 'local') + '_' + hoje();
}

function getUsoIAHoje() {
  return parseInt(localStorage.getItem(chaveIAPerguntas()) || '0', 10) || 0;
}

function setUsoIAHoje(n) {
  localStorage.setItem(chaveIAPerguntas(), String(Math.max(0, n | 0)));
  actualizarContadorIA();
  // ET4.6: propagar contador para Supabase (salao_config + tabela ia_uso_diario se existir)
  try {
    if (typeof bpPushIAUsoToSupabase === 'function') {
      Promise.resolve(bpPushIAUsoToSupabase(Math.max(0, n | 0))).then(function (ok) {
        if (ok === false && navigator.onLine && typeof toast === 'function') {
          if (!window.__bpIaPushFailToast) {
            window.__bpIaPushFailToast = true;
            toast('Falha ao sincronizar uso da IA. Tente novamente mais tarde.', 'warning');
            setTimeout(function () { window.__bpIaPushFailToast = false; }, 60000);
          }
        }
      }).catch(function () {});
    }
  } catch (_) {}
}

/** Lê uso remoto e fica com max(local, remoto) — multi-dispositivo no mesmo dia. */
async function bpPullIAUsoFromSupabase() {
  try {
    if (!navigator.onLine || !state.config || !state.config.salaoId) return null;
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return null;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session || !session.access_token) return null;
    const dia = typeof hoje === 'function' ? hoje() : new Date().toISOString().slice(0, 10);
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + session.access_token
    };
    // Preferir tabela dedicada
    let remote = null;
    try {
      const r1 = await fetch(
        SUPABASE_URL + '/rest/v1/ia_uso_diario?salao_id=eq.' + encodeURIComponent(state.config.salaoId) +
        '&dia=eq.' + encodeURIComponent(dia) + '&select=perguntas',
        { headers: headers }
      );
      if (r1.ok) {
        const rows = await r1.json();
        if (rows && rows[0] && rows[0].perguntas != null) remote = parseInt(rows[0].perguntas, 10);
      }
    } catch (_) {}
    // Fallback salao_config
    if (remote == null || isNaN(remote)) {
      try {
        const r2 = await fetch(
          SUPABASE_URL + '/rest/v1/salao_config?salao_id=eq.' + encodeURIComponent(state.config.salaoId) +
          '&select=ia_perguntas_hoje,ia_perguntas_dia',
          { headers: headers }
        );
        if (r2.ok) {
          const rows = await r2.json();
          if (rows && rows[0]) {
            const d = rows[0].ia_perguntas_dia;
            if (d === dia && rows[0].ia_perguntas_hoje != null) {
              remote = parseInt(rows[0].ia_perguntas_hoje, 10);
            }
          }
        }
      } catch (_) {}
    }
    if (remote == null || isNaN(remote)) return null;
    const local = getUsoIAHoje();
    if (remote > local) setUsoIAHoje(remote);
    return remote;
  } catch (e) {
    return null;
  }
}

async function bpPushIAUsoToSupabase(n) {
  try {
    if (!navigator.onLine || !state.config || !state.config.salaoId) return false;
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return false;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session || !session.access_token) return false;
    const dia = typeof hoje === 'function' ? hoje() : new Date().toISOString().slice(0, 10);
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + session.access_token,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    };
    var okAny = false;
    // Tabela ia_uso_diario (PK salao_id+dia)
    try {
      var r1 = await fetch(SUPABASE_URL + '/rest/v1/ia_uso_diario', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          salao_id: state.config.salaoId,
          dia: dia,
          perguntas: n,
          updated_at: new Date().toISOString()
        })
      });
      if (!r1.ok) {
        var t1 = '';
        try { t1 = await r1.text(); } catch (_) {}
        console.error('[IA Push] ia_uso_diario', r1.status, t1);
      } else {
        okAny = true;
      }
    } catch (e1) {
      console.error('[IA Push] ia_uso_diario exception', e1);
    }
    // Espelho em salao_config
    try {
      var r2 = await fetch(
        SUPABASE_URL + '/rest/v1/salao_config?salao_id=eq.' + encodeURIComponent(state.config.salaoId),
        {
          method: 'PATCH',
          headers: headers,
          body: JSON.stringify({
            ia_perguntas_hoje: n,
            ia_perguntas_dia: dia,
            updated_at: new Date().toISOString()
          })
        }
      );
      if (!r2.ok) {
        var t2 = '';
        try { t2 = await r2.text(); } catch (_) {}
        console.error('[IA Push] salao_config', r2.status, t2);
      } else {
        okAny = true;
      }
    } catch (e2) {
      console.error('[IA Push] salao_config exception', e2);
    }
    return okAny;
  } catch (e) {
    console.error('[IA Push] falha', e);
    return false;
  }
}

if (typeof window !== 'undefined') {
  window.bpPullIAUsoFromSupabase = bpPullIAUsoFromSupabase;
  window.bpPushIAUsoToSupabase = bpPushIAUsoToSupabase;
}


/** Estado real da aba IA — nunca “Online” falso. */
function _bpIaIsOnline() {
  try { return navigator.onLine !== false; } catch (_) { return true; }
}
try { window._bpIaIsOnline = _bpIaIsOnline; } catch (_) {}

function _bpIaSetComposerStatus(text) {
  var el = document.getElementById('ia-status');
  if (el) el.textContent = text || '';
}

/** Header: só ponto + #ia-status-line-label (sem tagline morta, sem motor local). */
function _bpIaSetHeaderStatus(kind, detail) {
  var C = (window.BP_IA && window.BP_IA.HEADER_LABEL) || {};
  var root = document.querySelector('#tab-ia .ia-status-line');
  var label = document.getElementById('ia-status-line-label');
  var k = kind;
  if (k === 'local') k = 'offline';
  var conn = 'ok';
  var state = 'ok';
  var text = C.OK || 'Ligado';
  if (k === 'offline') {
    conn = 'offline'; state = 'offline'; text = C.OFFLINE || 'Offline';
  } else if (k === 'busy') {
    conn = 'ok'; state = 'busy'; text = C.BUSY || 'A trabalhar';
  } else if (k === 'error') {
    conn = 'error'; state = 'error'; text = C.ERROR || 'Erro';
  } else if (k === 'neutral') {
    conn = 'neutral'; state = 'neutral'; text = C.NEUTRAL || '—';
  }
  if (root) {
    root.setAttribute('data-ia-conn', conn);
    var dot = root.querySelector('.ia-status-dot');
    if (dot) dot.setAttribute('data-state', state);
  }
  if (label) label.textContent = text;
}
function atualizarIAOffline() {
  var online = _bpIaIsOnline();
  var overlay = document.getElementById('ia-offline-overlay');
  if (overlay) {
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
  }
  if (!_iaBusy) {
    if (!online) {
      _bpIaSetHeaderStatus('offline');
      _bpIaSetComposerStatus((window.BP_IA && window.BP_IA.STATUS && window.BP_IA.STATUS.OFFLINE) || 'Sem rede');
    } else {
      _bpIaSetHeaderStatus('ok');
      _bpIaSetComposerStatus((window.BP_IA && window.BP_IA.STATUS && window.BP_IA.STATUS.READY) || 'IA pronta');
    }
  }
  return online;
}
try {
  window.addEventListener('online', function () { try { atualizarIAOffline(); } catch (_) {} });
  window.addEventListener('offline', function () { try { atualizarIAOffline(); } catch (_) {} });
} catch (_) {}

function actualizarContadorIA() {
  const cont = document.getElementById('ia-contador');
  if (!cont) return;
  const plano = typeof getPlanoAtual === 'function' ? getPlanoAtual() : 'trial';
  const info = (typeof PLANOS !== 'undefined' && PLANOS[plano]) ? PLANOS[plano] : { iaDia: 0 };
  const usadas = getUsoIAHoje();
  const lim = info.iaDia;
  if (!lim || lim === 0) {
    cont.textContent = usadas + ' · plano sem cota IA';
    return;
  }
  if (lim === Infinity) {
    cont.textContent = String(usadas) + ' hoje';
    return;
  }
  cont.textContent = usadas + ' / ' + lim + ' hoje';
}

function normalizarPerguntaIA(q) {
  return String(q || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Respostas determinísticas a partir dos dados locais (sem gastar cota da API).
 * Devolve string ou null se não houver intenção clara.
 */
function responderIALocal(pergunta) {
  /* Motor local desactivado — sem backup offline */
  return 'O agente IA precisa de rede. Tente novamente quando estiver online.';
}

window.responderIALocal = responderIALocal;
window.buildContextoIA = buildContextoIA;

let _iaBusy = false;
window.__bpIaLastMeta = { fonte: null };

/* ========== Benza generation FSM (estado IA ≠ rede ≠ sync) ========== */
var BP_IA_GEN = {
  status: 'idle', /* idle|submitting|processing|responding|complete|offline|error|cancelled */
  phase: null,    /* analyzing|processing|preparing|responding */
  generationId: 0,
  startedAt: 0,
  completedAt: 0,
  duration: 0,
  model: null,
  errorCode: null,
  text: ''
};
var BP_IA_NET = { state: 'online' }; /* online|offline|unstable|checking */

function _bpIaGenResetIdle() {
  BP_IA_GEN.status = 'idle';
  BP_IA_GEN.phase = null;
  BP_IA_GEN.errorCode = null;
  BP_IA_GEN.text = '';
  BP_IA_GEN.model = null;
}

function _bpIaGenStart() {
  BP_IA_GEN.generationId = (BP_IA_GEN.generationId || 0) + 1;
  BP_IA_GEN.status = 'submitting';
  BP_IA_GEN.phase = 'analyzing';
  BP_IA_GEN.startedAt = Date.now();
  BP_IA_GEN.completedAt = 0;
  BP_IA_GEN.duration = 0;
  BP_IA_GEN.errorCode = null;
  BP_IA_GEN.text = '';
  BP_IA_GEN.model = null;
  return BP_IA_GEN.generationId;
}

function _bpIaGenIsCurrent(id) {
  return id != null && id === BP_IA_GEN.generationId;
}

function _bpIaGenFinish(status, errCode) {
  BP_IA_GEN.status = status || 'complete';
  BP_IA_GEN.phase = null;
  BP_IA_GEN.completedAt = Date.now();
  BP_IA_GEN.duration = BP_IA_GEN.completedAt - (BP_IA_GEN.startedAt || BP_IA_GEN.completedAt);
  if (errCode) BP_IA_GEN.errorCode = errCode;
}

function _bpIaNetRefresh() {
  try {
    BP_IA_NET.state = (navigator.onLine !== false) ? 'online' : 'offline';
  } catch (_) {
    BP_IA_NET.state = 'online';
  }
  return BP_IA_NET.state;
}


async function perguntarIA(pergunta) {
  const q = String(pergunta || '').trim();
  if (!q) {
    toast('Escreva uma pergunta.', 'warning');
    return null;
  }
  if (q.length > 2000) {
    toast('Pergunta demasiado longa (máx. 2000 caracteres).', 'warning');
    return null;
  }
  if (_iaBusy) return null;
  if (!_bpIaIsOnline()) {
    try { _bpIaSetHeaderStatus('offline'); _bpIaSetComposerStatus((window.BP_IA && window.BP_IA.STATUS && window.BP_IA.STATUS.OFFLINE) || 'Sem rede'); } catch (_) {}
    return 'Sem ligação à internet. O agente IA precisa de rede para responder.';
  }

  const plano = typeof getPlanoAtual === 'function' ? getPlanoAtual() : 'trial';
  const iaDia = (typeof PLANOS !== 'undefined' && PLANOS[plano]) ? PLANOS[plano].iaDia : 0;
  if (iaDia === 0) {
    try { _bpIaSetComposerStatus('Sem cota IA neste plano'); } catch (_) {}
    mostrarModalUpgrade('O Agente IA está disponível no plano Pro (5 perguntas/dia) e Premium (ilimitado).');
    return null;
  }

  try {
    if (typeof bpPullIAUsoFromSupabase === 'function' && _bpIaIsOnline()) {
      await bpPullIAUsoFromSupabase();
    }
  } catch (_) {}
  const usadas = getUsoIAHoje();
  if (iaDia !== Infinity && usadas >= iaDia) {
    try { _bpIaSetComposerStatus('Limite diário atingido'); } catch (_) {}
    if (plano === 'pro') {
      mostrarModalUpgrade('Atingiu o limite de 5 perguntas/dia do plano Pro. Faça upgrade para Premium para perguntas ilimitadas.');
    } else {
      toast('Limite de perguntas atingido para hoje.', 'warning');
    }
    return null;
  }

  // ET4.2-P0: IA online só admin/gerente (aba já filtrada; reforço operacional)
  if (typeof bpExigirRole === 'function' && !bpExigirRole(['admin', 'gerente'], 'Não tem permissão para usar o agente IA.')) {
    return null;
  }

  var contextoRaw;
  try {
    contextoRaw = buildContextoIA();
  } catch (eCtx) {
    try { console.error('[Benza] buildContextoIA', eCtx); } catch (_) {}
    if (typeof toast === 'function') toast('Não foi possível preparar o contexto da IA. Tente de novo.', 'error');
    return null;
  }
  if (contextoRaw && contextoRaw.erro) {
    toast(contextoRaw.erro, 'warning');
    return null;
  }
  const contexto = (typeof _bpIaContextoCompacto === 'function')
    ? _bpIaContextoCompacto(contextoRaw)
    : contextoRaw;
  const historicoEnvio = (typeof _bpIaHistoricoCompacto === 'function')
    ? _bpIaHistoricoCompacto(iaHistorico, 40, 1200)
    : (iaHistorico || []).slice(-8);

  _iaBusy = true;
  window.__bpIaLastMeta = { fonte: null };
  try { _bpIaSetHeaderStatus('busy', 'A contactar o agente…'); _bpIaSetComposerStatus('A processar…'); } catch (_) {}
  try {
    // Auth resiliente: JWT de utilizador, com 1 retry após refresh se falhar.
    var iaHeaders = { 'Content-Type': 'application/json' };
    var iaAuthMode = 'none';
    try {
      if (typeof getAuthHeaders !== 'function') {
        if (typeof toast === 'function') toast('Sessão inválida. Faça login novamente.', 'error');
        return null;
      }
      var authH = null;
      try {
        authH = await getAuthHeaders();
      } catch (e1) {
        // Segunda tentativa após refresh explícito
        try {
          if (typeof supabaseClient !== 'undefined' && supabaseClient.auth) {
            await supabaseClient.auth.refreshSession();
          }
        } catch (_) {}
        try {
          authH = await getAuthHeaders();
        } catch (e2) {
          if (e2 && e2.message === 'SESSION_EXPIRED') {
            if (typeof toast === 'function') toast('Sessão expirada. Faça login novamente.', 'error');
            return null;
          }
          throw e2;
        }
      }
      if (!authH || !authH.Authorization) {
        if (typeof toast === 'function') toast('Sessão inválida. Faça login novamente.', 'error');
        return null;
      }
      iaHeaders['Authorization'] = authH.Authorization;
      if (authH.apikey) iaHeaders['apikey'] = authH.apikey;
      else if (typeof SUPABASE_ANON_KEY !== 'undefined') iaHeaders['apikey'] = SUPABASE_ANON_KEY;
      iaAuthMode = 'user-jwt';
    } catch (eAuth) {
      if (eAuth && eAuth.message === 'SESSION_EXPIRED') {
        if (typeof toast === 'function') toast('Sessão expirada. Faça login novamente.', 'error');
        return null;
      }
      if (typeof toast === 'function') toast('Não foi possível autenticar o agente IA.', 'error');
      return null;
    }
    window.__bpIaLastMeta = { fonte: null, auth: iaAuthMode };

    var _hab = (window.BP_IA_Habilidade && typeof BP_IA_Habilidade.get === 'function')
      ? BP_IA_Habilidade.get() : 'consultor';
    var _catalogo = [];
    try {
      if (window.BenzaTools && typeof BenzaTools.catalogo === 'function') {
        _catalogo = BenzaTools.catalogo().filter(function (t) {
          if (_hab === 'consultor') return t.tipo === 'read';
          if (_hab === 'relator') return t.tipo === 'read';
          return true;
        });
      }
    } catch (_) {}
    const iaBody = JSON.stringify({
      pergunta: q,
      contexto: contexto,
      historico: historicoEnvio,
      plano: plano || undefined,
      habilidade: _hab,
      toolsCatalog: _catalogo,
      instrucoes:
        'Português de Angola, tom de consultor maduro. ' +
        'Habilidade activa: ' + _hab + '. ' +
        'Classifica o pedido: saudação/meta/dados/estratégia/ambíguo. ' +
        'Pergunta curta ou ambígua → clarifica em 1 frase antes de plano. ' +
        'Construtor: se o pedido for criar dados, devolve também BENZA_TOOL:{"tool":"...","dados":{},"resumo":"..."}. ' +
        'Nunca executes writes — o utilizador autoriza na app. ' +
        'Proibido: mensagens WhatsApp genéricas com [Nome]; setas → decorativas. ' +
        'Nunca cortes frases a meio. Não repitas o mesmo plano se o histórico já o tem.'
    });

    async function bpFetchIaOnce() {
      try {
        if (window.__bpIaFetchAbort) {
          try { window.__bpIaFetchAbort.abort(); } catch (_) {}
        }
        window.__bpIaFetchAbort = typeof AbortController !== 'undefined' ? new AbortController() : null;
      } catch (_) { window.__bpIaFetchAbort = null; }
      return fetch(IA_EDGE_URL, {
        method: 'POST',
        headers: iaHeaders,
        body: iaBody,
        signal: window.__bpIaFetchAbort ? window.__bpIaFetchAbort.signal : undefined
      });
    }

    var resp = await bpFetchIaOnce();
    // 503: retry único (edge cold-start / falha transitória do provedor)
    if (resp && resp.status === 503) {
      try {
        await new Promise(function (r) { setTimeout(r, 900); });
        resp = await bpFetchIaOnce();
      } catch (_) {}
    }

    if (!resp.ok) {
      var bodyTxt = '';
      try { bodyTxt = await resp.text(); } catch (_) {}
      var bodyMsg = '';
      try {
        var j = bodyTxt ? JSON.parse(bodyTxt) : null;
        bodyMsg = (j && (j.error || j.message || j.msg || j.resposta)) ? String(j.error || j.message || j.msg || j.resposta) : '';
      } catch (_) {}
      try {
        console.warn('[Benza] edge HTTP', resp.status, bodyTxt && bodyTxt.slice(0, 400));
        window.__bpIaLastMeta = { fonte: 'error', http: resp.status, detail: bodyTxt ? bodyTxt.slice(0, 200) : '' };
      } catch (_) {}
      if (resp.status === 429) {
        mostrarModalUpgrade('Limite de perguntas atingido. Faça upgrade para continuar.');
        return null;
      }
      if (resp.status === 401 || resp.status === 403) {
        try { _bpIaSetHeaderStatus('error'); _bpIaSetComposerStatus('Sessão sem permissão'); } catch (_) {}
        if (typeof toast === 'function') toast('Sessão sem permissão para a IA. Faça login novamente.', 'error');
        return null;
      }
      if (resp.status === 503) {
        return bodyMsg
          ? ('Agente IA indisponível: ' + bodyMsg)
          : 'Agente IA temporariamente indisponível (servidor). Tente de novo em 1–2 minutos.';
      }
      if (bodyMsg) return 'IA: ' + bodyMsg;
      return 'Não foi possível contactar o agente IA (HTTP ' + resp.status + '). Verifique a ligação e tente de novo.';
    }

    const data = await resp.json();
    setUsoIAHoje(usadas + 1);

    const resposta = data.resposta || 'Não consegui responder. Tente de novo.';
    iaHistorico.push({ pergunta: q, resposta: resposta, fonte: 'api' });
    if (iaHistorico.length > IA_HIST_MAX) iaHistorico = iaHistorico.slice(-IA_HIST_MAX);
    var _prop = null;
    try {
      if (window.BP_IA_Loop) {
        _prop = BP_IA_Loop.parseToolNaResposta(resposta) || BP_IA_Loop.detectarProposta(q);
      }
    } catch (_) {}
    window.__bpIaLastMeta = { fonte: 'api', proposta: _prop };
    return resposta;
  } catch (e) {
    window.__bpIaLastMeta = { fonte: 'error' };
    return 'Sem ligação à internet. Tente novamente quando a ligação voltar.';
  } finally {
    _iaBusy = false;
  }
}

/** Nome fixo do assistente (produto). Botão renomear permanece oculto no HTML. */
function getNomeIA() {
  var base = 'Benza';
  try {
    if (window.BP_IA_Habilidade && typeof BP_IA_Habilidade.label === 'function') {
      var lab = BP_IA_Habilidade.label();
      if (lab) return base + ' · ' + lab;
    }
  } catch (_) {}
  return base;
}

function formatarTempoRelativoIA(ts) {
  if (!ts) return '';
  const diffSeg = Math.floor((Date.now() - ts) / 1000);
  if (diffSeg < 10) return 'agora mesmo';
  if (diffSeg < 60) return `há ${diffSeg} segundos`;
  const diffMin = Math.floor(diffSeg / 60);
  if (diffMin < 60) return `há ${diffMin} ${diffMin === 1 ? 'minuto' : 'minutos'}`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} ${diffH === 1 ? 'hora' : 'horas'}`;
  return `há ${Math.floor(diffH / 24)} dias`;
}
function montarMsgUsuarioIA(pergunta) { return `<div class="ia-msg-user ia-msg-enter">${escHtml(pergunta)}</div>`; }

/**
 * Markdown seguro → HTML (XSS-safe).
 * Suporta: negrito, itálico, cabeçalhos, listas, tabelas, código inline, quebras.
 * Nunca injecta HTML cru da resposta.
 */
function formatarRespostaIA(texto) {
  if (texto == null) return '';
  var raw = String(texto).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!raw) return '';

  /* Limpeza de redacção genérica / ruído tipográfico (pós-modelo) */
  raw = raw.replace(/[ \t]+\n/g, '\n');
  raw = raw.replace(/\n{3,}/g, '\n\n');
  /* setas decorativas → linguagem natural */
  raw = raw.replace(/\s*→\s*/g, ' · ');
  raw = raw.replace(/\s*⇒\s*/g, ' · ');
  /* placeholders óbvios */
  raw = raw.replace(/\[Nome\]/gi, 'o cliente');
  raw = raw.replace(/\[nome\]/gi, 'o cliente');
  /* backticks ímpares / markdown partido residual */
  raw = raw.replace(/`{3,}/g, '');
  if ((raw.match(/`/g) || []).length % 2 === 1) raw = raw.replace(/`/g, '');
  /* nomes próprios compostos: evita quebra a meio (nbsp entre 2–3 tokens capitalizados) */
  raw = raw.replace(
    /\b([A-ZÁÉÍÓÚÂÊÔÃÕÀ][a-záéíóúâêôãõàç]+)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÀ][a-záéíóúâêôãõàç]+)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÀ][a-záéíóúâêôãõàç]+)\b/g,
    function (_m, a, b, c) { return a + '\u00A0' + b + '\u00A0' + c; }
  );
  raw = raw.replace(
    /\b([A-ZÁÉÍÓÚÂÊÔÃÕÀ][a-záéíóúâêôãõàç]+)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÀ][a-záéíóúâêôãõàç]+)\b/g,
    function (_m, a, b) {
      /* não juntar início de frase comum */
      if (/^(O|A|Os|As|Um|Uma|De|Do|Da|Em|No|Na)$/.test(a)) return a + ' ' + b;
      return a + '\u00A0' + b;
    }
  );

  // 1) Escapar tudo primeiro
  var safe = (typeof escHtml === 'function') ? escHtml(raw) : raw
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  var lines = safe.split('\n');
  var out = [];
  var i = 0;
  var inUl = false;
  var inOl = false;
  var inCode = false;
  var codeBuf = [];

  function closeLists() {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  }

  function inlineFmt(s) {
    // código inline `code`
    s = s.replace(/`([^`]+)`/g, '<code class="ia-md-code">$1</code>');
    // negrito **text** ou __text__
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    // itálico *text* (evitar conflito com **)
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    return s;
  }

  function isTableSep(line) {
    return /^\s*\|?[\s:|-]+\|[\s|:|-]*$/.test(line) && line.indexOf('|') !== -1 && /[-:]/.test(line);
  }

  function isTableRow(line) {
    return line.indexOf('|') !== -1 && line.trim().length > 0;
  }

  function parseTableRow(line) {
    var cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|');
    return cells.map(function (c) { return c.trim(); });
  }

  while (i < lines.length) {
    var line = lines[i];

    // bloco de código ```
    if (/^```/.test(line.trim())) {
      if (!inCode) {
        closeLists();
        inCode = true;
        codeBuf = [];
      } else {
        out.push('<pre class="ia-md-pre"><code>' + codeBuf.join('\n') + '</code></pre>');
        inCode = false;
        codeBuf = [];
      }
      i++;
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      i++;
      continue;
    }

    // tabela markdown
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      closeLists();
      var headers = parseTableRow(line);
      i += 2; // skip header + separator
      var rows = [];
      while (i < lines.length && isTableRow(lines[i]) && !isTableSep(lines[i])) {
        rows.push(parseTableRow(lines[i]));
        i++;
      }
      var html = '<div class="ia-md-table-wrap"><table class="ia-md-table"><thead><tr>';
      headers.forEach(function (h) { html += '<th>' + inlineFmt(h) + '</th>'; });
      html += '</tr></thead><tbody>';
      rows.forEach(function (row) {
        html += '<tr>';
        for (var c = 0; c < headers.length; c++) {
          html += '<td>' + inlineFmt(row[c] != null ? row[c] : '') + '</td>';
        }
        html += '</tr>';
      });
      html += '</tbody></table></div>';
      out.push(html);
      continue;
    }

    // cabeçalhos
    var hm = line.match(/^(#{1,3})\s+(.+)$/);
    if (hm) {
      closeLists();
      var level = hm[1].length;
      out.push('<div class="ia-md-h ia-md-h' + level + '">' + inlineFmt(hm[2]) + '</div>');
      i++;
      continue;
    }

    // lista não ordenada
    var ul = line.match(/^\s*[-*•]\s+(.+)$/);
    if (ul) {
      if (inOl) { out.push('</ol>'); inOl = false; }
      if (!inUl) { out.push('<ul class="ia-md-ul">'); inUl = true; }
      out.push('<li>' + inlineFmt(ul[1]) + '</li>');
      i++;
      continue;
    }

    // lista ordenada
    var ol = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
    if (ol) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (!inOl) { out.push('<ol class="ia-md-ol">'); inOl = true; }
      out.push('<li>' + inlineFmt(ol[2]) + '</li>');
      i++;
      continue;
    }

    // linha vazia
    if (!line.trim()) {
      closeLists();
      out.push('<div class="ia-md-gap"></div>');
      i++;
      continue;
    }

    // parágrafo
    closeLists();
    out.push('<p class="ia-md-p">' + inlineFmt(line) + '</p>');
    i++;
  }
  closeLists();
  if (inCode && codeBuf.length) {
    out.push('<pre class="ia-md-pre"><code>' + codeBuf.join('\n') + '</code></pre>');
  }
  return out.join('');
}

/** Texto limpo para clipboard (sem **, | de markdown cru). */
function textoPlanoRespostaIA(texto) {
  if (texto == null) return '';
  var s = String(texto).replace(/\r\n/g, '\n');
  // remover formatação markdown comum
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/__([^_]+)__/g, '$1');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2');
  s = s.replace(/^#{1,3}\s+/gm, '');
  s = s.replace(/`([^`]+)`/g, '$1');
  s = s.replace(/^```[\w]*\n?/gm, '').replace(/^```$/gm, '');
  // tabelas → linhas tab-separadas legíveis
  s = s.split('\n').map(function (line) {
    if (line.indexOf('|') === -1) return line;
    if (/^\s*\|?[\s:|-]+\|/.test(line)) return ''; // separador
    return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) {
      return c.trim();
    }).filter(Boolean).join('\t');
  }).join('\n');
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

function _bpIaSvg(name) {
  var s = {
    copy: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    share: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
    up: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>',
    down: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>',
    regen: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>'
  };
  return s[name] || '';
}

/** Follow-ups contextuais — tom de assistente de salão (não robótico). */
var _bpIaRecentFollowups = [];
(function _bpIaLoadRecentFollowups() {
  try {
    var raw = sessionStorage.getItem('bp_ia_recent_followups');
    var arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr)) _bpIaRecentFollowups = arr.filter(function (x) { return typeof x === 'string'; }).slice(-36);
  } catch (_) { _bpIaRecentFollowups = []; }
})();
function _bpIaRememberFollowups(items) {
  try {
    (items || []).forEach(function (it) {
      var k1 = typeof _bpIaNormFollowKey === 'function' ? _bpIaNormFollowKey(it && it.label) : String((it && it.label) || '').toLowerCase();
      var k2 = typeof _bpIaNormFollowKey === 'function' ? _bpIaNormFollowKey(it && it.pergunta) : String((it && it.pergunta) || '').toLowerCase();
      [k1, k2].forEach(function (k) {
        if (!k || k.length < 6) return;
        if (_bpIaRecentFollowups.indexOf(k) === -1) _bpIaRecentFollowups.push(k);
      });
    });
    if (_bpIaRecentFollowups.length > 36) _bpIaRecentFollowups = _bpIaRecentFollowups.slice(-36);
    try { sessionStorage.setItem('bp_ia_recent_followups', JSON.stringify(_bpIaRecentFollowups)); } catch (_) {}
  } catch (_) {}
}
function _bpIaNormFollowKey(s) {
  var t = String(s || '').toLowerCase();
  try {
    if (typeof t.normalize === 'function') t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch (_) {}
  return t.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 96);
}
function _bpIaTokenOverlap(a, b) {
  var ta = _bpIaNormFollowKey(a).split(' ').filter(function (t) { return t.length > 3; });
  var tb = _bpIaNormFollowKey(b).split(' ').filter(function (t) { return t.length > 3; });
  if (ta.length < 2 || tb.length < 2) return 0;
  var set = {};
  for (var i = 0; i < tb.length; i++) set[tb[i]] = 1;
  var hit = 0;
  for (var j = 0; j < ta.length; j++) if (set[ta[j]]) hit++;
  return hit / Math.max(ta.length, tb.length);
}
function _bpIaIsRecentFollowup(label, perguntaFull) {
  var a = _bpIaNormFollowKey(label);
  var b = _bpIaNormFollowKey(perguntaFull);
  /* só compara com as 12 mais recentes — evita bloqueio excessivo */
  var recent = _bpIaRecentFollowups.slice(-12);
  for (var i = 0; i < recent.length; i++) {
    var r = recent[i];
    if (!r || r.length < 8) continue;
    if (a && a === r) return true;
    if (b && b === r) return true;
    /* substring só se ambos longos e um contém o outro quase por completo */
    if (a && a.length > 20 && r.length > 20 && (a.indexOf(r) !== -1 || r.indexOf(a) !== -1)) return true;
    if (b && b.length > 20 && r.length > 20 && (b.indexOf(r) !== -1 || r.indexOf(b) !== -1)) return true;
    if (a && _bpIaTokenOverlap(a, r) >= 0.72) return true;
    if (b && _bpIaTokenOverlap(b, r) >= 0.72) return true;
  }
  return false;
}
function _bpIaIsFollowupEligible(metaFonte, resposta) {
  var f = String(metaFonte || '').toLowerCase().trim();
  if (f === 'error' || f === 'offline' || f === 'local') return false;
  var r = String(resposta || '').trim();
  if (!r || r.length < 8) return false;
  if (/resposta interrompida/i.test(r)) return false;
  if (/agente ia indispon/i.test(r)) return false;
  if (/temporariamente indispon/i.test(r)) return false;
  if (/n[aã]o consegui concluir/i.test(r)) return false;
  if (/precisa de liga[cç][aã]o para processar/i.test(r)) return false;
  if (/^sem rede\b/i.test(r)) return false;
  if (/falha de rede|erro de rede|network error/i.test(r)) return false;
  return true;
}

/** Normaliza item V2/V1 → {label, pergunta} ou null. */
function _bpIaNormFollowItem(item) {
  if (item == null) return null;
  var label = '';
  var pergunta = '';
  if (typeof item === 'string') {
    label = item.trim();
    pergunta = item.trim();
  } else if (typeof item === 'object') {
    label = String(item.label || item.text || item.pergunta || '').trim();
    pergunta = String(item.pergunta || item.prompt || item.label || item.text || '').trim();
  }
  if (!label || !pergunta) return null;
  if (label.length > 72) label = label.slice(0, 69) + '…';
  if (pergunta.length > 240) pergunta = pergunta.slice(0, 237) + '…';
  /* banir genéricos legados */
  var low = label.toLowerCase();
  if (/resumo em 3 pontos|pr[oó]ximo passo concreto|^pr[oó]ximo passo$|^aprofunda\b|^detalha\b/i.test(low)) {
    return null;
  }
  return { label: label, pergunta: pergunta };
}

function _bpIaFollowupQualityOk(item, pergunta, resposta, used) {
  if (!item || !item.label || !item.pergunta) return false;
  var lab = item.label.toLowerCase();
  var per = item.pergunta.toLowerCase();
  var q = String(pergunta || '').toLowerCase();
  var r = String(resposta || '').toLowerCase();
  if (lab.length < 8 || per.length < 12) return false;
  if (q && (lab === q || per === q)) return false;
  if (_bpIaIsRecentFollowup(item.label, item.pergunta)) return false;
  for (var i = 0; i < used.length; i++) {
    if (used[i].label === item.label || used[i].pergunta === item.pergunta) return false;
    if (typeof _bpIaTokenOverlap === 'function' && _bpIaTokenOverlap(used[i].label, item.label) >= 0.72) return false;
  }
  /* genéricos */
  if (/resumo em 3|pr[oó]ximo passo|aprofunda este ponto|detalha o primeiro/i.test(lab)) return false;
  return true;
}

/**
 * V1 — Follow-up Engine local (determinístico, modular).
 * Hierarquia: explícito → consequência → lacuna → tensão → negócio → aprofundamento → heurística residual.
 * 0 chips é válido. Sem fallback genérico.
 */
function _bpIaFollowupsV1(pergunta, resposta) {
  var qRaw = String(pergunta || '').trim();
  var rRaw = String(resposta || '').trim();
  var q = qRaw.toLowerCase();
  var r = rRaw.toLowerCase();
  var ctx = q + ' ' + r;
  var candidates = [];

  function pushCand(label, perguntaFull, tier) {
    candidates.push({ label: label, pergunta: perguntaFull, tier: tier || 9 });
  }

  /* --- 1) Continuação explícita (perguntas / CTAs na resposta) --- */
  var lines = rRaw.split(/[\n\r]+/);
  for (var li = 0; li < lines.length; li++) {
    var line = lines[li].replace(/^\s*[-*•\d.)]+\s*/, '').trim();
    if (line.length < 12 || line.length > 120) continue;
    if (/\?\s*$/.test(line) || /^(como|quais|quero|vamos|posso|devemos|suger)/i.test(line)) {
      var lab = line.replace(/\?+$/, '?');
      pushCand(lab, lab, 1);
    }
  }

  /* --- Sinais estruturais (relações / tensões / lacunas) --- */
  var hasFat = /fatur|receita|vendas?\b|ticket/.test(ctx);
  var hasCaixa = /caixa|liquidez|dispon[ií]vel|saldo/.test(ctx);
  var hasDesp = /despes/.test(ctx);
  var hasPend = /pendente|a receber|por receber|divida|dívida/.test(ctx);
  var hasCli = /cliente/.test(ctx);
  var hasAgenda = /agenda|marca[cç]|\bhor[aá]rio/.test(ctx);
  var hasProf = /profissional|equipa|comiss/.test(ctx);
  var hasServ = /servi[cç]o/.test(ctx);
  var up = /aument|subiu|cresc|maior|subida|\+\s*\d|%\s*a mais/.test(ctx);
  var down = /diminu|caiu|queda|reduz|menor|descida|press[aã]o/.test(ctx);
  var pct = /\d+\s*%/.test(ctx) || /percent/.test(ctx);

  /* --- 4) Contradição / tensão entre métricas --- */
  if ((hasFat || /vendas?/.test(ctx)) && hasCaixa && up && down) {
    pushCand('O que pressiona o caixa?', 'O que está a pressionar mais o caixa apesar do movimento de vendas?', 4);
  }
  if (hasFat && /ticket/.test(ctx) && up && down) {
    pushCand('Porquê o ticket médio?', 'O que explicou a variação do ticket médio neste período?', 4);
  }
  if (hasCli && hasFat && up && down) {
    pushCand('Volume ou valor?', 'O crescimento veio mais de volume de clientes ou de valor por venda?', 4);
  }

  /* --- 3) Lacunas (pergunta pede X e resposta não aprofunda) --- */
  if (/porqu|motivo|raz[aã]o|como\b/.test(q) && rRaw.length < 280 && !/\?/.test(rRaw)) {
    pushCand('Explica a causa', 'Explica a principal causa com base nos dados do salão.', 3);
  }
  if (/quanto|qual o valor|faturei|faturamento/.test(q) && hasFat && !hasServ) {
    /* só se a resposta for substancial e não desdobrar serviços — respostas mínimas → 0 chips */
    if (rRaw.length > 160 && /fatur|kz|kwanza|\d/.test(r) && !/servi[cç]o/.test(r)) {
      pushCand('Que serviços puxaram isto?', 'Quais serviços mais contribuíram para este faturamento?', 3);
    }
  }

  /* --- 2) Consequência lógica --- */
  if (hasPend && (hasFat || hasCaixa)) {
    pushCand('Quanto está pendente?', 'Quanto das vendas ou do movimento ainda está pendente de entrada no caixa?', 2);
  }
  if (hasDesp && (hasCaixa || down)) {
    pushCand('Quais despesas pesaram?', 'Quais despesas mais contribuíram para este resultado?', 2);
  }
  if (hasProf && hasFat) {
    pushCand('Concentração na equipa', 'Quanto do faturamento está concentrado em poucos profissionais?', 2);
  }
  if (hasCli && /inativ|inactiv|n[aã]o volt|antigos|quietos|ausente/.test(ctx)) {
    pushCand('Quem contactar primeiro?', 'Quais clientes devo priorizar no contacto e porquê?', 2);
  }
  if (hasAgenda) {
    pushCand('Agenda dos próximos dias', 'Como está a agenda dos próximos dias e onde há buracos ou risco?', 2);
  }

  /* --- 5) Próxima análise de negócio (só com sinal claro) --- */
  if (hasFat && pct && (up || down)) {
    pushCand('Comparar com o período anterior', 'Compara este resultado com o período anterior e destaca o que mudou.', 5);
  }
  if (hasServ && hasFat) {
    pushCand('Serviços em destaque', 'Quais serviços mais e menos contribuíram neste período?', 5);
  }

  /* --- 6) Aprofundamento contextual (máx. 1 mais tarde) --- */
  if (qRaw && rRaw.length > 120 && /com base|recomend|suger|conv[eé]m|deve/.test(r)) {
    pushCand('Torna isto operacional', 'Transforma a recomendação num plano concreto para os próximos 7 dias.', 6);
  }

  /* --- 7) Heurística residual mínima (sem genéricos; só se ainda vazio e sinais fortes) --- */
  /* (preenchido na selecção se candidates filtrados ficarem vazios E houver tensão clara — já coberta acima) */

  /* Ordenar por tier e selecionar com qualidade */
  candidates.sort(function (a, b) { return (a.tier || 9) - (b.tier || 9); });
  var out = [];
  var depthUsed = 0;
  for (var i = 0; i < candidates.length && out.length < 3; i++) {
    var c = candidates[i];
    if (c.tier === 6) {
      if (depthUsed >= 1) continue;
      depthUsed++;
    }
    var item = _bpIaNormFollowItem(c);
    if (!item) continue;
    if (!_bpIaFollowupQualityOk(item, qRaw, rRaw, out)) continue;
    out.push(item);
  }
  return out;
}

/**
 * Resolve follow-ups: gate → V2 (se campo presente) → V1.
 * Se V2 enviar [] → não corre V1.
 */
function _bpIaResolveFollowups(pergunta, resposta, metaFonte, meta) {
  meta = meta || (typeof window !== 'undefined' ? window.__bpIaLastMeta : null) || {};
  if (!_bpIaIsFollowupEligible(metaFonte != null ? metaFonte : meta.fonte, resposta)) {
    return [];
  }
  if (Object.prototype.hasOwnProperty.call(meta, 'followups')) {
    var raw = meta.followups;
    if (!Array.isArray(raw)) return [];
    var v2 = [];
    for (var i = 0; i < raw.length && v2.length < 3; i++) {
      var it = _bpIaNormFollowItem(raw[i]);
      if (!it) continue;
      if (!_bpIaFollowupQualityOk(it, pergunta, resposta, v2)) continue;
      v2.push(it);
    }
    /* V2 presente (mesmo []) → não executar V1 */
    if (typeof _bpIaRememberFollowups === 'function') _bpIaRememberFollowups(v2);
    return v2;
  }
  var v1 = _bpIaFollowupsV1(pergunta, resposta);
  if (typeof _bpIaRememberFollowups === 'function') _bpIaRememberFollowups(v1);
  return v1;
}

/** API estável usada pelo render — V1 local + gate + encaixe V2. */
function gerarFollowupsEstrategicosIA(pergunta, resposta) {
  var meta = (typeof window !== 'undefined' ? window.__bpIaLastMeta : null) || {};
  return _bpIaResolveFollowups(pergunta, resposta, meta.fonte, meta);
}


/** Fases de thinking + streaming progressivo (UX estilo Grok / ChatGPT). */
var _bpIaStreamAbort = null;
function _bpIaSvgBulb() {
  return '<svg class="ia-think-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>';
}
function _bpIaSvgSpark() {
  return '<svg class="ia-think-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="M5.6 5.6l2.1 2.1"/><path d="M16.3 16.3l2.1 2.1"/><path d="M5.6 18.4l2.1-2.1"/><path d="M16.3 7.7l2.1-2.1"/></svg>';
}
function _bpIaSetThinkingPhase(el, phase) {
  if (!el) return;
  var map = {
    1: { phase: 'analyzing', label: 'A analisar a sua pergunta' },
    2: { phase: 'processing', label: 'A preparar uma resposta' },
    3: { phase: 'preparing', label: 'A organizar a resposta' },
    4: { phase: 'responding', label: 'A responder…' }
  };
  var m = map[phase] || map[1];
  BP_IA_GEN.phase = m.phase;
  el.innerHTML =
    '<div class="ia-think-row">' +
    '<span class="ia-think-spin" aria-hidden="true"></span>' +
    '<span class="ia-think-label">' + m.label + '</span></div>';
}
function _bpIaSleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}
/** Stream com markdown progressivo + scroll livre (o dedo manda). */
var _bpIaScrollProgrammatic = false;
var _bpIaStreamUserPinned = false;
var _bpIaStreamingActive = false;

var BP_IA_SCROLL = {
  SHOW_DISTANCE_PX: 24,
  OVERFLOW_SLACK_PX: 8,
  NEAR_BOTTOM_PX: 56,
  STREAM_PIN_PX: 64
};

function _bpIaGetChatScroller() {
  /* O overflow real está no shell (#ia-chat-container), não em #ia-chat (overflow: visible). */
  return document.getElementById('ia-chat-container') ||
    document.querySelector('#tab-ia .ia-chat-shell') ||
    document.getElementById('ia-chat');
}
function _bpIaChatNearBottom(scroller, threshold) {
  var el = scroller || _bpIaGetChatScroller();
  if (!el) return true;
  var distance = el.scrollHeight - el.scrollTop - el.clientHeight;
  return distance <= (threshold != null ? threshold : 56);
}

async function _bpIaStreamInto(elCorpo, textoPlano, opts) {
  opts = opts || {};
  var reduced = false;
  try {
    reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_) {}
  var chat = document.getElementById('ia-chat');
  var scroller = _bpIaGetChatScroller();
  _bpIaStreamUserPinned = false;
  _bpIaStreamingActive = true;
  function onUserScroll() {
    /* Ignorar scroll programático — senão “trava a meio” e deixa de seguir a mensagem */
    if (_bpIaScrollProgrammatic) return;
    _bpIaStreamUserPinned = !_bpIaChatNearBottom(scroller, 64);
  }
  if (chat) chat.classList.add('ia-streaming');
  if (scroller) scroller.addEventListener('scroll', onUserScroll, { passive: true });
  try {
    if (reduced || !textoPlano) {
      elCorpo.innerHTML = typeof formatarRespostaIA === 'function' ? formatarRespostaIA(textoPlano) : String(textoPlano || '');
      elCorpo.setAttribute('data-plain', textoPlano || '');
      return;
    }
    /* Resposta já completa (edge devolve corpo inteiro) — SEM typewriter artificial.
       Revelação suave via CSS; se aborted a meio, mostra o que houver. */
    if (_bpIaStreamAbort) {
      elCorpo.innerHTML = typeof formatarRespostaIA === 'function' ? formatarRespostaIA(textoPlano) : String(textoPlano || '');
      elCorpo.setAttribute('data-plain', textoPlano || '');
      return;
    }
    elCorpo.classList.add('ia-msg-reveal');
    elCorpo.innerHTML = typeof formatarRespostaIA === 'function' ? formatarRespostaIA(textoPlano) : String(textoPlano || '');
    elCorpo.setAttribute('data-plain', textoPlano || '');
    if (!_bpIaStreamUserPinned) {
      try {
        var _sc = _bpIaGetChatScroller();
        if (_sc) _sc.scrollTop = _sc.scrollHeight;
        var _blk = elCorpo && elCorpo.closest ? elCorpo.closest('.ia-msg-block') : null;
        if (typeof _bpIaEnsureVisible === 'function') _bpIaEnsureVisible(_blk || elCorpo);
      } catch (_) {}
    }
    /* micro-pausa só para a animação CSS (~280ms), sem atrasar respostas rápidas */
    await _bpIaSleep(reduced ? 0 : 280);
    if (!_bpIaStreamUserPinned) {
      try {
        var _sc2 = _bpIaGetChatScroller();
        if (_sc2) _sc2.scrollTop = _sc2.scrollHeight;
        if (typeof _bpIaEnsureVisible === 'function') {
          var _blk2 = elCorpo && elCorpo.closest ? elCorpo.closest('.ia-msg-block') : null;
          _bpIaEnsureVisible(_blk2 || elCorpo);
        }
      } catch (_) {}
    }
  } finally {
    _bpIaStreamingActive = false;
    if (chat) {
      chat.classList.remove('ia-streaming');
      if (scroller) scroller.removeEventListener('scroll', onUserScroll);
    }
  }
}

function bpIaStopGeneration() {
  /* exposto: window.bpIaStopGeneration */
  _bpIaStreamAbort = true;
  try {
    if (window.__bpIaFetchAbort && typeof window.__bpIaFetchAbort.abort === 'function') {
      window.__bpIaFetchAbort.abort();
    }
  } catch (_) {}
  try {
    var btn = document.getElementById('ia-enviar');
    if (btn) {
      btn.classList.remove('is-sending');
      btn.classList.add('is-idle');
      btn.setAttribute('aria-label', 'Enviar');
    }
    /* sem botão parar */
  } catch (_) {}
  try {
    if (typeof _bpIaSetHeaderStatus === 'function') _bpIaSetHeaderStatus('ok', 'Ligado');
    if (typeof _bpIaSetComposerStatus === 'function') _bpIaSetComposerStatus((window.BP_IA && window.BP_IA.STATUS && window.BP_IA.STATUS.READY) || 'IA pronta');
  } catch (_) {}
}


function _bpIaEnsureScrollBtn() {
  var shell = _bpIaGetChatScroller();
  if (!shell) return null;

  /* Contrato: #ia-chat-viewport no HTML. JS só cria se faltar (legado). Nunca aninhar. */
  var viewport = document.getElementById('ia-chat-viewport');
  if (!viewport) {
    viewport = shell.closest && shell.closest('.ia-chat-viewport');
  }
  if (!viewport || !viewport.classList.contains('ia-chat-viewport')) {
    if (shell.parentElement && shell.parentElement.classList.contains('ia-chat-viewport')) {
      viewport = shell.parentElement;
    } else {
      viewport = document.createElement('div');
      viewport.className = 'ia-chat-viewport';
      viewport.id = 'ia-chat-viewport';
      if (shell.parentNode) {
        shell.parentNode.insertBefore(viewport, shell);
        viewport.appendChild(shell);
      }
    }
  } else if (shell.parentElement !== viewport) {
    /* shell deve viver dentro do viewport; não criar segundo wrapper */
    try { viewport.appendChild(shell); } catch (_) {}
  }

  var btn = document.getElementById('ia-scroll-latest');
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'ia-scroll-latest';
    btn.className = 'ia-scroll-latest';
    btn.setAttribute('aria-label', 'Ir para a última mensagem');
    btn.title = 'Última mensagem';
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>';
    btn.hidden = true;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      _bpIaScrollToLatest(true);
    });
  }
  if (btn.parentElement !== viewport) {
    viewport.appendChild(btn);
  }

  if (!shell.dataset.bpScrollBound) {
    shell.dataset.bpScrollBound = '1';
    var _raf = 0;
    shell.addEventListener('scroll', function () {
      if (_raf) return;
      _raf = requestAnimationFrame(function () {
        _raf = 0;
        _bpIaUpdateScrollBtn();
      });
    }, { passive: true });
  }
  return btn;
}

function _bpIaScrollToLatest(smooth) {
  var shell = _bpIaGetChatScroller();
  if (!shell) return;
  try {
    if (typeof shell.scrollTo === 'function') {
      shell.scrollTo({ top: shell.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    } else {
      shell.scrollTop = shell.scrollHeight;
    }
  } catch (_) {
    try { shell.scrollTop = shell.scrollHeight; } catch (__) {}
  }
  setTimeout(_bpIaUpdateScrollBtn, smooth ? 360 : 40);
}

function _bpIaEnsureVisible(el) {
  /* Ir ao fundo do scroller de forma robusta (tabelas/layout tardio).
     Flag programática evita que o listener de stream marque pin a meio. */
  var shell = typeof _bpIaGetChatScroller === 'function' ? _bpIaGetChatScroller() : null;
  if (!shell) return;

  function applyBottom() {
    try {
      _bpIaScrollProgrammatic = true;
      var max = Math.max(0, shell.scrollHeight - shell.clientHeight);
      shell.scrollTop = max;
      if (shell.scrollHeight - shell.scrollTop - shell.clientHeight > 1) {
        shell.scrollTop = shell.scrollHeight;
      }
      if (el && el.getBoundingClientRect) {
        var er = el.getBoundingClientRect();
        var sr = shell.getBoundingClientRect();
        var gap = er.bottom - (sr.bottom - 12);
        if (gap > 1) shell.scrollTop += gap + 12;
      }
    } catch (_) {
    } finally {
      try {
        requestAnimationFrame(function () { _bpIaScrollProgrammatic = false; });
      } catch (__) {
        _bpIaScrollProgrammatic = false;
      }
    }
  }

  applyBottom();
  try {
    requestAnimationFrame(function () {
      applyBottom();
      requestAnimationFrame(function () {
        applyBottom();
        if (typeof _bpIaUpdateScrollBtn === 'function') _bpIaUpdateScrollBtn();
      });
    });
  } catch (_) {
    setTimeout(applyBottom, 40);
  }
  setTimeout(function () {
    applyBottom();
    if (typeof _bpIaUpdateScrollBtn === 'function') _bpIaUpdateScrollBtn();
  }, 120);
  setTimeout(function () {
    applyBottom();
    if (typeof _bpIaUpdateScrollBtn === 'function') _bpIaUpdateScrollBtn();
  }, 400);
}

function _bpIaUpdateScrollBtn() {
  var shell = _bpIaGetChatScroller();
  var btn = _bpIaEnsureScrollBtn();
  if (!shell || !btn) return;
  var cfg = typeof BP_IA_SCROLL !== 'undefined' ? BP_IA_SCROLL : { SHOW_DISTANCE_PX: 24, OVERFLOW_SLACK_PX: 8 };
  var distance = shell.scrollHeight - shell.scrollTop - shell.clientHeight;
  var hasOverflow = shell.scrollHeight > shell.clientHeight + (cfg.OVERFLOW_SLACK_PX || 8);
  var show = hasOverflow && distance > (cfg.SHOW_DISTANCE_PX || 24);
  btn.hidden = !show;
  btn.setAttribute('aria-hidden', show ? 'false' : 'true');
}

function montarMsgBotIA(resposta, ts, perguntaOrig, opts) {
  opts = opts || {};
  /* Acções + follow-ups apenas na última resposta (opts.toolbar / opts.followups) */
  var showToolbar = opts.toolbar === true;
  var fonte = opts.fonte || null;
  var tempo = formatarTempoRelativoIA(ts);
  var htmlCorpo = formatarRespostaIA(resposta);
  var planoAttr = escHtml(textoPlanoRespostaIA(resposta));
  var arrowSvg = '<svg class="ia-followup-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4v8c0 2.2 1.8 4 4 4h5"/><path d="M14 13l4 3-4 3"/></svg>';
  var chips = '';
  var follows = [];
  if (Array.isArray(opts.followups)) {
    follows = opts.followups;
  } else if (opts.followups === true) {
    var metaFu = opts.meta || (typeof window !== 'undefined' ? window.__bpIaLastMeta : null) || {};
    follows = _bpIaResolveFollowups(perguntaOrig || '', resposta, fonte || metaFu.fonte, metaFu);
  }
  if (follows && follows.length) {
    chips = follows.map(function (f) {
      return '<button type="button" class="ia-followup-chip" data-pergunta="' +
        escHtml(String(f.pergunta || '')) + '">' +
        arrowSvg + '<span class="ia-followup-label">' + escHtml(f.label) + '</span></button>';
    }).join('');
  }

  var pergAttr = escHtml(String(perguntaOrig || ''));
  var toolbarHtml = '';
  if (showToolbar) {
    toolbarHtml =
      '<div class="ia-msg-toolbar" role="group" aria-label="Acções da resposta">' +
        '<button type="button" class="ia-tool-btn ia-copiar-btn" title="Copiar" aria-label="Copiar">' + _bpIaSvg('copy') + '</button>' +
        '<button type="button" class="ia-tool-btn ia-partilhar-btn" title="Partilhar" aria-label="Partilhar">' + _bpIaSvg('share') + '</button>' +
        '<button type="button" class="ia-tool-btn ia-feedback-btn" data-fb="util" title="Gostei" aria-label="Gostei">' + _bpIaSvg('up') + '</button>' +
        '<button type="button" class="ia-tool-btn ia-feedback-btn" data-fb="naoajudou" title="Não gostei" aria-label="Não gostei">' + _bpIaSvg('down') + '</button>' +
        '<button type="button" class="ia-tool-btn ia-regen-btn" title="Gerar novamente" aria-label="Gerar novamente">' + _bpIaSvg('regen') + '</button>' +
      '</div>';
  }
  return (
    '<div class="ia-msg-block ia-msg-enter" data-pergunta="' + pergAttr + '">' +
      '<div class="ia-msg-bot">' +
        '<div class="ia-msg-bot-header">' + (function () {
          var _nm = (typeof getNomeIA === 'function' ? String(getNomeIA()) : 'Benza');
          var _p = _nm.split(/\s*[·•|]\s*/);
          if (_p.length >= 2) {
            return '<span class="ia-msg-bot-nome">' + escHtml(_p[0].trim()) + '</span>' +
              '<span class="ia-msg-bot-role"> · ' + escHtml(_p.slice(1).join(' · ').trim()) + '</span>';
          }
          return '<span class="ia-msg-bot-nome">' + escHtml(_nm) + '</span>';
        })() +
          (tempo ? '<span class="ia-msg-bot-tempo">' + tempo + '</span>' : '') +
          (fonte === 'local' ? '<span class="ia-msg-bot-fonte" title="Calculado com dados locais do salão">Local</span>' : '') +
        '</div>' +
        '<div class="ia-msg-bot-corpo" data-plain="' + planoAttr + '">' + htmlCorpo + '</div>' +
      '</div>' +
      toolbarHtml +
      (chips ? '<div class="ia-followup-row">' + chips + '</div>' : '') +
    '</div>'
  );
}

/** Remove toolbar e follow-ups de mensagens anteriores (só a última deve tê-los). */
function _bpIaStripNonLastActions(chatEl) {
  if (!chatEl) return;
  var blocks = chatEl.querySelectorAll('.ia-msg-block');
  for (var i = 0; i < blocks.length; i++) {
    var tb = blocks[i].querySelector('.ia-msg-toolbar');
    if (tb) tb.remove();
    var fr = blocks[i].querySelector('.ia-followup-row');
    if (fr) fr.remove();
  }
}

function atualizarEstadoVazioIA() {
  const vazio = document.getElementById('ia-chat-empty');
  const chat = document.getElementById('ia-chat');
  const shell = document.getElementById('ia-chat-container');
  if (shell && chat) {
    shell.classList.toggle('has-messages', chat.children.length > 0);
  }
  if (vazio && chat) vazio.style.display = chat.children.length > 0 ? 'none' : '';
}
const IA_HIST_KEY = function () {
  var sid = (state && state.config && state.config.salaoId) ? state.config.salaoId : 'local';
  return 'bp_ia_chat_' + sid;
};
const IA_HIST_MAX = 40;

function _bpIaNormalizeHist(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(function (t) {
    return t && (t.pergunta || t.resposta);
  }).slice(-IA_HIST_MAX);
}

function _bpIaRenderHistNoChat(list) {
  var chat = document.getElementById('ia-chat');
  if (!chat) return;
  var guardado = _bpIaNormalizeHist(list);
  if (!guardado.length) {
    chat.innerHTML = '';
    atualizarEstadoVazioIA();
    return;
  }
  chat.innerHTML = guardado.map(function (item, idx) {
    var last = idx === guardado.length - 1;
    return montarMsgUsuarioIA(item.pergunta) +
      montarMsgBotIA(item.resposta, item.ts, item.pergunta, { followups: last, toolbar: last, fonte: item.fonte || null });
  }).join('');
  chat.scrollTop = chat.scrollHeight;
  atualizarEstadoVazioIA();
  try { _bpIaEnsureScrollBtn(); _bpIaUpdateScrollBtn(); } catch (_) {}
}

function carregarHistoricoIA() {
  try {
    var fromLs = [];
    try { fromLs = JSON.parse(localStorage.getItem(IA_HIST_KEY()) || '[]'); } catch (e1) { fromLs = []; }
    iaHistorico = _bpIaNormalizeHist(fromLs);
    _bpIaRenderHistNoChat(iaHistorico);
  } catch (e) {
    iaHistorico = [];
  }
  /* IndexedDB (sobrevive a limpezas parciais / reabre com dados locais) */
  if (typeof dbGetAll === 'function') {
    Promise.resolve(dbGetAll('config')).then(function (rows) {
      try {
        var sidH = (state && state.config && state.config.salaoId) ? state.config.salaoId : 'local';
        var histId = 'ia_chat_hist_' + sidH;
        var row = (rows || []).find(function (c) {
          return c && (c.id === histId || c.key === histId ||
            ((c.id === 'ia_chat_hist' || c.key === 'ia_chat_hist') && (!c.salao_id || c.salao_id === sidH)));
        });
        var fromDb = row && row.value != null ? row.value : null;
        if (typeof fromDb === 'string') {
          try { fromDb = JSON.parse(fromDb); } catch (e2) { fromDb = null; }
        }
        fromDb = _bpIaNormalizeHist(fromDb);
        if (fromDb.length >= iaHistorico.length) {
          iaHistorico = fromDb;
          try { localStorage.setItem(IA_HIST_KEY(), JSON.stringify(iaHistorico)); } catch (e3) {}
          _bpIaRenderHistNoChat(iaHistorico);
        } else if (iaHistorico.length) {
          /* LS mais completo → gravar no IDB */
          guardarHistoricoIA();
        }
      } catch (e4) {}
    }).catch(function () {});
  }
}

function guardarHistoricoIA() {
  try {
    iaHistorico = _bpIaNormalizeHist(iaHistorico);
    localStorage.setItem(IA_HIST_KEY(), JSON.stringify(iaHistorico));
  } catch (e) {}
  try {
    if (typeof dbPut === 'function') {
      var sid = (state && state.config && state.config.salaoId) ? state.config.salaoId : 'local';
      var payload = {
        id: 'ia_chat_hist_' + sid,
        key: 'ia_chat_hist_' + sid,
        value: iaHistorico,
        updated_at: new Date().toISOString(),
        salao_id: sid
      };
      Promise.resolve(dbPut('config', payload)).catch(function () {});
    }
  } catch (e5) {}
}

/* Carregar quando DOM e estado estiverem prontos */
function _bpIaBootHist() {
  carregarHistoricoIA();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { setTimeout(_bpIaBootHist, 80); });
} else {
  setTimeout(_bpIaBootHist, 80);
}
setTimeout(_bpIaBootHist, 1200);

function bpIaAutosizeInput() {
  var input = document.getElementById('ia-input');
  if (!input) return;
  var max = 120;
  input.style.height = 'auto';
  var h = Math.min(max, Math.max(36, input.scrollHeight || 36));
  input.style.height = h + 'px';
  input.style.overflowY = (input.scrollHeight > max) ? 'auto' : 'hidden';
}
function bpIaSyncSendState() {
  const input = document.getElementById('ia-input');
  const btn = document.getElementById('ia-enviar');
  if (!btn) return;
  const has = !!(input && input.value.trim());
  btn.classList.toggle('is-idle', !has);
  if (!has) btn.classList.remove('is-sending');
}
function bpIaBindExpand() {
  var btn = document.getElementById('ia-expand-btn');
  if (!btn || btn.dataset.bpBound === '1') return;
  btn.dataset.bpBound = '1';
  /* Garante 2/4 setas se o HTML só tiver um SVG */
  if (!btn.querySelector('.ia-expand-icon-out') || !btn.querySelector('.ia-expand-icon-in')) {
    btn.innerHTML =
      '<svg class="ia-expand-icon-out" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>' +
      '<svg class="ia-expand-icon-in" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H3v5"/><path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M16 21h5v-5"/><path d="M3 3l6 6"/><path d="M21 3l-6 6"/><path d="M3 21l6-6"/><path d="M21 21l-6-6"/></svg>';
  }
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    var tab = document.getElementById('tab-ia');
    var on = document.body.classList.toggle('ia-chat-focus');
    if (tab) tab.classList.toggle('ia-focus-mode', on);
    btn.classList.toggle('is-expanded', on);
    btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    btn.title = on ? 'Reduzir' : 'Ampliar';
    btn.setAttribute('aria-label', on ? 'Reduzir conversa' : 'Ampliar conversa');
    try {
      if (on) {
        setTimeout(function () {
          if (typeof _bpIaScrollToLatest === 'function') _bpIaScrollToLatest(false);
          else if (typeof _bpIaEnsureVisible === 'function') _bpIaEnsureVisible(null);
        }, 40);
      }
    } catch (_) {}
  });
}


function bpIaBindComposer() {
  const input = document.getElementById('ia-input');
  const btn = document.getElementById('ia-enviar');
  if (!input || input.dataset.bpIaBound === '1') return;
  input.dataset.bpIaBound = '1';
  input.addEventListener('input', function () {
    bpIaAutosizeInput();
    bpIaSyncSendState();
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (btn) btn.click();
    }
  });
  bpIaAutosizeInput();
  bpIaSyncSendState();
}

function _bpIaProporSeHouver(pergunta) {
  try {
    var _p = window.__bpIaLastMeta && window.__bpIaLastMeta.proposta;
    if (!_p && window.BP_IA_Loop && typeof BP_IA_Loop.detectarProposta === 'function') {
      _p = BP_IA_Loop.detectarProposta(pergunta);
    }
    if (_p && window.BP_IA_Loop) {
      BP_IA_Loop.propor(_p);
      try { if (window.__bpIaLastMeta) window.__bpIaLastMeta.proposta = null; } catch (_) {}
    }
  } catch (_) {}
}

document.getElementById('ia-enviar')?.addEventListener('click', async () => {
  const input = document.getElementById('ia-input');
  const btn = document.getElementById('ia-enviar');
  const chat = document.getElementById('ia-chat');
  if (!chat) return;

  /* STOP primeiro (mesmo com input vazio) — cancelamento ≠ erro */
  if (btn && btn.classList.contains('is-sending') && BP_IA_GEN.status === 'processing') {
    try { if (typeof bpIaStopGeneration === 'function') bpIaStopGeneration(); } catch (_) {}
    BP_IA_GEN.status = 'cancelled';
    _bpIaGenFinish('cancelled', null);
    try {
      var th = document.getElementById('ia-pensando');
      if (th) th.remove();
    } catch (_) {}
    try {
      chat.insertAdjacentHTML('beforeend', montarMsgBotIA('Resposta interrompida.', Date.now(), '', { followups: false, toolbar: false, fonte: 'local' }));
    } catch (_) {}
    if (btn) {
      btn.classList.remove('is-sending');
      btn.disabled = false;
      btn.setAttribute('aria-label', 'Enviar');
      btn.title = 'Enviar';
      try { bpIaSyncSendState(); } catch (_) {}
    }
    return;
  }

  const pergunta = (input && input.value || '').trim();
  if (!pergunta) return;
  /* _iaBusy é gerido só dentro de perguntarIA — não pré-bloquear aqui */
  if (_iaBusy) return;

  _bpIaNetRefresh();
  chat.innerHTML += montarMsgUsuarioIA(pergunta);
  atualizarEstadoVazioIA();
  try {
    var _lastUser = chat.querySelector('.ia-msg-user:last-of-type') || chat.lastElementChild;
    _bpIaEnsureVisible(_lastUser);
  } catch (_) {}
  window.__bpIaLastMeta = { fonte: null };
  if (input) {
    input.value = '';
    bpIaAutosizeInput();
  }

  /* OFFLINE imediato — sem fases de processamento */
  if (BP_IA_NET.state === 'offline' || !_bpIaIsOnline()) {
    _bpIaGenStart();
    BP_IA_GEN.status = 'offline';
    _bpIaGenFinish('offline', 'OFFLINE');
    try { _bpIaSetHeaderStatus('offline'); _bpIaSetComposerStatus((window.BP_IA && window.BP_IA.STATUS && window.BP_IA.STATUS.OFFLINE) || 'Sem rede'); } catch (_) {}
    try {
      chat.insertAdjacentHTML('beforeend', montarMsgBotIA(
        'Sem ligação à Internet. A Benza precisa de ligação para processar esta pergunta.',
        Date.now(), pergunta, { followups: false, toolbar: false, fonte: 'offline' }
      ));
      var _lb = chat.querySelector('.ia-msg-block:last-of-type') || chat.lastElementChild;
      if (typeof _bpIaEnsureVisible === 'function') _bpIaEnsureVisible(_lb);
    } catch (_) {}
    if (typeof toast === 'function') toast('Sem ligação à Internet', 'warning', { duration: 3200 });
    _bpIaGenResetIdle();
    return;
  }

  var genId = _bpIaGenStart();
  BP_IA_GEN.status = 'processing';
  if (btn) {
    btn.classList.remove('is-idle');
    btn.classList.add('is-sending');
    btn.disabled = false; /* 2º toque = Parar */
    btn.setAttribute('aria-label', 'Parar');
    btn.title = 'Parar';
  }
  _bpIaStreamAbort = false;
  /* NÃO definir _iaBusy aqui — perguntarIA define e liberta no finally */

  const pensando = document.createElement('div');
  pensando.className = 'ia-msg-bot ia-msg-thinking';
  pensando.id = 'ia-pensando';
  pensando.setAttribute('aria-live', 'polite');
  pensando.setAttribute('role', 'status');
  pensando.innerHTML = '<div class="ia-msg-bot-header"><span class="ia-msg-bot-nome">' + (typeof escHtml === 'function' ? escHtml(getNomeIA()) : getNomeIA()) + '</span></div><div class="ia-think-body"></div>';
  chat.appendChild(pensando);
  var thinkBody = pensando.querySelector('.ia-think-body');
  try { _bpIaSetThinkingPhase(thinkBody, 1); } catch (_) {}
  try { _bpIaEnsureVisible(pensando); } catch (_) { try { chat.scrollTop = chat.scrollHeight; } catch (__) {} }

  var phaseTimers = [];
  phaseTimers.push(setTimeout(function () {
    try {
      if (document.getElementById('ia-pensando') && _bpIaGenIsCurrent(genId) && BP_IA_GEN.status === 'processing') {
        _bpIaSetThinkingPhase(thinkBody, 2);
      }
    } catch (_) {}
  }, 600));
  phaseTimers.push(setTimeout(function () {
    try {
      if (document.getElementById('ia-pensando') && _bpIaGenIsCurrent(genId) && BP_IA_GEN.status === 'processing') {
        _bpIaSetThinkingPhase(thinkBody, 3);
      }
    } catch (_) {}
  }, 1600));

  let resposta = null;
  try {
    try { _bpIaSetComposerStatus('A processar…'); } catch (_) {}
    resposta = await perguntarIA(pergunta);
    if (!_bpIaGenIsCurrent(genId)) {
      return;
    }
    if (BP_IA_GEN.status === 'cancelled' || _bpIaStreamAbort) {
      _bpIaGenFinish('cancelled', null);
      return;
    }
    BP_IA_GEN.status = 'responding';
    BP_IA_GEN.phase = 'responding';
    try { if (thinkBody) _bpIaSetThinkingPhase(thinkBody, 4); } catch (_) {}
  } catch (eSend) {
    try { console.error('[Benza] enviar', eSend); } catch (_) {}
    resposta = null;
    try { _bpIaGenFinish('error', 'SEND'); } catch (_) {}
    try {
      if (typeof toast === 'function') toast('Erro ao obter resposta da IA. Tente de novo.', 'error');
    } catch (_) {}
  } finally {
    phaseTimers.forEach(function (t) { try { clearTimeout(t); } catch (_) {} });
    try { document.getElementById('ia-pensando') && document.getElementById('ia-pensando').remove(); } catch (_) {}
    if (btn) {
      btn.setAttribute('aria-label', 'Enviar');
      btn.title = 'Enviar';
      setTimeout(function () {
        btn.classList.remove('is-sending');
        try { bpIaSyncSendState(); } catch (_) {}
      }, 120);
    }
  }
  try { document.getElementById('ia-pensando') && document.getElementById('ia-pensando').remove(); } catch (_) {}

  var metaFonte = (window.__bpIaLastMeta && window.__bpIaLastMeta.fonte) || null;
    try {
      if (metaFonte === 'error') _bpIaGenFinish('error', 'API');
      else if (metaFonte === 'offline') _bpIaGenFinish('offline', 'OFFLINE');
      else _bpIaGenFinish('complete', null);
      BP_IA_GEN.text = String(resposta || '');
    } catch (_) {}


  if (resposta) {
    const ts = Date.now();
    try { _bpIaStripNonLastActions(chat); } catch (_) {}
    var isLocal = metaFonte === 'local';
    try {
      if (isLocal) {
        /* Legado desactivado: não há motor local — mostrar texto e estado de rede */
        chat.insertAdjacentHTML('beforeend', montarMsgBotIA(resposta, ts, pergunta, {
          followups: false, toolbar: true, fonte: 'error'
        }));
        try {
          if (_bpIaIsOnline()) { _bpIaSetHeaderStatus('ok'); _bpIaSetComposerStatus((window.BP_IA && window.BP_IA.STATUS && window.BP_IA.STATUS.READY) || 'IA pronta'); }
          else { _bpIaSetHeaderStatus('offline'); _bpIaSetComposerStatus((window.BP_IA && window.BP_IA.STATUS && window.BP_IA.STATUS.OFFLINE) || 'Sem rede'); }
        } catch (_) {}
      } else {
        var blockHtml = montarMsgBotIA(resposta, ts, pergunta, { followups: false, toolbar: false, fonte: metaFonte });
        chat.insertAdjacentHTML('beforeend', blockHtml);
        var blocks = chat.querySelectorAll('.ia-msg-block');
        var lastBlock = blocks.length ? blocks[blocks.length - 1] : null;
        var corpo = lastBlock && lastBlock.querySelector('.ia-msg-bot-corpo');
        if (corpo) {
          var plano = corpo.getAttribute('data-plain') || String(resposta);
          try {
            await _bpIaStreamInto(corpo, plano, {});
          } catch (streamErr) {
            try {
              corpo.innerHTML = typeof formatarRespostaIA === 'function' ? formatarRespostaIA(plano) : plano;
              corpo.setAttribute('data-plain', plano);
            } catch (_) {}
          }
        }
        if (lastBlock && lastBlock.parentNode) {
          var full = montarMsgBotIA(resposta, ts, pergunta, { followups: true, toolbar: true, fonte: metaFonte });
          var tmp = document.createElement('div');
          tmp.innerHTML = full;
          var rich = tmp.firstElementChild;
          if (rich) lastBlock.parentNode.replaceChild(rich, lastBlock);
        }
        try {
          if (metaFonte === 'error') _bpIaSetHeaderStatus('error');
          else if (_bpIaIsOnline()) { _bpIaSetHeaderStatus('ok'); _bpIaSetComposerStatus((window.BP_IA && window.BP_IA.STATUS && window.BP_IA.STATUS.READY) || 'IA pronta'); }
          else { _bpIaSetHeaderStatus('offline'); _bpIaSetComposerStatus((window.BP_IA && window.BP_IA.STATUS && window.BP_IA.STATUS.OFFLINE) || 'Sem rede'); }
        } catch (_) {}
      }
    } catch (renderErr) {
      try {
        chat.insertAdjacentHTML('beforeend', montarMsgBotIA(resposta, ts, pergunta, {
          followups: false, toolbar: true, fonte: metaFonte
        }));
      } catch (_) {}
    }
    try {
      var _lastBot = chat.querySelector('.ia-msg-block:last-of-type') || chat.lastElementChild;
      if (typeof _bpIaEnsureVisible === 'function') _bpIaEnsureVisible(_lastBot);
      else {
        var _sh = typeof _bpIaGetChatScroller === 'function' ? _bpIaGetChatScroller() : chat;
        if (_sh) _sh.scrollTop = _sh.scrollHeight;
      }
      if (typeof _bpIaEnsureScrollBtn === 'function') _bpIaEnsureScrollBtn();
      if (typeof _bpIaUpdateScrollBtn === 'function') _bpIaUpdateScrollBtn();
    } catch (_) {}
    try {
      if (iaHistorico.length > 0) iaHistorico[iaHistorico.length - 1].ts = ts;
      guardarHistoricoIA();
    } catch (_) {}
    try { _bpIaProporSeHouver(pergunta); } catch (_) {}
    try {
      if (window.BP_IA_Relatorio && typeof BP_IA_Relatorio.anexarNaUltimaBolha === 'function') {
        BP_IA_Relatorio.anexarNaUltimaBolha(pergunta);
      }
    } catch (_) {}
  } else {
    try { atualizarIAOffline(); } catch (_) {}
    try { _bpIaProporSeHouver(pergunta); } catch (_) {}
  }
  actualizarContadorIA();
  bpIaSyncSendState();
});


function bpIaCollapseInsights() {
  var card = document.getElementById('ia-insights-card');
  var list = document.getElementById('ia-insights-list');
  var btn = document.getElementById('ia-insights-toggle');
  if (!card) return;
  card.classList.add('is-collapsed');
  if (list) {
    list.hidden = true;
    try { list.setAttribute('hidden', ''); } catch (_) {}
  }
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function bpIaBindInsightsToggle() {
  var btn = document.getElementById('ia-insights-toggle');
  var card = document.getElementById('ia-insights-card');
  var list = document.getElementById('ia-insights-list');
  if (!btn || btn._bpInsightsBound) return;
  btn._bpInsightsBound = true;
  /* iniciar colapsado se lista já hidden */
  if (list && list.hidden) {
    if (card) card.classList.add('is-collapsed');
    btn.setAttribute('aria-expanded', 'false');
  } else if (card && !card.classList.contains('is-collapsed')) {
    btn.setAttribute('aria-expanded', 'true');
  }
  btn.addEventListener('click', function (ev) {
    try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}
    if (!card) return;
    var open = card.classList.contains('is-collapsed');
    if (open) {
      card.classList.remove('is-collapsed');
      if (list) {
        list.hidden = false;
        try { list.removeAttribute('hidden'); } catch (_) {}
      }
      btn.setAttribute('aria-expanded', 'true');
    } else {
      bpIaCollapseInsights();
    }
  });
  /* Série 5: fechar ao rolar e o card sair do contexto / ao sair da aba IA */
  if (!window._bpIaInsightsLife) {
    window._bpIaInsightsLife = true;
    var onScroll = function () {
      if (!card || card.classList.contains('is-collapsed')) return;
      try {
        var r = card.getBoundingClientRect();
        /* saiu significativamente para cima ou para fora do viewport */
        if (r.bottom < 48 || r.top > window.innerHeight - 24) {
          bpIaCollapseInsights();
        }
      } catch (_) {}
    };
    window.addEventListener('scroll', onScroll, true);
    var tab = document.getElementById('tab-ia');
    if (tab && typeof MutationObserver !== 'undefined') {
      var mo = new MutationObserver(function () {
        try {
          var hidden = tab.hidden || tab.getAttribute('aria-hidden') === 'true' ||
            (tab.classList && (tab.classList.contains('hidden') || !tab.classList.contains('active') && tab.style.display === 'none'));
          if (tab.style.display === 'none' || tab.hidden) bpIaCollapseInsights();
        } catch (_) {}
      });
      mo.observe(tab, { attributes: true, attributeFilter: ['hidden', 'class', 'style', 'aria-hidden'] });
    }
    document.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest && ev.target.closest('[data-tab], .nav-item, .bottom-nav button, .bottom-nav a, nav.bottom-nav button');
      if (!t) return;
      var isIa = t.closest && (t.closest('#tab-ia') || (t.getAttribute && (t.getAttribute('data-tab') === 'ia' || /ia/i.test(t.textContent || ''))));
      /* se clicou noutro item de navegação que não é IA */
      if (t.closest('.bottom-nav, nav.bottom-nav, .nav-bottom')) {
        var label = (t.textContent || '') + (t.getAttribute('aria-label') || '') + (t.getAttribute('data-tab') || '');
        if (!/ia|agente|benza/i.test(label)) bpIaCollapseInsights();
      }
    }, true);
  }
}

bpIaBindComposer();
try { bpIaBindInsightsToggle(); } catch (_) {}

try { bpIaBindExpand(); } catch (_) {}
    try { bpIaBindInsightsToggle(); } catch (_) {}
/* F3.6-C: seguro se o script carregar depois de DOMContentLoaded (carga diferida) */
(function (_bpIaDomReady) {
  function _run() {
    bpIaBindComposer();
    try { bpIaBindExpand(); } catch (_) {}
    try { _bpIaEnsureScrollBtn(); } catch (_) {}
    try { actualizarContadorIA(); } catch (_) {}
    try { atualizarIAOffline(); } catch (_) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { _run(); });
  } else {
    _run();
  }
})();

// Sugestões rápidas e chips de continuação (delegação de eventos — cobre também os que são criados depois de cada resposta)
document.addEventListener('click', (e) => {
  const card = e.target.closest('.ia-sugestao-card, .ia-followup-chip');
  if (card && card.dataset.pergunta) {
    if (card.dataset.pergunta === '__bp_export_ics__') {
      try {
        if (window.BPOps && typeof window.BPOps.downloadIcs === 'function') {
          window.BPOps.downloadIcs();
          if (typeof toast === 'function') toast('Agenda exportada.', 'success');
        } else if (typeof toast === 'function') {
          toast('Exportação de calendário indisponível', 'warning');
        }
      } catch (err) {
        if (typeof toast === 'function') toast('Não foi possível exportar o calendário', 'error');
      }
      return;
    }
    const input = document.getElementById('ia-input');
    if (input) {
      input.value = card.dataset.pergunta;
      if (typeof bpIaAutosizeInput === 'function') bpIaAutosizeInput();
      if (typeof bpIaSyncSendState === 'function') bpIaSyncSendState();
      document.getElementById('ia-enviar').click();
    }
  }
  const tool = e.target.closest('.ia-tool-btn, .ia-feedback-btn');
  if (tool) {
    const block = tool.closest('.ia-msg-block') || tool.closest('.ia-msg-bot');
    const corpo = block && block.querySelector('.ia-msg-bot-corpo');
    const texto = (corpo && (corpo.getAttribute('data-plain') || corpo.innerText)) || '';
    if (tool.classList.contains('ia-copiar-btn')) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(function () {
          if (typeof toast === 'function') toast('Texto copiado.', 'success');
        }).catch(function () {
          if (typeof toast === 'function') toast('Não foi possível copiar', 'error');
        });
      } else if (typeof toast === 'function') {
        toast('Cópia não suportada neste dispositivo', 'warning');
      }
      return;
    }
    if (tool.classList.contains('ia-partilhar-btn')) {
      if (navigator.share) {
        navigator.share({ text: texto }).catch(function () {});
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(function () {
          if (typeof toast === 'function') toast('Texto copiado.', 'success');
        }).catch(function () {});
      }
      return;
    }
    if (tool.classList.contains('ia-regen-btn')) {
      var perg = (block && block.getAttribute('data-pergunta')) || '';
      if (!perg) {
        if (typeof toast === 'function') toast('Não foi possível repetir esta pergunta', 'warning');
        return;
      }
      /* Regenerar reenvia a pergunta (pode consumir cota se for à API). */
      var input = document.getElementById('ia-input');
      var send = document.getElementById('ia-enviar');
      if (input && send) {
        input.value = perg;
        if (typeof bpIaAutosizeInput === 'function') bpIaAutosizeInput();
        if (typeof bpIaSyncSendState === 'function') bpIaSyncSendState();
        send.click();
      }
      return;
    }
    if (tool.getAttribute('data-fb')) {
      var fb = tool.getAttribute('data-fb');
      try {
        var key = 'bp_ia_feedback';
        var list = [];
        try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) { list = []; }
        if (!Array.isArray(list)) list = [];
        var plain = '';
        try {
          var c = block && block.querySelector('.ia-msg-bot-corpo');
          plain = (c && (c.getAttribute('data-plain') || c.innerText)) || '';
        } catch (_) {}
        list.push({
          fb: fb,
          ts: Date.now(),
          pergunta: (block && block.getAttribute('data-pergunta')) || '',
          amostra: String(plain).slice(0, 240),
          salao: (state && state.config && state.config.salaoId) || 'local'
        });
        if (list.length > 80) list = list.slice(-80);
        localStorage.setItem(key, JSON.stringify(list));
      } catch (_) {}
      if (typeof toast === 'function') toast('Feedback guardado neste dispositivo', 'success');
      const bar = tool.parentElement;
      if (bar) {
        bar.querySelectorAll('[data-fb]').forEach(function (b) { b.disabled = true; b.classList.remove('is-on'); });
      }
      tool.classList.add('is-on');
      tool.disabled = true;
    }
  }
});

document.getElementById('ia-offline-retry')?.addEventListener('click', () => {
  if (navigator.onLine) { atualizarIAOffline();
    toast('Ligação restabelecida.', 'success'); } else { toast('Ainda sem ligação à internet.', 'warning'); }
});

// Upgrade modal — handler principal em plano-limites.js (bindUpgradeButtons / abrirWhatsAppVenda).
// Fallback se o bind ainda não correu (ordem de scripts / bundle).
(function ensureUpgradeContatoBound() {
  const contato = document.getElementById('modal-upgrade-contato');
  if (!contato || contato.dataset.bpUpgradeBound) return;
  contato.addEventListener('click', async () => {
    if (typeof abrirWhatsAppVenda === 'function') {
      const salao = (state && state.config && state.config.storeName) || '—';
      const actual = (typeof getPlanoAtual === 'function') ? getPlanoAtual() : '—';
      await abrirWhatsAppVenda(
        `Olá, quero assinar um plano do BeautyPro. Salão: ${salao} | Plano actual: ${actual}`
      );
    } else {
      const msg =
        `Olá, quero assinar um plano do BeautyPro. Salão: ${(state.config && state.config.storeName) || '—'} | Plano actual: ${typeof getPlanoAtual === 'function' ? getPlanoAtual() : '—'}`;
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
    }
    closeModal('modal-upgrade');
  });
  contato.dataset.bpUpgradeBound = '1';
})();

// Pesquisa clientes
let searchTimer;
document.getElementById('search-cliente').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => renderClientes(), 300);
});

// Onboarding
let onboardingIndex = 0;
const onboardingSlides = document.querySelectorAll('.onboarding-slide');
const onboardingDots = document.querySelectorAll('.onboarding-dot');
const nextBtn = document.getElementById('onboarding-next');
const skipBtn = document.getElementById('onboarding-skip');

function showOnboardingSlide(index) {
  onboardingSlides.forEach((s, i) => {
    s.classList.toggle('active', i === index);
    s.style.display = i === index ? 'flex' : 'none';
  });
  onboardingDots.forEach((d, i) => {
    if (i === index) { d.style.width = '24px';
      d.style.background = 'var(--gold)'; } else { d.style.width = '6px';
      d.style.background = 'var(--border-soft)'; }
  });
  if (index === 2) { nextBtn.textContent = 'Começar agora';
    nextBtn.className = 'btn btn-primary'; } else { nextBtn.textContent = 'Próximo'; }
}

function closeOnboarding() {
  document.getElementById('onboarding-screen').style.display = 'none';
  localStorage.setItem('bp_onboarding_seen', 'true');
}

if (nextBtn) {
  nextBtn.addEventListener('click', () => {
    if (onboardingIndex === 2) closeOnboarding();
    else { onboardingIndex++;
      showOnboardingSlide(onboardingIndex); }
  });
}
if (skipBtn) skipBtn.addEventListener('click', closeOnboarding);

/* F3.6-B: hideSplash / bpControlSplashOnBoot → boot/hide-splash.js
 * (carregado no index antes de auth e deste módulo). Não redefinir aqui. */



// Testes automatizados
function runTests() {
  console.log('🧪 Iniciando testes automatizados...');
  console.group('📦 Funções puras');
  console.assert(fmtKz(0) === '0 Kz', 'fmtKz(0)');
  console.assert(fmtKz(1000) === '1.000 Kz', 'fmtKz(1000)');
  console.assert(fmtKz(1234567) === '1.234.567 Kz', 'fmtKz(1234567)');
  console.assert(escHtml('<script>') === '&lt;script&gt;', 'escHtml');
  console.assert(escHtml('a & b') === 'a &amp; b', 'escHtml &');
  const id = uuid();
  console.assert(id.length > 10 && id.includes('-'), 'uuid');
  console.assert(/^\d{4}-\d{2}-\d{2}$/.test(hoje()), 'hoje');
  console.assert(/^\d{2}:\d{2}$/.test(horaAgora()), 'horaAgora');
  console.groupEnd();
  console.group('🧠 Lógica de negócio (mocks)');
  console.log('✅ Testes concluídos (mock)');
  console.groupEnd();
  console.log('✅ Todos os testes concluídos!');
}

if (localStorage.getItem('bp_run_tests') === 'true') {
  // runTests sob demanda: window.runBeautyProTests()
  localStorage.removeItem('bp_run_tests');
}
window.runBeautyProTests = runTests;


if (typeof window !== 'undefined') {
  if (window.bpPullIAUsoFromSupabase) window.bpPullIAUsoFromSupabase._bpOwner = 'modules/ia';
  if (window.bpResetIaHistorico) window.bpResetIaHistorico._bpOwner = 'modules/ia';
}

try { window.bpIaStopGeneration = bpIaStopGeneration; } catch (_e) {}
