/* BelezaPro D-5.5 — core/sync-rest.js
 * Extraído de app.bundle.js (FILE: sync-rest.js).
 *
 * ORDEM:
 *   … → sync-queue → sync-rest → app.bundle.js (crud) → plano-limites
 *
 * Depende de (já carregados):
 *   getAuthHeaders, bpFetchSupabase, addToSyncQueue, getDeletedItems,
 *   dbPutLocal, state, SUPABASE_URL, batch
 *
 * Expõe: supabaseUpsert/Delete/GetAll, to/fromSupabaseFormat,
 *   supabaseDeactivate, carregarDoSupabase
 *
 * Ver docs/D5_5_SYNC_REST.md
 */

// ====================================================================
//  sync-rest.js — Comunicação com Supabase e merge de dados
//  CORREÇÕES APLICADAS:
//    - Adicionado profissional_id nos mapeamentos to/from Supabase
//    - Tratamento de erros robusto (nunca exibe "Error {}")
//    - Leitura do corpo da resposta em caso de erro HTTP
//    - Fallback de mensagem para qualquer tipo de exceção
//    - POLÍTICAS FORTES: prevenção de duplicados por nome no merge e upsert
//    - Verificação de existência antes de upsert
//    - Logs estruturados para auditoria
//    - CORREÇÃO CRÍTICA: eliminações propagadas entre dispositivos
//      (item local sem upsert pendente não é reintroduzido)
//    - CORREÇÃO ADICIONAL: preservar itens locais recentes (até 5 segundos)
//      para evitar desaparecimento temporário de vendas durante merge concorrente
// ====================================================================

// ====================================================================
//  VALIDAÇÃO DE UUID (para evitar envio de valores inválidos)
// ====================================================================
function isValidUUID(uuid) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
}

// ====================================================================
//  TOLERÂNCIA: coluna foto_url pode ainda não existir no Supabase
//  null = desconhecido | true = confirmada | false = ausente no schema
// ====================================================================
var _bpSchemaFotoUrl = (function () {
  try {
    const v = localStorage.getItem('bp_schema_foto_url');
    if (v === '0') return false;
    if (v === '1') return true;
  } catch (_) {}
  return null;
})();

function _bpSetSchemaFotoUrl(ok) {
  _bpSchemaFotoUrl = !!ok;
  try { localStorage.setItem('bp_schema_foto_url', ok ? '1' : '0'); } catch (_) {}
}

function _bpIsFotoUrlSchemaError(msg) {
  const s = String(msg || '').toLowerCase();
  if (!s) return false;
  if (s.includes('foto_url')) return true;
  // PostgREST: PGRST204 — column not in schema cache
  if (s.includes('pgrst204')) return true;
  if (s.includes('schema cache') && s.includes('column')) return true;
  if (s.includes('could not find') && s.includes('column')) return true;
  if (s.includes('unexpected') && s.includes('foto')) return true;
  return false;
}


// ====================================================================
//  TOLERÂNCIA: colunas ausentes no schema (PGRST204) — strip + retry
// ====================================================================
function _bpExtractMissingColumn(msg) {
  var s = String(msg || '');
  var m = s.match(/Could not find the '([^']+)' column/i);
  if (m) return m[1];
  m = s.match(/column\s+"([^"]+)"\s+of\s+relation/i);
  if (m) return m[1];
  return null;
}

