/*! BelezaPro — ia-sugestoes.js (Fase 2)
 * Sugestões só com dados reais; offline permite envio (resposta Sem rede); anti-repetição na sessão.
 * Substitui renderIASugestoesAdaptativas quando carregado após ia-module.
 */
(function (global) {
  'use strict';

  var _usadas = {};

  function online() {
    try {
      if (typeof global._bpIaIsOnline === 'function') return !!global._bpIaIsOnline();
    } catch (_) {}
    return typeof navigator === 'undefined' || navigator.onLine !== false;
  }

  function esc(s) {
    if (typeof global.escHtml === 'function') return global.escHtml(String(s || ''));
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderIASugestoesAdaptativas(ctx) {
    var grid = document.querySelector('#tab-ia .ia-sugestoes-grid');
    if (!grid || !ctx) return;

    var pool = [];
    function add(score, label, pergunta, tone, requires) {
      if (requires === false) return;
      if (_usadas[String(pergunta || '')]) return;
      pool.push({
        score: score,
        label: label,
        pergunta: pergunta,
        tone: tone || 'ia-sug-graphite'
      });
    }

    var hab = 'consultor';
    try {
      if (global.BP_IA_Habilidade && typeof BP_IA_Habilidade.get === 'function') hab = BP_IA_Habilidade.get();
    } catch (_) {}

    if (hab === 'relator') {
      add(120, 'Relatório da semana', 'Relatório da semana', 'ia-sug-gold', true);
      add(110, 'Relatório de hoje', 'Relatório de hoje', 'ia-sug-green', true);
      add(100, 'Últimos 30 dias', 'Relatório dos últimos 30 dias', 'ia-sug-graphite', true);
      add(90, 'Serviço em destaque', 'Qual serviço mais faturou esta semana?', 'ia-sug-gold', true);
    }

    /* Só chips com fundamento nos dados */
    if (ctx.atrasados > 0) {
      add(100, 'Marcações em atraso', 'Quais marcações de hoje estão pendentes?', 'ia-sug-gold', true);
    }
    if (ctx.totalHoje === 0 && ctx.media7 > 0) {
      add(95, 'Receita hoje', 'Qual foi a minha receita hoje?', 'ia-sug-green', true);
    } else if (ctx.totalHoje > 0) {
      add(55, 'Receita hoje', 'Qual foi a minha receita hoje?', 'ia-sug-green', true);
    }
    if (ctx.inativos > 0) {
      add(90, 'Clientes quietos', 'Que clientes estão há mais de 30 dias sem vir?', 'ia-sug-gold', true);
    }
    if (ctx.agAmanha === 0) {
      add(85, 'Agenda amanhã', 'Como está a agenda de amanhã?', 'ia-sug-graphite', true);
    } else if (ctx.agAmanha > 0) {
      add(50, 'Agenda amanhã', 'Como está a agenda de amanhã?', 'ia-sug-graphite', true);
    }
    if (ctx.temServicoTop) {
      add(70, 'Serviço em destaque', 'Qual serviço mais faturou esta semana?', 'ia-sug-graphite', true);
    }
    if (ctx.totalDespHoje > 0 || ctx.fluxoHoje !== 0 || ctx.totalHoje > 0) {
      add(65, 'Fluxo de caixa', 'Como está o fluxo de caixa hoje?', 'ia-sug-green', true);
    }
    if (ctx.ticketHoje > 0) {
      add(45, 'Ticket médio', 'Qual é o meu ticket médio?', 'ia-sug-graphite', true);
    }
    if (ctx.pendentesHoje > 0) {
      add(60, 'Agenda de hoje', 'Como está a minha agenda?', 'ia-sug-green', true);
    }
    if (ctx.agProximos > 0 && global.BPOps && typeof global.BPOps.downloadIcs === 'function') {
      add(72, 'Exportar calendário', '__bp_export_ics__', 'ia-sug-graphite', true);
    }

    pool.sort(function (a, b) { return b.score - a.score; });

    var picked = [];
    var usedLabel = {};
    for (var i = 0; i < pool.length && picked.length < 6; i++) {
      var c = pool[i];
      if (usedLabel[c.label]) continue;
      usedLabel[c.label] = true;
      picked.push(c);
    }

    if (!picked.length) {
      grid.innerHTML = '';
      grid.setAttribute('data-bp-empty', '1');
      return;
    }
    grid.removeAttribute('data-bp-empty');

    var svg = {
      'ia-sug-green': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 18 8.5 10.5 13.5 15.5 23 6"/><polyline points="17 6 23 6 23 12"/></svg>',
      'ia-sug-gold': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      'ia-sug-graphite': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9"/></svg>'
    };

    var off = !online();
    grid.classList.toggle('is-offline', off);
    /* Offline: chips continuam clicáveis — perguntarIA responde "Sem rede" */
    grid.innerHTML = picked.map(function (c) {
      var _perg = esc(c.pergunta);
      var _lab = esc(c.label);
      var _tone = (c.tone && svg[c.tone]) ? c.tone : 'ia-sug-graphite';
      return (
        '<button type="button" class="ia-sugestao-card" data-pergunta="' + _perg + '">' +
        '<span class="ia-sugestao-icone">' + (svg[_tone] || svg['ia-sug-graphite']) + '</span>' +
        '<span>' + _lab + '</span></button>'
      );
    }).join('');
  }

  function marcarUsada(pergunta) {
    if (pergunta) _usadas[String(pergunta)] = 1;
  }

  global.renderIASugestoesAdaptativas = renderIASugestoesAdaptativas;
  try {
    document.addEventListener('click', function (ev) {
      var btn = ev.target && ev.target.closest && ev.target.closest('#tab-ia .ia-sugestao-card');
      if (!btn || btn.disabled) return;
      var p = btn.getAttribute('data-pergunta');
      if (p && p !== '__bp_export_ics__') marcarUsada(p);
    }, true);
  } catch (_) {}

  global.BP_IA_Sugestoes = {
    render: renderIASugestoesAdaptativas,
    marcarUsada: marcarUsada,
    resetUsadas: function () { _usadas = {}; }
  };
})(typeof window !== 'undefined' ? window : this);
