/* BelezaPro B6 — feature fora do monólito; carregar após app.bundle.js */

// ================================================================
// FUNCIONALIDADE 1: Comissões automáticas com metas
// Offline-first — sem dependência de Supabase nesta etapa
// ================================================================


function _movVendaContaComissao(m) {
  if (!m || m.tipo !== 'venda') return false;
  var st = String(m.status || '').toLowerCase();
  if (st === 'cancelado' || st === 'anulado') return false;
  return true;
}

function calcularComissao(valorLiquido, taxa) {
  const v = Number(valorLiquido) || 0;
  const t = Number(taxa) || 0;
  if (v <= 0 || t <= 0) return 0;
  return Math.round((v * (t / 100)) * 100) / 100;
}

function getTaxaComissao(profissionalId) {
  if (!profissionalId || typeof state === 'undefined') return 0;
  const p = (state.profissionais || []).find(x => x.id === profissionalId);
  return p ? (Number(p.taxa_comissao) || 0) : 0;
}

function getSaldoComissao(profissionalId) {
  if (!profissionalId || typeof state === 'undefined') return 0;
  return (state.movimentos || [])
    .filter(m => _movVendaContaComissao(m) && m.profissional_id === profissionalId)
    .reduce((s, m) => s + (Number(m.comissao_gerada) || 0), 0);
}

function getComissaoMesAtual(profissionalId) {
  if (!profissionalId || typeof state === 'undefined' || typeof hoje !== 'function') return 0;
  const agora = hoje(); // YYYY-MM-DD
  const ym = agora.slice(0, 7);
  return (state.movimentos || [])
    .filter(m => _movVendaContaComissao(m) && m.profissional_id === profissionalId && String(m.data || '').startsWith(ym))
    .reduce((s, m) => s + (Number(m.comissao_gerada) || 0), 0);
}

function getProgressoMeta(profissionalId) {
  if (!profissionalId || typeof state === 'undefined') return null;
  if (typeof _bpStatsProf === 'function') {
    var _s = _bpStatsProf(profissionalId, 'mes');
    if (!(_s.meta > 0)) return null;
    return { meta: _s.meta, volume: _s.receita, pct: _s.progresso, atingida: _s.metaAtingida };
  }
  const p = (state.profissionais || []).find(x => x.id === profissionalId);
  if (!p || p.meta_mensal == null || Number(p.meta_mensal) <= 0) return null;
  const meta = Number(p.meta_mensal);
  // progresso = volume de vendas (valor) no mês, não comissão
  const agora = typeof hoje === 'function' ? hoje() : '';
  const ym = agora.slice(0, 7);
  const volume = (state.movimentos || [])
    .filter(m => _movVendaContaComissao(m) && m.profissional_id === profissionalId && String(m.data || '').startsWith(ym))
    .reduce((s, m) => s + (Number(m.valor) || 0), 0);
  const pct = Math.min(100, Math.round((volume / meta) * 100));
  return { meta, volume, pct, atingida: volume >= meta };
}

function renderBarraMeta(profissionalId) {
  try {
    if (typeof _bpRenderBarraMetaMes === 'function') return _bpRenderBarraMetaMes(profissionalId);
    const prog = getProgressoMeta(profissionalId);
    if (!prog) return '';
    const fmt = typeof fmtKz === 'function' ? fmtKz : (v => v + ' Kz');
    return (
      '<div class="meta-barra-wrap" style="margin-top:6px;">' +
        '<div style="display:flex;justify-content:space-between;font-size:.65rem;color:var(--text-muted);margin-bottom:3px;">' +
          '<span>Meta</span>' +
          '<span>' + fmt(prog.volume) + ' / ' + fmt(prog.meta) + ' (' + prog.pct + '%)</span>' +
        '</div>' +
        '<div style="height:6px;background:var(--border-soft,#DCD5C9);border-radius:4px;overflow:hidden;">' +
          '<div style="height:100%;width:' + prog.pct + '%;background:var(--gold,#D4AF37);border-radius:4px;"></div>' +
        '</div>' +
      '</div>'
    );
  } catch (e) {
    return '';
  }
}

window.calcularComissao = calcularComissao;
window.getTaxaComissao = getTaxaComissao;
window.getSaldoComissao = getSaldoComissao;
window.getComissaoMesAtual = getComissaoMesAtual;
window.getProgressoMeta = getProgressoMeta;
window.renderBarraMeta = renderBarraMeta;

