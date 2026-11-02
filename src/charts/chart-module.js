/* BelezaPro C-6 — chart-module (render gráfico); carregar APÓS analise-temporal e ANTES de ui-render */



function actualizarDashChartExec(analise) {
  try {
    var elRev = document.getElementById('dash-chart-exec-rev');
    var elN = document.getElementById('dash-chart-exec-n');
    var elTicket = document.getElementById('dash-chart-exec-ticket');
    var elDelta = document.getElementById('dash-chart-exec-delta');
    if (!elRev && !elN && !elTicket && !elDelta) return;

    var fmt = function (n) {
      var v = Number(n);
      if (!isFinite(v)) v = 0;
      try {
        if (typeof fmtKz === 'function') return fmtKz(v);
      } catch (_) {}
      try {
        return Math.round(v).toLocaleString('pt-AO') + ' Kz';
      } catch (_e2) {
        return Math.round(v) + ' Kz';
      }
    };

    var totais = analise && analise.totais ? analise.totais : null;
    if (!totais) {
      if (elRev) elRev.textContent = '—';
      if (elN) elN.textContent = '—';
      if (elTicket) elTicket.textContent = '—';
      if (elDelta) {
        elDelta.textContent = '—';
        elDelta.removeAttribute('data-trend');
      }
      return;
    }

    if (elRev) elRev.textContent = fmt(totais.receita);
    if (elN) elN.textContent = String(totais.nVendas != null ? totais.nVendas : 0);
    if (elTicket) elTicket.textContent = fmt(totais.ticket);

    if (elDelta) {
      var ant = analise && analise.anterior ? analise.anterior : null;
      var pct = null;
      if (ant) {
        if (ant.pct != null) pct = Number(ant.pct);
        else if (ant.totais && totais.receita != null && ant.totais.receita > 0) {
          pct = ((Number(totais.receita) - Number(ant.totais.receita)) / Number(ant.totais.receita)) * 100;
        }
      }
      if (pct == null || !isFinite(pct)) {
        elDelta.textContent = '—';
        elDelta.removeAttribute('data-trend');
      } else {
        var rounded = Math.round(pct * 10) / 10;
        elDelta.textContent = (rounded > 0 ? '+' : '') + rounded + '%';
        elDelta.setAttribute('data-trend', rounded > 0 ? 'up' : (rounded < 0 ? 'down' : 'flat'));
      }
    }
  } catch (e) {
    try { console.warn('[chart-exec]', e); } catch (_) {}
  }
}

function _bpUpdateChartHealth(analise) {
  var el = document.getElementById('dash-chart-health');
  var val = document.getElementById('dash-chart-health-value');
  var st = document.getElementById('dash-chart-status');
  if (!el || !val) return;
  if (!analise || !analise.totais || !(analise.totais.nVendas > 0 || analise.totais.receita > 0)) {
    val.textContent = 'Sem dados';
    el.setAttribute('data-level', '');
    if (st) st.textContent = '';
    return;
  }
  var pct = analise.anterior && analise.anterior.pct != null ? Number(analise.anterior.pct) : null;
  var level = 'estavel';
  var label = 'Estável';
  if (pct != null) {
    if (pct >= 15) { level = 'excelente'; label = 'Em crescimento'; }
    else if (pct >= 0) { level = 'boa'; label = 'Estável'; }
    else if (pct > -15) { level = 'boa'; label = 'Ligeira queda'; }
    else { level = 'atencao'; label = 'Atenção'; }
  }
  el.setAttribute('data-level', level);
  val.textContent = label;
  if (st) st.textContent = pct != null ? ((pct > 0 ? '+' : '') + (Math.round(pct * 10) / 10) + '%') : '';
}

// ====================================================================
//  chart-module.js — Gráfico do dashboard (Fase A1: intervalo unificado)
// ====================================================================
let _chartSwipeStartX = null;
let _chartSwipeStartY = null;
let _chartSelectedIdx = null;
let _chartViewMode = (typeof localStorage !== 'undefined' && localStorage.getItem('bp_chart_view')) || 'barras';
let _chartAnimProgress = 1;
let _chartAnimRaf = null;



