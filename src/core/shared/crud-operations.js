/* BelezaPro D-5.6 — core/crud-operations.js
 * Extraído de app.bundle.js (FILE: crud-operations.js) — ÚLTIMA fatia do monólito core.
 *
 * ORDEM OBRIGATÓRIA:
 *   constants → utils → state → store
 *   → db-indexeddb → resilience → auth
 *   → sync-queue → sync-rest
 *   → plano-limites          (verificarLimite)
 *   → crud-operations        ← este ficheiro
 *
 * Depende de: state, BeautyStore, dbPut/dbGetAll, fila, REST, toast, uuid, hoje,
 *   verificarLimite, garantirSalaoRemoto, updateUI (UI — runtime typeof).
 *
 * NÃO altera regras de negócio — apenas move o ficheiro e expõe window.*.
 *
 * Ver docs/D5_6_CRUD_OPERATIONS.md
 */

// ====================================================================
//  crud-operations.js — Fase C + Fase D (melhorias de robustez)
//  Carregar depois de core-*.js, core-store.js, db-indexeddb.js,
//  sync-*.js, auth-supabase.js, plano-limites.js
// ====================================================================

// ====================================================================
//  VALIDAÇÃO DE DUPLICADOS (local)
// ====================================================================
function existeNomeDuplicado(tabela, nome, idIgnorar = null) {
  const lista = state[tabela] || [];
  const nomeNormalizado = (nome || '').trim().toLowerCase();
  if (!nomeNormalizado) return false;
  return lista.some(item =>
    item.nome && item.nome.trim().toLowerCase() === nomeNormalizado &&
    (idIgnorar ? item.id !== idIgnorar : true)
  );
}

async function detetarTrocaDeSalao(novoSalaoId) {
  const configs = await dbGetAll('config');
  const salaoIdCache = configs.find(c => c.key === 'salaoId');
  const anterior = salaoIdCache ? salaoIdCache.value : null;
  return !!(anterior && novoSalaoId && anterior !== novoSalaoId);
}

async function loadState(trocouDeSalao = false) {
  const configs = await dbGetAll('config');

  const cfg = configs.find(c => c.key === 'storeName');
  const fund = configs.find(c => c.key === 'fundo');
  const plano = configs.find(c => c.key === 'plano');
  const trialInicio = configs.find(c => c.key === 'trialInicio');

  // Mutação directa mantida por compatibilidade; Store notifica se existir
  state.config.storeName = cfg ? cfg.value : 'Glamour Beauty';
  state.config.fundo = fund ? Number(fund.value) : 0;
  state.config.plano = plano ? plano.value : (function () {
    try {
      var sid = null;
      try {
        var row = (configs || []).find(function (c) { return c && (c.key === 'salaoId' || c.id === 'salaoId'); });
        sid = row && row.value;
      } catch (_) {}
      if (!sid) {
        try { sid = localStorage.getItem('bp_salao_id_cache'); } catch (_) {}
      }
      if (sid) {
        var ns = localStorage.getItem('bp_plano_cache_' + sid);
        if (ns) return ns;
      }
      // legacy fallback só se ainda existir
      return localStorage.getItem('bp_plano_cache') || 'trial';
    } catch (_) { return 'trial'; }
  })();
  state.config.trialInicio = trialInicio ? trialInicio.value : null;

  let clientes, agendamentos, movimentos, profs, servicos, fechos;
  if (trocouDeSalao) {
    var anteriorSalaoId = null;
    try {
      var _sidRow = (configs || []).find(function (c) { return c && (c.key === 'salaoId' || c.id === 'salaoId'); });
      anteriorSalaoId = _sidRow ? _sidRow.value : null;
    } catch (_) {}
    await Promise.all(['clientes', 'agendamentos', 'movimentos', 'profissionais', 'servicos', 'fechos_caixa'].map(dbClear));
    localStorage.removeItem(SYNC_QUEUE_KEY);
    try { localStorage.removeItem('bp_deleted_items'); } catch (_) {}
    // Isolamento multi-tenant: plano, contadores IA, histórico do salão anterior
    try {
      localStorage.removeItem('bp_plano_cache');
      if (anteriorSalaoId) {
        localStorage.removeItem('bp_plano_cache_' + anteriorSalaoId);
        localStorage.removeItem('bp_ia_historico_' + anteriorSalaoId);
        localStorage.removeItem('bp_ia_chat_' + anteriorSalaoId);
        var _rm = [];
        for (var _i = 0; _i < localStorage.length; _i++) {
          var _k = localStorage.key(_i);
          if (_k && _k.indexOf('ia_perguntas_' + anteriorSalaoId + '_') === 0) _rm.push(_k);
        }
        _rm.forEach(function (k) { try { localStorage.removeItem(k); } catch (_) {} });
      } else {
        // Sem id anterior: limpar todos os namespaces de plano/IA conhecidos
        var _rm2 = [];
        for (var _j = 0; _j < localStorage.length; _j++) {
          var _k2 = localStorage.key(_j);
          if (_k2 && (
            _k2.indexOf('bp_plano_cache_') === 0 ||
            _k2.indexOf('bp_ia_historico_') === 0 ||
            _k2.indexOf('bp_ia_chat_') === 0 ||
            _k2.indexOf('ia_perguntas_') === 0
          )) _rm2.push(_k2);
        }
        _rm2.forEach(function (k) { try { localStorage.removeItem(k); } catch (_) {} });
      }
    } catch (_) {}
    try {
      if (typeof window !== 'undefined') {
        if (typeof iaHistorico !== 'undefined') iaHistorico = [];
        window.iaHistorico = [];
      }
    } catch (_) {}
    // Preferências e resíduos do salão anterior (P2)
    ['bp_filtro_clientes','bp_chart_periodo','bp_chart_offset','bp_chart_mostrar_valores',
     'bp_hist_periodo','bp_caixa_data_exata','bp_carrinho','bp_last_venda_id','bp_cart_items'].forEach(k => {
      try { localStorage.removeItem(k); } catch (_) {}
    });
    try {
      if (typeof clearCartStorageAll === 'function') clearCartStorageAll();
      else {
        for (var i = localStorage.length - 1; i >= 0; i--) {
          var ck = localStorage.key(i);
          if (ck && ck.indexOf('bp_cart_items') === 0) localStorage.removeItem(ck);
        }
      }
    } catch (_) {}
    try { sessionStorage.removeItem('bp_last_venda_id'); } catch (_) {}
    state.histPeriodo = 'hoje';
    state.filtroClientes = 'todos';
    state.chartPeriodo = 'semana';
    state.chartOffset = 0;
    clientes = []; agendamentos = []; movimentos = []; profs = []; servicos = []; fechos = [];
    // Purity: não herdar plano do IDB do salão anterior
    try {
      var _novoSid = state.config && state.config.salaoId;
      var _planoNovo = 'trial';
      if (_novoSid) {
        var _nsP = localStorage.getItem('bp_plano_cache_' + _novoSid);
        if (_nsP) _planoNovo = _nsP;
      }
      state.config.plano = _planoNovo;
      if (typeof dbPut === 'function') {
        Promise.resolve(dbPut('config', { id: 'plano', key: 'plano', value: _planoNovo })).catch(function () {});
      }
    } catch (_) {
      state.config.plano = 'trial';
    }
    try {
      if (typeof bpResetIaHistorico === 'function') bpResetIaHistorico();
      else {
        if (typeof iaHistorico !== 'undefined') iaHistorico = [];
        if (typeof window !== 'undefined') window.iaHistorico = [];
      }
      if (typeof carregarHistoricoIA === 'function') carregarHistoricoIA();
    } catch (_) {}
    console.warn('[BeautyPro] Troca de salão detetada — dados locais, fila e preferências limpos.');
  } else {
    const [clientesData, agendamentosData, movimentosData, profsData, servicosData, fechosData] = await Promise.all([
      dbGetAll('clientes'),
      dbGetAll('agendamentos'),
      dbGetAll('movimentos'),
      dbGetAll('profissionais'),
      dbGetAll('servicos'),
      dbGetAll('fechos_caixa'),
    ]);
    clientes = clientesData;
    agendamentos = agendamentosData;
    movimentos = movimentosData;
    profs = profsData;
    servicos = servicosData;
    fechos = fechosData;
  }

  const safe = (arr) => Array.isArray(arr) ? arr : [];
  state.clientes = safe(clientes);
  state.agendamentos = safe(agendamentos);
  try {
    if (typeof bpCheckExpiringAppointments === 'function') {
      setTimeout(function () { bpCheckExpiringAppointments(); }, 600);
    }
  } catch (_) {}
  state.movimentos = safe(movimentos);
  state.profissionais = safe(profs);
  state.servicos = safe(servicos);
  state.fechos_caixa = safe(fechos);

  const chartPeriodo = localStorage.getItem('bp_chart_periodo') || 'semana';
  const chartOffset = parseInt(localStorage.getItem('bp_chart_offset')) || 0;
  const chartMostrarValores = localStorage.getItem('bp_chart_mostrar_valores') === 'true';
  const filtroClientes = localStorage.getItem('bp_filtro_clientes') || 'todos';
  state.filtroClientes = filtroClientes;
  state.chartPeriodo = chartPeriodo;
  state.chartOffset = chartOffset;
  state.chartMostrarValores = chartMostrarValores;

  if (!state.config.trialInicio) {
    state.config.trialInicio = hoje();
    state.config.plano = 'trial';
    await dbPut('config', { id: 'trialInicio', key: 'trialInicio', value: state.config.trialInicio });
    await dbPut('config', { id: 'plano', key: 'plano', value: 'trial' });
  }

  if (state.profissionais.length === 0) {
    console.log('[loadState] Nenhum profissional encontrado. Criação automática desativada.');
  }
  if (state.servicos.length === 0) {
    console.log('[loadState] Nenhum serviço encontrado. Criação automática desativada.');
  }

  if (state.config.salaoId && navigator.onLine) {
    await garantirSalaoRemoto();
    const carregouRemoto = await carregarDoSupabase();
    if (carregouRemoto) await flushSyncQueue();
  }

  // Notificar Store se disponível
  if (window.BeautyStore && typeof window.BeautyStore.setState === 'function') {
    window.BeautyStore.setState({ ...state });
  }

  updateUI();
  if (typeof renderBadges === 'function') renderBadges();
}

