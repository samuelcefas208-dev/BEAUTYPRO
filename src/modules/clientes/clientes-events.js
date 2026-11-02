/* BelezaPro — modules/clientes/clientes-events.js
 * Etapa 3: events de clientes extraídos de src/app/form-events.js
 * Ownership: cliente rápido, CRUD modal cliente, detalhe view, validadores telefone/BI.
 * Carregar após clientes-render + utils (openModal, toast, addCliente, state).
 */
// Cliente rápido
var _agendaAddCliRapido = document.getElementById('agenda-add-cliente-rapido');
if (_agendaAddCliRapido) _agendaAddCliRapido.addEventListener('click', () => {
  window.__bpClienteRapidoReturn = 'agenda';
  closeModal('modal-agenda');
  document.getElementById('cliente-rapido-nome').value = '';
  document.getElementById('cliente-rapido-telefone').value = '';
  openModal('modal-cliente-rapido');
});

document.getElementById('modal-cliente-rapido-save').addEventListener('click', async () => {
  const nome = document.getElementById('cliente-rapido-nome').value.trim();
  const telefone = document.getElementById('cliente-rapido-telefone').value.trim();
  if (!nome) {
    if (typeof bpNotifyFormError === 'function') bpNotifyFormError('Introduza o nome do cliente para continuar.', 'cliente-rapido-nome');
    else toast('Introduza o nome do cliente para continuar.', 'warning');
    return;
  }
  var telR = typeof bpValidarTelefoneCliente === 'function'
    ? bpValidarTelefoneCliente(telefone)
    : { ok: false, message: 'Informe um número de telefone válido com 9 dígitos e iniciado por 9.' };
  if (!telR.ok) {
    if (typeof bpNotifyFormError === 'function') bpNotifyFormError(telR.message, 'cliente-rapido-telefone');
    else toast(telR.message, 'warning');
    return;
  }
  const result = await addCliente({ nome, telefone: telR.telefone, notas: '' });
  if (result) {
    try {
      if (window.BPMedia && BPMedia.takePendingClienteFoto) {
        var fQ = BPMedia.takePendingClienteFoto();
        if (fQ && BPMedia.setClienteFoto) await BPMedia.setClienteFoto(result.id, fQ);
      }
    } catch (_) {}
    closeModal('modal-cliente-rapido');
    var ret = window.__bpClienteRapidoReturn || 'agenda';
    window.__bpClienteRapidoReturn = null;
    if (ret === 'venda') {
      if (typeof openVendaModal === 'function') openVendaModal();
      else openModal('modal-venda');
      setTimeout(function () {
        try {
          var vSel = document.getElementById('venda-cliente');
          if (vSel) {
            /* repopula e selecciona o nome (openVendaModal já reconstrói options) */
            if (typeof openVendaModal === 'function') { /* options já feitas */ }
            vSel.value = nome;
            if (!vSel.value) {
              /* fallback: garantir option */
              var opt = document.createElement('option');
              opt.value = nome;
              opt.textContent = nome;
              vSel.appendChild(opt);
              vSel.value = nome;
            }
          }
          if (typeof bpVendaAdvanceAfterCliente === 'function') bpVendaAdvanceAfterCliente();
          else if (typeof bpVendaSyncFlowUi === 'function') bpVendaSyncFlowUi();
        } catch (_) {}
      }, 150);
    } else {
      openModal('modal-agenda');
      const sel = document.getElementById('agenda-cliente');
      if (sel) {
        sel.innerHTML = '<option value="">Selecionar cliente</option>' + state.clientes.map(c =>
          `<option value="${escHtml(c.nome)}">${escHtml(c.nome)}</option>`).join('');
        sel.value = nome;
      }
    }
  }
});

document.getElementById('modal-cliente-rapido-cancel').addEventListener('click', () => {
  closeModal('modal-cliente-rapido');
  var ret = window.__bpClienteRapidoReturn || 'agenda';
  window.__bpClienteRapidoReturn = null;
  if (ret === 'venda') {
    if (typeof openVendaModal === 'function') openVendaModal();
    else openModal('modal-venda');
  } else {
    openModal('modal-agenda');
  }
});

// CRUD Cliente
let editClienteId = null;


function setClienteModalMode(mode) {
  // mode: 'view' | 'edit'
  const modal = document.getElementById('modal-cliente');
  const sheet = document.getElementById('modal-cliente-sheet');
  const view = document.getElementById('cliente-view-panel');
  const form = document.getElementById('cliente-form-panel');
  if (modal) modal.setAttribute('data-mode', mode);
  if (sheet) {
    sheet.classList.toggle('modal-sheet--view', mode === 'view');
  }
  if (view) {
    view.hidden = mode !== 'view';
    try { view.style.display = mode === 'view' ? '' : 'none'; } catch (_) {}
  }
  if (form) {
    form.hidden = mode !== 'edit';
    try { form.style.display = mode === 'edit' ? '' : 'none'; } catch (_) {}
  }
  ['cliente-nome', 'cliente-telefone', 'cliente-notas'].forEach(function (fid) {
    const el = document.getElementById(fid);
    if (el) {
      el.readOnly = false;
      el.disabled = false;
      el.style.opacity = '';
    }
  });
}

