/**
 * BeautyPro — i18n circuito de autenticação (Etapa 4)
 * Preferência: localStorage bp_auth_lang
 * Não apaga campos do formulário ao mudar língua.
 */
(function (global) {
  var STORAGE_KEY = 'bp_auth_lang';
  var LANGS = [
    { code: 'pt', label: 'PT' },
    { code: 'en', label: 'EN' },
    { code: 'fr', label: 'FR' },
    { code: 'es', label: 'ES' },
    { code: 'ar', label: 'AR' },
    { code: 'zh', label: '中文' },
    { code: 'sw', label: 'SW' }
  ];

  var T = {
    pt: {
      step_of: 'Passo {n} de {max} · {name}',
      s1: 'Bem-vindo', s2: 'Como funciona', s3: 'Organização', s4: 'A sua conta', s5: 'Termos', s6: 'Confirmar',
      t1: 'Bem-vindo à BeautyPro', t2: 'Como funciona', t3: 'Organização', t4: 'A sua conta', t5: 'Termos de utilização', t6: 'Confirmar e criar',
      l1: 'Gestão do salão com controlo do proprietário.', l2: 'Papéis, dados e trabalho com rede instável.', l3: 'Nome, localização e NIF (opcional).', l4: 'Email e palavra-passe do proprietário.', l5: 'Leia o resumo e confirme a aceitação.', l6: 'Revise os dados antes de criar a conta.',
      continue: 'Continuar', create: 'Criar conta', back_login: 'Iniciar sessão', have_account: 'Já tem conta?',
      empresa: 'Empresa ou organização', localizacao: 'Localização', loc_hint: 'Cidade ou província onde o salão opera.', nif: 'NIF ou BI', optional: '(opcional)',
      email: 'Email', password: 'Palavra-passe', password2: 'Repita a palavra-passe',
      terms_title: 'Termos de utilização (resumo)', terms_accept: 'Li e aceito os termos de utilização para criar a conta da organização.',
      err_empresa: 'Indique o nome do salão ou da empresa.', err_empresa_short: 'O nome é demasiado curto.',
      err_loc: 'Indique a localização da empresa.', err_loc_short: 'A localização é demasiado curta.',
      err_nif: 'Formato de NIF/BI não reconhecido.', err_email: 'Indique um email válido.', err_pass: 'A palavra-passe deve ter no mínimo 8 caracteres.',
      err_pass2: 'As palavras-passe não coincidem.', err_terms: 'Para continuar, aceite os termos de utilização.',
      err_fix: 'Corrija os campos assinalados para continuar.',
      err_exists: 'Este email já tem conta BeautyPro. Inicie sessão ou recupere a palavra-passe.',
      err_network: 'Sem ligação à rede. Verifique a ligação e tente novamente.',
      err_server: 'Não foi possível criar a conta. Tente novamente.',
      sum_empresa: 'Empresa', sum_loc: 'Localização', sum_nif: 'NIF / BI', sum_email: 'Email', sum_terms: 'Termos', sum_terms_ok: 'Aceites', sum_terms_no: 'Não aceites', sum_nif_none: 'Não indicado',
      alter: 'Alterar',
      plan_title: 'Plano gratuito', plan_lead: 'A sua conta foi criada.', plan_body: 'Está a utilizar o plano gratuito durante {days} dias, conforme a política BeautyPro. Pode continuar e organizar o salão de imediato.',
      plan_c1: 'Agenda, clientes e caixa no mesmo espaço', plan_c2: 'Controlo do proprietário sobre acessos', plan_c3: 'Uso offline com sincronização quando houver rede',
      plan_note: 'Quando o prazo terminar, a política de planos da BeautyPro define as opções de continuidade.',
      plan_continue: 'Continuar com o plano gratuito', plan_view: 'Ver planos',
      login_title: 'Iniciar sessão', login_btn: 'Entrar', login_forgot: 'Recuperar palavra-passe', login_or: 'ou',
      login_empty_email: 'Indique o email.', login_empty_pass: 'Indique a palavra-passe.',
      login_bad: 'Email ou palavra-passe incorrectos.', login_network: 'Sem ligação à rede. Tente novamente.',
      recovery_title: 'Recuperar palavra-passe', recovery_lead: 'Indique o email da conta. Se existir, receberá instruções em breve.',
      recovery_send: 'Enviar instruções', recovery_back: 'Voltar ao início de sessão',
      recovery_sent: 'Se existir conta com este email, receberá instruções em breve.',
      recovery_invalid: 'Indique um email válido.'
    },
    en: {
      step_of: 'Step {n} of {max} · {name}',
      s1: 'Welcome', s2: 'How it works', s3: 'Organisation', s4: 'Your account', s5: 'Terms', s6: 'Confirm',
      t1: 'Welcome to BeautyPro', t2: 'How it works', t3: 'Organisation', t4: 'Your account', t5: 'Terms of use', t6: 'Confirm and create',
      l1: 'Salon management with owner control.', l2: 'Roles, data and unreliable networks.', l3: 'Name, location and tax ID (optional).', l4: 'Owner email and password.', l5: 'Read the summary and accept the terms.', l6: 'Review your details before creating the account.',
      continue: 'Continue', create: 'Create account', back_login: 'Sign in', have_account: 'Already have an account?',
      empresa: 'Business or organisation', localizacao: 'Location', loc_hint: 'City or province where the salon operates.', nif: 'Tax ID / ID', optional: '(optional)',
      email: 'Email', password: 'Password', password2: 'Confirm password',
      terms_title: 'Terms of use (summary)', terms_accept: 'I have read and accept the terms of use to create the organisation account.',
      err_empresa: 'Enter the salon or business name.', err_empresa_short: 'Name is too short.',
      err_loc: 'Enter the business location.', err_loc_short: 'Location is too short.',
      err_nif: 'Unrecognised tax ID format.', err_email: 'Enter a valid email.', err_pass: 'Password must be at least 8 characters.',
      err_pass2: 'Passwords do not match.', err_terms: 'Accept the terms to continue.',
      err_fix: 'Fix the highlighted fields to continue.',
      err_exists: 'This email already has a BeautyPro account. Sign in or reset your password.',
      err_network: 'No network connection. Check your connection and try again.',
      err_server: 'Could not create the account. Try again.',
      sum_empresa: 'Business', sum_loc: 'Location', sum_nif: 'Tax ID', sum_email: 'Email', sum_terms: 'Terms', sum_terms_ok: 'Accepted', sum_terms_no: 'Not accepted', sum_nif_none: 'Not provided',
      alter: 'Edit',
      plan_title: 'Free plan', plan_lead: 'Your account was created.', plan_body: 'You are on the free plan for {days} days under BeautyPro policy. You can continue and organise the salon right away.',
      plan_c1: 'Schedule, clients and cash in one place', plan_c2: 'Owner control over access', plan_c3: 'Offline use with sync when online',
      plan_note: 'When the period ends, BeautyPro plan policy defines continuity options.',
      plan_continue: 'Continue with free plan', plan_view: 'View plans',
      login_title: 'Sign in', login_btn: 'Sign in', login_forgot: 'Forgot password', login_or: 'or',
      login_empty_email: 'Enter your email.', login_empty_pass: 'Enter your password.',
      login_bad: 'Incorrect email or password.', login_network: 'No network connection. Try again.',
      recovery_title: 'Reset password', recovery_lead: 'Enter the account email. If it exists, you will receive instructions shortly.',
      recovery_send: 'Send instructions', recovery_back: 'Back to sign in',
      recovery_sent: 'If an account exists for this email, you will receive instructions shortly.',
      recovery_invalid: 'Enter a valid email.'
    }
  };

  /* Fallback: missing langs copy from en then overlay minimal */
  ['fr', 'es', 'ar', 'zh', 'sw'].forEach(function (code) {
    T[code] = Object.assign({}, T.en);
  });
  Object.assign(T.fr, {
    step_of: 'Étape {n} sur {max} · {name}', continue: 'Continuer', create: 'Créer le compte', back_login: 'Connexion',
    empresa: 'Entreprise ou organisation', localizacao: 'Localisation', email: 'E-mail', password: 'Mot de passe', password2: 'Confirmer le mot de passe',
    err_exists: 'Cet e-mail a déjà un compte BeautyPro.', plan_title: 'Offre gratuite', plan_continue: 'Continuer avec l’offre gratuite',
    login_title: 'Connexion', login_btn: 'Entrer', login_bad: 'E-mail ou mot de passe incorrect.', alter: 'Modifier'
  });
  Object.assign(T.es, {
    step_of: 'Paso {n} de {max} · {name}', continue: 'Continuar', create: 'Crear cuenta', back_login: 'Iniciar sesión',
    empresa: 'Empresa u organización', localizacao: 'Ubicación', email: 'Correo', password: 'Contraseña', password2: 'Repetir contraseña',
    err_exists: 'Este correo ya tiene cuenta BeautyPro.', plan_title: 'Plan gratuito', plan_continue: 'Continuar con el plan gratuito',
    login_title: 'Iniciar sesión', login_btn: 'Entrar', login_bad: 'Correo o contraseña incorrectos.', alter: 'Cambiar'
  });
  Object.assign(T.ar, {
    step_of: 'الخطوة {n} من {max} · {name}', continue: 'متابعة', create: 'إنشاء حساب', back_login: 'تسجيل الدخول',
    empresa: 'الشركة أو المؤسسة', localizacao: 'الموقع', email: 'البريد الإلكتروني', password: 'كلمة المرور',
    plan_title: 'الخطة المجانية', plan_continue: 'المتابعة بالخطة المجانية', login_title: 'تسجيل الدخول', login_btn: 'دخول', alter: 'تعديل'
  });
  Object.assign(T.zh, {
    step_of: '第 {n} 步，共 {max} 步 · {name}', continue: '继续', create: '创建账户', back_login: '登录',
    empresa: '企业或机构', localizacao: '位置', email: '电子邮箱', password: '密码', password2: '确认密码',
    plan_title: '免费方案', plan_continue: '继续使用免费方案', login_title: '登录', login_btn: '登录', alter: '修改'
  });
  Object.assign(T.sw, {
    step_of: 'Hatua {n} kati ya {max} · {name}', continue: 'Endelea', create: 'Unda akaunti', back_login: 'Ingia',
    empresa: 'Biashara au shirika', localizacao: 'Eneo', email: 'Barua pepe', password: 'Nenosiri',
    plan_title: 'Mpango wa bure', plan_continue: 'Endelea na mpango wa bure', login_title: 'Ingia', login_btn: 'Ingia', alter: 'Badilisha'
  });

  function getLang() {
    try {
      var s = localStorage.getItem(STORAGE_KEY);
      if (s && T[s]) return s;
    } catch (_) {}
    return 'pt';
  }

  function setLang(code) {
    if (!T[code]) code = 'pt';
    try { localStorage.setItem(STORAGE_KEY, code); } catch (_) {}
    return code;
  }

  function t(key, vars) {
    var lang = getLang();
    var pack = T[lang] || T.pt;
    var str = pack[key] != null ? pack[key] : (T.pt[key] != null ? T.pt[key] : key);
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        str = String(str).split('{' + k + '}').join(String(vars[k]));
      });
    }
    return str;
  }

  function applyStatic() {
    var lang = getLang();
    document.documentElement.setAttribute('lang', lang === 'pt' ? 'pt' : lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

    function text(sel, key, vars) {
      var el = document.querySelector(sel);
      if (el) el.textContent = t(key, vars);
    }
    function html(sel, key, vars) {
      var el = document.querySelector(sel);
      if (el) el.textContent = t(key, vars);
    }

    text('#login-card-main .login-title', 'login_title');
    var loginBtn = document.getElementById('login-btn');
    if (loginBtn && !loginBtn.classList.contains('is-loading')) loginBtn.textContent = t('login_btn');
    text('#login-forgot-btn', 'login_forgot');

    text('#signup-next-btn', 'continue');
    text('#signup-submit-btn', 'create');
    var back = document.getElementById('signup-back-login');
    if (back) back.textContent = t('back_login');

    text('label[for="signup-empresa"]', 'empresa');
    text('label[for="signup-localizacao"]', 'localizacao');
    var hint = document.querySelector('[data-field="signup-localizacao"] .bp-field-hint');
    if (hint) hint.textContent = t('loc_hint');
    var nifLab = document.querySelector('label[for="signup-nif"]');
    if (nifLab) nifLab.innerHTML = t('nif') + ' <span class="login-optional">' + t('optional') + '</span>';
    text('label[for="signup-email"]', 'email');
    text('label[for="signup-password"]', 'password');
    text('label[for="signup-password-2"]', 'password2');
    var termsSpan = document.querySelector('.bp-signup-check span');
    if (termsSpan) termsSpan.textContent = t('terms_accept');

    text('#bp-plan-title', 'plan_title');
    text('#bp-plan-continue', 'plan_continue');
    text('#bp-plan-view', 'plan_view');
    text('#bp-plan-note', 'plan_note');

    var sel = document.getElementById('bp-auth-lang');
    if (sel) sel.value = lang;

    if (typeof global.bpSignupSetStep === 'function' && typeof global.__bpSignupStep === 'number') {
      try { global.bpSignupSetStep(global.__bpSignupStep); } catch (_) {}
    } else if (typeof global.bpSignupSetStep === 'function') {
      /* ignore */
    }
  }

  function buildSelector(container) {
    if (!container || document.getElementById('bp-auth-lang')) return;
    var wrap = document.createElement('div');
    wrap.className = 'bp-auth-lang-wrap';
    wrap.innerHTML = '<label class="bp-auth-lang-label" for="bp-auth-lang">Lang</label>' +
      '<select id="bp-auth-lang" class="bp-auth-lang" aria-label="Language"></select>';
    var sel = wrap.querySelector('select');
    LANGS.forEach(function (L) {
      var o = document.createElement('option');
      o.value = L.code;
      o.textContent = L.label;
      sel.appendChild(o);
    });
    sel.value = getLang();
    sel.addEventListener('change', function () {
      setLang(sel.value);
      applyStatic();
      if (typeof global.bpSignupSetStep === 'function') {
        var st = (typeof global.__bpSignupStep === 'number') ? global.__bpSignupStep : 1;
        try { global.bpSignupSetStep(st); } catch (_) {}
      }
      if (typeof global.bpSignupSyncCta === 'function') {
        try { global.bpSignupSyncCta(); } catch (_) {}
      }
    });
    container.appendChild(wrap);
  }

  global.bpAuthI18n = {
    t: t,
    getLang: getLang,
    setLang: setLang,
    apply: applyStatic,
    buildSelector: buildSelector,
    LANGS: LANGS
  };
})(typeof window !== 'undefined' ? window : this);