function _escChart(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _fmtChart(n) {
  return typeof fmtKz === 'function' ? fmtKz(n) : String(Math.round(Number(n) || 0));
}

/** Fase 5 — sheet de drill-down do dia/hora */

/** ET4.7 — tooltip só no Resumo; nunca roubar toques da bottom-nav */
function bpChartIsDashboardActive() {
  try {
    if (typeof activeTab !== 'undefined' && activeTab && activeTab !== 'dashboard') return false;
    var pane = document.getElementById('tab-dashboard');
    if (pane && !pane.classList.contains('active')) return false;
    return true;
  } catch (_) {
    return true;
  }
}

function bpHideChartTooltip() {
  try {
    var tip = document.getElementById('chart-tooltip');
    if (tip) {
      tip.style.opacity = '0';
      tip.style.pointerEvents = 'none';
      tip.classList.remove('is-rich');
      tip.innerHTML = '';
      tip.setAttribute('aria-hidden', 'true');
    }
    if (typeof _chartSelectedIdx !== 'undefined') _chartSelectedIdx = null;
  } catch (_) {}
}

function bpConfineChartTooltipPosition(left, top, tip) {
  // Mantém o tooltip dentro da área do gráfico / tab dashboard, acima da nav (72px+)
  try {
    var wrap = document.getElementById('dash-chart-canvas-wrap')
      || document.getElementById('tab-dashboard')
      || document.body;
    var navH = 80;
    try {
      var nav = document.querySelector('.bottom-nav');
      if (nav) navH = Math.max(72, nav.getBoundingClientRect().height + 8);
    } catch (_) {}
    var maxBottom = window.innerHeight - navH - 8;
    var tipW = (tip && tip.offsetWidth) ? tip.offsetWidth : 200;
    var tipH = (tip && tip.offsetHeight) ? tip.offsetHeight : 120;
    var L = Math.min(window.innerWidth - tipW - 8, Math.max(8, left));
    var T = Math.min(maxBottom - tipH, Math.max(8, top));
    // Se o wrap do gráfico existe, preferir ficar sobre ele
    if (wrap && wrap.getBoundingClientRect) {
      var r = wrap.getBoundingClientRect();
      if (r.width > 40 && r.height > 40) {
        L = Math.min(r.right - 12 - tipW, Math.max(r.left + 8, L));
        T = Math.min(r.bottom - 8 - Math.min(tipH, r.height * 0.9), Math.max(r.top + 8, T));
      }
    }
    return { left: L, top: T };
  } catch (_) {
    return { left: left, top: top };
  }
}

if (typeof window !== 'undefined') {
  window.bpHideChartTooltip = bpHideChartTooltip;
  window.bpChartIsDashboardActive = bpChartIsDashboardActive;
}


/** JS-6.1: detalheDia via boundary ESM ou legado */

function _bpGetAnaliseParaExport() {
  if (typeof window !== 'undefined' && typeof window.__BP_getAnaliseParaExport === 'function') {
    var fn = window.__BP_getAnaliseParaExport();
    if (typeof fn === 'function') return fn;
  }
  return typeof analiseParaExport === 'function' ? analiseParaExport : null;
}
function _bpGetDetalheDiaVendas() {
  if (typeof window !== 'undefined' && typeof window.__BP_getDetalheDiaVendas === 'function') {
    var fn = window.__BP_getDetalheDiaVendas();
    if (typeof fn === 'function') return fn;
  }
  return typeof detalheDiaVendas === 'function' ? detalheDiaVendas : null;
}
function abrirChartDrill(dataIso, horaOpt) {
  // Contingência: drill só faz sentido no Resumo
  if (typeof bpChartIsDashboardActive === 'function' && !bpChartIsDashboardActive()) {
    if (typeof bpHideChartTooltip === 'function') bpHideChartTooltip();
    return;
  }
  var _bpDet = _bpGetDetalheDiaVendas();
  if (!dataIso || typeof _bpDet !== 'function') return;
  var det = _bpDet(dataIso, (state && state.movimentos) || [], {
    hora: horaOpt != null && isFinite(horaOpt) ? Number(horaOpt) : undefined
  });
  var title = document.getElementById('chart-drill-title');
  var sub = document.getElementById('chart-drill-sub');
  var drillBody = document.getElementById('chart-drill-body');
  if (!drillBody) return;
  if (!det || !det.totais) return;

  var dataLabel = dataIso;
  if (typeof formatarDataCurta === 'function') dataLabel = formatarDataCurta(dataIso);
  try {
    var dFull = new Date(dataIso + 'T12:00:00');
    dataLabel = dFull.toLocaleDateString('pt-AO', { weekday: 'long', day: '2-digit', month: 'long' });
  } catch (_) {}

  if (title) {
    title.textContent = (det.hora != null)
      ? ('Detalhe · ' + String(det.hora).padStart(2, '0') + 'h')
      : 'Detalhe do dia';
  }
  if (sub) {
    sub.textContent = dataLabel + (det.hora != null ? (' · ' + String(det.hora).padStart(2, '0') + 'h') : '');
  }

  function listBlock(titulo, rows, nameKey) {
    nameKey = nameKey || 'nome';
    if (!rows || !rows.length) {
      return '<div class="chart-drill-section"><div class="chart-drill-sec-head">' + _escChart(titulo) + '</div><p class="chart-drill-empty">Sem dados neste período</p></div>';
    }
    var lis = rows.map(function (r) {
      var n = r.n || 0;
      var meta = n === 1 ? '1 registo' : (n + ' registos');
      return '<li class="chart-drill-row">' +
        '<div class="chart-drill-row-main">' +
          '<span class="chart-drill-row-name">' + _escChart(r[nameKey] || r.nome || '—') + '</span>' +
          '<span class="chart-drill-row-meta">' + meta + '</span>' +
        '</div>' +
        '<strong class="chart-drill-row-val">' + _escChart(_fmtChart(r.receita)) + '</strong>' +
      '</li>';
    }).join('');
    return '<div class="chart-drill-section"><div class="chart-drill-sec-head">' + _escChart(titulo) + '</div><ul class="chart-drill-list">' + lis + '</ul></div>';
  }

  var vendasLis = (det.vendas || []).map(function (m) {
    var hora = (m.hora || '').toString().slice(0, 5);
    var srv = m.servico_nome || m.servico || m.descricao || 'Venda';
    var cli = m.cliente || 'Avulso';
    var prof = (typeof getProfissionalNome === 'function' && m.profissional_id)
      ? getProfissionalNome(m.profissional_id)
      : (m.profissional || '');
    var pay = m.metodoPagamento || m.pagamento || '';
    var meta = [cli, prof, pay].filter(Boolean).join(' · ');
    return '<li class="chart-drill-row">' +
      '<div class="chart-drill-row-main">' +
        '<span class="chart-drill-row-name">' + _escChart((hora ? hora + ' · ' : '') + srv) + '</span>' +
        (meta ? '<span class="chart-drill-row-meta">' + _escChart(meta) + '</span>' : '') +
      '</div>' +
      '<strong class="chart-drill-row-val">' + _escChart(_fmtChart(m.valor)) + '</strong>' +
    '</li>';
  }).join('');

  var vsHtml = '';
  if (det.vsMesmoDiaSemana && det.vsMesmoDiaSemana.pct != null) {
    var p = det.vsMesmoDiaSemana.pct;
    var sign = p >= 0 ? '+' : '';
    vsHtml = '<div class="chart-drill-vs">' +
      '<span>Vs mesmo dia da semana</span>' +
      '<strong class="' + (p >= 0 ? 'is-up' : 'is-down') + '">' + sign + (Math.round(p * 10) / 10) + '%</strong>' +
    '</div>';
  }

  drillBody.innerHTML =
    '<div class="chart-drill-kpis">' +
      '<div class="chart-drill-kpi"><span>Receita</span><strong>' + _escChart(_fmtChart(det.totais.receita)) + '</strong></div>' +
      '<div class="chart-drill-kpi"><span>Vendas</span><strong>' + det.totais.nVendas + '</strong></div>' +
      '<div class="chart-drill-kpi"><span>Ticket</span><strong>' + _escChart(_fmtChart(det.totais.ticket)) + '</strong></div>' +
    '</div>' +
    vsHtml +
    '<div class="chart-drill-section"><div class="chart-drill-sec-head">Vendas</div>' +
      (vendasLis
        ? '<ul class="chart-drill-list">' + vendasLis + '</ul>'
        : '<p class="chart-drill-empty">Nenhuma venda neste intervalo</p>') +
    '</div>' +
    listBlock('Clientes', det.porCliente) +
    listBlock('Serviços', det.porServico) +
    listBlock('Profissionais', det.porProfissional) +
    listBlock('Pagamentos', det.porPagamento);

  if (typeof openModal === 'function') openModal('modal-chart-drill');
  else {
    var el = document.getElementById('modal-chart-drill');
    if (el) { el.classList.add('open'); el.style.display = 'flex'; }
  }
}

function fecharChartDrill() {
  if (typeof closeModal === 'function') closeModal('modal-chart-drill');
  else {
    var el = document.getElementById('modal-chart-drill');
    if (el) { el.classList.remove('open'); el.style.display = ''; }
  }
}



function actualizarDashChartInsights(analise) {
  var ul = document.getElementById('dash-chart-insights');
  if (!ul) return;
  var list = (analise && analise.insights) || [];
  if (!list.length) {
    ul.hidden = true;
    ul.innerHTML = '';
    return;
  }
  ul.hidden = false;
  if (window._chartShowInsights) ul.classList.add('is-live');
  else ul.classList.remove('is-live');
  ul.innerHTML = list.map(function (t) {
    return '<li>' + _escChart(t) + '</li>';
  }).join('');
}

function _chartShowSkeleton(on) {
  var sk = document.getElementById('dash-chart-skeleton');
  var canvas = document.getElementById('weekly-chart');
  if (sk) {
    sk.hidden = !on;
    sk.setAttribute('aria-hidden', on ? 'false' : 'true');
  }
  if (canvas) canvas.style.opacity = on ? '0.25' : '1';
}



function exportarAnalisePdf(analise) {
  var a = analise || window.__bpUltimaAnaliseTemporal;
  var fmt = typeof fmtKz === 'function' ? fmtKz : function (n) { return Math.round(Number(n) || 0) + ' Kz'; };
  if (!a || !a.totais) {
    if (typeof toast === 'function') toast('Não há dados para exportar.', 'warning');
    return;
  }
  var label = (a.intervalo && a.intervalo.label) || (a.meta && a.meta.label) || 'Período';
  var body =
    '<h1 style="font-size:18px;margin:0 0 8px;">BeautyPro — Análise de vendas</h1>' +
    '<p style="color:#555;font-size:12px;">' + String(label).replace(/</g,'&lt;') + '</p>' +
    '<table style="width:100%;font-size:13px;border-collapse:collapse;">' +
    '<tr><td>Receita</td><td style="text-align:right;"><strong>' + fmt(a.totais.receita) + '</strong></td></tr>' +
    '<tr><td>Vendas</td><td style="text-align:right;"><strong>' + a.totais.nVendas + '</strong></td></tr>' +
    '<tr><td>Ticket</td><td style="text-align:right;"><strong>' + fmt(a.totais.ticket) + '</strong></td></tr>' +
    '</table>' +
    '<p style="margin-top:20px;font-size:10px;color:#888;">' + new Date().toLocaleString('pt-AO') + '</p>';
  var w = window.open('', '_blank', 'noopener,noreferrer,width=720,height=900');
  if (!w) {
    if (typeof toast === 'function') toast('Permita pop-ups para PDF', 'error');
    return;
  }
  w.document.open();
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Análise</title></head><body style="font-family:system-ui;padding:24px;">' + body +
    '<script>window.onload=function(){setTimeout(function(){window.print();},250);}<\\/script></body></html>');
  w.document.close();
}

