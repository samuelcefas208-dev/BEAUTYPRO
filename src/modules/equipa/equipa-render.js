/* BelezaPro — modules/equipa — render profissionais
 * Estratégia: TOTAL ACUMULADO (sem mês / sem 30d na UI).
 * Período 'total' = todas as vendas válidas. '30d'/'mes' só para IA via _bpStatsProf.
 */
function _bpStatsProf(profId, periodo) {
  var out = {
    receita: 0, comissao: 0, meta: 0, progresso: 0, taxa: 0,
    de: '', ate: '', periodo: periodo || 'total', metaAtingida: false
  };
  try {
    if (profId == null || profId === '') return out;
    if (periodo !== '30d' && periodo !== 'mes') periodo = 'total';
    out.periodo = periodo;

    var hojeStr = '';
    try { hojeStr = typeof hoje === 'function' ? String(hoje()) : ''; } catch (e0) { hojeStr = ''; }
    if (!hojeStr || hojeStr.length < 10) {
      var d0 = new Date();
      hojeStr = d0.getFullYear() + '-' + String(d0.getMonth() + 1).padStart(2, '0') + '-' + String(d0.getDate()).padStart(2, '0');
    }
    hojeStr = hojeStr.slice(0, 10);
    out.ate = hojeStr;

    var deStr = '';
    if (periodo === '30d') {
      try {
        if (typeof _bpIaDataOffset === 'function') deStr = String(_bpIaDataOffset(-29)).slice(0, 10);
      } catch (e1) { deStr = ''; }
      if (!deStr || deStr.length < 10) {
        var d1 = new Date(hojeStr + 'T12:00:00');
        if (isNaN(d1.getTime())) d1 = new Date();
        d1.setDate(d1.getDate() - 29);
        deStr = d1.getFullYear() + '-' + String(d1.getMonth() + 1).padStart(2, '0') + '-' + String(d1.getDate()).padStart(2, '0');
      }
    } else if (periodo === 'mes') {
      deStr = hojeStr.slice(0, 7) + '-01';
    }
    out.de = deStr || '(início)';

    var movs = (typeof state !== 'undefined' && Array.isArray(state.movimentos)) ? state.movimentos : [];
    var profs = (typeof state !== 'undefined' && Array.isArray(state.profissionais)) ? state.profissionais : [];
    var prof = null, i, m, st, cg, valor, dataStr, match;
    for (i = 0; i < profs.length; i++) {
      if (profs[i] && String(profs[i].id) === String(profId)) { prof = profs[i]; break; }
    }
    var nomeNorm = (prof && prof.nome) ? String(prof.nome).trim().toLowerCase() : '';
    if (prof) {
      out.taxa = Number(prof.taxa_comissao != null ? prof.taxa_comissao : prof.taxa) || 0;
      out.meta = Number(prof.meta_mensal != null ? prof.meta_mensal : prof.meta) || 0;
    }

    for (i = 0; i < movs.length; i++) {
      m = movs[i];
      if (!m || m.tipo !== 'venda') continue;
      st = String(m.status || '').toLowerCase();
      if (st === 'cancelado' || st === 'anulado') continue;
      dataStr = String(m.data || '');
      if (dataStr.length >= 10) dataStr = dataStr.slice(0, 10);
      if (periodo !== 'total') {
        if (!dataStr || (deStr && dataStr < deStr) || dataStr > hojeStr) continue;
      }
      match = false;
      if (m.profissional_id != null && String(m.profissional_id) !== '' && String(m.profissional_id) === String(profId)) match = true;
      else if (nomeNorm && m.profissional && String(m.profissional).trim().toLowerCase() === nomeNorm) match = true;
      if (!match) continue;
      valor = Number(m.valor) || 0;
      out.receita += valor;
      cg = Number(m.comissao_gerada);
      if (!(cg > 0) && out.taxa > 0 && valor > 0) {
        cg = Math.round(valor * (out.taxa / 100) * 100) / 100;
      }
      if (!(cg > 0)) cg = 0;
      out.comissao += cg;
    }

    if (out.meta > 0) {
      out.progresso = Math.min(100, Math.round((out.receita / out.meta) * 100));
      out.metaAtingida = out.receita >= out.meta;
    }
  } catch (e) {
    try { console.warn('[equipa] _bpStatsProf', e); } catch (e2) {}
  }
  return out;
}

function _bpStatsProfMes(profId) { return _bpStatsProf(profId, 'total'); }
function _receitaProfMes(profId) { return _bpStatsProf(profId, 'total').receita; }