function _bpGetMissingCols(tabela) {
  try {
    var raw = localStorage.getItem('bp_schema_missing_' + tabela);
    if (!raw) return [];
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (_) { return []; }
}

function _bpRememberMissingCol(tabela, col) {
  if (!tabela || !col) return;
  try {
    var arr = _bpGetMissingCols(tabela);
    if (arr.indexOf(col) < 0) {
      arr.push(col);
      localStorage.setItem('bp_schema_missing_' + tabela, JSON.stringify(arr));
    }
  } catch (_) {}
}

function _bpStripKnownMissing(tabela, payload) {
  if (!payload || typeof payload !== 'object') return payload;
  var cols = _bpGetMissingCols(tabela);
  if (!cols.length) return payload;
  var out = Object.assign({}, payload);
  cols.forEach(function (c) { delete out[c]; });
  return out;
}

function _bpStripFotoUrl(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const out = Object.assign({}, payload);
  delete out.foto_url;
  return out;
}

function _bpAttachFotoUrl(payload, item) {
  if (!payload || typeof payload !== 'object') return payload;
  if (_bpSchemaFotoUrl === false) return payload;
  // Só enviar quando há URL (evita forçar null em massa antes da coluna existir).
  // Para limpar foto no servidor: foto_url explicitamente '' ou null no item com flag.
  if (item && Object.prototype.hasOwnProperty.call(item, 'foto_url')) {
    payload.foto_url = item.foto_url || null;
  }
  return payload;
}

// ====================================================================
//  VALIDAÇÃO DE DUPLICADOS NO SUPABASE (consulta prévia)
// ====================================================================
async function existeRegistroDuplicado(tabela, nome, salaoId, idIgnorar = null) {
  try {
    const authHeaders = await getAuthHeaders();
    const url = `${SUPABASE_URL}/rest/v1/${tabela}?salao_id=eq.${encodeURIComponent(salaoId)}&select=id,nome&nome=ilike.${encodeURIComponent(nome)}`;
    const resp = await _bpRestFetch(url, { headers: authHeaders });
    if (!resp.ok) return false;
    const rows = await resp.json();
    if (idIgnorar) {
      return rows.some(r => r.id !== idIgnorar);
    }
    return rows.length > 0;
  } catch (_) {
    return false;
  }
}

// ====================================================================
//  FUNÇÕES REST ALTERADAS – COM TRATAMENTO DE ERROS ROBUSTO
// ====================================================================


/** Transporte resilient — usa bpFetchSupabase se existir. */
async function _bpRestFetch(url, options, label) {
  if (typeof bpFetchSupabase === 'function') {
    return bpFetchSupabase(url, options || {}, { label: label || 'sync-rest', retries: 2, timeoutMs: 12000 });
  }
  return fetch(url, options || {});
}

async function supabaseUpsert(tabela, item) {
  try {
    const authHeaders = await getAuthHeaders();
    const salaoId = state.config.salaoId;
    if (!salaoId) throw new Error('Salão não identificado. Faça logout e login novamente.');

    // ================================================================
    // POLÍTICA FORTE: Verificar duplicados por nome antes de upsert
    // Aplica-se apenas a tabelas com campo 'nome' (profissionais, servicos, clientes)
    // ================================================================
    // Não bloquear por nome quando é desactivação (ativo=false) ou o id é o mesmo
    if (['profissionais', 'servicos', 'clientes'].includes(tabela) && item.nome && item.ativo !== false) {
      const existe = await existeRegistroDuplicado(tabela, item.nome, salaoId, item.id);
      if (existe) {
        console.warn(`[sync-rest] Upsert bloqueado: ${tabela} com nome "${item.nome}" já existe neste salão.`);
        throw new Error('DUPLICADO_BLOQUEADO');
      }
    }

    let payload = toSupabaseFormat(tabela, item);
    payload = _bpStripKnownMissing(tabela, payload);
    // Se já sabemos que a coluna não existe, nunca enviar foto_url
    if (_bpSchemaFotoUrl === false && payload && Object.prototype.hasOwnProperty.call(payload, 'foto_url')) {
      payload = _bpStripFotoUrl(payload);
    }

    async function postPayload(bodyObj) {
      const resp = await _bpRestFetch(`${SUPABASE_URL}/rest/v1/${tabela}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify(bodyObj),
      });
      return resp;
    }

    let resp = await postPayload(payload);
    if (resp.status === 401) {
      throw new Error('SESSION_EXPIRED');
    }
    if (!resp.ok) {
      let errorBody = '';
      try {
        errorBody = await resp.text();
      } catch (_) {
        errorBody = '(corpo da resposta não disponível)';
      }
      // Tolerância: coluna foto_url em falta → retry uma vez sem o campo
      const hadFotoUrl = payload && Object.prototype.hasOwnProperty.call(payload, 'foto_url');
      if (hadFotoUrl && _bpIsFotoUrlSchemaError(errorBody)) {
        console.warn('[sync-rest] Coluna foto_url indisponível no schema — a sincronizar sem ela. Execute SUPABASE_FOTOS.sql quando possível.');
        _bpSetSchemaFotoUrl(false);
        payload = _bpStripFotoUrl(payload);
        resp = await postPayload(payload);
        if (resp.status === 401) throw new Error('SESSION_EXPIRED');
        if (!resp.ok) {
          let errorBody2 = '';
          try { errorBody2 = await resp.text(); } catch (_) { errorBody2 = errorBody; }
          throw new Error(`Supabase upsert ${tabela}: ${resp.status} - ${errorBody2}`);
        }
        return;
      }
      throw new Error(`Supabase upsert ${tabela}: ${resp.status} - ${errorBody}`);
    }
    // Sucesso com foto_url → confirmar schema
    if (payload && Object.prototype.hasOwnProperty.call(payload, 'foto_url') && _bpSchemaFotoUrl !== true) {
      _bpSetSchemaFotoUrl(true);
    }
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED') throw err;
    if (err.message === 'DUPLICADO_BLOQUEADO') {
      console.warn(`[sync-rest] Upsert ignorado para ${tabela} devido a duplicado.`);
      return;
    }
    const errorMsg = err.message || String(err) || 'Erro desconhecido';
    if (errorMsg.includes('LIMITE_PLANO_ATINGIDO')) {
      if (typeof mostrarModalUpgrade === 'function') {
        mostrarModalUpgrade('Limite do plano atingido. Faça upgrade para continuar.');
      }
      throw new Error('LIMITE_PLANO_ATINGIDO');
    }
    // Última rede de segurança: erro de schema no catch (rede/parse)
    if (_bpIsFotoUrlSchemaError(errorMsg) && item && (tabela === 'clientes' || tabela === 'profissionais')) {
      try {
        console.warn('[sync-rest] Retry de emergência sem foto_url após erro de schema.');
        _bpSetSchemaFotoUrl(false);
        const authHeaders2 = await getAuthHeaders();
        const payload2 = _bpStripFotoUrl(toSupabaseFormat(tabela, item));
        const resp2 = await _bpRestFetch(`${SUPABASE_URL}/rest/v1/${tabela}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders2,
            'Prefer': 'resolution=merge-duplicates',
          },
          body: JSON.stringify(payload2),
        });
        if (resp2.status === 401) throw new Error('SESSION_EXPIRED');
        if (resp2.ok) return;
      } catch (e2) {
        if (e2.message === 'SESSION_EXPIRED') throw e2;
      }
    }
    // PGRST204: coluna ausente — recordar, remover e reintentar uma vez
    var missingCol = _bpExtractMissingColumn(errorMsg);
    if (missingCol && item) {
      try {
        _bpRememberMissingCol(tabela, missingCol);
        console.warn('[sync-rest] Coluna ausente no schema: ' + tabela + '.' + missingCol + ' — a sincronizar sem ela.');
        var authHeaders3 = await getAuthHeaders();
        var payload3 = _bpStripKnownMissing(tabela, toSupabaseFormat(tabela, item));
        delete payload3[missingCol];
        var resp3 = await _bpRestFetch(`${SUPABASE_URL}/rest/v1/${tabela}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders3,
            'Prefer': 'resolution=merge-duplicates',
          },
          body: JSON.stringify(payload3),
        });
        if (resp3.status === 401) throw new Error('SESSION_EXPIRED');
        if (resp3.ok) return;
        // Pode faltar outra coluna — extrair e tentar mais uma vez
        var body3 = '';
        try { body3 = await resp3.text(); } catch (_) {}
        var missing2 = _bpExtractMissingColumn(body3);
        if (missing2) {
          _bpRememberMissingCol(tabela, missing2);
          delete payload3[missing2];
          var resp4 = await _bpRestFetch(`${SUPABASE_URL}/rest/v1/${tabela}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders3,
              'Prefer': 'resolution=merge-duplicates',
            },
            body: JSON.stringify(payload3),
          });
          if (resp4.status === 401) throw new Error('SESSION_EXPIRED');
          if (resp4.ok) return;
        }
      } catch (e3) {
        if (e3 && e3.message === 'SESSION_EXPIRED') throw e3;
      }
    }
    console.error(`[sync-rest] Falha ao fazer upsert em ${tabela} (id: ${item?.id || 'desconhecido'}):`, errorMsg);
    throw new Error(`Falha na sincronização de ${tabela}: ${errorMsg}`);
  }
}

