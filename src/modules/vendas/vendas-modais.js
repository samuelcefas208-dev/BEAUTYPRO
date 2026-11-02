/* BelezaPro C-3 — vendas-modais fora do monólito
 * Carregar APÓS app.bundle.js e ANTES de fluxos que chamam renderCart/addToCart.
 */

// ====================================================================
//  vendas-modais.js — extraído do app.js (Fase C da modularização)
//  Conteúdo: Sparkline, detalhe/recibo de venda, carrinho inteligente (agrupamento, +/- , persistência)
//  Linhas originais: 1143-1410
//  Carregar depois de core-*.js, db-indexeddb.js, sync-*.js, auth-supabase.js
// ====================================================================

let vendaAtual = null;

// ====================================================================
//  SPARKLINE — CORRIGIDA (funcional, robusta, com fallback)
// ====================================================================
function desenharSparkline(canvasId, dados, cor = '#D4AF37') {
  try {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      // Fallback: se o canvas não existir, cria um temporário
      console.warn('[Sparkline] Canvas não encontrado:', canvasId);
      return;
    }

    // Se o canvas não estiver visível (display:none), força um tamanho mínimo
    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width || 84;
    const cssHeight = rect.height || 28;
    
    // Redimensionar com devicePixelRatio
    const dpr = window.devicePixelRatio || 1;
    const bufferW = Math.round(cssWidth * dpr);
    const bufferH = Math.round(cssHeight * dpr);
    
    if (canvas.width !== bufferW || canvas.height !== bufferH) {
      canvas.width = bufferW;
      canvas.height = bufferH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const width = cssWidth;
    const height = cssHeight;

    ctx.clearRect(0, 0, width, height);

    // Se não há dados válidos
    if (!dados || !Array.isArray(dados) || dados.length < 2) {
      ctx.beginPath();
      ctx.moveTo(0, height - 4);
      ctx.lineTo(width, height - 4);
      ctx.strokeStyle = cor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.15;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#5C564E';
      ctx.font = '6px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('Sem dados', width/2, height - 2);
      return;
    }

    // Verifica se todos os valores são zero
    const todosZero = dados.every(v => v === 0);
    if (todosZero) {
      ctx.beginPath();
      ctx.moveTo(0, height - 4);
      ctx.lineTo(width, height - 4);
      ctx.strokeStyle = cor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.25;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = cor;
      ctx.font = '6px Inter';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('0 Kz', width - 2, height - 2);
      return;
    }

    const min = Math.min(...dados, 0);
    const max = Math.max(...dados, 10);
    const range = max - min || 1;
    const padding = 3;
    const usableHeight = height - padding * 2;

    // Linha
    ctx.beginPath();
    for (let i = 0; i < dados.length; i++) {
      const x = (i / (dados.length - 1)) * width;
      const y = height - padding - ((dados[i] - min) / range) * usableHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.strokeStyle = cor;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Ponto final
    const lastX = width;
    const lastY = height - padding - ((dados[dados.length - 1] - min) / range) * usableHeight;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 2, 0, Math.PI * 2);
    ctx.fillStyle = cor;
    ctx.fill();

    // Seta
    if (dados.length >= 2) {
      const ultimoValor = dados[dados.length - 1];
      const penultimoValor = dados[dados.length - 2];
      const direcao = ultimoValor >= penultimoValor ? 1 : -1;
      const xSeta = lastX;
      const ySeta = lastY;
      const tamanhoSeta = 5;
      ctx.beginPath();
      if (direcao > 0) {
        ctx.moveTo(xSeta - tamanhoSeta, ySeta + tamanhoSeta);
        ctx.lineTo(xSeta, ySeta - tamanhoSeta);
        ctx.lineTo(xSeta + tamanhoSeta, ySeta + tamanhoSeta);
      } else {
        ctx.moveTo(xSeta - tamanhoSeta, ySeta - tamanhoSeta);
        ctx.lineTo(xSeta, ySeta + tamanhoSeta);
        ctx.lineTo(xSeta + tamanhoSeta, ySeta - tamanhoSeta);
      }
      ctx.closePath();
      ctx.fillStyle = cor;
      ctx.fill();
    }
  } catch (e) {
    // Fallback silencioso: se algo falhar, a sparkline não quebra a UI
    console.warn('[Sparkline] Erro ao desenhar:', e);
  }
}