function openEditCliente(id) {
  const c = state.clientes.find(c => c.id === id);
  if (!c) return;
  editClienteId = id;
  setClienteModalMode('edit');
  document.getElementById('cliente-modal-title').textContent = 'Editar cliente';
  document.getElementById('cliente-nome').value = c.nome || '';
  document.getElementById('cliente-telefone').value = c.telefone || '';
  document.getElementById('cliente-notas').value = c.notas || '';
  document.getElementById('cliente-id').value = id;
  openModal('modal-cliente');
}

document.getElementById('add-cliente-btn').addEventListener('click', () => {
  editClienteId = null;
  setClienteModalMode('edit');
  document.getElementById('cliente-modal-title').textContent = 'Novo cliente';
  ['cliente-nome', 'cliente-telefone', 'cliente-notas', 'cliente-id'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  try {
    if (window.BPMedia && typeof BPMedia.clearPendingClienteFoto === 'function') BPMedia.clearPendingClienteFoto();
  } catch (_) {}
  openModal('modal-cliente');
});

document.getElementById('modal-cliente-save').addEventListener('click', async () => {
  const nome = document.getElementById('cliente-nome').value.trim();
  let telefone = document.getElementById('cliente-telefone').value.trim();
  const notas = document.getElementById('cliente-notas').value.trim();
  const id = document.getElementById('cliente-id').value;
  if (!nome) {
    if (typeof bpNotifyFormError === 'function') bpNotifyFormError('Introduza o nome do cliente para continuar.', 'cliente-nome');
    else toast('Introduza o nome do cliente para continuar.', 'warning');
    return;
  }
  var telChk = typeof bpValidarTelefoneCliente === 'function'
    ? bpValidarTelefoneCliente(telefone)
    : { ok: false, message: 'Informe um número de telefone válido com 9 dígitos e iniciado por 9.' };
  if (!telChk.ok) {
    if (typeof bpNotifyFormError === 'function') bpNotifyFormError(telChk.message, 'cliente-telefone');
    else toast(telChk.message, 'warning');
    return;
  }
  telefone = telChk.telefone;
  if (id) {
    // ET4.3: só toast/fecha se a actualização efectivamente ocorreu
    const upd = await updateCliente(id, { nome, telefone, notas });
    if (upd) {
      toast('Cliente actualizado.', 'success');
      closeModal('modal-cliente');
    }
  } else { 
    const result = await addCliente({ nome, telefone, notas });
    if (result) {
      try {
        var fotoC = null;
        if (window.BPMedia && typeof BPMedia.takePendingClienteFoto === 'function') {
          fotoC = BPMedia.takePendingClienteFoto();
        }
        if (fotoC && typeof BPMedia.setClienteFoto === 'function') {
          await BPMedia.setClienteFoto(result.id, fotoC);
          if (typeof BPMedia.patchRowAvatar === 'function') BPMedia.patchRowAvatar('clientes', result.id);
          if (typeof BPMedia.enhanceListAvatars === 'function') BPMedia.enhanceListAvatars();
          if (typeof renderClientes === 'function') renderClientes();
        }
      } catch (eFoto) { console.warn('[cli foto save]', eFoto); }
      closeModal('modal-cliente');
    }
  }
});

document.getElementById('modal-cliente-cancel').addEventListener('click', () => closeModal('modal-cliente'));

// ====================================================================
//  FASE E — Ver detalhe do cliente (só visualização ao clicar na linha)
// ====================================================================
function abrirDetalheClienteView(id) {
  const c = state.clientes.find(x => x.id === id);
  if (!c) return;
  editClienteId = id;

  setClienteModalMode('view');
  document.getElementById('cliente-modal-title').textContent = 'Ficha do cliente';
  document.getElementById('cliente-id').value = id;

  const body = document.getElementById('cliente-view-body');
  if (body) {
    const digits = String(c.telefone || '').replace(/\D/g, '');
    const tel = digits || '—';
    const notas = c.notas ? escHtml(c.notas) : '<span class="bp-view-value--muted">Sem preferências</span>';
    let contactActions = '';
    if (digits.length === 9) {
      const wa = '244' + digits;
      const msg = encodeURIComponent('Olá ' + (c.nome || '') + ',');
      contactActions =
        '<div class="bp-view-contact-actions">' +
        bpBtnWhatsAppHtml('https://wa.me/' + wa + '?text=' + msg) +
        bpBtnLigarHtml('tel:+244' + digits) +
        '</div>';
    }
    var pts = Number(c.pontos) || 0;
    var tier = typeof getClienteTier === 'function' ? getClienteTier(pts) : { id: 'bronze', label: 'Bronze' };
    body.innerHTML =
      '<div class="bp-view-hero">' +
      bpViewHeroAvatarHtml(c, (c.nome || '?').charAt(0).toUpperCase()) +
      '<div><div class="bp-view-hero-name">' + escHtml(c.nome || 'Cliente') + '</div>' +
      '<div class="bp-view-hero-meta">' + (digits ? ('+244 ' + escHtml(digits)) : 'Sem contacto') +
      ' · <span class="bp-tier bp-tier--' + tier.id + '">' + escHtml(tier.label) + '</span></div></div></div>' +
      contactActions +
      '<div class="bp-view-dl">' +
      '<div class="bp-view-row"><span class="bp-view-label">Nome</span><span class="bp-view-value">' + escHtml(c.nome || '—') + '</span></div>' +
      '<div class="bp-view-row"><span class="bp-view-label">Celular</span><span class="bp-view-value">' + escHtml(tel) + '</span></div>' +
      '<div class="bp-view-row"><span class="bp-view-label">Fidelidade</span><span class="bp-view-value">' + pts + ' pts · ' + escHtml(tier.label) + '</span></div>' +
      '<div class="bp-view-row"><span class="bp-view-label">Preferências</span><span class="bp-view-value">' + notas + '</span></div>' +
      '</div>' +
      '<p class="venda-modal-sub" style="margin-top:10px;">1 ponto por cada 1.000 Kz em vendas registadas na ficha.</p>';
  }
  // Stats com objecto (id + nome)
  const stats = typeof getEstatisticasCliente === 'function'
    ? getEstatisticasCliente(c)
    : { visitas: 0, totalGasto: 0, ultimaVisita: null };
  const statsEl = document.getElementById('cliente-perfil-stats');
  if (statsEl) {
    statsEl.hidden = false;
    statsEl.removeAttribute('hidden');
    statsEl.style.display = 'grid';
    statsEl.classList.add('bp-cli-stats');
    var visitas = Number(stats.visitas) || 0;
    var gasto = Number(stats.totalGasto) || 0;
    var ult = stats.ultimaVisita;
    var visitasVal = visitas > 0 ? String(visitas) : '—';
    var visitasSub = visitas > 0
      ? (visitas === 1 ? 'Visita' : 'Visitas')
      : 'Ainda sem visitas';
    var gastoVal = gasto > 0 ? fmtKz(gasto) : '—';
    var gastoSub = gasto > 0 ? 'Total gasto' : 'Sem gastos registados';
    var ultVal = ult
      ? (typeof formatarUltimaVisita === 'function' ? formatarUltimaVisita(ult) : '—')
      : '—';
    var ultSub = ult ? 'Última visita' : 'Sem histórico ainda';
    statsEl.innerHTML =
      '<div class="bp-cli-stat' + (visitas ? '' : ' is-empty') + '">' +
        '<div class="stat-valor">' + visitasVal + '</div>' +
        '<div class="stat-legenda">' + visitasSub + '</div></div>' +
      '<div class="bp-cli-stat' + (gasto ? '' : ' is-empty') + '">' +
        '<div class="stat-valor">' + gastoVal + '</div>' +
        '<div class="stat-legenda">' + gastoSub + '</div></div>' +
      '<div class="bp-cli-stat' + (ult ? '' : ' is-empty') + '">' +
        '<div class="stat-valor">' + ultVal + '</div>' +
        '<div class="stat-legenda">' + ultSub + '</div></div>';
  }
  openModal('modal-cliente');
}

document.getElementById('cliente-view-fechar')?.addEventListener('click', function () {
  setClienteModalMode('edit');
  closeModal('modal-cliente');
});
document.getElementById('cliente-view-editar')?.addEventListener('click', function () {
  const id = document.getElementById('cliente-id')?.value || editClienteId;
  if (id) openEditCliente(id);
});
document.getElementById('modal-cliente-cancel')?.addEventListener('click', function () {
  setClienteModalMode('edit');
  closeModal('modal-cliente');
});

// Clique na linha do cliente (não no menu)
document.addEventListener('click', function(e) {
  const row = e.target.closest('.cliente-item[data-cliente-id]');
  if (!row) return;
  if (e.target.closest('.row-menu-btn') || e.target.closest('.row-menu')) return;
  const id = row.dataset.clienteId;
  if (id) abrirDetalheClienteView(id);
});

// Validação telefone 9 dígitos (Angola)
function validarTelefoneAO(tel) {
  const digits = String(tel || '').replace(/\D/g, '');
  return digits.length === 0 || digits.length === 9;
}

function validarBI(bi) {
  const v = String(bi || '').trim().toUpperCase();
  if (!v) return true; // opcional
  // Formato angolano simplificado: 9 dígitos + 2 letras + 3 dígitos (ex: 001234567LA048)
  // Aceita também sequências alfanuméricas completas >= 10 chars
  return /^[0-9]{9}[A-Z]{2}[0-9]{3}$/.test(v) || /^[0-9A-Z]{10,20}$/.test(v);
}


/* Etapa 3 — API global para app-events / renders */
if (typeof window !== "undefined") {
  window.openEditCliente = openEditCliente;
  window.abrirDetalheClienteView = abrirDetalheClienteView;
  window.setClienteModalMode = setClienteModalMode;
}

/* Etapa 4 — filtro frequência clientes movido de caixa-vendas-events */
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


