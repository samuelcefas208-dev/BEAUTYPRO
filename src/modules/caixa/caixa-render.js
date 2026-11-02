/* BelezaPro — modules/caixa — render movimentos e período */
function renderCaixa() {
  if (!state.movimentos || !Array.isArray(state.movimentos)) {
    const cont0 = document.getElementById('movimentos-list');
    if (cont0) cont0.innerHTML = '<div class="empty-state">A carregar movimentos...</div>';
    return;
  }
  const hojeStr = hoje();
  const _num = (v) => Number(v) || 0;
  const entradas = (typeof getFaturamentoPeriodo === 'function')
    ? getFaturamentoPeriodo(hojeStr, hojeStr)
    : 0;
  const _despHoje = state.movimentos.filter(function (m) { return m.data === hojeStr && m.tipo === 'despesa'; });
  const despesas = (typeof BPMetrics !== 'undefined' && BPMetrics.somarValor)
    ? BPMetrics.somarValor(_despHoje)
    : _despHoje.reduce(function (s, m) { return s + _num(m.valor); }, 0);
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
  const totalOntem = (typeof getFaturamentoPeriodo === 'function')
    ? getFaturamentoPeriodo(ontemStr, ontemStr)
    : 0;
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
        var _safe = (typeof bpSafeImgSrc === 'function') ? bpSafeImgSrc(src) : '';
        if (_safe) {
          avatarHtml = '<div class="avatar bp-avatar-img"><img src="' + _safe + '" alt="" loading="lazy" decoding="async"></div>';
        }
      }
      if (!avatarHtml) {
        var def = (window.BPAvatars && (BPAvatars.defaultSrc || (BPAvatars.avatarDataUrl && BPAvatars.avatarDataUrl()))) || '';
        if (def) {
          avatarHtml = '<div class="avatar bp-avatar-img"><img src="' + def + '" alt="" loading="lazy" decoding="async"></div>';
        } else {
          avatarHtml = '<div class="avatar" style="background:#E8E6E1;" aria-hidden="true"></div>';
        }
      }
    } else {
      avatarHtml = '<div class="avatar" style="background:#FDE8E8;color:var(--red);font-size:0;" aria-hidden="true"><span style="display:block;width:8px;height:8px;border-radius:50%;background:currentColor;margin:auto;"></span></div>';
    }
    return `
      <div class="list-item${isV ? ' list-item-venda' : ''}" data-id="${escHtml(m.id)}" data-tipo="${escHtml(m.tipo || '')}" style="padding-right:${isV ? '32px' : '16px'};">
        ${avatarHtml}
        <div class="info">
          <div class="title">${escHtml(m.descricao||'')}</div>
          <div class="sub">${escHtml(m.data || '')} · ${escHtml(m.hora || '')}${m.cliente ? ' · ' + escHtml(m.cliente) : ''}${nomeProf ? ' · ' + escHtml(nomeProf) : ''}${m.tipo === 'despesa' && m.categoria ? ' · ' + escHtml(m.categoria) : ''}</div>
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
  /* Ponto 2: mesmos intervalos que o Resumo (calcularIntervaloPeriodo). */
  const hojeStr = hoje();
  const list = (state.movimentos && Array.isArray(state.movimentos)) ? state.movimentos : [];
  if (periodo === 'tudo') return list.slice();
  if (periodo === 'custom') {
    var deC = localStorage.getItem('bp_caixa_custom_de') || '';
    var ateC = localStorage.getItem('bp_caixa_custom_ate') || '';
    if (!deC || !ateC) return [];
    return list.filter(function (m) { return m && m.data >= deC && m.data <= ateC; });
  }
  if (periodo === 'dia') {
    var dataExata = localStorage.getItem('bp_caixa_data_exata') || hojeStr;
    return list.filter(function (m) { return m && m.data === dataExata; });
  }
  if (periodo === 'ontem') {
    if (typeof calcularIntervaloPeriodo === 'function') {
      var ivOnt = calcularIntervaloPeriodo('dia', 1);
      return list.filter(function (m) { return m && m.data >= ivOnt.inicio && m.data <= ivOnt.fim; });
    }
  }
  var tipo = periodo === 'hoje' ? 'dia' : periodo;
  if (typeof calcularIntervaloPeriodo === 'function') {
    var iv = calcularIntervaloPeriodo(tipo, 0);
    if (iv && iv.inicio && iv.fim) {
      return list.filter(function (m) {
        if (!m || !m.data) return false;
        return m.data >= iv.inicio && m.data <= iv.fim;
      });
    }
  }
  /* Fallback mínimo se motor de intervalo ainda não carregou */
  if (periodo === 'hoje') return list.filter(function (m) { return m && m.data === hojeStr; });
  return list.slice();
}

function tituloPeriodoCaixa(periodo) {
  if (periodo === 'tudo') return 'Histórico completo';
  if (periodo === 'custom') {
    var deC = localStorage.getItem('bp_caixa_custom_de') || '';
    var ateC = localStorage.getItem('bp_caixa_custom_ate') || '';
    if (deC && ateC) return 'Personalizado · ' + deC + ' – ' + ateC;
    return 'Personalizado';
  }
  if (periodo === 'dia') {
    var dataExata = localStorage.getItem('bp_caixa_data_exata') || (typeof hoje === 'function' ? hoje() : '');
    return 'Dia · ' + dataExata;
  }
  var tipo = periodo === 'hoje' ? 'dia' : (periodo === 'ontem' ? 'dia' : periodo);
  var off = periodo === 'ontem' ? 1 : 0;
  if (typeof calcularIntervaloPeriodo === 'function') {
    var iv = calcularIntervaloPeriodo(tipo, off);
    if (iv) return 'Movimentos · ' + (iv.labelComDatas || iv.label || periodo);
  }
  const map = {
    hoje: 'Movimentos de hoje',
    ontem: 'Movimentos de ontem',
    semana: 'Movimentos desta semana',
    '7dias': 'Últimos 7 dias',
    '30dias': 'Últimos 30 dias',
    '90dias': 'Últimos 90 dias',
    mes: 'Movimentos deste mês',
    ano: 'Movimentos deste ano'
  };
  return map[periodo] || 'Movimentos';
}

if (typeof window !== 'undefined') {
  window.getMovimentosPeriodo = getMovimentosPeriodo;
  window.tituloPeriodoCaixa = tituloPeriodoCaixa;
  window.renderCaixa = renderCaixa;
  window.renderCaixa._bpOwner = 'modules/caixa';
}
