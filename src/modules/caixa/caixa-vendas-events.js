/* BelezaPro C-4 — eventos-caixa-vendas; após bundle + vendas-modais */

// ====================================================================
//  eventos-caixa-vendas.js — extraído do app.js (Fase C da modularização)
//  Conteúdo: Eventos: despesa, fundo, carrinho/venda, confirmação de venda, fecho de caixa, detalhes e KPIs
//  Linhas originais: 1877-2109
//  Carregar depois de core-*.js, db-indexeddb.js, sync-*.js, auth-supabase.js
//  CORREÇÃO: adicionado profissional_id e renderBadges() no modal-finalizar-save
// ====================================================================

// Despesa — ET4.2-P0: RBAC operacional (alinhado a data-role admin,gerente)
document.getElementById('add-despesa-btn').addEventListener('click', () => {
  if (typeof bpExigirRole === 'function' && !bpExigirRole(['admin', 'gerente'], 'Não tem permissão para registar despesas.')) return;
  const d = document.getElementById('desp-desc');
  const v = document.getElementById('desp-valor');
  const c = document.getElementById('desp-categoria');
  if (d) d.value = '';
  if (v) v.value = '';
  if (c) c.value = 'operacional';
  openModal('modal-despesa');
  setTimeout(function () { if (d) try { d.focus(); } catch (e) {} }, 100);
});
var _bpDespSaveBtn = document.getElementById('modal-despesa-save');
if (_bpDespSaveBtn) _bpDespSaveBtn.addEventListener('click', async () => {
  var btn = document.getElementById('modal-despesa-save');
  if (btn && btn.dataset.bpSaving === '1') return;
  if (typeof bpExigirRole === 'function' && !bpExigirRole(['admin', 'gerente'], 'Não tem permissão para registar despesas.')) return;
  const desc = document.getElementById('desp-desc').value.trim();
  const valor = Number(document.getElementById('desp-valor').value);
  const categoria = (document.getElementById('desp-categoria') || {}).value || 'outro';
  const fornEl = document.getElementById('desp-fornecedor');
  const fornecedor = fornEl ? String(fornEl.value || '').trim() : '';
  if (!desc) { toast('Indica a descrição da despesa.', 'warning'); return; }
  if (!valor || valor <= 0 || isNaN(valor)) { toast('Indica um valor válido.', 'warning'); return; }
  if (btn) { btn.dataset.bpSaving = '1'; try { btn.disabled = true; } catch (_) {} }
  try {
    await addMovimento({
      tipo: 'despesa',
      descricao: desc,
      valor: valor,
      categoria: categoria,
      fornecedor: fornecedor || undefined
    });
    closeModal('modal-despesa');
    document.getElementById('desp-desc').value = '';
    document.getElementById('desp-valor').value = '';
    if (fornEl) fornEl.value = '';
    toast('Despesa registada.', 'success');
    if (typeof updateUI === 'function') updateUI();
  } finally {
    if (btn) { btn.dataset.bpSaving = ''; try { btn.disabled = false; } catch (_) {} }
  }
});
document.getElementById('modal-despesa-cancel').addEventListener('click', () => closeModal('modal-despesa'));

// Fundo — ET4.2-P0: RBAC admin/gerente
document.getElementById('ajustar-fundo-btn').addEventListener('click', () => {
  if (typeof bpExigirRole === 'function' && !bpExigirRole(['admin', 'gerente'], 'Não tem permissão para ajustar o fundo de caixa.')) return;
  const el = document.getElementById('fundo-valor');
  const atual = Number(state.config && state.config.fundo) || 0;
  if (el) el.value = atual;
  const sub = document.getElementById('fundo-modal-sub');
  if (sub && typeof fmtKz === 'function') {
    sub.textContent = 'Actual: ' + fmtKz(atual) + ' — define o valor de abertura do caixa.';
  }
  openModal('modal-fundo');
  setTimeout(function () { if (el) try { el.focus(); el.select(); } catch (e) {} }, 100);
});
document.getElementById('modal-fundo-save').addEventListener('click', async () => {
  if (typeof bpExigirRole === 'function' && !bpExigirRole(['admin', 'gerente'], 'Não tem permissão para ajustar o fundo de caixa.')) return;

  const v = Number(document.getElementById('fundo-valor').value);
  if (isNaN(v) || v < 0) { toast('Valor inválido', 'error'); return; }
  state.config.fundo = v;
  await saveConfig();
  closeModal('modal-fundo');
  toast('Fundo de caixa actualizado.', 'success');
  if (typeof updateUI === 'function') updateUI();
});
document.getElementById('modal-fundo-cancel').addEventListener('click', () => closeModal('modal-fundo'));

