/* BelezaPro — modules/agenda — lista, badges, filtros, expiração */
function agendamentoExpirado(ag) {
  if (!ag || !ag.data) return false;
  const hora = String(ag.hora || '00:00').slice(0, 5);
  const agDate = new Date(ag.data + 'T' + hora + ':00');
  if (isNaN(agDate.getTime())) return false;
  return agDate < new Date();
}

// Atualiza expirados sem reentrar em render (evita loop render → expirar → render)
let _expirandoAgenda = false;
function atualizarAgendamentosExpirados() {
  if (_expirandoAgenda || !state.agendamentos) return;
  _expirandoAgenda = true;
  let atualizado = false;
  try {
    for (const ag of state.agendamentos) {
      if (_statusAg(ag) === 'agendado' && agendamentoExpirado(ag)) {
        ag.status = 'nao_realizado';
        ag.updated_at = new Date().toISOString();
        if (typeof dbPut === 'function') dbPut('agendamentos', ag);
        atualizado = true;
      }
    }
  } finally {
    _expirandoAgenda = false;
  }
  // NÃO chama renderAgendaFull aqui — o caller já renderiza
  if (atualizado && typeof renderBadges === 'function') {
    // badge only; avoid recursive full render
    try {
      const agora = new Date();
      const disponiveis = state.agendamentos.filter(a => {
        if (_statusAg(a) !== 'agendado') return false;
        const hora = String(a.hora || '00:00').slice(0, 5);
        const agDate = new Date(a.data + 'T' + hora + ':00');
        return !isNaN(agDate.getTime()) && agDate >= agora;
      });
      const badge = document.getElementById('agenda-badge');
      if (badge) {
        const count = disponiveis.length;
        if (count > 0) {
          badge.textContent = count > 9 ? '9+' : String(count);
          badge.classList.add('show');
        } else {
          badge.classList.remove('show');
        }
      }
    } catch (_) {}
  }
}

