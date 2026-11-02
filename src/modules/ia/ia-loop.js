/*! BelezaPro — ia-loop.js (Fase 3)
 * Proposta de escrita + Autorizar. Nunca executa write sem clique.
 */
(function (global) {
  'use strict';

  function esc(s) {
    if (typeof global.escHtml === 'function') return global.escHtml(String(s || ''));
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function chatEl() {
    return document.getElementById('ia-chat');
  }

  function parseTel(q) {
    var d = String(q || '').replace(/\D/g, '');
    if (d.length === 9) return d;
    if (d.length === 12 && d.indexOf('244') === 0) return d.slice(3);
    if (d.length > 9) return d.slice(-9);
    return d.length ? d : '';
  }

  function parseNomeCliente(q) {
    var s = String(q || '').trim();
    var m = s.match(/(?:cliente|chama-se|chama|nome)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,40})/i);
    if (m) return m[1].replace(/\d/g, '').trim();
    m = s.match(/criar\s+(?:o\s+)?(?:cliente\s+)?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,40})/i);
    if (m) return m[1].replace(/\d/g, '').trim();
    return '';
  }

  function detectarProposta(pergunta) {
    var q = String(pergunta || '');
    var nq = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var hab = (global.BP_IA_Habilidade && BP_IA_Habilidade.get()) || 'consultor';
    if (hab !== 'construtor') return null;
    var querCriar = /criar|cadastr|novo cliente|adicionar cliente|regist/.test(nq);
    if (!querCriar) return null;
    var nome = parseNomeCliente(q);
    var tel = parseTel(q);
    if (!nome && !tel) return null;
    return {
      tool: 'customer.create',
      dados: { nome: nome, telefone: tel },
      resumo: nome
        ? ('Criar o cliente «' + nome + '»' + (tel ? ' com o contacto ' + tel : '') + '.')
        : ('Criar cliente com o contacto ' + tel + '.')
    };
  }

  function parseToolNaResposta(texto) {
    var raw = String(texto || '');
    var m = raw.match(/BENZA_TOOL\s*:\s*(\{[\s\S]*?\})/);
    if (!m) m = raw.match(/<!--BP_TOOL\s*([\s\S]*?)-->/);
    if (!m) return null;
    try {
      var obj = JSON.parse(m[1]);
      if (obj && obj.tool) return obj;
    } catch (_) {}
    return null;
  }

  function cartaoHtml(prop, id) {
    var dados = prop.dados || {};
    var linhas = [];
    Object.keys(dados).forEach(function (k) {
      if (dados[k] == null || dados[k] === '') return;
      linhas.push('<div class="ia-loop-field"><span>' + esc(k) + '</span><strong>' + esc(dados[k]) + '</strong></div>');
    });
    var incompleto = prop.tool === 'customer.create' && (!dados.nome || !dados.telefone);
    var acoes = incompleto
      ? '<p class="ia-loop-hint">Falta o nome ou o contacto de 9 dígitos. Completa e volta a pedir.</p>'
      : ('<div class="ia-loop-acoes">' +
         '<button type="button" class="btn btn-primary" data-bp-ia-auth="' + id + '">Autorizar</button>' +
         '<button type="button" class="btn" data-bp-ia-deny="' + id + '">Recusar</button>' +
         '</div>');
    return (
      '<div class="ia-loop-card" data-loop-id="' + id + '">' +
      '<p class="ia-loop-resumo">' + esc(prop.resumo || 'Confirma esta operação.') + '</p>' +
      (linhas.length ? ('<div class="ia-loop-fields">' + linhas.join('') + '</div>') : '') +
      acoes +
      '</div>'
    );
  }

  var _store = {};
  var _seq = 0;

  var _lastKey = '';
  function keyOf(prop) {
    try { return String(prop.tool) + ':' + JSON.stringify(prop.dados || {}); }
    catch (_) { return String(prop.tool); }
  }
  function propor(prop, afterEl) {
    if (!prop || !prop.tool) return;
    var k = keyOf(prop);
    if (k && k === _lastKey) return;
    _lastKey = k;
    _seq += 1;
    var id = 'l' + _seq;
    _store[id] = prop;
    var chat = chatEl();
    if (!chat) return;
    var wrap = document.createElement('div');
    wrap.className = 'ia-loop-wrap';
    wrap.innerHTML = cartaoHtml(prop, id);
    if (afterEl && afterEl.parentNode) afterEl.parentNode.appendChild(wrap);
    else chat.appendChild(wrap);
    try { chat.scrollTop = chat.scrollHeight; } catch (_) {}
    return id;
  }

  async function autorizar(id) {
    var prop = _store[id];
    if (!prop) return;
    if (prop.dados && prop.dados.telefone) {
      prop.dados.telefone = parseTel(prop.dados.telefone);
    }
    var tools = global.BenzaTools;
    if (!tools || typeof tools.executar !== 'function') {
      if (typeof toast === 'function') toast('Ferramentas do agente indisponíveis.', 'error');
      return;
    }
    try { window.__bpIaAuthToken = { tool: prop.tool, ts: Date.now() }; } catch (_) {}
    var r;
    try {
      r = await tools.executar(prop.tool, prop.dados || {});
    } catch (e) {
      r = { ok: false, mensagem: e && e.message ? e.message : String(e) };
    }
    var card = document.querySelector('.ia-loop-card[data-loop-id="' + id + '"]');
    var ok = r && r.ok;
    var msg = ok
      ? 'Autorizado. A operação foi concluída.'
      : ((r && r.mensagem) || 'Não foi possível concluir.');
    if (card) {
      card.innerHTML = '<p class="ia-loop-resumo">' + esc(msg) + '</p>';
      card.classList.add(ok ? 'is-ok' : 'is-err');
    }
    delete _store[id];
  }

  function recusar(id) {
    var card = document.querySelector('.ia-loop-card[data-loop-id="' + id + '"]');
    if (card) {
      card.innerHTML = '<p class="ia-loop-resumo">Operação recusada. Nada foi alterado.</p>';
      card.classList.add('is-deny');
    }
    delete _store[id];
  }

  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest && ev.target.closest('[data-bp-ia-auth]');
    if (a) {
      try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}
      autorizar(a.getAttribute('data-bp-ia-auth'));
      return;
    }
    var d = ev.target && ev.target.closest && ev.target.closest('[data-bp-ia-deny]');
    if (d) {
      try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}
      recusar(d.getAttribute('data-bp-ia-deny'));
    }
  }, true);

  global.BP_IA_Loop = {
    detectarProposta: detectarProposta,
    parseToolNaResposta: parseToolNaResposta,
    propor: propor
  };
})(typeof window !== 'undefined' ? window : this);