// Venda – Adicionar item ao carrinho (profissional único/global)
document.getElementById('btn-add-item').addEventListener('click', () => {
  const catSel = document.getElementById('ci-servico-sel');
  const ciValor = document.getElementById('ci-valor');
  let nome = catSel.value;
  if (nome === '__custom' || nome === 'Outro') {
    if (typeof toast === 'function') toast('Seleccione um serviço do catálogo.', 'warning');
    return;
  }
  const wasDisabled = ciValor.disabled;
  ciValor.disabled = false;
  const valor = parseFloat(ciValor.value);
  if (wasDisabled) ciValor.disabled = true;
  if (!nome || !valor || valor <= 0) { 
    toast('Indica serviço e valor válidos.', 'warning'); 
    return; 
  }

  // Usar a função central addToCart (definida em vendas-modais.js) - sem profissional por item
  if (typeof window.addToCart === 'function') {
    window.addToCart(nome, valor);
  } else {
    // Fallback
    const existingIndex = cartItems.findIndex(item => item.nome === nome);
    if (existingIndex !== -1) {
      cartItems[existingIndex].quantidade += 1;
      cartItems[existingIndex].subtotal = cartItems[existingIndex].quantidade * cartItems[existingIndex].precoUnit;
    } else {
      cartItems.push({ nome, quantidade: 1, precoUnit: valor, subtotal: valor });
    }
    if (typeof renderCart === 'function') renderCart();
  }
  // Preparar próximo item (velocidade no balcão)
  if (catSel) catSel.value = '';
  if (ciValor) { ciValor.value = ''; }
  if (typeof updateVendaSaveButton === 'function') updateVendaSaveButton();
});

// CORREÇÃO: modal-venda-save com profissional único
const vendaSaveBtn = document.getElementById('modal-venda-save');
if (vendaSaveBtn) {
  vendaSaveBtn.onclick = async function(e) {
    if (this.disabled || this.getAttribute('aria-busy') === 'true') return;
    const cliente = (document.getElementById('venda-cliente') || {}).value || '';
    const profissionalId = (document.getElementById('venda-profissional') || {}).value || '';
    const metodoPagamento = (document.getElementById('venda-pagamento') || {}).value || '';

    const profObj = (state.profissionais || []).find(function (p) { return p && p.id === profissionalId; });
    const profissionalNome = profObj ? profObj.nome : '';

    var pagamentosSplit = null;
    var metodoFinal = metodoPagamento;
    if (metodoPagamento === '__split__' && typeof window.BPFinance !== 'undefined' && BPFinance.lerPagamentosSplit) {
      var sp = BPFinance.lerPagamentosSplit();
      if (sp && sp.list && sp.list.length) {
        pagamentosSplit = sp.list;
        metodoFinal = 'Split';
      }
    }

    var payload = {
      cliente: cliente,
      profissional: profissionalNome,
      profissional_id: profissionalId || null,
      itens: (typeof cartItems !== 'undefined' && cartItems) ? cartItems.slice() : [],
      metodoPagamento: metodoFinal,
      pagamentos: pagamentosSplit
    };

    // Validação central ANTES de processar (R19–R21)
    var pre = typeof bpValidarOperacaoVenda === 'function' ? bpValidarOperacaoVenda(payload) : { ok: true };
    if (!pre || !pre.ok) {
      if (typeof bpNotificarValidacaoVenda === 'function') bpNotificarValidacaoVenda(pre);
      else if (typeof toast === 'function') toast((pre && pre.message) || 'Complete os dados da venda.', 'warning');
      return;
    }

    // R24 — confirmação: ainda NÃO persiste
    var itensTxt = (pre.itens || []).map(function (i) {
      return (i.nome || '') + ' ×' + i.quantidade;
    }).join(', ');
    var totalTxt = (typeof fmtKz === 'function') ? fmtKz(pre.total) : (pre.total + ' Kz');
    var resumo =
      'Cliente: ' + (pre.clienteNome || '—') + '\n' +
      'Profissional: ' + (pre.profissionalNome || '—') + '\n' +
      'Itens: ' + (itensTxt || '—') + '\n' +
      'Total: ' + totalTxt + '\n' +
      'Pagamento: ' + (pre.metodoPagamento || '—') + '\n\n' +
      'Confirme para registar a venda. Até confirmar, nada é gravado.';
    var confirmou = false;
    if (typeof showConfirmModal === 'function') {
      confirmou = await showConfirmModal(
        'Confirmar venda?',
        resumo,
        false,
        { confirmLabel: 'Confirmar venda', cancelLabel: 'Voltar', variant: 'default', summaryLayout: true }
      );
    } else {
      confirmou = window.confirm(resumo);
    }
    if (!confirmou) return;

    setButtonLoading(this, true);
    try {
      const idVenda = await registarVenda(payload);
      if (idVenda) {
        closeModal('modal-venda');
        if (typeof window.clearCart === 'function') {
          window.clearCart();
        } else {
          cartItems = [];
          if (typeof renderCart === 'function') renderCart();
        }
        mostrarConfirmacaoVenda(idVenda);
      }
    } catch (err) {
      console.error('[modal-venda-save]', err);
      toast('A venda não foi concluída. Verifique se todos os campos estão preenchidos corretamente e tente novamente.', 'error');
    } finally {
      setButtonLoading(this, false);
    }
  };
}

