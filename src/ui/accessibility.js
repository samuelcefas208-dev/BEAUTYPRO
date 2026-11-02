/* BelezaPro C-1 — UI a11y/nav; carregar APÓS app.bundle.js (CORE já definiu openModal base) */

// ====================================================================
// detalhes-acessibilidade.js — extraído do app.js (Fase C da modularização)
// Conteúdo: Modais de detalhe (faturamento, agendamentos, fecho de caixa), acessibilidade/focus trap, estado offline da IA, navegação por abas
// Linhas originais: 1411-1628
// Carregar depois de core-*.js, db-indexeddb.js, sync-*.js, auth-supabase.js
// ====================================================================

// ====================================================================
// KPIS DETALHE
// ====================================================================
function abrirDetalheFaturamento() {
  const list = document.getElementById('revenue-detail-list');
  const totalSpan = document.getElementById('revenue-detail-total');
  if (!list) {
    if (typeof openModal === 'function') openModal('modal-revenue-detail');
    return;
  }
  if (!state.movimentos || !Array.isArray(state.movimentos)) {
    list.innerHTML = '<div class="empty-state"><p>A carregar...</p></div>';
    if (totalSpan) totalSpan.textContent = '0 Kz';
    if (typeof openModal === 'function') openModal('modal-revenue-detail');
    return;
  }

  /* Mesmo intervalo dos KPIs do Resumo (não fixar só "hoje") */
  var inicio;
  var fim;
  var labelPeriodo = 'Hoje';
  try {
    if (typeof getIntervaloDashAtual === 'function') {
      var iv = getIntervaloDashAtual();
      if (iv && iv.inicio && iv.fim) {
        inicio = iv.inicio;
        fim = iv.fim;
        labelPeriodo = iv.label || labelPeriodo;
      }
    }
  } catch (_) {}
  if (!inicio || !fim) {
    var hojeStr = typeof hoje === 'function' ? hoje() : new Date().toISOString().slice(0, 10);
    inicio = fim = hojeStr;
  }
  if (inicio > fim) { var _swF = inicio; inicio = fim; fim = _swF; }

  var titleEl = document.getElementById('revenue-title');
  if (titleEl) {
    titleEl.textContent = 'Faturamento · ' + labelPeriodo;
  }

  var vendas = state.movimentos.filter(function (m) {
    if (!m || m.tipo !== 'venda' || !m.data) return false;
    if (String(m.status || '').toLowerCase() === 'cancelado') return false;
    return m.data >= inicio && m.data <= fim;
  }).sort(function (a, b) {
    var d = String(b.data || '').localeCompare(String(a.data || ''));
    if (d !== 0) return d;
    return String(b.hora || '').localeCompare(String(a.hora || ''));
  });

  if (vendas.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>Nenhuma venda neste período</p></div>';
    if (totalSpan) totalSpan.textContent = '0 Kz';
  } else {
    list.innerHTML = vendas.map(function (v) {
      var nome = v.cliente || 'Anónimo';
      var av = '<div class="avatar">' + (typeof escHtml === 'function' ? escHtml(String(nome).charAt(0).toUpperCase()) : '?') + '</div>';
      try {
        var cli = (state.clientes || []).find(function (c) {
          return (v.cliente_id && String(c.id) === String(v.cliente_id)) || c.nome === v.cliente;
        });
        var src = null;
        if (cli && window.BPMedia && typeof BPMedia.resolveFotoSrc === 'function') {
          src = BPMedia.resolveFotoSrc(cli);
        } else if (cli && (cli.foto || cli.foto_url)) {
          src = cli.foto || cli.foto_url;
        }
        if (src) {
          var _safe = (typeof bpSafeImgSrc === 'function') ? bpSafeImgSrc(src) : '';
          if (_safe) av = '<div class="avatar bp-avatar-img"><img src="' + _safe + '" alt="" loading="lazy" decoding="async"></div>';
        }
      } catch (_) {}
      var dataLbl = (v.data === fim && inicio === fim)
        ? (v.hora || '')
        : ((v.data || '') + (v.hora ? ' · ' + v.hora : ''));
      var sub = (typeof escHtml === 'function' ? escHtml(v.descricao || '') : (v.descricao || ''));
      if (dataLbl) sub += (sub ? ' · ' : '') + (typeof escHtml === 'function' ? escHtml(String(dataLbl)) : dataLbl);
      var valorStr = typeof fmtKz === 'function' ? fmtKz(v.valor) : (String(v.valor || 0) + ' Kz');
      return (
        '<div class="list-item bp-revenue-row" style="cursor:default;">' + av +
        '<div class="info">' +
        '<div class="title">' + (typeof escHtml === 'function' ? escHtml(nome) : nome) + '</div>' +
        '<div class="sub">' + sub + '</div></div>' +
        '<div class="action bp-revenue-val">' + valorStr + '</div></div>'
      );
    }).join('');
    var total = vendas.reduce(function (s, v) { return s + (Number(v.valor) || 0); }, 0);
    if (totalSpan) totalSpan.textContent = typeof fmtKz === 'function' ? fmtKz(total) : (total + ' Kz');
  }
  if (typeof openModal === 'function') openModal('modal-revenue-detail');
}