/**
 * FASE 1 — NUNCA HTTP DELETE em tabelas de negócio.
 * Compat: callers antigos de supabaseDelete passam a soft-delete (PATCH).
 */
async function supabaseSoftDelete(tabela, id, extra) {
  const patch = Object.assign({}, extra || {});
  const now = new Date().toISOString();
  if (!patch.updated_at) patch.updated_at = now;
  if (!patch.deleted_at) patch.deleted_at = now;

  if (tabela === 'clientes' || tabela === 'profissionais' || tabela === 'servicos') {
    if (patch.ativo === undefined) patch.ativo = false;
  }
  if (tabela === 'profissionais' && !patch.data_desativacao) {
    patch.data_desativacao = now;
  }
  if (tabela === 'agendamentos') {
    if (!patch.status) patch.status = 'cancelado';
  }
  if (tabela === 'movimentos') {
    if (!patch.status) patch.status = 'cancelado';
    if (!patch.cancelado_em) patch.cancelado_em = now.slice(0, 10);
  }

  if (typeof supabaseDeactivate === 'function') {
    return supabaseDeactivate(tabela, id, patch);
  }
  // Contingência: upsert mínimo por id
  const minimal = Object.assign({ id: id }, patch);
  if (typeof supabaseUpsert === 'function') {
    return supabaseUpsert(tabela, minimal);
  }
  throw new Error('Soft-delete indisponível (sem deactivate/upsert)');
}

async function supabaseDelete(tabela, id) {
  try {
    return await supabaseSoftDelete(tabela, id);
  } catch (err) {
    if (err && err.message === 'SESSION_EXPIRED') throw err;
    const errorMsg = (err && err.message) || String(err) || 'Erro desconhecido';
    console.error(`[sync-rest] Falha soft-delete em ${tabela} (id: ${id}):`, errorMsg);
    throw new Error(`Falha no soft-delete de ${tabela}: ${errorMsg}`);
  }
}

async function supabaseGetAll(tabela, salaoId) {
  try {
    const authHeaders = await getAuthHeaders();
    const resp = await _bpRestFetch(
      `${SUPABASE_URL}/rest/v1/${tabela}?salao_id=eq.${encodeURIComponent(salaoId)}&order=created_at.asc`,
      {
        headers: authHeaders,
      }
    );
    if (resp.status === 401) {
      throw new Error('SESSION_EXPIRED');
    }
    if (!resp.ok) {
      let errorBody = '';
      try {
        errorBody = await resp.text();
      } catch (_) {
        errorBody = '(corpo da resposta não disponível)';
      }
      throw new Error(`Supabase getAll ${tabela}: ${resp.status} - ${errorBody}`);
    }
    const rows = await resp.json();
    return rows.map(r => fromSupabaseFormat(tabela, r));
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED') throw err;
    const errorMsg = err.message || String(err) || 'Erro desconhecido';
    console.error(`[sync-rest] Falha ao buscar ${tabela} do Supabase:`, errorMsg);
    throw new Error(`Falha ao carregar ${tabela}: ${errorMsg}`);
  }
}