// Cancelar venda – limpar carrinho com confirmação e fechar modal
document.getElementById('modal-venda-cancel').addEventListener('click', async () => {
  if (cartItems.length > 0) {
    let confirmCancel = true;
    if (typeof showConfirmModal === 'function') {
      confirmCancel = await showConfirmModal(
        'Limpar carrinho?',
        'Os serviços adicionados a esta venda serão removidos. Podes voltar a montar a venda a qualquer momento.',
        true,
        { confirmLabel: 'Limpar', cancelLabel: 'Manter', variant: 'destructive' }
      );
    }
    if (!confirmCancel) return;
  }
  if (typeof window.clearCart === 'function') {
    window.clearCart();
  } else {
    cartItems = [];
    if (typeof renderCart === 'function') renderCart();
  }
  closeModal('modal-venda');
});

document.getElementById('venda-add-cliente-rapido').addEventListener('click', () => {
  closeModal('modal-venda');
  document.getElementById('cliente-rapido-nome').value = '';
  document.getElementById('cliente-rapido-telefone').value = '';
  openModal('modal-cliente-rapido');
});

// Tela de sucesso da venda
let ultimaVendaId = null;

const PAGAMENTO_ICONES = {
  'Numerário': 'Numerário',
  'Multicaixa Express': 'Multicaixa Express',
  'Transferência Bancária': 'Transferência Bancária',
  'Cartão': 'Cartão',
  'Outro': 'Outro',
};

function mostrarConfirmacaoVenda(vendaId) {
  // Constituição: sem modal de sucesso de venda — toast + actualização UI
  const venda = (state.vendas || []).find(v => v.id === vendaId)
    || (state.movimentos || []).find(m => m.id === vendaId);
  const valor = venda ? (venda.total || venda.valor || 0) : 0;
  toast('Venda registada · ' + (typeof fmtKz === 'function' ? fmtKz(valor) : valor + ' Kz'), 'success');
  if (typeof updateUI === 'function') updateUI();
  // Guardar id para impressão rápida se o utilizador abrir detalhe
  try { sessionStorage.setItem('bp_last_venda_id', vendaId); } catch (_) {}
}


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