// ====================================================================
//  DETALHE / RECIBO DE VENDA
// ====================================================================
function abrirDetalheVenda(id) {
  const venda = state.movimentos.find(m => m.id === id && m.tipo === 'venda');
  if (!venda) { toast('Venda não encontrada', 'error'); return; }
  vendaAtual = venda;
  const nomeProf = typeof getProfissionalNome === 'function'
    ? getProfissionalNome(venda.profissional_id)
    : (venda.profissional || '—');
  const mp = venda.metodoPagamento || 'Numerário';
  const ref = String(venda.reciboNum || venda.id || '').slice(0, 8).toUpperCase();

  let itensHtml = '';
  if (venda.itens && venda.itens.length > 0) {
    itensHtml =
      '<div class="bp-view-section-title">Itens</div>' +
      '<div class="bp-view-dl bp-view-dl--itens">' +
      '<div class="detalhe-itens-header">' +
      '<span>Descrição</span><span style="text-align:right">Qtd</span><span style="text-align:right">Unit.</span><span style="text-align:right">Total</span></div>' +
      venda.itens.map(function (item) {
        var q = item.quantidade || 1;
        var unit = (item.precoUnit != null ? item.precoUnit : item.subtotal);
        var sub = item.subtotal;
        return (
          '<div class="detalhe-item-row">' +
          '<span class="desc">' + escHtml(item.nome) + '</span>' +
          '<span class="qty">' + q + '</span>' +
          '<span class="pu">' + fmtKz(unit) + '</span>' +
          '<span class="sub">' + fmtKz(sub) + '</span></div>'
        );
      }).join('') +
      '</div>';
  } else {
    itensHtml = '<p class="bp-view-value--muted" style="font-size:.85rem;margin:0 0 12px;">Sem linhas de item nesta venda.</p>';
  }

  const box = document.getElementById('detalhe-venda-conteudo');
  if (box) {
    box.innerHTML =
      '<div class="bp-view-dl">' +
      '<div class="bp-view-row"><span class="bp-view-label">Cliente</span><span class="bp-view-value">' + escHtml(venda.cliente || 'Avulso') + '</span></div>' +
      '<div class="bp-view-row"><span class="bp-view-label">Profissional</span><span class="bp-view-value">' + escHtml(nomeProf || '—') + '</span></div>' +
      '<div class="bp-view-row"><span class="bp-view-label">Quando</span><span class="bp-view-value">' + escHtml(String(venda.data || '')) + ' · ' + escHtml(String(venda.hora || '').slice(0, 5)) + '</span></div>' +
      '<div class="bp-view-row"><span class="bp-view-label">Pagamento</span><span class="bp-view-value"><span class="pagamento-badge">' + escHtml(mp) + '</span></span></div>' +
      (String(venda.status || '').toLowerCase() === 'cancelado' ? '<div class="bp-view-row"><span class="bp-view-label">Estado</span><span class="bp-view-value">Cancelada' + (venda.cancelado_motivo ? (' · ' + escHtml(venda.cancelado_motivo)) : '') + '</span></div>' : '') +
      '</div>' +
      itensHtml +
      '<div class="bp-view-total"><span class="bp-view-label">Total</span><span class="bp-view-value">' + fmtKz(Number(venda.valor) || 0) + '</span></div>';
  }
  const tit = document.getElementById('detalhe-venda-titulo');
  if (tit) tit.textContent = ref ? ('Ref. ' + ref) : 'Detalhe da venda';
  var btnCanc = document.getElementById('btn-cancelar-venda');
  if (btnCanc) {
    var jaCanc = String(venda.status || '').toLowerCase() === 'cancelado';
    var pode = typeof bpPode === 'function' ? bpPode(['admin', 'gerente']) : true;
    btnCanc.style.display = (!jaCanc && pode) ? '' : 'none';
    btnCanc.disabled = jaCanc;
  }
  openModal('modal-detalhe-venda');
}