async function saveConfig() {
  await dbPut('config', { id: 'storeName', key: 'storeName', value: state.config.storeName });
  await dbPut('config', { id: 'fundo', key: 'fundo', value: state.config.fundo });
  await dbPut('config', { id: 'plano', key: 'plano', value: state.config.plano });
  try {
    if (state.config.plano && state.config.salaoId) {
      localStorage.setItem('bp_plano_cache_' + state.config.salaoId, state.config.plano);
    }
    localStorage.removeItem('bp_plano_cache');
  } catch (_) {}
  await dbPut('config', { id: 'trialInicio', key: 'trialInicio', value: state.config.trialInicio });
  if (state.config.salaoId) {
    await dbPut('config', { id: 'salaoId', key: 'salaoId', value: state.config.salaoId });
  }
}

// ====================================================================
//  HELPER — DELETE OPTIMISTA COM ROLLBACK
// ====================================================================
/**
 * FASE 1 — Soft-delete universal (nunca remove a linha no servidor).
 * Mantém o registo no estado/IDB com ativo=false + deleted_at.
 * Listas activas (bpClientesActivos, isProfissionalAtivo, …) filtram.
 */
async function _deleteComRollback(tabela, id, nomeEntidade) {
  const lista = state[tabela] || [];
  const itemOriginal = lista.find(item => item.id === id);
  if (!itemOriginal) {
    toast((nomeEntidade || 'Registo') + ' não encontrado(a).', 'warning');
    return false;
  }

  const now = new Date().toISOString();
  const soft = Object.assign({}, itemOriginal, {
    ativo: false,
    deleted_at: now,
    updated_at: now
  });
  if (tabela === 'profissionais' && !soft.data_desativacao) soft.data_desativacao = now;
  if (tabela === 'agendamentos' && (!soft.status || soft.status === 'agendado')) soft.status = 'cancelado';
  if (tabela === 'movimentos' && (!soft.status || soft.status === 'activo')) {
    soft.status = 'cancelado';
    soft.cancelado_em = now.slice(0, 10);
  }

  // Local: update in-place (não remove da lista — histórico preservado)
  if (window.BeautyStore && window.BeautyStore.updateInList) {
    window.BeautyStore.updateInList(tabela, id, soft);
  } else {
    const idx = (state[tabela] || []).findIndex(item => item.id === id);
    if (idx !== -1) state[tabela][idx] = soft;
  }
  try {
    await dbPut(tabela, soft);
  } catch (e) {
    console.warn('[soft-delete] dbPut', e);
  }

  // Remoto: soft (dbPut já enfileira upsert; reforço explícito)
  var remotoOk = false;
  try {
    if (navigator.onLine && state.config && state.config.salaoId) {
      if (typeof supabaseSoftDelete === 'function') {
        await supabaseSoftDelete(tabela, id, soft);
        remotoOk = true;
      } else if (typeof supabaseDeactivate === 'function') {
        await supabaseDeactivate(tabela, id, soft);
        remotoOk = true;
      }
      if (typeof flushSyncQueue === 'function') {
        try { await flushSyncQueue(); } catch (_) {}
      }
    }
  } catch (e) {
    console.warn('[soft-delete] remoto', e);
  }
  if (!remotoOk && typeof addToSyncQueue === 'function') {
    try { addToSyncQueue(tabela, 'upsert', soft); } catch (_) {}
  }

  if (typeof updateUI === 'function') updateUI();
  if (typeof renderBadges === 'function') renderBadges();
  if (typeof atualizarIndicadorSync === 'function') atualizarIndicadorSync();

  if (remotoOk || (navigator.onLine && state.config && state.config.salaoId)) {
    toast((nomeEntidade || 'Registo') + ' removido(a).', 'success');
  } else {
    toast((nomeEntidade || 'Registo') + ' removido(a) neste dispositivo. Será sincronizado quando houver rede.', 'warning');
  }
  return true;
}

// ====================================================================
//  CRUD — CLIENTE
// ====================================================================

// ====================================================================
//  FIDELIDADE — pontos e níveis (1 ponto / 1000 Kz)
// ====================================================================
var BP_PONTOS_POR_KZ = 1000;

function calcularPontosVenda(valor) {
  var v = Number(valor) || 0;
  if (v <= 0) return 0;
  return Math.floor(v / BP_PONTOS_POR_KZ);
}

function getClienteTier(pontos) {
  var p = Number(pontos) || 0;
  if (p >= 300) return { id: 'ouro', label: 'Ouro', min: 300 };
  if (p >= 100) return { id: 'prata', label: 'Prata', min: 100 };
  return { id: 'bronze', label: 'Bronze', min: 0 };
}

async function creditarPontosCliente(clienteId, pontos) {
  if (!clienteId || !pontos || pontos <= 0) return null;
  var c = (state.clientes || []).find(function (x) { return x.id === clienteId; });
  if (!c) return null;
  var next = (Number(c.pontos) || 0) + pontos;
  // update directo para não disparar rename / side-effects pesados
  var data = { pontos: next, updated_at: new Date().toISOString() };
  if (window.BeautyStore && window.BeautyStore.updateInList) {
    window.BeautyStore.updateInList('clientes', clienteId, data);
  } else {
    var i = state.clientes.findIndex(function (x) { return x.id === clienteId; });
    if (i === -1) return null;
    state.clientes[i] = Object.assign({}, state.clientes[i], data);
  }
  var item = (state.clientes || []).find(function (x) { return x.id === clienteId; });
  if (item) {
    try { await dbPut('clientes', item); } catch (e) {}
  }
  return next;
}


/** R46 — telefone obrigatório: exactamente 9 dígitos e começa por 9. */
function bpValidarTelefoneCliente(tel) {
  var digits = String(tel == null ? '' : tel).replace(/\D/g, '');
  if (!digits || digits.length !== 9 || digits.charAt(0) !== '9') {
    return {
      ok: false,
      message: 'O contacto deve ter 9 dígitos e começar por 9 (ex.: 923456789). Corrija o número para continuar.'
    };
  }
  return { ok: true, telefone: digits };
}
if (typeof window !== 'undefined') {
  window.bpValidarTelefoneCliente = bpValidarTelefoneCliente;
}

/** R48 — clientes utilizáveis em novas operações. */
function bpClientesActivos() {
  return (typeof state !== 'undefined' && state.clientes ? state.clientes : []).filter(function (c) {
    if (!c || !c.nome) return false;
    if (c.ativo === false || c.ativo === 0 || c.ativo === 'false') return false;
    if (c.deleted_at) return false;
    return true;
  });
}
if (typeof window !== 'undefined') window.bpClientesActivos = bpClientesActivos;

async function addCliente(c) {
  if (!verificarLimite('clientes')) return null;
  const nome = (c.nome || '').trim();
  if (!nome) { toast('Introduz o nome.', 'warning'); return null; }

  // R46 — telefone obrigatório (camada de negócio)
  var telCheck = typeof bpValidarTelefoneCliente === 'function'
    ? bpValidarTelefoneCliente(c && c.telefone)
    : { ok: false, message: 'O contacto deve ter 9 dígitos e começar por 9 (ex.: 923456789). Corrija o número para continuar.' };
  if (!telCheck.ok) {
    toast(telCheck.message || 'Informe um número de telefone válido com 9 dígitos e iniciado por 9.', 'warning');
    return null;
  }

  // R47
  if (existeNomeDuplicado('clientes', nome)) {
    if (typeof bpInfoEntendi === 'function') {
      bpInfoEntendi(
        'Já existe um cliente com este nome. Adicione o sobrenome ou outros dados para identificar corretamente o cliente.',
        'Registo já existente'
      );
    } else if (typeof toast === 'function') {
      toast('Já existe um cliente com este nome. Adicione o sobrenome ou outros dados para identificar corretamente o cliente.', 'error');
    }
    return null;
  }

  const n = { ...c, id: uuid(), nome, telefone: telCheck.telefone, pontos: Number(c.pontos) || 0 };
  try {
    await dbPut('clientes', n);
    if (window.BeautyStore && window.BeautyStore.pushToList) {
      window.BeautyStore.pushToList('clientes', n);
    } else {
      state.clientes.push(n);
      updateUI();
    }
    toast('Cliente adicionado.', 'success');
    return n;
  } catch (err) {
    if (err.message === 'LIMITE_PLANO_ATINGIDO') {
      mostrarModalUpgrade('Limite de clientes atingido. Faça upgrade para continuar.');
      return null;
    }
    throw err;
  }
}

