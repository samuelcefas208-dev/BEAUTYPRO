/**
 * BelezaPro JS-5.1 — Fatia ESM: modelo puro série temporal (Charts)
 * Alinhado ao algoritmo de analise-temporal.js (legado) para serie/totais.
 * Insights (gerarInsightsTemporais) NÃO migrados — insights: [].
 * Sem DOM / listeners / state.
 */
"use strict";

function fmtISO(d) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function parseISO(iso) {
  return new Date(String(iso) + "T00:00:00");
}

function diasEntre(inicioIso, fimIso) {
  const a = parseISO(inicioIso);
  const b = parseISO(fimIso);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

export function intervaloAnteriorEspelhado(intervalo) {
  if (!intervalo || !intervalo.inicio || !intervalo.fim) return null;
  const dias = diasEntre(intervalo.inicio, intervalo.fim);
  const ini = parseISO(intervalo.inicio);
  const fimAnt = new Date(ini.getTime() - 86400000);
  const iniAnt = new Date(fimAnt.getTime() - (dias - 1) * 86400000);
  return {
    inicio: fmtISO(iniAnt),
    fim: fmtISO(fimAnt),
    label: "Período anterior",
  };
}

function vendasNoIntervalo(movs, inicio, fim) {
  return (movs || []).filter(function (m) {
    return m && m.tipo === "venda" && m.data && m.data >= inicio && m.data <= fim;
  });
}

function totais(vendas) {
  var receita = 0;
  for (var i = 0; i < vendas.length; i++) receita += Number(vendas[i].valor) || 0;
  var n = vendas.length;
  return {
    receita: receita,
    nVendas: n,
    ticket: n > 0 ? receita / n : 0,
  };
}

function labelDia(iso, dens) {
  var d = parseISO(iso);
  if (dens === "hora") return iso;
  if (dens <= 7) {
    return d.toLocaleDateString("pt-AO", { weekday: "short" }).replace(".", "");
  }
  if (dens <= 31) {
    return d.toLocaleDateString("pt-AO", { day: "2-digit", month: "short" }).replace(".", "");
  }
  return d.toLocaleDateString("pt-AO", { month: "short" }).replace(".", "");
}

/**
 * Alinhado ao legado buildSerieTemporal (incl. modoHora 7–22 e agregação mensal >90d).
 */
export function buildSerieTemporal(intervalo, movs, opts) {
  opts = opts || {};
  var serie = [];
  if (!intervalo || !intervalo.inicio || !intervalo.fim) return serie;

  if (opts.modoHora) {
    var ds = opts.diaRef || intervalo.fim;
    if (intervalo.inicio && intervalo.fim && intervalo.inicio === intervalo.fim) {
      ds = intervalo.inicio;
    }
    var dPrev = parseISO(ds);
    dPrev.setDate(dPrev.getDate() - 1);
    var dsPrev = fmtISO(dPrev);

    var horas = [];
    for (var h = 7; h <= 22; h++) horas.push(h);

    function vendasHora(diaIso, hora) {
      return (movs || []).filter(function (m) {
        if (!m || m.tipo !== "venda" || m.data !== diaIso || !m.hora) return false;
        var mh = parseInt(String(m.hora).split(":")[0], 10);
        if (!isFinite(mh)) return false;
        if (hora === 7) return mh <= 7;
        if (hora === 22) return mh >= 22;
        return mh === hora;
      });
    }

    for (var i = 0; i < horas.length; i++) {
      var hr = horas[i];
      var vendas = vendasHora(ds, hr);
      var t = totais(vendas);
      var vendasAnt = vendasHora(dsPrev, hr);
      var tAnt = totais(vendasAnt);
      var delta = t.receita - tAnt.receita;
      var pct =
        tAnt.receita > 0 ? (delta / tAnt.receita) * 100 : t.receita > 0 ? 100 : null;
      serie.push({
        data: ds,
        label: String(hr).padStart(2, "0") + "h",
        hora: hr,
        receita: t.receita,
        nVendas: t.nVendas,
        ticket: t.ticket,
        chave: ds + "-" + hr,
        anterior: {
          data: dsPrev,
          receita: tAnt.receita,
          nVendas: tAnt.nVendas,
          delta: delta,
          pct: pct,
        },
      });
    }
    return serie;
  }

  var dias = diasEntre(intervalo.inicio, intervalo.fim);

  if (dias > 90) {
    var cursor = parseISO(intervalo.inicio);
    cursor.setDate(1);
    var limF = parseISO(intervalo.fim);
    while (cursor <= limF) {
      var y = cursor.getFullYear();
      var m = cursor.getMonth();
      var mesIni = new Date(y, m, 1);
      var mesFim = new Date(y, m + 1, 0);
      if (mesIni < parseISO(intervalo.inicio)) mesIni = parseISO(intervalo.inicio);
      if (mesFim > limF) mesFim = limF;
      var isoI = fmtISO(mesIni);
      var isoF = fmtISO(mesFim);
      var vendasM = vendasNoIntervalo(movs, isoI, isoF);
      var totM = totais(vendasM);
      var labM = mesIni.toLocaleDateString("pt-AO", { month: "short" }).replace(".", "");
      labM = labM.charAt(0).toUpperCase() + labM.slice(1);
      serie.push({
        data: isoI,
        dataFim: isoF,
        label: labM,
        receita: totM.receita,
        nVendas: totM.nVendas,
        ticket: totM.ticket,
        chave: y + "-" + String(m + 1).padStart(2, "0"),
      });
      cursor = new Date(y, m + 1, 1);
    }
    return serie;
  }

  var passo = dias > 31 ? Math.ceil(dias / 31) : 1;
  var d0 = parseISO(intervalo.inicio);
  for (var j = 0; j < dias; j += passo) {
    var d = new Date(d0.getTime() + j * 86400000);
    var iso = fmtISO(d);
    var isoFim = iso;
    if (passo > 1) {
      var dF = new Date(d.getTime() + (passo - 1) * 86400000);
      var lim = parseISO(intervalo.fim);
      if (dF > lim) dF = lim;
      isoFim = fmtISO(dF);
    }
    var vendas = vendasNoIntervalo(movs, iso, isoFim);
    var tot = totais(vendas);
    serie.push({
      data: iso,
      dataFim: isoFim,
      label: labelDia(iso, dias),
      receita: tot.receita,
      nVendas: tot.nVendas,
      ticket: tot.ticket,
      chave: iso,
    });
  }
  return serie;
}

function tendencia(pct) {
  if (pct == null || !isFinite(pct)) return null;
  if (pct >= 5) return "crescimento";
  if (pct <= -5) return "queda";
  return "estavel";
}

function tendenciaLabel(t) {
  if (t === "crescimento") return "Receita em crescimento";
  if (t === "queda") return "Receita em queda";
  if (t === "estavel") return "Receita estável";
  return null;
}

/**
 * Core alinhado ao legado; insights sempre [] (não migrado).
 */

/**
 * Insights textuais (máx. 3). Lógica alinhada a gerarInsightsTemporais do legado.
 * Puro: só (analise, movs, deps?). deps.hoje / deps.fmtKz opcionais.
 */
export function gerarInsightsTemporais(analise, movs, deps) {
  deps = deps || {};
  var out = [];
  if (!analise || !analise.hasData || !analise.serie || !analise.serie.length) return out;

  var serie = analise.serie;
  var totais = analise.totais;
  var comReceita = serie.filter(function (pt) { return pt.receita > 0; });
  if (comReceita.length < 1) return out;

  var melhor = analise.extremos && analise.extremos.melhorDia;
  if (melhor && totais.receita > 0 && melhor.receita > 0) {
    var pctConc = Math.round((melhor.receita / totais.receita) * 100);
    if (pctConc >= 25 && comReceita.length >= 2) {
      if (analise.modoHora && melhor.hora != null) {
        out.push(
          "A faixa das " +
            String(melhor.hora).padStart(2, "0") +
            "h concentrou " +
            pctConc +
            "% da receita do dia."
        );
      } else {
        out.push(
          (melhor.label || "O melhor dia") +
            " concentrou " +
            pctConc +
            "% da receita do período."
        );
      }
    }
  }

  if (
    analise.anterior &&
    analise.anterior.totais &&
    analise.anterior.totais.nVendas > 0 &&
    totais.nVendas > 0
  ) {
    var t0 = analise.anterior.totais.ticket;
    var t1 = totais.ticket;
    if (t0 > 0) {
      var pctT = Math.round(((t1 - t0) / t0) * 1000) / 10;
      if (Math.abs(pctT) >= 8) {
        out.push(
          pctT >= 0
            ? "O ticket médio aumentou " + pctT + "% relativamente ao período anterior."
            : "O ticket médio desceu " +
                Math.abs(pctT) +
                "% relativamente ao período anterior."
        );
      }
    }
  }

  if (analise.anterior && analise.anterior.pct != null && Math.abs(analise.anterior.pct) >= 8) {
    var p = Math.round(analise.anterior.pct * 10) / 10;
    if (p >= 8) out.push("A receita está " + p + "% acima do período anterior.");
    else if (p <= -8)
      out.push("A receita está " + Math.abs(p) + "% abaixo do período anterior.");
  }

  if (!analise.modoHora && comReceita.length >= 4 && analise.mediaSerie > 0) {
    var acima = comReceita.filter(function (pt) {
      return pt.receita >= analise.mediaSerie;
    });
    if (acima.length >= 2 && acima.length <= comReceita.length - 1) {
      var nomes = acima
        .slice(0, 3)
        .map(function (pt) {
          return pt.label;
        })
        .join(", ");
      out.push(
        "Movimento acima da média em: " + nomes + (acima.length > 3 ? "…" : "") + "."
      );
    }
  }

  if (analise.modoHora && melhor && melhor.hora != null && comReceita.length >= 3) {
    var already = out.some(function (t) {
      return t.indexOf("faixa") >= 0;
    });
    if (!already) {
      out.push(
        "O pico de receita foi por volta das " +
          String(melhor.hora).padStart(2, "0") +
          "h."
      );
    }
  }

  try {
    if (!analise.modoHora && analise.intervalo) {
      var h =
        typeof deps.hoje === "function"
          ? deps.hoje()
          : fmtISO(new Date());
      var ini = analise.intervalo.inicio || "";
      var fim = analise.intervalo.fim || "";
      if (
        ini.slice(0, 7) === h.slice(0, 7) &&
        fim.slice(0, 7) === h.slice(0, 7) &&
        totais.receita > 0
      ) {
        var diaNum = parseInt(h.slice(8, 10), 10);
        var fimMes = new Date(
          parseInt(h.slice(0, 4), 10),
          parseInt(h.slice(5, 7), 10),
          0
        );
        var diasMes = fimMes.getDate();
        if (diaNum >= 5 && diaNum < diasMes) {
          var ritmo = totais.receita / diaNum;
          var proj = Math.round(ritmo * diasMes);
          if (proj > totais.receita) {
            var fmt =
              typeof deps.fmtKz === "function" ? deps.fmtKz(proj) : String(proj);
            out.push(
              "Se mantiver este ritmo, a previsão aproximada para o final do mês é de " +
                fmt +
                "."
            );
          }
        }
      }
    }
  } catch (_) {}

  if (movs && movs.length && analise.intervalo && out.length < 3) {
    var ini2 = analise.intervalo.inicio;
    var fim2 = analise.intervalo.fim;
    if (analise.modoHora && analise.diaRef) {
      ini2 = fim2 = analise.diaRef;
    }
    var map = {};
    (movs || []).forEach(function (m) {
      if (!m || m.tipo !== "venda" || !m.data || m.data < ini2 || m.data > fim2)
        return;
      var nome = m.servico_nome || m.servico || m.descricao;
      if (!nome) return;
      map[nome] = (map[nome] || 0) + (Number(m.valor) || 0);
    });
    var top = Object.keys(map)
      .map(function (k) {
        return { n: k, v: map[k] };
      })
      .sort(function (a, b) {
        return b.v - a.v;
      })[0];
    if (top && totais.receita > 0 && top.v / totais.receita >= 0.3) {
      out.push("A maior parte da receita veio de «" + top.n + "».");
    }
  }

  var seen = {};
  var final = [];
  for (var i = 0; i < out.length && final.length < 3; i++) {
    if (seen[out[i]]) continue;
    seen[out[i]] = 1;
    final.push(out[i]);
  }
  return final;
}

export function buildAnaliseTemporal(intervalo, movs, opts) {
  opts = opts || {};
  movs = movs || [];
  var serie = buildSerieTemporal(intervalo, movs, opts);
  var vendas = intervalo
    ? vendasNoIntervalo(movs, intervalo.inicio, intervalo.fim)
    : [];
  var tot = totais(vendas);

  var antInt = intervaloAnteriorEspelhado(intervalo);
  var anterior = null;
  if (antInt) {
    var vendasAnt = vendasNoIntervalo(movs, antInt.inicio, antInt.fim);
    var totAnt = totais(vendasAnt);
    if (totAnt.nVendas > 0 || tot.nVendas > 0) {
      var delta = tot.receita - totAnt.receita;
      var pct =
        totAnt.receita > 0
          ? (delta / totAnt.receita) * 100
          : tot.receita > 0
            ? 100
            : null;
      anterior = {
        intervalo: antInt,
        totais: totAnt,
        delta: delta,
        pct: pct,
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

  var diasComReceita = serie.filter(function (p) {
    return p.receita > 0;
  }).length;
  var mediaDiaria =
    diasComReceita > 0 ? tot.receita / Math.max(diasComReceita, 1) : 0;
  var mediaSerie =
    serie.length > 0
      ? serie.reduce(function (a, p) {
          return a + p.receita;
        }, 0) / serie.length
      : 0;

  var tend = anterior && anterior.pct != null ? tendencia(anterior.pct) : null;

  var diaRef = null;
  if (opts.modoHora && serie.length) {
    diaRef = serie[0].data;
    var vendasDia = vendasNoIntervalo(movs, diaRef, diaRef);
    tot = totais(vendasDia);
    var dAnt = parseISO(diaRef);
    dAnt.setDate(dAnt.getDate() - 1);
    var diaAntIso = fmtISO(dAnt);
    var vendasDiaAnt = vendasNoIntervalo(movs, diaAntIso, diaAntIso);
    var totAntD = totais(vendasDiaAnt);
    if (totAntD.nVendas > 0 || tot.nVendas > 0) {
      var deltaD = tot.receita - totAntD.receita;
      var pctD =
        totAntD.receita > 0
          ? (deltaD / totAntD.receita) * 100
          : tot.receita > 0
            ? 100
            : null;
      anterior = {
        intervalo: { inicio: diaAntIso, fim: diaAntIso, label: "Dia anterior" },
        totais: totAntD,
        delta: deltaD,
        pct: pctD,
      };
      tend = pctD != null ? tendencia(pctD) : null;
    } else {
      anterior = null;
      tend = null;
    }
  }

  var ret = {
    intervalo: intervalo || null,
    diaRef: diaRef,
    serie: serie,
    totais: tot,
    anterior: anterior,
    extremos: { melhorDia: melhor, piorDia: pior },
    mediaDiaria: mediaDiaria,
    mediaSerie: mediaSerie,
    tendencia: tend,
    tendenciaLabel: tendenciaLabel(tend),
    hasData: tot.nVendas > 0 || tot.receita > 0,
    modoHora: !!opts.modoHora,
    insights: [],
    _slice: "js5-charts-serie-core",
  };
  try {
    ret.insights = gerarInsightsTemporais(ret, movs, {
      hoje: opts.hoje,
      fmtKz: opts.fmtKz,
    });
  } catch (_i) {
    ret.insights = [];
  }
  return ret;
}

export const SLICE_ID = "charts-serie-core";
export const SLICE_VERSION = "js5.3-0.3.0";