// ====================================================================
//  TRANSFORMAÇÃO PARA O FORMATO DO SUPABASE
// ====================================================================
function toSupabaseFormat(tabela, item) {
  const salaoId = state.config.salaoId;
  if (!salaoId) {
    console.error('[toSupabaseFormat] state.config.salaoId é nulo!', { tabela, item });
    throw new Error('Salão não identificado. Faça logout e login novamente.');
  }

  if (!item.updated_at) {
    item.updated_at = new Date().toISOString();
  }

  switch (tabela) {
    case 'movimentos': {
      // Nunca enviar cliente_id (PGRST204 histórico). R50 só se schema permitir.
      var mov = {
        id: item.id,
        salao_id: salaoId,
        tipo: item.tipo,
        descricao: item.descricao || '',
        valor: Math.round(item.valor || 0),
        cliente: item.cliente || 'Anónimo',
        profissional_id: isValidUUID(item.profissional_id) ? item.profissional_id : null,
        profissional: item.profissional || '',
        itens: item.itens || [],
        metodo_pagamento: item.metodoPagamento || item.metodo_pagamento || null,
        recibo_num: item.reciboNum || item.recibo_num || null,
        comissao_gerada: item.comissao_gerada != null ? Number(item.comissao_gerada) : null,
        data: item.data,
        hora: item.hora,
        updated_at: item.updated_at,
      };
      var missMov = _bpGetMissingCols('movimentos');
      function _okCol(c) { return missMov.indexOf(c) < 0; }
      if (_okCol('status')) mov.status = item.status || 'activo';
      if (_okCol('comissao_estornada') && item.comissao_estornada != null) mov.comissao_estornada = Number(item.comissao_estornada);
      if (_okCol('cancelado_em') && item.cancelado_em) mov.cancelado_em = item.cancelado_em;
      if (_okCol('cancelado_motivo') && item.cancelado_motivo) mov.cancelado_motivo = item.cancelado_motivo;
      if (_okCol('cliente_id') && item.cliente_id && isValidUUID(item.cliente_id)) mov.cliente_id = item.cliente_id;
      if (_okCol('cliente_legado') && item.cliente_legado != null) mov.cliente_legado = !!item.cliente_legado;
      return mov;
    }
    case 'agendamentos': {
      var ag = {
        id: item.id,
        salao_id: salaoId,
        cliente: item.cliente || '',
        servico: item.servico || '',
        profissional_id: isValidUUID(item.profissional_id) ? item.profissional_id : null,
        profissional: item.profissional || '',
        data: item.data,
        hora: item.hora || '00:00',
        preco: Math.round(item.preco || 0),
        status: item.status || 'agendado',
        agendado_por: item.agendadoPor || null,
        updated_at: item.updated_at,
      };
      var missAg = _bpGetMissingCols('agendamentos');
      function _okAg(c) { return missAg.indexOf(c) < 0; }
      if (_okAg('cliente_id') && item.cliente_id && isValidUUID(item.cliente_id)) ag.cliente_id = item.cliente_id;
      if (_okAg('servico_id') && item.servico_id && isValidUUID(item.servico_id)) ag.servico_id = item.servico_id;
      if (_okAg('deleted_at')) ag.deleted_at = item.deleted_at || null;
      return ag;
    }
    case 'clientes':
      return _bpAttachFotoUrl({
        id: item.id,
        salao_id: salaoId,
        nome: item.nome || '',
        telefone: item.telefone || null,
        notas: item.notas || null,
        ultima_visita: item.ultimaVisita || null,
        total_visitas: item.visitas || 0,
        ativo: item.ativo !== false && item.ativo !== 0 && item.ativo !== 'false',
        deleted_at: item.deleted_at || null,
        updated_at: item.updated_at,
      }, item);
    case 'profissionais':
      return _bpAttachFotoUrl({
        id: item.id,
        salao_id: salaoId,
        nome: item.nome || '',
        especialidade: item.especialidade || null,
        idade: item.idade != null ? Number(item.idade) : null,
        data_contratual: item.dataContratual || item.data_contratual || null,
        numero_bi: item.numeroBI || item.numero_bi || null,
        morada: item.morada || null,
        contacto: item.contacto || null,
        taxa_comissao: item.taxa_comissao != null ? Number(item.taxa_comissao) : (item.taxa != null ? Number(item.taxa) : 0),
        meta_mensal: item.meta_mensal != null ? Number(item.meta_mensal) : (item.meta != null ? Number(item.meta) : 0),
        ativo: item.ativo !== false && item.ativo !== 0 && item.ativo !== 'false',
        data_desativacao: item.data_desativacao || null,
        deleted_at: item.deleted_at || null,
        updated_at: item.updated_at,
        bp_fin: item.bp_fin != null ? (typeof item.bp_fin === 'string' ? item.bp_fin : JSON.stringify(item.bp_fin)) : null,
      }, item);
    case 'servicos':
      return {
        id: item.id,
        salao_id: salaoId,
        nome: item.nome || '',
        preco_base: Math.round(item.precoBase || 0),
        profissionais: item.profissionais || [],
        ativo: item.ativo !== false,
        deleted_at: item.deleted_at || null,
        updated_at: item.updated_at,
      };
    default:
      return { ...item, salao_id: salaoId, updated_at: item.updated_at };
  }
}