function imprimirRecibo(venda) {
  if (!venda) { toast('Nenhuma venda seleccionada', 'error'); return; }
  const el = document.getElementById('recibo-print');
  if (!el) {
    toast('Erro: elemento de impressão não encontrado', 'error');
    return;
  }
  const storeName = state.config.storeName || 'BeautyPro';
  const num = venda.reciboNum || nextReciboNum();
  const itensHtml = venda.itens && venda.itens.length > 0 ?
    `<div class="r-th"><span class="r-th-desc">SERVICO</span><span class="r-th-qty">QT</span><span class="r-th-sub">TOTAL</span></div>
     ${venda.itens.map(i => `<div class="r-item"><span class="r-item-name">${escHtml(i.nome)}</span><span class="r-item-qty">x${i.quantidade}</span><span class="r-item-sub">${fmtKz(i.subtotal)}</span></div>`).join('')}` :
    '<div style="font-size:7pt;">Sem itens</div>';
  const nomeProf = getProfissionalNome(venda.profissional_id);
  el.innerHTML = `
    <div class="r-store">${escHtml(storeName)}</div>
    <div class="r-sub">Luanda, Angola</div>
    <div class="r-num">Recibo N.º ${num}</div>
    <div class="r-num">${venda.data} &nbsp; ${venda.hora}</div>
    <hr class="r-div">
    <div class="r-meta"><b>CLIENTE: </b>${escHtml(venda.cliente || 'Anonimo')}</div>
    <div class="r-meta"><b>PROF.: </b>${escHtml(nomeProf)}</div>
    <hr class="r-div">
    ${itensHtml}
    <hr class="r-div">
    <div class="r-total">TOTAL: ${fmtKz(venda.valor)}</div>
    <div class="r-pag">Pag.: ${escHtml(venda.metodoPagamento || 'Numerario')}</div>
    <hr class="r-div">
    <div class="r-footer"><strong>Obrigado pela preferencia!</strong>Volte sempre ao ${escHtml(storeName)}</div>`;
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}

// ====================================================================
//  CARRINHO INTELIGENTE (agrupamento, +/- , persistência) — SEM PROFISSIONAL POR ITEM
// ====================================================================

/** Microinterações do carrinho (respeita prefers-reduced-motion). */
let _cartAnim = { type: null, idx: -1, nome: null };
function _cartMotionOk() {
  try {
    return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) { return true; }
}
function _pulseCartTotal() {
  if (!_cartMotionOk()) return;
  const el = document.querySelector('#cart-total-area .ct-val');
  if (!el) return;
  el.classList.remove('ct-val--pulse');
  void el.offsetWidth;
  el.classList.add('ct-val--pulse');
  setTimeout(function () { el.classList.remove('ct-val--pulse'); }, 280);
}
function _bumpEl(row, sel) {
  if (!_cartMotionOk() || !row) return;
  const el = row.querySelector(sel);
  if (!el) return;
  el.classList.remove('is-bump');
  void el.offsetWidth;
  el.classList.add('is-bump');
  setTimeout(function () { el.classList.remove('is-bump'); }, 220);
}

let cartItems = [];
// ET4.4: chave legada + chave por salão (isolamento multi-tenant no device)
const CART_STORAGE_KEY_LEGACY = 'bp_cart_items';

function cartStorageKey() {
  try {
    var sid = (typeof state !== 'undefined' && state.config && state.config.salaoId)
      ? String(state.config.salaoId) : '';
    if (sid) return 'bp_cart_items_' + sid;
  } catch (_) {}
  return CART_STORAGE_KEY_LEGACY;
}

// --- Persistência ---
function saveCartToStorage() {
  try { localStorage.setItem(cartStorageKey(), JSON.stringify(cartItems)); } catch (e) {}
}

function loadCartFromStorage() {
  try {
    var key = cartStorageKey();
    var data = localStorage.getItem(key);
    // migração única: legado global → chave do salão actual
    if (!data && key !== CART_STORAGE_KEY_LEGACY) {
      data = localStorage.getItem(CART_STORAGE_KEY_LEGACY);
      if (data) {
        try { localStorage.setItem(key, data); } catch (_) {}
        try { localStorage.removeItem(CART_STORAGE_KEY_LEGACY); } catch (_) {}
      }
    }
    if (data) {
      cartItems = JSON.parse(data);
      if (!Array.isArray(cartItems)) cartItems = [];
      renderCart();
    }
  } catch (e) { cartItems = []; }
}

function clearCartStorageAll() {
  cartItems = [];
  try { localStorage.removeItem(CART_STORAGE_KEY_LEGACY); } catch (_) {}
  try {
    var key = cartStorageKey();
    if (key) localStorage.removeItem(key);
  } catch (_) {}
  // limpar outras chaves de carrinho no device (troca de salão)
  try {
    for (var i = localStorage.length - 1; i >= 0; i--) {
      var k = localStorage.key(i);
      if (k && k.indexOf('bp_cart_items') === 0) localStorage.removeItem(k);
    }
  } catch (_) {}
}
if (typeof window !== "undefined") window.clearCartStorageAll = clearCartStorageAll;