// Função para obter agendamentos filtrados (com suporte a dia exato)
function getAgendamentosFiltrados() {
  atualizarAgendamentosExpirados();

  const hojeStr = hoje();
  const list = state.agendamentos || [];

  if (agendaFilter === 'dia') {
    const dataExata = localStorage.getItem('bp_agenda_data_exata') || hojeStr;
    return list.filter(a => a.data === dataExata && _statusAg(a) !== 'cancelado');
  }

  if (agendaFilter === 'realizados') {
    return list.filter(a => _statusAg(a) === 'realizado');
  }
  if (agendaFilter === 'cancelados') {
    return list.filter(a => _statusAg(a) === 'cancelado');
  }
  if (agendaFilter === 'nao_realizado') {
    return list.filter(a => {
      const st = _statusAg(a);
      return st === 'nao_realizado' || st === 'nao-realizado' || st === 'expirado';
    });
  }
  if (agendaFilter === 'pendentes') {
    const hojeP = hojeStr;
    return list.filter(a => {
      const st = _statusAg(a);
      return st === 'agendado' && a.data >= hojeP;
    }).sort((a, b) => {
      if (a.data !== b.data) return String(a.data).localeCompare(String(b.data));
      return String(a.hora || '').localeCompare(String(b.hora || ''));
    });
  }
  if (agendaFilter === '90dias') {
    var inicio90 = null, fim90 = hojeStr;
    try {
      if (typeof calcularIntervaloPeriodo === 'function') {
        var iv90 = calcularIntervaloPeriodo('90dias', 0);
        if (iv90 && iv90.inicio && iv90.fim) {
          inicio90 = String(iv90.inicio).slice(0, 10);
          fim90 = String(iv90.fim).slice(0, 10);
        }
      }
    } catch (_) {}
    if (!inicio90) {
      var d90 = new Date(hojeStr + 'T00:00:00');
      d90.setDate(d90.getDate() - 89);
      inicio90 = formatarDataISO(d90);
      fim90 = hojeStr;
    }
    return list.filter(function (a) {
      return a.data >= inicio90 && a.data <= fim90 && _statusAg(a) !== 'cancelado';
    });
  }

  switch (agendaFilter) {
    case 'hoje': {
      const dataHoje = state.agendaDataAtual || hojeStr;
      return list.filter(a => a.data === dataHoje && _statusAg(a) !== 'cancelado');
    }
    case 'semana': {
      /* Fase A: mesmo intervalo que Resumo (calcularIntervaloPeriodo). */
      var inicioS, fimS;
      try {
        if (typeof calcularIntervaloPeriodo === 'function') {
          var ivS = calcularIntervaloPeriodo('semana', 0);
          if (ivS && ivS.inicio && ivS.fim) {
            inicioS = String(ivS.inicio).slice(0, 10);
            fimS = String(ivS.fim).slice(0, 10);
          }
        }
      } catch (_) {}
      if (!inicioS || !fimS) {
        var dS = new Date(hojeStr + 'T00:00:00');
        var diaSemanaS = (dS.getDay() + 6) % 7;
        var inicioSemanaS = new Date(dS);
        inicioSemanaS.setDate(dS.getDate() - diaSemanaS);
        var fimSemanaS = new Date(inicioSemanaS);
        fimSemanaS.setDate(inicioSemanaS.getDate() + 6);
        inicioS = formatarDataISO(inicioSemanaS);
        fimS = formatarDataISO(fimSemanaS);
      }
      return list.filter(function (a) {
        return a.data >= inicioS && a.data <= fimS && _statusAg(a) !== 'cancelado';
      });
    }
    case 'mes': {
      /* Fase A: mês civil canónico + _statusAg (igual aos outros ramos). */
      var inicioM, fimM;
      try {
        if (typeof calcularIntervaloPeriodo === 'function') {
          var ivM = calcularIntervaloPeriodo('mes', 0);
          if (ivM && ivM.inicio && ivM.fim) {
            inicioM = String(ivM.inicio).slice(0, 10);
            fimM = String(ivM.fim).slice(0, 10);
          }
        }
      } catch (_) {}
      if (!inicioM || !fimM) {
        var dM = new Date(hojeStr + 'T00:00:00');
        var mesM = dM.getMonth();
        var anoM = dM.getFullYear();
        var ultimoDiaM = new Date(anoM, mesM + 1, 0).getDate();
        inicioM = anoM + '-' + String(mesM + 1).padStart(2, '0') + '-01';
        fimM = anoM + '-' + String(mesM + 1).padStart(2, '0') + '-' + String(ultimoDiaM).padStart(2, '0');
      }
      return list.filter(function (a) {
        return a.data >= inicioM && a.data <= fimM && _statusAg(a) !== 'cancelado';
      });
    }
    case 'todos':
    default:
      return state.agendamentos.filter(a => a.status !== 'cancelado');
  }
}

function renderAgendaFull() {
  const svgCalendario = window.svgCalendario || `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" stroke="var(--neutral-300)" stroke-width="1.5"><rect x="16" y="20" width="48" height="48" rx="4"/><line x1="16" y1="32" x2="64" y2="32"/><line x1="28" y1="16" x2="28" y2="24"/><line x1="52" y1="16" x2="52" y2="24"/><circle cx="40" cy="44" r="6"/></svg>`;

  const cont = document.getElementById('agenda-full-list');
  if (!state.agendamentos || !Array.isArray(state.agendamentos)) {
    if (cont) cont.innerHTML = '<div class="empty-state">A carregar agendamentos...</div>';
    return;
  }

  // Atualizar expirados antes de renderizar
  atualizarAgendamentosExpirados();

  // Obter agendamentos filtrados
  const agsFiltrados = getAgendamentosFiltrados();
  const ags = agsFiltrados.sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora));