function _bpRenderBarraMetaMes(profId) {
  try {
    var s = _bpStatsProf(profId, 'total');
    if (!(s.meta > 0)) return '';
    var fmt = typeof fmtKz === 'function' ? fmtKz : function (v) { return v + ' Kz'; };
    var pct = s.progresso;
    var cor = s.metaAtingida ? 'var(--success, #2E7D32)' : 'var(--gold, #D4AF37)';
    var fin = (typeof bpProfFinGet === 'function') ? bpProfFinGet(profId) : null;
    var extra = '';
    if (fin && fin.bloqueado) {
      extra = '<span class="cliente-stat" style="margin-left:6px;color:var(--danger,#C62828);font-weight:600;">Aguarda autorização</span>';
      cor = 'var(--danger, #C62828)';
    } else if (s.metaAtingida) {
      extra = '<span class="cliente-stat" style="margin-left:6px;color:var(--success,#2E7D32);font-weight:600;">Meta atingida</span>';
    }
    var html = '<div class="meta-barra-wrap" style="margin-top:6px;">';
    html += '<div style="display:flex;justify-content:space-between;font-size:.65rem;color:var(--text-muted);margin-bottom:3px;gap:8px;flex-wrap:wrap;">';
    html += '<span>Meta (total)</span>';
    html += '<span>' + fmt(s.receita) + ' / ' + fmt(s.meta) + ' (' + pct + '%)' + extra + '</span></div>';
    html += '<div style="height:6px;background:var(--border-soft,#DCD5C9);border-radius:4px;overflow:hidden;">';
    html += '<div style="height:100%;width:' + pct + '%;background:' + cor + ';border-radius:4px;transition:width .25s ease;"></div>';
    html += '</div></div>';
    return html;
  } catch (e) { return ''; }
}

function renderProfissionais() {
  var cont = document.getElementById('profissionais-list');
  if (!cont) return;
  var plano = typeof getPlanoAtual === 'function' ? getPlanoAtual() : 'trial';
  var aviso = document.getElementById('plano-aviso');
  if (aviso) aviso.style.display = (plano === 'trial' || plano === 'starter') ? 'block' : 'none';
  var activos = (state.profissionais || []).filter(function (p) {
    return typeof isProfissionalAtivo === 'function' ? isProfissionalAtivo(p) : (p && p.ativo !== false);
  });
  if (!activos.length) {
    cont.innerHTML = '<div class="empty-state">' + (typeof svgPessoas !== 'undefined' ? svgPessoas : '') +
      '<p>Ainda sem profissionais — adicione o primeiro</p></div>';
    return;
  }
  var profissionaisOrdenados = activos.slice().sort(function (a, b) {
    return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt');
  });
  var fmt = typeof fmtKz === 'function' ? fmtKz : function (v) { return v + ' Kz'; };
  cont.innerHTML = profissionaisOrdenados.map(function (p) {
    var s = _bpStatsProf(p.id, 'total');
    var fin = (typeof bpProfFinGet === 'function') ? bpProfFinGet(p.id) : null;
    var statsHtml = '';
    if (s.receita > 0) statsHtml += '<span class="cliente-stat cliente-stat--gasto">' + fmt(s.receita) + ' · total</span>';
    if (s.comissao > 0) statsHtml += '<span class="cliente-stat">Com. ' + fmt(s.comissao) + (s.taxa > 0 ? ' · ' + s.taxa + '%' : '') + '</span>';
    else if (s.taxa > 0) statsHtml += '<span class="cliente-stat">Taxa ' + s.taxa + '%</span>';
    if (fin && fin.bloqueado) statsHtml += '<span class="cliente-stat cliente-stat--risco">Bloqueado</span>';
    else if (s.metaAtingida) statsHtml += '<span class="cliente-stat" style="color:var(--success,#2E7D32);font-weight:600;">Meta ok</span>';
    if (fin && fin.estado && fin.estado !== 'regular') {
      statsHtml += '<span class="cliente-stat">' + String(fin.estado).replace(/_/g, ' ') + '</span>';
    }
    var contacto = p.contacto ? String(p.contacto).replace(/\D/g, '') : '';
    var html = '<div class="list-item" data-prof-id="' + escHtml(p.id) + '" style="cursor:pointer;">';
    html += '<div class="avatar">' + escHtml((p.nome || '?').charAt(0).toUpperCase()) + '</div><div class="info">';
    html += '<div class="title">' + escHtml(p.nome || 'Profissional') + '</div>';
    html += '<div class="sub">' + escHtml(p.especialidade || 'Sem especialidade') + (contacto ? ' · ' + escHtml(contacto) : '') + '</div>';
    html += '<div class="cliente-stats">' + statsHtml + '</div>' + _bpRenderBarraMetaMes(p.id) + '</div>';
    html += '<div class="actions"><button class="row-menu-btn" data-action="row-menu" data-tipo="profissional" data-id="' + escHtml(p.id) + '" data-role="admin" aria-label="Mais ações" aria-haspopup="menu">';
    html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="12" cy="19" r="1.75"/></svg>';
    html += '</button></div></div>';
    return html;
  }).join('');
  try {
    var hooksP = window.__bpAfterRenderProfissionais;
    if (Array.isArray(hooksP)) {
      for (var hj = 0; hj < hooksP.length; hj++) {
        if (typeof hooksP[hj] === 'function') {
          try { setTimeout(hooksP[hj], 0); setTimeout(hooksP[hj], 40); } catch (eh) {}
        }
      }
    }
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  window._bpStatsProf = _bpStatsProf;
  window._bpStatsProfMes = _bpStatsProfMes;
  window._bpRenderBarraMetaMes = _bpRenderBarraMetaMes;
  window._receitaProfMes = _receitaProfMes;
  window.renderProfissionais = renderProfissionais;
  window.renderProfissionais._bpOwner = 'modules/equipa';
}