function exportarAnaliseCsv(analise) {
  /* Ponto 4 — mesma convenção BeautyPro que Gestao ( ; + UTF-8 BOM + meta ). */
  var _bpExp = _bpGetAnaliseParaExport();
  var payload = typeof _bpExp === 'function'
    ? _bpExp(analise || window.__bpUltimaAnaliseTemporal)
    : null;
  if (!payload || !payload.serie) {
    if (typeof toast === 'function') toast('Não há dados para exportar.', 'warning');
    return;
  }
  function esc(v) {
    var s = String(v == null ? '' : v);
    if (/[";\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  var meta = payload.meta || {};
  var totais = payload.totais || {};
  var inicio = meta.inicio || '';
  var fim = meta.fim || '';
  var label = (meta.label || meta.labelComDatas || '').replace(/\s+/g, ' ').trim();
  var lines = [
    '# BeautyPro export',
    '# tipo=analise_temporal',
    '# periodo=' + label,
    '# inicio=' + inicio,
    '# fim=' + fim,
    '# criterio_vendas=validas (mesma regra do Resumo)',
    '# gerado=' + new Date().toISOString(),
    ['data', 'label', 'receita', 'vendas', 'ticket'].join(';')
  ];
  payload.serie.forEach(function (p) {
    lines.push([
      p.data || '',
      p.label || '',
      p.receita || 0,
      p.nVendas || 0,
      Math.round((p.ticket || 0) * 100) / 100
    ].map(esc).join(';'));
  });
  lines.push('');
  lines.push(['RESUMO_OFICIAL', 'faturamento_validas', Math.round(totais.receita || 0), 'vendas_validas', totais.nVendas || 0, 'ticket', Math.round((totais.ticket || 0) * 100) / 100].map(esc).join(';'));
  var blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  var dia = (fim || inicio || new Date().toISOString().slice(0, 10)).toString().slice(0, 10);
  a.download = 'BeautyPro-analise-' + dia + '.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    URL.revokeObjectURL(url);
    a.remove();
  }, 500);
  if (typeof toast === 'function') toast('CSV BeautyPro exportado.', 'success');
}


/** P2.1 — escala Y “nice” (ex.: 5k, 10k, 20k) */
function _bpChartNiceMax(rawMax) {
  var m = Number(rawMax) || 0;
  if (m <= 0) return 1000;
  var exp = Math.pow(10, Math.floor(Math.log(m) / Math.LN10));
  var n = m / exp;
  var nice;
  if (n <= 1) nice = 1;
  else if (n <= 2) nice = 2;
  else if (n <= 5) nice = 5;
  else nice = 10;
  var out = nice * exp;
  /* margem mínima para o topo não colar na barra */
  if (out < m * 1.05) out = nice * exp * (nice >= 10 ? 1 : 2);
  if (out < m) out = Math.ceil(m / exp) * exp;
  return out;
}

function _bpChartYTicks(scaleMax, count) {
  count = count || 4;
  var ticks = [];
  var step = scaleMax / count;
  for (var i = 0; i <= count; i++) ticks.push(step * i);
  return ticks;
}

function _bpChartP() {
  return (typeof window !== 'undefined' && window.bpChartResPolicy) ? window.bpChartResPolicy : null;
}

function _bpChartPeriodDays(intervalo) {
  var P = _bpChartP();
  var ini = intervalo && intervalo.inicio;
  var fim = intervalo && intervalo.fim;
  var fn = (typeof _atDiasEntre === 'function') ? _atDiasEntre : null;
  if (P) return P.periodDays(ini, fim, fn);
  if (!ini || !fim) return 0;
  if (fn) return fn(ini, fim);
  return 0;
}

function _bpChartResApplies(tipo, dias, modoHora) {
  var P = _bpChartP();
  if (P) return P.resApplies(tipo, dias, modoHora);
  if (modoHora || tipo === 'hora' || tipo === 'dia') return false;
  return (parseInt(dias, 10) || 0) >= 13;
}

function _bpChartResLimits(tipo, dias) {
  var P = _bpChartP();
  if (P) return P.resLimits(tipo, dias);
  var max = Math.max(1, parseInt(dias, 10) || 1);
  return { min: Math.min(12, max), max: max, applies: max >= 13 };
}

function _bpChartResolveBars(tipo, dias, modoHora) {
  var P = _bpChartP();
  if (!_bpChartResApplies(tipo, dias, modoHora)) {
    if (state) state.chartResBars = 0;
    return 0;
  }
  var raw = parseInt(state && state.chartResBars, 10) || 0;
  var next = P ? P.clampRes(raw, tipo, dias, modoHora) : raw;
  if (state) state.chartResBars = next;
  return next;
}

function _bpChartFmtAxis(v) {
  v = Number(v) || 0;
  if (v >= 1000000) {
    var m = v / 1000000;
    return (Math.abs(m - Math.round(m)) < 0.05 ? String(Math.round(m)) : m.toFixed(1)) + 'M';
  }
  if (v >= 1000) {
    var k = v / 1000;
    return (Math.abs(k - Math.round(k)) < 0.05 ? String(Math.round(k)) : k.toFixed(1)) + 'k';
  }
  return String(Math.round(v));
}

function _bpChartDrawYAxis(ctx, opts) {
  var padL = opts.padL, padR = opts.padR, width = opts.width;
  var baseY = opts.baseY, plotH = opts.plotH, scaleMax = opts.scaleMax;
  var textMuted = opts.textMuted, textPrimary = opts.textPrimary;
  var ticks = _bpChartYTicks(scaleMax, 4);
  ctx.save();
  for (var i = 0; i < ticks.length; i++) {
    var tv = ticks[i];
    var y = baseY - (scaleMax > 0 ? (tv / scaleMax) * plotH : 0);
    y = Math.round(y) + 0.5;
    /* linha de cascata */
    ctx.strokeStyle = textMuted;
    ctx.globalAlpha = tv === 0 ? 0.4 : 0.18;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(width - padR, y);
    ctx.stroke();
    if (opts.skipLabels) continue;
    var lab = _bpChartFmtAxis(tv);
    ctx.globalAlpha = 1;
    ctx.font = '600 9px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1C1A18';
    ctx.fillText(lab, padL - 4, y);
  }
  ctx.restore();
}

function _bpChartPaintYOverlay(opts) {
  var ov = document.getElementById('dash-chart-yaxis');
  if (!ov || !opts) return;
  var h = opts.height || 220;
  var w = 28;
  var dpr = 1;
  try { dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1)); } catch (_) { dpr = 1; }
  ov.width = Math.round(w * dpr);
  ov.height = Math.round(h * dpr);
  ov.style.width = w + 'px';
  ov.style.height = h + 'px';
  var octx = ov.getContext('2d');
  if (!octx) return;
  try { octx.setTransform(dpr, 0, 0, dpr, 0, 0); } catch (_) {}
  octx.clearRect(0, 0, w, h);
  var bg = opts.bg || '#ffffff';
  octx.fillStyle = bg;
  octx.fillRect(0, 0, w, h);
  var ticks = _bpChartYTicks(opts.scaleMax, 4);
  var baseY = opts.baseY, plotH = opts.plotH, scaleMax = opts.scaleMax;
  octx.font = '600 9px system-ui, -apple-system, sans-serif';
  octx.textAlign = 'right';
  octx.textBaseline = 'middle';
  octx.fillStyle = '#1C1A18';
  for (var i = 0; i < ticks.length; i++) {
    var tv = ticks[i];
    var y = baseY - (scaleMax > 0 ? (tv / scaleMax) * plotH : 0);
    octx.fillText(_bpChartFmtAxis(tv), w - 6, y);
  }
}

function _bpChartSetRes(next, tipo, dias) {
  var lim = _bpChartResLimits(tipo, dias);
  next = parseInt(next, 10) || lim.min;
  if (next < lim.min) next = lim.min;
  if (next > lim.max) next = lim.max;
  if (!state) return next;
  if (state.chartResBars === next) return next;
  state.chartResBars = next;
  try { localStorage.setItem('bp_chart_res', String(next)); } catch (_) {}
  return next;
}

function _bpChartShowResPct(res, min, max, applies) {
  var el = document.getElementById('dash-chart-res-pct');
  if (!el) return;
  if (!applies) {
    el.hidden = true;
    el.classList.remove('is-on');
    el.textContent = '';
    return;
  }
  var P = _bpChartP();
  var pct = P ? P.resPercent(res, min, max) : 0;
  el.textContent = pct + '%';
  el.hidden = false;
  el.classList.add('is-on');
  clearTimeout(_bpChartShowResPct._t);
  _bpChartShowResPct._t = setTimeout(function () {
    el.classList.remove('is-on');
    el.hidden = true;
  }, 900);
}

function _bpChartPlaceResThumb(res, min, max) {
  var thumb = document.getElementById('dash-chart-res-thumb');
  if (!thumb) return;
  min = Number(min) || 12;
  max = Number(max) || min;
  res = Number(res) || min;
  if (max <= min) {
    thumb.style.top = '10px';
    return;
  }
  /* top da faixa = padT(10); fundo = baseY (220-28=192) — bolinha centrada */
  var trackTop = 10;
  var trackBot = 192;
  var t = (res - min) / (max - min);
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  var y = trackTop + (1 - t) * (trackBot - trackTop) - 7;
  thumb.style.top = Math.round(y) + 'px';
}

function _bpChartSyncResRail(tipo, dias, res, modoHora) {
  var rail = document.getElementById('dash-chart-res-rail');
  if (!rail) return;
  var on = _bpChartResApplies(tipo, dias, modoHora);
  rail.hidden = !on;
  rail.setAttribute('aria-hidden', on ? 'false' : 'true');
  if (!on) {
    _bpChartShowResPct(0, 0, 0, false);
    return;
  }
  var lim = _bpChartResLimits(tipo, dias);
  var cur = res > 0 ? res : lim.min;
  _bpChartPlaceResThumb(cur, lim.min, lim.max);
  if (rail._bpBound) return;
  rail._bpBound = true;
  var startY = null, startRes = 0, lastNxt = 0;
  function stopAll(e) {
    if (e.cancelable) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }
  rail.addEventListener('touchstart', function (e) {
    if (!e.touches || !e.touches.length) return;
    stopAll(e);
    startY = e.touches[0].clientY;
    startRes = parseInt(state && state.chartResBars, 10) || 12;
    lastNxt = startRes;
    rail.classList.add('is-dragging');
  }, { passive: false });
  rail.addEventListener('touchmove', function (e) {
    if (startY == null || !e.touches || !e.touches.length) return;
    stopAll(e);
    var dy = e.touches[0].clientY - startY;
    /* subir (dy<0) → mais barras (até período); descer → até 12 */
    var acc = Math.round(-dy / 14);
    var tipoNow = state && state.chartPeriodo;
    var iv = (typeof getIntervaloChartAtual === 'function') ? getIntervaloChartAtual() : null;
    var dNow = _bpChartPeriodDays(iv);
    if (!_bpChartResApplies(tipoNow, dNow, false)) {
      _bpChartShowResPct(0, 0, 0, false);
      return;
    }
    var limNow = _bpChartResLimits(tipoNow, dNow);
    var nxt = _bpChartSetRes(startRes + acc, tipoNow, dNow);
    lastNxt = nxt;
    _bpChartPlaceResThumb(nxt, limNow.min, limNow.max);
    _bpChartShowResPct(nxt, limNow.min, limNow.max, true);
  }, { passive: false });
  rail.addEventListener('touchend', function (e) {
    stopAll(e);
    startY = null;
    rail.classList.remove('is-dragging');
    if (typeof renderizarGrafico === 'function') renderizarGrafico({ force: true });
  }, { passive: false });
  rail.addEventListener('touchcancel', function () {
    startY = null;
    rail.classList.remove('is-dragging');
  }, { passive: true });
}

/** Navegação por swipe no gráfico (não altera eixos).
 *  7dias/30dias/90dias → chartSpanDays (7→8→9…)
 *  semana/mes/ano/dia → chartOffset
 *  dir>0 avançar (esquerda); dir<0 recuar (direita)
 */
function _bpChartSwipeStep(dir) {
  if (!state) return false;
  var tipo = state.chartPeriodo || 'semana';
  var baseFn = (typeof _bpChartBaseSpan === 'function') ? _bpChartBaseSpan
    : (typeof window !== 'undefined' && window._bpChartBaseSpan) ? window._bpChartBaseSpan
    : null;
  var clampFn = (typeof _bpChartClampSpan === 'function') ? _bpChartClampSpan
    : (typeof window !== 'undefined' && window._bpChartClampSpan) ? window._bpChartClampSpan
    : null;
  var base = baseFn ? baseFn(tipo) : 0;
  if (base) {
    var cur = clampFn ? clampFn(tipo, state.chartSpanDays || base) : Math.max(base, Number(state.chartSpanDays) || base);
    var next = cur + (dir > 0 ? 1 : -1);
    if (next < 1) next = 1;
    if (next > 120) next = 120;
    if (next === cur) return false;
    state.chartSpanDays = next;
    try { localStorage.setItem('bp_chart_span', String(next)); } catch (_) {}
    return true;
  }
  var off = Number(state.chartOffset) || 0;
  var nextOff = off + (dir > 0 ? 1 : -1);
  if (nextOff < 0) nextOff = 0;
  if (nextOff === off) return false;
  state.chartOffset = nextOff;
  try { localStorage.setItem('bp_chart_offset', String(nextOff)); } catch (_) {}
  return true;
}

