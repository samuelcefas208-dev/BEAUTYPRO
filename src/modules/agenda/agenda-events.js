/* BelezaPro — modules/agenda/agenda-events.js
 * Etapa 2: events de agenda extraídos de src/app/form-events.js
 * Ownership: agenda (FAB, modal save/cancel, reagendar).
 * Carregar após agenda-render e utils (openModal, toast, state).
 */

document.getElementById('fab-agendar').addEventListener('click', () => {
  const sel = document.getElementById('agenda-cliente');
  var _cliAct = typeof bpClientesActivos === 'function' ? bpClientesActivos() : (state.clientes || []).filter(function (c) {
    return c && c.nome && c.ativo !== false && c.ativo !== 0 && c.ativo !== 'false';
  });
  sel.innerHTML = '<option value="">Seleccionar cliente</option>' + _cliAct.map(function (c) {
    return '<option value="' + escHtml(c.nome) + '">' + escHtml(c.nome) + '</option>';
  }).join('');
  populateAgendaSelects();
  const dtInput = document.getElementById('agenda-datetime');
  if (dtInput) {
    try {
      var now = new Date();
      var y = now.getFullYear();
      var mo = String(now.getMonth() + 1).padStart(2, '0');
      var da = String(now.getDate()).padStart(2, '0');
      var hh = String(now.getHours()).padStart(2, '0');
      var mm = String(now.getMinutes()).padStart(2, '0');
      dtInput.value = y + '-' + mo + '-' + da + 'T' + hh + ':' + mm;
    } catch (_) {
      dtInput.value = '';
    }
    try { dtInput.removeAttribute('min'); } catch (_) {}
  }
  const editEl = document.getElementById('agenda-edit-id');
  if (editEl) editEl.value = '';
  const title = document.getElementById('agenda-title');
  if (title) title.textContent = 'Novo Agendamento';
  const saveBtn = document.getElementById('modal-agenda-save');
  if (saveBtn) saveBtn.textContent = 'Agendar';
  openModal('modal-agenda');
});

// CORREÇÃO: modal-agenda-save separa ID e nome do profissional
document.getElementById('modal-agenda-save').addEventListener('click', async () => {
  const editId = (document.getElementById('agenda-edit-id') || {}).value || '';
  const cliente = (document.getElementById('agenda-cliente') || {}).value || '';
  const servico = (document.getElementById('agenda-servico') || {}).value || '';
  const profissionalId = (document.getElementById('agenda-profissional') || {}).value || '';
  const datetime = (document.getElementById('agenda-datetime') || {}).value || '';
  const preco = parseFloat((document.getElementById('agenda-preco') || {}).value);
  // R37–R40 — uma pendência de cada vez
  if (!cliente) {
    if (typeof bpNotifyFormError === 'function') bpNotifyFormError('Selecione um cliente para continuar.', 'agenda-cliente');
    else toast('Selecione um cliente para continuar.', 'warning');
    return;
  }
  var cliObj = (state.clientes || []).find(function (c) { return c && c.nome === cliente; });
  if (!cliObj || cliObj.ativo === false || cliObj.ativo === 0 || cliObj.ativo === 'false') {
    if (typeof bpNotifyFormError === 'function') bpNotifyFormError('Este cliente não está activo. Escolha outro cliente para continuar.', 'agenda-cliente');
    else toast('Este cliente não está activo. Escolha outro cliente para continuar.', 'warning');
    return;
  }
  if (!servico || servico === 'Outro') {
    if (typeof bpNotifyFormError === 'function') bpNotifyFormError('Seleccione um serviço do catálogo.', 'agenda-servico');
    else toast('Seleccione um serviço do catálogo.', 'warning');
    return;
  }
  if (!datetime || !datetime.includes('T')) {
    if (typeof bpNotifyFormError === 'function') bpNotifyFormError('Indique a data e a hora do atendimento.', 'agenda-datetime');
    else toast('Indique a data e a hora do atendimento.', 'warning');
    return;
  }
  if (!profissionalId) {
    if (typeof bpNotifyFormError === 'function') bpNotifyFormError('Seleccione um profissional.', 'agenda-profissional');
    else toast('Seleccione um profissional.', 'warning');
    return;
  }
  if (isNaN(preco) || preco <= 0) {
    if (typeof bpNotifyFormError === 'function') bpNotifyFormError('Informe um preço válido superior a zero.', 'agenda-preco');
    else toast('Informe um preço válido superior a zero.', 'warning');
    return;
  }
  const data = datetime.split('T')[0];
  const hora = datetime.split('T')[1].slice(0, 5);
  const profObj = (state.profissionais || []).find(p => p.id === profissionalId);
  if (!profObj || (typeof isProfissionalAtivo === 'function' ? !isProfissionalAtivo(profObj) : profObj.ativo === false)) {
    toast('Seleccione um profissional activo.', 'warning');
    return;
  }
  // R41 — compatibilidade serviço/profissional
  const servObj = (state.servicos || []).find(s => s && s.nome === servico);
  if (!servObj || (typeof isServicoAtivo === 'function' ? !isServicoAtivo(servObj) : servObj.ativo === false)) {
    toast('Seleccione um serviço disponível.', 'warning');
    return;
  }
  const listaP = Array.isArray(servObj.profissionais) ? servObj.profissionais : [];
  if (!listaP.length) {
    toast('Este serviço não possui um profissional disponível. Associe um profissional ao serviço antes de continuar.', 'warning');
    return;
  }
  const hab = listaP.some(function (ref) {
    var r = String(ref || '');
    return r === String(profObj.id) || r === String(profObj.nome || '');
  });
  if (!hab) {
    toast('Este profissional não está habilitado para o serviço selecionado. Escolha um profissional disponível para este serviço.', 'warning');
    return;
  }
  const profissionalNome = profObj.nome || '';
  let clienteId = null;
  if (typeof resolverClienteIdPorNome === 'function') clienteId = resolverClienteIdPorNome(cliente);
  else {
    const hit = (state.clientes || []).find(c => c.nome === cliente);
    if (hit) clienteId = hit.id;
  }
  const payload = {
    cliente,
    cliente_id: clienteId,
    servico,
    profissional: profissionalNome,
    profissional_id: profissionalId,
    data,
    hora,
    preco
  };
  let result;
  if (editId) {
    result = await updateAgendamento(editId, payload);
    if (result) {
      toast('Agendamento actualizado.', 'success');
      closeModal('modal-agenda');
      document.getElementById('agenda-edit-id').value = '';
    }
  } else {
    result = await addAgendamento(payload);
    if (result) closeModal('modal-agenda');
  }
});