// --- Renderização do carrinho com botões + / - e total detalhado ---
function renderCart() {
  const list = document.getElementById('cart-items-list');
  const totalArea = document.getElementById('cart-total-area');
  if (!list) return;

  if (cartItems.length === 0) {
    list.innerHTML = `
      <div class="venda-cart-empty">
        <p class="venda-cart-empty-title">Carrinho vazio</p>
        <p class="venda-cart-empty-hint">Adicione um serviço acima.</p>
      </div>`;
    if (totalArea) {
      totalArea.innerHTML = '';
      totalArea.hidden = true;
    }
    updateVendaSaveButton();
    return;
  }

  list.innerHTML = cartItems.map((item, idx) => {
    let cls = 'cart-item-row';
    if (_cartAnim.type === 'add' && (
      (_cartAnim.idx === idx) || (_cartAnim.nome && item.nome === _cartAnim.nome)
    )) cls += ' adding';
    if (_cartAnim.type === 'qty' && _cartAnim.idx === idx) cls += ' is-qty-flash';
    return `
    <div class="${cls}" data-idx="${idx}" data-nome="${escHtml(item.nome)}">
      <span class="ci-name">${escHtml(item.nome)}</span>
      <span class="ci-qty-controls">
        <button type="button" class="qty-btn" data-idx="${idx}" data-action="decrement" aria-label="Diminuir quantidade">−</button>
        <span class="qty-number">${item.quantidade}</span>
        <button type="button" class="qty-btn" data-idx="${idx}" data-action="increment" aria-label="Aumentar quantidade">+</button>
      </span>
      <span class="ci-val">${fmtKz(item.subtotal)}</span>
      <button type="button" class="ci-del" data-idx="${idx}" aria-label="Remover item">✕</button>
    </div>`;
  }).join('');
  // Limpar flags após paint + micro-bumps
  const animType = _cartAnim.type;
  const animIdx = _cartAnim.idx;
  _cartAnim = { type: null, idx: -1, nome: null };
  if (animType && _cartMotionOk()) {
    requestAnimationFrame(function () {
      const row = list.querySelector('.cart-item-row[data-idx="' + animIdx + '"]') ||
        list.querySelector('.cart-item-row.adding') ||
        list.querySelector('.cart-item-row.is-qty-flash');
      if (row && (animType === 'qty' || animType === 'add')) {
        _bumpEl(row, '.qty-number');
        _bumpEl(row, '.ci-val');
      }
      _pulseCartTotal();
      list.querySelectorAll('.cart-item-row.adding').forEach(function (r) {
        r.addEventListener('animationend', function () { r.classList.remove('adding'); }, { once: true });
      });
      list.querySelectorAll('.cart-item-row.is-qty-flash').forEach(function (r) {
        setTimeout(function () { r.classList.remove('is-qty-flash'); }, 400);
      });
    });
  } else {
    _pulseCartTotal();
  }

  const total = cartItems.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
  const totalItems = cartItems.reduce((s, i) => s + (Number(i.quantidade) || 0), 0);
  if (totalArea) {
    totalArea.hidden = false;
    totalArea.innerHTML = `
      <div class="cart-total-row">
        <span class="ct-label">${totalItems === 1 ? '1 item' : totalItems + ' itens'}</span>
        <span class="ct-val">${fmtKz(total)}</span>
      </div>
    `;
  }

  saveCartToStorage();
  updateVendaSaveButton();
}

/** CTA do rodapé: desactivado se vazio; mostra o valor a cobrar. */
  try { if (typeof bpVendaSyncFlowUi === 'function') bpVendaSyncFlowUi(); } catch (_f) {}

function updateVendaSaveButton() {
  const btn = document.getElementById('modal-venda-save');
  if (!btn) return;
  const total = (cartItems || []).reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
  const n = (cartItems || []).length;
  if (n === 0 || total <= 0) {
    btn.disabled = true;
    btn.textContent = 'Cobrar';
    btn.setAttribute('aria-disabled', 'true');
  } else {
    btn.disabled = false;
    btn.textContent = 'Cobrar · ' + (typeof fmtKz === 'function' ? fmtKz(total) : total + ' Kz');
    btn.removeAttribute('aria-disabled');
  }
}

