/* BelezaPro — src/app/app-shell-events.js
 * Etapa 5: shell da aplicação (signup, menu header, logout).
 * NÃO contém regras de domínio (agenda/clientes/equipa/serviços/vendas/caixa).
 * Predecessor: form-events.js (esvaziado nas etapas 2–4).
 */
document.getElementById('signup-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  /* F1: wizard de criação de conta / provisionamento — fase seguinte */
  if (typeof toast === 'function') {
    toast('A criação de conta guiada chega na próxima etapa. Para já, peça acesso ao proprietário do salão.', 'info');
  }
});

// Menu hambúrguer do header (substitui o antigo botão de logout direto)
document.getElementById('menu-btn')?.addEventListener('click', function(e) {
  e.stopPropagation();
  const dropdown = document.getElementById('menu-dropdown');
  const aberto = dropdown.style.display === 'block';
  dropdown.style.display = aberto ? 'none' : 'block';
  this.setAttribute('aria-expanded', aberto ? 'false' : 'true');
});
document.addEventListener('click', function(e) {
  const dropdown = document.getElementById('menu-dropdown');
  const menuBtn = document.getElementById('menu-btn');
  if (dropdown && dropdown.style.display === 'block' && !dropdown.contains(e.target) && e.target !== menuBtn) {
    dropdown.style.display = 'none';
    menuBtn?.setAttribute('aria-expanded', 'false');
  }
});

document.getElementById('logout-btn')?.addEventListener('click', async function() {
  var dd = document.getElementById('menu-dropdown');
  if (dd) dd.style.display = 'none';
  logoutVoluntarioEmCurso = true;
  const confirmed = await showConfirmModal('Sair da conta?', 'Vais terminar a sessão neste dispositivo. Os dados do salão continuam guardados; basta iniciares sessão outra vez para continuares.', false, { confirmLabel: 'Sair', cancelLabel: 'Cancelar', variant: 'quiet', confirmTone: 'danger' });
  if (!confirmed) {
    logoutVoluntarioEmCurso = false;
    return;
  }
  // ET4.3: limpar flags de init BP* antes do reload (troca de conta / permissões)
  try {
    ['__bpFinanceInitDone','__bpOpsInitDone','__bpGestaoInitDone','__bpEquipaInitDone','__bpMarketingInitDone','__bpMediaInitDone'].forEach(function (k) {
      try { delete window[k]; } catch (_) { window[k] = false; }
    });
  } catch (_) {}
  if (typeof bpClearSessionLocal === 'function') bpClearSessionLocal();
  try { localStorage.removeItem('bp_user_role'); } catch (_) {}
  try { await supabaseClient.auth.signOut(); } catch (_) {}
  location.reload();
});

// Etapa 4: nova-venda-hero → modules/vendas/vendas-events.js


// Etapa 2: bloco agenda (FAB/save/reagendar/cancel) → modules/agenda/agenda-events.js


/* ========================================================================
 * Etapa 3 — form-events reduzido a shell app:
 *   auth UI, menu, logout, atalho nova venda.
 * Movido:
 *   agenda     → modules/agenda/agenda-events.js (Etapa 2)
 *   clientes   → modules/clientes/clientes-events.js
 *   equipa     → modules/equipa/equipa-events.js
 *   servicos   → modules/servicos/servicos-events.js
 * Vendas → modules/vendas/vendas-events.js (Etapa 4)
 * Caixa  → modules/caixa/caixa-events.js (Etapa 4)
 * ======================================================================== */