// Atualizar label da data (com início–fim quando o período tem intervalo)
const label = document.getElementById('agenda-date-label');
if (label) {
  const hojeStr = hoje();
  function _agFmt(iso) {
    try {
      if (typeof formatarDataCurta === 'function') return formatarDataCurta(iso);
    } catch (_) {}
    try {
      return new Date(String(iso).slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-AO', { day: '2-digit', month: 'short' });
    } catch (_) {
      return String(iso || '').slice(0, 10);
    }
  }
  function _agIvLabel(tipo, offset, fallback) {
    if (typeof calcularIntervaloPeriodo === 'function') {
      try {
        var iv = calcularIntervaloPeriodo(tipo, offset || 0);
        if (iv && (iv.labelComDatas || (iv.inicio && iv.fim))) {
          return iv.labelComDatas || (iv.label + ' · ' + _agFmt(iv.inicio) + ' – ' + _agFmt(iv.fim));
        }
      } catch (_) {}
    }
    return fallback;
  }
  if (agendaFilter === 'dia') {
    const dataExata = localStorage.getItem('bp_agenda_data_exata') || hojeStr;
    label.textContent = new Date(dataExata + 'T00:00:00').toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' });
  } else if (agendaFilter === 'hoje') {
    const dataAtual = state.agendaDataAtual || hojeStr;
    label.textContent = dataAtual === hojeStr
      ? ('Hoje · ' + _agFmt(dataAtual))
      : new Date(dataAtual + 'T00:00:00').toLocaleDateString('pt-AO', { day: '2-digit', month: 'short' });
  } else if (agendaFilter === 'semana') {
    label.textContent = _agIvLabel('semana', 0, 'Esta semana');
  } else if (agendaFilter === 'mes') {
    label.textContent = _agIvLabel('mes', 0, 'Este mês');
  } else if (agendaFilter === '90dias') {
    label.textContent = _agIvLabel('90dias', 0, 'Últimos 90 dias');
  } else if (agendaFilter === 'realizados') {
    label.textContent = 'Realizados';
  } else if (agendaFilter === 'cancelados') {
    label.textContent = 'Cancelados';
  } else if (agendaFilter === 'nao_realizado') {
    label.textContent = 'Não realizados';
  } else if (agendaFilter === 'pendentes') {
    label.textContent = 'Pendentes';
  } else {
    label.textContent = 'Todos';
  }
}
  if (!cont) return;

  if (ags.length === 0) {
    cont.innerHTML = `<div class="empty-state">${svgCalendario}<p>Sem agendamentos neste período</p></div>`;
    return;
  }

  // Agrupar por data se o filtro não for "hoje" nem "dia"
  const agrupar = (agendaFilter !== 'hoje' && agendaFilter !== 'dia' && agendaFilter !== 'pendentes');
  let html = '';
  const hojeStrR = hoje();
  // Ponto 12: pendentes de HOJE em destaque (apenas quando o dia visível é hoje)
  const isViewingHoje = (agendaFilter === 'hoje' && (state.agendaDataAtual || hojeStrR) === hojeStrR)
    || (agendaFilter === 'dia' && (localStorage.getItem('bp_agenda_data_exata') || hojeStrR) === hojeStrR);
  if (isViewingHoje && (agendaFilter === 'hoje' || agendaFilter === 'dia')) {
    const porRealizar = ags.filter(a => _statusAg(a) === 'agendado');
    const resto = ags.filter(a => _statusAg(a) !== 'agendado');
    if (porRealizar.length) {
      html += '<div class="bp-ag-section-title"><span class="bp-ag-pulse-dot" aria-hidden="true"></span>Agendamentos por realizar hoje</div>';
      html += porRealizar.map(a => renderAgendaItem(a, { pulse: true })).join('');
    }
    if (resto.length) {
      if (porRealizar.length) html += '<div class="bp-ag-section-title bp-ag-section-title--muted">Outros de hoje</div>';
      html += resto.map(a => renderAgendaItem(a)).join('');
    }
  } else if (agendaFilter === 'pendentes') {
    const hojeP = hojeStrR;
    const porRealizar = ags.filter(a => _statusAg(a) === 'agendado' && a.data === hojeP);
    const restoPend = ags.filter(a => !( _statusAg(a) === 'agendado' && a.data === hojeP));
    if (porRealizar.length) {
      html += '<div class="bp-ag-section-title"><span class="bp-ag-pulse-dot" aria-hidden="true"></span>Agendamentos por realizar hoje</div>';
      html += porRealizar.map(a => renderAgendaItem(a, { pulse: true })).join('');
    }
    if (restoPend.length) {
      if (porRealizar.length) html += '<div class="bp-ag-section-title bp-ag-section-title--muted">Outros pendentes</div>';
      html += restoPend.map(a => renderAgendaItem(a, { pulse: _statusAg(a) === 'agendado' })).join('');
    }
  } else if (agrupar) {
    const grupos = {};
    ags.forEach(a => {
      if (!grupos[a.data]) grupos[a.data] = [];
      grupos[a.data].push(a);
    });
    const datas = Object.keys(grupos).sort();
    datas.forEach(data => {
      const dataLabel = data === hoje() ? 'Hoje' : new Date(data + 'T00:00:00').toLocaleDateString('pt-AO', { day: '2-digit', month: 'short' });
      html += `<div class="bp-ag-date-label">${dataLabel}</div>`;
      html += grupos[data].map(a => renderAgendaItem(a, data === hojeStrR ? { pulse: _statusAg(a) === 'agendado' } : null)).join('');
    });
  } else {
    html = ags.map(a => renderAgendaItem(a, { pulse: agendaFilter === 'pendentes' && _statusAg(a) === 'agendado' })).join('');
  }
  cont.innerHTML = html;

  // Bolinha no filtro Pendentes
  try {
    const pendBtn = document.getElementById('agenda-filter-pendentes');
    if (pendBtn) {
      const nPend = (state.agendamentos || []).filter(a => _statusAg(a) === 'agendado' && a.data >= hojeStrR).length;
      pendBtn.classList.toggle('has-pending', nPend > 0);
      pendBtn.setAttribute('data-count', String(nPend));
    }
  } catch (_) {}

  // Listeners para "Finalizar" (apenas os que não estão expirados)
  cont.querySelectorAll('[data-action="finalizar"]').forEach(btn => {
    btn.addEventListener('click', function() {
      const id = this.dataset.id;
      if (id) abrirFinalizarAtendimento(id);
    });
  });

  try {
    if (typeof bpCheckExpiringAppointments === 'function') bpCheckExpiringAppointments();
  } catch (_) {}
}