// --- Ajustar quantidade ---
function adjustQuantity(idx, delta) {
  if (idx < 0 || idx >= cartItems.length) return;
  const item = cartItems[idx];
  const newQty = item.quantidade + delta;
  if (newQty <= 0) {
    removeItemFromCart(idx, true);
    return;
  }
  item.quantidade = Math.floor(Number(newQty)) || 1;
  if (item.quantidade < 1) item.quantidade = 1;
  item.subtotal = item.quantidade * item.precoUnit;
  _cartAnim = { type: 'qty', idx: idx, nome: item.nome };
  renderCart();
  if (typeof updateVendaSaveButton === 'function') updateVendaSaveButton();
}

// --- Remover item (com confirmação) ---
async function removeItemFromCart(idx, skipConfirm) {
  if (idx < 0 || idx >= cartItems.length) return;
  const item = cartItems[idx];
  if (!skipConfirm && item.quantidade > 1) {
    let choice = true;
    if (typeof showConfirmModal === 'function') {
      choice = await showConfirmModal(
        'Remover item?',
        '"' + (item.nome || 'Item') + '" tem ' + item.quantidade + ' unidades. Queres remover todas da venda?',
        true,
        { confirmLabel: 'Remover', cancelLabel: 'Cancelar', variant: 'destructive' }
      );
    } else {
      choice = true;
    }
    if (!choice) {
      // Deixar só 1 unidade em vez de forçar decisão binária agressiva
      item.quantidade = 1;
      item.subtotal = item.precoUnit;
      _cartAnim = { type: 'qty', idx: idx, nome: item.nome };
      renderCart();
      return;
    }
  }

  const list = document.getElementById('cart-items-list');
  const row = list && list.querySelector('.cart-item-row[data-idx="' + idx + '"]');
  const finish = function () {
    cartItems.splice(idx, 1);
    renderCart();
  };
  if (row && _cartMotionOk()) {
    row.classList.add('removing');
    let done = false;
    const once = function () {
      if (done) return;
      done = true;
      finish();
    };
    row.addEventListener('animationend', once, { once: true });
    setTimeout(once, 320); // fallback se animationend não disparar
  } else {
    finish();
  }
}

// --- Função central de adição ao carrinho (sem profissional) ---
async function addToCart(nome, valor) {
  // R17: manter o nome exacto do catálogo (nunca sufixar preço — quebrava a validação)
  nome = String(nome || '').trim();
  valor = Number(valor);
  if (!nome || !Number.isFinite(valor) || valor <= 0) {
    if (typeof toast === 'function') toast('Informe um preço válido superior a zero.', 'warning');
    return;
  }
  const existingIndex = cartItems.findIndex(function (item) {
    return item && item.nome === nome && Number(item.precoUnit) === valor;
  });
  if (existingIndex !== -1) {
    const existing = cartItems[existingIndex];
    existing.quantidade += 1;
    existing.subtotal = existing.quantidade * existing.precoUnit;
    _cartAnim = { type: 'qty', idx: existingIndex, nome: existing.nome };
    renderCart();
    return;
  }
  // Mesmo serviço, preço diferente → linha separada, nome de catálogo intacto
  const sameNameIdx = cartItems.findIndex(function (item) { return item && item.nome === nome; });
  if (sameNameIdx !== -1) {
    const existing = cartItems[sameNameIdx];
    if (Number(existing.precoUnit) !== valor) {
      let choice = false;
      if (typeof showConfirmModal === 'function') {
        choice = await showConfirmModal(
          'Atualizar preço?',
          '"' + nome + '" já está no carrinho a ' + (typeof fmtKz === 'function' ? fmtKz(existing.precoUnit) : existing.precoUnit) + '. Queres atualizar para ' + (typeof fmtKz === 'function' ? fmtKz(valor) : valor) + '? Se cancelares, os dois preços ficam como linhas separadas.',
          false,
          { confirmLabel: 'Atualizar', cancelLabel: 'Manter separados', variant: 'default' }
        );
      }
      if (choice) {
        existing.precoUnit = valor;
        existing.subtotal = existing.quantidade * valor;
        _cartAnim = { type: 'qty', idx: sameNameIdx, nome: existing.nome };
        renderCart();
        return;
      }
    }
  }
  cartItems.push({
    nome: nome,
    quantidade: 1,
    precoUnit: valor,
    subtotal: valor
  });
  _cartAnim = { type: 'add', idx: cartItems.length - 1, nome: nome };
  renderCart();
}