let agendaDetailFiltro = 'pendentes';

function abrirDetalheAgendamentos(filtro = 'pendentes') {
  agendaDetailFiltro = filtro;
  const list = document.getElementById('agenda-detail-list');
  const btnPend = document.getElementById('agenda-detail-pendentes');
  const btnReal = document.getElementById('agenda-detail-realizados');
  const totEl = document.getElementById('agenda-detail-totals');
  if (!list) {
    if (typeof openModal === 'function') openModal('modal-agenda-detail');
    return;
  }
  if (!state.agendamentos || !Array.isArray(state.agendamentos)) {
    list.innerHTML = '<div class="empty-state"><p>A carregar...</p></div>';
    if (totEl) totEl.hidden = true;
    if (typeof openModal === 'function') openModal('modal-agenda-detail');
    return;
  }
  const hojeStr = typeof hoje === 'function' ? hoje() : new Date().toISOString().slice(0, 10);
  /* Mesmo intervalo dos KPIs do Resumo */
  var inicio = hojeStr, fim = hojeStr, labelPeriodo = 'Hoje';
  try {
    if (typeof getIntervaloDashAtual === 'function') {
      var iv = getIntervaloDashAtual();
      if (iv && iv.inicio && iv.fim) {
        inicio = iv.inicio;
        fim = iv.fim;
        labelPeriodo = iv.label || labelPeriodo;
      }
    }
  } catch (_) {}
  if (inicio > fim) { var _sw = inicio; inicio = fim; fim = _sw; }
  var titleEl = document.getElementById('agenda-detail-title');
  if (titleEl) titleEl.textContent = 'Agendamentos · ' + labelPeriodo;

  const all = state.agendamentos.slice();
  let filtrados;
  if (filtro === 'pendentes') {
    filtrados = all.filter(function (a) {
      if (!a || !a.data) return false;
      if (a.data < inicio || a.data > fim) return false;
      const st = typeof _statusAg === 'function' ? _statusAg(a) : String(a.status || '');
      return st === 'agendado';
    }).sort(function (a, b) {
      return String(a.data).localeCompare(String(b.data)) || String(a.hora || '').localeCompare(String(b.hora || ''));
    });
  } else {
    filtrados = all.filter(function (a) {
      if (!a || !a.data) return false;
      if (a.data < inicio || a.data > fim) return false;
      const st = typeof _statusAg === 'function' ? _statusAg(a) : String(a.status || '');
      return st === 'realizado';
    }).sort(function (a, b) {
      return String(b.data).localeCompare(String(a.data)) || String(b.hora || '').localeCompare(String(a.hora || ''));
    });
  }
  if (btnPend) btnPend.className = 'btn btn-sm ' + (filtro === 'pendentes' ? 'btn-primary' : 'btn-secondary');
  if (btnReal) btnReal.className = 'btn btn-sm ' + (filtro === 'realizados' ? 'btn-primary' : 'btn-secondary');
  const sum = filtrados.reduce((s, a) => s + (Number(a.preco) || 0), 0);
  if (totEl) {
    totEl.hidden = false;
    totEl.innerHTML = '<span>' + filtrados.length + ' · ' + (filtro === 'pendentes' ? 'pendentes' : 'realizados') +
      '</span><strong>' + (typeof fmtKz === 'function' ? fmtKz(sum) : (sum + ' Kz')) + '</strong>';
  }
  if (filtrados.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>Nenhum agendamento ' + (filtro === 'pendentes' ? 'pendente' : 'realizado') + '</p></div>';
  } else {
    list.innerHTML = filtrados.map(a => {
      const nomeProf = typeof getProfissionalNome === 'function' ? getProfissionalNome(a.profissional_id) : '';
      let av = '<div class="avatar">' + escHtml(String(a.cliente || '?').charAt(0).toUpperCase()) + '</div>';
      try {
        const cli = (state.clientes || []).find(c => String(c.id) === String(a.cliente_id) || c.nome === a.cliente);
        let src = null;
        if (cli && window.BPMedia && BPMedia.resolveFotoSrc) src = BPMedia.resolveFotoSrc(cli);
        else if (cli && (cli.foto || cli.foto_url)) src = cli.foto || cli.foto_url;
        if (src) {
          var _safe = (typeof bpSafeImgSrc === 'function') ? bpSafeImgSrc(src) : '';
          if (_safe) av = '<div class="avatar bp-avatar-img"><img src="' + _safe + '" alt="" loading="lazy"></div>';
        }
      } catch (_) {}
      const dataLbl = (a.data === fim && inicio === fim) ? (a.hora || '') : ((a.data || '') + (a.hora ? ' · ' + a.hora : ''));
      return (
        '<div class="list-item" style="cursor:default;">' + av +
        '<div class="info"><div class="title">' + escHtml(a.servico || '') + '</div>' +
        '<div class="sub">' + escHtml(a.cliente || '') + ' · ' + escHtml(String(dataLbl)) +
        (nomeProf ? ' · ' + escHtml(nomeProf) : '') + '</div></div>' +
        '<div class="action">' + (typeof fmtKz === 'function' ? fmtKz(a.preco) : a.preco) + '</div></div>'
      );
    }).join('');
  }
  if (typeof openModal === 'function') openModal('modal-agenda-detail');
}