function renderAgendaItem(a, opts) {
  // Leitura apenas — expiração é responsabilidade de atualizarAgendamentosExpirados
  const st = _statusAg(a);
  const isRealizado = st === 'realizado';
  const isCancelado = st === 'cancelado';
  const isExpirado = st === 'nao_realizado' || st === 'nao-realizado' || st === 'expirado';
  const isAgendado = st === 'agendado';
  const podeFinalizar = isAgendado && !agendamentoExpirado(a);
  const podeCancelar = isAgendado;
  const nomeProf = getProfissionalNome(a.profissional_id);

  let statusLabel = '';
  let statusClass = '';

  if (isRealizado) {
    statusLabel = 'Realizado';
    statusClass = 'cliente-stat cliente-stat--gasto';
  } else if (isCancelado) {
    statusLabel = 'Cancelado';
    statusClass = 'cliente-stat';
  } else if (isExpirado) {
    statusLabel = 'Não realizado';
    statusClass = 'cliente-stat cliente-stat--risco';
  } else {
    statusLabel = 'Agendado';
    statusClass = 'cliente-stat cliente-stat--agenda';
  }

  if (window.BPAgendaUI && typeof BPAgendaUI.renderAgendaItemPro === 'function') {
    return BPAgendaUI.renderAgendaItemPro(a, opts);
  }
  let hora = String(a.hora || '').slice(0, 5);
  if (hora.length === 4 && hora.indexOf(':') === 1) hora = '0' + hora;
  if (hora.length < 5) hora = (hora + '00:00').slice(0, 5);
  const whenTxt = hora || '—';
  const pulseCls = (opts && opts.pulse) ? ' bp-ag-card--pulse' : '';
  const safeId = escHtml(a.id != null ? a.id : '');
  const stCls = statusClass;
  const defAv = (window.BPAvatars && (BPAvatars.defaultSrc || (BPAvatars.avatarDataUrl && BPAvatars.avatarDataUrl()))) || '';
  const av = defAv
    ? '<div class="avatar bp-avatar-img bp-ag-avatar"><img src="' + defAv + '" alt="" loading="lazy" decoding="async"></div>'
    : '<div class="avatar bp-ag-avatar" aria-hidden="true"></div>';
  const priceCls = isRealizado ? 'bp-ag-price bp-ag-price--ok' : (isExpirado || isCancelado ? 'bp-ag-price bp-ag-price--off' : 'bp-ag-price bp-ag-price--pend');
  const precoBase = fmtKz(a.preco);
  const precoTxt = isRealizado ? ('+' + precoBase) : precoBase;
  const stStrike = '';
  return `
    <div class="list-item bp-ag-card${pulseCls}" data-agenda-id="${safeId}">
      ${av}
      <div class="info bp-ag-info">
        <div class="sub bp-ag-when">${escHtml(whenTxt)}</div>
        <div class="title">${escHtml(a.servico || 'Serviço')}</div>
        <div class="sub bp-ag-cli-line">cliente: ${escHtml(a.cliente || '—')}</div>
        <div class="sub bp-ag-prof-line">prof: ${escHtml(nomeProf || '—')}</div>
        ${(podeFinalizar || podeCancelar) ? `
        <div class="bp-ag-actions" style="--bp-ag-cols:2">
          ${podeFinalizar ? `<button type="button" class="btn btn-sm btn-primary bp-ag-btn" data-id="${safeId}" data-action="finalizar">Finalizar</button>` : ''}
          ${podeCancelar ? `<button type="button" class="btn btn-sm btn-secondary bp-ag-btn bp-ag-btn-muted" data-id="${safeId}" data-action="cancelar-agenda" data-role="admin,gerente">Cancelar</button>` : ''}
        </div>` : ''}
      </div>
      <div class="action bp-ag-action">
        <span class="bp-ag-status ${stCls}${stStrike}">${statusLabel}</span>
        <span class="${priceCls}">${precoTxt}</span>
      </div>
    </div>
  `;
}