async function updateCliente(id, data) {
  const actual = (state.clientes || []).find(c => c.id === id);
  if (!actual) return null;

  if (data && Object.prototype.hasOwnProperty.call(data, 'telefone')) {
    var telU = typeof bpValidarTelefoneCliente === 'function'
      ? bpValidarTelefoneCliente(data.telefone)
      : { ok: false };
    if (!telU.ok) {
      toast((telU && telU.message) || 'Informe um número de telefone válido com 9 dígitos e iniciado por 9.', 'warning');
      return null;
    }
    data = Object.assign({}, data, { telefone: telU.telefone });
  }

  if (data.nome) {
    const nome = data.nome.trim();
    data = { ...data, nome };
    if (existeNomeDuplicado('clientes', nome, id)) {
      if (typeof bpInfoEntendi === 'function') {
        bpInfoEntendi(
          'Já existe um cliente com este nome. Adicione o sobrenome ou outros dados para identificar corretamente o cliente.',
          'Registo já existente'
        );
      } else if (typeof toast === 'function') {
        toast('Já existe um cliente com este nome. Adicione o sobrenome ou outros dados para identificar corretamente o cliente.', 'error');
      }
      return null;
    }
  }

  const oldNome = actual.nome;
  const newNome = data.nome != null ? data.nome : oldNome;
  const renamed = data.nome != null && String(data.nome) !== String(oldNome);

  if (window.BeautyStore && window.BeautyStore.updateInList) {
    window.BeautyStore.updateInList('clientes', id, data);
  } else {
    const i = state.clientes.findIndex(c => c.id === id);
    if (i === -1) return null;
    state.clientes[i] = { ...state.clientes[i], ...data };
  }
  const item = state.clientes.find(c => c.id === id);
  if (item) await dbPut('clientes', item);

  // Propagar rename para histórico ligado (id ou nome legado) — mantém stats coerentes
  if (renamed && newNome) {
    const patchList = async (storeKey) => {
      const list = state[storeKey] || [];
      for (let i = 0; i < list.length; i++) {
        const row = list[i];
        // FASE 1: preferir cliente_id; byName só legado sem id (não cria ligação a outro UUID)
        const byId = row.cliente_id && String(row.cliente_id) === String(id);
        const byNameLegado = !row.cliente_id && row.cliente && String(row.cliente) === String(oldNome);
        if (!byId && !byNameLegado) continue;
        const next = { ...row, cliente: newNome, cliente_id: id };
        if (window.BeautyStore && window.BeautyStore.updateInList) {
          window.BeautyStore.updateInList(storeKey, row.id, next);
        } else {
          list[i] = next;
        }
        try { await dbPut(storeKey, next); } catch (e) {}
      }
    };
    await patchList('movimentos');
    await patchList('agendamentos');
    // invalidar cache de stats se existir
    try { if (typeof _statsCache !== 'undefined') _statsCache = { key: '', map: null }; } catch (e) {}
  }

  if (!(window.BeautyStore && window.BeautyStore.subscribe)) updateUI();
  return item;
}

async function deleteCliente(id) {
  // ET4.4: RBAC operacional (UI já restringe admin/gerente)
  if (typeof bpExigirRole === 'function' && !bpExigirRole(['admin', 'gerente'], 'Não tem permissão para eliminar clientes.')) {
    return false;
  }
  return _deleteComRollback('clientes', id, 'Cliente');
}

// ====================================================================
//  CRUD — AGENDAMENTO
// ====================================================================

/** Duração do serviço em minutos (default 60 se não configurado). */
function getServicoDuracaoMin(servicoNome) {
  const s = (state.servicos || []).find(x => x.nome === servicoNome);
  if (!s) return 60;
  const d = Number(s.duracao || s.duracaoMin || s.minutos || 0);
  return d > 0 ? d : 60;
}

function _parseAgDateTime(data, hora) {
  const h = String(hora || '00:00').slice(0, 5);
  const dt = new Date(String(data) + 'T' + h + ':00');
  return isNaN(dt.getTime()) ? null : dt;
}

/**
 * Conflito = mesmo profissional, mesmo dia, intervalo sobreposto, status agendado.
 * @returns {object|null} o agendamento conflituoso ou null
 */
function temConflitoAgendamento({ profissional_id, data, hora, servico, excludeId, duracaoMin }) {
  if (!profissional_id || !data || !hora) return null;
  const dur = duracaoMin || getServicoDuracaoMin(servico);
  const start = _parseAgDateTime(data, hora);
  if (!start) return null;
  const end = new Date(start.getTime() + dur * 60000);

  for (const a of state.agendamentos || []) {
    if (excludeId && a.id === excludeId) continue;
    if (String(a.profissional_id) !== String(profissional_id)) continue;
    if (a.data !== data) continue;
    const st = String(a.status || a.estado || 'agendado').toLowerCase();
    if (st !== 'agendado') continue;
    const aStart = _parseAgDateTime(a.data, a.hora);
    if (!aStart) continue;
    const aDur = getServicoDuracaoMin(a.servico);
    const aEnd = new Date(aStart.getTime() + aDur * 60000);
    if (start < aEnd && end > aStart) return a;
  }
  return null;
}

async function addAgendamento(ag) {
  if (ag && ag.profissional_id && typeof bpProfPodeOperar === 'function') {
    var _gateAg = bpProfPodeOperar(ag.profissional_id);
    if (_gateAg && _gateAg.ok === false) {
      var _msgAg = _gateAg.message || 'Profissional bloqueado até autorização do administrador. Novos agendamentos ficam indisponíveis para este profissional até liberação.';
      if (typeof bpInfoEntendi === 'function') bpInfoEntendi(_msgAg, 'Profissional bloqueado');
      else if (typeof toast === 'function') toast(_msgAg, 'warning');
      try { if (typeof bpProfFinOpenModal === 'function') bpProfFinOpenModal(ag.profissional_id); } catch (eG) {}
      return null;
    }
  }
  const data = ag.data || (typeof hoje === 'function' ? hoje() : '');
  const hora = String(ag.hora || (typeof horaAgora === 'function' ? horaAgora() : '00:00')).slice(0, 5);
  const agDatetime = _parseAgDateTime(data, hora);
  if (!agDatetime) {
    toast('Data ou hora inválida.', 'error');
    return null;
  }
  if (agDatetime < new Date()) {
    if (typeof bpInfoEntendi === 'function') {
      bpInfoEntendi(
        'Não é possível agendar para datas ou horários passados. Escolha uma data e hora futuras para continuar.',
        'Data inválida'
      );
    } else if (typeof toast === 'function') {
      toast('Não é possível agendar para datas ou horários passados.', 'error');
    }
    return null;
  }
  if (!verificarLimite('agendamentos')) return null;
  if (!ag.profissional_id || String(ag.profissional_id).trim() === '') {
    toast('Selecciona um profissional antes de agendar.', 'warning');
    return null;
  }

  const conflito = temConflitoAgendamento({
    profissional_id: ag.profissional_id,
    data,
    hora,
    servico: ag.servico,
    excludeId: null
  });
  if (conflito) {
    const h = String(conflito.hora || '').slice(0, 5);
    toast(
      'Conflito: ' + (conflito.cliente || 'cliente') + ' já tem ' + (conflito.servico || 'serviço') +
      ' com este profissional às ' + h + '.',
      'error'
    );
    return null;
  }

  const n = {
    ...ag,
    id: uuid(),
    data,
    hora,
    status: 'agendado',
    profissional_id: ag.profissional_id || null,
    profissional: ag.profissional || '',
    updated_at: new Date().toISOString()
  };
  try {
    await dbPut('agendamentos', n);
    if (window.BeautyStore && window.BeautyStore.pushToList) {
      window.BeautyStore.pushToList('agendamentos', n);
    } else {
      state.agendamentos.push(n);
      updateUI();
    }
    if (typeof renderBadges === 'function') renderBadges();
    toast('Agendamento marcado.', 'success');
    return n;
  } catch (err) {
    if (err.message === 'LIMITE_PLANO_ATINGIDO') {
      mostrarModalUpgrade('Limite de agendamentos atingido. Faça upgrade para continuar.');
      return null;
    }
    throw err;
  }
}

async function updateAgendamento(id, data) {
  const actual = (state.agendamentos || []).find(a => a.id === id);
  if (!actual) return null;
  // ET4.3-cancel: cancelar via status exige admin/gerente
  if (data && String(data.status || '').toLowerCase() === 'cancelado') {
    if (typeof bpExigirRole === 'function' && !bpExigirRole(['admin', 'gerente'], 'Não tem permissão para cancelar agendamentos.')) {
      return null;
    }
  }

  const merged = { ...actual, ...data };
  const st = String(merged.status || 'agendado').toLowerCase();
  if (st === 'agendado' && (data.data || data.hora || data.profissional_id || data.servico)) {
    const conflito = temConflitoAgendamento({
      profissional_id: merged.profissional_id,
      data: merged.data,
      hora: merged.hora,
      servico: merged.servico,
      excludeId: id
    });
    if (conflito) {
      const h = String(conflito.hora || '').slice(0, 5);
      toast(
        'Conflito: ' + (conflito.cliente || 'cliente') + ' já tem ' + (conflito.servico || 'serviço') +
        ' com este profissional às ' + h + '.',
        'error'
      );
      return null;
    }
    if (data.data || data.hora) {
      const dt = _parseAgDateTime(merged.data, merged.hora);
      if (dt && dt < new Date()) {
        if (typeof bpInfoEntendi === 'function') {
          bpInfoEntendi(
            'Não é possível reagendar para o passado. Escolha uma data e hora futuras para continuar.',
            'Data inválida'
          );
        } else if (typeof toast === 'function') {
          toast('Não é possível reagendar para o passado.', 'error');
        }
        return null;
      }
    }
  }

  // Etapa 2: data/hora alterada → reset alerta "visto"
  try {
    if (data && (Object.prototype.hasOwnProperty.call(data, 'data') || Object.prototype.hasOwnProperty.call(data, 'hora'))) {
      var dataMudou = data.data != null && String(data.data) !== String(actual.data || '');
      var horaMudou = data.hora != null && String(data.hora).slice(0, 5) !== String(actual.hora || '').slice(0, 5);
      if (dataMudou || horaMudou) {
        if (typeof bpClearAlertVisto === 'function') bpClearAlertVisto(id);
        else {
          try { localStorage.removeItem('bp_alert_visto_' + id); } catch (_) {}
        }
      }
    }
  } catch (_) {}

  merged.updated_at = new Date().toISOString();
  if (window.BeautyStore && window.BeautyStore.updateInList) {
    window.BeautyStore.updateInList('agendamentos', id, merged);
  } else {
    const i = state.agendamentos.findIndex(a => a.id === id);
    if (i === -1) return null;
    state.agendamentos[i] = merged;
  }
  const item = state.agendamentos.find(a => a.id === id);
  if (item) await dbPut('agendamentos', item);
  if (!(window.BeautyStore && window.BeautyStore.subscribe)) updateUI();
  if (typeof renderBadges === 'function') renderBadges();
  return item;
}