// ====================================================================
//  CONFIRMAR FECHO DE CAIXA (persistência)
// ====================================================================
async function confirmarFechoCaixa() {
  var cBtn = document.getElementById('confirmar-fecho-btn');
  if (cBtn && cBtn.dataset.bpSaving === '1') return;
  if (typeof bpExigirRole === 'function' && !bpExigirRole(['admin'], 'Apenas administradores podem fechar o caixa.')) return;

  const hojeStr = hoje();
  const movs = (state.movimentos && Array.isArray(state.movimentos) ? state.movimentos : []).filter(m => m.data === hojeStr);
  const vendas = movs.filter(function (m) { return typeof BPMetrics !== 'undefined' && BPMetrics.isVendaValida ? BPMetrics.isVendaValida(m) : false; });
  const despesas = movs.filter(m => m.tipo === 'despesa');

  // Verificar se já existe fecho para hoje
  if (state.fechos_caixa && state.fechos_caixa.some(f => f.data === hojeStr)) {
    toast('Já existe um fecho de caixa registado para hoje.', 'warning');
    return;
  }

  const detalhePagamento = {};
  vendas.forEach(v => {
    const mp = v.metodoPagamento || 'Numerário';
    detalhePagamento[mp] = (detalhePagamento[mp] || 0) + (Number(v.valor) || 0);
  });

  const totalVendas = (typeof BPMetrics !== 'undefined' && BPMetrics.somarValor) ? BPMetrics.somarValor(vendas) : vendas.reduce(function (s, v) { return s + (Number(v.valor) || 0); }, 0);
  const totalDespesas = despesas.reduce((s, d) => s + (Number(d.valor) || 0), 0);
  const saldoFinal = (Number(state.config.fundo) || 0) + totalVendas - totalDespesas;

  const registro = {
    id: uuid(),
    salao_id: state.config.salaoId,
    data: hojeStr,
    fundo_abertura: state.config.fundo,
    total_vendas: totalVendas,
    total_despesas: totalDespesas,
    saldo_final: saldoFinal,
    detalhe_pagamento: detalhePagamento,
    fechado_por: state.config.userId || null,
  };

  if (cBtn) { cBtn.dataset.bpSaving = '1'; try { cBtn.disabled = true; } catch (_) {} }
  try {
  await dbPut('fechos_caixa', registro);
  // Atualizar o estado local (Store quando disponível — notifica subscribers)
  if (window.BeautyStore && window.BeautyStore.pushToList) {
    window.BeautyStore.pushToList('fechos_caixa', registro);
  } else {
    if (!Array.isArray(state.fechos_caixa)) state.fechos_caixa = [];
    state.fechos_caixa.push(registro);
  }
  toast('Caixa fechado.', 'success');
  closeModal('modal-fecho');
  updateUI();
  } finally {
    if (cBtn) { cBtn.dataset.bpSaving = ''; try { cBtn.disabled = false; } catch (_) {} }
  }
}

// ====================================================================
//  FECHO DE CAIXA (listeners)
// ====================================================================
document.getElementById('fecho-caixa-btn')?.addEventListener('click', function () { if (typeof abrirFechoCaixa === 'function') abrirFechoCaixa(); });
document.getElementById('modal-fecho-fechar')?.addEventListener('click', () => closeModal('modal-fecho'));
document.getElementById('btn-imprimir-fecho')?.addEventListener('click', () => {
  const hojeStr = hoje();
  const _movsImp = (state.movimentos && Array.isArray(state.movimentos)) ? state.movimentos : [];
  const vendas = _movsImp.filter(function (m) { return m.data === hojeStr && (typeof BPMetrics !== 'undefined' && BPMetrics.isVendaValida ? BPMetrics.isVendaValida(m) : false); });
  const despesas = _movsImp.filter(m => m.data === hojeStr && m.tipo === 'despesa');
  const tv = (typeof BPMetrics !== 'undefined' && BPMetrics.somarValor) ? BPMetrics.somarValor(vendas) : vendas.reduce(function (s, v) { return s + (Number(v.valor) || 0); }, 0);
  const td = despesas.reduce((s, d) => s + (Number(d.valor) || 0), 0);
  const byPag = {};
  vendas.forEach(v => { const k = v.metodoPagamento || 'Numerário';
    byPag[k] = (byPag[k] || 0) + (Number(v.valor) || 0); });
  document.getElementById('recibo-print').innerHTML = `
    <div class="r-store">${escHtml(state.config.storeName)}</div>
    <div class="r-sub">FECHO DE CAIXA</div>
    <div class="r-num">${hojeStr}</div>
    <hr class="r-div">
    <div class="r-meta"><b>Fundo abertura: </b>${fmtKz(state.config.fundo)}</div>
    <div class="r-meta"><b>Total vendas (${vendas.length}): </b>${fmtKz(tv)}</div>
    <div class="r-meta"><b>Total despesas (${despesas.length}): </b>${fmtKz(td)}</div>
    <hr class="r-div">
    ${Object.entries(byPag).map(([k, v]) => `<div class="r-meta">${escHtml(k)}: ${fmtKz(v)}</div>`).join('')}
    <hr class="r-div">
    <div class="r-total">SALDO: ${fmtKz(state.config.fundo + tv - td)}</div>
    <div class="r-footer"><strong>BeautyPro</strong>Fechado ${new Date().toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}</div>`;
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
});

