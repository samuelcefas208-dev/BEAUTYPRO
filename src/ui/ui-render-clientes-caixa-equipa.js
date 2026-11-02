/* BelezaPro C-5 — ui-render-clientes-caixa-equipa.js fora do monólito; carregar após app.bundle.js */

// ====================================================================
//  ui-render-clientes-caixa-equipa.js — extraído do app.js (Fase C da modularização)
//  Conteúdo: Renderização de Clientes, Caixa, Profissionais e Serviços
//  Linhas originais: 611-910
//  Carregar depois de core-*.js, db-indexeddb.js, sync-*.js, auth-supabase.js
// ====================================================================

// ====================================================================
//  ESTATÍSTICAS DO CLIENTE (partilhado entre a lista e o modal de perfil)
// ====================================================================
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


/** Insere HTML de linhas via DocumentFragment (menos reflow que innerHTML repetido) */
function appendRowsHtml(container, htmlStrings) {
  if (!container || !htmlStrings || !htmlStrings.length) return;
  const frag = document.createDocumentFragment();
  const wrap = document.createElement('div');
  wrap.innerHTML = htmlStrings.join('');
  while (wrap.firstChild) frag.appendChild(wrap.firstChild);
  container.appendChild(frag);
}

/** Sentinel IntersectionObserver para "carregar mais" */
function observeLoadMore(sentinel, onVisible) {
  if (!sentinel || typeof IntersectionObserver === 'undefined') return null;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) onVisible();
    });
  }, { root: null, rootMargin: '120px', threshold: 0 });
  io.observe(sentinel);
  return io;
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
  let filtered = (state.clientes || []).filter(c => {
    // FASE 1: soft-delete — não listar inactivos / eliminados
    if (!c) return false;
    if (c.ativo === false || c.ativo === 0 || c.ativo === 'false') return false;
    if (c.deleted_at) return false;
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
      <div class="list-item cliente-item" data-cliente-id="${c.id}" style="cursor:pointer;">
        <div class="avatar">${(c.nome||'?').charAt(0).toUpperCase()}</div>
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
          <button class="row-menu-btn" data-action="row-menu" data-tipo="cliente" data-id="${c.id}" aria-label="Mais ações" aria-haspopup="menu">
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

}

function renderCaixa() {
  if (!state.movimentos || !Array.isArray(state.movimentos)) {
    const cont0 = document.getElementById('movimentos-list');
    if (cont0) cont0.innerHTML = '<div class="empty-state">A carregar movimentos...</div>';
    return;
  }
  const hojeStr = hoje();
  const _num = (v) => Number(v) || 0;
  const entradas = (typeof getFaturamentoPeriodo === 'function') ? getFaturamentoPeriodo(hojeStr, hojeStr) : 0;
  const despesas = state.movimentos
    .filter(m => m.data === hojeStr && m.tipo === 'despesa')
    .reduce((s, m) => s + _num(m.valor), 0);
  const fundo = _num(state.config && state.config.fundo);
  const saldoEl = document.getElementById('caixa-saldo');
  const fundoEl = document.getElementById('caixa-fundo');
  if (saldoEl) saldoEl.textContent = fmtKz(fundo + entradas - despesas);
  if (fundoEl) fundoEl.textContent = fmtKz(fundo);
  // Variação vendas hoje vs ontem (honesta: sem baseline → "—")
  const dOntem = new Date();
  dOntem.setDate(dOntem.getDate() - 1);
  const ontemStr = (typeof formatarDataISO === 'function')
    ? formatarDataISO(dOntem)
    : dOntem.getFullYear() + '-' + String(dOntem.getMonth() + 1).padStart(2, '0') + '-' + String(dOntem.getDate()).padStart(2, '0');
  const totalOntem = (typeof getFaturamentoPeriodo === 'function') ? getFaturamentoPeriodo(ontemStr, ontemStr) : 0;
  const variacaoEl = document.getElementById('caixa-variacao');
  if (variacaoEl) {
    if (totalOntem > 0) {
      const variacao = ((entradas - totalOntem) / totalOntem) * 100;
      const subiu = variacao >= 0;
      variacaoEl.textContent = (subiu ? '↑ ' : '↓ ') + Math.abs(variacao).toFixed(0) + '%';
      variacaoEl.style.color = subiu ? 'var(--green)' : 'var(--red)';
    } else if (entradas > 0) {
      variacaoEl.textContent = '↑ novo';
      variacaoEl.style.color = 'var(--green)';
    } else {
      variacaoEl.textContent = '—';
      variacaoEl.style.color = 'var(--text-muted)';
    }
  }

  const periodo = state.histPeriodo || 'hoje';
  const movs = getMovimentosPeriodo(periodo).sort((a, b) => b.data.localeCompare(a.data) || b.hora.localeCompare(a.hora));
  const titEl = document.getElementById('hist-titulo');
  if (titEl) titEl.textContent = (typeof tituloPeriodoCaixa === 'function' ? tituloPeriodoCaixa(periodo) : 'Movimentos');

  const cont = document.getElementById('movimentos-list');
  if (movs.length === 0) { cont.innerHTML = `<div class="empty-state">${svgCarteira}<p>Sem movimentos neste período</p></div>`; return; }
  const MOV_INITIAL = 80;
  const movRow = (m) => {
    const isV = m.tipo === 'venda';
    const nomeProf = typeof getProfissionalNome === 'function' ? getProfissionalNome(m.profissional_id) : '';
    let avatarHtml;
    if (isV) {
      let cli = null;
      try {
        if (m.cliente_id) cli = (state.clientes || []).find(function (c) { return String(c.id) === String(m.cliente_id); });
        if (!cli && m.cliente) {
          var nn = String(m.cliente).toLowerCase().trim();
          cli = (state.clientes || []).find(function (c) { return String(c.nome || '').toLowerCase().trim() === nn; });
        }
      } catch (_) { cli = null; }
      var src = null;
      if (cli) {
        if (window.BPMedia && typeof BPMedia.resolveFotoSrc === 'function') src = BPMedia.resolveFotoSrc(cli);
        else if (cli.foto) src = cli.foto;
        else if (cli.foto_url) src = cli.foto_url;
      }
      if (src) {
        avatarHtml = '<div class="avatar bp-avatar-img"><img src="' + String(src).replace(/"/g, '&quot;') + '" alt="" loading="lazy" decoding="async"></div>';
      } else if (cli && cli.nome) {
        avatarHtml = '<div class="avatar">' + escHtml(String(cli.nome).charAt(0).toUpperCase()) + '</div>';
      } else if (m.cliente) {
        avatarHtml = '<div class="avatar">' + escHtml(String(m.cliente).charAt(0).toUpperCase()) + '</div>';
      } else {
        avatarHtml = '<div class="avatar" style="background:#E6F4EC;color:var(--green);font-size:0;" aria-hidden="true"><span style="display:block;width:8px;height:8px;border-radius:50%;background:currentColor;margin:auto;"></span></div>';
      }
    } else {
      avatarHtml = '<div class="avatar" style="background:#FDE8E8;color:var(--red);font-size:0;" aria-hidden="true"><span style="display:block;width:8px;height:8px;border-radius:50%;background:currentColor;margin:auto;"></span></div>';
    }
    return `
      <div class="list-item${isV ? ' list-item-venda' : ''}" data-id="${m.id}" data-tipo="${m.tipo}" style="padding-right:${isV ? '32px' : '16px'};">
        ${avatarHtml}
        <div class="info">
          <div class="title">${escHtml(m.descricao||'')}</div>
          <div class="sub">${m.data} · ${m.hora || ''}${m.cliente ? ' · ' + escHtml(m.cliente) : ''}${nomeProf ? ' · ' + escHtml(nomeProf) : ''}${m.tipo === 'despesa' && m.categoria ? ' · ' + escHtml(m.categoria) : ''}</div>
        </div>
        <div class="action" style="color:${isV ? 'var(--green)' : 'var(--red)'};">${isV ? '+' : '−'}${fmtKz(Number(m.valor) || 0)}</div>
      </div>`;
  };
  const movFirst = movs.slice(0, MOV_INITIAL);
  cont.innerHTML = movFirst.map(movRow).join('');
  if (movs.length > MOV_INITIAL) {
    const more = document.createElement('div');
    more.style.cssText = 'padding:12px;text-align:center;';
    more.innerHTML = '<button type="button" class="btn btn-secondary btn-sm" id="movs-load-more">Mostrar mais (' + (movs.length - MOV_INITIAL) + ')</button><div id="movs-io-sentinel" style="height:1px;" aria-hidden="true"></div>';
    cont.appendChild(more);
    let off = MOV_INITIAL;
    const movBtn = more.querySelector('#movs-load-more');
    const movSent = more.querySelector('#movs-io-sentinel');
    const loadMoreMovs = function() {
      const next = movs.slice(off, off + MOV_INITIAL);
      off += next.length;
      if (typeof appendRowsHtml === 'function') appendRowsHtml(cont, next.map(movRow)); else next.forEach(m => cont.insertAdjacentHTML('beforeend', movRow(m)));
      cont.appendChild(more);
      if (off >= movs.length) more.remove();
      else this.textContent = 'Mostrar mais (' + (movs.length - off) + ')';
      cont.querySelectorAll('.list-item-venda').forEach(el => {
        el.onclick = () => { if (typeof abrirDetalheVenda === 'function') abrirDetalheVenda(el.dataset.id); };
      });
    };
    if (movBtn) movBtn.onclick = loadMoreMovs;
    if (movSent && typeof observeLoadMore === 'function') observeLoadMore(movSent, function() { if (movBtn && document.body.contains(movBtn)) loadMoreMovs(); });
  }
  cont.querySelectorAll('.list-item-venda').forEach(el => {
    el.onclick = () => { if (typeof abrirDetalheVenda === 'function') abrirDetalheVenda(el.dataset.id); };
  });


  cont.querySelectorAll('.list-item').forEach(el => {
    el.addEventListener('click', e => {
      if (el.dataset.tipo === 'venda') { addRipple(el, e);
        abrirDetalheVenda(el.dataset.id); } else toast('Detalhes disponíveis apenas para vendas', 'warning');
    });
  });
}

function getMovimentosPeriodo(periodo) {
  const hojeStr = hoje();
  const now = new Date();
  const iso = (d) => {
    if (typeof formatarDataISO === 'function') return formatarDataISO(d);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  };
  const list = (state.movimentos && Array.isArray(state.movimentos)) ? state.movimentos : [];
  return list.filter(m => {
    if (periodo === 'hoje') return m.data === hojeStr;
    if (periodo === 'ontem') {
      const d = new Date(now); d.setDate(d.getDate() - 1);
      return m.data === iso(d);
    }
    if (periodo === '7dias') {
      const d7 = new Date(now); d7.setDate(d7.getDate() - 6);
      return m.data >= iso(d7);
    }
    if (periodo === '30dias') {
      const d30 = new Date(now); d30.setDate(d30.getDate() - 29);
      return m.data >= iso(d30);
    }
    if (periodo === '90dias') {
      const d90 = new Date(now); d90.setDate(d90.getDate() - 89);
      return m.data >= iso(d90);
    }
    if (periodo === 'semana') {
      const d = new Date(hojeStr + 'T00:00:00');
      const dia = d.getDay();
      const inicio = new Date(d); inicio.setDate(d.getDate() - dia);
      return m.data >= iso(inicio) && m.data <= hojeStr;
    }
    if (periodo === 'mes') {
      const mes = String(now.getMonth() + 1).padStart(2, '0');
      return m.data.startsWith(now.getFullYear() + '-' + mes);
    }
    if (periodo === 'ano') {
      return m.data.startsWith(String(now.getFullYear()));
    }
    if (periodo === 'dia') {
      const dataExata = localStorage.getItem('bp_caixa_data_exata') || hojeStr;
      return m.data === dataExata;
    }
    if (periodo === 'tudo') return true;
    return true;
  });
}

function tituloPeriodoCaixa(periodo) {
  const map = {
    hoje: 'Movimentos de Hoje',
    ontem: 'Movimentos de Ontem',
    semana: 'Movimentos desta Semana',
    '7dias': 'Últimos 7 dias',
    '30dias': 'Últimos 30 dias',
    '90dias': 'Últimos 90 dias',
    mes: 'Movimentos deste Mês',
    ano: 'Movimentos deste Ano',
    dia: 'Movimentos do dia seleccionado',
    tudo: 'Histórico Completo'
  };
  return map[periodo] || 'Movimentos';
}

function _receitaProfMes(profId) {
  const mes = (typeof hoje === 'function' ? hoje() : '').slice(0, 7);
  if (!mes || !profId) return 0;
  return (state.movimentos || []).filter(m =>
    (typeof BPMetrics !== 'undefined' && BPMetrics.isVendaValida ? BPMetrics.isVendaValida(m) : false) && String(m.profissional_id) === String(profId) && String(m.data || '').startsWith(mes)
  ).reduce((s, m) => s + (Number(m.valor) || 0), 0);
}

function renderProfissionais() {
  const cont = document.getElementById('profissionais-list');
  if (!cont) return;
  const plano = typeof getPlanoAtual === 'function' ? getPlanoAtual() : 'trial';
  const aviso = document.getElementById('plano-aviso');
  if (aviso) aviso.style.display = (plano === 'trial' || plano === 'starter') ? 'block' : 'none';

  const activos = (state.profissionais || []).filter(function (p) {
    return typeof isProfissionalAtivo === 'function' ? isProfissionalAtivo(p) : (p.ativo !== false);
  });
  if (!activos.length) {
    cont.innerHTML = `<div class="empty-state">${typeof svgPessoas !== 'undefined' ? svgPessoas : ''}<p>Ainda sem profissionais — adicione o primeiro</p></div>`;
    return;
  }
  const profissionaisOrdenados = [...activos].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt'));
  cont.innerHTML = profissionaisOrdenados.map(p => {
    const receita = _receitaProfMes(p.id);
    const meta = Number(p.meta_mensal != null ? p.meta_mensal : p.meta) || 0;
    let statExtra = '';
    if (meta > 0) {
      const pct = Math.min(100, Math.round((receita / meta) * 100));
      statExtra = `<span class="cliente-stat">${pct}% meta</span>`;
    } else if (receita > 0) {
      statExtra = `<span class="cliente-stat cliente-stat--gasto">${fmtKz(receita)}</span>`;
    }
    const contacto = p.contacto ? String(p.contacto).replace(/\D/g, '') : '';
    return `
    <div class="list-item" data-prof-id="${p.id}" style="cursor:pointer;">
      <div class="avatar">${escHtml((p.nome || '?').charAt(0).toUpperCase())}</div>
      <div class="info">
        <div class="title">${escHtml(p.nome || 'Profissional')}</div>
        <div class="sub">${escHtml(p.especialidade || 'Sem especialidade')}${contacto ? ' · ' + escHtml(contacto) : ''}</div>
        <div class="cliente-stats">
          ${statExtra}
          ${p.taxa_comissao != null || p.taxa != null ? `<span class="cliente-stat">${Number(p.taxa_comissao != null ? p.taxa_comissao : p.taxa) || 0}%</span>` : ''}
          ${typeof renderBarraMeta === 'function' ? renderBarraMeta(p.id) : ''}
        </div>
      </div>
      <div class="actions">
        <button class="row-menu-btn" data-action="row-menu" data-tipo="profissional" data-id="${p.id}" data-role="admin" aria-label="Mais ações" aria-haspopup="menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="12" cy="19" r="1.75"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

function renderServicos() {
  const container = document.getElementById('servicos-list');
  if (!container) return;
  const servicosActivos = (state.servicos || []).filter(function (s) {
    return typeof isServicoAtivo === 'function' ? isServicoAtivo(s) : (s.ativo !== false);
  });
  if (!servicosActivos.length) {
    container.innerHTML = `<div class="empty-state">${typeof svgTesoura !== 'undefined' ? svgTesoura : ''}<p>Ainda sem serviços — adicione o primeiro</p></div>`;
    return;
  }
  const servicosOrdenados = [...servicosActivos].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt'));
  container.innerHTML = servicosOrdenados.map(s => {
    const profs = (function () {
      const arr = s.profissionais || [];
      if (!arr.length) return 'Sem profissionais associados';
      return arr.map(function (x) {
        const byId = (state.profissionais || []).find(function (p) { return p.id === x; });
        if (byId) return byId.nome;
        return x;
      }).join(', ');
    })();
    return `
      <div class="list-item" data-servico-id="${s.id}" style="cursor:pointer;">
        <div class="avatar bp-servico-avatar" aria-hidden="true"><svg class="bp-servico-ic" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-opacity="0.14" d="M12 3.8c.35 0 .68.14.92.39l6.9 6.9a1.3 1.3 0 0 1 0 1.84l-6.9 6.9a1.3 1.3 0 0 1-1.84 0l-6.9-6.9a1.3 1.3 0 0 1 0-1.84l6.9-6.9c.24-.25.57-.39.92-.39z"/><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" d="M12 5.2 L18.3 11.5 a.7.7 0 0 1 0 1 L12 18.8 a.7.7 0 0 1-1 0 L4.7 12.5 a.7.7 0 0 1 0-1 L11 5.2 a.7.7 0 0 1 1 0z"/></svg></div>
        <div class="info">
          <div class="title">${escHtml(s.nome)}</div>
          <div class="sub">${fmtKz(Number(s.precoBase) || 0)} · ${Number(s.duracao || s.duracaoMin || s.minutos || 60) || 60} min · ${escHtml(profs)}</div>
        </div>
        <div class="actions">
          <button class="row-menu-btn" data-action="row-menu" data-tipo="servico" data-id="${s.id}" data-role="admin" aria-label="Mais ações" aria-haspopup="menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="12" cy="19" r="1.75"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// renderBadges: a única declaração válida está em ui-render-dashboard-agenda.js
// (conta agendamentos futuros/pendentes em todos os dias, não só hoje). Esta
// cópia antiga foi removida — carregava depois e estava a ganhar sempre,
// travando o indicador num valor desatualizado.

// ====================================================================
//  SETUP DE PRECIFICAÇÃO E SELECTS
// ====================================================================
function setupPrecoAutomatico(selectId, inputPrecoId) {
  const select = document.getElementById(selectId);
  const inputPreco = document.getElementById(inputPrecoId);
  if (!select || !inputPreco) return;
  if (select._precoHandler) select.removeEventListener('change', select._precoHandler);
  const handler = () => {
    const nome = select.value;
    if (!nome || nome === 'Outro' || nome === '__custom') {
      inputPreco.value = '';
      inputPreco.disabled = false;
      inputPreco.style.opacity = '1';
      return;
    }
    const serv = state.servicos.find(s => s.nome === nome);
    if (serv) {
      inputPreco.value = serv.precoBase;
      inputPreco.disabled = true;
      inputPreco.style.opacity = '0.7';
    } else {
      inputPreco.value = '';
      inputPreco.disabled = false;
      inputPreco.style.opacity = '1';
    }
  };
  select._precoHandler = handler;
  select.addEventListener('change', handler);
  handler();
}

function populateAgendaSelects() {
  const profSel = document.getElementById('agenda-profissional');
  const servSel = document.getElementById('agenda-servico');
  if (!profSel || !servSel) return;

  // Verificar se há serviços ativos
  var _servActivosEmpty = (typeof getServicosAtivos === 'function')
    ? getServicosAtivos()
    : (state.servicos || []).filter(function (s) {
        return typeof isServicoAtivo === 'function' ? isServicoAtivo(s) : (s && s.ativo !== false);
      });
  if (!_servActivosEmpty.length) {
    servSel.innerHTML = '<option value="">Nenhum serviço disponível</option>';
    profSel.innerHTML = '<option value="">Nenhum profissional disponível</option>';
    return;
  }

  const prevServico = servSel.value;
  // ET4.2-P1-03: só serviços ativos nos selects de agenda/venda
  var servicosParaSelect = (typeof getServicosAtivos === 'function')
    ? getServicosAtivos()
    : (state.servicos || []).filter(function (s) {
        return typeof isServicoAtivo === 'function' ? isServicoAtivo(s) : (s && s.ativo !== false);
      });
  servSel.innerHTML = '<option value="">Seleccionar serviço</option>' + servicosParaSelect.map(s =>
    `<option value="${escHtml(s.nome)}">${escHtml(s.nome)}</option>`
  ).join('');
  if (prevServico) servSel.value = prevServico;

  const filtrarProfsAgenda = (servicoNome) => {
    // Se não houver profissionais, mostrar opção vazia
    const activos = (state.profissionais || []).filter(function (p) {
      return typeof isProfissionalAtivo === 'function' ? isProfissionalAtivo(p) : (p.ativo !== false);
    });
    if (activos.length === 0) {
      profSel.innerHTML = '<option value="">Nenhum profissional disponível</option>';
      return;
    }

    let profs;
    if (!servicoNome) {
      profs = [];
    } else {
      const serv = state.servicos.find(s => s.nome === servicoNome);
      const nomes = (serv && Array.isArray(serv.profissionais)) ? serv.profissionais : [];
      if (!nomes.length) {
        profs = [];
      } else {
        profs = activos
          .filter(p => nomes.includes(p.nome) || nomes.includes(p.id))
          .map(p => ({ id: p.id, nome: p.nome }));
      }
    }
    const prevProfId = profSel.value;
    profSel.innerHTML = '<option value="">Seleccionar profissional</option>' + profs.map(p =>
      `<option value="${p.id}">${escHtml(p.nome)}</option>`
    ).join('');
    if (profs.some(p => p.id === prevProfId)) profSel.value = prevProfId;
  };

  filtrarProfsAgenda(servSel.value);
  if (servSel._filterHandler) servSel.removeEventListener('change', servSel._filterHandler);
  servSel._filterHandler = function() { filtrarProfsAgenda(this.value); };
  servSel.addEventListener('change', servSel._filterHandler);
}

function populateVendaSelects() {
  const profSel = document.getElementById('venda-profissional');
  const catSel = document.getElementById('ci-servico-sel');
  if (!profSel || !catSel) return;

  // Verificar se há serviços
  const servicosActivos = (state.servicos || []).filter(function (s) {
    return typeof isServicoAtivo === 'function' ? isServicoAtivo(s) : (s.ativo !== false);
  });
  if (servicosActivos.length === 0) {
    catSel.innerHTML = '<option value="">Nenhum serviço disponível</option>';
    profSel.innerHTML = '<option value="">Nenhum profissional disponível</option>';
    return;
  }

  catSel.selectedIndex = -1;

  catSel.innerHTML = `<option value="">Selecionar serviço</option>` +
    servicosActivos.map(s =>
      `<option value="${escHtml(s.nome)}" data-preco="${s.precoBase}">${escHtml(s.nome)}</option>`
    ).join('');

  const filtrarProfsVenda = (servicoNome) => {
    // Se não houver profissionais, mostrar opção vazia
    const activos = (state.profissionais || []).filter(function (p) {
      return typeof isProfissionalAtivo === 'function' ? isProfissionalAtivo(p) : (p.ativo !== false);
    });
    if (activos.length === 0) {
      profSel.innerHTML = '<option value="">Nenhum profissional disponível</option>';
      return;
    }

    let profs;
    if (!servicoNome) {
      // R03: sem serviço seleccionado, não listar profissionais genéricos
      profs = [];
    } else {
      const serv = state.servicos.find(s => s.nome === servicoNome);
      const nomes = (serv && Array.isArray(serv.profissionais)) ? serv.profissionais : [];
      if (!nomes.length) {
        profs = [];
      } else {
        profs = activos
          .filter(p => nomes.includes(p.nome) || nomes.includes(p.id))
          .map(p => ({ id: p.id, nome: p.nome }));
      }
    }
    profSel.innerHTML = `<option value="">Seleccionar profissional</option>` +
      profs.map(p =>
        `<option value="${p.id}">${escHtml(p.nome)}</option>`
      ).join('');
  };

  if (catSel._filterHandler) catSel.removeEventListener('change', catSel._filterHandler);
  catSel._filterHandler = function() {
    filtrarProfsVenda(this.value);
    const opt = this.options[this.selectedIndex];
    const ciValor = document.getElementById('ci-valor');
    if (opt && opt.dataset.preco) {
      if (ciValor) { ciValor.value = opt.dataset.preco; ciValor.disabled = true; ciValor.style.opacity = '0.7'; }
    } else {
      if (ciValor) { ciValor.value = ''; ciValor.disabled = false; ciValor.style.opacity = '1'; }
    }
  };
  catSel.addEventListener('change', catSel._filterHandler);
}