// ====================================================================
//  TRANSFORMAÇÃO DO FORMATO DO SUPABASE PARA O INTERNO
// ====================================================================
function fromSupabaseFormat(tabela, row) {
  switch (tabela) {
    case 'movimentos':
      return {
        id:              row.id,
        tipo:            row.tipo,
        descricao:       row.descricao,
        valor:           row.valor,
        cliente:         row.cliente,
        cliente_id:      row.cliente_id || null,
        profissional_id: row.profissional_id || null,
        profissional:    row.profissional || '',
        itens:           row.itens || [],
        metodoPagamento: row.metodo_pagamento,
        reciboNum:       row.recibo_num || row.reciboNum || null,
        comissao_gerada: row.comissao_gerada != null ? Number(row.comissao_gerada) : 0,
        comissao_estornada: row.comissao_estornada != null ? Number(row.comissao_estornada) : 0,
        status:          row.status || 'activo',
        cancelado_em:    row.cancelado_em || null,
        cancelado_motivo: row.cancelado_motivo || null,
        cliente_legado:  !!row.cliente_legado,
        data:            row.data,
        hora:            row.hora,
        updated_at:      row.updated_at,
      };
    case 'agendamentos':
      return {
        id:           row.id,
        cliente:      row.cliente,
        cliente_id:   row.cliente_id || null,
        servico:      row.servico,
        servico_id:   row.servico_id || null,
        profissional_id: row.profissional_id || null,
        profissional: row.profissional || '',
        data:         row.data,
        hora:         row.hora,
        preco:        row.preco,
        status:       row.status,
        deleted_at:   row.deleted_at || null,
        agendadoPor:  row.agendado_por,
        updated_at:   row.updated_at,
      };
    case 'clientes':
      return {
        id:           row.id,
        nome:         row.nome,
        telefone:     row.telefone,
        notas:        row.notas,
        ultimaVisita: row.ultima_visita,
        visitas:      row.total_visitas,
        foto_url:     row.foto_url || null,
        ativo:        row.ativo !== false && row.ativo !== 0 && row.ativo !== 'false',
        deleted_at:   row.deleted_at || null,
        updated_at:   row.updated_at,
      };
    case 'profissionais':
      return {
        id:            row.id,
        nome:          row.nome,
        especialidade: row.especialidade || '',
        idade:         row.idade != null ? Number(row.idade) : null,
        dataContratual: row.data_contratual || row.dataContratual || '',
        numeroBI:      row.numero_bi || row.numeroBI || '',
        morada:        row.morada || '',
        contacto:      row.contacto || '',
        taxa_comissao: row.taxa_comissao != null ? Number(row.taxa_comissao) : 0,
        meta_mensal:   row.meta_mensal != null ? Number(row.meta_mensal) : 0,
        ativo:         row.ativo !== false && row.ativo !== 0 && row.ativo !== 'false',
        data_desativacao: row.data_desativacao || null,
        foto_url:      row.foto_url || null,
        // NÃO anular foto local — resolveFotoSrc usa foto data: depois foto_url
        updated_at:    row.updated_at,
        bp_fin:        (function () {
          if (row.bp_fin == null || row.bp_fin === '') return undefined;
          if (typeof row.bp_fin === 'object') return row.bp_fin;
          try { return JSON.parse(row.bp_fin); } catch (e) { return undefined; }
        })(),
      };
    case 'servicos':
      return {
        id:            row.id,
        nome:          row.nome,
        precoBase:     row.preco_base,
        profissionais: row.profissionais || [],
        ativo:         row.ativo !== false && row.ativo !== 0,
        updated_at:    row.updated_at,
      };
    default:
      return row;
  }
}

// ====================================================================
//  CARREGAMENTO DO SUPABASE COM MERGE CAMPO A CAMPO (ROBUSTO)
// ====================================================================

