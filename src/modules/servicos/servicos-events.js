/* BelezaPro — modules/servicos/servicos-events.js
 * Etapa 3: events de serviços extraídos de src/app/form-events.js
 * Ownership: add/save/cancel/view serviço.
 * Carregar após servicos-modal.js (openServicoModal neste domínio).
 */
// CRUD Serviço
document.getElementById('add-servico-btn')?.addEventListener('click', function () { if (typeof openServicoModal === 'function') openServicoModal(); });

document.getElementById('modal-servico-save').addEventListener('click', async () => {
  const nome = document.getElementById('servico-nome').value.trim();
  const precoBase = parseFloat(document.getElementById('servico-preco').value);
  const durRaw = parseInt(document.getElementById('servico-duracao')?.value, 10);
  const duracao = (!isNaN(durRaw) && durRaw >= 5) ? durRaw : 60;
  const id = document.getElementById('servico-id').value;
  const profissionais = typeof getSelectedProfissionais === 'function' ? getSelectedProfissionais() : [];
  if (!nome) {
    if (typeof bpNotifyFormError === 'function') bpNotifyFormError('Indique o nome do serviço para continuar.', 'servico-nome');
    else toast('Indique o nome do serviço para continuar.', 'warning');
    return;
  }
  if (isNaN(precoBase) || precoBase <= 0) {
    if (typeof bpNotifyFormError === 'function') bpNotifyFormError('Informe um preço válido superior a zero.', 'servico-preco');
    else toast('Informe um preço válido superior a zero.', 'warning');
    return;
  }
  // ET4.5: profissionais obrigatórios — proibido vazio / "toda a equipa"
  if (!profissionais || !profissionais.length) {
    if (typeof bpNotifyFormError === 'function') {
      bpNotifyFormError('Associe pelo menos um profissional a este serviço para continuar.', 'servico-profissionais-container');
    } else {
      toast('Associe pelo menos um profissional a este serviço para continuar.', 'warning');
    }
    return;
  }
  const payload = { nome, precoBase, profissionais: profissionais, duracao };
  if (id) {
    const upd = await updateServico(id, payload);
    if (!upd) return;
    toast('Serviço actualizado.', 'success');
  } else {
    const created = await addServico(payload);
    if (!created) return;
  }
  closeModal('modal-servico');
  if (typeof updateUI === 'function') updateUI();
});

document.getElementById('modal-servico-cancel')?.addEventListener('click', () => {
  if (typeof setServicoModalMode === 'function') setServicoModalMode('edit');
  closeModal('modal-servico');
});
document.getElementById('servico-view-fechar')?.addEventListener('click', () => {
  if (typeof setServicoModalMode === 'function') setServicoModalMode('edit');
  closeModal('modal-servico');
});
document.getElementById('servico-view-editar')?.addEventListener('click', () => {
  const id = document.getElementById('servico-id')?.value;
  if (id && typeof openServicoModal === 'function') openServicoModal(id);
});
document.addEventListener('click', function (e) {
  const row = e.target.closest('.list-item[data-servico-id]');
  if (!row) return;
  if (e.target.closest('.row-menu-btn') || e.target.closest('.row-menu')) return;
  const id = row.dataset.servicoId;
  if (id && typeof abrirDetalheServicoView === 'function') abrirDetalheServicoView(id);
});