/** Abre o modal de agenda em modo edição / reagendar */
function abrirReagendarAgendamento(id) {
  const ag = (state.agendamentos || []).find(a => a.id === id);
  if (!ag) return;
  const st = String(ag.status || 'agendado').toLowerCase();
  if (st !== 'agendado') {
    toast('Só é possível reagendar marcações activas.', 'warning');
    return;
  }
  populateAgendaSelects();
  const title = document.getElementById('agenda-title');
  if (title) title.textContent = 'Reagendar';
  const editEl = document.getElementById('agenda-edit-id');
  if (editEl) editEl.value = id;
  const cli = document.getElementById('agenda-cliente');
  const srv = document.getElementById('agenda-servico');
  const prof = document.getElementById('agenda-profissional');
  const dt = document.getElementById('agenda-datetime');
  const preco = document.getElementById('agenda-preco');
  if (cli) cli.value = ag.cliente || '';
  if (srv) srv.value = ag.servico || '';
  if (prof) prof.value = ag.profissional_id || '';
  if (preco) preco.value = ag.preco != null ? ag.preco : '';
  if (dt) {
    var h = String(ag.hora || '00:00').slice(0, 5);
    if (h.length === 4 && h.indexOf(':') === 1) h = '0' + h;
    if (h.length < 5) h = (h + '00:00').slice(0, 5);
    var d0 = String(ag.data || '').slice(0, 10);
    if (d0 && h) dt.value = d0 + 'T' + h;
    else if (d0) {
      var n2 = new Date();
      dt.value = d0 + 'T' + String(n2.getHours()).padStart(2,'0') + ':' + String(n2.getMinutes()).padStart(2,'0');
    }
    try { dt.removeAttribute('min'); } catch (_) {}
  }
  const saveBtn = document.getElementById('modal-agenda-save');
  if (saveBtn) saveBtn.textContent = 'Guardar alterações';
  openModal('modal-agenda');
}
window.abrirReagendarAgendamento = abrirReagendarAgendamento;


document.getElementById('modal-agenda-cancel').addEventListener('click', () => closeModal('modal-agenda'));

/* Etapa 4 — KPI/detalhe agenda movidos de caixa-vendas-events */
document.getElementById('kpi-agenda-card')?.addEventListener('click', () => abrirDetalheAgendamentos('pendentes'));

document.getElementById('modal-agenda-close').addEventListener('click', () => closeModal('modal-agenda-detail'));

document.getElementById('agenda-detail-pendentes')?.addEventListener('click', () => abrirDetalheAgendamentos('pendentes'));
document.getElementById('agenda-detail-realizados')?.addEventListener('click', () => abrirDetalheAgendamentos('realizados'));

