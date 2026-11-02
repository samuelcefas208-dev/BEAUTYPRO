/*! BelezaPro — ia-habilidade.js (Fase 3)
 * Persistência + UI das 3 habilidades. Carregar após ia-contract.js.
 */
(function (global) {
  'use strict';

  var KEY_PREF = 'bp_ia_habilidade_';

  function salaoId() {
    try {
      return (global.state && state.config && state.config.salaoId) || 'local';
    } catch (_) { return 'local'; }
  }

  function lista() {
    return (global.BP_IA && BP_IA.HABILIDADES) || [
      { id: 'consultor', label: 'Consultor' },
      { id: 'construtor', label: 'Construtor' },
      { id: 'relator', label: 'Relator' }
    ];
  }

  function def() {
    return (global.BP_IA && BP_IA.HABILIDADE_DEFAULT) || 'consultor';
  }

  function get() {
    var id = def();
    try {
      if (global.state && state.config && state.config.iaHabilidade) {
        id = String(state.config.iaHabilidade);
      } else {
        var raw = localStorage.getItem(KEY_PREF + salaoId());
        if (raw) id = raw;
      }
    } catch (_) {}
    var ok = lista().some(function (h) { return h.id === id; });
    return ok ? id : def();
  }

  function labelDe(id) {
    var h = lista().filter(function (x) { return x.id === id; })[0];
    return h ? h.label : id;
  }

  function set(id) {
    var ok = lista().some(function (h) { return h.id === id; });
    if (!ok) id = def();
    try {
      if (!global.state) global.state = {};
      if (!state.config) state.config = {};
      state.config.iaHabilidade = id;
    } catch (_) {}
    try { localStorage.setItem(KEY_PREF + salaoId(), id); } catch (_) {}
    pintarChip();
    try {
      document.dispatchEvent(new CustomEvent('bp:ia-habilidade', { detail: { id: id } }));
    } catch (_) {}
    return id;
  }

  function pintarChip() {
    var btn = document.getElementById('ia-habilidade-btn');
    if (!btn) return;
    btn.textContent = labelDe(get());
    btn.setAttribute('data-hab', get());
  }

  function fecharSheet() {
    var m = document.getElementById('modal-ia-habilidade');
    if (!m) return;
    if (typeof closeModal === 'function') closeModal('modal-ia-habilidade');
    m.classList.remove('open', 'is-open');
    m.style.display = 'none';
    try { m.hidden = true; } catch (_) {}
  }

  


  function positionSheet() {
    var m = document.getElementById('modal-ia-habilidade');
    var sheet = m && m.querySelector('.ia-hab-sheet');
    var btn = document.getElementById('ia-habilidade-btn');
    if (!sheet || !btn) return;
    try {
      sheet.style.maxHeight = 'none';
      sheet.style.overflow = 'visible';
      sheet.style.height = 'auto';
      var br = btn.getBoundingClientRect();
      var gap = 6;
      var sh = sheet.offsetHeight || 280;
      var top = br.top - sh - gap;
      if (top < 8) top = br.bottom + gap;
      if (top + sh > window.innerHeight - 8) {
        top = Math.max(8, window.innerHeight - sh - 8);
      }
      var left = br.left;
      var sw = Math.min(250, Math.floor(window.innerWidth * 0.72));
      if (left + sw > window.innerWidth - 8) left = Math.max(8, window.innerWidth - sw - 8);
      if (left < 8) left = 8;
      sheet.style.position = 'fixed';
      sheet.style.top = Math.round(top) + 'px';
      sheet.style.bottom = 'auto';
      sheet.style.left = Math.round(left) + 'px';
      sheet.style.width = sw + 'px';
      sheet.style.maxWidth = '250px';
    } catch (_) {}
  }



  function abrirSheet() {
    var _mOpen = document.getElementById('modal-ia-habilidade');
    if (_mOpen) {
      _mOpen._bpIgnoreOutside = true;
      setTimeout(function () {
        try { if (_mOpen) _mOpen._bpIgnoreOutside = false; } catch (_) {}
      }, 280);
    }

    var m = document.getElementById('modal-ia-habilidade');
    if (!m) return;
    var box = document.getElementById('ia-habilidade-opcoes');
    if (box) {
      var cur = get();
      var icons = {
        consultor: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="3.5"/><path d="M5 19c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5"/></svg>',
        construtor: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg>',
        relator: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 4h9l3 3v13H6z"/><path d="M9 12h6M9 16h4"/></svg>'
      };
      var desc = {
        consultor: 'Analisa o salão e responde com base nos dados. Não altera registos.',
        construtor: 'Propõe criar clientes e outros dados. Só aplica depois de autorizar.',
        relator: 'Resume períodos e indicadores. Pode descarregar o relatório em PDF.'
      };
      box.innerHTML = lista().map(function (item) {
        var on = item.id === cur ? ' is-on' : '';
        return '<button type="button" class="ia-hab-opcao' + on + '" role="menuitem" data-hab="' + item.id + '">' +
          '<span class="ia-hab-opcao-ic" aria-hidden="true">' + (icons[item.id] || '') + '</span>' +
          '<span class="ia-hab-opcao-text"><span class="ia-hab-opcao-lab">' + item.label + '</span>' +
          '<span class="ia-hab-opcao-desc">' + (desc[item.id] || '') + '</span></span>' +
          (on ? '<span class="ia-hab-opcao-check" aria-hidden="true"></span>' : '') +
          '</button>';
      }).join('');
    }
    /* Popover local no #tab-ia — rola com a aba, sem fosco */
    try { m.hidden = false; } catch (_) {}
    m.classList.add('open', 'is-open');
    m.style.display = 'block';
    m.style.background = 'transparent';
    positionSheet();
    requestAnimationFrame(positionSheet);
    if (!m._bpPosBound) {
      m._bpPosBound = true;
      try {
        var sc = document.getElementById('tab-ia') || window;
        sc.addEventListener('scroll', positionSheet, { passive: true });
        window.addEventListener('resize', positionSheet, { passive: true });
      } catch (_) {}
    }
  }

  function bind() {
    var btn = document.getElementById('ia-habilidade-btn');
    if (btn && !btn._bpBound) {
      btn._bpBound = true;
      btn.addEventListener('click', function (ev) {
        try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}
        abrirSheet();
      });
    }
    document.addEventListener('click', function (ev) {
      var op = ev.target && ev.target.closest && ev.target.closest('#modal-ia-habilidade .ia-hab-opcao');
      if (op) {
        set(op.getAttribute('data-hab'));
        fecharSheet();
        return;
      }
    }, true);
    /* Dismiss só em clique real fora (não pointerdown — evita fechar ao pousar o dedo) */
    if (!document._bpIaHabOutside) {
      document._bpIaHabOutside = true;
      document.addEventListener('click', function (ev) {
        var m = document.getElementById('modal-ia-habilidade');
        if (!m || m.hidden || m.style.display === 'none') return;
        if (m._bpIgnoreOutside) return;
        var t = ev.target;
        if (t && t.closest) {
          if (t.closest('.ia-hab-sheet')) return;
          if (t.closest('#modal-ia-habilidade')) return;
          if (t.closest('#ia-habilidade-btn')) return;
        }
        fecharSheet();
      }, true);
    }
    pintarChip();
  }

  /* Placeholders: letra a letra (metodologia tipo localizar — um a um) */
  var _phTimer = null;
  var _phIdx = 0;
  var _phRun = 0;
  function placeholders() {
    return (global.BP_IA && BP_IA.PLACEHOLDERS) || [
      'Como está o desempenho do salão hoje?'
    ];
  }
  function stopPh() {
    _phRun++;
    if (_phTimer) { clearTimeout(_phTimer); _phTimer = null; }
    try {
      var el = document.getElementById('ia-input');
      if (el) el.placeholder = '';
    } catch (_) {}
  }
  function startPh() {
    stopPh();
    var input = document.getElementById('ia-input');
    if (!input) return;
    var run = _phRun;
    var list = placeholders();
    function cycle() {
      if (run !== _phRun) return;
      if (!input || document.activeElement === input) return;
      if (String(input.value || '').trim()) return;
      if (document.hidden) return;
      var full = String(list[_phIdx % list.length] || '').replace(/\s+/g, ' ').trim();
      _phIdx++;
      var i = 0;
      input.placeholder = '';
      /* Uma só linha: janela curta p/ caber no input mobile sem ellipsis a cortar o fim */
      var win = 16;
      try {
        var approx = Math.floor((input.clientWidth - 28) / 8);
        if (approx >= 12 && approx <= 40) win = approx;
      } catch (_) {}
      function step() {
        if (run !== _phRun) return;
        if (!input || document.activeElement === input || String(input.value || '').trim()) return;
        i++;
        if (full.length <= win) {
          input.placeholder = full.slice(0, i);
          if (i < full.length) {
            _phTimer = setTimeout(step, 28);
          } else {
            _phTimer = setTimeout(cycle, 2200);
          }
        } else {
          if (i <= win) {
            input.placeholder = full.slice(0, i);
            _phTimer = setTimeout(step, 28);
          } else {
            var start = 0;
            var maxStart = Math.max(0, full.length - win);
            function slide() {
              if (run !== _phRun) return;
              if (!input || document.activeElement === input || String(input.value || '').trim()) return;
              if (start >= maxStart) {
                input.placeholder = full.slice(maxStart);
                _phTimer = setTimeout(cycle, 1600);
                return;
              }
              input.placeholder = full.slice(start, start + win);
              start += 1;
              _phTimer = setTimeout(slide, 45);
            }
            _phTimer = setTimeout(slide, 350);
          }
        }
      }
      step();
    }
    cycle();
  }
  function bindPh() {
    var input = document.getElementById('ia-input');
    if (!input || input._bpPh) return;
    input._bpPh = true;
    input.addEventListener('focus', function () {
      stopPh();
      try { input.placeholder = ''; } catch (_) {}
    });
    input.addEventListener('blur', function () {
      /* só espaços → continua fluxo do placeholder */
      if (!String(input.value || '').trim()) startPh();
    });
    input.addEventListener('input', function () {
      if (String(input.value || '').trim()) {
        stopPh();
      } else {
        /* espaços isolados não bloqueiam o ciclo */
        if (document.activeElement !== input) startPh();
        else try { input.placeholder = ''; } catch (_) {}
      }
    });
    startPh();
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopPh();
      else if (input && !String(input.value || '').trim() && document.activeElement !== input) startPh();
    });
  }

  global.BP_IA_Habilidade = {
    get: get,
    set: set,
    label: function () { return labelDe(get()); },
    lista: lista
  };

  function boot() {
    try { bind(); } catch (_) {}
    try { bindPh(); } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  document.addEventListener('bp:ia-ready', boot);
})(typeof window !== 'undefined' ? window : this);