function _bpChartAfterSwipeNavigate() {
  try {
    if (typeof getIntervaloChartAtual === 'function' && typeof _bpSyncPeriodLabels === 'function') {
      var iv = getIntervaloChartAtual();
      if (iv && iv.label) _bpSyncPeriodLabels(iv.label, { chart: true });
    }
  } catch (_) {}
  try { _chartSelectedIdx = null; } catch (_) {}
  if (typeof renderizarGrafico === 'function') renderizarGrafico();
}

/** Pan horizontal robusto no contentor do gráfico (Spck/Android). */
function _bpBindChartHScroll(scrollEl, canvas) {
  if (!scrollEl || scrollEl._bpHScrollBound) return;
  scrollEl._bpHScrollBound = true;
  var startX = null, startLeft = 0;
  scrollEl.addEventListener('touchstart', function (e) {
    if (!canvas || !canvas._bpChartScrollX) return;
    if (!e.touches || !e.touches.length) return;
    startX = e.touches[0].clientX;
    startLeft = scrollEl.scrollLeft;
  }, { passive: true });
  scrollEl.addEventListener('touchmove', function (e) {
    if (startX == null || !canvas || !canvas._bpChartScrollX) return;
    if (!e.touches || !e.touches.length) return;
    var dx = e.touches[0].clientX - startX;
    scrollEl.scrollLeft = startLeft - dx;
    if (e.cancelable) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
  }, { passive: false });
  scrollEl.addEventListener('touchend', function () {
    startX = null;
  }, { passive: true });
}