function abrirFinalizarAtendimento(id) {
  const ag = state.agendamentos.find(a => a.id === id);
  if (!ag) return;
  if (ag.status === 'realizado' || ag.status === 'nao_realizado' || ag.status === 'cancelado') {
    toast('Este atendimento já foi finalizado, cancelado ou expirou.', 'warning');
    return;
  }
  const nomeProf = getProfissionalNome(ag.profissional_id);
  document.getElementById('finalizar-ag-id').value = ag.id;
  document.getElementById('finalizar-info').innerHTML =
    `<strong>${escHtml(ag.servico)}</strong><br>${escHtml(ag.cliente)} · ${ag.hora} · ${escHtml(nomeProf)} · ${fmtKz(ag.preco)}`;
  document.getElementById('finalizar-pagamento').value = 'Numerário';
  openModal('modal-finalizar');
}

function mudarAgenda(delta) {
  // Navegação adaptada ao filtro atual
  if (agendaFilter === 'hoje') {
    const atual = new Date(state.agendaDataAtual || hoje());
    atual.setDate(atual.getDate() + delta);
    state.agendaDataAtual = atual.toISOString().split('T')[0];
    renderAgendaFull();
  } else if (agendaFilter === 'dia') {
    // Navegar por dias no modo "Dia Exato"
    const dataAtual = localStorage.getItem('bp_agenda_data_exata') || hoje();
    const d = new Date(dataAtual + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const novaData = formatarDataISO(d);
    localStorage.setItem('bp_agenda_data_exata', novaData);
    renderAgendaFull();
  }
  // Nos modos "semana", "mes", "todos" as setas não têm efeito
}

// ====================================================================
//  BADGE DA AGENDA (contar todos os disponíveis)
// ====================================================================
function renderBadges() {
  atualizarAgendamentosExpirados();
  const agora = new Date();
  const disponiveis = (state.agendamentos || []).filter(a => {
    if (_statusAg(a) !== 'agendado') return false;
    const hora = String(a.hora || '00:00').slice(0, 5);
    const agDate = new Date(a.data + 'T' + hora + ':00');
    return !isNaN(agDate.getTime()) && agDate >= agora;
  });
  const count = disponiveis.length;

  const badge = document.getElementById('agenda-badge');
  if (badge) {
    if (count > 0) {
      badge.textContent = count > 9 ? '9+' : count;
      badge.classList.add('show');
    } else {
      badge.classList.remove('show');
    }
  }
}

// ====================================================================
//  EVENTOS — Filtro da Agenda
// ====================================================================

// Restaurar filtro
agendaFilter = localStorage.getItem(agendaFilterKey) || 'hoje';

// Marcar opção ativa no popover (usando classes CSS)
function atualizarFiltroAgendaUI() {
  document.querySelectorAll('#agenda-filter-popover .agenda-periodo-filter').forEach(btn => {
    const periodo = btn.dataset.periodo;
    btn.classList.toggle('active', periodo === agendaFilter);
  });
}

// Fechar popover (função auxiliar)
function fecharPopover() {
  const popover = document.getElementById('agenda-filter-popover');
  if (popover) popover.style.display = 'none';
}

// Toggle do popover
document.getElementById('agenda-filter-icon')?.addEventListener('click', function(e) {
  e.stopPropagation();
  const popover = document.getElementById('agenda-filter-popover');
  if (!popover) return;
  const isOpen = popover.style.display === 'block';
  popover.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    atualizarFiltroAgendaUI();
  }
});