async function deleteAgendamento(id) {
  return _deleteComRollback('agendamentos', id, 'Agendamento');
}

// ====================================================================
//  CRUD — PROFISSIONAL
// ====================================================================

/** ET4.5: serviço exige ≥1 profissional válido (activo) ou nome pendente (criação conjunta). */
function bpValidarProfissionaisDoServico(lista, opts) {
  opts = opts || {};
  const pending = (opts.pendingNomes || []).map(function (x) { return String(x || '').trim(); }).filter(Boolean);
  const arr = Array.isArray(lista) ? lista : [];
  if (!arr.length) {
    return { ok: false, msg: 'Seleccione pelo menos um profissional para o serviço.' };
  }
  const activos = typeof getProfissionaisAtivos === 'function'
    ? getProfissionaisAtivos()
    : (state.profissionais || []).filter(function (p) {
        return typeof isProfissionalAtivo === 'function' ? isProfissionalAtivo(p) : (p && p.ativo !== false);
      });
  const valid = arr.filter(function (ref) {
    const r = String(ref || '').trim();
    if (!r) return false;
    if (pending.indexOf(r) !== -1) return true;
    return activos.some(function (p) {
      return String(p.id) === r || String(p.nome) === r;
    });
  });
  if (!valid.length) {
    return { ok: false, msg: 'Associe pelo menos um profissional activo ao serviço.' };
  }
  return { ok: true, profissionais: valid };
}

/** ET4.5: profissional exige especialidade = serviço activo existente. */
function bpValidarEspecialidadeProfissional(esp) {
  const nome = String(esp || '').trim();
  if (!nome) {
    return { ok: false, msg: 'O profissional tem de ter pelo menos um serviço (especialidade).' };
  }
  const activos = typeof getServicosAtivos === 'function'
    ? getServicosAtivos()
    : (state.servicos || []).filter(function (s) {
        return typeof isServicoAtivo === 'function' ? isServicoAtivo(s) : (s && s.ativo !== false);
      });
  const hit = activos.find(function (s) { return String(s.nome) === nome || String(s.id) === nome; });
  if (!hit) {
    return { ok: false, msg: 'Especialidade inválida: escolha um serviço activo existente.' };
  }
  return { ok: true, servico: hit };
}

/** Liga profissional ao array profissionais do serviço. */
async function bpLigarProfissionalAoServico(prof, servicoNome) {
  if (!prof || !servicoNome) return;
  const s = (state.servicos || []).find(function (x) {
    return String(x.nome) === String(servicoNome) || String(x.id) === String(servicoNome);
  });
  if (!s) return;
  const arr = Array.isArray(s.profissionais) ? s.profissionais.slice() : [];
  const refs = [prof.nome, prof.id].filter(Boolean).map(String);
  const already = arr.some(function (x) { return refs.indexOf(String(x)) !== -1; });
  if (already) return;
  arr.push(prof.nome || prof.id);
  const patch = { profissionais: arr, updated_at: new Date().toISOString() };
  if (window.BeautyStore && window.BeautyStore.updateInList) {
    window.BeautyStore.updateInList('servicos', s.id, patch);
  } else {
    const i = state.servicos.findIndex(function (x) { return x.id === s.id; });
    if (i !== -1) state.servicos[i] = Object.assign({}, state.servicos[i], patch);
  }
  const item = (state.servicos || []).find(function (x) { return x.id === s.id; });
  if (item) {
    try { await dbPut('servicos', item); } catch (_) {}
  }
}

async function addProfissional(p) {
  if (!verificarLimite('profissionais')) return null;
  if (typeof bpExigirRole === 'function' && !bpExigirRole(['admin'], 'Apenas administradores podem adicionar profissionais.')) return null;
  const nome = (p.nome || '').trim();
  if (!nome) { toast('Introduz o nome.', 'warning'); return null; }

  // Ponto 1 (Equipa): serviço obrigatório — especialidade deve ser serviço activo
  var espRaw = String(p.especialidade || '').trim();
  if (!espRaw) {
    toast('O profissional tem de ter pelo menos um serviço (especialidade) associado.', 'error');
    return null;
  }
  {
    const espCheck = bpValidarEspecialidadeProfissional(espRaw);
    if (!espCheck.ok) {
      toast(espCheck.msg || 'Especialidade inválida: escolha um serviço activo existente.', 'error');
      return null;
    }
    espRaw = String((espCheck.servico && espCheck.servico.nome) || espRaw);
  }
  // Contacto, morada e comissão (reforço se chamada fora do formulário)
  var contactoAdd = String(p.contacto || '').replace(/\D/g, '');
  if (!contactoAdd || contactoAdd.length !== 9) {
    if (typeof bpInfoEntendi === 'function') {
      bpInfoEntendi(
        'Contacto obrigatório: exactamente 9 dígitos. Corrija o número para continuar.',
        'Contacto inválido'
      );
    } else if (typeof toast === 'function') {
      toast('Contacto obrigatório: exactamente 9 dígitos.', 'error');
    }
    return null;
  }
  if (!String(p.morada || '').trim()) {
    toast('A morada do profissional é obrigatória.', 'error');
    return null;
  }
  var taxaAdd = p.taxa_comissao != null ? Number(p.taxa_comissao) : NaN;
  if (isNaN(taxaAdd) || taxaAdd < 0 || taxaAdd > 100) {
    toast('Taxa de comissão obrigatória (0 a 100%).', 'error');
    return null;
  }
  var metaAdd = p.meta_mensal != null ? Number(p.meta_mensal) : (p.meta != null ? Number(p.meta) : NaN);
  if (isNaN(metaAdd) || metaAdd <= 0) {
    if (typeof bpInfoEntendi === 'function') {
      bpInfoEntendi('A meta é obrigatória. Indique o valor de receita alvo em Kz.', 'Meta obrigatória');
    } else {
      toast('A meta é obrigatória (valor superior a zero).', 'error');
    }
    return null;
  }
  p = Object.assign({}, p, { meta_mensal: metaAdd, meta: metaAdd });

  if (existeNomeDuplicado('profissionais', nome)) {
    if (typeof bpInfoEntendi === 'function') {
      bpInfoEntendi(
        'Já existe um profissional com este nome. Altere o nome para distinguir os registos e continue.',
        'Registo já existente'
      );
    } else if (typeof toast === 'function') {
      toast('Já existe um profissional com este nome.', 'error');
    }
    return null;
  }

  const n = { ...p, id: uuid(), nome, especialidade: espRaw, ativo: p.ativo !== false };
  try {
    await dbPut('profissionais', n);
    if (window.BeautyStore && window.BeautyStore.pushToList) {
      window.BeautyStore.pushToList('profissionais', n);
    } else {
      state.profissionais.push(n);
      updateUI();
    }
    if (espRaw) {
      try { await bpLigarProfissionalAoServico(n, espRaw); } catch (_) {}
    }
    toast('Profissional adicionado.', 'success');
    return n;
  } catch (err) {
    if (err.message === 'LIMITE_PLANO_ATINGIDO') {
      mostrarModalUpgrade('Limite de profissionais atingido. Faça upgrade para continuar.');
      return null;
    }
    throw err;
  }
}


function isProfissionalAtivo(p) {
  if (!p) return false;
  return p.ativo !== false && p.ativo !== 0 && p.ativo !== 'false';
}

function isServicoAtivo(s) {
  if (!s) return false;
  return s.ativo !== false && s.ativo !== 0 && s.ativo !== 'false';
}

function getProfissionaisAtivos() {
  return (state.profissionais || []).filter(isProfissionalAtivo);
}

function getServicosAtivos() {
  return (state.servicos || []).filter(isServicoAtivo);
}
if (typeof window !== 'undefined') {
  window.getProfissionaisAtivos = getProfissionaisAtivos;
  window.getServicosAtivos = getServicosAtivos;
}

/**
 * Soft-delete: destituir profissional sem DELETE remoto (evita 409 FK).
 * Remove associações em serviços; desactiva serviços que ficam sem equipa.
 */