function renderizarGrafico(opts) {
  opts = opts || {};
  const canvas = document.getElementById('weekly-chart');
  if (!canvas) return;
  /* Coalesce: vários triggers no mesmo frame → um paint */
  if (!opts.force && !opts._flushed) {
    if (renderizarGrafico._coalesce) return;
    renderizarGrafico._coalesce = true;
    requestAnimationFrame(function () {
      renderizarGrafico._coalesce = false;
      renderizarGrafico(Object.assign({}, opts, { _flushed: true, force: true }));
    });
    return;
  }
  const parent = canvas.parentElement;
  const tabDash = document.getElementById('tab-dashboard');
  const tabVisivel = !tabDash || tabDash.classList.contains('active');
  let parentWidth = 0;
  try {
    parentWidth = parent ? parent.getBoundingClientRect().width : 0;
  } catch (_) { parentWidth = 0; }
  /* Tab oculta ou layout ainda a 0 → adiar (evita gráfico “desaparecido”) */
  if (tabVisivel && parentWidth < 40) {
    if (!renderizarGrafico._retry) {
      renderizarGrafico._retry = true;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          renderizarGrafico._retry = false;
          renderizarGrafico({ force: true, _flushed: true });
        });
      });
    }
    return;
  }
  if (!tabVisivel) {
    /* Guarda pedido para quando a aba Resumo voltar a abrir */
    renderizarGrafico._pending = true;
    return;
  }
  renderizarGrafico._pending = false;

  const ctx = canvas.getContext('2d');
  const height = 220;
  var wrapRoot = document.getElementById('dash-chart-canvas-wrap');
  var scrollEl = document.getElementById('dash-chart-scroll');
  try {
    if (wrapRoot) parentWidth = wrapRoot.getBoundingClientRect().width || parentWidth;
  } catch (_) {}
  /* Largura de layout do contentor (viewport — Y fixo; só o scroll interno anda). */
  let layoutW = Math.max(parentWidth || 0, 200);
  try {
    canvas.style.height = height + 'px';
    canvas.style.display = 'block';
    canvas.style.touchAction = 'pan-x';
  } catch (_ta) {}
  try {
    if (wrapRoot) {
      wrapRoot.style.overflow = 'hidden';
      wrapRoot.style.maxWidth = '100%';
    }
    if (scrollEl) {
      scrollEl.style.overflowX = 'auto';
      scrollEl.style.overflowY = 'hidden';
      scrollEl.style.webkitOverflowScrolling = 'touch';
      scrollEl.style.touchAction = 'pan-x';
    }
  } catch (_w) {}
  if (parent) {
    try { parent.style.minHeight = height + 'px'; } catch (_) {}
  }
  /* width lógico final é definido depois de saber n (barras); placeholder para clear */
  let width = layoutW;

  const intervalo = (typeof getIntervaloChartAtual === 'function')
    ? getIntervaloChartAtual()
    : ((typeof getIntervaloDashAtual === 'function')
      ? getIntervaloDashAtual()
      : { inicio: (typeof hoje === 'function' ? hoje() : ''), fim: (typeof hoje === 'function' ? hoje() : ''), label: 'Hoje' });
  /* Dia único: série por hora (evita 1 barra). chartPeriodo==='hora' força o mesmo. */
  var _singleDay = !!(intervalo && intervalo.inicio && intervalo.fim && intervalo.inicio === intervalo.fim);
  const modoHora = (state.chartPeriodo === 'hora') || _singleDay;
  const mostrarValores = state.chartMostrarValores || false;
  const movs = state.movimentos || [];
  const dashOff = state.chartOffset || 0;

  try {
    if (intervalo && intervalo.label && typeof _bpSyncPeriodLabels === 'function') {
      _bpSyncPeriodLabels(intervalo.label, { chart: true });
    }
  } catch (_lab) {}

  // Série temporal do gráfico (intervalo = chart, não dash)
  // Reutiliza última análise se só mudou selecção de barra (evita re-scan de movimentos)
  let analise = null;
  var _tipoChart = (state && state.chartPeriodo) ? state.chartPeriodo : '';
  var _cacheKey = (intervalo && intervalo.inicio ? intervalo.inicio : '') + '|' +
    (intervalo && intervalo.fim ? intervalo.fim : '') + '|' +
    (modoHora ? 'h' : 'd') + '|' + (movs ? movs.length : 0) + '|' +
    _tipoChart + '|' +
    (state && state.chartSpanDays ? state.chartSpanDays : '');
  if (opts.selectionOnly && window.__bpUltimaAnaliseTemporal && renderizarGrafico._cacheKey === _cacheKey) {
    analise = window.__bpUltimaAnaliseTemporal;
  } else if (typeof buildAnaliseTemporal === 'function') {
    var diaRefHora = null;
    if (modoHora) {
      if (intervalo.inicio && intervalo.inicio === intervalo.fim) diaRefHora = intervalo.inicio;
      else if (typeof hoje === 'function') diaRefHora = hoje();
      else diaRefHora = intervalo.fim;
    }
    analise = buildAnaliseTemporal(intervalo, movs, {
      modoHora: modoHora,
      diaRef: diaRefHora
    });
    renderizarGrafico._cacheKey = _cacheKey;
  }
  if (typeof actualizarDashChartExec === 'function') {
    try { actualizarDashChartExec(analise); } catch (eExec) { console.warn('[chart-exec]', eExec); }
  }
  try { actualizarDashChartInsights(analise); } catch (eIns) { console.warn('[chart-insights]', eIns); }


  let labels = [];
  let dados = [];
  let maxVal = 1;
  if (analise && analise.serie && analise.serie.length) {
    labels = analise.serie.map(function (p) { return p.label; });
    dados = analise.serie.map(function (p) { return Number(p.receita) || 0; });
    maxVal = 1;
    for (let i = 0; i < dados.length; i++) if (dados[i] > maxVal) maxVal = dados[i];
  }

  const hasData = !!(analise && analise.hasData) || dados.some(function (v) { return Number(v) > 0; });
  maxVal = Math.max(maxVal, 1);
  /* escala Y = máximo real da série (nunca o valor a meio da animação) */
  var scaleSourceMax = maxVal;
  // Micro-animação de entrada (≤300ms) — só altura das barras
  const animP = Math.max(0, Math.min(1, _chartAnimProgress));
  if (animP < 1) {
    dados = dados.map(function (v) { return v * animP; });
  }

  const emptyEl = document.getElementById('dash-chart-empty');
  if (emptyEl) {
    emptyEl.hidden = hasData;
    emptyEl.setAttribute('aria-hidden', hasData ? 'true' : 'false');
  }
  // Guardar último modelo para fases seguintes (tooltip / drill-down)
  try { window.__bpUltimaAnaliseTemporal = analise;
  try { _bpUpdateChartHealth(analise); } catch (_h) {} } catch (_) {}
  try { _chartShowSkeleton(false); } catch (_) {}


  // Tokens CSS (fallback seguro)
  const cs = (typeof getComputedStyle === 'function') ? getComputedStyle(document.documentElement) : null;
  const tok = function (name, fb) {
    try { const v = cs && cs.getPropertyValue(name); return (v && v.trim()) || fb; } catch (_) { return fb; }
  };
  const gold = tok('--gold', '#D4AF37');
  const goldDark = tok('--gold-600', tok('--gold-dark', '#A7872B'));
  const mutedBar = tok('--border-soft', '#DCD5C9');
  const textMuted = tok('--text-muted', '#8c8980');
  const textPrimary = tok('--text-primary', '#1C1A18');

  const n = Math.max(labels.length, 1);
  /* Eixo Y encostado à esquerda; padB curto (menos vazio até aos insights) */
  const padL = 22;
  const padR = 10;
  const padB = 16;
  const padT = 8;
  const baseY = height - padB;
  const plotH = Math.max(40, height - padT - padB);
  const scaleMax = _bpChartNiceMax(scaleSourceMax);
  /* Viewport telemóvel: 12 slots visíveis (contrato do gráfico anual).
     n>12 → canvas mais largo; só #dash-chart-scroll anda no X. */
  const VIEW_SLOTS = 12;
  var plotViewport = Math.max(40, layoutW - padL - padR);
  var viewSlot = plotViewport / VIEW_SLOTS;
  const FIXED_SLOT = viewSlot;
  const FIXED_BAR = Math.max(10, Math.min(28, viewSlot * 0.62));
  const FIXED_GAP = Math.max(3, viewSlot - FIXED_BAR);
  /* Hora/dia exacto: cabem no ecrã (contrato intocável). Scroll-x só séries longas. */
  /* Scroll-x sempre que houver mais barras que as slots do ecrã (hora exacta cabe) */
  var useFixed = !modoHora && n > VIEW_SLOTS;
  /* Rótulos X: densos → amostrar; nunca esconder todos (bug mobile n>16). */
  /* Contrato: todos os números do eixo X na ordem (1,2,3…), sem saltos */
  function _bpDrawXLabel(i) {
    return true;
  }
  var slot, barW, gap, groupW, startX, plotW;
  if (useFixed) {
    slot = FIXED_SLOT;
    barW = FIXED_BAR;
    gap = FIXED_GAP;
    groupW = n * barW + (n - 1) * gap;
    width = Math.max(layoutW, padL + groupW + padR + 8);
    plotW = width - padL - padR;
    startX = padL;
  } else {
    width = layoutW;
    plotW = Math.max(40, width - padL - padR);
    slot = plotW / n;
    barW = Math.min(40, Math.max(6, slot - 6));
    gap = Math.min(8, Math.max(3, (slot - barW)));
    groupW = n * barW + (n - 1) * gap;
    startX = padL + Math.max(0, (plotW - groupW) / 2);
  }

  /* Aplicar tamanho UMA vez + DPR (evita borrão e “tamanho que sobe sozinho”) */
  var dpr = 1;
  try {
    dpr = Math.min(2, Math.max(1, (window.devicePixelRatio || 1)));
  } catch (_) { dpr = 1; }
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  try {
    if (useFixed && width > layoutW + 1) {
      canvas.style.width = Math.round(width) + 'px';
      canvas.style.maxWidth = 'none';
      canvas.style.minWidth = Math.round(width) + 'px';
    } else {
      canvas.style.width = '100%';
      canvas.style.maxWidth = '100%';
      canvas.style.minWidth = '0';
    }
    canvas.style.height = height + 'px';
    /* Flag para touch: com scroll-x não interceptar pan horizontal (período) */
    canvas._bpChartScrollX = !!useFixed && width > layoutW + 1;
    canvas._bpChartResMode = false;
  } catch (_) {}
  try {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  } catch (_) {
    try { ctx.scale(dpr, dpr); } catch (_s) {}
  }
  ctx.clearRect(0, 0, width, height);
  try {
    var scrollReset = document.getElementById('dash-chart-scroll') || document.getElementById('dash-chart-canvas-wrap') || parent;
    if (scrollReset) {
      if (!useFixed) {
        scrollReset.scrollLeft = 0;
      } else if (!opts.selectionOnly) {
        /* Começar à direita (dias mais recentes); scroll = direita → esquerda */
        var _sk = (intervalo && intervalo.inicio ? intervalo.inicio : '') + '|' +
          (intervalo && intervalo.fim ? intervalo.fim : '') + '|' + n;
        if (renderizarGrafico._scrollKey !== _sk) {
          renderizarGrafico._scrollKey = _sk;
          requestAnimationFrame(function () {
            try {
              scrollReset.scrollLeft = Math.max(0, scrollReset.scrollWidth - scrollReset.clientWidth);
            } catch (_) {}
          });
        }
      }
      _bpBindChartHScroll(scrollReset, canvas);
    }
  } catch (_) {}

  try {
    _bpChartDrawYAxis(ctx, {
      padL: padL, padR: padR, width: width,
      baseY: baseY, plotH: plotH, scaleMax: scaleMax,
      textMuted: textMuted, textPrimary: textPrimary,
      skipLabels: !!document.getElementById('dash-chart-yaxis')
    });
  } catch (_y) {}
  try {
    var cardBg = '#ffffff';
    try {
      var csCard = getComputedStyle(wrapRoot || document.documentElement);
      cardBg = (csCard && (csCard.backgroundColor || csCard.getPropertyValue('background-color'))) || cardBg;
    } catch (_) {}
    _bpChartPaintYOverlay({
      height: height, baseY: baseY, plotH: plotH, scaleMax: scaleMax, bg: cardBg
    });
  } catch (_ov) {}

  // Baseline alinhada ao plot
  ctx.save();
  ctx.strokeStyle = textPrimary;
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 1;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(padL, baseY + 0.5);
  ctx.lineTo(width - padR, baseY + 0.5);
  ctx.stroke();
  ctx.restore();

  // Geometria de hit-test (partilhada com hover)
  const stepX = barW + gap;
  const barRects = [];

  if (!hasData) {
    labels.forEach(function (lab, i) {
      const x = startX + i * stepX + barW / 2;
      ctx.fillStyle = textMuted;
      ctx.font = '9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      if (_bpDrawXLabel(i)) ctx.fillText(lab, x, baseY + 4);
    });
  } else {
    // Validar índice seleccionado
    if (_chartSelectedIdx != null && (_chartSelectedIdx < 0 || _chartSelectedIdx >= labels.length)) {
      _chartSelectedIdx = null;
    }
    const hasSel = _chartSelectedIdx != null;
    const viewMode = _chartViewMode || 'barras';

    // Pontos para linha/área
    const pts = [];
    for (let i = 0; i < labels.length; i++) {
      const x = startX + i * stepX + barW / 2;
      const val = Number(dados[i]) || 0;
      const y = baseY - (val > 0 ? Math.max(3, (val / scaleMax) * plotH) : 0);
      pts.push({ x: x, y: y, val: val, i: i });
    }

    if (viewMode === 'linha' || viewMode === 'area') {
      ctx.save();
      if (viewMode === 'area' && pts.length) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, baseY);
        for (let i = 0; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[pts.length - 1].x, baseY);
        ctx.closePath();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = gold;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
        else ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.strokeStyle = gold;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
      for (let i = 0; i < pts.length; i++) {
        if (pts[i].val <= 0) continue;
        const isSel = hasSel && i === _chartSelectedIdx;
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, isSel ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = isSel ? textPrimary : gold;
        ctx.globalAlpha = (hasSel && !isSel) ? 0.35 : 1;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // labels X (amostrados se densos — sempre legíveis no telemóvel)
      for (let i = 0; i < labels.length; i++) {
        if (!_bpDrawXLabel(i)) continue;
        var labX = labels[i];
        var isHoje = (labX === 'hoje');
        ctx.fillStyle = isHoje ? textPrimary : textMuted;
        ctx.font = (isHoje ? '600 ' : '') + '9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(labX, pts[i].x, baseY + 4);
      }
      ctx.restore();
    }

    if (viewMode === 'barras') for (let i = 0; i < labels.length; i++) {
      const x = startX + i * stepX;
      const val = Number(dados[i]) || 0;
      const barH = val > 0 ? Math.max(3, (val / scaleMax) * plotH) : 0;
      const y = baseY - barH;
      const radius = Math.min(4, barW / 2);
      barRects.push({ x: x, w: barW, i: i, val: val });

      const isSel = hasSel && i === _chartSelectedIdx;
      const dim = hasSel && !isSel;
      ctx.globalAlpha = dim ? 0.32 : 1;

      if (val > 0) {
        const grad = ctx.createLinearGradient(0, y, 0, baseY);
        grad.addColorStop(0, gold);
        grad.addColorStop(1, goldDark);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barW - radius, y);
        ctx.arcTo(x + barW, y, x + barW, y + radius, radius);
        ctx.lineTo(x + barW, baseY);
        ctx.lineTo(x, baseY);
        ctx.lineTo(x, y + radius);
        ctx.arcTo(x, y, x + radius, y, radius);
        ctx.closePath();
        ctx.fill();
        if (isSel) {
          ctx.strokeStyle = textPrimary;
          ctx.lineWidth = 1.25;
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = mutedBar;
        ctx.fillRect(x + barW * 0.25, baseY - 2, barW * 0.5, 2);
      }

      if (_bpDrawXLabel(i)) {
        var labB = labels[i];
        var isHojeB = (labB === 'hoje');
        ctx.fillStyle = isHojeB ? textPrimary : textMuted;
        ctx.font = (isHojeB ? '600 ' : '') + '9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(labB, x + barW / 2, baseY + 4);
      }

      if (mostrarValores && val > 0 && typeof fmtKz === 'function') {
        ctx.fillStyle = textPrimary;
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.textBaseline = 'bottom';
        ctx.fillText(fmtKz(val).replace(' Kz', ''), x + barW / 2, y - 2);
      }
      ctx.globalAlpha = 1;
    }

    /* P2.2 — linha vertical na data/barra seleccionada (clique/tap) */
    if (_chartSelectedIdx != null && _chartSelectedIdx >= 0 && _chartSelectedIdx < n) {
      var sx = null;
      if (typeof pts !== 'undefined' && pts[_chartSelectedIdx]) sx = pts[_chartSelectedIdx].x;
      else sx = startX + _chartSelectedIdx * (barW + gap) + barW / 2;
      if (sx != null) {
        ctx.save();
        ctx.strokeStyle = goldDark || textPrimary;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.25;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(sx + 0.5, padT);
        ctx.lineTo(sx + 0.5, baseY);
        ctx.stroke();
        ctx.setLineDash([]);
        /* marcador no eixo X (data) */
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = goldDark || textPrimary;
        ctx.beginPath();
        ctx.moveTo(sx, baseY + 1);
        ctx.lineTo(sx - 4, baseY + 7);
        ctx.lineTo(sx + 4, baseY + 7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // Linha de média do período (Fase 3) — só se activada no menu ⋯
    var media = (analise && analise.mediaSerie) || 0;
    if (window._chartShowMedia && media > 0 && maxVal > 0) {
      var yMed = baseY - (media / scaleMax) * plotH;
      ctx.save();
      // Média: preta, nítida, mesma espessura
      ctx.strokeStyle = textPrimary;
      ctx.lineWidth = 1;
      ctx.lineCap = 'butt';
      ctx.setLineDash([4, 3]);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(padL, yMed + 0.5);
      ctx.lineTo(width - padR, yMed + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '600 8px system-ui, sans-serif';
      ctx.fillStyle = textPrimary;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('Média', 18, yMed - 2);
      ctx.restore();
      try {
        var _mv = document.getElementById('dash-chart-leg-media-val');
        if (_mv && typeof fmtKz === 'function') _mv.textContent = fmtKz(media);
        else if (_mv) _mv.textContent = String(Math.round(media));
      } catch (_) {}
    } else {
      try {
        var _mv2 = document.getElementById('dash-chart-leg-media-val');
        if (_mv2 && !window._chartShowMedia) { /* leave */ }
      } catch (_) {}
    }

    // Linha de meta (só se meta mensal existir e o período for mensal/comparável)
    try {
      var metaMes = 0;
      if (typeof getMetaSalao === 'function') metaMes = Number(getMetaSalao()) || 0;
      else if (state && state.config && state.config.meta_mensal_salao) metaMes = Number(state.config.meta_mensal_salao) || 0;
      if (metaMes > 0 && !modoHora && analise && analise.serie && analise.serie.length) {
        var diasPeriodo = analise.serie.length;
        // Meta proporcional ao nº de buckets visíveis (aproximação discreta)
        var metaBucket = metaMes / Math.max(diasPeriodo, 1);
        // Só desenhar se estiver dentro da escala (senão polui)
        if (metaBucket > 0 && metaBucket <= scaleMax * 1.35) {
          var yMeta = baseY - (Math.min(metaBucket, scaleMax) / scaleMax) * plotH;
          ctx.save();
          ctx.strokeStyle = gold;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.45;
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.moveTo(16, yMeta + 0.5);
          ctx.lineTo(width - 16, yMeta + 0.5);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = '8px system-ui, sans-serif';
          ctx.fillStyle = goldDark;
          ctx.globalAlpha = 0.7;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          ctx.fillText('Meta', width - 18, yMeta - 2);
          ctx.restore();
        }
      }
    } catch (_metaErr) {}
  }

  const labelEl = document.getElementById('chart-period-label');
  if (labelEl) {
    var _labChart = (intervalo && (intervalo.labelComDatas || intervalo.label)) || 'Período';
    if (modoHora) {
      if (analise && analise.diaRef && typeof formatarDataCurta === 'function') {
        labelEl.textContent = formatarDataCurta(analise.diaRef) + ' · por hora';
      } else {
        labelEl.textContent = ((analise && analise.diaRef) ? analise.diaRef : _labChart) + ' · por hora';
      }
    } else {
      labelEl.textContent = _labChart;
    }
  }

  const tooltip = document.getElementById('chart-tooltip');
  const stepHit = barW + gap;

  function hitIndex(clientX) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(rect.width, 1);
    const mouseX = (clientX - rect.left) * scaleX;
    for (let i = 0; i < labels.length; i++) {
      const x = startX + i * stepHit;
      // área de toque alargada (~44px lógico mínimo)
      const pad = Math.max(0, (22 - barW) / 2);
      if (mouseX >= x - pad && mouseX <= x + barW + pad) return i;
    }
    return -1;
  }

  function showTooltipFor(idx, clientX, clientY) {
    if (typeof bpChartIsDashboardActive === 'function' && !bpChartIsDashboardActive()) {
      if (typeof bpHideChartTooltip === 'function') bpHideChartTooltip();
      return;
    }

    if (!tooltip || idx < 0) return;
    const pt = analise && analise.serie && analise.serie[idx];
    const val = dados[idx] || 0;
    if (!(val > 0) && !(pt && pt.receita > 0)) {
      tooltip.style.opacity = '0';
      return;
    }

    var dataIso = pt && pt.data ? pt.data : null;
    var horaOpt = (pt && pt.hora != null) ? pt.hora : null;
    var det = null;
    var _bpDetTip = _bpGetDetalheDiaVendas();
    if (dataIso && typeof _bpDetTip === 'function' && !modoHora) {
      det = _bpDetTip(dataIso, movs, {});
    } else if (dataIso && typeof _bpDetTip === 'function' && modoHora) {
      det = _bpDetTip(dataIso, movs, { hora: horaOpt });
    }

    var title = labels[idx] || '';
    if (pt && pt.data) {
      try {
        var df = new Date(pt.data + 'T12:00:00');
        title = df.toLocaleDateString('pt-AO', { weekday: 'short', day: '2-digit', month: 'short' });
        if (horaOpt != null) title += ' · ' + String(horaOpt).padStart(2, '0') + 'h';
      } catch (_) {}
    }

    var rows = '';
    var receita = pt ? pt.receita : val;
    var nV = pt ? pt.nVendas : 0;
    var ticket = pt ? pt.ticket : 0;
    rows += '<div class="ct-row"><span>Receita</span><strong>' + _escChart(_fmtChart(receita)) + '</strong></div>';
    if (nV) rows += '<div class="ct-row"><span>Vendas</span><strong>' + nV + '</strong></div>';
    if (nV) rows += '<div class="ct-row"><span>Ticket</span><strong>' + _escChart(_fmtChart(ticket)) + '</strong></div>';
    if (det && det.topProfissional) {
      rows += '<div class="ct-row"><span>Top profissional</span><strong>' + _escChart(det.topProfissional.nome) + '</strong></div>';
    }
    if (det && det.topServico) {
      rows += '<div class="ct-row"><span>Top serviço</span><strong>' + _escChart(det.topServico.nome) + '</strong></div>';
    }
    if (det && det.topPagamento) {
      rows += '<div class="ct-row"><span>Pagamento</span><strong>' + _escChart(det.topPagamento.nome) + '</strong></div>';
    }
    if (pt && pt.anterior && pt.anterior.pct != null && (pt.anterior.receita > 0 || pt.anterior.nVendas > 0)) {
      var s = pt.anterior.pct >= 0 ? '+' : '';
      rows += '<div class="ct-row"><span>vs mesma hora ontem</span><strong>' + s + (Math.round(pt.anterior.pct * 10) / 10) + '%</strong></div>';
    }
    if (det && det.vsMesmoDiaSemana && det.vsMesmoDiaSemana.pct != null && !modoHora) {
      var s2 = det.vsMesmoDiaSemana.pct >= 0 ? '+' : '';
      rows += '<div class="ct-row"><span>vs mesmo dia sem.</span><strong>' + s2 + (Math.round(det.vsMesmoDiaSemana.pct * 10) / 10) + '%</strong></div>';
    }

    var drillAttr = dataIso ? (' data-drill-data="' + _escChart(dataIso) + '"') : '';
    if (horaOpt != null) drillAttr += ' data-drill-hora="' + _escChart(horaOpt) + '"';

    tooltip.classList.add('is-rich');
    tooltip.innerHTML =
      '<div class="ct-title">' + _escChart(title) + '</div>' + rows +
      (dataIso
        ? '<div class="ct-actions"><button type="button" class="ct-drill-btn" id="chart-tooltip-drill"' + drillAttr + '>Ver detalhe</button></div>'
        : '');
    tooltip.style.whiteSpace = 'normal';
    // Só no dashboard; senão não mostrar
    if (typeof bpChartIsDashboardActive === 'function' && !bpChartIsDashboardActive()) {
      bpHideChartTooltip();
      return;
    }
    var left = Math.min(window.innerWidth - 200, Math.max(8, clientX + 8));
    var top = Math.max(8, clientY - 20);
    var confined = typeof bpConfineChartTooltipPosition === 'function'
      ? bpConfineChartTooltipPosition(left, top, tooltip)
      : { left: left, top: top };
    tooltip.style.left = confined.left + 'px';
    tooltip.style.top = confined.top + 'px';
    tooltip.style.opacity = '1';
    tooltip.style.pointerEvents = 'auto';
    tooltip.setAttribute('aria-hidden', 'false');

    var btn = document.getElementById('chart-tooltip-drill');
    if (btn) {
      btn.onclick = function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        // Garante que o toque não propaga para a nav
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        if (typeof bpChartIsDashboardActive === 'function' && !bpChartIsDashboardActive()) {
          bpHideChartTooltip();
          return;
        }
        var d = btn.getAttribute('data-drill-data');
        var h = btn.getAttribute('data-drill-hora');
        if (typeof abrirChartDrill === 'function') {
          abrirChartDrill(d, h != null && h !== '' ? Number(h) : undefined);
        }
        bpHideChartTooltip();
      };
    }
  }

  function selectBar(idx) {
    if (idx < 0 || !(dados[idx] > 0)) {
      if (_chartSelectedIdx != null) {
        _chartSelectedIdx = null;
        if (tooltip) tooltip.style.opacity = '0';
        renderizarGrafico({ selectionOnly: true, force: true, _flushed: true });
      }
      return;
    }
    _chartSelectedIdx = idx;
    renderizarGrafico({ selectionOnly: true, force: true, _flushed: true });
    // tooltip mantém-se via re-bind — mostrar após paint
    requestAnimationFrame(function () {
      // posição aproximada: centro da barra
      const rect = canvas.getBoundingClientRect();
      const scale = rect.width / Math.max(canvas.width, 1);
      const cx = rect.left + (startX + idx * stepHit + barW / 2) * scale;
      const cy = rect.top + 24;
      showTooltipFor(idx, cx, cy);
    });
  }

  if (tooltip) {
    canvas.onmousemove = function (e) {
      const idx = hitIndex(e.clientX);
      if (idx !== -1 && dados[idx] > 0) showTooltipFor(idx, e.clientX, e.clientY);
      else if (_chartSelectedIdx == null) tooltip.style.opacity = '0';
    };
    canvas.onmouseleave = function () {
      if (_chartSelectedIdx == null) tooltip.style.opacity = '0';
    };
    canvas.onclick = function (e) {
      const idx = hitIndex(e.clientX);
      if (idx === _chartSelectedIdx) selectBar(-1);
      else selectBar(idx);
    };
  }

  /* Touch: com canvas largo (30 barras) o pan-x é do wrap — não roubar o gesto.
     Só swipe de período quando o gráfico cabe no ecrã (sem scroll-x). */
  if (!canvas._bpSwipeBound) {
    canvas._bpSwipeBound = true;
    try { canvas.style.touchAction = 'pan-x pan-y'; } catch (_) {}

    canvas.addEventListener('touchstart', function (e) {
      if (!e.touches || e.touches.length === 0) return;
      _chartSwipeStartX = e.touches[0].clientX;
      _chartSwipeStartY = e.touches[0].clientY;
      if (tooltip) {
        var idx0 = hitIndex(e.touches[0].clientX);
        if (idx0 !== -1 && dados[idx0] > 0) showTooltipFor(idx0, e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    canvas.addEventListener('touchmove', function (e) {
      if (!e.touches || e.touches.length === 0) return;
      if (_chartSwipeStartX == null) return;
      /* Scroll-x activo: nunca preventDefault — deixa o wrap rolar com o dedo */
      if (canvas._bpChartScrollX || canvas._bpChartResMode) {
        if (tooltip) tooltip.style.opacity = '0';
        return;
      }
      var tmv = e.touches[0];
      var dxm = tmv.clientX - _chartSwipeStartX;
      var dym = tmv.clientY - _chartSwipeStartY;
      if (Math.abs(dxm) > Math.abs(dym) && Math.abs(dxm) > 10) {
        if (e.cancelable) e.preventDefault();
      }
      if (tooltip) {
        var idm = hitIndex(tmv.clientX);
        if (idm !== -1 && dados[idm] > 0) showTooltipFor(idm, tmv.clientX, tmv.clientY);
        else if (_chartSelectedIdx == null) tooltip.style.opacity = '0';
      }
    }, { passive: false });

    canvas.addEventListener('touchend', function (e) {
      if (_chartSwipeStartX == null || !e.changedTouches || e.changedTouches.length === 0) {
        _chartSwipeStartX = null;
        _chartSwipeStartY = null;
        return;
      }
      var dx = e.changedTouches[0].clientX - _chartSwipeStartX;
      var dy = e.changedTouches[0].clientY - _chartSwipeStartY;
      _chartSwipeStartX = null;
      _chartSwipeStartY = null;

      /* Com scroll-x ou modo resolução: não mudar período */
      if (canvas._bpChartScrollX || canvas._bpChartResMode) {
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
          var idxS = hitIndex(e.changedTouches[0].clientX);
          if (idxS === _chartSelectedIdx) selectBar(-1);
          else selectBar(idxS);
        }
        if (_chartSelectedIdx == null && tooltip) tooltip.style.opacity = '0';
        return;
      }

      if (Math.abs(dx) >= 28 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        if (tooltip) tooltip.style.opacity = '0';
        var moved = _bpChartSwipeStep(dx < 0 ? 1 : -1);
        if (moved) _bpChartAfterSwipeNavigate();
        return;
      }
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
        var idx = hitIndex(e.changedTouches[0].clientX);
        if (idx === _chartSelectedIdx) selectBar(-1);
        else selectBar(idx);
        return;
      }
      if (_chartSelectedIdx == null && tooltip) tooltip.style.opacity = '0';
    }, { passive: true });
  }
}

let _chartControlsBound = false;
function _bpSetChartFilterActive(periodo) {
  document.querySelectorAll('.dash-chart-seg .chart-filter, .chart-filter[data-periodo]').forEach(function (b) {
    const on = b.getAttribute('data-periodo') === periodo;
    b.classList.toggle('is-active', on);
    b.classList.toggle('btn-primary', on);
    b.classList.toggle('btn-secondary', !on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}
/** Olho só no modo Barras (valores nas barras). */
function _bpSyncChartEye() {
  var eye = document.getElementById('chart-eye-toggle');
  if (!eye) return;
  var mode = (typeof _chartViewMode !== 'undefined' && _chartViewMode) ? _chartViewMode : 'barras';
  var show = mode === 'barras';
  eye.hidden = !show;
  eye.setAttribute('aria-hidden', show ? 'false' : 'true');
  try { eye.style.display = show ? '' : 'none'; } catch (_) {}
}


/* Mantém o canvas legível após navegação / rotação / volta à aba Resumo */
function _bpEnsureChartResizeObserver() {
  if (_bpEnsureChartResizeObserver._done) return;
  var wrap = document.getElementById('dash-chart-canvas-wrap') || document.getElementById('weekly-chart');
  if (!wrap) return;
  var target = wrap.id === 'weekly-chart' && wrap.parentElement ? wrap.parentElement : wrap;
  _bpEnsureChartResizeObserver._done = true;
  var t = null;
  function schedule() {
    if (t) clearTimeout(t);
    t = setTimeout(function () {
      if (typeof renderizarGrafico === 'function') renderizarGrafico({ force: true });
    }, 120);
  }
  if (typeof ResizeObserver !== 'undefined') {
    try {
      var ro = new ResizeObserver(function () { schedule(); });
      ro.observe(target);
    } catch (_) {}
  }
  window.addEventListener('resize', schedule);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) schedule();
  });
}
try { _bpEnsureChartResizeObserver(); } catch (_) {}
document.addEventListener('DOMContentLoaded', function () {
  try { _bpEnsureChartResizeObserver(); } catch (_) {}
});

function initChartControls() {
  if (_chartControlsBound) return;
  _chartControlsBound = true;
  // Estado inicial: só chartPeriodo (independente do hero)
  const inicial = state.chartPeriodo || 'semana';
  _bpSetChartFilterActive(inicial === 'hora' ? 'hora' : inicial);

  document.querySelectorAll('.dash-chart-seg .chart-filter').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const periodo = this.dataset.periodo;
      if (!periodo) return;
      state.chartPeriodo = periodo;
      state.chartOffset = 0;
      /* Alinhar span ao preset (7/30/90); evita barras a menos após mudar de período */
      try {
        var baseS = (typeof _bpChartBaseSpan === 'function') ? _bpChartBaseSpan(periodo) : 0;
        state.chartSpanDays = baseS || 0;
      } catch (_) {}
      try {
        localStorage.setItem('bp_chart_periodo', state.chartPeriodo);
        localStorage.setItem('bp_chart_offset', '0');
        localStorage.setItem('bp_chart_span', String(state.chartSpanDays || 0));
      } catch (_) {}
      _bpSetChartFilterActive(periodo);
      _chartSelectedIdx = null;
      _chartShowSkeleton(true);
      _chartAnimProgress = 0;
      if (_chartAnimRaf) cancelAnimationFrame(_chartAnimRaf);
      var t0 = performance.now();
      function step(now) {
        var t = Math.min(1, (now - t0) / 280);
        _chartAnimProgress = t * t * (3 - 2 * t); // smoothstep
        renderizarGrafico();
        if (t < 1) _chartAnimRaf = requestAnimationFrame(step);
        else {
          _chartAnimProgress = 1;
          _chartShowSkeleton(false);
        }
      }
      requestAnimationFrame(function () {
        _chartShowSkeleton(false);
        _chartAnimRaf = requestAnimationFrame(step);
      });
    });
  });

  const prevBtn = document.getElementById('chart-prev');
  const nextBtn = document.getElementById('chart-next');
  if (prevBtn) {
    prevBtn.onclick = () => {
      state.chartOffset = (state.chartOffset || 0) + 1;
      try { localStorage.setItem('bp_chart_offset', String(state.chartOffset)); } catch (_) {}
      renderizarGrafico();
    };
  }
  if (nextBtn) {
    nextBtn.onclick = () => {
      if ((state.chartOffset || 0) > 0) {
        state.chartOffset -= 1;
        try { localStorage.setItem('bp_chart_offset', String(state.chartOffset)); } catch (_) {}
        renderizarGrafico();
      }
    };
  }

  const drillModal = document.getElementById('modal-chart-drill');
  if (drillModal && !drillModal.dataset.bound) {
    drillModal.dataset.bound = '1';
    drillModal.addEventListener('click', function (e) {
      if (e.target === drillModal || e.target.getAttribute('data-close') === 'modal-chart-drill') {
        fecharChartDrill();
      }
    });
  }

  var exportBtn = document.getElementById('chart-export-csv');
  if (exportBtn && !exportBtn.dataset.bound) {
    exportBtn.dataset.bound = '1';
    exportBtn.addEventListener('click', function () {
      exportarAnaliseCsv(window.__bpUltimaAnaliseTemporal);
    });
  }

  document.querySelectorAll('.dash-chart-view-btn').forEach(function (btn) {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', function () {
      try { _bpHaptic('toggle'); } catch (_) {}
      var v = this.getAttribute('data-chart-view') || 'barras';
      _chartViewMode = v;
      try { localStorage.setItem('bp_chart_view', v); } catch (_) {}
      document.querySelectorAll('.dash-chart-view-btn').forEach(function (b) {
        var on = b.getAttribute('data-chart-view') === v;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (typeof _bpSyncChartEye === 'function') _bpSyncChartEye();
      renderizarGrafico();
    });
  });
  // sync active view button
  document.querySelectorAll('.dash-chart-view-btn').forEach(function (b) {
    var on = b.getAttribute('data-chart-view') === (_chartViewMode || 'barras');
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  if (typeof _bpSyncChartEye === 'function') _bpSyncChartEye();

  const eyeToggle = document.getElementById('chart-eye-toggle');
  if (eyeToggle) {
    eyeToggle.addEventListener('click', function() {
      state.chartMostrarValores = !state.chartMostrarValores;
      localStorage.setItem('bp_chart_mostrar_valores', String(state.chartMostrarValores));
      const svg = this.querySelector('svg');
      if (svg) {
        if (state.chartMostrarValores) {
          svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
        } else {
          svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
        }
      }
      renderizarGrafico();
    });
  }
}

/** @deprecated feedback visual — anel CSS; mantido no-op seguro */
function _bpChartPulse(el) { /* no-op */ }

function _bpInitChartChrome() {
  if (window.__bpChartChromeBound) return;
  window.__bpChartChromeBound = true;
  var card = document.querySelector('.dash-chart-card');
  var toggle = document.getElementById('chart-filter-toggle');
  if (toggle && !toggle.dataset.boundKpiModal) {
    toggle.dataset.boundKpiModal = '1';
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      function markActive() {
        window.__bpPeriodoTarget = 'chart';
        document.querySelectorAll('.dash-periodo-opcao').forEach(function (btn) {
          var ativa = btn.dataset.periodo === state.chartPeriodo &&
            (btn.dataset.periodo !== 'dia' || Number(btn.dataset.offset || 0) === Number(state.chartOffset || 0));
          btn.classList.toggle('active', !!ativa);
        });
      }
      function placeSheetNearFilter() {
        var btn = document.getElementById('chart-filter-toggle');
        if (typeof _bpPlacePeriodoSheetNear === 'function') {
          _bpPlacePeriodoSheetNear(btn);
          return;
        }
        try {
          var sheet = document.querySelector('#modal-periodo-dashboard .modal-sheet');
          if (!sheet || !btn) return;
          var r = btn.getBoundingClientRect();
          var w = Math.min(260, window.innerWidth * 0.88);
          var left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
          var top = Math.min(r.bottom + 6, window.innerHeight - 140);
          sheet.style.position = 'fixed';
          sheet.style.top = Math.round(top) + 'px';
          sheet.style.left = Math.round(left) + 'px';
          sheet.style.width = Math.round(w) + 'px';
          sheet.style.right = 'auto';
        } catch (_) {}
      }
      markActive();
      try { _bpHaptic('open'); } catch (_) {}
      if (typeof openModal === 'function') {
        openModal('modal-periodo-dashboard');
        try { window.__bpPeriodoAnchor = document.getElementById('chart-filter-toggle'); } catch (_) {}
        placeSheetNearFilter();
        setTimeout(placeSheetNearFilter, 30);
      } else {
        var kpiIcon = document.getElementById('dash-filter-icon');
        if (kpiIcon) kpiIcon.click();
      }
    });
  }
  setTimeout(function () {
    var card = document.querySelector('.dash-chart-card');
    if (card) card.classList.add('nudge-done');
  }, 8000);

  var expT = document.getElementById('chart-export-toggle');
  var expM = document.getElementById('chart-export-menu');
  if (expT && expM && !expT.dataset.bound) {
    expT.dataset.bound = '1';
    expT.addEventListener('click', function (e) {
      e.stopPropagation();
      expM.hidden = !expM.hidden;
      expT.setAttribute('aria-expanded', expM.hidden ? 'false' : 'true');
    });
  }
  var csv = document.getElementById('chart-export-csv');
  if (csv && !csv.dataset.boundPdf) {
    csv.dataset.boundPdf = '1';
    csv.addEventListener('click', function (e) {
      e.stopPropagation();
      if (expM) expM.hidden = true;
      if (typeof exportarAnaliseCsv === 'function') exportarAnaliseCsv(window.__bpUltimaAnaliseTemporal);
    });
  }
  var pdfBtn = document.getElementById('chart-export-pdf');
  if (pdfBtn && !pdfBtn.dataset.bound) {
    pdfBtn.dataset.bound = '1';
    pdfBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (expM) expM.hidden = true;
      if (typeof exportarAnalisePdf === 'function') exportarAnalisePdf(window.__bpUltimaAnaliseTemporal);
    });
  }

  var moreT = document.getElementById('chart-more-toggle');
  var moreM = document.getElementById('chart-more-menu');
  if (moreT && moreM && !moreT.dataset.bound) {
    moreT.dataset.bound = '1';
    moreT.addEventListener('click', function (e) {
      e.stopPropagation();
      moreM.hidden = !moreM.hidden;
      moreT.setAttribute('aria-expanded', moreM.hidden ? 'false' : 'true');
    });
    moreM.querySelectorAll('[data-chart-more]').forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.stopPropagation();
        moreM.hidden = true;
        var act = this.getAttribute('data-chart-more');
        var leg = document.getElementById('dash-chart-legend');
        var ins = document.getElementById('dash-chart-insights');
        var mediaSpan = leg ? leg.querySelector('.dash-chart-leg-media') : null;

        // Exclusivo: só uma acção activa de cada vez
        var wasOn = this.classList.contains('is-on');
        moreM.querySelectorAll('[data-chart-more]').forEach(function (b) {
          b.classList.remove('is-on');
        });
        window._chartShowMedia = false;
        window._chartShowComparar = false;
        window._chartShowInsights = false;
        if (ins) { ins.hidden = true; ins.classList.remove('is-live'); }
        if (mediaSpan) mediaSpan.classList.remove('is-active');
        if (leg) {
          var cmp0 = document.getElementById('dash-chart-leg-cmp');
          if (cmp0) cmp0.hidden = true;
        }

        if (wasOn) {
          // desligar tudo
          try { _bpHaptic('toggle'); } catch (_) {}
          if (leg) leg.hidden = true;
          if (typeof renderizarGrafico === 'function') renderizarGrafico();
          return;
        }

        this.classList.add('is-on');
        try { _bpHaptic('select'); } catch (_) {}

        if (act === 'media') {
          window._chartShowMedia = true;
          if (leg) leg.hidden = false;
          if (mediaSpan) mediaSpan.classList.add('is-active');
          if (typeof renderizarGrafico === 'function') renderizarGrafico();
        } else if (act === 'comparar') {
          window._chartShowComparar = true;
          if (leg) {
            leg.hidden = false;
            var cmp = document.getElementById('dash-chart-leg-cmp');
            if (cmp) {
              cmp.hidden = false;
              var a = window.__bpUltimaAnaliseTemporal;
              var pct = a && a.anterior && a.anterior.pct != null ? a.anterior.pct : null;
              cmp.textContent = pct != null
                ? ((pct > 0 ? '+' : '') + (Math.round(pct * 10) / 10) + '% vs anterior')
                : 'Sem comparação';
            }
          }
          if (typeof renderizarGrafico === 'function') renderizarGrafico();
        } else if (act === 'insights') {
          window._chartShowInsights = true;
          if (ins) {
            if (typeof actualizarDashChartInsights === 'function' && window.__bpUltimaAnaliseTemporal) {
              try { actualizarDashChartInsights(window.__bpUltimaAnaliseTemporal); } catch (_) {}
            }
            ins.hidden = false;
            ins.classList.add('is-live');
          }
        }
      });
    });

  }
  document.addEventListener('click', function () {
    if (expM) expM.hidden = true;
    if (moreM) moreM.hidden = true;
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { setTimeout(_bpInitChartChrome, 100); });
} else {
  setTimeout(_bpInitChartChrome, 100);
}


