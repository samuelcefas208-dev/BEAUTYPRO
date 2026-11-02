/* BelezaPro C-2 — app-events fora do monólito
 * Carregar APÓS app.bundle.js (precisa de window.mudarAgenda base do render).
 */

// ====================================================================
//  app-events.js — extraído do app.js (Fase C da modularização)
//  Conteúdo: Eventos: navegação da agenda, menu de linha, online/offline, overlays de modal
//  Linhas originais: 2110-2317
//  Carregar depois de core-*.js, db-indexeddb.js, sync-*.js, auth-supabase.js
// ====================================================================
const originalMudarAgenda = window.mudarAgenda;
if (originalMudarAgenda) {
  window.mudarAgenda = function(delta) {
    const container = document.getElementById('agenda-full-list');
    if (!container) { originalMudarAgenda(delta); return; }
    container.classList.add('agenda-slide-out');
    setTimeout(() => {
      originalMudarAgenda(delta);
      container.classList.remove('agenda-slide-out');
      container.classList.add('agenda-slide-in');
      setTimeout(() => container.classList.remove('agenda-slide-in'), 300);
    }, 150);
  };
}

document.getElementById('agenda-prev')?.addEventListener('click', () => { if (typeof mudarAgenda === 'function') mudarAgenda(-1); });
document.getElementById('agenda-next')?.addEventListener('click', () => { if (typeof mudarAgenda === 'function') mudarAgenda(1); });

// Duplo clique no nome do salão
document.getElementById('store-name-display')?.addEventListener('dblclick', () => {
  const equipaNav = document.querySelector('.nav-item[data-tab="equipa"]');
  if (equipaNav && equipaNav.style.display !== 'none') equipaNav.click();
});

// Ripple global removido (listener vazio gerava ruído na cadeia de cliques).

// ====================================================================
//  MENU DE ACÇÕES DA LINHA (⋮)
// ====================================================================
function abrirMenuLinha(anchorEl, tipo, id) {
  const menu = document.getElementById('row-menu');
  const editLabel = document.getElementById('row-menu-edit-label');
  const delBtn = document.getElementById('row-menu-delete');
  const papel = normalizarRole(state.config.userRole);

  const config = {
    cliente:      { editLabel: 'Ajustar perfil', delAction: 'del-cliente', delLabel: 'Excluir',   podeEliminar: papel === 'admin' || papel === 'gerente' },
    profissional: { editLabel: 'Ajustar',         delAction: 'del-p',       delLabel: 'Destituir', podeEliminar: papel === 'admin' },
    servico:      { editLabel: 'Ajustar',         delAction: 'del-servico', delLabel: 'Excluir',   podeEliminar: papel === 'admin' },
  }[tipo];
  if (!config) return;

  if (menu.classList.contains('is-open') && menu.dataset.id === id && menu.dataset.tipo === tipo) {
    fecharMenuLinha();
    return;
  }

  editLabel.textContent = config.editLabel;
  menu.dataset.tipo = tipo;
  menu.dataset.id = id;
  delBtn.dataset.action = config.delAction;
  delBtn.dataset.id = id;
  delBtn.style.display = config.podeEliminar ? 'flex' : 'none';
  const delLabelEl = document.getElementById('row-menu-delete-label');
  if (delLabelEl) delLabelEl.textContent = config.delLabel || 'Excluir';

  document.querySelectorAll('.row-menu-btn.is-open').forEach(b => b.classList.remove('is-open'));
  anchorEl.classList.add('is-open');

  menu.style.display = 'flex';
  const rect = anchorEl.getBoundingClientRect();
  const menuWidth = menu.offsetWidth || 168;
  const menuHeight = menu.offsetHeight || 90;
  let left = rect.right - menuWidth;
  if (left < 8) left = 8;
  let top = rect.bottom + 6;
  if (top + menuHeight > window.innerHeight - 8) top = rect.top - menuHeight - 6;
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
  requestAnimationFrame(() => menu.classList.add('is-open'));
  window.BPRuntime = window.BPRuntime || {};
  window.BPRuntime.lastMenuTrigger = anchorEl;
  const firstItem = menu.querySelector('.row-menu-item:not([style*="display: none"])');
  if (firstItem) setTimeout(() => firstItem.focus(), 50);
}