// --- Event listeners (delegação para botões do carrinho) ---
document.addEventListener('click', function(e) {
  const qtyBtn = e.target.closest('.qty-btn');
  if (qtyBtn) {
    e.preventDefault();
    const idx = parseInt(qtyBtn.dataset.idx);
    const action = qtyBtn.dataset.action;
    if (action === 'increment') adjustQuantity(idx, 1);
    else if (action === 'decrement') adjustQuantity(idx, -1);
    return;
  }

  const delBtn = e.target.closest('.ci-del');
  if (delBtn) {
    e.preventDefault();
    const idx = parseInt(delBtn.dataset.idx);
    removeItemFromCart(idx);
    return;
  }
});

// --- Função de abertura do modal (restaurar carrinho) ---

/** P1 — fluxo guiado do modal de venda (foco + ênfase visual, sem esconder dados). */
function bpVendaFocus(id) {
  try {
    var el = document.getElementById(id);
    if (!el || typeof el.focus !== 'function') return;
    try { el.focus({ preventScroll: true }); } catch (e1) { try { el.focus(); } catch (e2) {} }
  } catch (_) {}
}

function bpVendaHasCliente() {
  var sel = document.getElementById('venda-cliente');
  return !!(sel && String(sel.value || '').trim());
}

function bpVendaHasCart() {
  return typeof cartItems !== 'undefined' && Array.isArray(cartItems) && cartItems.length > 0;
}

/** Passo lógico: 1 cliente → 2 serviço → 3 pagamento (carrinho acompanha 2). */
function bpVendaSyncFlowUi() {
  try {
    var modal = document.getElementById('modal-venda');
    if (!modal) return;
    var hasCli = bpVendaHasCliente();
    var hasCart = bpVendaHasCart();
    var step = !hasCli ? 'cliente' : (!hasCart ? 'servico' : 'pagamento');
    modal.setAttribute('data-venda-step', step);

    var map = [
      ['venda-sec-cliente', 'cliente'],
      ['venda-sec-servico', 'servico'],
      ['venda-sec-carrinho', 'servico'],
      ['venda-sec-pagamento', 'pagamento']
    ];
    map.forEach(function (pair) {
      var sec = document.getElementById(pair[0]);
      if (!sec) return;
      var active = pair[1] === step;
      sec.classList.toggle('venda-step-active', active);
      sec.classList.toggle('venda-step-done', false);
    });
    /* Marcar passos concluídos */
    var secCli = document.getElementById('venda-sec-cliente');
    var secSrv = document.getElementById('venda-sec-servico');
    var secCart = document.getElementById('venda-sec-carrinho');
    if (secCli) secCli.classList.toggle('venda-step-done', hasCli && step !== 'cliente');
    if (secSrv) secSrv.classList.toggle('venda-step-done', hasCart);
    if (secCart) secCart.classList.toggle('venda-step-done', hasCart);

    var pag = document.getElementById('venda-pagamento');
    var secPag = document.getElementById('venda-sec-pagamento');
    if (pag) {
      if (!hasCart) {
        pag.disabled = true;
        pag.setAttribute('aria-disabled', 'true');
        if (!pag.value) { /* keep empty */ }
      } else {
        pag.disabled = false;
        pag.removeAttribute('aria-disabled');
      }
    }
    if (secPag) {
      secPag.classList.toggle('venda-step-locked', !hasCart);
      secPag.classList.toggle('venda-step-active', hasCart && step === 'pagamento');
    }
    var hint = document.getElementById('venda-flow-hint');
    if (hint) {
      if (!hasCli) hint.textContent = '1 · Escolha o cliente';
      else if (!hasCart) hint.textContent = '2 · Adicione pelo menos um serviço';
      else hint.textContent = '3 · Método de pagamento e cobrar';
    }
  } catch (e) {
    try { console.warn('[bpVendaSyncFlowUi]', e); } catch (_) {}
  }
}

function bpVendaAdvanceAfterCliente() {
  if (!bpVendaHasCliente()) return;
  bpVendaSyncFlowUi();
  bpVendaFocus('ci-servico-sel');
}