function abrirFechoCaixa() {
  if (typeof bpExigirRole === 'function' && !bpExigirRole(['admin'], 'Apenas administradores podem fechar o caixa.')) return;
 const hojeStr = hoje();
 const movs = (state.movimentos && Array.isArray(state.movimentos) ? state.movimentos : []).filter(m => m.data === hojeStr);
 const vendas = movs.filter(m => m.tipo === 'venda');
 const despesas = movs.filter(m => m.tipo === 'despesa');
 const totalVendas = vendas.reduce((s, v) => s + (Number(v.valor) || 0), 0);
 const totalDespesas = despesas.reduce((s, d) => s + (Number(d.valor) || 0), 0);
 const saldoFinal = (Number(state.config.fundo) || 0) + totalVendas - totalDespesas;
 const byPag = {};
 vendas.forEach(v => { const k = v.metodoPagamento || 'Numerário';
  byPag[k] = (byPag[k] || 0) + (Number(v.valor) || 0); });
 const pagHtml = Object.entries(byPag).map(([k, v]) =>
  `<div class="fecho-row"><span class="fr-label">${escHtml(k)}</span><span class="fr-val">${fmtKz(v)}</span></div>`
  ).join('');
 const fechoBox = document.getElementById('fecho-conteudo');
 if (!fechoBox) return;
 fechoBox.innerHTML = `
  <div class="bp-fecho-panel">
    <div class="bp-fecho-date">${new Date().toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
    <div class="bp-fecho-card">
      <div class="fecho-row"><span class="fr-label">Fundo de abertura</span><span class="fr-val">${fmtKz(state.config.fundo)}</span></div>
      <div class="fecho-row"><span class="fr-label">Vendas · ${vendas.length}</span><span class="fr-val fr-val--in">+${fmtKz(totalVendas)}</span></div>
      <div class="fecho-row"><span class="fr-label">Despesas · ${despesas.length}</span><span class="fr-val fr-val--out">−${fmtKz(totalDespesas)}</span></div>
    </div>
    <div class="bp-fecho-section">Métodos de pagamento</div>
    <div class="bp-fecho-card bp-fecho-card--soft">
      ${pagHtml || '<div class="fecho-row"><span class="fr-label">Sem vendas hoje</span><span class="fr-val">0 Kz</span></div>'}
    </div>
    <div class="bp-fecho-total">
      <span class="bp-fecho-total-label">Saldo final em caixa</span>
      <span class="bp-fecho-total-val">${fmtKz(saldoFinal)}</span>
    </div>
  </div>`;
 openModal('modal-fecho');
}

