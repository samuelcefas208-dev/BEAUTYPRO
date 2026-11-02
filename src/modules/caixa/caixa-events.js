/* BelezaPro — modules/caixa/caixa-events.js
 * Etapa 4: events de caixa extraídos de caixa-vendas-events.js.
 * Ownership: despesa, fundo, fecho de caixa, KPI faturamento, filtros/localizar caixa.
 * Carregar após caixa-render + crud.
 */
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

// KPIs clicáveis
document.getElementById('kpi-revenue-card')?.addEventListener('click', function () { if (typeof abrirDetalheFaturamento === 'function') abrirDetalheFaturamento(); });
document.getElementById('modal-revenue-close').addEventListener('click', () => closeModal('modal-revenue-detail'));
(function initCaixaFiltro() {
  const icon = document.getElementById('caixa-filter-icon');
  const pop = document.getElementById('caixa-filter-popover');
  if (!icon || !pop) return;

  icon.addEventListener('click', function(e) {
    e.stopPropagation();
    const open = pop.style.display === 'block';
    pop.style.display = open ? 'none' : 'block';
    var per = state.histPeriodo || 'hoje';
    document.querySelectorAll('.caixa-periodo-filter').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.periodo === per);
    });
    var dataExata = document.getElementById('caixa-data-exata');
    var customBox = document.getElementById('caixa-periodo-custom');
    if (dataExata) dataExata.style.display = (per === 'dia') ? 'block' : 'none';
    if (customBox) {
      var showC = (per === 'custom');
      customBox.style.display = showC ? 'block' : 'none';
      customBox.hidden = !showC;
    }
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
      var customBox = document.getElementById('caixa-periodo-custom');
      var dataExata = document.getElementById('caixa-data-exata');
      if (periodo === 'dia') {
        if (customBox) { customBox.style.display = 'none'; customBox.hidden = true; }
        if (dataExata) {
          dataExata.style.display = 'block';
          dataExata.onchange = function() {
            if (this.value) {
              localStorage.setItem('bp_caixa_data_exata', this.value);
              state.histPeriodo = 'dia';
              localStorage.setItem('bp_hist_periodo', 'dia');
              pop.style.display = 'none';
              if (typeof renderCaixa === 'function') renderCaixa();
            }
          };
          try {
            if (typeof dataExata.showPicker === 'function') dataExata.showPicker();
            else dataExata.click();
          } catch (_) { try { dataExata.click(); } catch (__) {} }
        }
        return;
      }
      if (periodo === 'custom') {
        if (dataExata) dataExata.style.display = 'none';
        if (customBox) {
          customBox.style.display = 'block';
          customBox.hidden = false;
          var de = document.getElementById('caixa-custom-de');
          var ate = document.getElementById('caixa-custom-ate');
          if (de && !de.value) de.value = localStorage.getItem('bp_caixa_custom_de') || '';
          if (ate && !ate.value) ate.value = localStorage.getItem('bp_caixa_custom_ate') || '';
          function applyCustom() {
            if (!de || !ate || !de.value || !ate.value) return;
            if (de.value > ate.value) return;
            localStorage.setItem('bp_caixa_custom_de', de.value);
            localStorage.setItem('bp_caixa_custom_ate', ate.value);
            state.histPeriodo = 'custom';
            localStorage.setItem('bp_hist_periodo', 'custom');
            document.querySelectorAll('.caixa-periodo-filter').forEach(function (b) {
              b.classList.toggle('active', b.dataset.periodo === 'custom');
            });
            pop.style.display = 'none';
            if (typeof renderCaixa === 'function') renderCaixa();
          }
          if (de) de.onchange = applyCustom;
          if (ate) ate.onchange = applyCustom;
        }
        document.querySelectorAll('.caixa-periodo-filter').forEach(function (b) {
          b.classList.toggle('active', b.dataset.periodo === 'custom');
        });
        return;
      }
      if (customBox) { customBox.style.display = 'none'; customBox.hidden = true; }
      if (dataExata) dataExata.style.display = 'none';
      state.histPeriodo = periodo;
      localStorage.setItem('bp_hist_periodo', periodo);
      pop.style.display = 'none';
      if (typeof renderCaixa === 'function') renderCaixa();
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

  function _normNome(s) {
    return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
  }
  function _matchNome(hay, q) {
    var h = _normNome(hay);
    return !!q && !!h && h.indexOf(q) !== -1;
  }
  function _clienteCadastro(q) {
    var list = state.clientes || [];
    var exact = list.filter(function (c) { return _normNome(c.nome) === q; });
    if (exact.length) return exact;
    return list.filter(function (c) {
      if (_matchNome(c.nome, q)) return true;
      var tel = String(c.telefone || c.contacto || c.phone || '').replace(/\D/g, '');
      var qd = q.replace(/\D/g, '');
      return qd.length >= 3 && tel.indexOf(qd) !== -1;
    });
  }
  function _vendasNome(list, q) {
    return (list || []).filter(function (m) {
      if (m.tipo !== 'venda') return false;
      if (_matchNome(m.cliente, q)) return true;
      if (m.cliente_id) {
        var c = (state.clientes || []).find(function (x) { return String(x.id) === String(m.cliente_id); });
        if (c && _matchNome(c.nome, q)) return true;
      }
      return false;
    });
  }
  function _labelPeriodoLoc(k) {
    var map = {
      hoje: 'Hoje', ontem: 'Ontem', semana: 'Esta semana', '7dias': 'Últimos 7 dias',
      '30dias': 'Últimos 30 dias', '90dias': 'Últimos 90 dias', mes: 'Este mês', ano: 'Este ano', dia: 'Dia exacto'
    };
    return map[k] || k;
  }
  function _fmtDataLoc(iso) {
    if (!iso || String(iso).length < 10) return iso || '';
    var p = String(iso).slice(0, 10).split('-');
    if (p.length !== 3) return iso;
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  function _sugerirPeriodosCliente(q) {
    var opts = [];
    var seen = {};
    try {
      var todos = (state.movimentos && Array.isArray(state.movimentos)) ? state.movimentos : [];
      var emTodo = _vendasNome(todos, q);
      var byDay = {};
      emTodo.forEach(function (m) {
        var d = m.data ? String(m.data).slice(0, 10) : '';
        if (!d) return;
        byDay[d] = (byDay[d] || 0) + 1;
      });
      // Dias concretos em que o cliente veio (mais recentes)
      Object.keys(byDay).sort().reverse().forEach(function (d) {
        if (opts.length >= 3) return;
        var key = 'dia:' + d;
        if (seen[key]) return;
        seen[key] = 1;
        opts.push({ tipo: 'dia', data: d, label: 'Dia ' + _fmtDataLoc(d), count: byDay[d] });
      });
      // Buckets com histórico (inclui últimos 30 dias, etc.)
      var buckets = ['hoje', 'ontem', 'semana', '7dias', '30dias', '90dias', 'mes', 'ano'];
      buckets.forEach(function (k) {
        if (opts.length >= 6) return;
        if (typeof getMovimentosPeriodo !== 'function') return;
        var n = 0;
        try { n = _vendasNome(getMovimentosPeriodo(k), q).length; } catch (_) { n = 0; }
        if (!n || seen[k]) return;
        seen[k] = 1;
        opts.push({ tipo: 'periodo', periodo: k, label: _labelPeriodoLoc(k), count: n });
      });
    } catch (_) {}
    return opts;
  }
  function _abrirSemPeriodo(nomeLabel, q) {
    var titleEl = document.getElementById('caixa-loc-periodo-title');
    var msgEl = document.getElementById('caixa-loc-periodo-msg');
    var box = document.getElementById('caixa-loc-sugestoes');
    if (titleEl) titleEl.textContent = 'Sem histórico neste período';
    if (msgEl) {
      var base = nomeLabel
        ? ('Não há vendas de «' + nomeLabel + '» no período seleccionado.')
        : 'Não há vendas deste cliente no período seleccionado.';
      msgEl.textContent = base + ' Podes filtrar por outro período.';
    }
    var opts = _sugerirPeriodosCliente(q);
    if (box) {
      box.innerHTML = '';
      if (opts.length) {
        box.hidden = false;
        var intro = document.createElement('p');
        intro.className = 'bp-caixa-loc-sugestoes-intro';
        intro.textContent = opts.length >= 2
          ? 'Períodos com histórico deste cliente:'
          : 'Período com histórico deste cliente:';
        box.appendChild(intro);
        opts.slice(0, 6).forEach(function (o) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'btn btn-secondary btn-sm bp-caixa-loc-sugestao';
          b.textContent = o.label + (o.count ? (' · ' + o.count + (o.count === 1 ? ' venda' : ' vendas')) : '');
          b.setAttribute('data-tipo', o.tipo);
          if (o.tipo === 'dia') b.setAttribute('data-data', o.data);
          if (o.tipo === 'periodo') b.setAttribute('data-periodo', o.periodo);
          box.appendChild(b);
        });
      } else {
        box.hidden = true;
      }
    }
    if (typeof openModal === 'function') openModal('modal-caixa-loc-periodo');
  }
  function procurar() {
    if (!periodoLoc) {
      toast('Selecciona primeiro o período.', 'warning');
      return;
    }
    const nome = _normNome(input && input.value || '');
    if (!nome) {
      toast('Introduza o nome do cliente.', 'warning');
      return;
    }
    var todos = (state.movimentos && Array.isArray(state.movimentos)) ? state.movimentos : [];
    var noPeriodo = _vendasNome(typeof getMovimentosPeriodo === 'function' ? getMovimentosPeriodo(periodoLoc) : [], nome);
    var emTodo = _vendasNome(todos, nome);
    var noCadastro = _clienteCadastro(nome);
    var movs = noPeriodo;
    if (movs.length === 0) {
      pop.style.display = 'none';
      if (emTodo.length || noCadastro.length) {
        var nomeLabel = (emTodo[0] && emTodo[0].cliente)
          || (noCadastro[0] && noCadastro[0].nome)
          || (input && input.value) || '';
        try { _abrirSemPeriodo(nomeLabel, nome); } catch (_) {
          try { openModal('modal-cliente-nao-encontrado'); } catch (__) {}
        }
        return;
      }
      var msgEl = document.getElementById('cliente-nao-encontrado-msg');
      var titleEl = document.getElementById('cliente-nao-encontrado-title');
      if (titleEl) titleEl.textContent = 'Cliente não encontrado';
      if (msgEl) msgEl.textContent = 'Não encontrei o cliente. Verifica se o nome está correcto ou se o cliente que procura está cadastrado.';
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


  var sugBox = document.getElementById('caixa-loc-sugestoes');
  if (sugBox && !sugBox._bpBound) {
    sugBox._bpBound = true;
    sugBox.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest && ev.target.closest('.bp-caixa-loc-sugestao');
      if (!b) return;
      var tipo = b.getAttribute('data-tipo');
      if (tipo === 'dia') {
        var d = b.getAttribute('data-data');
        if (d) {
          try {
            localStorage.setItem('bp_caixa_loc_data_exata', d);
            localStorage.setItem('bp_caixa_data_exata', d);
          } catch (_) {}
          periodoLoc = 'dia';
        }
      } else if (tipo === 'periodo') {
        periodoLoc = b.getAttribute('data-periodo') || periodoLoc;
      }
      if (typeof closeModal === 'function') closeModal('modal-caixa-loc-periodo');
      else {
        var m = document.getElementById('modal-caixa-loc-periodo');
        if (m) { m.classList.remove('open'); m.style.display = 'none'; }
      }
      procurar();
    });
  }
  function fecharLocPeriodo(ev) {
    try { if (ev) { ev.preventDefault(); ev.stopPropagation(); } } catch (_) {}
    if (typeof closeModal === 'function') closeModal('modal-caixa-loc-periodo');
    var m = document.getElementById('modal-caixa-loc-periodo');
    if (m) {
      m.classList.remove('open', 'is-open');
      m.style.display = 'none';
      m.style.pointerEvents = '';
      try { m.hidden = true; } catch (_) {}
    }
    try { document.body.classList.remove('bp-modal-open'); } catch (_) {}
  }
  var okLoc = document.getElementById('modal-caixa-loc-periodo-ok');
  if (okLoc && !okLoc._bpBound) {
    okLoc._bpBound = true;
    okLoc.type = 'button';
    okLoc.addEventListener('click', fecharLocPeriodo);
  }

  if (go) go.addEventListener('click', procurar);
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') procurar(); });
})();


(function bindCaixaLocPeriodoOk() {
  function fechar(ev) {
    try { if (ev) { ev.preventDefault(); ev.stopPropagation(); } } catch (_) {}
    if (typeof closeModal === 'function') closeModal('modal-caixa-loc-periodo');
    var el = document.getElementById('modal-caixa-loc-periodo');
    if (el) {
      el.classList.remove('open', 'is-open');
      el.style.display = 'none';
      el.style.pointerEvents = '';
      try { el.hidden = true; } catch (_) {}
    }
    try { document.body.classList.remove('bp-modal-open'); } catch (_) {}
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest && ev.target.closest('#modal-caixa-loc-periodo-ok');
    if (!t) return;
    fechar(ev);
  }, true);
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



if (typeof window !== "undefined") {
  window.confirmarFechoCaixa = confirmarFechoCaixa;
}
