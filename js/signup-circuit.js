/**
 * BeautyPro — Criar conta v2 (circuito endurecido)
 *
 * Contratos de integração:
 *   window.bpSignupCreateAccount(payload) → Promise
 *     payload: { empresa, localizacao, nif, email, password, termsAccepted, termsVersion, lang }
 *     reject Error with message matching already|registered|network|server…
 *   window.bpOnSignupComplete() — após CTA do modal de plano
 *   window.bpOnViewPlans() — botão secundário do modal (opcional)
 *   window.bpShowAuthPanel('login') — link Iniciar sessão
 *
 * Flags:
 *   BP_SIGNUP_DEMO — se true, emails de teste e create local
 *   BP_FREE_TRIAL_DAYS — inteiro da política
 */
(function (global) {
  'use strict';

  var MAX = 6;
  var DRAFT_KEY = 'bp_signup_draft_v2';
  var LANG_KEY = 'bp_ui_lang';
  var TERMS_VERSION = 'policy-2026-11';

  var step = 1;
  var lang = 'pt';
  var submitting = false;
  var bound = false;

  function isDemo() {
    return global.BP_SIGNUP_DEMO === true;
  }

  function trialDays() {
    return typeof global.BP_FREE_TRIAL_DAYS === 'number' && global.BP_FREE_TRIAL_DAYS > 0
      ? global.BP_FREE_TRIAL_DAYS
      : 14;
  }

  function pack() {
    var all = global.BP_SIGNUP_I18N || {};
    return all[lang] || all.pt || {};
  }

  function t(key) {
    var p = pack();
    return p[key] != null ? p[key] : key;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function val(id) {
    var el = $(id);
    return el && el.value != null ? String(el.value).trim() : '';
  }

  function isEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  /* ---------- field errors (inline only) ---------- */

  function setFieldError(fieldId, message) {
    var input = $(fieldId);
    var err = $('err-' + fieldId);
    if (input) {
      input.classList.toggle('is-invalid', !!message);
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
    }
    if (err) {
      err.textContent = message || '';
      err.hidden = !message;
    }
    var wrap = document.querySelector('[data-field="' + fieldId + '"]');
    if (wrap) wrap.classList.toggle('has-error', !!message);
  }

  function clearFieldErrors() {
    ['signup-empresa', 'signup-localizacao', 'signup-nif', 'signup-email',
      'signup-password', 'signup-password-2', 'signup-terms'].forEach(function (id) {
      setFieldError(id, '');
    });
  }

  function focusFirstError() {
    var invalid = document.querySelector('.bp-signup-shell .is-invalid, .bp-signup-shell .has-error input');
    if (invalid && typeof invalid.focus === 'function') {
      try { invalid.focus(); } catch (_) {}
    }
  }

  /* ---------- banner (text only + optional action button via DOM) ---------- */

  function clearBanner() {
    var el = $('signup-error');
    if (!el) return;
    el.hidden = true;
    el.textContent = '';
    while (el.firstChild) el.removeChild(el.firstChild);
    el.className = 'bp-signup-banner';
  }

  /**
   * @param {string} message
   * @param {{ ok?: boolean, actionLabel?: string, onAction?: function }} [opts]
   */
  function showBanner(message, opts) {
    opts = opts || {};
    var el = $('signup-error');
    if (!el) return;
    clearBanner();
    if (!message) return;
    el.className = 'bp-signup-banner' + (opts.ok ? ' bp-signup-banner-ok' : '');
    var text = document.createElement('span');
    text.textContent = message;
    el.appendChild(text);
    if (opts.actionLabel && typeof opts.onAction === 'function') {
      el.appendChild(document.createTextNode(' '));
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bp-link';
      btn.textContent = opts.actionLabel;
      btn.addEventListener('click', opts.onAction);
      el.appendChild(btn);
    }
    el.hidden = false;
  }

  /* ---------- draft (never password) ---------- */

  function saveDraft() {
    try {
      var data = {
        empresa: val('signup-empresa'),
        localizacao: val('signup-localizacao'),
        nif: val('signup-nif'),
        email: val('signup-email'),
        terms: !!($('signup-terms') && $('signup-terms').checked),
        step: step,
        lang: lang
      };
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function loadDraft() {
    try {
      var raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return;
      function set(id, v) {
        var el = $(id);
        if (el && v != null && v !== '') el.value = v;
      }
      set('signup-empresa', data.empresa);
      set('signup-localizacao', data.localizacao);
      set('signup-nif', data.nif);
      set('signup-email', data.email);
      if (data.terms && $('signup-terms')) $('signup-terms').checked = true;
      if (data.lang && global.BP_SIGNUP_I18N && global.BP_SIGNUP_I18N[data.lang]) {
        lang = data.lang;
      }
      if (data.step >= 1 && data.step <= MAX) step = data.step | 0;
    } catch (_) {}
  }

  function clearDraft() {
    try { sessionStorage.removeItem(DRAFT_KEY); } catch (_) {}
  }

  /* ---------- validation ---------- */

  /**
   * @returns {{ ok: boolean, firstErrorId: string|null }}
   */
  function validateStep(n, opts) {
    opts = opts || {};
    if (!opts.keepOthers) clearFieldErrors();
    var ok = true;
    var first = null;

    function fail(id, msg) {
      setFieldError(id, msg);
      if (!first) first = id;
      ok = false;
    }

    if (n === 3) {
      var emp = val('signup-empresa');
      var loc = val('signup-localizacao');
      if (!emp) fail('signup-empresa', t('err_empresa'));
      else if (emp.length < 2) fail('signup-empresa', t('err_empresa_short'));
      if (!loc || loc.length < 2) fail('signup-localizacao', t('err_local'));
    }
    if (n === 4) {
      var email = val('signup-email').toLowerCase();
      var p1 = ($('signup-password') && $('signup-password').value) || '';
      var p2 = ($('signup-password-2') && $('signup-password-2').value) || '';
      if (!isEmail(email)) fail('signup-email', t('err_email'));
      if (p1.length < 8) fail('signup-password', t('err_pass'));
      if (p1 !== p2) fail('signup-password-2', t('err_pass2'));
    }
    if (n === 5) {
      var ck = $('signup-terms');
      if (!ck || !ck.checked) fail('signup-terms', t('err_terms'));
    }
    return { ok: ok, firstErrorId: first };
  }

  /** Full pre-submit validation without clearing between steps */
  function validateAllForSubmit() {
    clearFieldErrors();
    var r3 = validateStep(3, { keepOthers: true });
    if (!r3.ok) return { ok: false, step: 3, firstErrorId: r3.firstErrorId };
    var r4 = validateStep(4, { keepOthers: true });
    if (!r4.ok) return { ok: false, step: 4, firstErrorId: r4.firstErrorId };
    var r5 = validateStep(5, { keepOthers: true });
    if (!r5.ok) return { ok: false, step: 5, firstErrorId: r5.firstErrorId };
    return { ok: true, step: 6, firstErrorId: null };
  }

  function stepNeedsLiveValidation(n) {
    return n === 3 || n === 4 || n === 5;
  }

  function isStepCurrentlyValid(n) {
    if (!stepNeedsLiveValidation(n)) return true;
    if (n === 3) {
      var emp = val('signup-empresa');
      var loc = val('signup-localizacao');
      return emp.length >= 2 && loc.length >= 2;
    }
    if (n === 4) {
      var email = val('signup-email').toLowerCase();
      var p1 = ($('signup-password') && $('signup-password').value) || '';
      var p2 = ($('signup-password-2') && $('signup-password-2').value) || '';
      return isEmail(email) && p1.length >= 8 && p1 === p2;
    }
    if (n === 5) {
      return !!($('signup-terms') && $('signup-terms').checked);
    }
    return true;
  }

  function syncPrimaryEnabled() {
    var next = $('signup-next-btn');
    var submit = $('signup-submit-btn');
    if (step < MAX && next) {
      next.disabled = stepNeedsLiveValidation(step) && !isStepCurrentlyValid(step);
    }
    if (step === MAX && submit && !submitting) {
      submit.disabled = false;
    }
  }

  /* ---------- i18n ---------- */

  function applyI18n() {
    var p = pack();

    function setText(id, key) {
      var el = $(id);
      if (el && p[key] != null) el.textContent = p[key];
    }

    var tag = document.querySelector('[data-i18n="tagline"]');
    if (tag) tag.textContent = p.tagline || '';

    setText('signup-welcome-intro', 'welcome_intro');
    setText('signup-b1', 'welcome_b1');
    setText('signup-b2', 'welcome_b2');
    setText('signup-b3', 'welcome_b3');
    setText('signup-how-intro', 'how_intro');
    setText('signup-h1', 'how_b1');
    setText('signup-h2', 'how_b2');
    setText('signup-h3', 'how_b3');
    setText('signup-h4', 'how_b4');

    setText('label-signup-empresa', 'label_empresa');
    setText('label-signup-localizacao', 'label_local');
    setText('hint-local', 'hint_local');
    setText('note-org', 'note_org');
    setText('hint-email', 'hint_email');
    setText('terms-title', 'terms_title');
    setText('terms-body', 'terms_body');
    setText('terms-check-label', 'terms_check');
    setText('sum-intro', 'sum_intro');
    setText('sum-label-empresa', 'sum_empresa');
    setText('sum-label-local', 'sum_local');
    setText('sum-label-nif', 'sum_nif');
    setText('sum-label-email', 'sum_email');
    setText('sum-label-terms', 'sum_terms');
    setText('footer-has-account', 'footer_has_account');
    setText('signup-back-login', 'footer_login');

    var nifLab = $('label-signup-nif');
    if (nifLab) {
      nifLab.textContent = '';
      nifLab.appendChild(document.createTextNode(p.label_nif || ''));
      nifLab.appendChild(document.createTextNode(' '));
      var opt = document.createElement('span');
      opt.className = 'login-optional';
      opt.textContent = p.optional || '';
      nifLab.appendChild(opt);
    }

    function ph(id, key) {
      var el = $(id);
      if (el && p[key] != null) el.placeholder = p[key];
    }
    ph('signup-empresa', 'ph_empresa');
    ph('signup-localizacao', 'ph_local');
    ph('signup-nif', 'ph_nif');
    ph('signup-email', 'ph_email');
    ph('signup-password', 'ph_pass');
    ph('signup-password-2', 'ph_pass2');

    setText('label-signup-email', 'label_email');
    setText('label-signup-password', 'label_pass');
    setText('label-signup-password-2', 'label_pass2');

    var next = $('signup-next-btn');
    if (next && !submitting) next.textContent = p.btn_continue || 'Continuar';
    var sub = $('signup-submit-btn');
    if (sub && !submitting) sub.textContent = p.btn_create || 'Criar conta';

    var prev = $('signup-prev-btn');
    if (prev) prev.setAttribute('aria-label', p.aria_back || 'Voltar');
    var stepsNav = document.querySelector('.bp-signup-steps');
    if (stepsNav) stepsNav.setAttribute('aria-label', p.aria_progress || '');
    var langSel = $('bp-lang-select');
    if (langSel) langSel.setAttribute('aria-label', p.lang_label || 'Idioma');

    document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

    refreshStepChrome();
  }

  function refreshStepChrome() {
    var p = pack();
    var titleEl = $('signup-step-title');
    var lead = $('signup-wizard-lead');
    var meta = $('signup-step-meta');
    if (titleEl) titleEl.textContent = (p.titles && p.titles[step]) || '';
    if (lead) lead.textContent = (p.leads && p.leads[step]) || '';
    if (meta) {
      meta.textContent = String(p.step_meta || 'Passo {n} de 6').replace('{n}', String(step));
      meta.setAttribute('aria-live', 'polite');
    }
  }

  function setStep(n) {
    n = Math.max(1, Math.min(MAX, n | 0));
    step = n;
    clearBanner();
    clearFieldErrors();

    document.querySelectorAll('[data-signup-pane]').forEach(function (pane) {
      var pn = parseInt(pane.getAttribute('data-signup-pane'), 10);
      var on = pn === step;
      pane.hidden = !on;
      pane.classList.toggle('is-active', on);
    });
    document.querySelectorAll('[data-signup-step-ind]').forEach(function (el) {
      var pn = parseInt(el.getAttribute('data-signup-step-ind'), 10);
      el.classList.toggle('is-active', pn === step);
      el.classList.toggle('is-done', pn < step);
      if (pn === step) el.setAttribute('aria-current', 'step');
      else el.removeAttribute('aria-current');
    });

    var prev = $('signup-prev-btn');
    var next = $('signup-next-btn');
    var submit = $('signup-submit-btn');
    if (prev) prev.hidden = step <= 1;
    if (next) next.hidden = step >= MAX;
    if (submit) submit.hidden = step < MAX;

    refreshStepChrome();

    if (step === 6) {
      var p = pack();
      function put(id, v) {
        var el = $(id);
        if (el) el.textContent = v;
      }
      put('signup-sum-empresa', val('signup-empresa') || '—');
      put('signup-sum-local', val('signup-localizacao') || '—');
      put('signup-sum-nif', val('signup-nif') || p.sum_nif_empty || '—');
      put('signup-sum-email', val('signup-email') || '—');
      put('signup-sum-terms', ($('signup-terms') && $('signup-terms').checked) ? (p.sum_terms_ok || '') : '—');
    }

    syncPrimaryEnabled();
    saveDraft();
  }

  /* ---------- plan modal ---------- */

  function openPlanModal() {
    var p = pack();
    var days = trialDays();
    var bd = $('bp-plan-modal');
    if (!bd) return;
    function put(id, text) {
      var el = $(id);
      if (el) el.textContent = text || '';
    }
    put('bp-plan-title', p.plan_title);
    put('bp-plan-lead', p.plan_lead);
    put('bp-plan-name', p.plan_name);
    put('bp-plan-days', String(p.plan_days || '').replace('{days}', String(days)));
    put('bp-plan-b1', p.plan_b1);
    put('bp-plan-b2', p.plan_b2);
    put('bp-plan-b3', p.plan_b3);
    put('bp-plan-cta', p.plan_cta);
    put('bp-plan-secondary', p.plan_secondary);
    bd.hidden = false;
    var cta = $('bp-plan-cta');
    if (cta) {
      try { cta.focus(); } catch (_) {}
    }
  }

  function closePlanModal() {
    var bd = $('bp-plan-modal');
    if (bd) bd.hidden = true;
  }

  /* ---------- create account ---------- */

  async function createAccount() {
    if (submitting) return;
    clearBanner();

    var check = validateAllForSubmit();
    if (!check.ok) {
      setStep(check.step);
      /* re-run so errors show after setStep cleared them */
      validateStep(check.step);
      focusFirstError();
      return;
    }

    if (!navigator.onLine) {
      showBanner(t('err_offline'));
      return;
    }

    var payload = {
      empresa: val('signup-empresa'),
      localizacao: val('signup-localizacao'),
      nif: val('signup-nif'),
      email: val('signup-email').toLowerCase(),
      password: ($('signup-password') && $('signup-password').value) || '',
      termsAccepted: true,
      termsVersion: TERMS_VERSION,
      lang: lang
    };

    var submit = $('signup-submit-btn');
    submitting = true;
    if (submit) {
      submit.disabled = true;
      submit.textContent = t('btn_creating');
    }

    try {
      if (typeof global.bpSignupCreateAccount === 'function') {
        await global.bpSignupCreateAccount(payload);
      } else if (isDemo()) {
        await new Promise(function (r) { setTimeout(r, 500); });
        var taken = { 'existe@beautypro.ao': 1, 'taken@test.com': 1 };
        if (taken[payload.email]) {
          throw new Error('User already registered');
        }
        try {
          localStorage.setItem('bp_signup_last_ok', JSON.stringify({
            empresa: payload.empresa,
            localizacao: payload.localizacao,
            email: payload.email,
            trialDays: trialDays(),
            at: new Date().toISOString()
          }));
        } catch (_) {}
      } else {
        throw new Error('bpSignupCreateAccount is not configured');
      }
      clearDraft();
      openPlanModal();
    } catch (err) {
      var raw = err && err.message ? String(err.message) : '';
      if (/already|registered|exists|User already/i.test(raw)) {
        setStep(4);
        setFieldError('signup-email', t('err_email_exists_field'));
        showBanner(t('err_email_exists'), {
          actionLabel: t('footer_login'),
          onAction: function () {
            if (typeof global.bpShowAuthPanel === 'function') global.bpShowAuthPanel('login');
          }
        });
        focusFirstError();
      } else if (/network|fetch|Failed to fetch|timeout|offline/i.test(raw)) {
        showBanner(t('err_offline'));
      } else if (/5\d\d|server|unavailable|not configured/i.test(raw)) {
        showBanner(t('err_server'));
      } else {
        showBanner(t('err_generic'));
      }
    } finally {
      submitting = false;
      if (submit) {
        submit.disabled = false;
        submit.textContent = t('btn_create');
      }
      syncPrimaryEnabled();
    }
  }

  /* ---------- bind ---------- */

  function onLiveInput() {
    if (stepNeedsLiveValidation(step)) {
      /* clear only the field being fixed is optional; keep simple */
      syncPrimaryEnabled();
      saveDraft();
    }
  }

  function bind() {
    if (bound) return;
    bound = true;

    try {
      var storedLang = localStorage.getItem(LANG_KEY);
      if (storedLang && global.BP_SIGNUP_I18N && global.BP_SIGNUP_I18N[storedLang]) {
        lang = storedLang;
      }
    } catch (_) {}

    loadDraft();

    var sel = $('bp-lang-select');
    if (sel) {
      sel.innerHTML = '';
      (global.BP_SIGNUP_LANGS || []).forEach(function (L) {
        var o = document.createElement('option');
        o.value = L.code;
        o.textContent = L.label;
        if (L.code === lang) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () {
        lang = sel.value || 'pt';
        try { localStorage.setItem(LANG_KEY, lang); } catch (_) {}
        applyI18n();
        saveDraft();
      });
    }

    var next = $('signup-next-btn');
    if (next) {
      next.addEventListener('click', function () {
        if (step >= MAX) return;
        if (stepNeedsLiveValidation(step)) {
          var r = validateStep(step);
          if (!r.ok) {
            focusFirstError();
            return;
          }
        }
        setStep(step + 1);
      });
    }

    var prev = $('signup-prev-btn');
    if (prev) {
      prev.addEventListener('click', function () {
        if (step > 1) setStep(step - 1);
      });
    }

    var submit = $('signup-submit-btn');
    if (submit) {
      submit.addEventListener('click', function () { createAccount(); });
    }

    var backLogin = $('signup-back-login');
    if (backLogin) {
      backLogin.addEventListener('click', function () {
        if (typeof global.bpShowAuthPanel === 'function') global.bpShowAuthPanel('login');
      });
    }

    var tog = $('signup-pass-toggle');
    if (tog) {
      tog.addEventListener('click', function () {
        var p = $('signup-password');
        if (!p) return;
        p.type = p.type === 'password' ? 'text' : 'password';
      });
    }

    ['signup-empresa', 'signup-localizacao', 'signup-nif', 'signup-email',
      'signup-password', 'signup-password-2'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener('input', onLiveInput);
      el.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          if (step < MAX) {
            if (next) next.click();
          } else if (submit) {
            submit.click();
          }
        }
      });
    });

    var terms = $('signup-terms');
    if (terms) {
      terms.addEventListener('change', function () {
        setFieldError('signup-terms', '');
        syncPrimaryEnabled();
        saveDraft();
      });
    }

    var planCta = $('bp-plan-cta');
    if (planCta) {
      planCta.addEventListener('click', function () {
        closePlanModal();
        if (typeof global.bpOnSignupComplete === 'function') {
          global.bpOnSignupComplete();
        }
      });
    }

    var planSec = $('bp-plan-secondary');
    if (planSec) {
      planSec.addEventListener('click', function () {
        if (typeof global.bpOnViewPlans === 'function') {
          global.bpOnViewPlans();
        }
      });
    }

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        var bd = $('bp-plan-modal');
        if (bd && !bd.hidden) closePlanModal();
      }
    });

    applyI18n();
    setStep(step);
  }

  global.bpSignupCircuit = {
    init: bind,
    setStep: setStep,
    getStep: function () { return step; },
    setLang: function (code) {
      if (global.BP_SIGNUP_I18N && global.BP_SIGNUP_I18N[code]) {
        lang = code;
        try { localStorage.setItem(LANG_KEY, lang); } catch (_) {}
        applyI18n();
      }
    },
    clearDraft: clearDraft
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})(window);
