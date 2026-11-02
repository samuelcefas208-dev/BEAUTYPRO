/* BelezaPro — modules/dashboard — KPIs, período, atalhos, plano */
function atualizarVisibilidadeAtalhos() {
  // FAB serviço (esq.) no Resumo/Caixa; FAB agendar (dir.) só na Agenda.
  const fabAgenda = document.getElementById('fab-agendar');
  if (fabAgenda) {
    fabAgenda.style.display = (activeTab === 'agenda') ? 'flex' : 'none';
  }
  const fabVenda = document.getElementById('nova-venda-hero-btn');
  if (fabVenda) {
    fabVenda.style.display = (activeTab === 'dashboard' || activeTab === 'caixa') ? 'flex' : 'none';
  }
}

function renderPlanoInfo() {
  const plano = getPlanoAtual();
  const info = PLANOS[plano];
    const badge = document.getElementById('plano-badge');
  if (!badge) return;
  const label = plano === 'trial' ? 'Plano Gratuito' : info.label.toUpperCase();
  badge.textContent = label;
  badge.className = 'plano-badge ' + info.badgeClass;
  badge.setAttribute('data-bp-plano-ready', '1');
  badge.style.visibility = 'visible';
  badge.setAttribute('aria-hidden', 'false');
  const countdown = document.getElementById('trial-countdown');
  if (plano === 'trial' && isTrialAtivo()) {
    const dias = getDiasTrialRestantes();
    countdown.style.display = 'inline-block';
    countdown.textContent = `Restam ${dias} dias`;
    countdown.style.color = '';
  } else if (plano === 'trial' && !isTrialAtivo()) {
    countdown.style.display = 'inline-block';
    countdown.textContent = 'Trial expirado';
    countdown.style.color = 'var(--red)';
  } else {
    countdown.style.display = 'none';
    countdown.style.color = '';
  }
  const iaInfo = document.getElementById('ia-plano-info');
  if (iaInfo) {
    const limite = info.iaDia;
    iaInfo.textContent = limite > 0 ? `${info.label}: ${limite} perguntas/dia` : 'IA não disponível neste plano';
  }
  if (typeof actualizarContadorIA === 'function') {
    actualizarContadorIA();
  } else {
    const cont = document.getElementById('ia-contador');
    if (cont) {
      if (info.iaDia === 0) cont.textContent = '0';
      else {
        const chave = 'ia_perguntas_' + ((state.config && state.config.salaoId) || 'local') + '_' + hoje();
        cont.textContent = String(parseInt(localStorage.getItem(chave) || '0', 10) || 0);
      }
    }
  }
}

// ====================================================================
//  FILTRO DASHBOARD — funções auxiliares (já existentes)
function calcularIntervaloPeriodo(tipo, offset) {
  const base = new Date(hoje() + 'T00:00:00');
  let inicio, fim, label;
  if (tipo === 'custom') {
    inicio = state.dashCustomInicio || hoje();
    fim = state.dashCustomFim || hoje();
    label = 'Personalizado';
  } else if (tipo === 'semana') {
    const diaSemana = (base.getDay() + 6) % 7;
    const segunda = new Date(base);
    segunda.setDate(segunda.getDate() - diaSemana - offset * 7);
    const domingo = new Date(segunda);
    domingo.setDate(domingo.getDate() + 6);
    inicio = formatarDataISO(segunda);
    fim = formatarDataISO(domingo);
    label = offset === 0 ? 'Esta semana' : 'Semana de ' + formatarDataCurta(inicio);
  } else if (tipo === '7dias') {
    const fimD = new Date(base);
    fimD.setDate(fimD.getDate() - offset * 7);
    const iniD = new Date(fimD);
    iniD.setDate(iniD.getDate() - 6);
    inicio = formatarDataISO(iniD);
    fim = formatarDataISO(fimD);
    label = 'Últimos 7 dias';
  } else if (tipo === '90dias') {
    const fimD = new Date(base);
    fimD.setDate(fimD.getDate() - offset * 90);
    const iniD = new Date(fimD);
    iniD.setDate(iniD.getDate() - 89);
    inicio = formatarDataISO(iniD);
    fim = formatarDataISO(fimD);
    label = 'Últimos 90 dias';
  } else if (tipo === 'mes') {
    const ano = base.getFullYear();
    const mes = base.getMonth() - offset;
    const primeiro = new Date(ano, mes, 1);
    const ultimo = new Date(ano, mes + 1, 0);
    inicio = formatarDataISO(primeiro);
    fim = formatarDataISO(ultimo);
    label = offset === 0 ? 'Este mês' : 'Mês anterior';
  } else if (tipo === '30dias') {
    const fimD = new Date(base);
    fimD.setDate(fimD.getDate() - offset * 30);
    const iniD = new Date(fimD);
    iniD.setDate(iniD.getDate() - 29);
    inicio = formatarDataISO(iniD);
    fim = formatarDataISO(fimD);
    label = 'Últimos 30 dias';
  } else if (tipo === 'ano') {
    const ano = base.getFullYear() - offset;
    inicio = ano + '-01-01';
    fim = ano + '-12-31';
    label = offset === 0 ? 'Este ano' : String(ano);
  } else {
    // tipo === 'dia'
    const d = new Date(base);
    d.setDate(d.getDate() - offset);
    const iso = formatarDataISO(d);
    inicio = fim = iso;
    if (offset === 0) label = 'Hoje';
    else if (offset === 1) label = 'Ontem';
    else label = formatarDataCurta(iso);
  }
  /* Ponto 2: label curto + label com datas (UI / IA / export). */
  var labelCurto = label;
  var labelComDatas;
  try {
    if (inicio === fim) {
      labelComDatas = labelCurto + ' · ' + (typeof formatarDataCurta === 'function' ? formatarDataCurta(inicio) : String(inicio).slice(0, 10));
    } else {
      var a = typeof formatarDataCurta === 'function' ? formatarDataCurta(inicio) : String(inicio).slice(0, 10);
      var b = typeof formatarDataCurta === 'function' ? formatarDataCurta(fim) : String(fim).slice(0, 10);
      labelComDatas = labelCurto + ' · ' + a + ' – ' + b;
    }
  } catch (_) {
    labelComDatas = labelCurto;
  }
  return {
    inicio: inicio,
    fim: fim,
    label: labelCurto,
    labelCurto: labelCurto,
    labelComDatas: labelComDatas,
    tipo: tipo
  };
}