async function desassociarProfissional(id) {
  const p = (state.profissionais || []).find(function (x) { return x.id === id; });
  if (typeof bpExigirRole === 'function' && !bpExigirRole(['admin'], 'Apenas administradores podem destituir profissionais.')) return null;
  if (!p) {
    if (typeof toast === 'function') toast('Profissional não encontrado', 'error');
    return null;
  }
  if (!isProfissionalAtivo(p)) {
    if (typeof toast === 'function') toast('Este profissional já está destituído', 'warning');
    return null;
  }

  const patch = {
    ativo: false,
    data_desativacao: new Date().toISOString(),
    deleted_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // UPDATE local + fila (não DELETE — crítico para multi-dispositivo)
  if (window.BeautyStore && window.BeautyStore.updateInList) {
    window.BeautyStore.updateInList('profissionais', id, patch);
  } else {
    const i = state.profissionais.findIndex(function (x) { return x.id === id; });
    if (i === -1) return null;
    state.profissionais[i] = Object.assign({}, state.profissionais[i], patch);
  }
  const item = (state.profissionais || []).find(function (x) { return x.id === id; });
  if (item) {
    try {
      await dbPut('profissionais', item);
      // Contingência 1: PATCH directo no Supabase (fonte de verdade multi-dispositivo)
      var remotoOk = false;
      if (navigator.onLine && typeof supabaseDeactivate === 'function') {
        try {
          await supabaseDeactivate('profissionais', id, {
            data_desativacao: item.data_desativacao,
            updated_at: item.updated_at
          });
          remotoOk = true;
        } catch (eRemoto) {
          console.warn('[desassociarProfissional] PATCH remoto falhou, fila de contingência', eRemoto);
        }
      }
      // Contingência 2: fila upsert se PATCH falhou ou offline
      if (!remotoOk && typeof addToSyncQueue === 'function') {
        addToSyncQueue('profissionais', 'upsert', item);
        if (navigator.onLine && typeof flushSyncQueue === 'function') {
          try { await flushSyncQueue(); } catch (eFlush) {
            console.warn('[desassociarProfissional] flush', eFlush);
          }
        }
      }
    } catch (e) {
      console.error('[desassociarProfissional]', e);
    }
  }

  const nome = p.nome || '';
  const servicosAfetados = [];
  const servicosDesativados = [];

  for (const s of (state.servicos || []).slice()) {
    const arr = Array.isArray(s.profissionais) ? s.profissionais.slice() : [];
    if (!arr.length) continue;
    const next = arr.filter(function (x) {
      return x !== nome && String(x) !== String(id);
    });
    if (next.length === arr.length) continue;

    const sPatch = { profissionais: next };
    if (next.length === 0) {
      sPatch.ativo = false;
      servicosDesativados.push(s.nome || 'Serviço');
    } else {
      servicosAfetados.push(s.nome || 'Serviço');
    }

    if (window.BeautyStore && window.BeautyStore.updateInList) {
      window.BeautyStore.updateInList('servicos', s.id, sPatch);
    } else {
      const si = state.servicos.findIndex(function (x) { return x.id === s.id; });
      if (si !== -1) state.servicos[si] = Object.assign({}, state.servicos[si], sPatch);
    }
    const updated = (state.servicos || []).find(function (x) { return x.id === s.id; });
    if (updated) {
      try { await dbPut('servicos', updated); } catch (e) {}
    }
  }

  if (!(window.BeautyStore && window.BeautyStore.subscribe) && typeof updateUI === 'function') {
    updateUI();
  }

  return {
    profissional: item || Object.assign({}, p, patch),
    servicosAfetados: servicosAfetados,
    servicosDesativados: servicosDesativados
  };
}

async function updateProfissional(id, data) {
  const actual = (state.profissionais || []).find(p => p.id === id);
  if (typeof bpExigirRole === 'function' && !bpExigirRole(['admin'], 'Apenas administradores podem editar profissionais.')) return null;
  if (!actual) return null;

  if (data.especialidade != null) {
    if (!String(data.especialidade || '').trim()) {
      toast('O profissional tem de ter um serviço (especialidade) associado.', 'error');
      return null;
    }
    const espCheck = typeof bpValidarEspecialidadeProfissional === 'function'
      ? bpValidarEspecialidadeProfissional(data.especialidade)
      : { ok: !!(data.especialidade && String(data.especialidade).trim()), msg: 'Especialidade obrigatória' };
    if (!espCheck.ok) {
      toast(espCheck.msg || 'O profissional tem de ter um serviço associado.', 'error');
      return null;
    }
  }
  if (data.contacto != null) {
    var dig = String(data.contacto || '').replace(/\D/g, '');
    if (!dig || dig.length !== 9) {
      if (typeof bpInfoEntendi === 'function') {
        bpInfoEntendi(
          'Contacto obrigatório: exactamente 9 dígitos. Corrija o número para continuar.',
          'Contacto inválido'
        );
      } else if (typeof toast === 'function') {
        toast('Contacto obrigatório: exactamente 9 dígitos.', 'error');
      }
      return null;
    }
    data = Object.assign({}, data, { contacto: dig });
  }
  if (data.morada != null && !String(data.morada || '').trim()) {
    toast('A morada do profissional é obrigatória.', 'error');
    return null;
  }
  if (data.taxa_comissao != null) {
    var tUp = Number(data.taxa_comissao);
    if (isNaN(tUp) || tUp < 0 || tUp > 100) {
      toast('Taxa de comissão obrigatória (0 a 100%).', 'error');
      return null;
    }
  }
  if (data.meta_mensal != null || data.meta != null) {
    var metaUp = data.meta_mensal != null ? Number(data.meta_mensal) : Number(data.meta);
    if (isNaN(metaUp) || metaUp <= 0) {
      if (typeof bpInfoEntendi === 'function') {
        bpInfoEntendi('A meta é obrigatória. Indique o valor de receita alvo em Kz.', 'Meta obrigatória');
      } else {
        toast('A meta é obrigatória (valor superior a zero).', 'error');
      }
      return null;
    }
    data = Object.assign({}, data, { meta_mensal: metaUp, meta: metaUp });
  }
  if (data.dataContratual != null) {
    var dChk = typeof bpValidarDataContratual === 'function'
      ? bpValidarDataContratual(data.dataContratual)
      : { ok: !!String(data.dataContratual || '').trim(), value: data.dataContratual };
    if (!dChk.ok) {
      toast((dChk && dChk.message) || 'Data contratual inválida.', 'error');
      return null;
    }
    data = Object.assign({}, data, { dataContratual: dChk.value || data.dataContratual });
  }

  if (data.nome) {
    const nome = data.nome.trim();
    data = { ...data, nome };
    if (existeNomeDuplicado('profissionais', nome, id)) {
      if (typeof bpInfoEntendi === 'function') {
        bpInfoEntendi(
          'Já existe um profissional com este nome. Altere o nome para distinguir os registos e continue.',
          'Registo já existente'
        );
      } else if (typeof toast === 'function') {
        toast('Já existe um profissional com este nome.', 'error');
      }
      return null;
    }
  }
  const oldNome = actual.nome;
  const newNome = data.nome != null ? data.nome : oldNome;
  const renamed = data.nome != null && String(data.nome) !== String(oldNome);

  if (window.BeautyStore && window.BeautyStore.updateInList) {
    window.BeautyStore.updateInList('profissionais', id, data);
  } else {
    const i = state.profissionais.findIndex(p => p.id === id);
    if (i === -1) return null;
    state.profissionais[i] = { ...state.profissionais[i], ...data };
  }
  const item = state.profissionais.find(p => p.id === id);
  if (item) await dbPut('profissionais', item);
  if (item && data && data.especialidade) {
    try { await bpLigarProfissionalAoServico(item, data.especialidade); } catch (_) {}
  }

  // Rename: actualizar nomes em serviços ligados (array legado de nomes)
  if (renamed && oldNome && newNome) {
    for (const s of (state.servicos || [])) {
      const arr = s.profissionais || [];
      if (!arr.length) continue;
      let changed = false;
      const next = arr.map(function (x) {
        if (x === oldNome || x === id) { changed = true; return newNome; }
        return x;
      });
      if (!changed) continue;
      const updated = { ...s, profissionais: next };
      if (window.BeautyStore && window.BeautyStore.updateInList) {
        window.BeautyStore.updateInList('servicos', s.id, updated);
      } else {
        const si = state.servicos.findIndex(x => x.id === s.id);
        if (si !== -1) state.servicos[si] = updated;
      }
      try { await dbPut('servicos', updated); } catch (e) {}
    }
    // Nome em movimentos legados sem quebrar id
    for (const m of (state.movimentos || [])) {
      if (String(m.profissional_id) !== String(id)) continue;
      if (m.profissional === newNome) continue;
      const updated = { ...m, profissional: newNome };
      if (window.BeautyStore && window.BeautyStore.updateInList) {
        window.BeautyStore.updateInList('movimentos', m.id, updated);
      } else {
        const mi = state.movimentos.findIndex(x => x.id === m.id);
        if (mi !== -1) state.movimentos[mi] = updated;
      }
      try { await dbPut('movimentos', updated); } catch (e) {}
    }
  }

  if (!(window.BeautyStore && window.BeautyStore.subscribe)) updateUI();
  return item;
}

async function deleteProfissional(id) {
  if (typeof bpExigirRole === 'function' && !bpExigirRole(['admin'], 'Não tem permissão para eliminar profissionais.')) return false;
  // Preferir fluxo soft já existente (desassociar)
  if (typeof desassociarProfissional === 'function') {
    var r = await desassociarProfissional(id);
    return r != null;
  }
  return _deleteComRollback('profissionais', id, 'Profissional');
}

// ====================================================================
//  CRUD — SERVIÇO
// ====================================================================
async function addServico(s, opts) {
  opts = opts || {};
  if (typeof bpExigirRole === 'function' && !bpExigirRole(['admin'], 'Apenas administradores podem criar serviços.')) return null;
  const nome = (s.nome || '').trim();
  if (!nome) { toast('Introduz o nome.', 'warning'); return null; }

  // R33 — preço obrigatório > 0
  var precoBase = Number(s.precoBase);
  if (!Number.isFinite(precoBase) || precoBase <= 0) {
    toast('Informe um preço válido superior a zero.', 'warning');
    return null;
  }

  // R34 — serviço sem profissionais — proibido
  const profCheck = typeof bpValidarProfissionaisDoServico === 'function'
    ? bpValidarProfissionaisDoServico(s.profissionais, opts)
    : { ok: Array.isArray(s.profissionais) && s.profissionais.length > 0, msg: 'Seleccione profissionais', profissionais: s.profissionais };
  if (!profCheck.ok) {
    toast(profCheck.msg || 'Associa pelo menos um profissional a este serviço.', 'error');
    return null;
  }

  if (existeNomeDuplicado('servicos', nome)) {
    if (typeof bpInfoEntendi === 'function') {
      bpInfoEntendi(
        'Já existe um serviço com este nome. Escolha outro nome para o catálogo e continue.',
        'Registo já existente'
      );
    } else if (typeof toast === 'function') {
      toast('Já existe um serviço com este nome.', 'error');
    }
    return null;
  }

  const n = { ...s, id: uuid(), nome, precoBase: precoBase, profissionais: profCheck.profissionais || s.profissionais };
  await dbPut('servicos', n);
  if (window.BeautyStore && window.BeautyStore.pushToList) {
    window.BeautyStore.pushToList('servicos', n);
  } else {
    state.servicos.push(n);
    updateUI();
  }
  toast('Serviço criado.', 'success');
  return n;
}

async function updateServico(id, data) {
  if (typeof bpExigirRole === 'function' && !bpExigirRole(['admin'], 'Apenas administradores podem editar serviços.')) return null;
  if (data && Object.prototype.hasOwnProperty.call(data, 'precoBase')) {
    var pb = Number(data.precoBase);
    if (!Number.isFinite(pb) || pb <= 0) {
      toast('Informe um preço válido superior a zero.', 'warning');
      return null;
    }
    data = Object.assign({}, data, { precoBase: pb });
  }
  if (data && Object.prototype.hasOwnProperty.call(data, 'profissionais')) {
    const profCheck = typeof bpValidarProfissionaisDoServico === 'function'
      ? bpValidarProfissionaisDoServico(data.profissionais)
      : { ok: Array.isArray(data.profissionais) && data.profissionais.length > 0, msg: 'Seleccione profissionais', profissionais: data.profissionais };
    if (!profCheck.ok) {
      toast(profCheck.msg || 'O serviço tem de ter pelo menos um profissional.', 'error');
      return null;
    }
    data = Object.assign({}, data, { profissionais: profCheck.profissionais || data.profissionais });
  }
  if (data.nome) {
    const nome = data.nome.trim();
    if (existeNomeDuplicado('servicos', nome, id)) {
      if (typeof bpInfoEntendi === 'function') {
        bpInfoEntendi(
          'Já existe um serviço com este nome. Escolha outro nome para o catálogo e continue.',
          'Registo já existente'
        );
      } else if (typeof toast === 'function') {
        toast('Já existe um serviço com este nome.', 'error');
      }
      return null;
    }
  }
  if (window.BeautyStore && window.BeautyStore.updateInList) {
    window.BeautyStore.updateInList('servicos', id, data);
  } else {
    const i = state.servicos.findIndex(s => s.id === id);
    if (i === -1) return null;
    state.servicos[i] = { ...state.servicos[i], ...data };
  }
  const item = state.servicos.find(s => s.id === id);
  if (item) await dbPut('servicos', item);
  if (!(window.BeautyStore && window.BeautyStore.subscribe)) updateUI();
  return item || null;
}

async function deleteServico(id) {
  // ET4.2-P1-03: soft-delete (ativo=false) — alinhado a profissionais; preserva histórico multi-dispositivo
  if (typeof bpExigirRole === 'function' && !bpExigirRole(['admin'], 'Apenas administradores podem desactivar serviços.')) return false;
  return desativarServico(id);
}

/** Soft-delete de serviço (mesmo contrato que desassociarProfissional). */
async function desativarServico(id) {
  const s = (state.servicos || []).find(function (x) { return x.id === id; });
  if (!s) {
    if (typeof toast === 'function') toast('Serviço não encontrado', 'error');
    return false;
  }
  if (!isServicoAtivo(s)) {
    if (typeof toast === 'function') toast('Este serviço já está desactivado', 'warning');
    return false;
  }
  const patch = {
    ativo: false,
    deleted_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  if (window.BeautyStore && window.BeautyStore.updateInList) {
    window.BeautyStore.updateInList('servicos', id, patch);
  } else {
    const i = state.servicos.findIndex(function (x) { return x.id === id; });
    if (i !== -1) state.servicos[i] = Object.assign({}, state.servicos[i], patch);
  }
  const item = (state.servicos || []).find(function (x) { return x.id === id; });
  let remotoOk = false;
  try {
    if (item) await dbPut('servicos', item);
  } catch (e) {
    console.error('[desativarServico]', e);
  }
  try {
    if (navigator.onLine && typeof supabaseDeactivate === 'function' && state.config && state.config.salaoId) {
      try {
        await supabaseDeactivate('servicos', id, { updated_at: patch.updated_at });
        remotoOk = true;
      } catch (eRemoto) {
        console.warn('[desativarServico] PATCH remoto falhou, fila de contingência', eRemoto);
      }
    }
    if (!remotoOk && typeof addToSyncQueue === 'function' && item) {
      addToSyncQueue('servicos', 'upsert', item);
      if (navigator.onLine && typeof flushSyncQueue === 'function') {
        try { await flushSyncQueue(); } catch (eFlush) {
          console.warn('[desativarServico] flush', eFlush);
        }
      }
    }
  } catch (e) {
    console.error('[desativarServico] sync', e);
  }
  if (typeof updateUI === 'function') updateUI();
  if (typeof toast === 'function') toast('Serviço desactivado.', 'success');
  return true;
}


function getServicoById(id) {
  return state.servicos.find(s => s.id === id);
}

function getServicoByNome(nome) {
  return state.servicos.find(s => s.nome === nome);
}

function getProfissionaisPorServico(nomeServico) {
  // ET4.5: sem associação explícita → lista vazia (nunca "toda a equipa")
  const servico = (state.servicos || []).find(s => s.nome === nomeServico);
  if (servico && Array.isArray(servico.profissionais) && servico.profissionais.length > 0) {
    return servico.profissionais.slice();
  }
  return [];
}

// ====================================================================
//  VENDA / MOVIMENTO
// ====================================================================

/**
 * ETAPA1 — Motor central de validação de venda (R01–R06, R08–R15, R17, R54–R58).
 * Retorna { ok, code, field, title, message, total, itens, clienteNome, ... }
 * Não persiste. Não depende só da UI.
 */
function bpValidarOperacaoVenda(dados) {
  dados = dados || {};
  var itensIn = Array.isArray(dados.itens) ? dados.itens : [];
  if (!itensIn.length) {
    return {
      ok: false,
      code: 'R05',
      field: 'ci-servico-sel',
      title: 'Itens da venda',
      message: 'Adicione pelo menos um serviço ou produto antes de continuar.'
    };
  }

  var itensNorm = [];
  for (var i = 0; i < itensIn.length; i++) {
    var it = itensIn[i] || {};
    var nome = String(it.nome || '').trim();
    if (!nome || nome === '__custom' || nome === 'Outro') {
      return {
        ok: false,
        code: 'R17',
        field: 'ci-servico-sel',
        title: 'Serviço',
        message: 'Seleccione um serviço do catálogo. Serviços personalizados não são permitidos na venda.'
      };
    }
    var qty = Number(it.quantidade);
    if (!Number.isFinite(qty) || qty < 1 || Math.floor(qty) !== qty) {
      return {
        ok: false,
        code: 'R08',
        field: 'cart-items-list',
        title: 'Quantidade',
        message: 'A quantidade deve ser um número inteiro igual ou superior a 1.'
      };
    }
    var precoUnit = Number(it.precoUnit != null ? it.precoUnit : (Number(it.subtotal) / qty));
    if (!Number.isFinite(precoUnit) || precoUnit <= 0) {
      return {
        ok: false,
        code: 'R09',
        field: 'ci-valor',
        title: 'Preço',
        message: 'Informe um preço válido superior a zero.'
      };
    }
    var subtotal = Math.round(precoUnit * qty * 100) / 100;
    var serv = null;
    try {
      if (typeof getServicoByNome === 'function') serv = getServicoByNome(nome);
      if (!serv && typeof state !== 'undefined') {
        serv = (state.servicos || []).find(function (s) {
          return s && (String(s.nome) === nome || String(s.id) === nome);
        });
      }
    } catch (_) {}
    if (!serv) {
      return {
        ok: false,
        code: 'R17',
        field: 'ci-servico-sel',
        title: 'Serviço',
        message: 'Seleccione um serviço do catálogo. Serviços personalizados não são permitidos na venda.'
      };
    }
    var servAtivo = typeof isServicoAtivo === 'function' ? isServicoAtivo(serv) : (serv.ativo !== false);
    if (!servAtivo) {
      return {
        ok: false,
        code: 'R06',
        field: 'ci-servico-sel',
        title: 'Serviço',
        message: 'Este serviço não está disponível para novas vendas.'
      };
    }
    itensNorm.push({
      nome: String(serv.nome || nome),
      quantidade: qty,
      precoUnit: precoUnit,
      subtotal: subtotal,
      servico_id: serv.id || null
    });
  }

  var clienteNome = String(dados.cliente || '').trim();
  if (!clienteNome || clienteNome === 'Avulso' || clienteNome === 'Anónimo') {
    return {
      ok: false,
      code: 'R01',
      field: 'venda-cliente',
      title: 'Cliente',
      message: 'Selecione um cliente para continuar.'
    };
  }
  var clienteHit = null;
  try {
    if (typeof state !== 'undefined') {
      clienteHit = (state.clientes || []).find(function (c) {
        return c && (String(c.nome) === clienteNome || String(c.id) === clienteNome);
      });
    }
  } catch (_) {}
  if (!clienteHit) {
    return {
      ok: false,
      code: 'R01',
      field: 'venda-cliente',
      title: 'Cliente',
      message: 'Selecione um cliente para continuar.'
    };
  }
  if (clienteHit.ativo === false || clienteHit.ativo === 0 || clienteHit.ativo === 'false') {
    return {
      ok: false,
      code: 'R48',
      field: 'venda-cliente',
      title: 'Cliente',
      message: 'Este cliente não está activo. Escolha outro cliente para continuar.'
    };
  }

  var profId = dados.profissional_id != null ? String(dados.profissional_id).trim() : '';
  if (!profId) {
    return {
      ok: false,
      code: 'R02',
      field: 'venda-profissional',
      title: 'Profissional',
      message: 'Selecione o profissional responsável pela venda para continuar.'
    };
  }
  var prof = null;
  try {
    if (typeof state !== 'undefined') {
      prof = (state.profissionais || []).find(function (p) {
        return p && String(p.id) === profId;
      });
    }
  } catch (_) {}
  if (!prof) {
    return {
      ok: false,
      code: 'R02',
      field: 'venda-profissional',
      title: 'Profissional',
      message: 'Selecione o profissional responsável pela venda para continuar.'
    };
  }
  var profAtivo = typeof isProfissionalAtivo === 'function' ? isProfissionalAtivo(prof) : (prof.ativo !== false);
  if (!profAtivo) {
    return {
      ok: false,
      code: 'R04',
      field: 'venda-profissional',
      title: 'Profissional',
      message: 'Este profissional não está activo. Escolha um profissional disponível.'
    };
  }

  for (var j = 0; j < itensNorm.length; j++) {
    var nomeS = itensNorm[j].nome;
    var serv2 = null;
    try {
      if (typeof getServicoByNome === 'function') serv2 = getServicoByNome(nomeS);
      if (!serv2 && typeof state !== 'undefined') {
        serv2 = (state.servicos || []).find(function (s) {
          return s && String(s.nome) === nomeS;
        });
      }
    } catch (_) {}
    var lista = (serv2 && Array.isArray(serv2.profissionais)) ? serv2.profissionais : [];
    if (!lista.length) {
      return {
        ok: false,
        code: 'R35',
        field: 'venda-profissional',
        title: 'Profissional',
        message: 'Este serviço não possui um profissional disponível. Associe um profissional ao serviço antes de continuar.'
      };
    }
    var habilitado = lista.some(function (ref) {
      var r = String(ref || '');
      return r === String(prof.id) || r === String(prof.nome || '');
    });
    if (!habilitado) {
      return {
        ok: false,
        code: 'R03',
        field: 'venda-profissional',
        title: 'Profissional',
        message: 'Este profissional não está habilitado para o serviço selecionado. Escolha um profissional disponível para este serviço.'
      };
    }
  }

  var total = 0;
  for (var k = 0; k < itensNorm.length; k++) {
    total += Number(itensNorm[k].subtotal) || 0;
  }
  total = Math.round(total * 100) / 100;
  if (!Number.isFinite(total) || total <= 0) {
    return {
      ok: false,
      code: 'R11',
      field: 'cart-total-area',
      title: 'Total',
      message: 'O total da venda é inválido. Verifique os serviços, quantidades e valores antes de continuar.'
    };
  }

  var metodo = String(dados.metodoPagamento != null ? dados.metodoPagamento : '').trim();
  if (metodo === 'Transferência Bancária') metodo = 'Transferência';
  if (metodo === 'Outro' || metodo === 'outro') metodo = '';
  var metodosOk = {
    'Numerário': true,
    'Multicaixa Express': true,
    'Transferência': true,
    'Cartão': true,
    'Split': true,
    '__split__': true
  };
  if (!metodo || !metodosOk[metodo]) {
    return {
      ok: false,
      code: 'R12',
      field: 'venda-pagamento',
      title: 'Pagamento',
      message: 'Selecione o método de pagamento para continuar.'
    };
  }

  var pagamentos = Array.isArray(dados.pagamentos) ? dados.pagamentos : null;
  if (metodo === '__split__' || metodo === 'Split') {
    if (!pagamentos || !pagamentos.length) {
      return {
        ok: false,
        code: 'R14',
        field: 'venda-pagamento',
        title: 'Pagamento dividido',
        message: 'Os valores dos pagamentos divididos devem corresponder exatamente ao total da venda.'
      };
    }
    var soma = 0;
    for (var p = 0; p < pagamentos.length; p++) {
      var v = Number(pagamentos[p] && (pagamentos[p].valor != null ? pagamentos[p].valor : pagamentos[p]));
      if (!Number.isFinite(v) || v <= 0) {
        return {
          ok: false,
          code: 'R15',
          field: 'venda-pagamento',
          title: 'Pagamento',
          message: 'Informe um valor de pagamento superior a zero.'
        };
      }
      soma += v;
    }
    soma = Math.round(soma * 100) / 100;
    if (Math.abs(soma - total) > 0.009) {
      return {
        ok: false,
        code: 'R14',
        field: 'venda-pagamento',
        title: 'Pagamento dividido',
        message: 'Os valores dos pagamentos divididos devem corresponder exatamente ao total da venda.'
      };
    }
  }

  return {
    ok: true,
    code: 'OK',
    total: total,
    itens: itensNorm,
    clienteNome: String(clienteHit.nome || clienteNome),
    cliente_id: clienteHit.id || dados.cliente_id || null,
    profissional_id: String(prof.id),
    profissionalNome: String(prof.nome || ''),
    metodoPagamento: metodo === '__split__' ? 'Split' : metodo,
    pagamentos: pagamentos
  };
}

function bpFocarCampoVenda(fieldId) {
  if (!fieldId) return;
  try {
    var el = document.getElementById(fieldId);
    if (!el) return;
    try { el.classList.add('bp-field-invalid'); } catch (_) {}
    setTimeout(function () {
      try { el.focus(); } catch (_) {}
      try {
        if (el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch (_) {}
    }, 80);
    setTimeout(function () {
      try { el.classList.remove('bp-field-invalid'); } catch (_) {}
    }, 4000);
  } catch (_) {}
}

/** Feedback de validação da venda: modal → Entendi → foco no campo. */
function bpNotificarValidacaoVenda(result) {
  if (!result || result.ok) return;
  var title = result.title || 'Quase lá';
  var msg = result.message || 'Verifique os dados da venda e tente novamente.';
  var field = result.field;
  var after = function () {
    if (typeof bpFocarCampoVenda === 'function') bpFocarCampoVenda(field);
  };
  try {
    if (typeof mostrarErro === 'function') {
      mostrarErro(msg, null, title, after, { okLabel: 'Entendi' });
    } else if (typeof bpNotifyFormError === 'function') {
      bpNotifyFormError(msg, field);
    } else if (typeof toast === 'function') {
      toast(msg, 'warning');
      after();
    }
  } catch (_) {
    after();
  }
}

if (typeof window !== 'undefined') {
  window.bpValidarOperacaoVenda = bpValidarOperacaoVenda;
  window.bpNotificarValidacaoVenda = bpNotificarValidacaoVenda;
  window.bpFocarCampoVenda = bpFocarCampoVenda;
}


async function registarVenda(dados) {
  try {
    // Camada de negócio: mesmas regras da UI (R60/R65) — primeiro resolve profissional_id canónico
    var vcheck = typeof bpValidarOperacaoVenda === 'function'
      ? bpValidarOperacaoVenda(dados)
      : { ok: false, message: 'Validação indisponível.' };
    if (!vcheck || !vcheck.ok) {
      if (typeof bpNotificarValidacaoVenda === 'function') bpNotificarValidacaoVenda(vcheck);
      else if (typeof toast === 'function' && vcheck) toast(vcheck.message || 'Dados da venda incompletos.', 'warning');
      return null;
    }

    // Gate de bloqueio DEPOIS da validação (id canónico) — evita bypass sem profissional_id no payload
    if (vcheck.profissional_id && typeof bpProfPodeOperar === 'function') {
      var _gateV = bpProfPodeOperar(vcheck.profissional_id);
      if (_gateV && _gateV.ok === false) {
        var _msgV = _gateV.message || 'Profissional bloqueado até autorização do administrador. Novas vendas ficam indisponíveis para este profissional até liberação.';
        if (typeof bpInfoEntendi === 'function') bpInfoEntendi(_msgV, 'Profissional bloqueado');
        else if (typeof toast === 'function') toast(_msgV, 'warning');
        try {
          var _pidGate = _gateV.profissional_id || vcheck.profissional_id;
          if (typeof bpProfFinPromptAdmin === 'function') bpProfFinPromptAdmin(_pidGate);
          else if (typeof bpProfFinOpenModal === 'function') bpProfFinOpenModal(_pidGate);
        } catch (eGate) {}
        return null;
      }
    }

    const clienteNome = vcheck.clienteNome;
    let clienteId = vcheck.cliente_id || null;
    const total = vcheck.total;
    const itensOk = vcheck.itens;
    const descricao = itensOk.map(function (i) { return i.nome; }).join(', ');
    const id = uuid();
    // Comissão sobre valor líquido (total da venda); taxa do profissional
    let comissao = 0;
    var comissaoBruta = 0;
    var comissaoAbatidaCredito = 0;
    if (vcheck.profissional_id) {
      try {
        var _taxa = (typeof getTaxaComissao === 'function')
          ? Number(getTaxaComissao(vcheck.profissional_id)) || 0
          : 0;
        if (typeof calcularComissao === 'function') {
          comissao = Number(calcularComissao(total, _taxa)) || 0;
        } else if (_taxa > 0) {
          comissao = Math.round((total * _taxa) / 100 * 100) / 100;
        }
      } catch (e) { comissao = 0; }
      comissaoBruta = comissao;
    }
    var creditoAbatimentos = null;
    if (vcheck.profissional_id && comissao > 0) {
      try {
        if (typeof bpProfAplicarCreditoNaComissao === 'function') {
          var _ab = bpProfAplicarCreditoNaComissao(vcheck.profissional_id, comissao);
          if (_ab && typeof _ab.comissaoLiquida === 'number') {
            comissao = Math.max(0, Number(_ab.comissaoLiquida) || 0);
            comissaoAbatidaCredito = Math.max(0, Number(_ab.abatido) || 0);
            if (_ab.abatimentos && _ab.abatimentos.length) creditoAbatimentos = _ab.abatimentos;
          }
        }
      } catch (eAb) {}
    }

    const mov = {
      id,
      tipo: 'venda',
      descricao,
      valor: total,
      cliente: clienteNome,
      cliente_id: clienteId || null,
      profissional_id: vcheck.profissional_id,
      profissional: vcheck.profissionalNome,
      comissao_gerada: comissao,
      comissao_bruta: comissaoBruta > 0 ? comissaoBruta : undefined,
      comissao_abatida_credito: comissaoAbatidaCredito > 0 ? comissaoAbatidaCredito : undefined,
      credito_abatimentos: creditoAbatimentos || undefined,
      itens: itensOk.map(function (i) {
        return {
          nome: i.nome,
          quantidade: i.quantidade,
          precoUnit: i.precoUnit,
          subtotal: i.subtotal
        };
      }),
      metodoPagamento: vcheck.metodoPagamento,
      pagamentos: vcheck.pagamentos,
      data: hoje(),
      hora: horaAgora(),
      reciboNum: (typeof nextReciboNum === 'function' ? nextReciboNum() : '0001'),
      salao_id: state.config.salaoId || null,
      updated_at: new Date().toISOString()
    };

    // Escrita local primeiro — nunca falha a venda por causa da rede
    await dbPut('movimentos', mov);
    if (window.BeautyStore && window.BeautyStore.pushToList) {
      window.BeautyStore.pushToList('movimentos', mov);
    } else {
      state.movimentos.push(mov);
      updateUI();
    }
    if (typeof renderBadges === 'function') renderBadges();

    // Fidelidade: creditar pontos se há ficha de cliente
    if (clienteId) {
      var pts = calcularPontosVenda(total);
      if (pts > 0) {
        try { await creditarPontosCliente(clienteId, pts); } catch (ePts) {}
      }
    }

    try {
      if (vcheck.profissional_id && typeof bpProfAposVendaMetaCheck === 'function') {
        bpProfAposVendaMetaCheck(vcheck.profissional_id);
        // Flag já definida dentro do check; reforço se o gate ficou activo
        if (typeof bpProfEstaBloqueado === 'function' && bpProfEstaBloqueado(vcheck.profissional_id)) {
          try { window.__bpLastVendaMetaBlocked = String(vcheck.profissional_id); } catch (eFlag) {}
        }
      }
    } catch (eMeta) {}
    return id;
  } catch (err) {
    console.error('[registarVenda] Erro:', err);
    // Se for limite de plano, mensagem específica
    if (err && err.message === 'LIMITE_PLANO_ATINGIDO') {
      mostrarModalUpgrade('Limite do plano atingido. Faça upgrade para continuar.');
      return null;
    }
    toast('Não foi possível registar a venda localmente. Tente novamente.', 'error');
    return null;
  }
}

/**
 * Cancela uma venda e estorna a comissão (offline-first).
 * Marca movimento status=cancelado e zera comissao_gerada (guarda valor em comissao_estornada).
 */
async function cancelarVenda(movimentoId, motivo) {
  if (typeof bpExigirRole === 'function' && !bpExigirRole(['admin', 'gerente'], 'Não tem permissão para cancelar vendas.')) return false;
  try {
    if (!movimentoId || typeof state === 'undefined') return false;
    const mov = (state.movimentos || []).find(function (m) { return m.id === movimentoId; });
    if (!mov || mov.tipo !== 'venda') {
      if (typeof toast === 'function') toast('Venda não encontrada', 'error');
      return false;
    }
    if (mov.status === 'cancelado') {
      if (typeof toast === 'function') toast('Venda já estava cancelada', 'warning');
      return false;
    }
    const estorno = Number(mov.comissao_gerada) || 0;
    const abatidoCredito = Number(mov.comissao_abatida_credito) || 0;
    const updated = Object.assign({}, mov, {
      status: 'cancelado',
      comissao_estornada: estorno,
      comissao_gerada: 0,
      cancelado_em: (typeof hoje === 'function' ? hoje() : new Date().toISOString().slice(0, 10)),
      cancelado_motivo: motivo || '',
      updated_at: new Date().toISOString()
    });
    if (window.BeautyStore && window.BeautyStore.updateInList) {
      window.BeautyStore.updateInList('movimentos', movimentoId, updated);
    } else {
      const mi = state.movimentos.findIndex(function (x) { return x.id === movimentoId; });
      if (mi !== -1) state.movimentos[mi] = updated;
    }
    try { await dbPut('movimentos', updated); } catch (e) {}
    // Devolve ao crédito o que esta venda tinha abatido (por lote se existir)
    try {
      if (mov.profissional_id && typeof bpProfRestaurarCreditoDeAbatimento === 'function') {
        if (Array.isArray(mov.credito_abatimentos) && mov.credito_abatimentos.length) {
          bpProfRestaurarCreditoDeAbatimento(mov.profissional_id, mov.credito_abatimentos);
        } else if (abatidoCredito > 0) {
          bpProfRestaurarCreditoDeAbatimento(mov.profissional_id, abatidoCredito);
        }
      }
    } catch (eRest) {}
    // FASE 1: garantir fila mesmo se monkey-patch falhar
    try {
      if (typeof addToSyncQueue === 'function') addToSyncQueue('movimentos', 'upsert', updated);
    } catch (_) {}
    try {
      if (navigator.onLine && typeof flushSyncQueue === 'function') await flushSyncQueue();
    } catch (_) {}
    if (typeof toast === 'function') toast('Venda cancelada' + (estorno ? ' · comissão estornada' : ''), 'warning');
    if (typeof updateUI === 'function') updateUI();
    if (typeof atualizarIndicadorSync === 'function') atualizarIndicadorSync();
    return true;
  } catch (err) {
    if (typeof logContexto === 'function') logContexto('cancelarVenda', err);
    if (typeof toast === 'function') toast('Erro ao cancelar venda', 'error');
    return false;
  }
}
if (typeof window !== 'undefined') window.cancelarVenda = cancelarVenda;

/** True se o movimento é venda e não está cancelada (R50 / KPIs). */
function bpVendaActiva(m) {
  if (!m || m.tipo !== 'venda') return false;
  return String(m.status || 'activo').toLowerCase() !== 'cancelado';
}
if (typeof window !== 'undefined') window.bpVendaActiva = bpVendaActiva;

async function addMovimento(mov) {
  const n = { ...mov, id: uuid(), data: hoje(), hora: horaAgora() };
  await dbPut('movimentos', n);
  if (window.BeautyStore && window.BeautyStore.pushToList) {
    window.BeautyStore.pushToList('movimentos', n);
  } else {
    state.movimentos.push(n);
    updateUI();
  }
  return n;
}
/* D-5.6: API pública CRUD */
if (typeof window !== "undefined") {
  window.existeNomeDuplicado = existeNomeDuplicado;
  window.detetarTrocaDeSalao = detetarTrocaDeSalao;
  window.loadState = loadState;
  window.saveConfig = saveConfig;
  window._deleteComRollback = _deleteComRollback;
  window.calcularPontosVenda = calcularPontosVenda;
  window.getClienteTier = getClienteTier;
  window.creditarPontosCliente = creditarPontosCliente;
  window.bpValidarTelefoneCliente = bpValidarTelefoneCliente;
  window.bpClientesActivos = bpClientesActivos;
  window.addCliente = addCliente;
  window.updateCliente = updateCliente;
  window.deleteCliente = deleteCliente;
  window.getServicoDuracaoMin = getServicoDuracaoMin;
  window._parseAgDateTime = _parseAgDateTime;
  window.temConflitoAgendamento = temConflitoAgendamento;
  window.addAgendamento = addAgendamento;
  window.updateAgendamento = updateAgendamento;
  window.deleteAgendamento = deleteAgendamento;
  window.bpValidarProfissionaisDoServico = bpValidarProfissionaisDoServico;
  window.bpValidarEspecialidadeProfissional = bpValidarEspecialidadeProfissional;
  window.bpLigarProfissionalAoServico = bpLigarProfissionalAoServico;
  window.addProfissional = addProfissional;
  window.isProfissionalAtivo = isProfissionalAtivo;
  window.isServicoAtivo = isServicoAtivo;
  window.getProfissionaisAtivos = getProfissionaisAtivos;
  window.getServicosAtivos = getServicosAtivos;
  window.desassociarProfissional = desassociarProfissional;
  window.updateProfissional = updateProfissional;
  window.deleteProfissional = deleteProfissional;
  window.addServico = addServico;
  window.updateServico = updateServico;
  window.deleteServico = deleteServico;
  window.desativarServico = desativarServico;
  window.getServicoById = getServicoById;
  window.getServicoByNome = getServicoByNome;
  window.getProfissionaisPorServico = getProfissionaisPorServico;
  window.bpValidarOperacaoVenda = bpValidarOperacaoVenda;
  window.bpFocarCampoVenda = bpFocarCampoVenda;
  window.bpNotificarValidacaoVenda = bpNotificarValidacaoVenda;
  window.registarVenda = registarVenda;
  window.cancelarVenda = cancelarVenda;
  window.bpVendaActiva = bpVendaActiva;
  window.addMovimento = addMovimento;
  if (typeof BP_PONTOS_POR_KZ !== "undefined") window.BP_PONTOS_POR_KZ = BP_PONTOS_POR_KZ;
}