/** Soft-delete remoto garantido: PATCH ativo=false + verificação GET. */
async function supabaseDeactivate(tabela, id, extra) {
  const authHeaders = await getAuthHeaders();
  const salaoId = state.config.salaoId;
  if (!salaoId) throw new Error('Salão não identificado. Faça logout e login novamente.');
  const nowIso = new Date().toISOString();
  const body = Object.assign({
    updated_at: nowIso
  }, extra || {});
  // Soft-delete universal (FASE 1): nunca HTTP DELETE
  if (tabela === 'clientes' || tabela === 'profissionais' || tabela === 'servicos') {
    if (body.ativo === undefined) body.ativo = false;
    if (!body.deleted_at) body.deleted_at = nowIso;
  }
  if (tabela === 'profissionais' && !body.data_desativacao) {
    body.data_desativacao = nowIso;
  }
  if (tabela === 'agendamentos') {
    if (!body.deleted_at) body.deleted_at = nowIso;
    if (!body.status) body.status = 'cancelado';
  }
  if (tabela === 'movimentos') {
    if (!body.status) body.status = 'cancelado';
    if (!body.cancelado_em) body.cancelado_em = nowIso.slice(0, 10);
  }
  // Remover campos undefined
  Object.keys(body).forEach(function (k) {
    if (body[k] === undefined) delete body[k];
  });
  const resp = await _bpRestFetch(
    `${SUPABASE_URL}/rest/v1/${tabela}?id=eq.${encodeURIComponent(id)}&salao_id=eq.${encodeURIComponent(salaoId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(body)
    }
  );
  if (resp.status === 401) throw new Error('SESSION_EXPIRED');
  if (!resp.ok) {
    let errorBody = '';
    try { errorBody = await resp.text(); } catch (_) { errorBody = ''; }
    throw new Error(`Supabase deactivate ${tabela}: ${resp.status} - ${errorBody}`);
  }
  // Verificar conforme família de tabela (agendamentos/movimentos não usam ativo)
  var selectCols = 'id';
  if (tabela === 'clientes' || tabela === 'profissionais' || tabela === 'servicos') selectCols = 'id,ativo,deleted_at';
  else if (tabela === 'agendamentos') selectCols = 'id,status,deleted_at';
  else if (tabela === 'movimentos') selectCols = 'id,status';
  else selectCols = 'id,ativo,deleted_at,status';

  const check = await _bpRestFetch(
    `${SUPABASE_URL}/rest/v1/${tabela}?id=eq.${encodeURIComponent(id)}&salao_id=eq.${encodeURIComponent(salaoId)}&select=${selectCols}`,
    { headers: authHeaders }
  );
  if (check.ok) {
    const rows = await check.json();
    if (rows && rows[0]) {
      var row = rows[0];
      if (tabela === 'clientes' || tabela === 'profissionais' || tabela === 'servicos') {
        if (row.ativo !== false && row.ativo !== 0 && !row.deleted_at) {
          throw new Error(`Deactivate não aplicou soft em ${tabela}/${id}`);
        }
      } else if (tabela === 'agendamentos') {
        var st = String(row.status || '').toLowerCase();
        if (st !== 'cancelado' && !row.deleted_at) {
          throw new Error(`Deactivate não aplicou cancelamento em agendamentos/${id}`);
        }
      } else if (tabela === 'movimentos') {
        if (String(row.status || '').toLowerCase() !== 'cancelado') {
          throw new Error(`Deactivate não aplicou cancelamento em movimentos/${id}`);
        }
      }
    }
  }
  return true;
}

async function carregarDoSupabase() {
  if (!navigator.onLine || !state.config.salaoId) return false;

  try {
    const [clientesRemotos, agendamentosRemotos, movimentosRemotos, profsRemotos, servicosRemotos] = await Promise.all([
      supabaseGetAll('clientes',      state.config.salaoId),
      supabaseGetAll('agendamentos',  state.config.salaoId),
      supabaseGetAll('movimentos',    state.config.salaoId),
      supabaseGetAll('profissionais', state.config.salaoId),
      supabaseGetAll('servicos',      state.config.salaoId),
    ]);

    const mergeTable = (itensLocais, itensRemotos, tabela) => {
      const mapLocal = new Map();
      itensLocais.forEach(item => mapLocal.set(item.id, item));

      // ================================================================
      // LISTA NEGRA: itens eliminados permanentemente (nunca reimportar)
      // ================================================================
      const deletedIds = new Set(
        (typeof getDeletedItems === 'function' ? getDeletedItems() : [])
          .filter(i => i && i.tabela === tabela && i.id)
          .filter(i => {
            // respeitar TTL 30d se prune disponível
            if (typeof pruneDeletedItems === 'function') return true;
            return true;
          })
          .map(i => i.id)
      );
      // Aplicar prune global periodicamente
      if (typeof pruneDeletedItems === 'function' && typeof saveDeletedItems === 'function') {
        try { saveDeletedItems(pruneDeletedItems(getDeletedItems())); } catch (_) {}
      }

      const idsComDeletePendente = new Set(
        getSyncQueue()
          .filter(op => op.tabela === tabela && op.operacao === 'delete')
          .map(op => op.payload?.id)
      );

      // ================================================================
      // CORREÇÃO CRÍTICA (eliminações não propagavam entre dispositivos):
      // um item que existe só localmente pode significar duas coisas muito
      // diferentes: a) criado/editado aqui e ainda não chegou ao servidor
      // (está na fila de upsert) → preservar; b) já existiu no servidor
      // mas foi eliminado (por este ou por outro dispositivo) → não
      // preservar. Sem isto, a lista negra/fila de delete (que são por
      // dispositivo) nunca chegavam ao dispositivo B, e o item eliminado
      // era sempre reintroduzido.
      // ================================================================
      const idsComUpsertPendente = new Set(
        getSyncQueue()
          .filter(op => op.tabela === tabela && op.operacao === 'upsert')
          .map(op => op.payload?.id)
      );

      // FASE 1: identidade só por UUID — sem mapa por nome
      const mergeCampoACampo = (maisRecente, maisAntigo) => {
        const merged = { ...maisRecente };
        for (const campo in maisAntigo) {
          if (merged[campo] === undefined || merged[campo] === null) {
            merged[campo] = maisAntigo[campo];
          }
        }
        // Foto: nunca perder data URL local se o remoto só trouxe foto_url (ou null)
        if (maisAntigo && typeof maisAntigo.foto === 'string' && maisAntigo.foto.indexOf('data:') === 0) {
          if (!merged.foto || merged.foto === null) merged.foto = maisAntigo.foto;
        }
        if (maisAntigo && maisAntigo.foto_url && !merged.foto_url) {
          merged.foto_url = maisAntigo.foto_url;
        }
        // Controlo financeiro: nunca perder bp_fin local se remoto veio vazio
        try {
          var locFin = maisAntigo && maisAntigo.bp_fin;
          var remFin = merged.bp_fin;
          if (locFin && (remFin == null || remFin === '' || (typeof remFin === 'object' && !remFin.actualizado_em && !remFin.estado))) {
            merged.bp_fin = locFin;
          } else if (locFin && remFin && typeof locFin === 'object' && typeof remFin === 'object') {
            var lt = String(locFin.actualizado_em || '');
            var rt = String(remFin.actualizado_em || '');
            if (lt && (!rt || lt >= rt)) merged.bp_fin = locFin;
          }
        } catch (eFin) {}
        return merged;
      };

      const resultado = [];
      const itensParaSync = [];

      for (const remoto of itensRemotos) {
        // FASE 1: tombstone/delete pendente → soft no remoto, nunca HTTP DELETE
        if (deletedIds.has(remoto.id) || idsComDeletePendente.has(remoto.id)) {
          var softR = Object.assign({}, remoto, {
            ativo: false,
            deleted_at: remoto.deleted_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          if (tabela === 'agendamentos' && (!softR.status || String(softR.status) === 'agendado')) {
            softR.status = 'cancelado';
          }
          resultado.push(softR);
          if (typeof addToSyncQueue === 'function') {
            try { addToSyncQueue(tabela, 'upsert', softR); } catch (_) {}
          }
          mapLocal.delete(remoto.id);
          continue;
        }

        const local = mapLocal.get(remoto.id);

        // FASE 1: identidade só por UUID (sem dedupe por nome)

        if (!local) {
          // Remoto (activo ou soft): manter no estado; listas filtram inactivos
          resultado.push(remoto);
        } else {
          // Soft-delete vence reactivação acidental (política: nunca perder eliminação)
          const localSt = String(local.status || '').toLowerCase();
          const remotoSt = String(remoto.status || '').toLowerCase();
          const localInactivo = local.ativo === false || local.ativo === 0 || local.ativo === 'false' ||
            !!local.deleted_at || localSt === 'cancelado';
          const remotoInactivo = remoto.ativo === false || remoto.ativo === 0 || remoto.ativo === 'false' ||
            !!remoto.deleted_at || remotoSt === 'cancelado';
          if (localInactivo || remotoInactivo) {
            // Base: campos do lado com updated_at mais recente, flags soft forçadas
            const lt = local.updated_at || '';
            const rt = remoto.updated_at || '';
            const base = (lt >= rt) ? Object.assign({}, remoto, local) : Object.assign({}, local, remoto);
            if (tabela === 'clientes' || tabela === 'profissionais' || tabela === 'servicos') {
              base.ativo = false;
              base.deleted_at = local.deleted_at || remoto.deleted_at || base.deleted_at || new Date().toISOString();
            }
            if (tabela === 'profissionais') {
              base.data_desativacao = local.data_desativacao || remoto.data_desativacao || base.data_desativacao || new Date().toISOString();
            }
            if (tabela === 'agendamentos') {
              base.status = 'cancelado';
              base.deleted_at = local.deleted_at || remoto.deleted_at || base.deleted_at || new Date().toISOString();
            }
            if (tabela === 'movimentos' && (localSt === 'cancelado' || remotoSt === 'cancelado')) {
              base.status = 'cancelado';
              if (local.comissao_estornada != null || remoto.comissao_estornada != null) {
                base.comissao_estornada = local.comissao_estornada != null ? local.comissao_estornada : remoto.comissao_estornada;
              }
              if (local.cancelado_em || remoto.cancelado_em) {
                base.cancelado_em = local.cancelado_em || remoto.cancelado_em;
              }
            }
            base.updated_at = lt > rt ? lt : (rt || new Date().toISOString());
            resultado.push(base);
            // Remoto ainda "activo" → propagar soft
            if (!remotoInactivo && typeof addToSyncQueue === 'function') {
              try { addToSyncQueue(tabela, 'upsert', base); } catch (_) {}
            }
            mapLocal.delete(remoto.id);
          } else {
            const localTs = local.updated_at || '1970-01-01T00:00:00.000Z';
            const remotoTs = remoto.updated_at || '1970-01-01T00:00:00.000Z';
            if (remotoTs > localTs) {
              const merged = mergeCampoACampo(remoto, local);
              resultado.push(merged);
              if (JSON.stringify(merged) !== JSON.stringify(remoto)) itensParaSync.push(merged);
            } else if (localTs > remotoTs) {
              const merged = mergeCampoACampo(local, remoto);
              resultado.push(merged);
              itensParaSync.push(merged);
            } else {
              resultado.push(local);
            }
            mapLocal.delete(remoto.id);
          }
        }
      }

      // ================================================================
      // CORREÇÃO ADICIONAL: preservar itens locais recentes (até 5 segundos)
      // mesmo que ainda não estejam na fila de upsert, para evitar
      // desaparecimento temporário durante merge concorrente.
      // ================================================================
      const AGORA = Date.now();
      for (const [id, local] of mapLocal) {
        // Preservar se houver upsert pendente
        if (idsComUpsertPendente.has(id)) {
          resultado.push(local);
          itensParaSync.push(local);
          continue;
        }
        // Preservar se for muito recente (criação local ainda não enfileirada)
        const localTs = new Date(local.updated_at || '1970-01-01').getTime();
        if (localTs > AGORA - 5000) { // menos de 5 segundos
          resultado.push(local);
          itensParaSync.push(local);
          continue;
        }
        // Caso contrário, descartar (lista negra, delete pendente ou sem operação)
        if (deletedIds.has(id) || idsComDeletePendente.has(id)) {
          continue;
        }
        // FASE 1: sem conflito por nome — só UUID
        // Último caso: só local, sem fila, não recente → NÃO reintroduzir nem re-upsert
        // (evita ressurreição de deletes e lixo offline)
        continue;
      }

      return resultado;
    };

    const mergedClientes = mergeTable(state.clientes, clientesRemotos, 'clientes');
    const mergedAgendamentos = mergeTable(state.agendamentos, agendamentosRemotos, 'agendamentos');
    const mergedMovimentos = mergeTable(state.movimentos, movimentosRemotos, 'movimentos');
    const mergedProfissionais = mergeTable(state.profissionais, profsRemotos, 'profissionais');
    const mergedServicos = mergeTable(state.servicos, servicosRemotos, 'servicos');
    if (window.BeautyStore && window.BeautyStore.setList) {
      const applyLists = function () {
        window.BeautyStore.setList('clientes', mergedClientes);
        window.BeautyStore.setList('agendamentos', mergedAgendamentos);
        window.BeautyStore.setList('movimentos', mergedMovimentos);
        window.BeautyStore.setList('profissionais', mergedProfissionais);
        window.BeautyStore.setList('servicos', mergedServicos);
      };
      if (window.BeautyStore.batch) window.BeautyStore.batch(applyLists);
      else applyLists();
    } else {
      state.clientes = mergedClientes;
      state.agendamentos = mergedAgendamentos;
      state.movimentos = mergedMovimentos;
      state.profissionais = mergedProfissionais;
      try { if (typeof bpProfFinRehydrate === 'function') bpProfFinRehydrate(); } catch (_rf) {}
      state.servicos = mergedServicos;
    }

    // Fingerprint antes/depois para evitar updateUI sem mudanças
    const fpBefore = window._bpDataFp || '';
    const fpAfter = [
      (state.clientes||[]).length,
      (state.agendamentos||[]).length,
      (state.movimentos||[]).length,
      (state.profissionais||[]).map(p => p.id+':'+(p.ativo===false?'0':'1')).join(','),
      (state.servicos||[]).map(s => s.id+':'+(s.ativo===false?'0':'1')).join(',')
    ].join('|');

    for (const c of state.clientes)      await dbPutLocal('clientes',      c);
    for (const a of state.agendamentos)  await dbPutLocal('agendamentos',  a);
    for (const m of state.movimentos)    await dbPutLocal('movimentos',    m);
    // ET4.5: após pull, alinhar sequência de recibos ao max local/remoto
    try { if (typeof bpSyncReciboCounter === 'function') await bpSyncReciboCounter(); } catch (_) {}
    for (const p of state.profissionais) await dbPutLocal('profissionais', p);
    for (const s of state.servicos)      await dbPutLocal('servicos',      s);

    /* Plano em tempo quase real: salao_config NÃO estava no pull periódico.
       Sem isto, state.config.plano só mudava no login/reload. */
    var planoAntes = state.config && state.config.plano;
    try {
      if (typeof sincronizarConfigDoServidor === 'function') {
        await sincronizarConfigDoServidor();
      }
    } catch (eCfg) {
      try { console.warn('[carregarDoSupabase] salao_config', eCfg && eCfg.message); } catch (_) {}
    }
    var planoMudou = !!(state.config && state.config.plano !== planoAntes);
    if (planoMudou) {
      try { if (typeof renderPlanoInfo === 'function') renderPlanoInfo(); } catch (_) {}
      try { if (typeof aplicarPermissoes === 'function') aplicarPermissoes(); } catch (_) {}
    }

    window._bpDataFp = fpAfter + '|plano:' + String((state.config && state.config.plano) || '');
    return (fpAfter !== fpBefore) || planoMudou;
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED') {
      console.warn('[carregarDoSupabase] Sessão expirada, a sincronização será retomada após login.');
      return false;
    }
    const errorMsg = err.message || String(err) || 'Erro desconhecido';
    console.error('[carregarDoSupabase] Erro ao carregar dados do Supabase:', errorMsg);
    return false;
  }
}

/* D-5.5: API pública sync-rest */
if (typeof window !== 'undefined') {
  window.isValidUUID = isValidUUID;
  window.existeRegistroDuplicado = existeRegistroDuplicado;
  window.supabaseUpsert = supabaseUpsert;
  window.supabaseDelete = supabaseDelete;
  window.supabaseSoftDelete = supabaseSoftDelete;
  window.supabaseGetAll = supabaseGetAll;
  window.toSupabaseFormat = toSupabaseFormat;
  window.fromSupabaseFormat = fromSupabaseFormat;
  window.supabaseDeactivate = supabaseDeactivate;
  window.carregarDoSupabase = carregarDoSupabase;
  window._bpRestFetch = _bpRestFetch;
}