function getIntervaloDashAtual() {
  return calcularIntervaloPeriodo(state.dashPeriodo, state.dashOffset);
}

function _bpChartBaseSpan(tipo) {
  if (tipo === '7dias') return 7;
  if (tipo === '30dias') return 30;
  if (tipo === '90dias') return 90;
  return 0;
}

function _bpChartClampSpan(tipo, span) {
  /* base só indica preset do filtro; swipe pode descer abaixo (7→6→5) e subir (…→31→32) */
  var base = _bpChartBaseSpan(tipo);
  if (!base) return 0;
  span = parseInt(span, 10) || 0;
  if (span < 1) span = 1;
  if (span > 120) span = 120;
  return span;
}

/** Intervalo do gráfico — independente dos KPIs (chartPeriodo + chartOffset / span). */
function getIntervaloChartAtual() {
  var tipo = state.chartPeriodo || 'semana';
  function _lab(inicio, fim, labelCurto) {
    var a = inicio, b = fim;
    try {
      if (typeof formatarDataCurta === 'function') {
        a = formatarDataCurta(inicio);
        b = formatarDataCurta(fim);
      }
    } catch (_) {}
    var curto = labelCurto || 'Período';
    if (!inicio || !fim) return { label: curto, labelComDatas: curto };
    if (String(inicio).slice(0, 10) === String(fim).slice(0, 10)) {
      return { label: curto, labelComDatas: curto + ' · ' + a };
    }
    return { label: curto, labelComDatas: curto + ' · ' + a + ' – ' + b };
  }
  if (tipo === 'custom') {
    var hi = state.chartCustomInicio || (typeof hoje === 'function' ? hoje() : '');
    var hf = state.chartCustomFim || hi;
    var lc = _lab(hi, hf, 'Personalizado');
    return { inicio: hi, fim: hf, label: lc.label, labelComDatas: lc.labelComDatas, tipo: 'custom' };
  }
  if (tipo === 'hora') tipo = 'dia';
  var baseSpan = _bpChartBaseSpan(tipo);
  if (baseSpan && typeof hoje === 'function' && typeof formatarDataISO === 'function') {
    /* Presets 7/30/90: intervalo = período do filtro (base). */
    var span = baseSpan;
    state.chartSpanDays = span;
    var base = new Date(hoje() + 'T00:00:00');
    var off = Number(state.chartOffset) || 0;
    if (off < 0) off = 0;
    var fimD = new Date(base);
    fimD.setDate(fimD.getDate() - off);
    var iniD = new Date(fimD);
    iniD.setDate(iniD.getDate() - (span - 1));
    var ini = formatarDataISO(iniD);
    var fim = formatarDataISO(fimD);
    var lc2 = _lab(ini, fim, 'Últimos ' + span + ' dias');
    return {
      inicio: ini,
      fim: fim,
      label: lc2.label,
      labelComDatas: lc2.labelComDatas,
      span: span,
      tipo: tipo
    };
  }
  var iv = calcularIntervaloPeriodo(tipo, state.chartOffset || 0);
  if (iv && !iv.labelComDatas && iv.inicio && iv.fim) {
    var lc3 = _lab(iv.inicio, iv.fim, iv.label || iv.labelCurto || tipo);
    iv.labelComDatas = lc3.labelComDatas;
  }
  return iv;
}
if (typeof window !== 'undefined') {
  window.getIntervaloDashAtual = getIntervaloDashAtual;
  window.getIntervaloChartAtual = getIntervaloChartAtual;
  window._bpChartBaseSpan = _bpChartBaseSpan;
  window._bpChartClampSpan = _bpChartClampSpan;
}

/** Rótulos: por defeito só o hero (KPIs). Passar { chart: true } para o gráfico. */
function _bpSyncPeriodLabels(label, opts) {
  try {
    opts = opts || {};
    var lab = (label || '').trim();
    if (!lab) {
      if (opts.chart && typeof getIntervaloChartAtual === 'function') {
        var ivc = getIntervaloChartAtual();
        lab = (ivc && (ivc.labelComDatas || ivc.label)) ? String(ivc.labelComDatas || ivc.label) : '';
      } else if (typeof getIntervaloDashAtual === 'function') {
        var iv = getIntervaloDashAtual();
        lab = (iv && (iv.labelComDatas || iv.label)) ? String(iv.labelComDatas || iv.label) : '';
      }
    }
    if (!lab) return;
    if (opts.chart) {
      var chartLab = document.getElementById('chart-period-label');
      if (chartLab) chartLab.textContent = lab;
    } else {
      var todayEl = document.getElementById('today-date');
      if (todayEl) todayEl.textContent = lab;
      /* Não tocar em chart-period-label — gráfico é independente */
    }
  } catch (_) {}
}