// NOVO: Listener para o botão "Confirmar Fecho"
document.getElementById('confirmar-fecho-btn')?.addEventListener('click', function () { if (typeof confirmarFechoCaixa === 'function') confirmarFechoCaixa(); });

// Detalhe venda
document.getElementById('modal-detalhe-fechar').addEventListener('click', () => closeModal('modal-detalhe-venda'));
document.getElementById('btn-imprimir-recibo').addEventListener('click', () => {
  if (vendaAtual && typeof imprimirRecibo === 'function') imprimirRecibo(vendaAtual);
  else toast('Nenhuma venda para imprimir', 'error');
});

// KPIs clicáveis
document.getElementById('kpi-revenue-card')?.addEventListener('click', function () { if (typeof abrirDetalheFaturamento === 'function') abrirDetalheFaturamento(); });
document.getElementById('kpi-agenda-card')?.addEventListener('click', () => abrirDetalheAgendamentos('pendentes'));

document.getElementById('modal-revenue-close').addEventListener('click', () => closeModal('modal-revenue-detail'));
document.getElementById('modal-agenda-close').addEventListener('click', () => closeModal('modal-agenda-detail'));

document.getElementById('agenda-detail-pendentes')?.addEventListener('click', () => abrirDetalheAgendamentos('pendentes'));
document.getElementById('agenda-detail-realizados')?.addEventListener('click', () => abrirDetalheAgendamentos('realizados'));

// hist-chip substituído pelo popover caixa-filter (Fase E)


// Filtro frequência clientes — texto só, sem fundo (activo = negrito dourado)
document.querySelectorAll('.filtro-frequencia').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.filtro-frequencia').forEach(b => {
      b.classList.remove('active', 'is-active');
    });
    this.classList.add('is-active');
    state.filtroClientes = this.dataset.filtro || 'todos';
    try { localStorage.setItem('bp_filtro_clientes', state.filtroClientes); } catch (_) {}
    if (typeof renderClientes === 'function') renderClientes();
  });
});

// Agenda navegação
// ====================================================================
//  FASE E — Filtro Caixa (popover) + Localizar cliente
// ====================================================================
(function initCaixaFiltro() {
  const icon = document.getElementById('caixa-filter-icon');
  const pop = document.getElementById('caixa-filter-popover');
  if (!icon || !pop) return;

  icon.addEventListener('click', function(e) {
    e.stopPropagation();
    const open = pop.style.display === 'block';
    pop.style.display = open ? 'none' : 'block';
    document.querySelectorAll('.caixa-periodo-filter').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.periodo === (state.histPeriodo || 'hoje'));
    });
  });

  document.addEventListener('click', function(e) {
    if (pop.style.display === 'block' && !pop.contains(e.target) && e.target !== icon && !icon.contains(e.target)) {
      pop.style.display = 'none';
    }
  });

  document.querySelectorAll('.caixa-periodo-filter').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const periodo = this.dataset.periodo;
      if (periodo === 'dia') {
        const input = document.getElementById('caixa-data-exata');
        if (input) {
          input.onchange = function() {
            if (this.value) {
              localStorage.setItem('bp_caixa_data_exata', this.value);
              state.histPeriodo = 'dia';
              pop.style.display = 'none';
              renderCaixa();
            }
          };
          input.click();
        }
        return;
      }
      state.histPeriodo = periodo;
      localStorage.setItem('bp_hist_periodo', periodo);
      pop.style.display = 'none';
      renderCaixa();
    });
  });
})();