// ====================================================================
// ACESSIBILIDADE E FOCUS TRAPPING
// ====================================================================
function aplicarAcessibilidade() {
 document.querySelectorAll('.ci-del').forEach(el => { if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', 'Remover item'); });
 document.querySelectorAll('.nav-item').forEach((el, index) => {
  if (!el.hasAttribute('role')) el.setAttribute('role', 'tab');
  if (!el.hasAttribute('aria-selected')) el.setAttribute('aria-selected', el.classList.contains('active') ? 'true' : 'false');
  const tabId = el.dataset.tab;
  if (tabId) el.setAttribute('aria-controls', 'tab-' + tabId);
 });
 const nav = document.querySelector('.bottom-nav');
 if (nav && !nav.hasAttribute('role')) nav.setAttribute('role', 'tablist');
 document.querySelectorAll('.modal-overlay').forEach(modal => {
  if (!modal.hasAttribute('role')) modal.setAttribute('role', 'dialog');
  if (!modal.hasAttribute('aria-modal')) modal.setAttribute('aria-modal', 'true');
  const title = modal.querySelector('.modal-title');
  if (title && title.id) modal.setAttribute('aria-labelledby', title.id);
 });
 const liveAreas = ['agenda-full-list', 'clientes-list', 'movimentos-list', 'agenda-today-list'];
 liveAreas.forEach(id => {
  const el = document.getElementById(id);
  if (el && !el.hasAttribute('aria-live')) { el.setAttribute('aria-live', 'polite');
   el.setAttribute('aria-atomic', 'true'); }
 });
}

let previousFocusedElement = null;

function trapFocus(modal) {
 if (!modal || modal.dataset.bpTrapBound === '1') return;
 modal.dataset.bpTrapBound = '1';
 modal.addEventListener('keydown', function(e) {
  if (e.key !== 'Tab') return;
  const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusableElements.length) return;
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  if (e.shiftKey) {
   if (document.activeElement === firstElement) {
    e.preventDefault();
    try { lastElement.focus({ preventScroll: true }); } catch (_) { try { lastElement.focus(); } catch (__) {} }
   }
  } else if (document.activeElement === lastElement) {
   e.preventDefault();
   try { firstElement.focus({ preventScroll: true }); } catch (_) { try { firstElement.focus(); } catch (__) {} }
  }
 });
}
function bpFocusNoScroll(el) {
 if (!el || typeof el.focus !== 'function') return;
 try { el.focus({ preventScroll: true }); } catch (_) {
  try { el.focus(); } catch (__) {}
 }
}
const originalOpenModal = window.openModal;
if (originalOpenModal) {
 window.openModal = function(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  var wasOpen = modal.classList.contains('open');
  previousFocusedElement = document.activeElement;
  originalOpenModal(id);
  trapFocus(modal);
  // Só autofocus na 1.ª abertura; preventScroll evita salto do main-content no Android
  if (!wasOpen && !modal.dataset.bpSkipAutofocus) {
   const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
   if (firstFocusable) setTimeout(function () { bpFocusNoScroll(firstFocusable); }, 100);
  }
 };
}
const originalCloseModal = window.closeModal;
if (originalCloseModal) {
 window.closeModal = function(id) {
  originalCloseModal(id);
  if (previousFocusedElement && previousFocusedElement.focus) {
   setTimeout(function () {
    try { previousFocusedElement.focus({ preventScroll: true }); } catch (_) {
     try { previousFocusedElement.focus(); } catch (__) {}
    }
    previousFocusedElement = null;
   }, 200);
  }
 };
}

// ====================================================================
// IA OFFLINE E SVGs
// ====================================================================
function atualizarIAOffline() {
  var overlay = document.getElementById('ia-offline-overlay');
  if (overlay) {
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
    try { overlay.remove(); } catch (_) {}
  }
}

const svgCalendario = `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" stroke="var(--neutral-300)" stroke-width="1.5"><rect x="16" y="20" width="48" height="48" rx="4"/><line x1="16" y1="32" x2="64" y2="32"/><line x1="28" y1="16" x2="28" y2="24"/><line x1="52" y1="16" x2="52" y2="24"/><circle cx="40" cy="44" r="6"/></svg>`;
const svgCarteira = `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" stroke="var(--neutral-300)" stroke-width="1.5"><rect x="12" y="28" width="56" height="36" rx="4"/><path d="M12 36h8a8 8 0 0 1 0 16h-8"/><circle cx="48" cy="46" r="4"/></svg>`;
const svgPessoas = `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" stroke="var(--neutral-300)" stroke-width="1.5"><circle cx="30" cy="24" r="12"/><circle cx="50" cy="24" r="10"/><path d="M10 64c0-12 6-20 20-20s20 8 20 20"/><path d="M56 64c0-8 4-14 14-14s14 6 14 14"/></svg>`;
const svgTesoura = `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" stroke="var(--neutral-300)" stroke-width="1.5"><circle cx="28" cy="36" r="8"/><circle cx="52" cy="36" r="8"/><path d="M20 44 L60 24 M20 24 L60 44"/></svg>`;
const svgPessoa = `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" stroke="var(--neutral-300)" stroke-width="1.5"><circle cx="40" cy="30" r="16"/><path d="M12 68c0-12 8-20 28-20s28 8 28 20"/></svg>`;

// ====================================================================
// NAVEGAÇÃO ENTRE ABAS
// ====================================================================
var BP_TAB_ORDER = ['dashboard', 'agenda', 'clientes', 'caixa', 'equipa', 'ia'];
function bpTabIndex(id) {
  var i = BP_TAB_ORDER.indexOf(id);
  return i < 0 ? 0 : i;
}
/** Slide foto-a-foto ~160ms: páginas adjacentes, stacking absoluto, sem faísca. */
function bpSwitchTabPane(fromId, toId) {
  var from = fromId ? document.getElementById('tab-' + fromId) : null;
  var to = document.getElementById('tab-' + toId);
  if (!to) return;

  var reduce = false;
  try {
    reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_) {}

  var ALL_ANIM = [
    'bp-tab-slide-from', 'bp-tab-slide-to',
    'bp-tab-from-left', 'bp-tab-from-right',
    'bp-tab-to-from-right', 'bp-tab-to-from-left',
    'bp-tab-fade-in', 'bp-tab-fade-out',
    'bp-tab-in-right', 'bp-tab-in-left', 'bp-tab-out-left', 'bp-tab-out-right'
  ];

  function clearAnim(p) {
    if (!p) return;
    ALL_ANIM.forEach(function (c) { p.classList.remove(c); });
  }

  document.querySelectorAll('.tab-pane').forEach(function (p) {
    clearAnim(p);
    if (p !== to && p !== from) p.classList.remove('active');
  });

  if (reduce || !from || from === to) {
    if (from && from !== to) from.classList.remove('active');
    clearAnim(to);
    to.classList.add('active');
    return;
  }

  // Evitar estados a meio de animação anterior
  clearAnim(from);
  clearAnim(to);

  var forward = bpTabIndex(toId) >= bpTabIndex(fromId);
  var main = document.querySelector('.main-content');
  if (main) main.classList.add('bp-tab-animating');

  // Medir altura com a aba actual (visível); evita minHeight 0 e colapso
  var h = 0;
  try {
    h = Math.max(
      (from && from.offsetHeight) || 0,
      (main && main.clientHeight) || 0,
      240
    );
    if (main) main.style.minHeight = h + 'px';
  } catch (_) {}

  var cleaned = false;
  var clean = function () {
    if (cleaned) return;
    cleaned = true;
    clearAnim(from);
    clearAnim(to);
    from.classList.remove('active');
    to.classList.add('active');
    if (main) {
      main.classList.remove('bp-tab-animating');
      try { main.style.minHeight = ''; } catch (_) {}
    }
    try { to.removeEventListener('animationend', onEnd); } catch (_) {}
  };
  var onEnd = function (e) {
    if (e && e.target !== to) return;
    clean();
  };

  // Preparar estados iniciais ANTES do paint da animação (evita faísca no 1.º frame)
  from.classList.add('bp-tab-slide-from');
  from.classList.remove('active');
  to.classList.add('active', 'bp-tab-slide-to');
  // Posição inicial sem animação
  to.style.transform = forward ? 'translate3d(100%,0,0)' : 'translate3d(-100%,0,0)';
  from.style.transform = 'translate3d(0,0,0)';

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      to.style.transform = '';
      from.style.transform = '';
      from.classList.add(forward ? 'bp-tab-from-left' : 'bp-tab-from-right');
      to.classList.add(forward ? 'bp-tab-to-from-right' : 'bp-tab-to-from-left');
      to.addEventListener('animationend', onEnd);
      setTimeout(clean, 220);
    });
  });
}