// ====================================================================
//  RENDER DASHBOARD — modelo de verdade unificado (Fase A1+A2)
//  dashPeriodo alimenta KPIs/hero; chartPeriodo alimenta o gráfico (independentes).
function _somaVendas(lista) {
  /* Contrato: só via regra BPMetrics (sem fórmula alternativa) */
  if (typeof BPMetrics === 'undefined' || !BPMetrics.somarValor) return 0;
  var only = [];
  for (var i = 0; i < (lista || []).length; i++) {
    var m = lista[i];
    if (!m) continue;
    if (m.tipo === 'venda' && BPMetrics.isVendaValida && !BPMetrics.isVendaValida(m)) continue;
    if (m.tipo && m.tipo !== 'venda') continue;
    only.push(m);
  }
  return BPMetrics.somarValor(only);
}
function renderDashboard() {
  const intervalo = getIntervaloDashAtual();
  const movs = state.movimentos || [];
  const ags = state.agendamentos || [];
  /* Métricas oficiais — uma definição (BPMetrics); UI só apresenta */
  const M = (typeof getMetricasPeriodo === 'function')
    ? getMetricasPeriodo(intervalo.inicio, intervalo.fim, { includeRows: true })
    : null;
  if (!M || M.ok === false) {
    try { console.error('[Resumo] BPMetrics indisponível', M && M.erro); } catch (_) {}
  }
  const vendasPeriodo = (M && M.vendasValidas)
    ? M.vendasValidas
    : (typeof BPMetrics !== 'undefined' && BPMetrics.filtrarVendasValidas
      ? BPMetrics.filtrarVendasValidas(movs, intervalo.inicio, intervalo.fim)
      : []);
  const totalRev = M && M.ok !== false ? M.faturamento : 0;
  const totalVendas = M && M.ok !== false ? M.vendas : 0;
  const ticket = M && M.ok !== false ? M.ticketMedio : 0;

  const realizados = M ? M.agendamentosConcluidos : 0;
  const cancelados = M ? M.agendamentosCancelados : 0;
  const naoRealizados = M ? M.agendamentosNaoRealizados : 0;
  const pendentesPeriodo = M ? M.agendamentosPendentes : 0;
  const agAtivos = M ? M.agendamentosAtivos : 0;

  const todayEl = document.getElementById('today-date');
  if (todayEl) todayEl.textContent = (intervalo.labelComDatas || intervalo.label);
  try { _bpSyncPeriodLabels(intervalo.labelComDatas || intervalo.label); } catch (_) {}

  animateKpi('kpi-revenue', fmtKz(totalRev));
  const revenueCount = document.getElementById('kpi-revenue-count');
  if (revenueCount) {
    revenueCount.textContent = totalVendas === 1 ? '1 venda' : totalVendas + ' vendas';
  }

  // Número principal = marcações válidas no período; sub = breakdown honesto
  animateKpi('kpi-agendamentos', String(Math.max(0, agAtivos)));
  const agStatus = document.getElementById('kpi-agendamentos-status');
  if (agStatus) {
    const parts = [realizados + ' realizados'];
    if (pendentesPeriodo) parts.push(pendentesPeriodo + ' pend.');
    if (naoRealizados) parts.push(naoRealizados + ' falhados');
    if (cancelados) parts.push(cancelados + ' cancel.');
    agStatus.textContent = parts.join(' · ');
  }

  const clientesAll = state.clientes || [];
  const idsPeriodo = new Set();
  vendasPeriodo.forEach(function (m) {
    if (m.cliente_id) idsPeriodo.add(String(m.cliente_id));
    else if (m.cliente) idsPeriodo.add('n:' + String(m.cliente).toLowerCase().trim());
  });
  /* Semântica: cadastrados (ficha) vs atendidos (período) */
  if (document.getElementById('kpi-clientes')) {
    animateKpi('kpi-clientes', String(M ? M.clientesCadastrados : clientesAll.length));
  }
  const cliStatus = document.getElementById('kpi-clientes-status');
  if (cliStatus) {
    var n = M ? M.clientesAtendidos : idsPeriodo.size;
    cliStatus.textContent = n === 1 ? '1 atendido no período' : (n + ' atendidos no período');
  }
  if (document.getElementById('kpi-ticket')) animateKpi('kpi-ticket', fmtKz(ticket));
  const ticketSub = document.getElementById('kpi-ticket-sub');
  if (ticketSub) ticketSub.textContent = 'por venda';

  const canvas = document.getElementById('ticket-sparkline');
  if (canvas) {
    canvas.style.display = 'block';
    const parent = canvas.parentElement;
    const rect = parent ? parent.getBoundingClientRect() : { width: 84 };
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = Math.max(rect.width || 84, 60);
    const cssHeight = 28;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
  }

  const serieReceita = [];
  const dInicio = new Date(intervalo.inicio + 'T00:00:00');
  const dFim = new Date(intervalo.fim + 'T00:00:00');
  const msDia = 86400000;
  const diasNoPeriodo = Math.max(1, Math.round((dFim - dInicio) / msDia) + 1);
  const passo = diasNoPeriodo > 31 ? Math.ceil(diasNoPeriodo / 31) : 1;
  for (let i = 0; i < diasNoPeriodo; i += passo) {
    const d = new Date(dInicio.getTime() + i * msDia);
    const ds = formatarDataISO(d);
    const totalDia = (typeof getFaturamentoPeriodo === 'function')
      ? getFaturamentoPeriodo(ds, ds)
      : 0;
    serieReceita.push(totalDia);
  }
  if (serieReceita.length < 2) serieReceita.push(serieReceita[0] || 0);

  const goldColor = (typeof getComputedStyle === 'function')
    ? (getComputedStyle(document.documentElement).getPropertyValue('--gold').trim() || '#D4AF37')
    : '#D4AF37';
  if (typeof desenharSparkline === 'function') {
    setTimeout(() => {
      try { desenharSparkline('ticket-sparkline', serieReceita, goldColor); }
      catch (e) { console.warn('[Sparkline]', e); }
    }, 40);
  }

  // % variação: receita do período vs período anterior de igual duração (não ticket)
  const duracaoMs = (dFim - dInicio) + msDia;
  const prevFim = new Date(dInicio.getTime() - msDia);
  const prevInicio = new Date(prevFim.getTime() - duracaoMs + msDia);
  const prevInicioStr = formatarDataISO(prevInicio);
  const prevFimStr = formatarDataISO(prevFim);
  const totalPrev = (typeof getFaturamentoPeriodo === 'function')
    ? getFaturamentoPeriodo(prevInicioStr, prevFimStr)
    : 0;

  const percentEl = document.getElementById('ticket-trend-percent');
  if (percentEl) {
    if (totalPrev > 0 && isFinite(totalRev)) {
      const variacao = ((totalRev - totalPrev) / totalPrev) * 100;
      const subiu = variacao >= 0;
      percentEl.className = subiu ? 'trend-up' : 'trend-down';
      const _absVar = Math.abs(variacao);
      let _pctTxt;
      if (!_absVar) {
        _pctTxt = '0';
      } else {
        _pctTxt = _absVar.toFixed(1).replace(/\.0$/, '');
      }
      percentEl.innerHTML = `<span class="trend-arrow">${subiu ? '↑' : '↓'}</span> ${_pctTxt}%`;
      percentEl.style.display = 'inline-flex';
      percentEl.setAttribute('title', 'Receita vs período anterior equivalente');
    } else if (totalRev > 0 && totalPrev === 0) {
      percentEl.className = 'trend-up';
      percentEl.innerHTML = `<span class="trend-arrow">↑</span> novo`;
      percentEl.style.display = 'inline-flex';
      percentEl.setAttribute('title', 'Sem vendas no período anterior');
    } else {
      percentEl.className = 'trend-up';
      percentEl.textContent = '—';
      percentEl.style.display = 'inline-flex';
      percentEl.removeAttribute('title');
    }
  }
  const trendPeriodEl = document.getElementById('ticket-trend-period');
  if (trendPeriodEl) trendPeriodEl.textContent = 'vs período anterior';

  // --- Meta mensal (BPFinance) + saldo de caixa (admin) ---
  const metaWrap = document.getElementById('dash-meta-wrap');
  if (metaWrap) {
    let prog = null;
    try {
      if (window.BPFinance && typeof BPFinance.getProgressoMetaSalao === 'function') {
        prog = BPFinance.getProgressoMetaSalao();
      }
    } catch (_) {}
    if (prog && prog.meta > 0) {
      metaWrap.hidden = false;
      const fill = document.getElementById('dash-meta-fill');
      const label = document.getElementById('dash-meta-label');
      if (fill) fill.style.width = Math.min(100, prog.pct) + '%';
      if (label) {
        label.textContent = fmtKz(prog.volume) + ' / ' + fmtKz(prog.meta) + ' · ' + prog.pct + '%' +
          (prog.atingida ? ' · Meta atingida' : '');
      }
    } else {
      metaWrap.hidden = true;
    }
  }
  const caixaEl = document.getElementById('dash-caixa-saldo');
  if (caixaEl) {
    const hojeStr = hoje();
    const entradas = (typeof getFaturamentoPeriodo === 'function')
      ? getFaturamentoPeriodo(hojeStr, hojeStr)
      : 0;
    const saidasMov = movs.filter(function (m) { return m && m.tipo === 'despesa' && m.data === hojeStr; });
    const saidas = (typeof BPMetrics !== 'undefined' && BPMetrics.somarValor)
      ? BPMetrics.somarValor(saidasMov)
      : saidasMov.reduce(function (s, m) { return s + (Number(m.valor) || 0); }, 0);
    const saldo = (Number(state.config && state.config.fundo) || 0) + entradas - saidas;
    caixaEl.textContent = fmtKz(saldo);
  }

  // Próximos atendimentos — só HOJE, status agendado, hora >= agora
  if (typeof atualizarAgendamentosExpirados === 'function') atualizarAgendamentosExpirados();
  const hojeStr2 = hoje();
  const agora = new Date();
  const agHoje = ags.filter(a => a.data === hojeStr2);
  const proximos = agHoje
    .filter(a => {
      if (_statusAg(a) !== 'agendado') return false;
      const hora = String(a.hora || '00:00').slice(0, 5);
      const agDate = new Date(a.data + 'T' + hora + ':00');
      return !isNaN(agDate.getTime()) && agDate >= agora;
    })
    .sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')))
    .slice(0, 6);

  const cont = document.getElementById('agenda-today-list');
  if (cont) {
    if (proximos.length === 0) {
      const temRealizados = agHoje.some(a => _statusAg(a) === 'realizado');
      const temExpirados = agHoje.some(a => {
        const st = _statusAg(a);
        return st === 'nao_realizado' || st === 'nao-realizado';
      });
      let mensagemVazio = 'Sem atendimentos pendentes';
      if (temRealizados && !temExpirados) mensagemVazio = 'Todos os atendimentos de hoje foram realizados';
      else if (temExpirados && !temRealizados) mensagemVazio = 'Sem atendimentos pendentes';
      cont.innerHTML = `<div class="empty-state"><p>${mensagemVazio}</p></div>`;
    } else {
      cont.innerHTML = proximos.map(a => {
        const nomeProf = getProfissionalNome(a.profissional_id);
        /* A3/E4 — avatar: foto ou silhueta, nunca letra */
        const safeAgId = escHtml(a.id != null ? a.id : '');
        let avHtml = '';
        try {
          const cli = (state.clientes || []).find(c => c.nome === a.cliente || c.id === a.cliente_id);
          var fotoSrc = cli && (window.BPMedia && BPMedia.resolveFotoSrc
            ? BPMedia.resolveFotoSrc(cli)
            : (cli.foto || cli.foto_url));
          if (!fotoSrc && window.BPAvatars && typeof BPAvatars.avatarDataUrl === 'function') {
            fotoSrc = BPAvatars.avatarDataUrl();
          }
          if (!fotoSrc && window.BPAvatars && BPAvatars.defaultSrc) fotoSrc = BPAvatars.defaultSrc;
          if (fotoSrc) {
            var low = String(fotoSrc).trim().toLowerCase();
            if (low.indexOf('http://') === 0 || low.indexOf('https://') === 0 ||
                low.indexOf('data:image/') === 0 || low.indexOf('blob:') === 0) {
              var _fs = (typeof bpSafeImgSrc === 'function') ? (bpSafeImgSrc(fotoSrc) || fotoSrc) : fotoSrc;
              if (_fs) avHtml = `<div class="avatar bp-avatar-img"><img src="${_fs}" alt="" loading="lazy" decoding="async"></div>`;
            }
          }
        } catch (_) {}
        if (!avHtml) {
          var _def = (window.BPAvatars && (BPAvatars.defaultSrc || (typeof BPAvatars.avatarDataUrl === 'function' && BPAvatars.avatarDataUrl()))) || '';
          if (_def) avHtml = `<div class="avatar bp-avatar-img"><img src="${_def}" alt="" loading="lazy" decoding="async"></div>`;
        }
        return `
          <div class="list-item bp-ag-card" data-agenda-id="${safeAgId}" style="cursor:pointer;">
            ${avHtml}
            <div class="info">
              <div class="title dash-next-title">${escHtml(a.servico || 'Serviço')}</div>
              <div class="sub">${escHtml(a.cliente || 'Cliente')} · ${escHtml(String(a.hora || '').slice(0, 5))} · ${escHtml(nomeProf)}</div>
            </div>
            <div class="action dash-next-action">
              <span class="pill pill-warning">Pendente</span>
              <span class="dash-next-price">${fmtKz(a.preco)}</span>
            </div>
          </div>`;
      }).join('');
    }
  }
  const countEl = document.getElementById('agenda-count');
  if (countEl) {
    const n = proximos.length;
    countEl.textContent = n === 0 ? '0 pendentes' : (n === 1 ? '1 pendente' : n + ' pendentes');
  }

  const h = new Date().getHours();
  
  try { if (typeof initKpiTemporalUi === 'function') initKpiTemporalUi(); if (typeof actualizarKpiMiniChart === 'function') actualizarKpiMiniChart(); } catch (eK) { console.warn('[kpi-temporal]', eK); }
const greetEl = document.getElementById('greeting');
  if (greetEl) {
    greetEl.textContent = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  }
}

