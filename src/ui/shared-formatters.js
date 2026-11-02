/* BelezaPro — src/ui/shared-formatters.js
 * Etapa 6: helpers partilhados (nome de profissional, datas, status agenda).
 * Não é “domain layer”; policies puras vivem em src/domain/pure/.
 * Predecessor: domain-helpers.js.
 */
function getProfissionalNome(profissionalId) {
  if (!profissionalId) return 'Não atribuído';
  const prof = state.profissionais.find(p => p.id === profissionalId);
  return prof ? prof.nome : 'Não atribuído';
}
function formatarDataISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function formatarDataCurta(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-AO', { day: '2-digit', month: 'short' });
}
function _statusAg(a) {
  return String(a.status || a.estado || 'agendado').toLowerCase();
}

if (typeof window !== 'undefined') {
  window.getProfissionalNome = getProfissionalNome;
  window.formatarDataISO = formatarDataISO;
  window.formatarDataCurta = formatarDataCurta;
  window._statusAg = _statusAg;
}