function bpVendaAdvanceAfterServico() {
  var cat = document.getElementById('ci-servico-sel');
  if (!cat || !String(cat.value || '').trim()) return;
  /* Parar no valor para o utilizador confirmar o preço; profissional é o passo seguinte manual */
  bpVendaFocus('ci-valor');
  try {
    var v = document.getElementById('ci-valor');
    if (v && typeof v.select === 'function' && !v.disabled) v.select();
  } catch (_) {}
}

function bpVendaAdvanceAfterProfissional() {
  var prof = document.getElementById('venda-profissional');
  if (!prof || !String(prof.value || '').trim()) return;
  bpVendaSyncFlowUi();
  var btn = document.getElementById('btn-add-item');
  if (btn) {
    try { btn.classList.add('venda-add-ready'); } catch (_) {}
    bpVendaFocus('btn-add-item');
    try { btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (_) {}
  }
}

function bpVendaAdvanceAfterAddItem() {
  bpVendaSyncFlowUi();
  if (bpVendaHasCart()) {
    bpVendaFocus('venda-pagamento');
  } else {
    bpVendaFocus('ci-servico-sel');
  }
}


function openVendaModal() {
  try {
    /* E9 — garantir finance (comissões + split) antes/durante o modal de venda */
    if (typeof window.bpLoadDeferredFinance === 'function') {
      window.bpLoadDeferredFinance();
    }
    loadCartFromStorage();
    const clientSel = document.getElementById('venda-cliente');
    if (clientSel) {
      const opts = ['<option value="">Seleccionar cliente</option>']
        .concat((state.clientes || []).filter(function (c) {
          if (!c || !c.nome) return false;
          if (c.ativo === false || c.ativo === 0 || c.ativo === 'false') return false;
          return true;
        }).map(function (c) {
          return '<option value="' + escHtml(c.nome) + '">' + escHtml(c.nome) + '</option>';
        }));
      clientSel.innerHTML = opts.join('');
    }
    if (typeof populateVendaSelects === 'function') populateVendaSelects();
    const pag = document.getElementById('venda-pagamento');
    if (pag) pag.value = '';
    renderCart();
    updateVendaSaveButton();
    var modalVenda = document.getElementById('modal-venda');
    if (modalVenda) modalVenda.dataset.bpSkipAutofocus = '1';
    if (typeof openModal === 'function') openModal('modal-venda');
    else if (modalVenda) {
      modalVenda.classList.add('open');
      modalVenda.style.display = 'flex';
      document.body.classList.add('bp-modal-open');
    }
    try { bpVendaSyncFlowUi(); } catch (_) {}
    setTimeout(function () {
      if (!bpVendaHasCliente()) bpVendaFocus('venda-cliente');
      else if (!bpVendaHasCart()) bpVendaFocus('ci-servico-sel');
      else bpVendaFocus('venda-pagamento');
    }, 120);
  } catch (err) {
    console.error('[openVendaModal]', err);
    if (typeof toast === 'function') toast('Não foi possível abrir a venda', 'error');
  }
}

// --- Limpar carrinho (após venda ou cancelamento) ---
function clearCart() {
  cartItems = [];
  localStorage.removeItem(cartStorageKey());
  renderCart();
}

// --- Expor funções globalmente (para outros ficheiros) ---
window.addToCart = addToCart;
window.clearCart = clearCart;
window.loadCartFromStorage = loadCartFromStorage;
window.saveCartToStorage = saveCartToStorage;
if (window.addToCart) window.addToCart._bpOwner = 'modules/vendas';
if (window.clearCart) window.clearCart._bpOwner = 'modules/vendas';

/* Etapa 8.1: openServicoModal / setServicoModalMode / detalhe serviço
 * movidos para modules/servicos/servicos-modal.js
 */


if (typeof window !== 'undefined') {
  window.bpVendaSyncFlowUi = bpVendaSyncFlowUi;
  window.bpVendaAdvanceAfterCliente = bpVendaAdvanceAfterCliente;
  window.bpVendaAdvanceAfterServico = bpVendaAdvanceAfterServico;
  window.bpVendaAdvanceAfterProfissional = bpVendaAdvanceAfterProfissional;
  window.bpVendaAdvanceAfterAddItem = bpVendaAdvanceAfterAddItem;
  window.bpVendaFocus = bpVendaFocus;
}