(function initCaixaLocalizar() {
  const btn = document.getElementById('caixa-localizar-btn');
  const pop = document.getElementById('caixa-localizar-popover');
  const buscaBox = document.getElementById('caixa-localizar-busca');
  const input = document.getElementById('caixa-localizar-input');
  const go = document.getElementById('caixa-localizar-go');
  if (!btn || !pop) return;

  let periodoLoc = null;

  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    const open = pop.style.display === 'block';
    pop.style.display = open ? 'none' : 'block';
    try { btn.setAttribute('aria-expanded', open ? 'false' : 'true'); } catch (_) {}
    if (buscaBox) buscaBox.style.display = 'none';
    periodoLoc = null;
    document.querySelectorAll('.caixa-loc-periodo').forEach(b => b.classList.remove('active'));
  });

  document.addEventListener('click', function(e) {
    if (pop.style.display === 'block' && !pop.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      pop.style.display = 'none';
      try { btn.setAttribute('aria-expanded', 'false'); } catch (_) {}
    }
  });

  document.querySelectorAll('.caixa-loc-periodo').forEach(b => {
    b.addEventListener('click', function(e) {
      e.stopPropagation();
      var per = this.dataset.periodo;
      if (per === 'dia') {
        var din = document.getElementById('caixa-loc-data-exata');
        if (din) {
          din.onchange = function () {
            if (!this.value) return;
            localStorage.setItem('bp_caixa_loc_data_exata', this.value);
            localStorage.setItem('bp_caixa_data_exata', this.value);
            periodoLoc = 'dia';
            document.querySelectorAll('.caixa-loc-periodo').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            if (buscaBox) buscaBox.style.display = 'block';
            if (input) { input.value = ''; input.focus(); }
          };
          try {
            if (typeof din.showPicker === 'function') din.showPicker();
            else din.click();
          } catch (_) { try { din.click(); } catch (__) {} }
        }
        return;
      }
      periodoLoc = per;
      document.querySelectorAll('.caixa-loc-periodo').forEach(x => x.classList.remove('active'));
      this.classList.add('active');
      if (buscaBox) buscaBox.style.display = 'block';
      if (input) { input.value = ''; input.focus(); }
    });
  });

  function procurar() {
    if (!periodoLoc) {
      toast('Selecciona primeiro o período.', 'warning');
      return;
    }
    const nome = (input && input.value || '').trim().toLowerCase();
    if (!nome) {
      toast('Introduza o nome do cliente.', 'warning');
      return;
    }
    const movs = getMovimentosPeriodo(periodoLoc).filter(function (m) {
      var ok = (typeof BPMetrics !== 'undefined' && BPMetrics.isVendaValida)
        ? BPMetrics.isVendaValida(m)
        : false;
      return ok && m.cliente && m.cliente.toLowerCase().includes(nome);
    });
    if (movs.length === 0) {
      pop.style.display = 'none';
      openModal('modal-cliente-nao-encontrado');
      return;
    }
    // Mostrar só estes movimentos e actualizar título
    state.histPeriodo = periodoLoc;
    const cont = document.getElementById('movimentos-list');
    const tit = document.getElementById('hist-titulo');
    if (tit) tit.textContent = 'Histórico: ' + movs[0].cliente;
    if (cont) {
      cont.innerHTML = movs.sort((a,b) => b.data.localeCompare(a.data) || b.hora.localeCompare(a.hora)).map(m => {
        const nomeProf = typeof getProfissionalNome === 'function' ? getProfissionalNome(m.profissional_id) : '';
        var avLoc = '';
        try {
          var cliL = null;
          if (m.cliente_id) cliL = (state.clientes || []).find(function (c) { return String(c.id) === String(m.cliente_id); });
          if (!cliL && m.cliente) {
            var nL = String(m.cliente).toLowerCase().trim();
            cliL = (state.clientes || []).find(function (c) { return String(c.nome || '').toLowerCase().trim() === nL; });
          }
          var srcL = null;
          if (cliL && window.BPMedia && typeof BPMedia.resolveFotoSrc === 'function') srcL = BPMedia.resolveFotoSrc(cliL);
          else if (cliL && cliL.foto) srcL = cliL.foto;
          else if (cliL && cliL.foto_url) srcL = cliL.foto_url;
          if (srcL) {
            var _srcSafe = String(srcL).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            if (/^(https?:|data:image\/)/i.test(String(srcL).trim()) || String(srcL).indexOf('blob:') === 0) {
              avLoc = '<div class="avatar bp-avatar-img"><img src="' + _srcSafe + '" alt="" loading="lazy"></div>';
            } else {
              avLoc = '<div class="avatar">' + escHtml(String((cliL && cliL.nome) || m.cliente || '?').charAt(0).toUpperCase()) + '</div>';
            }
          }
          else if (cliL && cliL.nome) avLoc = '<div class="avatar">' + escHtml(String(cliL.nome).charAt(0).toUpperCase()) + '</div>';
          else if (m.cliente) avLoc = '<div class="avatar">' + escHtml(String(m.cliente).charAt(0).toUpperCase()) + '</div>';
          else avLoc = '<div class="avatar" style="background:#E6F4EC;color:var(--green);font-size:0;" aria-hidden="true"><span style="display:block;width:8px;height:8px;border-radius:50%;background:currentColor;margin:auto;"></span></div>';
        } catch (_) {
          avLoc = '<div class="avatar" style="background:#E6F4EC;color:var(--green);font-size:0;" aria-hidden="true"><span style="display:block;width:8px;height:8px;border-radius:50%;background:currentColor;margin:auto;"></span></div>';
        }
        return `<div class="list-item list-item-venda" data-id="${escHtml(m.id)}" data-tipo="venda" style="padding-right:32px;">
          ${avLoc}
          <div class="info">
            <div class="title">${escHtml(m.descricao)}</div>
            <div class="sub">${escHtml(m.data || '')} · ${escHtml(m.hora || '')} · ${escHtml(m.cliente || '')} · ${escHtml(m.metodoPagamento || '')}</div>
          </div>
          <div class="action" style="color:var(--green);">+${fmtKz(m.valor)}</div>
        </div>`;
      }).join('');
      cont.querySelectorAll('.list-item-venda').forEach(el => {
        el.addEventListener('click', function (e) { if (typeof abrirDetalheVenda === 'function') abrirDetalheVenda(el.dataset.id); });
      });
    }
    pop.style.display = 'none';
  }

  if (go) go.addEventListener('click', procurar);
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') procurar(); });
})();

