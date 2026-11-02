/*! BeautyPro — ia-visao-sectorial.js
 * Documento persistente «Visão sectorial» na aba IA.
 * Abre relatório de produto; não altera dados operacionais.
 */
(function (global) {
  'use strict';

  function el(id) {
    return document.getElementById(id);
  }

  function openModal() {
    var m = el('ia-visao-modal');
    if (!m) return;
    m.removeAttribute('hidden');
    m.classList.add('is-open');
    try {
      document.body.classList.add('modal-open');
    } catch (_) {}
    var closeBtn = el('ia-visao-close');
    if (closeBtn) {
      try { closeBtn.focus(); } catch (_) {}
    }
  }

  function closeModal() {
    var m = el('ia-visao-modal');
    if (!m) return;
    m.setAttribute('hidden', '');
    m.classList.remove('is-open');
    try {
      document.body.classList.remove('modal-open');
    } catch (_) {}
  }

  function bind() {
    var openBtn = el('ia-visao-open');
    var closeBtn = el('ia-visao-close');
    var modal = el('ia-visao-modal');
    if (openBtn) {
      openBtn.addEventListener('click', function (ev) {
        try { ev.preventDefault(); } catch (_) {}
        openModal();
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', function (ev) {
        try { ev.preventDefault(); } catch (_) {}
        closeModal();
      });
    }
    if (modal) {
      modal.addEventListener('click', function (ev) {
        if (ev.target === modal) closeModal();
      });
    }
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        var m = el('ia-visao-modal');
        if (m && !m.hasAttribute('hidden')) closeModal();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  global.BP_IA_VisaoSectorial = {
    open: openModal,
    close: closeModal
  };
})(typeof window !== 'undefined' ? window : this);