/* ET4.7 — nav e overlays: nunca deixar tooltip roubar toques */
(function bpChartTooltipNavGuard() {
  if (window.__bpChartTipGuard) return;
  window.__bpChartTipGuard = 1;
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    // Toque na bottom-nav ou noutro tab-pane que não o dashboard → esconder tooltip
    if (t.closest('.bottom-nav, .nav-item, [data-tab]')) {
      if (typeof bpHideChartTooltip === 'function') bpHideChartTooltip();
      return;
    }
    if (t.closest('#tab-agenda, #tab-clientes, #tab-caixa, #tab-equipa, #tab-ia')) {
      if (typeof bpHideChartTooltip === 'function') bpHideChartTooltip();
    }
  }, true);
  document.addEventListener('touchstart', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('.bottom-nav, .nav-item')) {
      if (typeof bpHideChartTooltip === 'function') bpHideChartTooltip();
    }
  }, { capture: true, passive: true });
})();



/* F3.5/F3.6-B compat: export para updateUI após carga diferida */
if (typeof window !== 'undefined') {
  window.initChartControls = initChartControls;
  window.renderizarGrafico = renderizarGrafico;
  window._bpChartResApplies = _bpChartResApplies;
  window._bpChartResolveBars = _bpChartResolveBars;
}