// ====================================================================
//  EVENTOS — Filtro de Período do Dashboard (ícone + popover)
//  CORREÇÃO (causa raiz do "filtro não funciona" / "sparkline estática"):
//  o botão #dash-filter-icon e as opções .dash-periodo-opcao já existiam
//  no HTML, e o motor (calcularIntervaloPeriodo) e o CSS do popover
//  também já existiam — mas não havia NENHUM addEventListener a ligá-los.
//  state.dashPeriodo/dashOffset nunca podiam mudar, por isso o KPI, o
//  sparkline (que já dependia corretamente de intervalo.fim) e o rótulo
//  ficavam sempre presos no valor por defeito. Não foi preciso mudar o
//  motor de cálculo nem o CSS — só faltava este bloco.
// ====================================================================
function _bpPlacePeriodoSheetNear(anchorEl) {
  try {
    var sheet = document.querySelector('#modal-periodo-dashboard .modal-sheet');
    if (!sheet) return;
    var btn = anchorEl || window.__bpPeriodoAnchor || document.getElementById('dash-filter-icon') || document.getElementById('chart-filter-toggle');
    if (!btn || !btn.getBoundingClientRect) {
      sheet.style.top = '64px';
      sheet.style.left = '12px';
      return;
    }
    window.__bpPeriodoAnchor = btn;
    var r = btn.getBoundingClientRect();
    var w = Math.min(260, window.innerWidth * 0.88);
    var left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    var top = Math.min(Math.max(8, r.bottom + 6), window.innerHeight - 140);
    sheet.style.position = 'fixed';
    sheet.style.top = Math.round(top) + 'px';
    sheet.style.left = Math.round(left) + 'px';
    sheet.style.width = Math.round(w) + 'px';
    sheet.style.right = 'auto';
    sheet.style.zIndex = '1200';
  } catch (_) {}
}
if (typeof window !== 'undefined') window._bpPlacePeriodoSheetNear = _bpPlacePeriodoSheetNear;
(function bpBindPeriodoSheetFollow() {
  function reposition() {
    var overlay = document.getElementById('modal-periodo-dashboard');
    if (!overlay || !overlay.classList.contains('open')) return;
    if (typeof _bpPlacePeriodoSheetNear === 'function') _bpPlacePeriodoSheetNear(window.__bpPeriodoAnchor);
  }
  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
  var main = document.querySelector('.main-content');
  if (main) main.addEventListener('scroll', reposition, { passive: true });
})();