// hist-chip substituído pelo popover caixa-filter (Fase E)



/* Etapa 8 fase 2 — finalizar atendimento (save/cancel); open fica em agenda-board */
// ====================================================================
// CORREÇÃO: Finalizar atendimento (adicionado profissional_id e renderBadges)
// ====================================================================
document.getElementById('modal-finalizar-save').addEventListener('click', async () => {
  const id = document.getElementById('finalizar-ag-id').value;
  const ag = state.agendamentos.find(a => a.id === id);
  if (!ag) return;
  if (ag.status !== 'agendado') {
    toast('Este atendimento já não está disponível para finalizar (foi cancelado, expirou ou já foi realizado).', 'warning');
    return;
  }

  const metodo = (document.getElementById('finalizar-pagamento') || {}).value || '';
  const itens = [{
    nome: ag.servico,
    quantidade: 1,
    precoUnit: Number(ag.preco) || 0,
    subtotal: Number(ag.preco) || 0
  }];
  let cliId = ag.cliente_id || null;
  if (!cliId && typeof resolverClienteIdPorNome === 'function') {
    cliId = resolverClienteIdPorNome(ag.cliente);
  }
  const payload = {
    cliente: ag.cliente || '',
    cliente_id: cliId,
    profissional: ag.profissional || '',
    profissional_id: ag.profissional_id || null,
    itens: itens,
    metodoPagamento: metodo
  };

  // Validar ANTES de marcar agendamento como realizado (R44 / R51)
  var pre = typeof bpValidarOperacaoVenda === 'function' ? bpValidarOperacaoVenda(payload) : { ok: true };
  if (!pre || !pre.ok) {
    if (typeof bpNotificarValidacaoVenda === 'function') bpNotificarValidacaoVenda(pre);
    else if (typeof toast === 'function') toast((pre && pre.message) || 'Não é possível registar a venda.', 'warning');
    return;
  }

  // R24 — confirmar antes de persistir (mesmo fluxo que Cobrar)
  var totalTxt = (typeof fmtKz === 'function') ? fmtKz(pre.total) : ((pre.total || 0) + ' Kz');
  var resumoFin =
    'Cliente: ' + (pre.clienteNome || payload.cliente || '—') + '\n' +
    'Profissional: ' + (pre.profissionalNome || payload.profissional || '—') + '\n' +
    'Serviço: ' + ((pre.itens && pre.itens[0] && pre.itens[0].nome) || (payload.itens[0] && payload.itens[0].nome) || '—') + '\n' +
    'Total: ' + totalTxt + '\n' +
    'Pagamento: ' + (pre.metodoPagamento || payload.metodoPagamento || '—') + '\n\n' +
    'Confirme para registar a venda. Até confirmar, o atendimento permanece pendente.';
  var confirmouFin = false;
  if (typeof showConfirmModal === 'function') {
    confirmouFin = await showConfirmModal(
      'Confirmar venda?',
      resumoFin,
      false,
      { confirmLabel: 'Confirmar venda', cancelLabel: 'Voltar', variant: 'default', summaryLayout: true }
    );
  } else {
    confirmouFin = window.confirm(resumoFin);
  }
  if (!confirmouFin) return;

  const idVenda = await registarVenda(payload);
  if (!idVenda) {
    return;
  }

  await updateAgendamento(id, { status: 'realizado' });
  closeModal('modal-finalizar');
  toast('Venda registada.', 'success');
  if (typeof updateUI === 'function') updateUI();
  if (typeof renderBadges === 'function') renderBadges();
});

document.getElementById('modal-finalizar-cancel').addEventListener('click', () => closeModal('modal-finalizar'));

/* Etapa 8 fase 2 — FAB: scroll UX (click já neste ficheiro; visibility em dashboard-render) */
(function bpFabScrollUx() {
  var mainContent = document.querySelector('.main-content');
  if (!mainContent) return;
  var fabs = [
    document.getElementById('fab-agendar'),
    document.getElementById('nova-venda-hero-btn')
  ].filter(Boolean);
  if (!fabs.length) return;
  var fabScrollTimeout = null;
  function setScrolling(on) {
    for (var i = 0; i < fabs.length; i++) {
      if (on) fabs[i].classList.add('fab-scrolling');
      else fabs[i].classList.remove('fab-scrolling');
    }
  }
  mainContent.addEventListener('scroll', function () {
    setScrolling(true);
    clearTimeout(fabScrollTimeout);
    fabScrollTimeout = setTimeout(function () { setScrolling(false); }, 280);
  }, { passive: true });
  mainContent.addEventListener('touchstart', function () {
    setScrolling(true);
    clearTimeout(fabScrollTimeout);
    fabScrollTimeout = setTimeout(function () { setScrolling(false); }, 400);
  }, { passive: true });
})();