document.querySelectorAll('.nav-item').forEach(btn => {
 btn.addEventListener('click', function(ev) {
  // ET4.7: ao mudar de aba, matar tooltip do gráfico (não rouba toques)
  try {
    if (typeof bpHideChartTooltip === 'function') bpHideChartTooltip();
  } catch (_) {}
  const tab = this.dataset.tab;
  if (this.dataset.role) {
   const permitido = this.dataset.role.split(',').map(r => r.trim()).includes(normalizarRole(state.config.userRole));
   if (!permitido) {
    toast('Não tens acesso a esta área.', 'warning');
    return;
   }
  }
  var prevTab = (typeof activeTab !== 'undefined') ? activeTab : null;
  if (prevTab === tab) return;
  activeTab = tab;
  localStorage.setItem('bp_active_tab', tab);
  bpSwitchTabPane(prevTab, tab);
  if (tab !== 'dashboard') {
    try { if (typeof bpHideChartTooltip === 'function') bpHideChartTooltip(); } catch (_) {}
    try { if (typeof fecharChartDrill === 'function') fecharChartDrill(); } catch (_) {}
  }
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  this.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.setAttribute('aria-selected', 'false'));
  this.setAttribute('aria-selected', 'true');
  if (tab === 'agenda') renderAgendaFull();
  if (tab === 'clientes') renderClientes();
  if (tab === 'caixa') renderCaixa();
  if (tab === 'dashboard') {
    renderDashboard();
    if (typeof renderizarGrafico === 'function') {
      setTimeout(function () { renderizarGrafico(); }, 40);
      setTimeout(function () { renderizarGrafico(); }, 200);
    }
  }
  if (tab === 'equipa') { renderProfissionais(); renderServicos(); }
  if (tab === 'ia') {
   if (typeof actualizarContadorIA === 'function') actualizarContadorIA();
   if (typeof renderPlanoInfo === 'function') renderPlanoInfo();
   if (typeof atualizarIAOffline === 'function') atualizarIAOffline();
   if (typeof renderIAResumo === 'function') renderIAResumo();
   if (typeof carregarHistoricoIA === 'function') carregarHistoricoIA();
  }
  if (typeof aplicarAcessibilidade === 'function') aplicarAcessibilidade();
  if (typeof aplicarPermissoes === 'function') aplicarPermissoes();
  atualizarVisibilidadeAtalhos();
 });
});

