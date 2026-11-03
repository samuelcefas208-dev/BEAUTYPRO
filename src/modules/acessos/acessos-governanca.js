/**
 * BeautyPro — Acessos (aba completa)
 * Reauth verdadeiro · níveis dinâmicos · CTAs tipográficos neutros
 */
(function (g) {
  'use strict';

  var STACK = [];
  var RETURN_TAB = null;
  /** Seleção de abas por convite em curso { role, tabs: { id: bool } } */
  var INVITE_ACCESS = null;

  var SO_RESPONSAVEL = Object.freeze([
    'Gerir membros e convites',
    'Alterar níveis de acesso (gerente e operador)',
    'Suspender ou repor o acesso de contas',
    'Operações e abas reservadas ao responsável na matriz de permissões'
  ]);

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function mountEl() {
    return document.getElementById('bp-acessos-mount');
  }

  function setHead(title, eyebrow) {
    var t = document.getElementById('bp-acessos-title');
    var e = document.getElementById('bp-acessos-eyebrow');
    if (t) t.textContent = title || 'Acessos';
    if (e) e.textContent = eyebrow || 'Configurações';
  }

  function entendi(mensagem, titulo) {
    var msg = String(mensagem || '');
    var title = titulo || 'Informação';
    if (typeof bpInfoEntendi === 'function') {
      bpInfoEntendi(msg, title);
      return;
    }
    if (typeof mostrarErro === 'function' && document.getElementById('modal-erro')) {
      mostrarErro(msg, null, title, null, { okLabel: 'Entendi' });
      return;
    }
    if (typeof toast === 'function') toast(msg, 'info');
  }

  /** Força CTAs do #modal-confirm para tipografia neutra (sem fundo de botão). */
  function styleNeutralConfirmCtas(opts) {
    opts = opts || {};
    setTimeout(function () {
      try {
        var ok = document.getElementById('confirm-ok-btn');
        var cancel = document.getElementById('confirm-cancel-btn');
        if (ok) {
          ok.className = 'btn bp-btn-ink-strong btn-modal-compact';
          ok.textContent = opts.okLabel || 'Entendi';
          ok.style.background = 'transparent';
          ok.style.boxShadow = 'none';
          ok.style.border = 'none';
        }
        if (cancel) {
          if (opts.hideCancel) {
            cancel.style.display = 'none';
          } else {
            cancel.className = 'btn bp-btn-ink-muted btn-modal-compact';
            cancel.textContent = opts.cancelLabel || 'Cancelar';
            cancel.style.background = 'transparent';
            cancel.style.boxShadow = 'none';
            cancel.style.border = 'none';
            cancel.style.display = '';
          }
        }
      } catch (_) {}
    }, 40);
  }

  function iconWarn() {
    return (
      '<span class="bp-acessos-ico-warn" aria-hidden="true">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none">' +
      '<path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/>' +
      '</svg></span>'
    );
  }

  function roleLabel(r) {
    if (r === 'admin') return 'Administrador';
    if (r === 'gerente') return 'Gerente';
    if (r === 'operador') return 'Operador';
    return r || '—';
  }

  function defaultTabsForRole(role) {
    var map = {};
    if (typeof BP_ACCESS_TABS === 'undefined') return map;
    var defaults = typeof bpAccessDefaults === 'function' ? bpAccessDefaults() : {};
    var over = typeof bpLoadAccessOverrides === 'function' ? bpLoadAccessOverrides() : {};
    BP_ACCESS_TABS.forEach(function (tab) {
      var on = defaults[role] && defaults[role][tab.id];
      if (over[role] && typeof over[role][tab.id] === 'boolean') on = over[role][tab.id];
      map[tab.id] = !!on;
    });
    return map;
  }

  function showAcessosTab() {
    try {
      if (typeof activeTab !== 'undefined' && activeTab && activeTab !== 'acessos') {
        RETURN_TAB = activeTab;
      }
    } catch (_) {}
    try {
      if (typeof activeTab !== 'undefined') activeTab = 'acessos';
      g.activeTab = 'acessos';
    } catch (_) {}
    document.querySelectorAll('.tab-pane').forEach(function (p) {
      p.classList.remove('active');
    });
    var pane = document.getElementById('tab-acessos');
    if (pane) pane.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(function (n) {
      n.classList.remove('active');
      n.setAttribute('aria-selected', 'false');
    });
    try {
      document.body.classList.add('bp-acessos-open');
    } catch (_) {}
  }

  function leaveAcessosTab() {
    STACK = [];
    INVITE_ACCESS = null;
    try {
      document.body.classList.remove('bp-acessos-open');
    } catch (_) {}
    var ret = RETURN_TAB || 'dashboard';
    RETURN_TAB = null;
    try {
      if (typeof activeTab !== 'undefined') activeTab = ret;
      g.activeTab = ret;
    } catch (_) {}
    var pane = document.getElementById('tab-acessos');
    if (pane) pane.classList.remove('active');
    var target = document.getElementById('tab-' + ret);
    if (target) target.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(function (n) {
      var on = n.getAttribute('data-tab') === ret;
      n.classList.toggle('active', on);
      n.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (typeof ativarAbaAtiva === 'function') {
      try {
        ativarAbaAtiva();
      } catch (_) {}
    }
  }

  function pushView(name) {
    STACK.push(name);
  }

  function popView() {
    if (STACK.length <= 1) {
      leaveAcessosTab();
      return;
    }
    STACK.pop();
    var top = STACK[STACK.length - 1];
    if (top === 'hub') renderHub();
    else if (top === 'org') openOrg(true);
    else if (top === 'conta') openConta(true);
    else if (top === 'membros') openMembros(true);
    else if (top === 'niveis') openNiveis(true);
    else if (top === 'convidar') openConvidar(true);
    else renderHub();
  }

  async function authHeaders() {
    var session = null;
    try {
      var r = await supabaseClient.auth.getSession();
      session = r && r.data && r.data.session;
    } catch (_) {}
    if (!session || !session.access_token) {
      throw new Error('Sessão terminada. Volte a iniciar sessão.');
    }
    return {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + session.access_token,
      apikey: typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : ''
    };
  }

  /**
   * Classificação honesta de erros de rede:
   * só NETWORK se o fetch falhar de verdade (TypeError / Failed to fetch).
   * Nunca usar navigator.onLine sozinho para acusar “rede instável”.
   */
  async function edgePost(url, body) {
    var headers = await authHeaders();
    var resp;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body || {})
      });
    } catch (e) {
      var net = new Error(
        'Não foi possível contactar o servidor. Verifique a ligação e tente novamente.'
      );
      net.code = 'NETWORK';
      throw net;
    }
    var data = null;
    try {
      data = await resp.json();
    } catch (_) {
      data = {};
    }
    if (!resp.ok) {
      var msg = (data && data.error) || 'Pedido não concluído.';
      if (resp.status === 404) {
        msg =
          'Função no servidor não encontrada (404). Publique invite-membro / set-membro-bloqueio no Supabase ou confirme o URL.';
      }
      var ex = new Error(msg);
      ex.code = resp.status === 404 ? 'NOT_FOUND' : 'EDGE';
      ex.status = resp.status;
      throw ex;
    }
    return data;
  }

  function explainEdgeError(e) {
    if (!e) {
      entendi('Não foi possível concluir a operação.', 'Operação incompleta');
      return;
    }
    if (e.code === 'NETWORK') {
      entendi(e.message, 'Ligação');
      return;
    }
    entendi(e.message || 'Não foi possível concluir a operação.', 'Operação incompleta');
  }

  /**
   * Step-up sem mentir sobre a rede.
   * 1) Preferência: supabase.auth.signInWithPassword (mesmo caminho do login)
   *    com __bpAuthReauthInProgress para NÃO reentrar app / sync de login.
   * 2) Fallback HTTP /auth/v1/token se o cliente falhar de forma atípica.
   * 404 = URL/função em falta (mensagem explícita, não "rede instável").
   */
  function isAuthCredentialError(err) {
    if (!err) return false;
    var m = String(err.message || err.error_description || err.msg || '').toLowerCase();
    var st = err.status || err.statusCode || 0;
    if (st === 400 || st === 401) return true;
    return /invalid login|invalid credentials|wrong password|email not confirmed|user not found|invalid_grant/.test(m);
  }

  function isNetworkFailure(err) {
    if (!err) return false;
    if (typeof TypeError !== 'undefined' && err instanceof TypeError) return true;
    var m = String(err.message || '').toLowerCase();
    return /failed to fetch|networkerror|load failed|err_network|econnrefused|enotfound/.test(m);
  }

  async function verifyPasswordWithAuthApi(email, password) {
    window.__bpAuthReauthInProgress = true;
    try {
      /* Caminho principal: mesmo do ecrã de login */
      var res = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
      if (res && res.error) {
        if (isAuthCredentialError(res.error)) {
          return { ok: false, reason: 'credentials', message: 'Palavra-passe incorrecta.' };
        }
        if (isNetworkFailure(res.error)) {
          return {
            ok: false,
            reason: 'network',
            message: 'Não foi possível contactar o servidor de autenticação. Tente novamente.'
          };
        }
        var st = res.error.status || 0;
        if (st === 404) {
          return {
            ok: false,
            reason: 'not_found',
            message: 'Serviço de autenticação não encontrado (404). Verifique a URL do projecto Supabase.'
          };
        }
        return {
          ok: false,
          reason: 'server',
          message: res.error.message || 'Não foi possível validar a palavra-passe.'
        };
      }
      return { ok: true };
    } catch (e) {
      if (isNetworkFailure(e)) {
        return {
          ok: false,
          reason: 'network',
          message: 'Não foi possível contactar o servidor de autenticação. Tente novamente.'
        };
      }
      /* Fallback HTTP explícito */
      try {
        var baseUrl = String((typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL) || '').replace(/\/$/, '');
        var anon = (typeof SUPABASE_ANON_KEY !== 'undefined' && SUPABASE_ANON_KEY) || '';
        if (!baseUrl || !anon) {
          return { ok: false, reason: 'config', message: 'Configuração Auth incompleta.' };
        }
        var url = baseUrl + '/auth/v1/token?grant_type=password';
        var resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: anon,
            Authorization: 'Bearer ' + anon
          },
          body: JSON.stringify({ email: email, password: password })
        });
        if (resp.ok) return { ok: true };
        if (resp.status === 400 || resp.status === 401) {
          return { ok: false, reason: 'credentials', message: 'Palavra-passe incorrecta.' };
        }
        if (resp.status === 404) {
          return {
            ok: false,
            reason: 'not_found',
            message: 'Endpoint Auth 404. Confirme SUPABASE_URL do projecto.'
          };
        }
        return {
          ok: false,
          reason: 'server',
          message: 'Autenticação devolveu HTTP ' + resp.status + '.'
        };
      } catch (e2) {
        if (isNetworkFailure(e2)) {
          return {
            ok: false,
            reason: 'network',
            message: 'Não foi possível contactar o servidor de autenticação. Tente novamente.'
          };
        }
        return {
          ok: false,
          reason: 'server',
          message: (e && e.message) || 'Não foi possível validar a palavra-passe.'
        };
      }
    } finally {
      try {
        window.__bpAuthReauthInProgress = false;
      } catch (_) {}
    }
  }

  function bpReauthPassword() {
    return new Promise(function (resolve) {
      var email = '';

      function run() {
        var ov = document.getElementById('bp-reauth-overlay');
        if (ov) ov.remove();
        ov = document.createElement('div');
        ov.id = 'bp-reauth-overlay';
        ov.className = 'modal-overlay modal-overlay--center open';
        ov.setAttribute('role', 'dialog');
        ov.setAttribute('aria-modal', 'true');
        ov.setAttribute('aria-labelledby', 'bp-reauth-title');
        ov.style.display = 'flex';
        ov.innerHTML =
          '<div class="modal-confirm-sheet bp-reauth-sheet">' +
          '<h2 id="bp-reauth-title" class="confirm-title">Confirmar palavra-passe</h2>' +
          '<p class="confirm-message">Para continuar, introduza a palavra-passe desta conta.</p>' +
          '<div class="input-group bp-reauth-field">' +
          '<label class="input-label" for="bp-reauth-pass">Palavra-passe</label>' +
          '<input type="password" id="bp-reauth-pass" class="input-field" autocomplete="current-password" />' +
          '</div>' +
          '<p class="login-error bp-reauth-err" id="bp-reauth-err" hidden></p>' +
          '<div class="confirm-actions">' +
          '<button type="button" class="btn bp-btn-ink-muted btn-modal-compact" data-reauth-cancel>Cancelar</button>' +
          '<button type="button" class="btn bp-btn-ink-strong btn-modal-compact" data-reauth-ok>Confirmar</button>' +
          '</div></div>';
        document.body.appendChild(ov);

        var settled = false;
        function close(ok) {
          if (settled) return;
          settled = true;
          try {
            document.removeEventListener('keydown', onEsc, true);
          } catch (_) {}
          try {
            ov.remove();
          } catch (_) {}
          resolve(!!ok);
        }
        function onEsc(e) {
          if (e.key !== 'Escape') return;
          e.preventDefault();
          close(false);
        }
        document.addEventListener('keydown', onEsc, true);
        ov.addEventListener('click', function (e) {
          if (e.target === ov) close(false);
        });
        ov.querySelector('[data-reauth-cancel]').onclick = function () {
          close(false);
        };
        ov.querySelector('[data-reauth-ok]').onclick = async function () {
          var passEl = document.getElementById('bp-reauth-pass');
          var pass = (passEl && passEl.value) || '';
          var err = document.getElementById('bp-reauth-err');
          function showErr(text) {
            if (err) {
              err.textContent = text;
              err.hidden = false;
            }
          }
          if (!pass) {
            showErr('Indique a palavra-passe.');
            return;
          }
          if (!email) {
            showErr('Não foi possível identificar o email da sessão. Volte a iniciar sessão.');
            return;
          }
          var okBtn = ov.querySelector('[data-reauth-ok]');
          if (okBtn) {
            okBtn.disabled = true;
            okBtn.setAttribute('aria-busy', 'true');
          }
          try {
            var result = await verifyPasswordWithAuthApi(email, pass);
            if (result.ok) {
              close(true);
              return;
            }
            showErr(result.message || 'Não foi possível validar a palavra-passe.');
          } catch (e) {
            showErr((e && e.message) || 'Não foi possível validar a palavra-passe.');
          }
          if (okBtn) {
            okBtn.disabled = false;
            okBtn.removeAttribute('aria-busy');
          }
        };
        setTimeout(function () {
          try {
            document.getElementById('bp-reauth-pass').focus();
          } catch (_) {}
        }, 120);
      }

      function loadEmailThenRun() {
        try {
          supabaseClient.auth.getSession().then(function (s) {
            email =
              (s && s.data && s.data.session && s.data.session.user && s.data.session.user.email) || '';
            if (email) {
              run();
              return;
            }
            supabaseClient.auth.getUser().then(function (r) {
              email = (r && r.data && r.data.user && r.data.user.email) || '';
              run();
            }).catch(function () {
              run();
            });
          }).catch(function () {
            run();
          });
        } catch (_) {
          run();
        }
      }

      loadEmailThenRun();
    });
  }

  /** Modal dinâmico: abas efectivamente seleccionadas + reservas do responsável */
  function explicarNivelDinamico(role, tabsMap) {
    return new Promise(function (resolve) {
      var labelsOn = [];
      var labelsOff = [];
      if (typeof BP_ACCESS_TABS !== 'undefined' && tabsMap) {
        BP_ACCESS_TABS.forEach(function (tab) {
          if (tabsMap[tab.id]) labelsOn.push(tab.label);
          else labelsOff.push(tab.label);
        });
      }
      var titulo = role === 'gerente' ? 'Nível gerente' : 'Nível operador';
      var intro =
        role === 'gerente'
          ? 'Com base na selecção actual, este gerente terá acesso às áreas indicadas abaixo.'
          : 'Com base na selecção actual, este operador terá acesso às áreas indicadas abaixo.';

      var html =
        '<div class="bp-acessos-nivel-doc">' +
        '<p class="bp-acessos-nivel-intro">' +
        esc(intro) +
        '</p>' +
        '<p class="bp-acessos-nivel-h">Áreas com acesso</p>';
      if (labelsOn.length) {
        html +=
          '<ul class="bp-acessos-nivel-list">' +
          labelsOn
            .map(function (x) {
              return '<li>' + esc(x) + '</li>';
            })
            .join('') +
          '</ul>';
      } else {
        html += '<p class="bp-acessos-meta">Nenhuma área seleccionada.</p>';
      }
      if (labelsOff.length) {
        html +=
          '<p class="bp-acessos-nivel-h">Áreas sem acesso</p><ul class="bp-acessos-nivel-list">' +
          labelsOff
            .map(function (x) {
              return '<li>' + esc(x) + '</li>';
            })
            .join('') +
          '</ul>';
      }
      html +=
        '<p class="bp-acessos-nivel-h bp-acessos-nivel-h--risk">' +
        iconWarn() +
        'Reservado ao responsável</p><ul class="bp-acessos-nivel-list bp-acessos-nivel-list--risk">' +
        SO_RESPONSAVEL.map(function (x) {
          return '<li>' + esc(x) + '</li>';
        }).join('') +
        '</ul></div>';

      if (typeof showConfirmModal === 'function') {
        var p = showConfirmModal(titulo, ' ', false, {
          confirmLabel: 'Entendi',
          cancelLabel: 'Fechar',
          inkButtons: true
        });
        styleNeutralConfirmCtas({ okLabel: 'Entendi', hideCancel: true });
        setTimeout(function () {
          try {
            var msg = document.getElementById('confirm-message');
            if (msg) {
              msg.innerHTML = html;
              msg.classList.add('bp-acessos-confirm-rich');
            }
          } catch (_) {}
        }, 60);
        p.then(function () {
          resolve(true);
        }).catch(function () {
          resolve(true);
        });
        return;
      }
      entendi(intro, titulo);
      resolve(true);
    });
  }

  /** Escolher abas para o novo membro (após escolher nível) */
  function escolherAcessosNivel(role) {
    return new Promise(function (resolve) {
      if (typeof BP_ACCESS_TABS === 'undefined') {
        resolve(defaultTabsForRole(role));
        return;
      }
      var defaults = defaultTabsForRole(role);
      var ov = document.getElementById('bp-access-pick-overlay');
      if (ov) ov.remove();
      ov = document.createElement('div');
      ov.id = 'bp-access-pick-overlay';
      ov.className = 'modal-overlay modal-overlay--center open';
      ov.style.display = 'flex';
      var checks = BP_ACCESS_TABS.map(function (tab) {
        return (
          '<label class="bp-acessos-check"><input type="checkbox" data-tab="' +
          esc(tab.id) +
          '"' +
          (defaults[tab.id] ? ' checked' : '') +
          '/><span>' +
          esc(tab.label) +
          '</span></label>'
        );
      }).join('');
      ov.innerHTML =
        '<div class="modal-confirm-sheet bp-reauth-sheet">' +
        '<h2 class="confirm-title">Acessos do ' +
        esc(role === 'gerente' ? 'gerente' : 'operador') +
        '</h2>' +
        '<p class="confirm-message">Seleccione as áreas que este membro poderá abrir.</p>' +
        '<div class="bp-acessos-pick-list">' +
        checks +
        '</div>' +
        '<div class="confirm-actions">' +
        '<button type="button" class="btn bp-btn-ink-muted btn-modal-compact" data-pick-cancel>Cancelar</button>' +
        '<button type="button" class="btn bp-btn-ink-strong btn-modal-compact" data-pick-ok>Continuar</button>' +
        '</div></div>';
      document.body.appendChild(ov);
      function finish(map) {
        try {
          ov.remove();
        } catch (_) {}
        resolve(map);
      }
      ov.querySelector('[data-pick-cancel]').onclick = function () {
        finish(null);
      };
      ov.querySelector('[data-pick-ok]').onclick = function () {
        var map = {};
        ov.querySelectorAll('input[data-tab]').forEach(function (inp) {
          map[inp.getAttribute('data-tab')] = !!inp.checked;
        });
        finish(map);
      };
      ov.addEventListener('click', function (e) {
        if (e.target === ov) finish(null);
      });
    });
  }

  async function onRoleChosen(role) {
    if (!role) return;
    var map = await escolherAcessosNivel(role);
    if (!map) {
      /* cancelou selecção de abas — limpar nível */
      var sel = document.getElementById('bp-inv-role');
      if (sel) sel.value = '';
      INVITE_ACCESS = null;
      return;
    }
    INVITE_ACCESS = { role: role, tabs: map };
    await explicarNivelDinamico(role, map);
  }

  async function loadMembros() {
    var sid = state.config && state.config.salaoId;
    if (!sid) return [];
    var { data, error } = await supabaseClient
      .from('profiles')
      .select('user_id, nome, role, email, bloqueado, ativo, is_owner')
      .eq('salao_id', sid)
      .order('nome');
    if (error) throw error;
    return data || [];
  }

  async function loadSalaoNome() {
    var sid = state.config && state.config.salaoId;
    if (!sid) return (state.config && state.config.storeName) || 'Organização';
    try {
      var { data } = await supabaseClient.from('saloes').select('nome').eq('id', sid).maybeSingle();
      if (data && data.nome) return data.nome;
    } catch (_) {}
    return (state.config && state.config.storeName) || 'Organização';
  }

  function renderHub() {
    setHead('Acessos', 'Configurações');
    var body = mountEl();
    if (!body) return;
    body.innerHTML =
      '<ul class="bp-acessos-menu">' +
      '<li><button type="button" class="bp-acessos-row" data-go="org"><span class="bp-acessos-row-label">Organização</span><span class="bp-acessos-row-hint">Nome do espaço</span></button></li>' +
      '<li><button type="button" class="bp-acessos-row" data-go="conta"><span class="bp-acessos-row-label">A sua conta</span><span class="bp-acessos-row-hint">Nome e email</span></button></li>' +
      '<li><button type="button" class="bp-acessos-row" data-go="membros"><span class="bp-acessos-row-label">Membros</span><span class="bp-acessos-row-hint">Equipa e estados de acesso</span></button></li>' +
      '<li><button type="button" class="bp-acessos-row" data-go="niveis"><span class="bp-acessos-row-label">Níveis de acesso</span><span class="bp-acessos-row-hint">Gerente e operador</span></button></li>' +
      '</ul>';
    body.querySelectorAll('[data-go]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var go = btn.getAttribute('data-go');
        if (go === 'org') openOrg(false);
        else if (go === 'conta') openConta(false);
        else if (go === 'membros') openMembros(false);
        else if (go === 'niveis') openNiveis(false);
      });
    });
  }

  function openHub() {
    if (typeof bpPode === 'function' && !bpPode(['admin'])) {
      if (typeof toast === 'function') {
        toast('Apenas o responsável da organização gere os acessos.', 'warning');
      }
      return;
    }
    if (!document.getElementById('tab-acessos') || !mountEl()) {
      if (typeof toast === 'function') toast('Ecrã de acessos indisponível.', 'error');
      return;
    }
    STACK = ['hub'];
    showAcessosTab();
    renderHub();
  }

  async function openOrg(fromStack) {
    if (!fromStack) pushView('org');
    setHead('Organização', 'Acessos');
    var body = mountEl();
    body.innerHTML = '<p class="bp-acessos-status">A carregar…</p>';
    try {
      var nome = await loadSalaoNome();
      body.innerHTML =
        '<div class="bp-acessos-panel">' +
        '<div class="input-group"><label class="input-label">Nome da organização</label>' +
        '<input type="text" class="input-field" id="bp-org-nome" value="' +
        esc(nome) +
        '" autocomplete="organization" /></div>' +
        '<button type="button" class="btn btn-primary btn-block" id="bp-org-save">Guardar</button></div>';
      document.getElementById('bp-org-save').onclick = async function () {
        var n = (document.getElementById('bp-org-nome').value || '').trim();
        if (!n) {
          toast('Indique o nome da organização.', 'warning');
          return;
        }
        if (!(await bpReauthPassword())) return;
        try {
          var { error } = await supabaseClient.from('saloes').update({ nome: n }).eq('id', state.config.salaoId);
          if (error) throw error;
          state.config.storeName = n;
          toast('Nome actualizado.', 'success');
        } catch (e) {
          explainEdgeError(e);
        }
      };
    } catch (e) {
      body.innerHTML = '<p class="bp-acessos-status">Não foi possível carregar.</p>';
    }
  }

  async function openConta(fromStack) {
    if (!fromStack) pushView('conta');
    setHead('A sua conta', 'Acessos');
    var body = mountEl();
    body.innerHTML = '<p class="bp-acessos-status">A carregar…</p>';
    try {
      var u = await supabaseClient.auth.getUser();
      var user = u && u.data && u.data.user;
      var { data: prof } = await supabaseClient
        .from('profiles')
        .select('nome, email, role')
        .eq('user_id', user.id)
        .maybeSingle();
      body.innerHTML =
        '<div class="bp-acessos-panel">' +
        '<div class="input-group"><label class="input-label">Nome</label>' +
        '<input type="text" class="input-field" id="bp-conta-nome" value="' +
        esc((prof && prof.nome) || '') +
        '" /></div>' +
        '<div class="input-group"><label class="input-label">Email</label>' +
        '<input type="text" class="input-field" value="' +
        esc((user && user.email) || '') +
        '" disabled /></div>' +
        '<p class="bp-acessos-meta">Nível: ' +
        esc(roleLabel(prof && prof.role)) +
        '</p>' +
        '<button type="button" class="btn btn-primary btn-block" id="bp-conta-save">Guardar nome</button></div>';
      document.getElementById('bp-conta-save').onclick = async function () {
        var n = (document.getElementById('bp-conta-nome').value || '').trim();
        if (!n) {
          toast('Indique o seu nome.', 'warning');
          return;
        }
        try {
          var { error } = await supabaseClient.from('profiles').update({ nome: n }).eq('user_id', user.id);
          if (error) throw error;
          toast('Nome actualizado.', 'success');
        } catch (e) {
          explainEdgeError(e);
        }
      };
    } catch (e) {
      body.innerHTML = '<p class="bp-acessos-status">Não foi possível carregar a conta.</p>';
    }
  }

  async function openMembros(fromStack) {
    if (!fromStack) pushView('membros');
    setHead('Membros', 'Acessos');
    var body = mountEl();
    body.innerHTML = '<p class="bp-acessos-status">A carregar…</p>';
    try {
      var list = await loadMembros();
      var html =
        '<div class="bp-acessos-panel">' +
        '<button type="button" class="btn btn-primary btn-block" id="bp-membro-add">Adicionar membro</button>' +
        '<ul class="bp-acessos-menu bp-acessos-menu--members">';
      list.forEach(function (m) {
        var st = m.bloqueado ? 'Acesso suspenso' : m.ativo === false ? 'Inactivo' : 'Activo';
        html +=
          '<li><button type="button" class="bp-acessos-row" data-uid="' +
          esc(m.user_id) +
          '"><span class="bp-acessos-row-label">' +
          esc(m.nome || m.email || 'Membro') +
          '</span><span class="bp-acessos-row-hint">' +
          esc(roleLabel(m.role)) +
          ' · ' +
          esc(st) +
          '</span></button></li>';
      });
      html += '</ul></div>';
      body.innerHTML = html;
      document.getElementById('bp-membro-add').onclick = function () {
        openConvidar(false);
      };
      body.querySelectorAll('[data-uid]').forEach(function (btn) {
        btn.onclick = function () {
          openMembroDetalhe(btn.getAttribute('data-uid'));
        };
      });
    } catch (e) {
      body.innerHTML = '<p class="bp-acessos-status">' + esc((e && e.message) || 'Erro ao listar') + '</p>';
    }
  }

  function openConvidar(fromStack) {
    if (!fromStack) pushView('convidar');
    INVITE_ACCESS = null;
    setHead('Novo membro', 'Membros');
    var body = mountEl();
    body.innerHTML =
      '<div class="bp-acessos-panel">' +
      '<div class="input-group"><label class="input-label">Nome</label>' +
      '<input type="text" class="input-field" id="bp-inv-nome" autocomplete="name" /></div>' +
      '<div class="input-group"><label class="input-label">Email</label>' +
      '<input type="email" class="input-field" id="bp-inv-email" autocomplete="off" /></div>' +
      '<div class="input-group"><label class="input-label">Nível</label>' +
      '<select class="input-field" id="bp-inv-role">' +
      '<option value="" selected disabled>Seleccionar nível</option>' +
      '<option value="operador">Operador</option>' +
      '<option value="gerente">Gerente</option></select></div>' +
      '<div class="input-group"><label class="input-label">Palavra-passe inicial <span class="login-optional">(opcional)</span></label>' +
      '<input type="password" class="input-field" id="bp-inv-pass" autocomplete="new-password" placeholder="Mínimo 8 caracteres" /></div>' +
      '<p class="bp-acessos-meta">Sem palavra-passe, o membro define-a pelo email de recuperação.</p>' +
      '<button type="button" class="btn btn-primary btn-block" id="bp-inv-go">Criar acesso</button></div>';

    var roleSel = document.getElementById('bp-inv-role');
    roleSel.addEventListener('change', function () {
      var role = roleSel.value;
      if (role === 'gerente' || role === 'operador') {
        onRoleChosen(role);
      }
    });

    document.getElementById('bp-inv-go').onclick = async function () {
      var nome = (document.getElementById('bp-inv-nome').value || '').trim();
      var email = (document.getElementById('bp-inv-email').value || '').trim();
      var role = document.getElementById('bp-inv-role').value;
      var pass = (document.getElementById('bp-inv-pass').value || '').trim();
      if (!role) {
        toast('Seleccione o nível (operador ou gerente).', 'warning');
        return;
      }
      if (!INVITE_ACCESS || INVITE_ACCESS.role !== role) {
        toast('Defina os acessos do nível antes de criar o membro.', 'warning');
        await onRoleChosen(role);
        if (!INVITE_ACCESS) return;
      }
      if (!(await bpReauthPassword())) return;
      try {
        var url =
          (typeof INVITE_MEMBRO_EDGE_URL !== 'undefined' && INVITE_MEMBRO_EDGE_URL) ||
          SUPABASE_URL + '/functions/v1/invite-membro';
        var res = await edgePost(url, {
          nome: nome,
          email: email,
          role: role,
          password: pass || undefined,
          access_tabs: INVITE_ACCESS.tabs
        });
        var msg = (res && res.note) || 'Membro criado com o nível e as áreas que definiu.';
        if (typeof bpAcessosEntendi === 'function' || typeof entendi === 'function') {
          (typeof entendi === 'function' ? entendi : bpAcessosEntendi)(msg, 'Membro adicionado');
        } else if (typeof toast === 'function') toast(msg, 'success');
        INVITE_ACCESS = null;
        openMembros(false);
      } catch (e) {
        explainEdgeError(e);
      }
    };
  }

  async function openMembroDetalhe(uid) {
    pushView('membro');
    setHead('Membro', 'Membros');
    var body = mountEl();
    body.innerHTML = '<p class="bp-acessos-status">A carregar…</p>';
    try {
      var list = await loadMembros();
      var m = list.filter(function (x) {
        return x.user_id === uid;
      })[0];
      if (!m) {
        body.innerHTML = '<p class="bp-acessos-status">Membro não encontrado.</p>';
        return;
      }
      var st = m.bloqueado ? 'Acesso suspenso' : 'Activo';
      var dangerBtn =
        !m.is_owner &&
        (m.bloqueado
          ? '<button type="button" class="btn btn-primary btn-block" id="bp-membro-block">Repor acesso</button>'
          : '<button type="button" class="btn btn-danger bp-acessos-danger btn-block" id="bp-membro-block">' +
            iconWarn() +
            ' Suspender acesso</button>');
      body.innerHTML =
        '<div class="bp-acessos-panel">' +
        '<p class="bp-acessos-person"><strong>' +
        esc(m.nome || '—') +
        '</strong></p>' +
        '<p class="bp-acessos-meta">' +
        esc(m.email || '') +
        '<br/>' +
        esc(roleLabel(m.role)) +
        ' · ' +
        esc(st) +
        (m.is_owner ? ' · Proprietário' : '') +
        '</p>' +
        (m.is_owner
          ? '<p class="bp-acessos-meta">A conta do proprietário não pode ser suspensa neste ecrã.</p>'
          : dangerBtn) +
        '</div>';
      var b = document.getElementById('bp-membro-block');
      if (b) {
        b.onclick = async function () {
          if (m.bloqueado) {
            if (!(await bpReauthPassword())) return;
            try {
              var urlR =
                (typeof SET_BLOQUEIO_EDGE_URL !== 'undefined' && SET_BLOQUEIO_EDGE_URL) ||
                SUPABASE_URL + '/functions/v1/set-membro-bloqueio';
              await edgePost(urlR, { target_user_id: uid, bloqueado: false });
              entendi('O acesso foi reposto. O membro pode voltar a iniciar sessão.', 'Acesso reposto');
              openMembros(false);
            } catch (e) {
              explainEdgeError(e);
            }
            return;
          }
          var okConfirm = true;
          if (typeof showConfirmModal === 'function') {
            okConfirm = await showConfirmModal(
              'Suspender acesso',
              'Esta pessoa deixa de poder entrar na organização até o acesso ser reposto. Os dados não são eliminados.',
              true,
              { confirmLabel: 'Suspender', cancelLabel: 'Cancelar', inkButtons: true }
            );
            styleNeutralConfirmCtas({ okLabel: 'Suspender', cancelLabel: 'Cancelar' });
            /* danger still red text optional — keep ink neutral per request for confirm */
          }
          if (!okConfirm) return;
          if (!(await bpReauthPassword())) return;
          try {
            var url =
              (typeof SET_BLOQUEIO_EDGE_URL !== 'undefined' && SET_BLOQUEIO_EDGE_URL) ||
              SUPABASE_URL + '/functions/v1/set-membro-bloqueio';
            await edgePost(url, { target_user_id: uid, bloqueado: true });
            entendi('O acesso deste membro foi suspenso. Os dados mantêm-se; só a entrada fica bloqueada até repor.', 'Acesso suspenso');
            openMembros(false);
          } catch (e) {
            explainEdgeError(e);
          }
        };
      }
    } catch (e) {
      body.innerHTML = '<p class="bp-acessos-status">Não foi possível abrir o membro.</p>';
    }
  }

  function openNiveis(fromStack) {
    if (!fromStack) pushView('niveis');
    setHead('Níveis de acesso', 'Acessos');
    var body = mountEl();
    if (typeof bpAccessDefaults !== 'function' || typeof BP_ACCESS_TABS === 'undefined') {
      body.innerHTML =
        '<div class="bp-acessos-panel"><p class="bp-acessos-meta">Definição de níveis indisponível neste momento.</p></div>';
      return;
    }
    var defaults = bpAccessDefaults();
    var over = typeof bpLoadAccessOverrides === 'function' ? bpLoadAccessOverrides() : {};
    var html =
      '<div class="bp-acessos-panel">' +
      '<p class="bp-acessos-meta">Defina o que gerente e operador podem abrir. O responsável mantém sempre o controlo total.</p>' +
      '<div class="bp-acessos-levels">';
    ['gerente', 'operador'].forEach(function (role) {
      var label = role === 'gerente' ? 'Gerente' : 'Operador';
      html +=
        '<section class="bp-acessos-level"><h2 class="bp-acessos-level-title">' +
        label +
        '</h2><ul class="bp-acessos-checks">';
      BP_ACCESS_TABS.forEach(function (tab) {
        var checked = defaults[role][tab.id];
        if (over[role] && typeof over[role][tab.id] === 'boolean') checked = over[role][tab.id];
        html +=
          '<li><label class="bp-acessos-check"><input type="checkbox" data-role="' +
          role +
          '" data-tab="' +
          tab.id +
          '"' +
          (checked ? ' checked' : '') +
          '/><span>' +
          esc(tab.label) +
          '</span></label></li>';
      });
      html += '</ul></section>';
    });
    html +=
      '</div><button type="button" class="btn btn-primary btn-block" id="bp-niveis-save">Guardar níveis</button></div>';
    body.innerHTML = html;
    document.getElementById('bp-niveis-save').onclick = async function () {
      if (!(await bpReauthPassword())) return;
      var overrides = typeof bpLoadAccessOverrides === 'function' ? bpLoadAccessOverrides() : {};
      ['gerente', 'operador'].forEach(function (role) {
        overrides[role] = overrides[role] || {};
        BP_ACCESS_TABS.forEach(function (tab) {
          var inp = body.querySelector('input[data-role="' + role + '"][data-tab="' + tab.id + '"]');
          if (inp) overrides[role][tab.id] = !!inp.checked;
        });
      });
      if (typeof bpSaveAccessOverrides === 'function') bpSaveAccessOverrides(overrides);
      if (typeof aplicarPermissoes === 'function') aplicarPermissoes();
      entendi('Os níveis de acesso de gerente e operador foram actualizados neste dispositivo.', 'Níveis actualizados');
    };
  }

  function wireBack() {
    var btn = document.getElementById('bp-acessos-back');
    if (!btn || btn.dataset.bpBound) return;
    btn.dataset.bpBound = '1';
    btn.addEventListener('click', function () {
      popView();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireBack);
  } else {
    wireBack();
  }

  g.bpOpenAcessosHub = openHub;
  g.bpReauthPassword = bpReauthPassword;
  g.bpLeaveAcessosTab = leaveAcessosTab;
  g.bpAcessosEntendi = entendi;
  g.BP_ACESSOS_SO_RESPONSAVEL = SO_RESPONSAVEL;
})(typeof window !== 'undefined' ? window : this);