document.getElementById('dash-filter-icon')?.addEventListener('click', function(e) {
  e.stopPropagation();
  window.__bpPeriodoTarget = 'dash';
  document.querySelectorAll('.dash-periodo-opcao').forEach(btn => {
    const ativa = btn.dataset.periodo === state.dashPeriodo &&
      (btn.dataset.periodo !== 'dia' || Number(btn.dataset.offset || 0) === state.dashOffset);
    btn.classList.toggle('active', ativa);
  });
  const customWrap = document.getElementById('dash-periodo-custom');
  if (state.dashPeriodo === 'custom') {
    if (customWrap) customWrap.style.display = 'flex';
    const iniInput = document.getElementById('dash-custom-inicio');
    const fimInput = document.getElementById('dash-custom-fim');
    if (iniInput) iniInput.value = state.dashCustomInicio || hoje();
    if (fimInput) fimInput.value = state.dashCustomFim || hoje();
  } else if (customWrap) {
    customWrap.style.display = 'none';
  }
  const overlay = document.getElementById('modal-periodo-dashboard');
  if (overlay.classList.contains('open')) closeModal('modal-periodo-dashboard');
  else {
    openModal('modal-periodo-dashboard');
    window.__bpPeriodoAnchor = document.getElementById('dash-filter-icon');
    _bpPlacePeriodoSheetNear(window.__bpPeriodoAnchor);
    setTimeout(function () { window.__bpPeriodoAnchor = document.getElementById('dash-filter-icon');
    _bpPlacePeriodoSheetNear(window.__bpPeriodoAnchor); }, 30);
  }
});