(function bindClienteNaoEncontradoOk() {
  function fechar() {
    if (typeof closeModal === 'function') closeModal('modal-cliente-nao-encontrado');
    else {
      var el = document.getElementById('modal-cliente-nao-encontrado');
      if (el) {
        el.classList.remove('open');
        el.style.display = 'none';
        el.style.pointerEvents = '';
      }
      try { document.body.classList.remove('bp-modal-open'); } catch (_) {}
    }
  }
  function bind() {
    var btn = document.getElementById('modal-cliente-nao-encontrado-ok');
    if (!btn || btn.dataset.bpBoundOk === '1') return;
    btn.dataset.bpBoundOk = '1';
    btn.type = 'button';
    btn.addEventListener('click', function (ev) {
      try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}
      fechar();
    });
  }
  bind();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  setTimeout(bind, 500);
  /* Delegação (captura): cobre re-renders / timing */
  if (!window.__bpCliNaoEncDeleg) {
    window.__bpCliNaoEncDeleg = true;
    document.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest && ev.target.closest('#modal-cliente-nao-encontrado-ok');
      if (!t) return;
      try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}
      fechar();
    }, true);
  }
})();


// R50 — Cancelar venda (confirmação + motivo)
document.getElementById('btn-cancelar-venda')?.addEventListener('click', async function () {
  if (!vendaAtual || !vendaAtual.id) {
    if (typeof toast === 'function') toast('Nenhuma venda seleccionada.', 'warning');
    return;
  }
  if (String(vendaAtual.status || '').toLowerCase() === 'cancelado') {
    if (typeof toast === 'function') toast('Esta venda já está cancelada.', 'warning');
    return;
  }
  var ok = true;
  if (typeof showConfirmModal === 'function') {
    ok = await showConfirmModal(
      'Cancelar esta venda?',
      'A venda deixa de contar no caixa e a comissão é estornada. O registo permanece no histórico. Indique o motivo a seguir.',
      true,
      { confirmLabel: 'Continuar', cancelLabel: 'Voltar', variant: 'destructive' }
    );
  }
  if (!ok) return;
  var motivo = '';
  try {
    motivo = window.prompt('Motivo do cancelamento (obrigatório):', '') || '';
  } catch (_) {}
  motivo = String(motivo).trim();
  if (!motivo) {
    if (typeof bpNotifyFormError === 'function') bpNotifyFormError('Indique o motivo do cancelamento para continuar.');
    else if (typeof toast === 'function') toast('Indique o motivo do cancelamento para continuar.', 'warning');
    return;
  }
  var done = typeof cancelarVenda === 'function' ? await cancelarVenda(vendaAtual.id, motivo) : false;
  if (done) {
    closeModal('modal-detalhe-venda');
    if (typeof updateUI === 'function') updateUI();
  }
});

