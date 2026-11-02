/* BelezaPro B6 — feature fora do monólito; carregar após app.bundle.js */

// ================================================================
// Grupo 2 — Fidelização e Marketing (offline-first)
// F2 Pontos/níveis | F5 Lembretes WhatsApp | F15 Indicação | F17 Push local
// ================================================================
(function () {
  'use strict';

  var NIVEIS = [
    { id: 'bronze', min: 0, label: 'Bronze' },
    { id: 'prata', min: 500, label: 'Prata' },
    { id: 'ouro', min: 2000, label: 'Ouro' },
    { id: 'platina', min: 5000, label: 'Platina' }
  ];

  // 1 ponto por cada 1000 Kz (configurável)
  var PONTOS_POR_KZ = 1000;
  var BONUS_INDICACAO = 50;

  function pontosDeValor(valor) {
    return Math.floor((Number(valor) || 0) / PONTOS_POR_KZ);
  }

  function nivelDePontos(pts) {
    var n = NIVEIS[0];
    for (var i = 0; i < NIVEIS.length; i++) {
      if (pts >= NIVEIS[i].min) n = NIVEIS[i];
    }
    return n;
  }

  function findClienteByNome(nome) {
    if (!nome || typeof state === 'undefined') return null;
    var n = String(nome).trim().toLowerCase();
    return (state.clientes || []).find(function (c) {
      return String(c.nome || '').trim().toLowerCase() === n;
    }) || null;
  }

  function getClientePontos(clienteIdOuNome) {
    var c = null;
    if (typeof state === 'undefined') return 0;
    if (clienteIdOuNome && String(clienteIdOuNome).length > 20) {
      c = (state.clientes || []).find(function (x) { return x.id === clienteIdOuNome; });
    } else {
      c = findClienteByNome(clienteIdOuNome);
    }
    return c ? (Number(c.pontos) || 0) : 0;
  }

  async function adicionarPontosCliente(clienteNome, pts, motivo) {
    if (!pts || pts === 0) return null;
    var c = findClienteByNome(clienteNome);
    if (!c) return null;
    var novo = (Number(c.pontos) || 0) + pts;
    var nivel = nivelDePontos(novo);
    var data = {
      pontos: novo,
      nivel_fidelidade: nivel.id,
      updated_at: new Date().toISOString()
    };
    try {
      if (typeof updateInList === 'function') {
        updateInList('clientes', c.id, data);
      } else if (c) {
        Object.assign(c, data);
      }
      if (typeof dbPut === 'function') {
        var full = Object.assign({}, c, data);
        await dbPut('clientes', full);
      }
      if (typeof logContexto === 'function') {
        logContexto('fidelidade.pontos', { cliente: c.id, pts: pts, motivo: motivo, total: novo });
      }
      return full || c;
    } catch (e) {
      console.warn('[fidelidade]', e);
      return null;
    }
  }

  /** Chamado após venda registada — F2 + F15 */
  async function onVendaFidelidade(mov) {
    try {
      if (!mov || mov.tipo !== 'venda') return;
      var pts = pontosDeValor(mov.valor);
      if (pts > 0 && mov.cliente) {
        await adicionarPontosCliente(mov.cliente, pts, 'venda');
      }
      // F15: se cliente foi indicado, bónus ao indicador (uma vez por venda do indicado)
      var c = findClienteByNome(mov.cliente);
      if (c && c.indicado_por) {
        var indicador = (state.clientes || []).find(function (x) {
          return x.id === c.indicado_por || x.codigo_indicacao === c.indicado_por;
        });
        if (indicador) {
          await adicionarPontosCliente(indicador.nome, BONUS_INDICACAO, 'indicacao');
        }
      }
    } catch (e) {
      console.warn('[onVendaFidelidade]', e);
    }
  }

  function gerarCodigoIndicacao(nome) {
    var base = String(nome || 'CLI').replace(/\s+/g, '').slice(0, 4).toUpperCase();
    var rnd = Math.floor(100 + Math.random() * 900);
    return base + rnd;
  }

  // ---------- F5: Lembrete WhatsApp (agnóstico — usa wa.me) ----------
  function linkWhatsAppLembrete(agendamento) {
    if (!agendamento) return null;
    var tel = String(agendamento.telefone || agendamento.clienteTelefone || '').replace(/\D/g, '');
    if (tel && tel.length === 9) tel = '244' + tel;
    if (!tel) return null;
    var store = (state && state.config && state.config.storeName) || 'BeautyPro';
    var msg = 'Olá' + (agendamento.cliente ? ' ' + agendamento.cliente : '') +
      '! Lembrete: tem marcação em ' + store +
      ' no dia ' + (agendamento.data || '') +
      (agendamento.hora ? ' às ' + agendamento.hora : '') +
      (agendamento.servico ? ' (' + agendamento.servico + ')' : '') +
      '. Até breve!';
    return 'https://wa.me/' + tel + '?text=' + encodeURIComponent(msg);
  }

  function enviarLembreteAgenda(agId) {
    var ag = (state.agendamentos || []).find(function (a) { return a.id === agId; });
    if (!ag) {
      // tentar pelo objecto directo
      ag = agId && agId.data ? agId : null;
    }
    if (!ag) {
      if (typeof toast === 'function') toast('Agendamento não encontrado', 'error');
      return;
    }
    // enriquecer telefone pelo cliente
    if (!ag.telefone && ag.cliente) {
      var c = findClienteByNome(ag.cliente);
      if (c) ag.telefone = c.telefone || c.contacto || '';
    }
    var url = linkWhatsAppLembrete(ag);
    if (!url) {
      if (typeof toast === 'function') toast('Cliente sem telefone válido', 'error');
      return;
    }
    window.open(url, '_blank');
    if (typeof toast === 'function') toast('A abrir WhatsApp…', 'success');
  }

  // ---------- F17: Notificações locais (sem FCM nesta etapa) ----------
  function pedirPermissaoPush() {
    if (!('Notification' in window)) {
      if (typeof toast === 'function') toast('Notificações não suportadas neste dispositivo', 'warning');
      return Promise.resolve(false);
    }
    return Notification.requestPermission().then(function (p) {
      if (p === 'granted' && typeof toast === 'function') toast('Notificações activadas', 'success');
      return p === 'granted';
    });
  }

  function notificarLocal(titulo, corpo) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return false;
      new Notification(titulo || 'BeautyPro', {
        body: corpo || '',
        icon: 'icon-192.png',
        badge: 'icon-192.png'
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  function lembrarAgendamentosAmanha() {
    if (typeof hoje !== 'function') return;
    var d = new Date(hoje() + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    var amanha = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    var lista = (state.agendamentos || []).filter(function (a) {
      return a.data === amanha && a.estado !== 'cancelado';
    });
    if (lista.length) {
      notificarLocal(
        'Agenda de amanhã',
        lista.length + ' marcação(ões) amanhã. Abra a app para rever.'
      );
    }
  }

  // ---------- UI menu ----------
  function ensureMenuItems() {
    var dd = document.getElementById('menu-dropdown');
    if (!dd || dd.querySelector('[data-bp-menu="mkt"]')) return;
    var frag = document.createDocumentFragment();
    var sec = document.createElement('div');
    sec.className = 'bp-menu-section';
    sec.setAttribute('data-bp-menu', 'mkt');
    sec.textContent = 'Marketing';
    frag.appendChild(sec);
    var items = [
      { key: 'fidelidade', label: 'Fidelidade' },
      { key: 'indicacao', label: 'Indicações' },
      { key: 'lembretes', label: 'Lembretes WhatsApp' },
      { key: 'push', label: 'Notificações' }
    ];
    items.forEach(function (it) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-bp-menu', 'mkt');
      btn.setAttribute('data-bp-action', it.key);
      btn.innerHTML = '<span>' + it.label + '</span>';
      frag.appendChild(btn);
    });
    var logout = dd.querySelector('#logout-btn');
    if (logout) dd.insertBefore(frag, logout);
    else dd.appendChild(frag);
    dd.addEventListener('click', function (e) {
      var t = e.target.closest('[data-bp-menu="mkt"]');
      if (!t) return;
      e.stopPropagation();
      dd.style.display = 'none';
      var a = t.getAttribute('data-bp-action');
      if (a === 'fidelidade') openModalFidelidade();
      if (a === 'indicacao') openModalIndicacao();
      if (a === 'lembretes') openModalLembretes();
      if (a === 'push') {
        pedirPermissaoPush().then(function () { lembrarAgendamentosAmanha(); });
      }
    });
  }

  function ensureModal(id, title, eyebrow, subtitle) {
    if (typeof ensureBpSheetModal === 'function') {
      return ensureBpSheetModal(id, title, eyebrow, subtitle);
    }
    var el = document.getElementById(id);
    if (el) return el;
    return null;
  }

  function openModalFidelidade() {
    ensureModal('modal-bp-fid', 'Fidelidade', 'Clientes', 'Pontos acumulados e níveis de recompensa.');
    var body = document.getElementById('modal-bp-fid-body');
    var clientes = (state.clientes || []).slice().sort(function (a, b) {
      return (Number(b.pontos) || 0) - (Number(a.pontos) || 0);
    }).slice(0, 30);
    var html = '<p style="font-size:.8rem;color:var(--text-secondary);margin-bottom:16px;line-height:1.5;">1 ponto por cada ' + PONTOS_POR_KZ + ' Kz. Níveis: Bronze → Prata (500) → Ouro (2.000) → Platina (5.000).</p>';
    if (!clientes.length) {
      html += '<div class="bp-empty"><strong>Sem clientes</strong>Os pontos aparecem após as primeiras vendas.</div>';
    } else {
      html += clientes.map(function (c) {
        var pts = Number(c.pontos) || 0;
        var niv = nivelDePontos(pts);
        var nome = typeof escHtml === 'function' ? escHtml(c.nome) : c.nome;
        return '<div class="bp-row"><div class="bp-row-main"><div class="bp-row-title">' + nome + '</div>' +
          '<div class="bp-row-meta"><span class="bp-badge">' + (typeof escHtml==='function'?escHtml(String(niv.label||'')):String(niv.label||'')) + '</span></div></div>' +
          '<div class="bp-row-value is-gold">' + pts + ' pts</div></div>';
      }).join('');
    }
    body.innerHTML = html;
    if (typeof openModal === 'function') openModal('modal-bp-fid');
    else document.getElementById('modal-bp-fid').classList.add('open');
  }

  function openModalIndicacao() {
    ensureModal('modal-bp-ind', 'Indicações', 'Crescimento', 'Códigos para amigo indica amigo.');
    var body = document.getElementById('modal-bp-ind-body');
    var rows = (state.clientes || []).map(function (c) {
      var cod = c.codigo_indicacao || '';
      var nome = typeof escHtml === 'function' ? escHtml(c.nome) : c.nome;
      return '<div class="bp-row"><div class="bp-row-main"><div class="bp-row-title">' + nome + '</div>' +
        '<div class="bp-row-meta">' + (cod ? '<span class="bp-code">' + (typeof escHtml === 'function' ? escHtml(String(cod)) : String(cod).replace(/</g,'&lt;')) + '</span>' : 'Sem código') + '</div></div>' +
        '<button type="button" class="bp-action-btn' + (cod ? '' : ' is-primary') + '" data-gen-cod="' + (typeof escHtml==='function'?escHtml(String(c.id)):String(c.id)) + '">' + (cod ? 'Gerado' : 'Gerar') + '</button></div>';
    }).join('') || '<div class="bp-empty"><strong>Sem clientes</strong>Adicione clientes para gerar códigos.</div>';
    body.innerHTML = '<div class="bp-alert-banner"><strong>Programa de indicações</strong>Cada código dá ' + BONUS_INDICACAO + ' pts ao indicador quando o indicado compra.</div>' + rows;
    body.querySelectorAll('[data-gen-cod]').forEach(function (btn) {
      btn.onclick = async function () {
        var id = btn.getAttribute('data-gen-cod');
        var c = (state.clientes || []).find(function (x) { return x.id === id; });
        if (!c) return;
        if (c.codigo_indicacao) return;
        var cod = gerarCodigoIndicacao(c.nome);
        var data = { codigo_indicacao: cod, updated_at: new Date().toISOString() };
        if (typeof updateInList === 'function') updateInList('clientes', id, data);
        else Object.assign(c, data);
        if (typeof dbPut === 'function') await dbPut('clientes', Object.assign({}, c, data));
        if (typeof toast === 'function') toast('Código ' + cod + ' gerado', 'success');
        openModalIndicacao();
      };
    });
    if (typeof openModal === 'function') openModal('modal-bp-ind');
    else document.getElementById('modal-bp-ind').classList.add('open');
  }

  function openModalLembretes() {
    ensureModal('modal-bp-lemb', 'Lembretes', 'WhatsApp', 'Mensagens prontas para marcações futuras.');
    var body = document.getElementById('modal-bp-lemb-body');
    var hojeStr = typeof hoje === 'function' ? hoje() : '';
    var lista = (state.agendamentos || []).filter(function (a) {
      return a.data >= hojeStr && a.estado !== 'cancelado';
    }).slice(0, 20);
    var html = '<div class="bp-alert-banner"><strong>Lembretes WhatsApp</strong>Abre conversa com texto pronto. O cliente precisa de telefone na ficha.</div>';
    if (!lista.length) {
      html += '<div class="bp-empty"><strong>Sem marcações futuras</strong>Os lembretes aparecem quando houver agenda.</div>';
    } else {
      html += lista.map(function (a) {
        var nome = typeof escHtml === 'function' ? escHtml(a.cliente || '') : (a.cliente || '');
        return '<div class="bp-row"><div class="bp-row-main"><div class="bp-row-title">' + nome + '</div>' +
          '<div class="bp-row-meta">' + (typeof escHtml==='function'?escHtml(String(a.data||'')):String(a.data||'')) + (a.hora ? ' · ' + (typeof escHtml==='function'?escHtml(String(a.hora)):String(a.hora)) : '') + (a.servico ? ' · ' + (typeof escHtml==='function'?escHtml(String(a.servico)):String(a.servico)) : '') + '</div></div>' +
          '<button type="button" class="bp-action-btn is-primary" data-wa="' + (typeof escHtml==='function'?escHtml(String(a.id)):String(a.id)) + '">WhatsApp</button></div>';
      }).join('');
    }
    body.innerHTML = html;
    body.querySelectorAll('[data-wa]').forEach(function (btn) {
      btn.onclick = function () { enviarLembreteAgenda(btn.getAttribute('data-wa')); };
    });
    if (typeof openModal === 'function') openModal('modal-bp-lemb');
    else document.getElementById('modal-bp-lemb').classList.add('open');
  }

  // Enhance render clientes list with pontos badge — safe observer
  function enhanceClientesListOnce() {
    // non-invasive: only when fidelidade modal not needed
  }

  function init() {
    // ET4-P1-02: listeners só uma vez; re-ensure de menus permitido após login
    if (window.__bpMarketingInitDone) {
      try {
        if (typeof ensureMenuItems === "function") ensureMenuItems();
      } catch (eRe) {}
      return;
    }
    window.__bpMarketingInitDone = true;

    try {
      ensureMenuItems();
    } catch (e) {
      console.warn('[marketing]', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 120); });
  } else {
    setTimeout(init, 120);
  }
  setTimeout(init, 1600);
  setTimeout(init, 4200);

  window.BPMarketing = {
    pontosDeValor: pontosDeValor,
    nivelDePontos: nivelDePontos,
    onVendaFidelidade: onVendaFidelidade,
    adicionarPontosCliente: adicionarPontosCliente,
    enviarLembreteAgenda: enviarLembreteAgenda,
    pedirPermissaoPush: pedirPermissaoPush,
    notificarLocal: notificarLocal,
    getClientePontos: getClientePontos,
    openModalFidelidade: openModalFidelidade,
    openModalIndicacao: openModalIndicacao,
    openModalLembretes: openModalLembretes
  };
})();


if (typeof window !== 'undefined' && window.BPMarketing) window.BPMarketing._bpOwner = 'modules/marketing';