document.querySelectorAll('.dash-periodo-opcao').forEach(btn => {
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    const tipo = this.dataset.periodo;
    const target = window.__bpPeriodoTarget === 'chart' ? 'chart' : 'dash';
    if (tipo === 'custom') {
      document.querySelectorAll('.dash-periodo-opcao').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const customWrap = document.getElementById('dash-periodo-custom');
      if (customWrap) customWrap.style.display = 'flex';
      const iniInput = document.getElementById('dash-custom-inicio');
      const fimInput = document.getElementById('dash-custom-fim');
      if (target === 'chart') {
        if (iniInput) iniInput.value = state.chartCustomInicio || state.dashCustomInicio || hoje();
        if (fimInput) fimInput.value = state.chartCustomFim || state.dashCustomFim || hoje();
      } else {
        if (iniInput) iniInput.value = state.dashCustomInicio || hoje();
        if (fimInput) fimInput.value = state.dashCustomFim || hoje();
      }
      return;
    }
    if (target === 'chart') {
      state.chartPeriodo = tipo;
      state.chartOffset = Number(this.dataset.offset) || 0;
      var baseS = typeof _bpChartBaseSpan === 'function' ? _bpChartBaseSpan(tipo) : 0;
      state.chartSpanDays = baseS || 0;
      state.chartResBars = 0;
      try {
        localStorage.setItem('bp_chart_periodo', state.chartPeriodo);
        localStorage.setItem('bp_chart_offset', String(state.chartOffset));
        localStorage.setItem('bp_chart_span', String(state.chartSpanDays || 0));
        localStorage.setItem('bp_chart_res', '0');
      } catch (_) {}
      closeModal('modal-periodo-dashboard');
      try {
        var _ivc = typeof getIntervaloChartAtual === 'function' ? getIntervaloChartAtual() : null;
        _bpSyncPeriodLabels((_ivc && (_ivc.labelComDatas || _ivc.label)) || (this.textContent || '').trim(), { chart: true });
      } catch (_) {}
      try { if (typeof _bpHaptic === 'function') _bpHaptic('select'); } catch (_) {}
      try { if (typeof _bpSetChartFilterActive === 'function') _bpSetChartFilterActive(tipo === 'hora' ? 'hora' : tipo); } catch (_) {}
      if (typeof renderizarGrafico === 'function') renderizarGrafico();
      return;
    }
    state.dashPeriodo = tipo;
    state.dashOffset = Number(this.dataset.offset) || 0;
    localStorage.setItem('bp_dash_periodo', state.dashPeriodo);
    localStorage.setItem('bp_dash_offset', String(state.dashOffset));
    closeModal('modal-periodo-dashboard');
    try { _bpSyncPeriodLabels((this.textContent || '').trim()); } catch (_) {}
    try { if (typeof _bpHaptic === 'function') _bpHaptic('select'); } catch (_) {}
    renderDashboard();
  });
});

