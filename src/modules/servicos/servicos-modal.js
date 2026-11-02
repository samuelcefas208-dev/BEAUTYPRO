/* BelezaPro — modules/servicos/servicos-modal.js
 * Etapa 8 / Fase 1 (3 fases): UI do modal de serviço.
 * Extraído de vendas-modais.js — ownership do domínio serviços.
 * Carregar ANTES de servicos-events.js.
 */

// ====================================================================
//  SERVIÇO MODAL
// ====================================================================
function _servicoProfSelected(selected, p) {
  const arr = selected || [];
  return arr.some(function (x) {
    return x === p.id || x === p.nome || String(x) === String(p.id);
  });
}

function renderServicoProfissionais(selected = []) {
  const container = document.getElementById('servico-profissionais-container');
  if (!container) return;
  const activos = (state.profissionais || []).filter(function (p) {
    return typeof isProfissionalAtivo === 'function' ? isProfissionalAtivo(p) : (p.ativo !== false);
  });
  if (!activos.length) {
    container.innerHTML = '<span style="color:var(--text-muted);font-size:.75rem;">Nenhum profissional activo</span>';
    return;
  }
  container.innerHTML = activos.map(p => {
    const checked = _servicoProfSelected(selected, p) ? ' checked' : '';
    return (
      '<label class="bp-chip-check">' +
      '<input type="checkbox" value="' + escHtml(p.id) + '" data-nome="' + escHtml(p.nome) + '"' + checked + '>' +
      escHtml(p.nome) +
      '</label>'
    );
  }).join('');
}

/** Preferência: guarda nomes legíveis + ids resolvíveis no futuro via data-nome */
function getSelectedProfissionais() {
  const container = document.getElementById('servico-profissionais-container');
  if (!container) return [];
  const checks = container.querySelectorAll('input[type="checkbox"]:checked');
  return Array.from(checks).map(function (cb) {
    // Guardar nome para compatibilidade com dados legados e seed
    return cb.getAttribute('data-nome') || cb.value;
  }).filter(Boolean);
}

function setServicoModalMode(mode) {
  const modal = document.getElementById('modal-servico');
  const sheet = document.getElementById('modal-servico-sheet');
  const view = document.getElementById('servico-view-panel');
  const form = document.getElementById('servico-form-panel');
  if (modal) modal.setAttribute('data-mode', mode);
  if (sheet) sheet.classList.toggle('modal-sheet--view', mode === 'view');
  if (view) {
    view.hidden = mode !== 'view';
    try { view.style.display = mode === 'view' ? '' : 'none'; } catch (_) {}
  }
  if (form) {
    form.hidden = mode !== 'edit';
    try { form.style.display = mode === 'edit' ? '' : 'none'; } catch (_) {}
  }
}

function _labelProfsServico(arr) {
  const list = arr || [];
  if (!list.length) return 'Sem profissionais associados';
  return list.map(function (x) {
    const byId = (state.profissionais || []).find(function (p) { return p.id === x; });
    return byId ? byId.nome : x;
  }).join(', ');
}

function abrirDetalheServicoView(id) {
  const s = (state.servicos || []).find(function (x) { return x.id === id; });
  if (!s) return;
  setServicoModalMode('view');
  const title = document.getElementById('servico-modal-title');
  if (title) title.textContent = 'Ficha do serviço';
  const idInput = document.getElementById('servico-id');
  if (idInput) idInput.value = id;
  const dur = Number(s.duracao || s.duracaoMin || s.minutos || 60) || 60;
  const body = document.getElementById('servico-view-body');
  if (body) {
    body.innerHTML =
      '<div class="bp-view-hero">' +
      '<div class="bp-view-hero-av bp-servico-avatar">SRV</div>' +
      '<div><div class="bp-view-hero-name">' + escHtml(s.nome || 'Serviço') + '</div>' +
      '<div class="bp-view-hero-meta">' + fmtKz(Number(s.precoBase) || 0) + ' · ' + dur + ' min</div></div></div>' +
      '<div class="bp-view-dl">' +
      '<div class="bp-view-row"><span class="bp-view-label">Nome</span><span class="bp-view-value">' + escHtml(s.nome || '—') + '</span></div>' +
      '<div class="bp-view-row"><span class="bp-view-label">Preço</span><span class="bp-view-value">' + fmtKz(Number(s.precoBase) || 0) + '</span></div>' +
      '<div class="bp-view-row"><span class="bp-view-label">Duração</span><span class="bp-view-value">' + dur + ' min</span></div>' +
      '<div class="bp-view-row"><span class="bp-view-label">Profissionais</span><span class="bp-view-value">' + escHtml(_labelProfsServico(s.profissionais)) + '</span></div>' +
      '</div>';
  }
  openModal('modal-servico');
}

function openServicoModal(id = null) {
  setServicoModalMode('edit');
  const title = document.getElementById('servico-modal-title');
  const nomeInput = document.getElementById('servico-nome');
  const precoInput = document.getElementById('servico-preco');
  const durInput = document.getElementById('servico-duracao');
  const idInput = document.getElementById('servico-id');
  if (id) {
    const serv = state.servicos.find(s => s.id === id);
    if (!serv) return;
    if (title) title.textContent = 'Editar serviço';
    if (nomeInput) nomeInput.value = serv.nome || '';
    if (precoInput) precoInput.value = serv.precoBase != null ? serv.precoBase : '';
    if (durInput) durInput.value = Number(serv.duracao || serv.duracaoMin || serv.minutos || 60) || 60;
    if (idInput) idInput.value = id;
    renderServicoProfissionais(serv.profissionais || []);
  } else {
    if (title) title.textContent = 'Novo serviço';
    if (nomeInput) nomeInput.value = '';
    if (precoInput) precoInput.value = '';
    if (durInput) durInput.value = '60';
    if (idInput) idInput.value = '';
    renderServicoProfissionais([]);
  }
  openModal('modal-servico');
}

window.abrirDetalheServicoView = abrirDetalheServicoView;
window.openServicoModal = openServicoModal;
window.setServicoModalMode = setServicoModalMode;