// Fechar popover ao clicar fora
document.addEventListener('click', function(e) {
  const popover = document.getElementById('agenda-filter-popover');
  const btn = document.getElementById('agenda-filter-icon');
  if (popover && popover.style.display === 'block') {
    if (!popover.contains(e.target) && e.target !== btn) {
      fecharPopover();
    }
  }
});

// Listeners só dos filtros da AGENDA (não misturar com caixa)
document.querySelectorAll('#agenda-filter-popover .agenda-periodo-filter').forEach(btn => {
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    const periodo = this.dataset.periodo;

    // Dia exacto: mostrar input e abrir date picker (mobile-friendly)
    if (periodo === 'dia') {
      // Só reagir a botões da agenda (não caixa)
      if (this.classList.contains('caixa-periodo-filter') || this.classList.contains('caixa-loc-periodo')) {
        return;
      }
      const input = document.getElementById('agenda-data-exata');
      if (!input) {
        toast('Selector de data indisponível', 'error');
        return;
      }
      // Tornar interativo (estava opacity:0;pointer-events:none)
      input.style.cssText = 'display:block;position:static;opacity:1;pointer-events:auto;width:100%;height:auto;margin:8px 0 0;padding:10px;border-radius:8px;border:1px solid var(--border-soft);background:var(--card-white,#fff);font-size:16px;';
      const pop = document.getElementById('agenda-filter-popover');
      if (pop && input.parentElement !== pop) {
        pop.appendChild(input);
      }
      if (!input.value) input.value = (typeof hoje === 'function' ? hoje() : '');
      input.focus();
      try {
        if (typeof input.showPicker === 'function') input.showPicker();
        else input.click();
      } catch (_) {
        try { input.click(); } catch (__) {}
      }
      // Se o utilizador já tinha data, aplicar logo
      if (input.value) {
        agendaFilter = 'dia';
        localStorage.setItem(agendaFilterKey, 'dia');
        localStorage.setItem('bp_agenda_data_exata', input.value);
        atualizarFiltroAgendaUI();
        // manter popover aberto até change ou segundo toque — mas render já
        renderAgendaFull();
        renderBadges();
      }
      return;
    }

    // Outros períodos (hoje, semana, mes, todos)
    agendaFilter = periodo;
    localStorage.setItem(agendaFilterKey, periodo);

    // Resetar data atual quando voltar a "hoje"
    if (periodo === 'hoje') {
      state.agendaDataAtual = hoje();
    }

    // Limpar data exata se não for "dia"
    localStorage.removeItem('bp_agenda_data_exata');

    atualizarFiltroAgendaUI();
    fecharPopover();
    renderAgendaFull();
    renderBadges();
  });
});

