/* BelezaPro — modules/servicos — render + selects agenda/venda */
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
      <div class="list-item" data-servico-id="${escHtml(s.id)}" style="cursor:pointer;">
        <div class="avatar bp-servico-avatar" aria-hidden="true">SRV</div>
        <div class="info">
          <div class="title">${escHtml(s.nome)}</div>
          <div class="sub">${fmtKz(Number(s.precoBase) || 0)} · ${Number(s.duracao || s.duracaoMin || s.minutos || 60) || 60} min · ${escHtml(profs)}</div>
        </div>
        <div class="actions">
          <button class="row-menu-btn" data-action="row-menu" data-tipo="servico" data-id="${escHtml(s.id)}" data-role="admin" aria-label="Mais ações" aria-haspopup="menu">
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
      `<option value="${escHtml(p.id)}">${escHtml(p.nome)}</option>`
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
      `<option value="${escHtml(s.nome)}" data-preco="${escHtml(String(s.precoBase != null ? s.precoBase : ''))}">${escHtml(s.nome)}</option>`
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
        `<option value="${escHtml(p.id)}">${escHtml(p.nome)}</option>`
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

if (typeof window !== 'undefined') {
  window.renderServicos = renderServicos;
  window.renderServicos._bpOwner = 'modules/servicos';
  window.setupPrecoAutomatico = setupPrecoAutomatico;
  window.populateAgendaSelects = populateAgendaSelects;
  window.populateVendaSelects = populateVendaSelects;
}
