/* LEGADO — use src/ui/shared-formatters.js (carregado no index).
 * Mantido só para não 404 se cache antigo pedir este path.
 * Re-exporta se shared-formatters já definiu; senão define o mínimo.
 */
(function (g) {
  'use strict';
  if (typeof g._statusAg === 'function' && typeof g.formatarDataISO === 'function') return;
  function getProfissionalNome(profissionalId) {
    if (!profissionalId) return 'Não atribuído';
    try {
      var prof = (g.state && g.state.profissionais || []).find(function (p) { return p.id === profissionalId; });
      return prof ? prof.nome : 'Não atribuído';
    } catch (_) { return 'Não atribuído'; }
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
  g.getProfissionalNome = getProfissionalNome;
  g.formatarDataISO = formatarDataISO;
  g.formatarDataCurta = formatarDataCurta;
  g._statusAg = _statusAg;
})(typeof window !== 'undefined' ? window : this);