document.getElementById('dash-custom-aplicar')?.addEventListener('click', function(e) {
  e.stopPropagation();
  const ini = document.getElementById('dash-custom-inicio').value;
  const fim = document.getElementById('dash-custom-fim').value;
  if (!ini || !fim) { toast('Selecione as duas datas', 'error'); return; }
  if (ini > fim) { toast('A data inicial deve ser anterior à data final', 'error'); return; }
  const target = window.__bpPeriodoTarget === 'chart' ? 'chart' : 'dash';
  closeModal('modal-periodo-dashboard');
  try { if (typeof _bpHaptic === 'function') _bpHaptic('success'); } catch (_) {}
  if (target === 'chart') {
    state.chartPeriodo = 'custom';
    state.chartCustomInicio = ini;
    state.chartCustomFim = fim;
    state.chartOffset = 0;
    try {
      localStorage.setItem('bp_chart_periodo', 'custom');
      localStorage.setItem('bp_chart_custom_inicio', ini);
      localStorage.setItem('bp_chart_custom_fim', fim);
      localStorage.setItem('bp_chart_offset', '0');
    } catch (_) {}
    try { _bpSyncPeriodLabels(ini + ' — ' + fim, { chart: true }); } catch (_) {}
    if (typeof renderizarGrafico === 'function') renderizarGrafico();
    return;
  }
  state.dashPeriodo = 'custom';
  state.dashCustomInicio = ini;
  state.dashCustomFim = fim;
  localStorage.setItem('bp_dash_periodo', 'custom');
  localStorage.setItem('bp_dash_custom_inicio', ini);
  localStorage.setItem('bp_dash_custom_fim', fim);
  try {
    var _civ = (typeof calcularIntervaloPeriodo === 'function')
      ? calcularIntervaloPeriodo('custom', 0)
      : null;
    _bpSyncPeriodLabels(_civ && _civ.label ? _civ.label : (ini + ' — ' + fim));
  } catch (_) {}
  renderDashboard();
});

// Fechar o popover ao tocar fora dele (mesmo padrão já usado no menu hambúrguer)
document.addEventListener('click', function(e) {
  const overlay = document.getElementById('modal-periodo-dashboard');
  const icon = document.getElementById('dash-filter-icon');
  const chartToggle = document.getElementById('chart-filter-toggle');
  if (!overlay || !overlay.classList.contains('open')) return;
  if (overlay.contains(e.target)) return;
  if (icon && (e.target === icon || icon.contains(e.target))) return;
  if (chartToggle && (e.target === chartToggle || chartToggle.contains(e.target))) return;
  closeModal('modal-periodo-dashboard');
});

// ====================================================================
//  AGENDA — com filtro, expiração, badge e dia exato
// ====================================================================

// Estado do filtro da agenda
const agendaFilterKey = 'bp_agenda_filter';
let agendaFilter = localStorage.getItem(agendaFilterKey) || 'hoje';

function _kpiSerieReceita(intervalo) {
  const movs = state.movimentos || [];
  const inicio = new Date((intervalo.inicio || hoje()) + 'T00:00:00');
  const fim = new Date((intervalo.fim || hoje()) + 'T00:00:00');
  const ms = 86400000;
  const dias = Math.max(1, Math.round((fim - inicio) / ms) + 1);
  const passo = dias > 31 ? Math.ceil(dias / 31) : 1;
  const serie = [];
  for (let i = 0; i < dias; i += passo) {
    const d = new Date(inicio.getTime() + i * ms);
    const ds = formatarDataISO(d);
    const total = (typeof getFaturamentoPeriodo === 'function')
      ? getFaturamentoPeriodo(ds, ds)
      : 0;
    serie.push(total);
  }
  return serie;
}