// Input de data para Dia Exato
document.getElementById('agenda-data-exata')?.addEventListener('change', function() {
  const data = this.value;
  if (data) {
    agendaFilter = 'dia';
    localStorage.setItem(agendaFilterKey, 'dia');
    localStorage.setItem('bp_agenda_data_exata', data);
    state.agendaDataAtual = data;
    atualizarFiltroAgendaUI();
    fecharPopover();
    renderAgendaFull();
    renderBadges();
  }
});
document.getElementById('agenda-data-exata')?.addEventListener('input', function() {
  if (this.value) this.dispatchEvent(new Event('change'));
});

// ====================================================================
//  SINCRONIZAÇÃO (unificada com debounce)
// ====================================================================
let syncTimeout = null;

function syncAgenda() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    if (document.visibilityState === 'visible') {
      atualizarAgendamentosExpirados();
      if (activeTab === 'agenda') renderAgendaFull();
      renderBadges();
    }
  }, 200);
}

// Verificar expirados a cada 60 segundos
setInterval(syncAgenda, 60000);

// Verificar quando a app volta ao foco
document.addEventListener('visibilitychange', syncAgenda);

// ====================================================================
//  KPI mini-chart + espaço temporal (7d / 30d / mês / ano)

if (typeof window !== 'undefined') {

/**
 * Fase A/B — filtro de agenda reutilizável (UI + export CSV).
 * statusMode: excluir_cancelados | todos | pendentes | realizados | cancelados | nao_realizado
 */
function bpFiltrarAgendamentosPeriodoStatus(inicio, fim, statusMode) {
  if (typeof atualizarAgendamentosExpirados === 'function') {
    try { atualizarAgendamentosExpirados(); } catch (_) {}
  }
  var list = (typeof state !== 'undefined' && state.agendamentos) ? state.agendamentos : [];
  var mode = statusMode || 'excluir_cancelados';
  var ini = inicio ? String(inicio).slice(0, 10) : null;
  var fi = fim ? String(fim).slice(0, 10) : null;
  var hojeP = (typeof hoje === 'function') ? hoje() : String(new Date().toISOString()).slice(0, 10);

  function stOf(a) {
    if (typeof _statusAg === 'function') return _statusAg(a);
    return String((a && (a.status || a.estado)) || 'agendado').toLowerCase();
  }
  function inRange(a) {
    var d = String((a && a.data) || '').slice(0, 10);
    if (!d) return false;
    if (ini && d < ini) return false;
    if (fi && d > fi) return false;
    return true;
  }

  var out = list.filter(function (a) {
    if (!a) return false;
    if (ini || fi) {
      if (!inRange(a)) return false;
    }
    var st = stOf(a);
    if (mode === 'todos') return true;
    if (mode === 'pendentes') return st === 'agendado' && String(a.data).slice(0, 10) >= hojeP;
    if (mode === 'realizados') return st === 'realizado';
    if (mode === 'cancelados') return st === 'cancelado';
    if (mode === 'nao_realizado') {
      return st === 'nao_realizado' || st === 'nao-realizado' || st === 'expirado';
    }
    /* excluir_cancelados (default dos filtros por data na aba) */
    return st !== 'cancelado';
  });

  if (mode === 'pendentes') {
    out.sort(function (a, b) {
      if (a.data !== b.data) return String(a.data).localeCompare(String(b.data));
      return String(a.hora || '').localeCompare(String(b.hora || ''));
    });
  }
  return out;
}

  window.renderAgendaFull = renderAgendaFull;
  window.renderAgendaFull._bpOwner = 'modules/agenda';
  window.renderAgendaItem = renderAgendaItem;
  window.renderBadges = renderBadges;
  window.mudarAgenda = mudarAgenda;
  window.syncAgenda = syncAgenda;
  window.getAgendamentosFiltrados = getAgendamentosFiltrados;
  window.bpFiltrarAgendamentosPeriodoStatus = bpFiltrarAgendamentosPeriodoStatus;
  window.atualizarAgendamentosExpirados = atualizarAgendamentosExpirados;
  window.abrirFinalizarAtendimento = abrirFinalizarAtendimento;
  if (typeof atualizarFiltroAgendaUI === 'function') window.atualizarFiltroAgendaUI = atualizarFiltroAgendaUI;
}
