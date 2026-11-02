/* BelezaPro — extraído do app.bundle (B2 Desktop)
 * Carregar DEPOIS de app.bundle.js (depende de state, fmtKz, toast, DOM).
 * Não é ESM: IIFE com side-effect no boot (isDesktop gated).
 */
/**
 * BeautyPro — Desktop Enterprise (≥1024px)
 * Preferências, palette, atalhos, multi-select, context menu, pop-out.
 * Sem virtualização agressiva (listas re-renderizam e partiam o layout).
 * Modais desktop via CSS @media — não re-envolve openModal (evita conflito com a11y).
 */
(function () {
  'use strict';

  var PREFS_KEY = 'bp_desk_prefs_v1';
  var defaultPrefs = {
    density: 'comfortable',
    sidebarCollapsed: false,
    shortcutsEnabled: true
  };

  function isDesktop() {
    try {
      return !!(window.matchMedia && window.matchMedia('(min-width: 1024px)').matches);
    } catch (e) {
      return false;
    }
  }

  function loadPrefs() {
    try {
      var raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return Object.assign({}, defaultPrefs);
      return Object.assign({}, defaultPrefs, JSON.parse(raw));
    } catch (e) {
      return Object.assign({}, defaultPrefs);
    }
  }

  function savePrefs(p) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    } catch (e) {}
  }

  var prefs = loadPrefs();

  function applyPrefs() {
    var root = document.documentElement;
    root.setAttribute('data-desk-density', prefs.density || 'comfortable');
    root.setAttribute('data-desk-sidebar', prefs.sidebarCollapsed ? 'collapsed' : 'expanded');
    root.classList.toggle('bp-is-desktop', isDesktop());
    var container = document.querySelector('.app-container');
    if (container) {
      container.classList.toggle('bp-sidebar-collapsed', isDesktop() && !!prefs.sidebarCollapsed);
    }
  }

  function goTab(tab) {
    var btn = document.querySelector('.nav-item[data-tab="' + tab + '"]');
    if (btn) btn.click();
  }

  function triggerNovaVenda() {
    var el =
      document.getElementById('bp-desk-nova') ||
      document.getElementById('nova-venda-hero-btn') ||
      document.querySelector('.fab');
    if (el) el.click();
  }

  function popOut(tab) {
    try {
      var base = location.href.split('#')[0];
      var w = window.open(
        base + '#bp-pop=' + encodeURIComponent(tab),
        'bp_' + tab,
        'noopener,noreferrer,width=1280,height=800'
      );
      if (!w && typeof toast === 'function') toast('Permita pop-ups para multi-janela', 'error');
    } catch (e) {
      if (typeof toast === 'function') toast('Não foi possível abrir janela', 'error');
    }
  }

  function toggleSidebar() {
    if (!isDesktop()) return;
    prefs.sidebarCollapsed = !prefs.sidebarCollapsed;
    savePrefs(prefs);
    applyPrefs();
  }

  function toggleDensity() {
    prefs.density = prefs.density === 'compact' ? 'comfortable' : 'compact';
    savePrefs(prefs);
    applyPrefs();
  }

  /* ----- Command palette ----- */
  var cmdIndex = 0;
  var cmdFiltered = [];

  function commands() {
    return [
      { id: 'dash', label: 'Ir para Resumo', keys: 'g r', run: function () { goTab('dashboard'); } },
      { id: 'agenda', label: 'Ir para Agenda', keys: 'g a', run: function () { goTab('agenda'); } },
      { id: 'cli', label: 'Ir para Clientes', keys: 'g c', run: function () { goTab('clientes'); } },
      { id: 'caixa', label: 'Ir para Caixa', keys: 'g x', run: function () { goTab('caixa'); } },
      { id: 'eq', label: 'Ir para Equipa', keys: 'g e', run: function () { goTab('equipa'); } },
      { id: 'ia', label: 'Ir para IA', keys: 'g i', run: function () { goTab('ia'); } },
      { id: 'venda', label: 'Nova venda', keys: 'n', run: function () { triggerNovaVenda(); } },
      { id: 'pop-a', label: 'Agenda em outra janela', keys: '', run: function () { popOut('agenda'); } },
      { id: 'pop-x', label: 'Caixa em outra janela', keys: '', run: function () { popOut('caixa'); } },
      { id: 'pop-r', label: 'Resumo em outra janela', keys: '', run: function () { popOut('dashboard'); } },
      { id: 'side', label: 'Recolher / expandir menu', keys: '[', run: function () { toggleSidebar(); } },
      { id: 'den', label: 'Alternar densidade', keys: '', run: function () { toggleDensity(); } },
      { id: 'csv', label: 'Exportar análise CSV', keys: '', run: function () {
        if (typeof exportarAnaliseCsv === 'function') {
          exportarAnaliseCsv(window.__bpUltimaAnaliseTemporal);
        } else if (typeof toast === 'function') {
          toast('Exportação indisponível neste ecrã', 'error');
        }
      } }
    ];
  }

  function ensurePalette() {
    if (document.getElementById('bp-cmd-palette')) return;
    var el = document.createElement('div');
    el.id = 'bp-cmd-palette';
    el.className = 'bp-cmd-palette';
    el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<div class="bp-cmd-backdrop" data-cmd-close="1"></div>' +
      '<div class="bp-cmd-dialog" role="dialog" aria-modal="true" aria-label="Command palette">' +
        '<input type="search" id="bp-cmd-input" class="bp-cmd-input" placeholder="Comando ou pesquisa..." autocomplete="off" />' +
        '<ul id="bp-cmd-list" class="bp-cmd-list" role="listbox"></ul>' +
        '<div class="bp-cmd-hint">↑↓ · Enter · Esc</div>' +
      '</div>';
    document.body.appendChild(el);
    el.querySelector('[data-cmd-close]').addEventListener('click', closePalette);
  }

  function openPalette() {
    if (!isDesktop()) return;
    ensurePalette();
    var el = document.getElementById('bp-cmd-palette');
    el.hidden = false;
    el.setAttribute('aria-hidden', 'false');
    cmdIndex = 0;
    renderCmdList('');
    var input = document.getElementById('bp-cmd-input');
    if (input) {
      input.value = '';
      setTimeout(function () { try { input.focus(); } catch (e) {} }, 20);
    }
  }

  function closePalette() {
    var el = document.getElementById('bp-cmd-palette');
    if (!el) return;
    el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
  }

  function renderCmdList(q) {
    q = String(q || '').toLowerCase().trim();
    cmdFiltered = commands().filter(function (c) {
      if (!q) return true;
      return c.label.toLowerCase().indexOf(q) >= 0 || String(c.keys || '').indexOf(q) >= 0;
    });
    if (cmdIndex >= cmdFiltered.length) cmdIndex = Math.max(0, cmdFiltered.length - 1);
    var ul = document.getElementById('bp-cmd-list');
    if (!ul) return;
    ul.innerHTML = cmdFiltered.map(function (c, i) {
      return (
        '<li class="bp-cmd-item' + (i === cmdIndex ? ' is-active' : '') + '" data-idx="' + i + '" role="option">' +
        '<span>' + c.label.replace(/</g, '&lt;') + '</span>' +
        (c.keys ? '<kbd>' + c.keys + '</kbd>' : '') +
        '</li>'
      );
    }).join('');
    ul.querySelectorAll('.bp-cmd-item').forEach(function (li) {
      li.addEventListener('mousedown', function (e) {
        e.preventDefault();
        runCmd(Number(li.getAttribute('data-idx')));
      });
    });
  }

  function runCmd(idx) {
    var c = cmdFiltered[idx];
    closePalette();
    if (c && typeof c.run === 'function') {
      try { c.run(); } catch (err) { console.warn('[bp-cmd]', err); }
    }
  }

  /* ----- Context menu ----- */
  function ensureCtx() {
    if (document.getElementById('bp-ctx-menu')) return;
    var m = document.createElement('div');
    m.id = 'bp-ctx-menu';
    m.className = 'bp-ctx-menu';
    m.hidden = true;
    document.body.appendChild(m);
  }

  function hideCtx() {
    var m = document.getElementById('bp-ctx-menu');
    if (m) m.hidden = true;
  }

  function showCtx(x, y, items) {
    ensureCtx();
    var m = document.getElementById('bp-ctx-menu');
    m.innerHTML = items.map(function (it, i) {
      if (it === '-') return '<div class="bp-ctx-sep"></div>';
      return '<button type="button" class="bp-ctx-item" data-i="' + i + '">' + String(it.label).replace(/</g, '&lt;') + '</button>';
    }).join('');
    m.hidden = false;
    var left = Math.min(x, window.innerWidth - 210);
    var top = Math.min(y, window.innerHeight - 16 - Math.max(items.length, 1) * 36);
    m.style.left = Math.max(8, left) + 'px';
    m.style.top = Math.max(8, top) + 'px';
    m.querySelectorAll('.bp-ctx-item').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var i = Number(btn.getAttribute('data-i'));
        hideCtx();
        if (items[i] && typeof items[i].run === 'function') items[i].run();
      });
    });
  }

  /* ----- Multi-select (só com modificador) ----- */
  var selectedIds = Object.create(null);
  var selectedCount = 0;

  function clearSelection() {
    selectedIds = Object.create(null);
    selectedCount = 0;
    document.querySelectorAll('.is-multi-selected').forEach(function (el) {
      el.classList.remove('is-multi-selected');
    });
    updateSelectionBar();
  }

  function updateSelectionBar() {
    var bar = document.getElementById('bp-multi-bar');
    if (!bar) return;
    bar.hidden = selectedCount === 0 || !isDesktop();
    var label = bar.querySelector('.bp-multi-count');
    if (label) {
      label.textContent =
        selectedCount === 1 ? '1 selecionado' : selectedCount + ' selecionados';
    }
  }

  function ensureSelectionBar() {
    if (document.getElementById('bp-multi-bar')) return;
    var bar = document.createElement('div');
    bar.id = 'bp-multi-bar';
    bar.className = 'bp-multi-bar';
    bar.hidden = true;
    bar.innerHTML =
      '<span class="bp-multi-count">0</span>' +
      '<button type="button" class="btn btn-sm btn-secondary" id="bp-multi-clear">Limpar</button>';
    document.body.appendChild(bar);
    document.getElementById('bp-multi-clear').addEventListener('click', clearSelection);
  }

  function bindListMultiSelect() {
    if (document.body.dataset.bpMulti === '1') return;
    document.body.dataset.bpMulti = '1';
    document.addEventListener('click', function (e) {
      if (!isDesktop()) return;
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) return;
      if (e.target.closest('button, a, input, select, textarea, label, [data-action]')) return;
      var row = e.target.closest(
        '.list-item[data-id], .list-item[data-agenda-id], .bp-ag-card[data-id], .bp-ag-card[data-agenda-id], tr[data-id]'
      );
      if (!row) return;
      e.preventDefault();
      e.stopPropagation();
      var id = row.getAttribute('data-id') || row.getAttribute('data-agenda-id');
      if (!id) return;
      if (selectedIds[id]) {
        delete selectedIds[id];
        selectedCount = Math.max(0, selectedCount - 1);
        row.classList.remove('is-multi-selected');
      } else {
        selectedIds[id] = true;
        selectedCount += 1;
        row.classList.add('is-multi-selected');
      }
      ensureSelectionBar();
      updateSelectionBar();
    });
  }

  function bindDoubleClick() {
    if (document.body.dataset.bpDbl === '1') return;
    document.body.dataset.bpDbl = '1';
    document.addEventListener('dblclick', function (e) {
      if (!isDesktop()) return;
      var row = e.target.closest('.list-item[data-id], .list-item[data-agenda-id], .bp-ag-card[data-id], .bp-ag-card[data-agenda-id]');
      if (!row || e.target.closest('button, a, input')) return;
      // um único click sintético se o handler de linha não tiver corrido no 2.º clique
      try {
        row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      } catch (err) {
        row.click();
      }
    });
  }

  function bindContext() {
    if (document.body.dataset.bpCtx === '1') return;
    document.body.dataset.bpCtx = '1';
    document.addEventListener('contextmenu', function (e) {
      if (!isDesktop()) return;
      var row = e.target.closest('.list-item[data-id], .list-item[data-agenda-id], .bp-ag-card[data-id], .bp-ag-card[data-agenda-id]');
      if (!row) return;
      e.preventDefault();
      var id = row.getAttribute('data-id') || row.getAttribute('data-agenda-id') || '';
      showCtx(e.clientX, e.clientY, [
        {
          label: 'Abrir',
          run: function () {
            try {
              row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            } catch (err) {
              row.click();
            }
          }
        },
        {
          label: 'Copiar ID',
          run: function () {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(id).catch(function () {});
            }
          }
        },
        '-',
        { label: 'Clientes em outra janela', run: function () { popOut('clientes'); } }
      ]);
    });
    document.addEventListener('click', hideCtx);
    document.addEventListener('scroll', hideCtx, true);
  }

  /* ----- Keyboard ----- */
  var goPending = false;
  var goTimer = null;

  function bindKeys() {
    if (document.body.dataset.bpEntKeys === '1') return;
    document.body.dataset.bpEntKeys = '1';

    document.addEventListener('keydown', function (e) {
      if (!prefs.shortcutsEnabled) return;

      var tag = (e.target && e.target.tagName) || '';
      var typing =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (e.target && e.target.isContentEditable);

      // Palette: sempre disponível em desktop
      if (isDesktop() && (e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        openPalette();
        return;
      }

      var palette = document.getElementById('bp-cmd-palette');
      var paletteOpen = palette && !palette.hidden;

      if (e.key === 'Escape') {
        if (paletteOpen) {
          e.preventDefault();
          closePalette();
          return;
        }
        if (selectedCount > 0) {
          clearSelection();
          return;
        }
        hideCtx();
        return;
      }

      if (paletteOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          cmdIndex = Math.min(cmdIndex + 1, Math.max(0, cmdFiltered.length - 1));
          renderCmdList((document.getElementById('bp-cmd-input') || {}).value || '');
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          cmdIndex = Math.max(cmdIndex - 1, 0);
          renderCmdList((document.getElementById('bp-cmd-input') || {}).value || '');
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          runCmd(cmdIndex);
          return;
        }
        return;
      }

      if (!isDesktop()) return;

      if (typing) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          var iaTab = document.getElementById('tab-ia');
          var send = document.getElementById('ia-enviar');
          if (iaTab && iaTab.classList.contains('active') && send) {
            e.preventDefault();
            send.click();
          }
        }
        return;
      }

      if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        triggerNovaVenda();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        triggerNovaVenda();
        return;
      }
      if (e.key === '[' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
        goPending = true;
        if (goTimer) clearTimeout(goTimer);
        goTimer = setTimeout(function () {
          goPending = false;
        }, 700);
        return;
      }
      if (goPending && !e.ctrlKey && !e.metaKey) {
        var map = { r: 'dashboard', a: 'agenda', c: 'clientes', x: 'caixa', e: 'equipa', i: 'ia' };
        if (map[e.key]) {
          e.preventDefault();
          goPending = false;
          goTab(map[e.key]);
        }
      }
    });

    document.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'bp-cmd-input') {
        cmdIndex = 0;
        renderCmdList(e.target.value);
      }
    });
  }

  /* ----- Pop-out hash ----- */
  function handlePopHash() {
    var m = (location.hash || '').match(/bp-pop=([a-z]+)/);
    if (!m) return;
    document.documentElement.classList.add('bp-popout');
    var tab = m[1];
    setTimeout(function () {
      goTab(tab);
    }, 700);
  }

  function syncSideToggle() {
    var nav = document.querySelector('.bottom-nav');
    var existing = document.getElementById('bp-side-toggle');
    if (!isDesktop()) {
      if (existing) existing.remove();
      return;
    }
    if (!nav || existing) return;
    var t = document.createElement('button');
    t.id = 'bp-side-toggle';
    t.type = 'button';
    t.className = 'bp-side-toggle';
    t.title = 'Recolher menu ([)';
    t.setAttribute('aria-label', 'Recolher ou expandir menu');
    t.textContent = '⟨';
    t.addEventListener('click', function (e) {
      e.preventDefault();
      toggleSidebar();
    });
    nav.appendChild(t);
  }

  function mount() {
    applyPrefs();
    ensurePalette();
    ensureCtx();
    ensureSelectionBar();
    bindKeys();
    bindListMultiSelect();
    bindDoubleClick();
    bindContext();
    handlePopHash();
    syncSideToggle();
  }

  var mounted = false;
  function init() {
    if (!document.querySelector('.app-container') && !document.body) return;
    try {
      mount();
      mounted = true;
    } catch (e) {
      console.warn('[desktop-enterprise]', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(init, 300);
    });
  } else {
    setTimeout(init, 300);
  }
  setTimeout(init, 1200);

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      applyPrefs();
      syncSideToggle();
      updateSelectionBar();
      if (!isDesktop()) {
        closePalette();
        hideCtx();
        clearSelection();
      }
    }, 150);
  });

  window.BPDesktopEnterprise = {
    openPalette: openPalette,
    closePalette: closePalette,
    popOut: popOut,
    clearSelection: clearSelection,
    prefs: function () {
      return Object.assign({}, prefs);
    },
    savePrefs: function (p) {
      prefs = Object.assign({}, prefs, p || {});
      savePrefs(prefs);
      applyPrefs();
    }
  };
})();
