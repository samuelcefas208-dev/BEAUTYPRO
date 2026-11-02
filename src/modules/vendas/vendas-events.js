/* BelezaPro — modules/vendas/vendas-events.js
 * Etapa 4: events de venda/carrinho extraídos de caixa-vendas-events + form-events.
 * Ownership: nova venda, carrinho, save/cancel venda, confirmação, finalizar→venda, detalhe/recibo, cancelar venda.
 * Carregar após vendas-modais.js (openVendaModal, cartItems, etc.).
 */

document.getElementById('nova-venda-hero-btn')?.addEventListener('click', function () {
  if (typeof openVendaModal === 'function') openVendaModal();
});

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
  try { if (typeof bpVendaAdvanceAfterAddItem === 'function') bpVendaAdvanceAfterAddItem(); } catch (_) {}
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
  window.__bpClienteRapidoReturn = 'venda';
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
  var metaBlockedId = null;
  try {
    metaBlockedId = window.__bpLastVendaMetaBlocked || null;
    window.__bpLastVendaMetaBlocked = null;
  } catch (_) { metaBlockedId = null; }
  if (!metaBlockedId && venda && venda.profissional_id && typeof bpProfEstaBloqueado === 'function') {
    try {
      if (bpProfEstaBloqueado(venda.profissional_id)) metaBlockedId = String(venda.profissional_id);
    } catch (_) {}
  }
  if (metaBlockedId) {
    if (typeof toast === 'function') {
      toast('Venda registada · meta atingida. Próximas operações deste profissional exigem autorização.', 'warning');
    }
    try {
      if (typeof bpProfFinPromptAdmin === 'function') {
        setTimeout(function () { bpProfFinPromptAdmin(metaBlockedId); }, 180);
      }
    } catch (_) {}
  } else if (typeof toast === 'function') {
    toast('Venda registada · ' + (typeof fmtKz === 'function' ? fmtKz(valor) : valor + ' Kz'), 'success');
  }
  if (typeof updateUI === 'function') updateUI();
  // Guardar id para impressão rápida se o utilizador abrir detalhe
  try { sessionStorage.setItem('bp_last_venda_id', vendaId); } catch (_) {}
}


/* Etapa 8 fase 2: modal-finalizar save/cancel → modules/agenda/agenda-events.js */
// Detalhe venda
document.getElementById('modal-detalhe-fechar').addEventListener('click', () => closeModal('modal-detalhe-venda'));
document.getElementById('btn-imprimir-recibo').addEventListener('click', () => {
  if (vendaAtual && typeof imprimirRecibo === 'function') imprimirRecibo(vendaAtual);
  else toast('Nenhuma venda para imprimir', 'error');
});
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


if (typeof window !== "undefined") {
  window.mostrarConfirmacaoVenda = mostrarConfirmacaoVenda;
  if (typeof ultimaVendaId !== "undefined") { /* last id in closure/module scope */ }
}


/* P1 — foco guiado e sincronização de passos do modal de venda */
(function bpBindVendaFlow() {
  if (window.__bpVendaFlowBound) return;
  window.__bpVendaFlowBound = true;
  var cli = document.getElementById('venda-cliente');
  if (cli) {
    cli.addEventListener('change', function () {
      try {
        if (typeof bpVendaSyncFlowUi === 'function') bpVendaSyncFlowUi();
        if (cli.value && typeof bpVendaAdvanceAfterCliente === 'function') bpVendaAdvanceAfterCliente();
      } catch (_) {}
    });
  }
  var srv = document.getElementById('ci-servico-sel');
  if (srv) {
    srv.addEventListener('change', function () {
      try {
        if (srv.value && typeof bpVendaAdvanceAfterServico === 'function') bpVendaAdvanceAfterServico();
      } catch (_) {}
    });
  }
  var pag = document.getElementById('venda-pagamento');
  if (pag) {
    pag.addEventListener('change', function () {
      try { if (typeof bpVendaSyncFlowUi === 'function') bpVendaSyncFlowUi(); } catch (_) {}
    });
  }
  var prof = document.getElementById('venda-profissional');
  if (prof) {
    prof.addEventListener('change', function () {
      try {
        if (prof.value && typeof bpVendaAdvanceAfterProfissional === 'function') {
          bpVendaAdvanceAfterProfissional();
        }
      } catch (_) {}
    });
  }
})();
