/* BelezaPro — modules/equipa — controlo financeiro pós-meta
 * - Total acumulado atinge meta → bloqueia PRÓXIMA operação (não a venda que cruzou)
 * - Admin/gerente: autoriza com JUSTIFICAÇÃO obrigatória + estado (pago/parcial/pendente/dívida)
 * - Persistência: profissional.bp_fin (IDB) + tentativa de sync via coluna bp_fin (JSON)
 * - Sem renovação de ciclo mensal: liberado_apos_meta evita re-bloqueio enquanto a meta não sobe
 */
(function (g) {
  'use strict';

  var ESTADOS = ['regular', 'pendente', 'parcial', 'pago', 'divida'];

  function _emptyFin() {
    return {
      bloqueado: false,
      liberado_apos_meta: false,
      meta_no_libero: null,
      estado: 'regular',
      comissao_devida: 0,
      comissao_paga: 0,
      saldo_pendente: 0,
      credito: 0,
      credito_politica: null,
      credito_origem: 0,
      credito_lotes: [],
      observacao: '',
      receita_evento: 0,
      evento_id: null,
      actualizado_em: null,
      autorizado_por: null,
      autorizado_em: null
    };
  }

  function _bpFinPoliticaLabel(pol) {
    if (pol === 'auto_comissao') return 'Desconto automático em comissões futuras';
    if (pol === 'pendente_admin') return 'Pendente de autorização administrativa';
    if (pol === 'manual') return 'Liquidação manual (sem desconto automático)';
    return '';
  }

  function _bpFinPoliticaCurta(pol) {
    if (pol === 'auto_comissao') return 'Desconto automático';
    if (pol === 'pendente_admin') return 'Pendente admin';
    if (pol === 'manual') return 'Manual';
    return '—';
  }

  function _bpFinNewLoteId() {
    try {
      if (typeof uuid === 'function') return 'lote-' + uuid();
    } catch (e) {}
    return 'lote-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
  }

  /** Soma restantes e mantém credito + politica de resumo (primeiro lote aberto). */
  function _bpFinSyncCreditoTotal(fin) {
    if (!fin) return fin;
    if (!Array.isArray(fin.credito_lotes)) fin.credito_lotes = [];
    var sum = 0;
    var firstPol = null;
    for (var i = 0; i < fin.credito_lotes.length; i++) {
      var L = fin.credito_lotes[i];
      if (!L) continue;
      L.restante = Math.max(0, Math.round((Number(L.restante) || 0) * 100) / 100);
      L.valor_inicial = Math.max(0, Math.round((Number(L.valor_inicial) || L.restante) * 100) / 100);
      if (L.restante > 0) {
        sum += L.restante;
        if (!firstPol) firstPol = L.politica || null;
      }
    }
    fin.credito = Math.round(sum * 100) / 100;
    fin.credito_politica = firstPol;
    return fin;
  }

  /** Migra crédito legado (campo único) para um lote — não apaga lotes já existentes. */
  function _bpFinMigrateLotes(fin) {
    if (!fin) return _emptyFin();
    if (!Array.isArray(fin.credito_lotes)) fin.credito_lotes = [];
    var total = Math.max(0, Number(fin.credito) || 0);
    var sum = 0;
    for (var i = 0; i < fin.credito_lotes.length; i++) {
      sum += Math.max(0, Number(fin.credito_lotes[i] && fin.credito_lotes[i].restante) || 0);
    }
    sum = Math.round(sum * 100) / 100;
    if (fin.credito_lotes.length === 0 && total > 0) {
      fin.credito_lotes.push({
        id: _bpFinNewLoteId(),
        valor_inicial: total,
        restante: total,
        politica: fin.credito_politica || 'pendente_admin',
        criado_em: fin.actualizado_em || new Date().toISOString(),
        obs: 'Crédito anterior (migração)',
        liquidacoes: []
      });
    } else if (total > sum + 0.009 && fin.credito_lotes.length > 0) {
      // Diferença órfã → lote pendente admin (não misturar com políticas existentes)
      var diff = Math.round((total - sum) * 100) / 100;
      fin.credito_lotes.push({
        id: _bpFinNewLoteId(),
        valor_inicial: diff,
        restante: diff,
        politica: 'pendente_admin',
        criado_em: new Date().toISOString(),
        obs: 'Ajuste de saldo',
        liquidacoes: []
      });
    }
    return _bpFinSyncCreditoTotal(fin);
  }

  function _bpFinAddLote(fin, valor, politica, obs) {
    fin = _bpFinMigrateLotes(fin || _emptyFin());
    var v = Math.round((Math.max(0, Number(valor) || 0)) * 100) / 100;
    if (!(v > 0)) return fin;
    var pol = politica || 'pendente_admin';
    if (pol !== 'auto_comissao' && pol !== 'pendente_admin' && pol !== 'manual') pol = 'pendente_admin';
    fin.credito_lotes.push({
      id: _bpFinNewLoteId(),
      valor_inicial: v,
      restante: v,
      politica: pol,
      criado_em: new Date().toISOString(),
      obs: String(obs || '').trim(),
      liquidacoes: []
    });
    fin.credito_origem = Math.round(((Number(fin.credito_origem) || 0) + v) * 100) / 100;
    return _bpFinSyncCreditoTotal(fin);
  }

  /** FIFO só em lotes auto_comissao com restante > 0 */
  function _bpFinAbaterLotesFifo(fin, comissaoBruta) {
    fin = _bpFinMigrateLotes(fin);
    var remaining = Math.round((Math.max(0, Number(comissaoBruta) || 0)) * 100) / 100;
    var abatido = 0;
    var abatimentos = [];
    if (!(remaining > 0)) {
      return { fin: fin, abatido: 0, liquida: 0, abatimentos: abatimentos };
    }
    for (var i = 0; i < fin.credito_lotes.length && remaining > 0; i++) {
      var L = fin.credito_lotes[i];
      if (!L || L.politica !== 'auto_comissao') continue;
      var rest = Math.max(0, Number(L.restante) || 0);
      if (!(rest > 0)) continue;
      var take = Math.min(rest, remaining);
      take = Math.round(take * 100) / 100;
      if (!(take > 0)) continue;
      L.restante = Math.round((rest - take) * 100) / 100;
      if (L.restante < 0.005) L.restante = 0;
      remaining = Math.round((remaining - take) * 100) / 100;
      abatido = Math.round((abatido + take) * 100) / 100;
      abatimentos.push({ lote_id: L.id, valor: take });
    }
    _bpFinSyncCreditoTotal(fin);
    var liquida = Math.round((Math.max(0, Number(comissaoBruta) || 0) - abatido) * 100) / 100;
    if (liquida < 0) liquida = 0;
    return { fin: fin, abatido: abatido, liquida: liquida, abatimentos: abatimentos };
  }

  function _bpFinRestaurarAbatimentos(fin, abatimentos) {
    fin = _bpFinMigrateLotes(fin);
    if (!Array.isArray(abatimentos) || !abatimentos.length) return fin;
    for (var i = 0; i < abatimentos.length; i++) {
      var a = abatimentos[i];
      if (!a) continue;
      var id = a.lote_id || a.loteId;
      var v = Math.round((Math.max(0, Number(a.valor) || 0)) * 100) / 100;
      if (!id || !(v > 0)) continue;
      var found = false;
      for (var j = 0; j < fin.credito_lotes.length; j++) {
        var L = fin.credito_lotes[j];
        if (L && String(L.id) === String(id)) {
          L.restante = Math.round(((Number(L.restante) || 0) + v) * 100) / 100;
          if (!L.politica) L.politica = 'auto_comissao';
          found = true;
          break;
        }
      }
      if (!found) {
        fin.credito_lotes.push({
          id: String(id),
          valor_inicial: v,
          restante: v,
          politica: 'auto_comissao',
          criado_em: new Date().toISOString(),
          obs: 'Restore cancelamento',
          liquidacoes: []
        });
      }
    }
    return _bpFinSyncCreditoTotal(fin);
  }

  function _bpFinLiquidarLote(fin, loteId, valor, obs) {
    fin = _bpFinMigrateLotes(fin);
    var v = Math.round((Math.max(0, Number(valor) || 0)) * 100) / 100;
    if (!loteId || !(v > 0)) return { ok: false, message: 'Indique o lote e o valor a liquidar.' };
    for (var i = 0; i < fin.credito_lotes.length; i++) {
      var L = fin.credito_lotes[i];
      if (!L || String(L.id) !== String(loteId)) continue;
      var rest = Math.max(0, Number(L.restante) || 0);
      if (v > rest + 0.001) {
        return { ok: false, message: 'O valor ultrapassa o restante deste crédito.' };
      }
      L.restante = Math.round((rest - v) * 100) / 100;
      if (L.restante < 0.005) L.restante = 0;
      if (!Array.isArray(L.liquidacoes)) L.liquidacoes = [];
      L.liquidacoes.push({
        valor: v,
        em: new Date().toISOString(),
        obs: String(obs || '').trim()
      });
      _bpFinSyncCreditoTotal(fin);
      return { ok: true, fin: fin, liquidado: v, restante: L.restante };
    }
    return { ok: false, message: 'Crédito não encontrado.' };
  }

  function _bpFinLsKey() {
    try {
      var sid = (state && state.config && state.config.salaoId) ? String(state.config.salaoId) : 'local';
      return 'bp_fin_map_v1_' + sid;
    } catch (e) {
      return 'bp_fin_map_v1_local';
    }
  }

  function _bpFinLsReadAll() {
    try {
      var raw = localStorage.getItem(_bpFinLsKey());
      if (!raw) return {};
      var o = JSON.parse(raw);
      return o && typeof o === 'object' ? o : {};
    } catch (e) { return {}; }
  }

  function _bpFinLsWrite(profId, fin) {
    try {
      var all = _bpFinLsReadAll();
      all[String(profId)] = fin;
      localStorage.setItem(_bpFinLsKey(), JSON.stringify(all));
    } catch (e) {}
  }

  /** Reaplica bp_fin guardado (LS + objecto) após pull/reload */
  function bpProfFinRehydrate() {
    try {
      var all = _bpFinLsReadAll();
      var list = (state && Array.isArray(state.profissionais)) ? state.profissionais : [];
      var changed = false;
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        if (!p || p.id == null) continue;
        var id = String(p.id);
        var fromLs = all[id];
        if (!fromLs) continue;
        var cur = p.bp_fin;
        if (typeof cur === 'string') {
          try { cur = JSON.parse(cur); } catch (e) { cur = null; }
        }
        var curTs = cur && cur.actualizado_em ? String(cur.actualizado_em) : '';
        var lsTs = fromLs.actualizado_em ? String(fromLs.actualizado_em) : '';
        if (!cur || (lsTs && lsTs >= curTs)) {
          if (window.BeautyStore && window.BeautyStore.updateInList) {
            window.BeautyStore.updateInList('profissionais', p.id, { bp_fin: fromLs });
          } else {
            p.bp_fin = fromLs;
          }
          changed = true;
        }
      }
      return changed;
    } catch (e) {
      return false;
    }
  }

  function bpProfFinGet(profId) {
    try {
      var list = (typeof state !== 'undefined' && state.profissionais) ? state.profissionais : [];
      var p = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i] && String(list[i].id) === String(profId)) { p = list[i]; break; }
      }
      var f = p && p.bp_fin;
      if (typeof f === 'string') {
        try { f = JSON.parse(f); } catch (e) { f = null; }
      }
      if ((!f || typeof f !== 'object')) {
        var ls = _bpFinLsReadAll()[String(profId)];
        if (ls && typeof ls === 'object') f = ls;
      }
      if (!f || typeof f !== 'object') return _emptyFin();
      var base = _emptyFin();
      for (var k in f) {
        if (Object.prototype.hasOwnProperty.call(f, k)) base[k] = f[k];
      }
      base.comissao_devida = Math.max(0, Number(base.comissao_devida) || 0);
      base.comissao_paga = Math.max(0, Number(base.comissao_paga) || 0);
      base.saldo_pendente = Math.max(0, Number(base.saldo_pendente) || 0);
      base.credito = Math.max(0, Number(base.credito) || 0);
      base.receita_evento = Math.max(0, Number(base.receita_evento) || 0);
      base.bloqueado = !!base.bloqueado;
      base.liberado_apos_meta = !!base.liberado_apos_meta;
      if (base.comissao_paga > base.comissao_devida && base.credito <= 0 && !(Array.isArray(base.credito_lotes) && base.credito_lotes.length)) {
        base.credito = base.comissao_paga - base.comissao_devida;
        base.comissao_paga = base.comissao_devida;
      }
      if (base.comissao_paga > base.comissao_devida) base.comissao_paga = base.comissao_devida;
      base.saldo_pendente = Math.max(0, base.comissao_devida - base.comissao_paga);
      base = _bpFinMigrateLotes(base);
      return base;
    } catch (e) {
      return _emptyFin();
    }
  }

  function bpProfFinSave(profId, fin, opts) {
    opts = opts || {};
    try { fin = _bpFinSyncCreditoTotal(fin || _emptyFin()); } catch (eSync) {}
    var list = (typeof state !== 'undefined' && state.profissionais) ? state.profissionais : [];
    var p = null, idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].id) === String(profId)) { p = list[i]; idx = i; break; }
    }
    if (!p) return false;
    fin = fin || _emptyFin();
    fin.actualizado_em = new Date().toISOString();
    var patch = { bp_fin: fin, updated_at: fin.actualizado_em };
    if (window.BeautyStore && window.BeautyStore.updateInList) {
      window.BeautyStore.updateInList('profissionais', p.id, patch);
    } else if (idx >= 0) {
      state.profissionais[idx] = Object.assign({}, p, patch);
    }
    var toSave = null;
    try {
      toSave = (state.profissionais || []).find(function (x) {
        return x && String(x.id) === String(profId);
      });
    } catch (eF) { toSave = null; }
    if (!toSave) toSave = Object.assign({}, p, patch);

    _bpFinLsWrite(profId, fin);

    function _persist() {
      try {
        if (typeof dbPut === 'function') {
          return Promise.resolve(dbPut('profissionais', toSave)).catch(function (e) {
            try { console.warn('[equipa-fin] dbPut', e); } catch (e2) {}
          });
        }
      } catch (e) {}
      try {
        if (typeof addToSyncQueue === 'function') {
          addToSyncQueue('profissionais', 'upsert', toSave);
        }
      } catch (e3) {}
      return Promise.resolve();
    }
    _persist();

    if (opts.silent) return true;
    try {
      if (typeof renderProfissionais === 'function') renderProfissionais();
    } catch (e3) {}
    return true;
  }

  /** Resolve id estável a partir de id ou nome (evita bypass do gate). */
  function _bpResolveProfId(profIdOrNome) {
    if (profIdOrNome == null || profIdOrNome === '') return null;
    var key = String(profIdOrNome).trim();
    if (!key) return null;
    try {
      var list = (typeof state !== 'undefined' && Array.isArray(state.profissionais)) ? state.profissionais : [];
      var i, p;
      for (i = 0; i < list.length; i++) {
        p = list[i];
        if (p && String(p.id) === key) return String(p.id);
      }
      var low = key.toLowerCase();
      for (i = 0; i < list.length; i++) {
        p = list[i];
        if (p && p.nome && String(p.nome).trim().toLowerCase() === low) return String(p.id);
      }
    } catch (e) {}
    return key;
  }

  function _bpFinIsAdminRole() {
    try {
      var u = state && state.user;
      var r = (u && (u.role || u.perfil || u.tipo)) || (state.config && state.config.role) || '';
      r = String(r).toLowerCase();
      return !r || r === 'admin' || r === 'gerente' || r === 'owner' || r === 'proprietario';
    } catch (e) {
      return true;
    }
  }

  /** true se o profissional NÃO pode iniciar nova venda/agendamento */
  function bpProfEstaBloqueado(profId) {
    var id = _bpResolveProfId(profId);
    if (!id) return false;
    var fin = bpProfFinGet(id);
    return !!(fin && fin.bloqueado);
  }

  function bpProfPodeOperar(profId, opts) {
    opts = opts || {};
    var id = _bpResolveProfId(profId);
    if (!id) return { ok: true };
    if (!bpProfEstaBloqueado(id)) return { ok: true };
    var fin = bpProfFinGet(id);
    var nome = 'Profissional';
    try {
      var pr = (state.profissionais || []).find(function (x) { return x && String(x.id) === String(id); });
      if (pr && pr.nome) nome = pr.nome;
    } catch (e) {}
    return {
      ok: false,
      code: 'PROF_BLOQUEADO',
      message: nome + ' está bloqueado e aguarda autorização do administrador antes da próxima operação.',
      fin: fin,
      profissional_id: id
    };
  }

  /**
   * Abate crédito (política auto_comissao) sobre a comissão bruta de uma venda.
   * Persistência imediata e silenciosa. Não altera bloqueio operacional.
   * @returns {{ comissaoLiquida: number, abatido: number, creditoRestante: number }}
   */
  function bpProfAplicarCreditoNaComissao(profId, comissaoBruta) {
    var bruto = Math.round((Math.max(0, Number(comissaoBruta) || 0)) * 100) / 100;
    var empty = { comissaoLiquida: bruto, abatido: 0, creditoRestante: 0, abatimentos: [] };
    try {
      var id = _bpResolveProfId(profId);
      if (!id || !(bruto > 0)) return empty;
      var fin = bpProfFinGet(id);
      var r = _bpFinAbaterLotesFifo(fin, bruto);
      if (!(r.abatido > 0)) {
        return { comissaoLiquida: bruto, abatido: 0, creditoRestante: Number(r.fin.credito) || 0, abatimentos: [] };
      }
      r.fin.actualizado_em = new Date().toISOString();
      bpProfFinSave(id, r.fin, { silent: true });
      try { if (typeof renderProfissionais === 'function') renderProfissionais(); } catch (eR) {}
      return {
        comissaoLiquida: r.liquida,
        abatido: r.abatido,
        creditoRestante: Number(r.fin.credito) || 0,
        abatimentos: r.abatimentos
      };
    } catch (e) {
      try { console.warn('[equipa-fin] aplicar credito', e); } catch (e2) {}
      return empty;
    }
  }

  /** Restore: prefere lista de abatimentos por lote; fallback valor global (legado). */
  function bpProfRestaurarCreditoDeAbatimento(profId, valorOuLista) {
    try {
      var id = _bpResolveProfId(profId);
      if (!id) return false;
      var fin = bpProfFinGet(id);
      if (Array.isArray(valorOuLista)) {
        fin = _bpFinRestaurarAbatimentos(fin, valorOuLista);
      } else {
        var v = Math.round((Math.max(0, Number(valorOuLista) || 0)) * 100) / 100;
        if (!(v > 0)) return false;
        // Legado sem lote_id → repor no primeiro lote auto ou criar
        var put = false;
        for (var i = 0; i < (fin.credito_lotes || []).length; i++) {
          var L = fin.credito_lotes[i];
          if (L && L.politica === 'auto_comissao') {
            L.restante = Math.round(((Number(L.restante) || 0) + v) * 100) / 100;
            put = true;
            break;
          }
        }
        if (!put) {
          fin = _bpFinAddLote(fin, v, 'auto_comissao', 'Restore cancelamento');
        } else {
          _bpFinSyncCreditoTotal(fin);
        }
      }
      fin.actualizado_em = new Date().toISOString();
      bpProfFinSave(id, fin, { silent: true });
      return true;
    } catch (e) {
      try { console.warn('[equipa-fin] restaurar credito', e); } catch (e2) {}
      return false;
    }
  }

  function bpProfAposVendaMetaCheck(profId) {
    try {
      var id = _bpResolveProfId(profId);
      if (!id || typeof _bpStatsProf !== 'function') return false;
      var s = _bpStatsProf(id, 'total');
      if (!(s.meta > 0) || s.receita < s.meta) return false;

      var fin = bpProfFinGet(id);
      // Meta foi aumentada depois de uma liberação → novo checkpoint possível
      if (fin.liberado_apos_meta && fin.meta_no_libero != null && s.meta > Number(fin.meta_no_libero)) {
        fin.liberado_apos_meta = false;
      }
      if (fin.liberado_apos_meta) return false;
      if (fin.bloqueado && fin.evento_id) {
        try { bpProfFinPromptAdmin(id); } catch (e0) {}
        return true;
      }

      fin.bloqueado = true;
      fin.liberado_apos_meta = false;
      fin.estado = fin.estado === 'regular' || !fin.estado ? 'pendente' : fin.estado;
      fin.receita_evento = s.receita;
      fin.comissao_devida = s.comissao;
      fin.saldo_pendente = Math.max(0, Number(fin.comissao_devida) - Number(fin.comissao_paga || 0));
      fin.evento_id = (typeof uuid === 'function' ? uuid() : ('evt-' + Date.now()));
      fin.actualizado_em = new Date().toISOString();
      // Estado + LS de imediato (gate lê daqui); IDB/sync em seguida
      bpProfFinSave(id, fin, { silent: true });

      var verify = bpProfFinGet(id);
      if (!verify.bloqueado) {
        verify.bloqueado = true;
        verify.evento_id = fin.evento_id;
        verify.estado = fin.estado;
        verify.comissao_devida = fin.comissao_devida;
        verify.receita_evento = fin.receita_evento;
        verify.saldo_pendente = fin.saldo_pendente;
        verify.liberado_apos_meta = false;
        bpProfFinSave(id, verify, { silent: true });
      }

      try {
        if (typeof window !== 'undefined') window.__bpLastVendaMetaBlocked = String(id);
      } catch (eFlag) {}

      try {
        if (typeof renderProfissionais === 'function') renderProfissionais();
      } catch (eR) {}

      try { bpProfFinPromptAdmin(id); } catch (eP) {}
      return true;
    } catch (e) {
      try { console.warn('[equipa-fin] apos venda', e); } catch (e2) {}
      return false;
    }
  }

  var _bpFinUiMode = 'normal'; /* normal | creditar | liquidar */

  function _ensureModalDom() {
    var existing = document.getElementById('modal-prof-fin-controle');
    if (existing) {
      // Actualiza layout de acções se ainda for a estrutura antiga (uma só linha)
      try {
        var act = existing.querySelector('.modal-actions');
        if (act && !document.getElementById('prof-fin-actions')) {
          act.id = 'prof-fin-actions';
          act.style.cssText = 'display:flex;flex-direction:column;gap:8px;width:100%;';
          var row = document.createElement('div');
          row.style.cssText = 'display:flex;flex-wrap:nowrap;gap:8px;width:100%;';
          var bc = document.getElementById('prof-fin-creditar');
          var ba = document.getElementById('prof-fin-autorizar');
          var bm = document.getElementById('prof-fin-manter');
          var bb = document.getElementById('prof-fin-bloquear');
          if (bc) row.appendChild(bc);
          if (ba) row.appendChild(ba);
          if (bm) { bm.style.display = 'none'; row.appendChild(bm); }
          act.innerHTML = '';
          act.appendChild(row);
          if (bb) {
            bb.className = 'btn btn-danger';
            bb.style.width = '100%';
            act.appendChild(bb);
          }
        }
      } catch (eUp) {}
      _bpFinWireActionButtons(existing);
      return;
    }
    var wrap = document.createElement('div');
    wrap.id = 'modal-prof-fin-controle';
    wrap.className = 'modal-overlay';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-labelledby', 'prof-fin-title');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML =
      '<div class="modal-sheet" id="modal-prof-fin-sheet">' +
        '<div class="handle" aria-hidden="true"></div>' +
        '<div id="prof-fin-title" class="modal-title">Controlo financeiro</div>' +
        '<div id="prof-fin-body" class="bp-view-body"></div>' +
        '<div class="modal-actions" id="prof-fin-actions" style="display:flex;flex-direction:column;gap:8px;width:100%;">' +
          '<div style="display:flex;flex-wrap:nowrap;gap:8px;width:100%;">' +
            '<button type="button" class="btn btn-secondary btn-modal-compact" id="prof-fin-creditar" style="flex:1;white-space:nowrap;min-height:40px;font-size:0.8125rem;">Creditar</button>' +
            '<button type="button" class="btn btn-secondary btn-modal-compact" id="prof-fin-liquidar" style="flex:1;white-space:nowrap;min-height:40px;font-size:0.8125rem;">Liquidar crédito</button>' +
            '<button type="button" class="btn btn-secondary btn-modal-compact" id="prof-fin-autorizar" style="flex:1;white-space:nowrap;min-height:40px;font-size:0.8125rem;">Liberar profissional</button>' +
            '<button type="button" class="btn btn-secondary btn-modal-compact" id="prof-fin-manter" style="flex:1;white-space:nowrap;min-height:40px;font-size:0.8125rem;display:none;">Manter bloqueado</button>' +
          '</div>' +
          '<button type="button" class="btn btn-danger btn-modal-compact" id="prof-fin-bloquear" style="width:100%;white-space:nowrap;min-height:40px;font-size:0.8125rem;display:none;">Bloquear profissional</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);
    _bpFinWireActionButtons(wrap);
  }

  function _bpFinWireActionButtons(wrap) {
    if (!wrap) return;
    var actions = wrap.querySelector('.modal-actions') || document.getElementById('prof-fin-actions');
    if (actions && !document.getElementById('prof-fin-liquidar')) {
      var bl = document.createElement('button');
      bl.type = 'button';
      bl.className = 'btn btn-secondary btn-modal-compact';
      bl.id = 'prof-fin-liquidar';
      bl.style.cssText = 'flex:1;white-space:nowrap;min-height:40px;font-size:0.8125rem;';
      bl.textContent = 'Liquidar crédito';
      var ba = document.getElementById('prof-fin-autorizar');
      if (ba && ba.parentNode) ba.parentNode.insertBefore(bl, ba);
      else if (actions.firstChild) actions.firstChild.appendChild(bl);
    }
    if (actions && !document.getElementById('prof-fin-creditar')) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-secondary btn-modal-compact';
      b.id = 'prof-fin-creditar';
      b.textContent = 'Creditar';
      if (actions.firstChild) actions.firstChild.insertBefore(b, actions.firstChild.firstChild);
    }
    var btnCred = document.getElementById('prof-fin-creditar');
    var btnLiq = document.getElementById('prof-fin-liquidar');
    var btnManter = document.getElementById('prof-fin-manter');
    var btnBloq = document.getElementById('prof-fin-bloquear');
    var btnAuth = document.getElementById('prof-fin-autorizar');
    if (btnCred) {
      btnCred.onclick = function () {
        var id = wrap.getAttribute('data-prof-id');
        if (_bpFinUiMode === 'creditar') {
          bpProfFinResolver(id, { creditar: true });
        } else {
          _bpFinUiMode = 'creditar';
          bpProfFinOpenModal(id);
        }
      };
    }
    if (btnLiq) {
      btnLiq.onclick = function () {
        var id = wrap.getAttribute('data-prof-id');
        if (_bpFinUiMode === 'liquidar') {
          bpProfFinResolver(id, { liquidar: true });
        } else {
          _bpFinUiMode = 'liquidar';
          bpProfFinOpenModal(id);
        }
      };
    }
    if (btnManter) {
      btnManter.onclick = function () {
        bpProfFinResolver(wrap.getAttribute('data-prof-id'), { autorizar: false });
      };
    }
    if (btnBloq) {
      btnBloq.onclick = function () {
        var id = wrap.getAttribute('data-prof-id');
        if (btnBloq.textContent && btnBloq.textContent.indexOf('Manter') >= 0) {
          bpProfFinResolver(id, { autorizar: false });
        } else {
          bpProfFinResolver(id, { autorizar: false, forcarBloqueio: true });
        }
      };
    }
    if (btnAuth) {
      btnAuth.onclick = function () {
        var id = wrap.getAttribute('data-prof-id');
        if (_bpFinUiMode === 'creditar' || _bpFinUiMode === 'liquidar') {
          _bpFinUiMode = 'normal';
          bpProfFinOpenModal(id);
          return;
        }
        bpProfFinResolver(id, { autorizar: true });
      };
    }
  }

  function bpProfFinCloseModal() {
    var el = document.getElementById('modal-prof-fin-controle');
    if (!el) return;
    _bpFinUiMode = 'normal';
    // Cancela validação de senha em curso (evita gravar após fechar)
    try {
      if (_bpFinPwdTimer) clearTimeout(_bpFinPwdTimer);
      _bpFinPwdTimer = null;
      _bpFinPwdPending = null;
      _bpFinPwdHide();
    } catch (ePwd) {}
    try {
      if (typeof closeModal === 'function') { closeModal('modal-prof-fin-controle'); return; }
    } catch (e) {}
    el.classList.remove('open');
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
    try { document.body.classList.remove('bp-modal-open'); } catch (e2) {}
  }

  var _bpFinPromptAt = 0;
  var _bpFinPromptId = '';

  function bpProfFinPromptAdmin(profId) {
    if (!_bpFinIsAdminRole()) return;
    var id = _bpResolveProfId(profId);
    if (!id) return;
    // Debounce: evita dois modais (check + toast de venda) no mesmo instante
    var now = Date.now();
    if (String(id) === _bpFinPromptId && (now - _bpFinPromptAt) < 1200) return;
    _bpFinPromptAt = now;
    _bpFinPromptId = String(id);
    // Se o modal já está aberto para o mesmo profissional, não reabrir
    try {
      var el = document.getElementById('modal-prof-fin-controle');
      if (el && el.classList.contains('open') && String(el.getAttribute('data-prof-id')) === String(id)) return;
    } catch (e0) {}
    bpProfFinOpenModal(id);
  }

  function _bpFinEstadoLabel(est) {
    var m = { pendente: 'Pendente', parcial: 'Parcial', pago: 'Pago', divida: 'Em dívida', regular: 'Regular' };
    return m[est] || est || '—';
  }

  function _bpFinEstadoStyle(est) {
    // Cores alinhadas ao design system (success / gold / danger / muted)
    if (est === 'pago') return 'color:#2E7D32;font-weight:600;';
    if (est === 'parcial') return 'color:#B8860B;font-weight:600;';
    if (est === 'pendente') return 'color:#C62828;font-weight:600;';
    if (est === 'divida') return 'color:#B71C1C;font-weight:700;';
    return 'color:var(--text-secondary);font-weight:600;';
  }

  function _bpFinAutoGrow(ta) {
    if (!ta) return;
    function grow() {
      ta.style.height = 'auto';
      var h = Math.min(Math.max(ta.scrollHeight, 40), 160);
      ta.style.height = h + 'px';
    }
    ta.addEventListener('input', grow);
    grow();
  }

  function bpProfFinOpenModal(profId) {
    _ensureModalDom();
    var el = document.getElementById('modal-prof-fin-controle');
    var body = document.getElementById('prof-fin-body');
    if (!el || !body) return;
    el.setAttribute('data-prof-id', String(profId));

    var s = typeof _bpStatsProf === 'function' ? _bpStatsProf(profId, 'total') : { receita: 0, comissao: 0, meta: 0 };
    var fin = bpProfFinGet(profId);
    var nome = 'Profissional';
    try {
      var pr = (state.profissionais || []).find(function (x) { return x && String(x.id) === String(profId); });
      if (pr && pr.nome) nome = pr.nome;
    } catch (e) {}
    var fmt = typeof fmtKz === 'function' ? fmtKz : function (v) { return v + ' Kz'; };
    var esc = typeof escHtml === 'function' ? escHtml : function (x) { return String(x == null ? '' : x); };
    var devida = fin.comissao_devida > 0 ? fin.comissao_devida : s.comissao;
    var paga = Math.min(Number(fin.comissao_paga) || 0, devida);
    var saldo = Math.max(0, devida - paga);
    var credito = Number(fin.credito) || 0;

    var isCreditoMode = _bpFinUiMode === 'creditar';
    var isLiquidarMode = _bpFinUiMode === 'liquidar';
    var titleEl = document.getElementById('prof-fin-title');
    if (titleEl) titleEl.textContent = isCreditoMode ? 'Creditar profissional' : 'Controlo financeiro';

    var formHtml;
    if (isCreditoMode) {
      formHtml =
        '<div class="input-group" style="margin-top:14px;margin-bottom:10px;">' +
          '<label class="input-label" for="prof-fin-estado">Situação</label>' +
          '<input type="text" id="prof-fin-estado-display" class="input-field" readonly value="Crédito / adiantamento" style="min-height:40px;padding:8px 12px;font-size:0.875rem;color:var(--text-secondary);">' +
          '<input type="hidden" id="prof-fin-estado" value="pago">' +
        '</div>' +
        '<div class="input-group" style="margin-bottom:10px;">' +
          '<label class="input-label" for="prof-fin-pago">Valor a creditar</label>' +
          '<input type="number" id="prof-fin-pago" class="input-field" min="1" step="1" inputmode="numeric" placeholder="0" style="min-height:40px;padding:8px 12px;font-size:0.875rem;">' +
        '</div>' +
        '<div class="input-group" style="margin-bottom:4px;">' +
          '<label class="input-label" for="prof-fin-obs">Justificação <span style="color:var(--danger,#C62828)">*</span></label>' +
          '<textarea id="prof-fin-obs" class="input-field" rows="1" placeholder="Motivo do crédito" style="min-height:40px;max-height:120px;padding:8px 12px;font-size:0.875rem;resize:none;overflow-y:auto;line-height:1.35;"></textarea>' +
        '</div>';
    } else if (isLiquidarMode) {
      var lotsLiq = (fin.credito_lotes || []).filter(function (L) { return L && Number(L.restante) > 0; });
      var optsLiq = lotsLiq.map(function (L) {
        return '<option value="' + esc(String(L.id)) + '">' +
          fmt(Number(L.restante) || 0) + ' · ' + esc(_bpFinPoliticaCurta(L.politica)) +
          '</option>';
      }).join('');
      formHtml =
        '<div class="input-group" style="margin-top:14px;margin-bottom:10px;">' +
          '<label class="input-label" for="prof-fin-lote">Crédito a liquidar</label>' +
          '<select id="prof-fin-lote" class="input-field" style="min-height:40px;padding:8px 12px;font-size:0.875rem;">' +
            (optsLiq || '<option value=\"\">Sem crédito em aberto</option>') +
          '</select>' +
        '</div>' +
        '<div class="input-group" style="margin-bottom:10px;">' +
          '<label class="input-label" for="prof-fin-pago">Valor a liquidar</label>' +
          '<input type="number" id="prof-fin-pago" class="input-field" min="0" step="1" inputmode="numeric" placeholder="0" style="min-height:40px;padding:8px 12px;font-size:0.875rem;">' +
        '</div>' +
        '<input type="hidden" id="prof-fin-estado" value="pago">' +
        '<div class="input-group" style="margin-bottom:4px;">' +
          '<label class="input-label" for="prof-fin-obs">Justificação <span style="color:var(--danger,#C62828)">*</span></label>' +
          '<textarea id="prof-fin-obs" class="input-field" rows="1" placeholder="Motivo da liquidação" style="min-height:40px;max-height:120px;padding:8px 12px;font-size:0.875rem;resize:none;overflow-y:auto;line-height:1.35;"></textarea>' +
        '</div>';
    } else {
      formHtml =
        '<div class="input-group" style="margin-top:14px;margin-bottom:10px;">' +
          '<label class="input-label" for="prof-fin-estado">Situação da comissão</label>' +
          '<select id="prof-fin-estado" class="input-field" style="min-height:40px;padding:8px 12px;font-size:0.875rem;">' +
            '<option value="pendente"' + (fin.estado === 'pendente' ? ' selected' : '') + '>Pendente</option>' +
            '<option value="parcial"' + (fin.estado === 'parcial' ? ' selected' : '') + '>Parcialmente pago</option>' +
            '<option value="pago"' + (fin.estado === 'pago' ? ' selected' : '') + '>Pago</option>' +
            '<option value="divida"' + (fin.estado === 'divida' ? ' selected' : '') + '>Em dívida</option>' +
          '</select>' +
        '</div>' +
        '<div class="input-group" style="margin-bottom:10px;">' +
          '<label class="input-label" for="prof-fin-pago">Valor pago agora</label>' +
          '<input type="number" id="prof-fin-pago" class="input-field" min="0" step="1" inputmode="numeric" placeholder="0" style="min-height:40px;padding:8px 12px;font-size:0.875rem;">' +
        '</div>' +
        '<div class="input-group" style="margin-bottom:4px;">' +
          '<label class="input-label" for="prof-fin-obs">Justificação <span style="color:var(--danger,#C62828)">*</span></label>' +
          '<textarea id="prof-fin-obs" class="input-field" rows="1" placeholder="Motivo (obrigatório)" style="min-height:40px;max-height:120px;padding:8px 12px;font-size:0.875rem;resize:none;overflow-y:auto;line-height:1.35;">' +
            (fin.observacao ? esc(fin.observacao) : '') +
          '</textarea>' +
        '</div>';
    }

    body.innerHTML =
      '<div class="bp-view-hero-name" style="font-size:1.05rem;margin:0 0 12px;">' + esc(nome) + '</div>' +
      '<div class="bp-view-dl">' +
        '<div class="bp-view-row"><span class="bp-view-label">Receita</span><span class="bp-view-value">' + fmt(s.receita) + '</span></div>' +
        '<div class="bp-view-row"><span class="bp-view-label">Meta</span><span class="bp-view-value">' + fmt(s.meta) + '</span></div>' +
        '<div class="bp-view-row"><span class="bp-view-label">Comissão</span><span class="bp-view-value">' + fmt(devida) + '</span></div>' +
        '<div class="bp-view-row"><span class="bp-view-label">Pago</span><span class="bp-view-value">' + fmt(paga) + '</span></div>' +
        '<div class="bp-view-row"><span class="bp-view-label">Pendente</span><span class="bp-view-value" style="' + _bpFinEstadoStyle(saldo > 0 ? 'pendente' : 'pago') + '">' + fmt(saldo) + '</span></div>' +
        (credito > 0
          ? '<div class="bp-view-row"><span class="bp-view-label">Crédito</span><span class="bp-view-value" style="color:#2E7D32;font-weight:600;">' + fmt(credito) + '</span></div>'
          : '') +
      '</div>' +
      (function () {
        var lots = (fin.credito_lotes || []).filter(function (L) { return L && Number(L.restante) > 0; });
        if (!lots.length) return '';
        var h = '<div style="margin:10px 0 4px;padding-top:8px;border-top:1px solid var(--border-soft,#E8E4DC);">';
        h += '<div style="font-size:0.6875rem;font-weight:600;color:var(--text-secondary);margin-bottom:6px;">HISTÓRICO DE CRÉDITO</div>';
        for (var li = 0; li < lots.length; li++) {
          var L = lots[li];
          h += '<div style="font-size:0.75rem;line-height:1.4;margin-bottom:4px;color:var(--text-primary);">';
          h += '<span style="font-weight:600;color:#2E7D32;">' + fmt(Number(L.restante) || 0) + '</span>';
          h += ' · ' + esc(_bpFinPoliticaCurta(L.politica));
          if (L.criado_em) h += ' · ' + esc(String(L.criado_em).slice(0, 10));
          h += '</div>';
        }
        return h + '</div>';
      })() +
      formHtml +
      '<div id="prof-fin-pwd-box" style="display:none;margin-top:12px;padding-top:10px;border-top:1px solid var(--border-soft,#E8E4DC);">' +
        '<p style="margin:0 0 6px;font-size:0.75rem;color:var(--text-secondary);font-weight:500;line-height:1.3;">Valide a tua senha para continuar</p>' +
        '<div class="input-group" style="margin-bottom:4px;">' +
          '<input type="password" id="prof-fin-pwd" class="input-field" autocomplete="current-password" placeholder="Palavra-passe" style="min-height:40px;height:40px;padding:8px 12px;font-size:0.875rem;">' +
        '</div>' +
        '<p id="prof-fin-pwd-status" style="margin:0;font-size:0.6875rem;min-height:1em;color:var(--text-muted);"></p>' +
      '</div>';

    setTimeout(function () {
      _bpFinAutoGrow(document.getElementById('prof-fin-obs'));
    }, 0);

    // Linha 1: Creditar | Liquidar | Liberar — Linha 2: Bloquear (vermelho) / Manter
    try {
      var btnCred = document.getElementById('prof-fin-creditar');
      var btnLiq = document.getElementById('prof-fin-liquidar');
      var btnManter = document.getElementById('prof-fin-manter');
      var btnBloq = document.getElementById('prof-fin-bloquear');
      var btnAuth = document.getElementById('prof-fin-autorizar');
      var isBloq = !!(fin && fin.bloqueado);
      var compact = 'btn btn-secondary btn-modal-compact';
      if (btnCred) {
        btnCred.style.display = (isCreditoMode || isLiquidarMode) ? (isCreditoMode ? '' : 'none') : '';
        btnCred.textContent = isCreditoMode ? 'Confirmar crédito' : 'Creditar';
        btnCred.className = compact;
      }
      if (btnLiq) {
        var hasCred = (Number(fin.credito) || 0) > 0;
        btnLiq.style.display = isCreditoMode ? 'none' : (isLiquidarMode ? '' : (hasCred ? '' : 'none'));
        btnLiq.textContent = isLiquidarMode ? 'Confirmar liquidação' : 'Liquidar crédito';
        btnLiq.className = compact;
      }
      if (btnAuth) {
        if (isCreditoMode || isLiquidarMode) {
          btnAuth.style.display = '';
          btnAuth.textContent = 'Voltar';
          btnAuth.className = compact;
          btnAuth.onclick = function () {
            _bpFinUiMode = 'normal';
            bpProfFinOpenModal(el.getAttribute('data-prof-id'));
          };
        } else {
          btnAuth.style.display = '';
          btnAuth.textContent = 'Liberar profissional';
          btnAuth.className = compact;
          btnAuth.onclick = function () {
            bpProfFinResolver(el.getAttribute('data-prof-id'), { autorizar: true });
          };
        }
      }
      if (btnManter) btnManter.style.display = 'none';
      if (btnBloq) {
        if (isCreditoMode || isLiquidarMode) {
          btnBloq.style.display = 'none';
        } else if (isBloq) {
          btnBloq.style.display = '';
          btnBloq.textContent = 'Manter bloqueado';
          btnBloq.className = compact;
          btnBloq.style.width = '100%';
        } else {
          btnBloq.style.display = '';
          btnBloq.textContent = 'Bloquear profissional';
          btnBloq.className = 'btn btn-danger btn-modal-compact';
          btnBloq.style.width = '100%';
          btnBloq.style.minHeight = '40px';
          btnBloq.style.fontSize = '0.8125rem';
        }
      }
    } catch (eBtn) {}


    try {
      if (typeof openModal === 'function') openModal('modal-prof-fin-controle');
      else {
        el.classList.add('open');
        el.style.display = 'flex';
        el.setAttribute('aria-hidden', 'false');
      }
    } catch (eOpen) {
      el.classList.add('open');
      el.style.display = 'flex';
    }
  }

  var _bpFinPwdTimer = null;
  var _bpFinPwdPending = null;

  function _bpFinGuide(msg, fieldId) {
    msg = String(msg || 'Verifique os dados.');
    try {
      if (typeof bpNotifyFormError === 'function') {
        bpNotifyFormError(msg, fieldId, 'warning');
        return;
      }
    } catch (e0) {}
    try {
      if (typeof mostrarErro === 'function') {
        mostrarErro(msg, null, 'Atenção', fieldId ? function () {
          var el = document.getElementById(fieldId);
          if (el) try { el.focus(); } catch (e) {}
        } : null, { okLabel: 'Entendi' });
        return;
      }
    } catch (e1) {}
    if (typeof toast === 'function') toast(msg, 'warning');
  }

  function _bpFinReadForm() {
    var obsEl = document.getElementById('prof-fin-obs');
    var estEl = document.getElementById('prof-fin-estado');
    var pagoEl = document.getElementById('prof-fin-pago');
    var obs = obsEl ? String(obsEl.value || '').trim() : '';
    var estado = estEl ? String(estEl.value || 'pendente') : 'pendente';
    if (ESTADOS.indexOf(estado) < 0) estado = 'pendente';
    var pagoAgora = pagoEl && pagoEl.value !== '' ? Number(pagoEl.value) : 0;
    if (isNaN(pagoAgora) || pagoAgora < 0) pagoAgora = 0;
    return { obs: obs, estado: estado, pagoAgora: pagoAgora, obsEl: obsEl, pagoEl: pagoEl, estEl: estEl };
  }

  /** Saldo de comissão ainda em dívida (ignora crédito já separado). */
  function _bpFinFalta(fin, stats) {
    var devida = Number(fin.comissao_devida) || (stats && stats.comissao) || 0;
    var jaPago = Number(fin.comissao_paga) || 0;
    var pagoComissao = Math.min(jaPago, devida);
    return Math.max(0, devida - pagoComissao);
  }

  /** Regras de negócio antes de senha / gravação */
  function _bpFinValidateForm(form, fin, stats) {
    if (!form.obs) {
      return { ok: false, message: 'Indique a justificação.', field: 'prof-fin-obs' };
    }
    var devida = Number(fin.comissao_devida) || (stats && stats.comissao) || 0;
    var pagoAgora = form.pagoAgora;
    var falta = _bpFinFalta(fin, stats);

    if (form.estado === 'parcial') {
      if (!(pagoAgora > 0)) {
        return { ok: false, message: 'Em Parcial indique o valor pago agora.', field: 'prof-fin-pago' };
      }
      // Exactamente o saldo → deve usar Pago; acima do saldo → adiantamento (confirmado a seguir)
      if (falta > 0 && pagoAgora >= falta && pagoAgora <= falta + 0.001) {
        return { ok: false, message: 'Valor cobre o total. Use o estado Pago.', field: 'prof-fin-estado' };
      }
    }
    if (form.estado === 'pago') {
      if (falta > 0 && pagoAgora > 0 && pagoAgora < falta) {
        return { ok: false, message: 'Em Pago o valor tem de liquidar o saldo (ou deixar vazio para liquidar na íntegra).', field: 'prof-fin-pago' };
      }
    }
    if (form.estado === 'pendente' || form.estado === 'divida') {
      if (pagoAgora > 0) {
        return { ok: false, message: 'Com este estado deixe o valor pago a zero. Para pagar ou adiantar, use Parcial ou Pago.', field: 'prof-fin-pago' };
      }
    }
    return { ok: true };
  }

  function _bpFinProfNome(profId) {
    try {
      var list = (state && state.profissionais) ? state.profissionais : [];
      for (var i = 0; i < list.length; i++) {
        if (list[i] && String(list[i].id) === String(profId) && list[i].nome) return String(list[i].nome);
      }
    } catch (e) {}
    return 'Profissional';
  }

  /** Modal de adiantamento / crédito (tipologia ink da plataforma) */
  function _bpFinAdiantamentoCopy(profId, fin, stats, pagoAgora) {
    var fmt = typeof fmtKz === 'function' ? fmtKz : function (v) { return v + ' Kz'; };
    var nome = _bpFinProfNome(profId);
    var devida = Number(fin.comissao_devida) || (stats && stats.comissao) || 0;
    var falta = _bpFinFalta(fin, stats);
    var excesso = Math.max(0, Number(pagoAgora) - falta);
    return {
      title: 'Pagamento acima do saldo',
      message:
        'Está a registar um valor superior ao que se deve a ' + nome + '.\n\n' +
        'Saldo em dívida: ' + fmt(falta) + '\n' +
        'Valor a registar agora: ' + fmt(pagoAgora) + '\n' +
        'Crédito a favor de ' + nome + ': ' + fmt(excesso) + '\n\n' +
        'O excesso fica como crédito do profissional (a casa fica a dever este valor). ' +
        'A comissão em aberto, se existir, é liquidada; o restante entra na linha de crédito. ' +
        'Vendas e marcações já registadas não são alteradas.',
      confirmLabel: 'Entendi',
      cancelLabel: 'Voltar'
    };
  }

  function _bpFinEnsureAnimStyle() {
    if (document.getElementById('bp-fin-anim-style')) return;
    var s = document.createElement('style');
    s.id = 'bp-fin-anim-style';
    s.textContent =
      '@keyframes bpFinFadeSwap{0%{opacity:1;transform:translateY(0)}40%{opacity:0;transform:translateY(-4px)}100%{opacity:1;transform:translateY(0)}}' +
      '.bp-fin-flash{animation:bpFinFadeSwap .55s ease;}' +
      '@keyframes bpFinNum{0%{opacity:.35}100%{opacity:1}}' +
      '.bp-fin-flash-num{animation:bpFinNum .45s ease;}';
    document.head.appendChild(s);
  }

  function _bpFinRefreshFicha(profId) {
    try {
      if (typeof renderProfissionais === 'function') renderProfissionais();
    } catch (e0) {}
    try {
      if (typeof abrirDetalheProfView === 'function') {
        abrirDetalheProfView(profId);
      }
    } catch (e1) {}
    setTimeout(function () {
      try {
        _bpFinEnsureAnimStyle();
        var body = document.getElementById('prof-view-body');
        if (!body) return;
        var rows = body.querySelectorAll('.bp-view-row');
        for (var i = 0; i < rows.length; i++) {
          var lab = rows[i].querySelector('.bp-view-label');
          if (!lab) continue;
          var tlab = String(lab.textContent || '').toLowerCase();
          if (tlab.indexOf('estado') >= 0 || tlab.indexOf('saldo') >= 0 || tlab.indexOf('observa') >= 0 || tlab.indexOf('opera') >= 0) {
            var val = rows[i].querySelector('.bp-view-value');
            rows[i].classList.add('bp-fin-flash');
            if (val) val.classList.add('bp-fin-flash-num');
          }
        }
        var btnFin = document.getElementById('prof-fin-open-btn');
        if (btnFin) {
          btnFin.onclick = function () {
            if (typeof bpProfFinOpenModal === 'function') bpProfFinOpenModal(profId);
          };
        }
      } catch (e2) {}
    }, 40);
  }

  function _bpFinPwdHide() {
    var box = document.getElementById('prof-fin-pwd-box');
    if (box) {
      box.style.display = 'none';
      try { box.classList.remove('bp-fin-pwd-active'); } catch (eA) {}
    }
    var inp = document.getElementById('prof-fin-pwd');
    if (inp) { inp.value = ''; inp.classList.remove('bp-field-invalid'); }
    var st = document.getElementById('prof-fin-pwd-status');
    if (st) { st.textContent = ''; st.style.color = ''; }
    _bpFinPwdPending = null;
  }

  function _bpFinPwdShow() {
    var box = document.getElementById('prof-fin-pwd-box');
    if (!box) return;
    box.style.display = 'block';
    var inp = document.getElementById('prof-fin-pwd');
    if (inp) setTimeout(function () { try { inp.focus(); } catch (e) {} }, 80);
  }

  async function _bpFinVerifyAdminPassword(password) {
    password = String(password || '');
    if (!password) return { ok: false, empty: true };
    try {
      if (typeof supabaseClient === 'undefined' || !supabaseClient || !supabaseClient.auth) {
        return { ok: false, message: 'Autenticação indisponível.' };
      }
      var email = '';
      try {
        var res = await supabaseClient.auth.getSession();
        email = res && res.data && res.data.session && res.data.session.user
          ? (res.data.session.user.email || '') : '';
      } catch (eS) { email = ''; }
      if (!email) {
        try { if (state && state.user && state.user.email) email = String(state.user.email); } catch (eU) {}
      }
      if (!email) return { ok: false, message: 'Sessão sem email. Volte a entrar.' };
      var result = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
      if (result && result.error) return { ok: false, message: 'Senha incorrecta.' };
      return { ok: true };
    } catch (e) {
      return { ok: false, message: 'Não foi possível validar.' };
    }
  }

  function _bpFinOnPwdInput() {
    var inp = document.getElementById('prof-fin-pwd');
    var st = document.getElementById('prof-fin-pwd-status');
    if (!inp) return;
    if (_bpFinPwdTimer) clearTimeout(_bpFinPwdTimer);
    if (st) { st.textContent = ''; st.style.color = 'var(--text-muted)'; }
    try { inp.classList.remove('bp-field-invalid'); } catch (e0) {}
    // Só inicia validação automática a partir do 6.º dígito (não no 4.º)
    var len = String(inp.value || '').length;
    if (len < 6) return;
    if (!_bpFinPwdPending) {
      if (st) { st.textContent = 'Confirme primeiro a acção.'; st.style.color = '#C62828'; }
      return;
    }
    if (st) st.textContent = 'A validar…';
    _bpFinPwdTimer = setTimeout(async function () {
      try {
        var current = document.getElementById('prof-fin-pwd');
        if (!current) return;
        // Revalida comprimento no momento do disparo (evita corrida ao apagar dígitos)
        if (String(current.value || '').length < 6) return;
        if (!_bpFinPwdPending) return;
        var r = await _bpFinVerifyAdminPassword(current.value);
        if (!document.getElementById('prof-fin-pwd')) return;
        if (r.empty) return;
        if (!r.ok) {
          if (st) { st.textContent = r.message || 'Senha incorrecta.'; st.style.color = '#C62828'; }
          try { current.classList.add('bp-field-invalid'); } catch (e) {}
          return;
        }
        try { current.classList.remove('bp-field-invalid'); } catch (e2) {}
        if (st) { st.textContent = 'Validado'; st.style.color = '#2E7D32'; }
        var pending = _bpFinPwdPending;
        _bpFinPwdPending = null;
        if (pending) {
          var po = pending.opts || {};
          bpProfFinResolver(pending.profId, Object.assign({}, po, {
            _pwdOk: true,
            _confirmed: true,
            _adiantamentoOk: !!po._adiantamentoOk,
            _politicaOk: !!po._politicaOk,
            credito_politica: po.credito_politica || null,
            creditar: !!po.creditar
          }));
        }
      } catch (eRun) {
        try {
          if (st) { st.textContent = 'Não foi possível validar. Tente de novo.'; st.style.color = '#C62828'; }
        } catch (e3) {}
      }
    }, 450);
  }

  /**
   * Confirmação antes de senha — linguagem clara, sem jargão técnico.
   * CTA principal: «Entendi» (nas duas acções).
   */
  function _bpFinConfirmCopy(opts) {
    if (opts && opts.autorizar) {
      return {
        title: 'Liberar profissional?',
        message:
          'Ao confirmar, este profissional volta a poder registar vendas e agendamentos (fica liberado).\n\n' +
          'A alteração será aplicada e a sincronização será feita em todos os dispositivos ligados a este salão.\n\n' +
          'Enquanto estiver autorizado, pode operar até que você volte a bloquear.',
        confirmLabel: 'Entendi',
        cancelLabel: 'Voltar'
      };
    }
    return {
      title: 'Bloquear profissional?',
      message:
        'Ao confirmar, este profissional fica bloqueado: deixa de poder registar vendas e agendamentos e de exercer estas funções até que você autorize de novo.\n\n' +
        'A alteração será aplicada e a sincronização será feita em todos os dispositivos ligados a este salão.\n\n' +
        'Vendas e marcações já registadas não são anuladas — só ficam impedidas as próximas operações.',
      confirmLabel: 'Entendi',
      cancelLabel: 'Voltar'
    };
  }

  /**
   * Passo obrigatório antes da senha quando há crédito novo:
   * três opções exclusivas (quadrado) + Continuar.
   */
  function _bpFinShowPoliticaStep(id, opts) {
    opts = opts || {};
    var body = document.getElementById('prof-fin-body');
    if (!body) {
      opts._politicaOk = true;
      opts.credito_politica = 'pendente_admin';
      bpProfFinResolver(id, opts);
      return;
    }
    var nome = _bpFinProfNome(id);
    var fmt = typeof fmtKz === 'function' ? fmtKz : function (v) { return v + ' Kz'; };
    var fin = bpProfFinGet(id);
    var s = typeof _bpStatsProf === 'function' ? _bpStatsProf(id, 'total') : {};
    var form = _bpFinReadForm();
    var falta = _bpFinFalta(fin, s);
    var excesso = Math.max(0, Number(form.pagoAgora) - falta);
    var box = document.getElementById('prof-fin-politica-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'prof-fin-politica-box';
      body.appendChild(box);
    }
    box.style.cssText = 'display:block;margin-top:14px;padding-top:12px;border-top:1px solid var(--border-soft,#E8E4DC);';
    try {
      var actHide = document.getElementById('prof-fin-actions');
      if (actHide) actHide.style.display = 'none';
    } catch (eH) {}
    box.innerHTML =
      '<p style="margin:0 0 10px;font-size:0.8125rem;font-weight:600;color:var(--text-primary);line-height:1.35;">' +
        'Como quer tratar o crédito de ' + (typeof escHtml === 'function' ? escHtml(nome) : nome) +
        (excesso > 0 ? ' (' + fmt(excesso) + ')' : '') + '?</p>' +
      '<p style="margin:0 0 12px;font-size:0.75rem;color:var(--text-secondary);line-height:1.4;">' +
        'Escolha uma opção. É obrigatório seleccionar antes de continuar.</p>' +
      '<label class="bp-fin-pol-opt" style="display:flex;gap:10px;align-items:flex-start;margin:0 0 12px;cursor:pointer;">' +
        '<input type="checkbox" class="bp-fin-pol-cb" data-pol="auto_comissao" style="margin-top:3px;width:16px;height:16px;flex-shrink:0;">' +
        '<span style="font-size:0.75rem;line-height:1.45;color:var(--text-primary);">' +
          '<strong style="font-weight:600;">Descontar automaticamente nas comissões futuras.</strong> ' +
          'Enquanto houver crédito, cada comissão nova de ' + (typeof escHtml === 'function' ? escHtml(nome) : nome) +
          ' é abatida a este saldo. Quando chegar a zero, o desconto pára sozinho.' +
        '</span></label>' +
      '<label class="bp-fin-pol-opt" style="display:flex;gap:10px;align-items:flex-start;margin:0 0 12px;cursor:pointer;">' +
        '<input type="checkbox" class="bp-fin-pol-cb" data-pol="pendente_admin" style="margin-top:3px;width:16px;height:16px;flex-shrink:0;">' +
        '<span style="font-size:0.75rem;line-height:1.45;color:var(--text-primary);">' +
          '<strong style="font-weight:600;">Deixar pendente até autorização administrativa.</strong> ' +
          'O crédito fica registado, mas nada é descontado nas vendas. Só um administrador decide depois abater, pagar ou mudar a regra.' +
        '</span></label>' +
      '<label class="bp-fin-pol-opt" style="display:flex;gap:10px;align-items:flex-start;margin:0 0 14px;cursor:pointer;">' +
        '<input type="checkbox" class="bp-fin-pol-cb" data-pol="manual" style="margin-top:3px;width:16px;height:16px;flex-shrink:0;">' +
        '<span style="font-size:0.75rem;line-height:1.45;color:var(--text-primary);">' +
          '<strong style="font-weight:600;">Liquidação manual, fora das comissões.</strong> ' +
          'O crédito mantém-se como valor a favor do profissional. Só muda quando alguém registar explicitamente uma liquidação no controlo financeiro — sem desconto automático.' +
        '</span></label>' +
      '<button type="button" class="btn btn-secondary" id="prof-fin-politica-continuar" style="width:100%;min-height:44px;">Continuar</button>' +
      '<p id="prof-fin-politica-err" style="margin:8px 0 0;font-size:0.6875rem;color:#C62828;min-height:1em;"></p>';

    var cbs = box.querySelectorAll('.bp-fin-pol-cb');
    for (var i = 0; i < cbs.length; i++) {
      cbs[i].onchange = function () {
        if (!this.checked) return;
        for (var j = 0; j < cbs.length; j++) {
          if (cbs[j] !== this) cbs[j].checked = false;
        }
        var err = document.getElementById('prof-fin-politica-err');
        if (err) err.textContent = '';
      };
    }
    var btnGo = document.getElementById('prof-fin-politica-continuar');
    if (btnGo) {
      btnGo.onclick = function () {
        var chosen = null;
        for (var k = 0; k < cbs.length; k++) {
          if (cbs[k].checked) { chosen = cbs[k].getAttribute('data-pol'); break; }
        }
        var err = document.getElementById('prof-fin-politica-err');
        if (!chosen) {
          if (err) err.textContent = 'Seleccione uma das três opções para continuar.';
          return;
        }
        box.style.display = 'none';
        try {
          var actShow = document.getElementById('prof-fin-actions');
          if (actShow) actShow.style.display = 'flex';
        } catch (eS2) {}
        bpProfFinResolver(id, Object.assign({}, opts, {
          _politicaOk: true,
          credito_politica: chosen,
          _adiantamentoOk: true,
          _confirmed: opts.creditar ? true : opts._confirmed
        }));
      };
    }
    try {
      if (typeof box.scrollIntoView === 'function') box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch (eS) {}
  }

  /** Pede senha (padrão único para autorizar e bloquear) — campo fixo e legível */
  function _bpFinRequestPassword(id, opts) {
    _bpFinPwdPending = {
      profId: id,
      opts: Object.assign({}, opts || {}, { _confirmed: true })
    };
    var box = document.getElementById('prof-fin-pwd-box');
    var inp = document.getElementById('prof-fin-pwd');
    var st = document.getElementById('prof-fin-pwd-status');
    _bpFinPwdShow();
    if (box) {
      try { box.classList.add('bp-fin-pwd-active'); } catch (eA) {}
      box.style.display = 'block';
    }
    if (inp && !inp._bpBound) {
      inp._bpBound = true;
      inp.addEventListener('input', _bpFinOnPwdInput);
      inp.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          if (_bpFinPwdTimer) clearTimeout(_bpFinPwdTimer);
          _bpFinOnPwdInput();
        }
      });
    }
    if (inp) {
      inp.value = '';
      try { inp.setAttribute('placeholder', 'Palavra-passe'); } catch (eP) {}
    }
    if (st) {
      st.textContent = 'Introduza a senha para confirmar.';
      st.style.color = 'var(--text-secondary, #5a554c)';
      st.style.fontSize = '0.6875rem';
    }
    if (box) {
      var hint = box.querySelector('p');
      if (hint && hint.id !== 'prof-fin-pwd-status') {
        hint.textContent = 'Valide a tua senha para continuar';
        try {
          hint.style.fontSize = '0.75rem';
          hint.style.fontWeight = '500';
          hint.style.color = 'var(--text-secondary, #5a554c)';
        } catch (eH) {}
      }
    }
    // Depois do fecho do modal de confirmação — foca e centra o campo (não só um “piscar”)
    setTimeout(function () {
      try {
        if (box) {
          box.style.display = 'block';
          box.classList.add('bp-fin-pwd-active');
          if (typeof box.scrollIntoView === 'function') {
            box.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        }
        if (inp && typeof inp.focus === 'function') inp.focus();
      } catch (eF) {}
    }, 320);
    setTimeout(function () {
      try {
        if (inp && typeof inp.focus === 'function') inp.focus();
      } catch (eF2) {}
    }, 520);
  }

  function bpProfFinResolver(profId, opts) {
    opts = opts || {};
    var id = _bpResolveProfId(profId);
    if (!id) {
      _bpFinGuide('Profissional não encontrado.');
      return;
    }
    // Creditar / bloquear / autorizar: só admin/gerente
    if ((opts.creditar || opts.liquidar || opts.autorizar || opts.forcarBloqueio || opts.autorizar === false) && !_bpFinIsAdminRole()) {
      _bpFinGuide('Apenas administrador ou gerente pode alterar o controlo financeiro.');
      return;
    }
    var form = _bpFinReadForm();
    var fin = bpProfFinGet(id);
    var s = typeof _bpStatsProf === 'function' ? _bpStatsProf(id, 'total') : { comissao: 0, meta: 0, receita: 0 };
    if (!(fin.comissao_devida > 0)) fin.comissao_devida = s.comissao || 0;

    // Modo creditar: exige valor > 0 e trata como pagamento/crédito (estado pago)
    if (opts.creditar) {
      form.estado = 'pago';
      if (!(form.pagoAgora > 0)) {
        _bpFinGuide('Indique o valor a creditar.', 'prof-fin-pago');
        return;
      }
    }
    if (opts.liquidar) {
      form.estado = 'pago';
      if (!(form.pagoAgora > 0)) {
        _bpFinGuide('Indique o valor a liquidar.', 'prof-fin-pago');
        return;
      }
    }

    var v = _bpFinValidateForm(form, fin, s);
    if (!v.ok) {
      _bpFinGuide(v.message, v.field);
      if (v.field) {
        var fel = document.getElementById(v.field);
        if (fel) try { fel.focus(); fel.classList.add('bp-field-invalid'); } catch (e) {}
      }
      return;
    }

    var falta0 = _bpFinFalta(fin, s);
    var pagoAgora0 = form.pagoAgora;
    var isOverpay = pagoAgora0 > falta0 + 0.001;

    // 0) Adiantamento / crédito — se paga acima do saldo (ou modo Creditar com excesso)
    if (!opts.liquidar && isOverpay && !opts._adiantamentoOk) {
      var copyAd = _bpFinAdiantamentoCopy(id, fin, s, pagoAgora0);
      var resumeAd = function () {
        bpProfFinResolver(id, Object.assign({}, opts, { _adiantamentoOk: true }));
      };
      if (typeof showConfirmModal === 'function') {
        Promise.resolve(
          showConfirmModal(copyAd.title, copyAd.message, false, {
            confirmLabel: copyAd.confirmLabel,
            cancelLabel: copyAd.cancelLabel,
            variant: 'default',
            inkButtons: true
          })
        )
          .then(function (ok) {
            if (ok) resumeAd();
          })
          .catch(function () {});
        return;
      }
      try {
        if (typeof window !== 'undefined' && window.confirm && !window.confirm(copyAd.title + '\n\n' + copyAd.message)) {
          return;
        }
      } catch (eAd) {}
      opts = Object.assign({}, opts, { _adiantamentoOk: true });
    }

    // 0b) Liquidar crédito — confirmação
    if (opts.liquidar && !opts._confirmed) {
      var fmtL = typeof fmtKz === 'function' ? fmtKz : function (v) { return v + ' Kz'; };
      var nomeL = _bpFinProfNome(id);
      var copyLiq = {
        title: 'Confirmar liquidação?',
        message:
          'Vai liquidar ' + fmtL(pagoAgora0) + ' do crédito de ' + nomeL + '.\n\n' +
          'O valor sai do lote escolhido. Esta acção não altera o bloqueio de operações.',
        confirmLabel: 'Entendi',
        cancelLabel: 'Voltar'
      };
      if (typeof showConfirmModal === 'function') {
        Promise.resolve(
          showConfirmModal(copyLiq.title, copyLiq.message, false, {
            confirmLabel: copyLiq.confirmLabel,
            cancelLabel: copyLiq.cancelLabel,
            variant: 'default',
            inkButtons: true
          })
        )
          .then(function (ok) {
            if (ok) bpProfFinResolver(id, Object.assign({}, opts, { _confirmed: true, _adiantamentoOk: true, _politicaOk: true }));
          })
          .catch(function () {});
        return;
      }
      opts = Object.assign({}, opts, { _confirmed: true, _adiantamentoOk: true, _politicaOk: true });
    }

    // 0c) Creditar sem excesso — confirmação dedicada
    if (opts.creditar && !isOverpay && !opts._adiantamentoOk && !opts._confirmed) {
      var fmtC = typeof fmtKz === 'function' ? fmtKz : function (v) { return v + ' Kz'; };
      var nomeC = _bpFinProfNome(id);
      var copyCred = {
        title: 'Confirmar crédito?',
        message:
          'Vai registar ' + fmtC(pagoAgora0) + ' a favor de ' + nomeC + '.\n\n' +
          (falta0 > 0
            ? 'Saldo em dívida: ' + fmtC(falta0) + '. O valor liquida (ou reduz) essa dívida.\n\n'
            : 'Não há saldo de comissão em aberto — o valor entra como crédito do profissional.\n\n') +
          'A alteração será aplicada e a sincronização será feita em todos os dispositivos ligados a este salão.',
        confirmLabel: 'Entendi',
        cancelLabel: 'Voltar'
      };
      if (typeof showConfirmModal === 'function') {
        Promise.resolve(
          showConfirmModal(copyCred.title, copyCred.message, false, {
            confirmLabel: copyCred.confirmLabel,
            cancelLabel: copyCred.cancelLabel,
            variant: 'default',
            inkButtons: true
          })
        )
          .then(function (ok) {
            if (ok) bpProfFinResolver(id, Object.assign({}, opts, { _confirmed: true, _adiantamentoOk: true }));
          })
          .catch(function () {});
        return;
      }
      opts = Object.assign({}, opts, { _confirmed: true, _adiantamentoOk: true });
    }

    // 1) Confirmação explícita do efeito (autorizar ou bloquear) — não aplica a só-creditar
    if (!opts.creditar && !opts._confirmed) {
      var copy = _bpFinConfirmCopy(opts);
      var resume = function () {
        bpProfFinResolver(id, Object.assign({}, opts, {
          _confirmed: true,
          _adiantamentoOk: opts._adiantamentoOk || isOverpay
        }));
      };
      if (typeof showConfirmModal === 'function') {
        Promise.resolve(
          showConfirmModal(copy.title, copy.message, false, {
            confirmLabel: copy.confirmLabel,
            cancelLabel: copy.cancelLabel,
            variant: 'default',
            inkButtons: true
          })
        )
          .then(function (ok) {
            if (ok) resume();
          })
          .catch(function () { /* cancelado — nada grava */ });
        return;
      }
      try {
        if (typeof window !== 'undefined' && window.confirm && !window.confirm(copy.title + '\n\n' + copy.message)) {
          return;
        }
      } catch (eC) {}
      opts = Object.assign({}, opts, { _confirmed: true });
    }

    // 1b) Política de liquidação do crédito — obrigatória antes da senha
    var willCreateCredit = !opts.liquidar && pagoAgora0 > falta0 + 0.001;
    if (willCreateCredit && !opts._politicaOk) {
      _bpFinShowPoliticaStep(id, Object.assign({}, opts, {
        _confirmed: true,
        _adiantamentoOk: true
      }));
      return;
    }

    // 2) Senha obrigatória — creditar, autorizar e bloquear
    if (!opts._pwdOk) {
      _bpFinRequestPassword(id, Object.assign({}, opts, {
        _confirmed: true,
        _adiantamentoOk: opts._adiantamentoOk || isOverpay || !!opts.creditar,
        _politicaOk: opts._politicaOk || !willCreateCredit,
        credito_politica: opts.credito_politica || null
      }));
      return;
    }

    var devida = Number(fin.comissao_devida) || 0;
    var jaPago = Number(fin.comissao_paga) || 0;
    var pagoAgora = form.pagoAgora;
    var falta = _bpFinFalta(fin, s);
    var creditoAtual = Math.max(0, Number(fin.credito) || 0);
    // Migração: pagamentos antigos acima da devida sem campo credito
    if (jaPago > devida && creditoAtual <= 0) {
      creditoAtual = jaPago - devida;
      jaPago = devida;
    } else if (jaPago > devida) {
      jaPago = devida;
    }

    // Blindagem: excesso só grava se o modal de crédito foi confirmado
    if (pagoAgora > falta + 0.001 && !opts._adiantamentoOk) {
      _bpFinGuide('Confirme o crédito a favor do profissional antes de gravar.', 'prof-fin-pago');
      return;
    }

    var creditoNovo = 0;
    if (opts.liquidar) {
      var loteId = '';
      try {
        var loteEl = document.getElementById('prof-fin-lote');
        loteId = loteEl ? String(loteEl.value || '') : '';
      } catch (eL) {}
      var liq = _bpFinLiquidarLote(fin, loteId, pagoAgora, form.obs);
      if (!liq.ok) {
        _bpFinGuide(liq.message || 'Não foi possível liquidar.', 'prof-fin-pago');
        return;
      }
      fin = liq.fin;
      creditoNovo = 0;
      fin.observacao = String(form.obs || '').trim();
      fin.actualizado_em = new Date().toISOString();
    } else if (pagoAgora > falta + 0.001) {
      // Liquida comissão em aberto; excesso → NOVO LOTE (não sobrescreve políticas anteriores)
      creditoNovo = Math.round((pagoAgora - falta) * 100) / 100;
      fin.comissao_paga = devida;
      fin.saldo_pendente = 0;
      fin.estado = 'pago';
      var pol = opts.credito_politica || 'pendente_admin';
      fin = _bpFinAddLote(fin, creditoNovo, pol, form.obs);
      var polLab = _bpFinPoliticaLabel(pol);
      var obsBase = String(form.obs || '').trim();
      fin.observacao = obsBase
        ? (obsBase + (polLab ? (' · Crédito: ' + polLab) : ''))
        : (polLab ? ('Crédito: ' + polLab) : obsBase);
    } else if (form.estado === 'pago') {
      if (falta > 0 && !(pagoAgora > 0)) pagoAgora = falta;
      fin.comissao_paga = Math.min(devida, Math.max(jaPago, jaPago + pagoAgora));
      if (fin.comissao_paga > devida) fin.comissao_paga = devida;
      fin.credito = creditoAtual;
      fin.saldo_pendente = Math.max(0, devida - Number(fin.comissao_paga));
      fin.estado = form.estado;
    } else if (form.estado === 'parcial') {
      fin.comissao_paga = Math.min(devida, jaPago + pagoAgora);
      fin.credito = creditoAtual;
      fin.saldo_pendente = Math.max(0, devida - Number(fin.comissao_paga));
      fin.estado = form.estado;
    } else {
      fin.comissao_paga = Math.min(jaPago, devida);
      fin.credito = creditoAtual;
      fin.saldo_pendente = Math.max(0, devida - Number(fin.comissao_paga));
      fin.estado = form.estado;
    }
    fin.comissao_devida = devida;
    fin.credito = Math.max(0, Number(fin.credito) || 0);
    fin.observacao = form.obs;
    fin.actualizado_em = new Date().toISOString();

    // Creditar: não altera bloqueio operacional
    if (!opts.creditar) {
      if (opts.autorizar) {
        fin.bloqueado = false;
        fin.liberado_apos_meta = true;
        fin.meta_no_libero = s.meta || null;
        try {
          var u = state && state.user;
          fin.autorizado_por = (u && (u.email || u.nome || u.id)) || 'admin';
        } catch (e) { fin.autorizado_por = 'admin'; }
        fin.autorizado_em = fin.actualizado_em;
      } else {
        fin.bloqueado = true;
        fin.liberado_apos_meta = false;
        if (opts.forcarBloqueio || !fin.evento_id) {
          if (!fin.evento_id) {
            fin.evento_id = (typeof uuid === 'function' ? uuid() : ('evt-manual-' + Date.now()));
          }
          if (!(fin.comissao_devida > 0)) fin.comissao_devida = s.comissao || 0;
          if (!(fin.receita_evento > 0)) fin.receita_evento = s.receita || 0;
          fin.saldo_pendente = Math.max(0, Number(fin.comissao_devida) - Number(fin.comissao_paga || 0));
          if (!fin.estado || fin.estado === 'regular') fin.estado = form.estado || 'pendente';
        }
      }
    }

    _bpFinPwdHide();
    bpProfFinSave(id, fin, { silent: true });
    if (!opts.creditar && !opts.autorizar && !bpProfEstaBloqueado(id)) {
      fin.bloqueado = true;
      bpProfFinSave(id, fin, { silent: true });
    }
    _bpFinUiMode = 'normal';
    bpProfFinCloseModal();
    _bpFinRefreshFicha(id);
    if (typeof toast === 'function') {
      var fmtT = typeof fmtKz === 'function' ? fmtKz : function (v) { return v + ' Kz'; };
      var msgOk;
      if (opts.liquidar) {
        msgOk = 'Crédito liquidado.';
      } else if (opts.creditar) {
        msgOk = creditoNovo > 0
          ? 'Crédito registado: ' + fmtT(creditoNovo) + '.'
          : 'Pagamento registado.';
      } else if (opts.autorizar) {
        msgOk = 'Profissional liberado.';
        if (creditoNovo > 0) msgOk = 'Crédito registado: ' + fmtT(creditoNovo) + '. ' + msgOk;
      } else {
        msgOk = opts.forcarBloqueio ? 'Profissional bloqueado.' : 'Bloqueio mantido.';
        if (creditoNovo > 0) msgOk = 'Crédito registado: ' + fmtT(creditoNovo) + '. ' + msgOk;
      }
      toast(msgOk, opts.autorizar || opts.creditar ? 'success' : 'warning');
    }
  }

  function bpProfFinHtmlResumo(profId) {
    var fin = bpProfFinGet(profId) || _emptyFin();
    var fmt = typeof fmtKz === 'function' ? fmtKz : function (v) { return v + ' Kz'; };
    var esc = typeof escHtml === 'function' ? escHtml : function (x) { return String(x == null ? '' : x); };
    /* tipografia alinhada às labels da ficha (não “hero”) */
    var valStyle = 'font-size:0.8125rem;font-weight:600;line-height:1.35;';
    var html = '<div class="bp-view-section-title" style="margin-top:12px;">Situação financeira</div><div class="bp-view-dl">';
    html += '<div class="bp-view-row"><span class="bp-view-label">Operações</span><span class="bp-view-value" style="' + valStyle +
      (fin.bloqueado ? 'color:#C62828;">Bloqueadas' : 'color:#2E7D32;">Activas') + '</span></div>';
    if (fin.estado && fin.estado !== 'regular') {
      html += '<div class="bp-view-row"><span class="bp-view-label">Estado</span><span class="bp-view-value" style="' + valStyle + _bpFinEstadoStyle(fin.estado).replace(/font-weight:\s*600;?/g, '').replace(/font-weight:\s*700;?/g, '') + '">' +
        esc(_bpFinEstadoLabel(fin.estado)) + '</span></div>';
    }
    if (fin.saldo_pendente > 0) {
      html += '<div class="bp-view-row"><span class="bp-view-label">Saldo pendente</span><span class="bp-view-value" style="' + valStyle + 'color:#C62828;">' + fmt(fin.saldo_pendente) + '</span></div>';
    }
    if (Number(fin.credito) > 0) {
      html += '<div class="bp-view-row"><span class="bp-view-label">Crédito</span><span class="bp-view-value" style="' + valStyle + 'color:#2E7D32;">' + fmt(Number(fin.credito)) + '</span></div>';
      var lots = (fin.credito_lotes || []).filter(function (L) { return L && Number(L.restante) > 0; });
      for (var ri = 0; ri < lots.length && ri < 4; ri++) {
        html += '<div class="bp-view-row"><span class="bp-view-label">' + esc(_bpFinPoliticaCurta(lots[ri].politica)) +
          '</span><span class="bp-view-value bp-view-value--muted" style="font-size:0.75rem;font-weight:500;">' +
          fmt(Number(lots[ri].restante) || 0) + '</span></div>';
      }
    }
    if (fin.observacao && String(fin.observacao).trim()) {
      html += '<div class="bp-view-row"><span class="bp-view-label">Observação</span><span class="bp-view-value bp-view-value--muted" style="font-size:0.8125rem;font-weight:500;">' +
        esc(String(fin.observacao).slice(0, 280)) + '</span></div>';
    }
    /* Controlo financeiro disponível para TODOS os profissionais */
    html += '<div style="margin-top:8px;">' +
      '<button type="button" class="btn btn-secondary" id="prof-fin-open-btn" style="min-height:44px;display:inline-flex;align-items:center;gap:6px;">' +
      'Controlo financeiro' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>' +
      '</button></div>';
    html += '</div>';
    return html;
  }

  g.bpProfFinGet = bpProfFinGet;
  g.bpProfFinRehydrate = bpProfFinRehydrate;
  g.bpProfFinSave = bpProfFinSave;
  g.bpProfEstaBloqueado = bpProfEstaBloqueado;
  g.bpProfPodeOperar = bpProfPodeOperar;
  g.bpProfAposVendaMetaCheck = bpProfAposVendaMetaCheck;
  g.bpProfAplicarCreditoNaComissao = bpProfAplicarCreditoNaComissao;
  g.bpProfRestaurarCreditoDeAbatimento = bpProfRestaurarCreditoDeAbatimento;
  g.bpProfFinOpenModal = bpProfFinOpenModal;
  g.bpProfFinPromptAdmin = bpProfFinPromptAdmin;
  g.bpProfFinHtmlResumo = bpProfFinHtmlResumo;
  g.bpProfFinCloseModal = bpProfFinCloseModal;
  g._bpResolveProfId = _bpResolveProfId;

  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        setTimeout(function () { try { bpProfFinRehydrate(); } catch (e) {} }, 800);
        setTimeout(function () { try { bpProfFinRehydrate(); } catch (e) {} }, 2500);
      });
    } else {
      setTimeout(function () { try { bpProfFinRehydrate(); } catch (e) {} }, 800);
      setTimeout(function () { try { bpProfFinRehydrate(); } catch (e) {} }, 2500);
    }
  } catch (eBoot) {}
})(typeof window !== 'undefined' ? window : this);

