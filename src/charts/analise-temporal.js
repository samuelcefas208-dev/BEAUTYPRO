/* BelezaPro C-6 — domínio temporal Charts (legado); carregar ANTES de chart-module */

// ====================================================================
//  analise-temporal.js — Modelo puro de análise do dashboard (Fase 1)
//  Sem DOM. Consome movimentos de venda e intervalos ISO.
// ====================================================================

function _atFmtISO(d) {
  if (typeof formatarDataISO === 'function') return formatarDataISO(d);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function _atParseISO(iso) {
  return new Date(String(iso) + 'T00:00:00');
}

function _atDiasEntre(inicioIso, fimIso) {
  const a = _atParseISO(inicioIso);
  const b = _atParseISO(fimIso);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

/** Período imediatamente anterior com a mesma duração em dias. */
function intervaloAnteriorEspelhado(intervalo) {
  if (!intervalo || !intervalo.inicio || !intervalo.fim) return null;
  const dias = _atDiasEntre(intervalo.inicio, intervalo.fim);
  const ini = _atParseISO(intervalo.inicio);
  const fimAnt = new Date(ini.getTime() - 86400000);
  const iniAnt = new Date(fimAnt.getTime() - (dias - 1) * 86400000);
  return {
    inicio: _atFmtISO(iniAnt),
    fim: _atFmtISO(fimAnt),
    label: 'Período anterior'
  };
}

function _atVendaActiva(m) {
  if (typeof BPMetrics !== 'undefined' && typeof BPMetrics.isVendaValida === 'function') {
    return BPMetrics.isVendaValida(m) && !!(m && m.data);
  }
  try { console.error('[Gráfico] BPMetrics.isVendaValida indisponível'); } catch (_) {}
  return false;
}

/** Soma receita oficial (valor_norm) — nunca Number solto em vendas. */
function _atReceitaVendas(lista) {
  if (typeof BPMetrics !== 'undefined' && typeof BPMetrics.somarValor === 'function') {
    return BPMetrics.somarValor(lista || []);
  }
  return 0;
}

/** Série diária oficial se API existir e intervalo completo. */
function _atSerieOficial(inicio, fim) {
  if (typeof BPMetrics !== 'undefined' && typeof BPMetrics.serieFaturamentoDiario === 'function') {
    return BPMetrics.serieFaturamentoDiario(inicio, fim);
  }
  return null;
}

function _atVendasNoIntervalo(movs, inicio, fim) {
  return (movs || []).filter(function (m) {
    return _atVendaActiva(m) && m.data >= inicio && m.data <= fim;
  });
}

/** Uma passagem: agrega receita/n por dia no intervalo (evita N filtros em ≤31 dias). */
function _atBucketReceitaPorDia(movs, inicio, fim) {
  /* Fase 3: receita diária canónica via BPMetrics.serieFaturamentoDiario quando disponível */
  var map = Object.create(null);
  var oficial = _atSerieOficial(inicio, fim);
  if (oficial && oficial.length) {
    for (var i = 0; i < oficial.length; i++) {
      var o = oficial[i];
      if (!o || !o.data) continue;
      map[o.data] = { receita: o.receita || 0, nVendas: 0 };
    }
  }
  var list = movs || [];
  for (var j = 0; j < list.length; j++) {
    var m = list[j];
    if (!_atVendaActiva(m)) continue;
    var d = m.data;
    if (!d || d < inicio || d > fim) continue;
    var b = map[d];
    if (!b) {
      b = map[d] = { receita: 0, nVendas: 0 };
    }
    b.nVendas += 1;
    if (!oficial) {
      b.receita += (typeof BPMetrics !== 'undefined' && BPMetrics.somarValor)
        ? BPMetrics.somarValor([m])
        : 0;
    }
  }
  return map;
}

function _atTotais(vendas) {
  var receita = 0;
  receita = _atReceitaVendas(vendas);
  var n = vendas.length;
  return {
    receita: receita,
    nVendas: n,
    ticket: n > 0 ? receita / n : 0
  };
}

/** Só o dia civil (01…31) — 30 dias / mês / buckets. Sem mês. */
function _atLabelDiaNum(iso) {
  try {
    if (typeof hoje === 'function' && iso && iso === hoje()) return 'hoje';
  } catch (_) {}
  var n = parseInt(String(iso || '').slice(8, 10), 10);
  if (!isFinite(n) || n < 1) return '';
  return n < 10 ? '0' + n : String(n);
}

function _atLabelDia(iso, dens) {
  /* Dia actual em qualquer filtragem por dias → "hoje" */
  try {
    if (typeof hoje === 'function' && iso && iso === hoje()) return 'hoje';
  } catch (_) {}
  var d = _atParseISO(iso);
  if (dens === 'hora') return iso;
  if (dens <= 7) {
    return d.toLocaleDateString('pt-AO', { weekday: 'short' }).replace('.', '');
  }
  if (dens <= 31) {
    return _atLabelDiaNum(iso);
  }
  return d.toLocaleDateString('pt-AO', { month: 'short' }).replace('.', '');
}

/**
 * Série diária (ou por bloco de 2h se modoHora).
 * @param {{inicio:string,fim:string,label?:string}} intervalo
 * @param {Array} movs
 * @param {{modoHora?:boolean}} opts
 */
function buildSerieTemporal(intervalo, movs, opts) {
  opts = opts || {};
  var serie = [];
  if (!intervalo || !intervalo.inicio || !intervalo.fim) return serie;

  if (opts.modoHora) {
    // Dia de referência: intervalo de 1 dia, senão opts.diaRef ou fim
    var ds = opts.diaRef || intervalo.fim;
    if (intervalo.inicio && intervalo.fim && intervalo.inicio === intervalo.fim) {
      ds = intervalo.inicio;
    }
    // Dia anterior (mesmas faixas horárias)
    var dPrev = _atParseISO(ds);
    dPrev.setDate(dPrev.getDate() - 1);
    var dsPrev = _atFmtISO(dPrev);

    // Resolução 1h. janela típica de salão 7h–22h (16 barras legíveis);
    // fora disto agrega em "06h" (madrugada) e "23h" (noite) se houver dados.
    var horas = [];
    for (var h = 7; h <= 22; h++) horas.push(h);

    function vendasHora(diaIso, hora) {
      return (movs || []).filter(function (m) {
        if (!_atVendaActiva(m) || m.data !== diaIso || !m.hora) return false;
        var mh = parseInt(String(m.hora).split(':')[0], 10);
        if (!isFinite(mh)) return false;
        if (hora === 7) return mh <= 7;       // 00–07 agregados no primeiro bucket
        if (hora === 22) return mh >= 22;     // 22–23 no último
        return mh === hora;
      });
    }

    for (var i = 0; i < horas.length; i++) {
      var hr = horas[i];
      var vendas = vendasHora(ds, hr);
      var t = _atTotais(vendas);
      var vendasAnt = vendasHora(dsPrev, hr);
      var tAnt = _atTotais(vendasAnt);
      var delta = t.receita - tAnt.receita;
      var pct = tAnt.receita > 0 ? (delta / tAnt.receita) * 100 : (t.receita > 0 ? 100 : null);
      serie.push({
        data: ds,
        label: String(hr).padStart(2, '0') + 'h',
        hora: hr,
        receita: t.receita,
        nVendas: t.nVendas,
        ticket: t.ticket,
        chave: ds + '-' + hr,
        anterior: {
          data: dsPrev,
          receita: tAnt.receita,
          nVendas: tAnt.nVendas,
          delta: delta,
          pct: pct
        }
      });
    }
    return serie;
  }

  var dias = _atDiasEntre(intervalo.inicio, intervalo.fim);

  // >=90 dias (inclui «Últimos 90 dias»): mês civil — barras legíveis, alinhado a insights
  if (dias >= 90) {
    var cursor = _atParseISO(intervalo.inicio);
    cursor.setDate(1);
    var limF = _atParseISO(intervalo.fim);
    while (cursor <= limF) {
      var y = cursor.getFullYear();
      var m = cursor.getMonth();
      var mesIni = new Date(y, m, 1);
      var mesFim = new Date(y, m + 1, 0);
      if (mesIni < _atParseISO(intervalo.inicio)) mesIni = _atParseISO(intervalo.inicio);
      if (mesFim > limF) mesFim = limF;
      var isoI = _atFmtISO(mesIni);
      var isoF = _atFmtISO(mesFim);
      var vendasM = _atVendasNoIntervalo(movs, isoI, isoF);
      var totM = _atTotais(vendasM);
      var labM = mesIni.toLocaleDateString('pt-AO', { month: 'short' }).replace('.', '');
      labM = labM.charAt(0).toUpperCase() + labM.slice(1);
      serie.push({
        data: isoI,
        dataFim: isoF,
        label: labM,
        receita: totM.receita,
        nVendas: totM.nVendas,
        ticket: totM.ticket,
        chave: y + '-' + String(m + 1).padStart(2, '0')
      });
      cursor = new Date(y, m + 1, 1);
    }
    return serie;
  }

  // 32–89 dias: semanas (evita dezenas de barras minúsculas no telemóvel)
  if (dias >= 32) {
    var dW = _atParseISO(intervalo.inicio);
    var limW = _atParseISO(intervalo.fim);
    var wi = 0;
    while (dW <= limW) {
      var wIni = new Date(dW.getTime());
      var wFim = new Date(dW.getTime() + 6 * 86400000);
      if (wFim > limW) wFim = limW;
      var isoWI = _atFmtISO(wIni);
      var isoWF = _atFmtISO(wFim);
      var totW = _atTotais(_atVendasNoIntervalo(movs, isoWI, isoWF));
      var labW = _atLabelDia(isoWI, dias);
      if (isoWI !== isoWF) labW = labW + '–' + _atLabelDia(isoWF, dias);
      serie.push({
        data: isoWI,
        dataFim: isoWF,
        label: labW,
        receita: totW.receita,
        nVendas: totW.nVendas,
        ticket: totW.ticket,
        chave: 'w-' + isoWI
      });
      dW = new Date(wFim.getTime() + 86400000);
      wi++;
      if (wi > 20) break;
    }
    return serie;
  }

  // Resolução explícita: N buckets iguais no intervalo (12 no telemóvel → 30 no rail)
  var wantB = parseInt(opts.buckets, 10) || 0;
  if (wantB > 0 && wantB < dias) {
    var d0b = _atParseISO(intervalo.inicio);
    var bucketB = _atBucketReceitaPorDia(movs, intervalo.inicio, intervalo.fim);
    for (var bi = 0; bi < wantB; bi++) {
      var offA = Math.floor(bi * dias / wantB);
      var offB = Math.floor((bi + 1) * dias / wantB) - 1;
      if (offB < offA) offB = offA;
      var recB = 0, nvB = 0;
      var isoA = null, isoB = null;
      for (var dj = offA; dj <= offB; dj++) {
        var isoJ = _atFmtISO(new Date(d0b.getTime() + dj * 86400000));
        if (!isoA) isoA = isoJ;
        isoB = isoJ;
        var cell = bucketB[isoJ];
        if (cell) { recB += cell.receita; nvB += cell.nVendas; }
      }
      serie.push({
        data: isoA,
        dataFim: isoB,
        /* Um rótulo por bucket: só o dia de início (sem intervalo nem mês) */
        label: _atLabelDiaNum(isoA),
        receita: recB,
        nVendas: nvB,
        ticket: nvB > 0 ? recB / nvB : 0,
        chave: 'r-' + isoA + '-' + isoB
      });
    }
    return serie;
  }

  // ≤31 dias: um ponto por dia (bucket O(movs) + O(dias), não O(dias×movs))
  var d0 = _atParseISO(intervalo.inicio);
  var bucket = _atBucketReceitaPorDia(movs, intervalo.inicio, intervalo.fim);
  for (var i = 0; i < dias; i++) {
    var d = new Date(d0.getTime() + i * 86400000);
    var iso = _atFmtISO(d);
    var b = bucket[iso];
    var rec = b ? b.receita : 0;
    var nv = b ? b.nVendas : 0;
    serie.push({
      data: iso,
      dataFim: iso,
      label: _atLabelDia(iso, dias),
      receita: rec,
      nVendas: nv,
      ticket: nv > 0 ? rec / nv : 0,
      chave: iso
    });
  }
  return serie;
}

function _atTendencia(pct) {
  if (pct == null || !isFinite(pct)) return null;
  if (pct >= 5) return 'crescimento';
  if (pct <= -5) return 'queda';
  return 'estavel';
}

function _atTendenciaLabel(t) {
  if (t === 'crescimento') return 'Receita em crescimento';
  if (t === 'queda') return 'Receita em queda';
  if (t === 'estavel') return 'Receita estável';
  return null;
}

/**
 * Modelo completo de análise temporal.
 */
function buildAnaliseTemporal(intervalo, movs, opts) {
  opts = opts || {};
  movs = movs || [];
  var serie = buildSerieTemporal(intervalo, movs, opts);
  var vendas = intervalo
    ? _atVendasNoIntervalo(movs, intervalo.inicio, intervalo.fim)
    : [];
  var totais = _atTotais(vendas);

  var antInt = intervaloAnteriorEspelhado(intervalo);
  var anterior = null;
  if (antInt) {
    var vendasAnt = _atVendasNoIntervalo(movs, antInt.inicio, antInt.fim);
    var totAnt = _atTotais(vendasAnt);
    // Só comparar se o período anterior tiver alguma actividade OU o actual tiver
    // (evita “0%” sem contexto quando ambos vazios)
    if (totAnt.nVendas > 0 || totais.nVendas > 0) {
      var delta = totais.receita - totAnt.receita;
      var pct = totAnt.receita > 0
        ? (delta / totAnt.receita) * 100
        : (totais.receita > 0 ? 100 : null);
      anterior = {
        intervalo: antInt,
        totais: totAnt,
        delta: delta,
        pct: pct
      };
    }
  }

  var melhor = null;
  var pior = null;
  for (var s = 0; s < serie.length; s++) {
    var pt = serie[s];
    if (!pt || pt.receita <= 0) continue;
    if (!melhor || pt.receita > melhor.receita) melhor = pt;
    if (!pior || pt.receita < pior.receita) pior = pt;
  }

  var diasComReceita = serie.filter(function (p) { return p.receita > 0; }).length;
  var mediaDiaria = diasComReceita > 0
    ? totais.receita / Math.max(diasComReceita, 1)
    : 0;
  // média sobre todos os buckets da série (para linha no gráfico)
  var mediaSerie = serie.length > 0
    ? serie.reduce(function (a, p) { return a + p.receita; }, 0) / serie.length
    : 0;

  var tendencia = anterior && anterior.pct != null ? _atTendencia(anterior.pct) : null;

  // Em modo hora: totais do dia de referência; anterior = dia civil anterior
  var diaRef = null;
  if (opts.modoHora && serie.length) {
    diaRef = serie[0].data;
    var vendasDia = _atVendasNoIntervalo(movs, diaRef, diaRef);
    totais = _atTotais(vendasDia);
    var dAnt = _atParseISO(diaRef);
    dAnt.setDate(dAnt.getDate() - 1);
    var diaAntIso = _atFmtISO(dAnt);
    var vendasDiaAnt = _atVendasNoIntervalo(movs, diaAntIso, diaAntIso);
    var totAnt = _atTotais(vendasDiaAnt);
    if (totAnt.nVendas > 0 || totais.nVendas > 0) {
      var deltaD = totais.receita - totAnt.receita;
      var pctD = totAnt.receita > 0 ? (deltaD / totAnt.receita) * 100 : (totais.receita > 0 ? 100 : null);
      anterior = {
        intervalo: { inicio: diaAntIso, fim: diaAntIso, label: 'Dia anterior' },
        totais: totAnt,
        delta: deltaD,
        pct: pctD
      };
      tendencia = pctD != null ? _atTendencia(pctD) : null;
    } else {
      anterior = null;
      tendencia = null;
    }
  }

  var insights = [];
  try {
    insights = gerarInsightsTemporais({
      intervalo: intervalo || null,
      diaRef: diaRef,
      serie: serie,
      totais: totais,
      anterior: anterior,
      extremos: { melhorDia: melhor, piorDia: pior },
      mediaDiaria: mediaDiaria,
      mediaSerie: mediaSerie,
      tendencia: tendencia,
      tendenciaLabel: _atTendenciaLabel(tendencia),
      hasData: totais.nVendas > 0 || totais.receita > 0,
      modoHora: !!opts.modoHora
    }, movs);
  } catch (_ins) { insights = []; }

  return {
    intervalo: intervalo || null,
    diaRef: diaRef,
    serie: serie,
    totais: totais,
    anterior: anterior,
    extremos: { melhorDia: melhor, piorDia: pior },
    mediaDiaria: mediaDiaria,
    mediaSerie: mediaSerie,
    tendencia: tendencia,
    tendenciaLabel: _atTendenciaLabel(tendencia),
    hasData: totais.nVendas > 0 || totais.receita > 0,
    modoHora: !!opts.modoHora,
    insights: insights
  };
}


/**
 * Insights automáticos — apenas com evidência nos dados.
 * Máx. 3 frases. Sem alarmismo.
 */
function gerarInsightsTemporais(analise, movs) {
  var out = [];
  if (!analise || !analise.hasData || !analise.serie || !analise.serie.length) return out;

  var serie = analise.serie;
  var totais = analise.totais;
  var comReceita = serie.filter(function (p) { return p.receita > 0; });
  if (comReceita.length < 1) return out;

  // 1) Concentração no melhor bucket
  var melhor = analise.extremos && analise.extremos.melhorDia;
  if (melhor && totais.receita > 0 && melhor.receita > 0) {
    var pctConc = Math.round((melhor.receita / totais.receita) * 100);
    if (pctConc >= 25 && comReceita.length >= 2) {
      if (analise.modoHora && melhor.hora != null) {
        out.push('A faixa das ' + String(melhor.hora).padStart(2, '0') + 'h concentrou ' + pctConc + '% da receita do dia.');
      } else {
        out.push((melhor.label || 'O melhor dia') + ' concentrou ' + pctConc + '% da receita do período.');
      }
    }
  }

  // 2) Ticket vs período anterior
  if (analise.anterior && analise.anterior.totais && analise.anterior.totais.nVendas > 0 && totais.nVendas > 0) {
    var t0 = analise.anterior.totais.ticket;
    var t1 = totais.ticket;
    if (t0 > 0) {
      var pctT = Math.round(((t1 - t0) / t0) * 1000) / 10;
      if (Math.abs(pctT) >= 8) {
        out.push(pctT >= 0
          ? ('O ticket médio aumentou ' + pctT + '% relativamente ao período anterior.')
          : ('O ticket médio desceu ' + Math.abs(pctT) + '% relativamente ao período anterior.'));
      }
    }
  }

  // 3) Tendência geral de receita
  if (analise.anterior && analise.anterior.pct != null && Math.abs(analise.anterior.pct) >= 8) {
    var p = Math.round(analise.anterior.pct * 10) / 10;
    if (p >= 8) out.push('A receita está ' + p + '% acima do período anterior.');
    else if (p <= -8) out.push('A receita está ' + Math.abs(p) + '% abaixo do período anterior.');
  }

  // 4) Dias acima da média (só série diária com >= 4 pontos com receita)
  if (!analise.modoHora && comReceita.length >= 4 && analise.mediaSerie > 0) {
    var acima = comReceita.filter(function (p) { return p.receita >= analise.mediaSerie; });
    if (acima.length >= 2 && acima.length <= comReceita.length - 1) {
      var nomes = acima.slice(0, 3).map(function (p) { return p.label; }).join(', ');
      out.push('Movimento acima da média em: ' + nomes + (acima.length > 3 ? '…' : '') + '.');
    }
  }

  // 5) Pico horário
  if (analise.modoHora && melhor && melhor.hora != null && comReceita.length >= 3) {
    // já pode ter concentração; se não, mencionar pico simples
    var already = out.some(function (t) { return t.indexOf('faixa') >= 0; });
    if (!already) {
      out.push('O pico de receita foi por volta das ' + String(melhor.hora).padStart(2, '0') + 'h.');
    }
  }

  // 6) Projecção fim do mês (só se estamos no mês corrente e há ritmo)
  try {
    if (!analise.modoHora && analise.intervalo && typeof hoje === 'function') {
      var h = hoje();
      var ini = analise.intervalo.inicio || '';
      var fim = analise.intervalo.fim || '';
      if (ini.slice(0, 7) === h.slice(0, 7) && fim.slice(0, 7) === h.slice(0, 7) && totais.receita > 0) {
        var diaNum = parseInt(h.slice(8, 10), 10);
        var fimMes = new Date(parseInt(h.slice(0, 4), 10), parseInt(h.slice(5, 7), 10), 0);
        var diasMes = fimMes.getDate();
        if (diaNum >= 5 && diaNum < diasMes) {
          var ritmo = totais.receita / diaNum;
          var proj = Math.round(ritmo * diasMes);
          if (proj > totais.receita) {
            out.push('Se mantiver este ritmo, a previsão aproximada para o final do mês é de ' +
              (typeof fmtKz === 'function' ? fmtKz(proj) : String(proj)) + '.');
          }
        }
      }
    }
  } catch (_) {}

  // 7) Top serviço no período (evidência em movimentos)
  if (movs && movs.length && analise.intervalo && out.length < 3) {
    var ini2 = analise.intervalo.inicio;
    var fim2 = analise.intervalo.fim;
    if (analise.modoHora && analise.diaRef) {
      ini2 = fim2 = analise.diaRef;
    }
    var map = {};
    (movs || []).forEach(function (m) {
      if (!_atVendaActiva(m) || !m.data || m.data < ini2 || m.data > fim2) return;
      var nome = m.servico_nome || m.servico || m.descricao;
      if (!nome) return;
      map[nome] = (map[nome] || 0) + (typeof BPMetrics !== 'undefined' && BPMetrics.somarValor ? BPMetrics.somarValor([m]) : 0);
    });
    var top = Object.keys(map).map(function (k) { return { n: k, v: map[k] }; })
      .sort(function (a, b) { return b.v - a.v; })[0];
    if (top && totais.receita > 0 && top.v / totais.receita >= 0.3) {
      out.push('A maior parte da receita veio de «' + top.n + '».');
    }
  }

  // dedupe e máx 3
  var seen = {};
  var final = [];
  for (var i = 0; i < out.length && final.length < 3; i++) {
    if (seen[out[i]]) continue;
    seen[out[i]] = 1;
    final.push(out[i]);
  }
  return final;
}


if (typeof window !== 'undefined') {
  window.buildAnaliseTemporal = buildAnaliseTemporal;
  window.gerarInsightsTemporais = gerarInsightsTemporais;
  window.analiseParaExport = function (analise) {
    if (!analise) return null;
    return {
      meta: {
        label: (analise.intervalo && analise.intervalo.label) || '',
        inicio: (analise.intervalo && analise.intervalo.inicio) || '',
        fim: (analise.intervalo && analise.intervalo.fim) || '',
        modoHora: !!analise.modoHora,
        diaRef: analise.diaRef || null
      },
      totais: analise.totais,
      anterior: analise.anterior,
      serie: (analise.serie || []).map(function (p) {
        return { data: p.data, label: p.label, receita: p.receita, nVendas: p.nVendas, ticket: p.ticket, hora: p.hora };
      }),
      insights: analise.insights || []
    };
  };
  window.buildSerieTemporal = buildSerieTemporal;
  window.intervaloAnteriorEspelhado = intervaloAnteriorEspelhado;
}


/** Nome de profissional a partir do id (se helpers existirem). */
function _atNomeProf(id, mov) {
  if (typeof getProfissionalNome === 'function' && id) {
    try { return getProfissionalNome(id) || null; } catch (_) {}
  }
  if (mov && mov.profissional) return String(mov.profissional);
  return id ? String(id) : null;
}

function _atNomeServico(mov) {
  if (!mov) return null;
  return mov.servico_nome || mov.servico || mov.descricao || null;
}

/**
 * Mini-relatório de um dia (ou bucket horário).
 * @param {string} dataIso
 * @param {Array} movs
 * @param {{hora?:number, horaFim?:number}} opts  hora = filtro 1h (modo hora)
 */
function detalheDiaVendas(dataIso, movs, opts) {
  opts = opts || {};
  var vendas = (movs || []).filter(function (m) {
    if (!_atVendaActiva(m) || m.data !== dataIso) return false;
    if (opts.hora != null && isFinite(opts.hora)) {
      if (!m.hora) return false;
      var mh = parseInt(String(m.hora).split(':')[0], 10);
      if (!isFinite(mh)) return false;
      var hr = Number(opts.hora);
      if (hr === 7) return mh <= 7;
      if (hr === 22) return mh >= 22;
      return mh === hr;
    }
    return true;
  });
  // ordenar por hora
  vendas = vendas.slice().sort(function (a, b) {
    return String(a.hora || '').localeCompare(String(b.hora || ''));
  });

  var totais = _atTotais(vendas);
  var byCliente = {};
  var byServico = {};
  var byProf = {};
  var byPag = {};

  for (var i = 0; i < vendas.length; i++) {
    var m = vendas[i];
    var cli = (m.cliente && String(m.cliente).trim()) || 'Avulso';
    byCliente[cli] = byCliente[cli] || { nome: cli, receita: 0, n: 0 };
    byCliente[cli].receita += (typeof BPMetrics !== "undefined" && BPMetrics.somarValor ? BPMetrics.somarValor([m]) : 0);
    byCliente[cli].n += 1;

    var srv = _atNomeServico(m) || 'Serviço';
    byServico[srv] = byServico[srv] || { nome: srv, receita: 0, n: 0 };
    byServico[srv].receita += (typeof BPMetrics !== "undefined" && BPMetrics.somarValor ? BPMetrics.somarValor([m]) : 0);
    byServico[srv].n += 1;

    var pid = m.profissional_id || m.profissional || '';
    var pnome = _atNomeProf(m.profissional_id, m) || 'Sem profissional';
    byProf[pid || pnome] = byProf[pid || pnome] || { id: pid, nome: pnome, receita: 0, n: 0 };
    byProf[pid || pnome].receita += (typeof BPMetrics !== "undefined" && BPMetrics.somarValor ? BPMetrics.somarValor([m]) : 0);
    byProf[pid || pnome].n += 1;

    var pag = m.metodoPagamento || m.pagamento || 'Numerário';
    byPag[pag] = byPag[pag] || { nome: pag, receita: 0, n: 0 };
    byPag[pag].receita += (typeof BPMetrics !== "undefined" && BPMetrics.somarValor ? BPMetrics.somarValor([m]) : 0);
    byPag[pag].n += 1;
  }

  function top(map, n) {
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.receita - a.receita; })
      .slice(0, n || 5);
  }

  var topProf = top(byProf, 1)[0] || null;
  var topSrv = top(byServico, 1)[0] || null;
  var topPag = top(byPag, 1)[0] || null;

  // mesmo dia da semana anterior (7 dias antes)
  var d = _atParseISO(dataIso);
  d.setDate(d.getDate() - 7);
  var isoSem = _atFmtISO(d);
  var vendasSem = _atVendasNoIntervalo(movs, isoSem, isoSem);
  var totSem = _atTotais(vendasSem);
  var vsSemana = null;
  if (totSem.nVendas > 0 || totais.nVendas > 0) {
    var delta = totais.receita - totSem.receita;
    var pct = totSem.receita > 0 ? (delta / totSem.receita) * 100 : (totais.receita > 0 ? 100 : null);
    vsSemana = { data: isoSem, totais: totSem, delta: delta, pct: pct };
  }

  return {
    data: dataIso,
    hora: opts.hora != null ? Number(opts.hora) : null,
    vendas: vendas,
    totais: totais,
    topProfissional: topProf,
    topServico: topSrv,
    topPagamento: topPag,
    porCliente: top(byCliente, 8),
    porServico: top(byServico, 8),
    porProfissional: top(byProf, 8),
    porPagamento: top(byPag, 6),
    vsMesmoDiaSemana: vsSemana
  };
}

if (typeof window !== 'undefined') {
  window.detalheDiaVendas = detalheDiaVendas;
}

