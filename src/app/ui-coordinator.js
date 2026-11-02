/* BelezaPro — src/app/ui-coordinator.js
 * Etapa 5: coordenação de paint apenas (updateUI por aba activa).
 * Chama render* dos modules; NÃO implementa regras de negócio.
 */
/* BelezaPro — coordenação de paint (updateUI) */
let _updateUITimer = null;
let _storeSubscribed = false;

function updateUI() {
  // Debounce: várias mutações no mesmo tick → um único paint
  if (_updateUITimer) clearTimeout(_updateUITimer);
  _updateUITimer = setTimeout(_updateUINow, 16);
}

function _updateUINow() {
  _updateUITimer = null;
  // ETAPA 2 — só trabalho pesado da aba activa (tab switch já re-renderiza ao mudar).
  var tab = (typeof activeTab !== 'undefined' && activeTab) ? activeTab : 'dashboard';

  renderBadges();
  renderPlanoInfo();
  atualizarVisibilidadeAtalhos();

  if (tab === 'dashboard') {
    renderDashboard();
    if (typeof renderizarGrafico === 'function') renderizarGrafico();
    if (typeof initChartControls === 'function') initChartControls();
  } else if (tab === 'agenda') {
    renderAgendaFull();
  } else if (tab === 'clientes') {
    renderClientes();
  } else if (tab === 'caixa') {
    renderCaixa();
  } else if (tab === 'equipa') {
    renderProfissionais();
    renderServicos();
  }

  // Selects de venda/agenda: só onde os formulários existem na UI activa
  if (tab === 'dashboard' || tab === 'caixa' || tab === 'agenda') {
    if (typeof populateVendaSelects === 'function') populateVendaSelects();
    if (typeof populateAgendaSelects === 'function') populateAgendaSelects();
    if (typeof setupPrecoAutomatico === 'function') {
      setupPrecoAutomatico('agenda-servico', 'agenda-preco');
      setupPrecoAutomatico('ci-servico-sel', 'ci-valor');
    }
  }

  // a11y: uma vez por sessão (DOM estável de roles/aria)
  if (!window.__bpA11yPainted && typeof aplicarAcessibilidade === 'function') {
    try { aplicarAcessibilidade(); window.__bpA11yPainted = true; } catch (_) {}
  }

  const storeDisplay = document.getElementById('store-name-display');
  if (storeDisplay && state.config.storeName) {
    storeDisplay.textContent = state.config.storeName;
    storeDisplay.title = 'Duplo clique para gerir profissionais';
  }
}

/** Liga o Store aos renders — mutações via BeautyStore disparam UI automaticamente */
function initStoreBindings() {
  if (_storeSubscribed) return;
  if (!window.BeautyStore || typeof window.BeautyStore.subscribe !== 'function') return;
  window.BeautyStore.subscribe(function onStoreChange() {
    updateUI();
  });
  _storeSubscribed = true;
}

if (typeof window !== 'undefined') {
  window.updateUI = updateUI;
  window.initStoreBindings = initStoreBindings;
}