/* Detalhe ao tocar no cartão (mobile + desktop-narrow).
 * desktop-shell só carrega em viewport desktop — sem este binder o clique na Agenda não abre detalhe. */
(function bpBindAgendaCardDetail() {
  if (typeof document === 'undefined' || document.body.dataset.bpAgCardDetail === '1') return;
  document.body.dataset.bpAgCardDetail = '1';

  function esc(s) {
    if (typeof escHtml === 'function') return escHtml(String(s == null ? '' : s));
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function money(v) {
    if (typeof fmtKz === 'function') return fmtKz(Number(v) || 0);
    return (Number(v) || 0) + ' Kz';
  }
  function statusLabel(ag) {
    var st = String((ag && (ag.status || ag.estado)) || '').toLowerCase();
    if (st === 'realizado') return 'Realizado';
    if (st === 'cancelado') return 'Cancelado';
    if (st === 'nao_realizado' || st === 'nao-realizado') return 'Não realizado';
    return st === 'agendado' || !st ? 'Agendado' : st;
  }
  function findAg(id) {
    if (!id || typeof state === 'undefined') return null;
    var list = state.agendamentos || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].id) === String(id)) return list[i];
    }
    return null;
  }
  function buildHtml(ag) {
    if (!ag) return '';
    var prof = '';
    try {
      if (typeof getProfissionalNome === 'function') prof = getProfissionalNome(ag.profissional_id) || '';
    } catch (_) {}
    if (!prof) prof = ag.profissional || '—';
    var nota = ag.notas || ag.nota || ag.observacao || ag.obs || '';
    return (
      '<div class="bp-ad-time">' + esc(String(ag.hora || '').slice(0, 5)) + ' · ' + esc(ag.data || '') + '</div>' +
      '<div class="bp-ad-title">' + esc(ag.servico || 'Agendamento') + '</div>' +
      '<div class="bp-ad-row"><span>Cliente</span><span>' + esc(ag.cliente || '—') + '</span></div>' +
      '<div class="bp-ad-row"><span>Profissional</span><span>' + esc(prof) + '</span></div>' +
      '<div class="bp-ad-row"><span>Estado</span><span>' + esc(statusLabel(ag)) + '</span></div>' +
      '<div class="bp-ad-row"><span>Valor</span><span>' + money(ag.preco != null ? ag.preco : ag.valor) + '</span></div>' +
      (nota ? '<div class="bp-ad-row bp-ad-nota"><span>Notas</span><span>' + esc(nota) + '</span></div>' : '') +
      '<p class="bp-ad-hint">Use os botões no cartão para finalizar, reagendar ou cancelar.</p>'
    );
  }
  function ensureSheet() {
    var el = document.getElementById('bp-ag-mobile-sheet');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'bp-ag-mobile-sheet';
    el.className = 'bp-ag-mobile-sheet';
    el.hidden = true;
    el.innerHTML =
      '<div class="bp-ag-mobile-backdrop" data-ag-close="1"></div>' +
      '<div class="bp-ag-mobile-panel" role="dialog" aria-modal="true" aria-label="Detalhe do agendamento">' +
      '<div class="bp-ag-mobile-handle" aria-hidden="true"></div>' +
      '<div class="bp-ag-mobile-body" id="bp-ag-mobile-body"></div>' +
      '<button type="button" class="btn btn-secondary bp-ag-mobile-close" data-ag-close="1">Fechar</button>' +
      '</div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-ag-close]')) el.hidden = true;
    });
    return el;
  }
  function showDetail(ag) {
    var sheet = ensureSheet();
    var body = document.getElementById('bp-ag-mobile-body');
    if (!body || !ag) return;
    body.innerHTML = buildHtml(ag);
    sheet.hidden = false;
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('button, a, input, select, label, [data-action]')) return;
    var card = e.target.closest('.bp-ag-card[data-agenda-id], .list-item[data-agenda-id]');
    if (!card) return;
    var inAgenda =
      card.closest('#agenda-full-list') ||
      card.closest('#agenda-today-list');
    if (!inAgenda) return;
    // Se desktop-shell já tratou, não duplicar (sheet já aberto)
    if (document.body.dataset.bpAgDesk === '1' && window.matchMedia && window.matchMedia('(min-width: 1024px)').matches) {
      return;
    }
    var id = card.getAttribute('data-agenda-id');
    var ag = findAg(id);
    if (!ag) return;
    document.querySelectorAll('.bp-ag-card.is-selected').forEach(function (el) {
      el.classList.remove('is-selected');
    });
    card.classList.add('is-selected');
    showDetail(ag);
  });
})();
