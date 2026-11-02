/* BelezaPro — modules/clientes — render + estatísticas */
// Cache O(1) por render — invalidado quando mudam tamanhos das listas
let _statsCache = { key: '', map: null };

function _normNomeCli(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Agrega por cliente_id (preferência) e por nome normalizado (legado). */
function _buildStatsMap() {
  const byId = {};
  const byName = {};

  function touch(bucket, key, patch) {
    if (!key) return;
    if (!bucket[key]) bucket[key] = { visitas: 0, totalGasto: 0, datas: [] };
    const row = bucket[key];
    if (patch.visita) row.visitas++;
    if (patch.gasto) row.totalGasto += patch.gasto;
    if (patch.data) row.datas.push(patch.data);
  }

  (state.agendamentos || []).forEach(a => {
    const st = String(a.status || a.estado || '').toLowerCase();
    if (st === 'cancelado') return;
    const nome = a.cliente;
    if (!nome && !a.cliente_id) return;
    // Visita conta agenda realizada ou ainda agendada (presença no salão)
    const conta = st === 'realizado' || st === 'agendado' || !st;
    if (!conta) return;
    const patch = { visita: true, data: a.data || null };
    if (a.cliente_id) touch(byId, String(a.cliente_id), patch);
    if (nome) touch(byName, _normNomeCli(nome), patch);
  });

  (state.movimentos || []).forEach(m => {
    if (m.tipo !== 'venda') return;
    const nome = m.cliente;
    if (!nome && !m.cliente_id) return;
    const patch = { visita: true, gasto: Number(m.valor) || 0, data: m.data || null };
    if (m.cliente_id) touch(byId, String(m.cliente_id), patch);
    if (nome) touch(byName, _normNomeCli(nome), patch);
  });

  function finalize(bucket) {
    Object.keys(bucket).forEach(k => {
      bucket[k].datas.sort();
      const d = bucket[k].datas;
      bucket[k].ultimaVisita = d.length ? d[d.length - 1] : null;
      delete bucket[k].datas;
    });
  }
  finalize(byId);
  finalize(byName);
  return { byId, byName };
}

/**
 * Aceita: objecto cliente | id | nome.
 * Preferência: id → merge com nome se ambos existirem (legado sem id nas vendas).
 */
function getEstatisticasCliente(ref) {
  const key = (state.agendamentos || []).length + ':' + (state.movimentos || []).length;
  if (!_statsCache.map || _statsCache.key !== key) {
    _statsCache = { key, map: _buildStatsMap() };
  }
  const empty = { visitas: 0, totalGasto: 0, ultimaVisita: null };
  if (ref == null || ref === '') return empty;

  let id = null;
  let nome = null;
  if (typeof ref === 'object') {
    id = ref.id || null;
    nome = ref.nome || null;
  } else {
    const s = String(ref);
    const asCli = (state.clientes || []).find(c => c.id === s || c.nome === s);
    if (asCli) {
      id = asCli.id;
      nome = asCli.nome;
    } else {
      nome = s;
    }
  }

  const a = id ? (_statsCache.map.byId[String(id)] || empty) : empty;
  const b = nome ? (_statsCache.map.byName[_normNomeCli(nome)] || empty) : empty;

  // Se há id, preferir id para gasto; visitas = max para não duplicar quando ambos apontam ao mesmo histórico
  if (id && a.visitas) {
    // Histórico com cliente_id: usar byId; acrescentar gasto de byName só se byId não tiver gasto (dados mistos)
    return {
      visitas: Math.max(a.visitas, b.visitas),
      totalGasto: a.totalGasto > 0 ? a.totalGasto : b.totalGasto,
      ultimaVisita: (a.ultimaVisita && b.ultimaVisita)
        ? (a.ultimaVisita > b.ultimaVisita ? a.ultimaVisita : b.ultimaVisita)
        : (a.ultimaVisita || b.ultimaVisita)
    };
  }
  return {
    visitas: b.visitas || a.visitas,
    totalGasto: b.totalGasto || a.totalGasto,
    ultimaVisita: b.ultimaVisita || a.ultimaVisita
  };
}

function resolverClienteIdPorNome(nome) {
  const n = _normNomeCli(nome);
  if (!n) return null;
  const hit = (state.clientes || []).find(c => _normNomeCli(c.nome) === n);
  return hit ? hit.id : null;
}

function formatarUltimaVisita(iso) {
  if (!iso) return 'Sem visitas registadas';
  const dias = Math.floor((new Date(hoje() + 'T00:00:00') - new Date(iso + 'T00:00:00')) / 86400000);
  if (dias === 0) return 'Hoje';
  if (dias === 1) return 'Ontem';
  if (dias < 30) return `Há ${dias} dias`;
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-AO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderClientes() {
  const cont0 = document.getElementById('clientes-list');
  if (!state.clientes || !Array.isArray(state.clientes)) {
    if (cont0) cont0.innerHTML = '<div class="empty-state">A carregar clientes...</div>';
    return;
  }
  const rawSearch = document.getElementById('search-cliente')?.value || '';
  const search = rawSearch.trim().toLowerCase();
  const searchDigits = rawSearch.replace(/\D/g, '');
  const filtro = state.filtroClientes || 'todos';
  // Soft-delete: eliminados (ativo=false / deleted_at) nunca aparecem na UI; permanecem no estado/BD.
  var baseClientes;
  try {
    baseClientes = (typeof bpClientesActivos === 'function')
      ? bpClientesActivos()
      : (state.clientes || []).filter(function (c) {
          if (!c) return false;
          if (c.ativo === false || c.ativo === 0 || c.ativo === 'false') return false;
          if (c.deleted_at) return false;
          return true;
        });
  } catch (_) {
    baseClientes = state.clientes || [];
  }
  if (!Array.isArray(baseClientes)) baseClientes = [];
  let filtered = baseClientes.filter(c => {
    if (!search && !searchDigits) return true;
    const nome = String(c.nome || '').toLowerCase();
    const tel = String(c.telefone || '').replace(/\D/g, '');
    if (search && nome.includes(search)) return true;
    if (searchDigits && tel.includes(searchDigits)) return true;
    if (search && String(c.notas || '').toLowerCase().includes(search)) return true;
    return false;
  });

  if (filtro === 'mais' || filtro === 'menos') {
    filtered = filtered.slice().sort((a, b) => {
      const fa = getEstatisticasCliente(a).visitas;
      const fb = getEstatisticasCliente(b).visitas;
      return filtro === 'mais' ? (fb - fa) : (fa - fb);
    });
  } else {
    filtered = filtered.slice().sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt'));
  }

  const cont = document.getElementById('clientes-list');
  if (filtered.length === 0) {
    const msg = search || searchDigits
      ? 'Nenhum cliente corresponde à pesquisa'
      : 'Ainda sem clientes — adicione o primeiro';
    cont.innerHTML = `<div class="empty-state">${typeof svgPessoa !== 'undefined' ? svgPessoa : ''}<p>${msg}</p></div>`;
    return;
  }

  // Progressive render: primeiros 60 itens, resto sob demanda (P1 performance)
  const INITIAL = 60;
  const rowHtml = (c) => {
    const { visitas, totalGasto, ultimaVisita } = getEstatisticasCliente(c);
    const clienteNovo = visitas === 0;
    return `
      <div class="list-item cliente-item" data-cliente-id="${escHtml(c.id)}" style="cursor:pointer;">
        <div class="avatar">${escHtml((c.nome||'?').charAt(0).toUpperCase())}</div>
        <div class="info">
          <div class="title">${escHtml(c.nome)}</div>
          <div class="sub">${c.telefone ? escHtml(String(c.telefone)) : 'Sem contacto'}${c.notas ? ' · ' + escHtml(c.notas) : ''}</div>
          <div class="cliente-stats">
            <span class="cliente-stat">${visitas} ${visitas === 1 ? 'visita' : 'visitas'}</span>
            ${totalGasto > 0 ? `<span class="cliente-stat cliente-stat--gasto">${fmtKz(totalGasto)} gastos</span>` : ''}
            ${(Number(c.pontos) || 0) > 0 ? `<span class="cliente-stat">${Number(c.pontos)} pts</span>` : ''}
            ${clienteNovo ? `<span class="cliente-stat cliente-stat--novo">Novo</span>` : `<span class="cliente-stat">${formatarUltimaVisita(ultimaVisita)}</span>`}
          </div>
        </div>
        <div class="actions">
          <button class="row-menu-btn" data-action="row-menu" data-tipo="cliente" data-id="${escHtml(c.id)}" aria-label="Mais ações" aria-haspopup="menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </button>
        </div>
      </div>`;
  };
  const first = filtered.slice(0, INITIAL);
  cont.innerHTML = first.map(rowHtml).join('');
  if (filtered.length > INITIAL) {
    const more = document.createElement('div');
    more.className = 'list-load-more';
    more.style.cssText = 'padding:12px;text-align:center;';
    more.innerHTML = '<button type="button" class="btn btn-secondary btn-sm" id="clientes-load-more">Mostrar mais (' + (filtered.length - INITIAL) + ')</button><div id="clientes-io-sentinel" style="height:1px;" aria-hidden="true"></div>';
    cont.appendChild(more);
    const btn = more.querySelector('#clientes-load-more');
    if (btn) {
      let offset = INITIAL;
      btn.onclick = () => {
        const next = filtered.slice(offset, offset + INITIAL);
        offset += next.length;
        const htmls = next.map(rowHtml);
        if (typeof appendRowsHtml === 'function') appendRowsHtml(cont, htmls);
        else next.forEach(c => cont.insertAdjacentHTML('beforeend', rowHtml(c)));
        cont.appendChild(more);
        if (offset >= filtered.length) more.remove();
        else btn.textContent = 'Mostrar mais (' + (filtered.length - offset) + ')';
        if (typeof bindClienteRowEvents === 'function') bindClienteRowEvents(cont);
      };
      const sent = more.querySelector('#clientes-io-sentinel');
      if (sent && typeof observeLoadMore === 'function') {
        observeLoadMore(sent, function() {
          if (btn && document.body.contains(btn)) btn.click();
        });
      }
    }
  }

  /* F3.2 — hooks pós-render (media/avatars) sem reassign de ownership */
  try {
    var hooksC = window.__bpAfterRenderClientes;
    if (Array.isArray(hooksC)) {
      for (var hi = 0; hi < hooksC.length; hi++) {
        if (typeof hooksC[hi] === 'function') {
          try { setTimeout(hooksC[hi], 0); setTimeout(hooksC[hi], 40); } catch (_) {}
        }
      }
    }
  } catch (_) {}
}

if (typeof window !== 'undefined') {
  window.getEstatisticasCliente = getEstatisticasCliente;
  window.resolverClienteIdPorNome = resolverClienteIdPorNome;
  window.renderClientes = renderClientes;
  window.renderClientes._bpOwner = 'modules/clientes';
}