function fecharMenuLinha() {
  const menu = document.getElementById('row-menu');
  if (!menu.classList.contains('is-open')) return;
  menu.classList.remove('is-open');
  document.querySelectorAll('.row-menu-btn.is-open').forEach(b => b.classList.remove('is-open'));
  setTimeout(() => {
    if (!menu.classList.contains('is-open')) menu.style.display = 'none';
    if (window.BPRuntime && window.BPRuntime.lastMenuTrigger) {
      window.BPRuntime.lastMenuTrigger.focus();
      window.BPRuntime.lastMenuTrigger = null;
    }
  }, 150);
}

document.addEventListener('click', (e) => {
  if (e.target.closest('#row-menu') || e.target.closest('[data-action="row-menu"]')) return;
  fecharMenuLinha();
});

document.getElementById('row-menu-edit').addEventListener('click', () => {
  const menu = document.getElementById('row-menu');
  const tipo = menu.dataset.tipo;
  const id = menu.dataset.id;
  if (tipo === 'cliente') openEditCliente(id);
  else if (tipo === 'profissional') openEditProf(id);
  else if (tipo === 'servico') openServicoModal(id);
});
// Confirm nativo substituído
(function bindBpGlobClick() {
  var root = document.body;
  if (!root) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindBpGlobClick, { once: true });
    }
    return;
  }
  if (root.dataset.bpGlobClick === '1') return;
  root.dataset.bpGlobClick = '1';
  document.addEventListener('click', async function(e) {
  const rowMenuBtn = e.target.closest('[data-action="row-menu"]');
  if (rowMenuBtn) {
    e.preventDefault();
    e.stopPropagation();
    abrirMenuLinha(rowMenuBtn, rowMenuBtn.dataset.tipo, rowMenuBtn.dataset.id);
    return;
  }

  // Finalizar atendimento (delegação — não depende de listeners por render)
  const finBtn = e.target.closest('[data-action="finalizar"]');
  if (finBtn) {
    e.preventDefault();
    e.stopPropagation();
    const id = finBtn.dataset.id;
    if (id && typeof abrirFinalizarAtendimento === 'function') abrirFinalizarAtendimento(id);
    return;
  }

  if (e.target.closest('.row-menu-item')) {
    fecharMenuLinha();
  }

  const reagendarBtn = e.target.closest('[data-action="reagendar-agenda"]');
  if (reagendarBtn) {
    e.preventDefault();
    e.stopPropagation();
    const id = reagendarBtn.dataset.id;
    if (typeof abrirReagendarAgendamento === 'function') abrirReagendarAgendamento(id);
    else if (window.abrirReagendarAgendamento) window.abrirReagendarAgendamento(id);
    return;
  }

  const waBtn = e.target.closest('[data-action="whatsapp-agenda"]');
  if (waBtn) {
    e.preventDefault();
    e.stopPropagation();
    const id = waBtn.dataset.id;
    const ag = (state.agendamentos || []).find(a => a.id === id);
    if (!ag) return;
    let href = '';
    try {
      if (window.BPAgendaUI && typeof BPAgendaUI.waHref === 'function') href = BPAgendaUI.waHref(ag);
    } catch (_) {}
    if (!href) {
      if (typeof toast === 'function') toast('Este cliente não tem telefone no registo.', 'warning');
      return;
    }
    const win = window.open(href, '_blank', 'noopener,noreferrer');
    if (!win) {
      if (typeof toast === 'function') toast('Permita pop-ups para abrir o WhatsApp', 'warning');
    }
    return;
  }

  const target = e.target.closest('[data-action="cancelar-agenda"]');
  if (target) {
    e.preventDefault();
    e.stopPropagation();
    // ET4.3: RBAC operacional (botão já tem data-role admin,gerente)
    if (typeof bpExigirRole === 'function' && !bpExigirRole(['admin', 'gerente'], 'Não tem permissão para cancelar agendamentos.')) return;
    const id = target.dataset.id;
    const ag = state.agendamentos.find(a => a.id === id);
    if (!ag) return;
    const confirmed = await showConfirmModal('Cancelar Agendamento?', `Tem a certeza que quer cancelar o agendamento de ${ag.cliente} para ${ag.servico}? Esta acção não pode ser desfeita.`, true);
    if (confirmed) {
      // CORREÇÃO: antes eliminava-se o agendamento por completo
      // (deleteAgendamento), o que impedia qualquer vista de
      // "Cancelados" e zerava sempre as métricas de cancelamento já
      // calculadas em ia-module.js. Agora fica marcado como cancelado,
      // continua a existir (histórico), só deixa de contar como
      // pendente/realizado.
      await updateAgendamento(id, { status: 'cancelado' });
      toast('Agendamento cancelado.', 'warning');
    }
    return;
  }

  const delProf = e.target.closest('[data-action="del-p"]');
  if (delProf) {
    e.preventDefault();
    e.stopPropagation();
    if (normalizarRole(state.config.userRole) !== 'admin') {
      toast('Não tens permissão para esta ação.', 'warning');
      return;
    }
    const id = delProf.dataset.id;
    const prof = (state.profissionais || []).find(p => p.id === id);
    if (!prof) return;
    if (typeof isProfissionalAtivo === 'function' && !isProfissionalAtivo(prof)) {
      toast('Este profissional já está destituído', 'warning');
      return;
    }
    const msg =
      'Tem a certeza que deseja destituir ' + (prof.nome || 'este profissional') + ' das suas funções?\n\n' +
      '• Deixa de aparecer em novos agendamentos e vendas\n' +
      '• Será removido dos serviços associados\n' +
      '• Serviços onde for o único profissional serão desactivados\n' +
      '• Agendamentos e vendas anteriores mantêm-se no histórico';
    const confirmed = await showConfirmModal('Destituir profissional', msg, true);
    if (!confirmed) return;

    const result = typeof desassociarProfissional === 'function'
      ? await desassociarProfissional(id)
      : null;

    if (result) {
      let extra = '';
      if (result.servicosDesativados && result.servicosDesativados.length) {
        extra = ' Serviços desactivados: ' + result.servicosDesativados.join(', ') + '.';
      }
      toast((prof.nome || 'Profissional') + ' destituído.' + extra, 'success');

      // Aviso ao profissional via WhatsApp (contexto AO — sem SMS infra)
      const digits = String(prof.contacto || '').replace(/\D/g, '');
      if (digits.length === 9) {
        const salao = (state.config && state.config.storeName) || 'o salão';
        const texto = encodeURIComponent(
          'Olá ' + (prof.nome || '') + ', foi destituído das suas funções em ' + salao +
          '. Os registos históricos permanecem no sistema. Contacte a administração para mais informações.'
        );
        try {
          window.open('https://wa.me/244' + digits + '?text=' + texto, '_blank', 'noopener,noreferrer');
        } catch (e) {}
      }
    } else {
      toast('Não foi possível destituir o profissional', 'error');
    }
    return;
  }

  const delServ = e.target.closest('[data-action="del-servico"]');
  if (delServ) {
    e.preventDefault();
    e.stopPropagation();
    if (normalizarRole(state.config.userRole) !== 'admin') {
      toast('Não tens permissão para esta ação.', 'warning');
      return;
    }
    const id = delServ.dataset.id;
    const serv = state.servicos.find(s => s.id === id);
    if (!serv) return;
    const confirmed = await showConfirmModal('Desactivar Serviço?', `Tem a certeza que quer desactivar "${serv.nome}"? Deixa de aparecer em novas vendas; o histórico mantém-se.`, true);
    if (confirmed) await deleteServico(id);
    return;
  }

  const delCliente = e.target.closest('[data-action="del-cliente"]');
  if (delCliente) {
    e.preventDefault();
    e.stopPropagation();
    const papel = normalizarRole(state.config.userRole);
    if (papel !== 'admin' && papel !== 'gerente') {
      toast('Não tens permissão para esta ação.', 'warning');
      return;
    }
    const id = delCliente.dataset.id;
    const cli = state.clientes.find(c => c.id === id);
    if (!cli) return;
    const confirmed = await showConfirmModal('Eliminar Cliente?', `Tem a certeza que quer eliminar "${cli.nome}"? Esta acção não pode ser desfeita.`, true);
    if (confirmed) await deleteCliente(id);
    return;
  }
}, false); // bubble: evita cortar outros handlers em capture
})();


// ONLINE — flush apenas em sync-queue.js (evitar double flush). Actualiza UI IA se existir.
window.addEventListener('online', () => {
  if (typeof atualizarIAOffline === 'function') atualizarIAOffline();
  if (typeof atualizarIndicadorSync === 'function') atualizarIndicadorSync();
});

window.addEventListener('offline', () => {
  if (typeof atualizarIAOffline === 'function') atualizarIAOffline();
  if (typeof atualizarIndicadorSync === 'function') atualizarIndicadorSync();
});

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (typeof atualizarIndicadorSync === 'function') atualizarIndicadorSync();
    });
  } else if (typeof atualizarIndicadorSync === 'function') {
    atualizarIndicadorSync();
  }
}

// Fechar modais ao clicar no overlay
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', (e) => { if (e.target === el) closeModal(el.id); });
});

// ====================================================================
//  IA – buildContextoIA (CORRIGIDO: usa profissional_id)