function _desenharKpiSpark(canvasId, serie) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const gold = (getComputedStyle(document.documentElement).getPropertyValue('--gold') || '#c9a227').trim();
  if (!serie || !serie.length) {
    ctx.strokeStyle = gold;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(4, h / 2);
    ctx.lineTo(w - 4, h / 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }
  const max = Math.max.apply(null, serie.concat([1]));
  const pad = 3;
  ctx.beginPath();
  serie.forEach(function (v, i) {
    const x = pad + (i / Math.max(serie.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - (v / max) * (h - pad * 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = gold;
  ctx.lineWidth = 1.75;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // fill suave
  const lastX = pad + ((serie.length - 1) / Math.max(serie.length - 1, 1)) * (w - pad * 2);
  ctx.lineTo(lastX, h - pad);
  ctx.lineTo(pad, h - pad);
  ctx.closePath();
  ctx.fillStyle = gold;
  ctx.globalAlpha = 0.12;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function _kpiTemporalLabels() {
  return { '7dias': '7 dias', '30dias': '30 dias', mes: 'Mês', ano: 'Ano' };
}

function actualizarKpiMiniChart() {
  const intervalo = getIntervaloDashAtual();
  const serie = _kpiSerieReceita(intervalo);
  _desenharKpiSpark('kpi-mini-chart', serie);
  const lab = document.getElementById('kpi-mini-chart-label');
  const map = _kpiTemporalLabels();
  const text = map[state.dashPeriodo] || (intervalo.label || 'Período');
  if (lab) lab.textContent = text;
  const hint = document.getElementById('kpi-temporal-hint');
  if (hint) hint.textContent = (intervalo.labelComDatas || intervalo.label || text) + ' · toque para alterar';
}

let _kpiTemporalDraft = null;
function abrirKpiTemporalSheet() {
  _kpiTemporalDraft = state.dashPeriodo;
  // Se período actual não é um dos 4, default 7dias no UI (sem aplicar ainda)
  const opts = ['7dias', '30dias', 'mes', 'ano'];
  if (opts.indexOf(_kpiTemporalDraft) < 0) _kpiTemporalDraft = '7dias';
  document.querySelectorAll('.kpi-temporal-opt').forEach(function (b) {
    b.classList.toggle('is-active', b.dataset.periodo === _kpiTemporalDraft);
  });
  _refreshKpiTemporalPreview(_kpiTemporalDraft);
  if (typeof openModal === 'function') openModal('modal-kpi-temporal');
  else {
    const el = document.getElementById('modal-kpi-temporal');
    if (el) { el.classList.add('open'); el.style.display = 'flex'; }
  }
}

function _refreshKpiTemporalPreview(periodo) {
  const intervalo = calcularIntervaloPeriodo(periodo, 0);
  const M = (typeof getMetricasPeriodo === 'function')
    ? getMetricasPeriodo(intervalo.inicio, intervalo.fim)
    : null;
  const rev = M ? M.faturamento : 0;
  const n = M ? M.vendas : 0;
  const rangeEl = document.getElementById('kpi-temporal-range');
  const revEl = document.getElementById('kpi-temporal-rev');
  const nEl = document.getElementById('kpi-temporal-n');
  if (rangeEl) rangeEl.textContent = (intervalo.label || '') + ' · ' + formatarDataCurta(intervalo.inicio) + ' – ' + formatarDataCurta(intervalo.fim);
  if (revEl) revEl.textContent = typeof fmtKz === 'function' ? fmtKz(rev) : String(rev);
  if (nEl) nEl.textContent = String(n);
  _desenharKpiSpark('kpi-temporal-chart', _kpiSerieReceita(intervalo));
}

function aplicarKpiTemporal(periodo) {
  if (!periodo) return;
  state.dashPeriodo = periodo;
  state.dashOffset = 0;
  try {
    localStorage.setItem('bp_dash_periodo', periodo);
    localStorage.setItem('bp_dash_offset', '0');
  } catch (_) {}
  /* Opção A: modal temporal dos KPIs não altera o gráfico principal */
  if (typeof closeModal === 'function') closeModal('modal-kpi-temporal');
  else {
    var el = document.getElementById('modal-kpi-temporal');
    if (el) { el.classList.remove('open'); el.style.display = ''; }
  }
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof actualizarKpiMiniChart === 'function') actualizarKpiMiniChart();
}

function initKpiTemporalUi() {
  if (window.__bpKpiTemporalInit) {
    actualizarKpiMiniChart();
    return;
  }
  window.__bpKpiTemporalInit = true;
  const btn = document.getElementById('kpi-mini-chart-btn');
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      abrirKpiTemporalSheet();
    });
  }
  document.querySelectorAll('.kpi-temporal-opt').forEach(function (b) {
    if (b.dataset.bound) return;
    b.dataset.bound = '1';
    b.addEventListener('click', function () {
      _kpiTemporalDraft = this.dataset.periodo;
      document.querySelectorAll('.kpi-temporal-opt').forEach(function (x) {
        x.classList.toggle('is-active', x === b);
      });
      _refreshKpiTemporalPreview(_kpiTemporalDraft);
    });
  });
  const apply = document.getElementById('kpi-temporal-apply');
  if (apply && !apply.dataset.bound) {
    apply.dataset.bound = '1';
    apply.addEventListener('click', function () {
      aplicarKpiTemporal(_kpiTemporalDraft || '7dias');
    });
  }
  const modal = document.getElementById('modal-kpi-temporal');
  if (modal && !modal.dataset.bound) {
    modal.dataset.bound = '1';
    modal.addEventListener('click', function (e) {
      if (e.target === modal || e.target.getAttribute('data-close') === 'modal-kpi-temporal') {
        if (typeof closeModal === 'function') closeModal('modal-kpi-temporal');
      }
    });
  }
  actualizarKpiMiniChart();
}

if (typeof window !== 'undefined') {
  window.renderDashboard = renderDashboard;
  window.renderDashboard._bpOwner = 'modules/dashboard';
  window.atualizarVisibilidadeAtalhos = atualizarVisibilidadeAtalhos;
  window.renderPlanoInfo = renderPlanoInfo;
  window.getIntervaloDashAtual = getIntervaloDashAtual;
  window.calcularIntervaloPeriodo = calcularIntervaloPeriodo;
  if (typeof initKpiTemporalUi === 'function') window.initKpiTemporalUi = initKpiTemporalUi;
}
