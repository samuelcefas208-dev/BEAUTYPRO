/**
 * BeautyPro F6 — Configurações → Acessos
 * Lista → detalhe (jornada tipo stack / Central)
 */
(function (g) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function authHeaders() {
    var session = null;
    try {
      var r = await supabaseClient.auth.getSession();
      session = r && r.data && r.data.session;
    } catch (_) {}
    if (!session || !session.access_token) throw new Error('Sessão expirada. Inicie sessão novamente.');
    return {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + session.access_token,
      apikey: typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : ''
    };
  }

  async function edgePost(url, body) {
    var headers = await authHeaders();
    var resp = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body || {}) });
    var data = null;
    try {
      data = await resp.json();
    } catch (_) {
      data = {};
    }
    if (!resp.ok) throw new Error((data && data.error) || 'Pedido recusado (' + resp.status + ')');
    return data;
  }

  /** Step-up: confirmar senha do responsável antes de acção sensível */
  function bpReauthPassword() {
    return new Promise(function (resolve) {
      var email = '';
      try {
        supabaseClient.auth.getUser().then(function (r) {
          email = (r && r.data && r.data.user && r.data.user.email) || '';
          showPrompt();
        }).catch(function () {
          showPrompt();
        });
      } catch (_) {
        showPrompt();
      }
      function showPrompt() {
        var ov = document.getElementById('bp-reauth-overlay');
        if (ov) ov.remove();
        ov = document.createElement('div');
        ov.id = 'bp-reauth-overlay';
        ov.className = 'modal-overlay open';
        ov.style.display = 'flex';
        ov.innerHTML =
          '<div class="modal-content bp-reauth-modal" role="dialog" aria-labelledby="bp-reauth-title">' +
          '<div class="modal-header"><h2 id="bp-reauth-title" class="modal-title">Confirmar identidade</h2>' +
          '<button type="button" class="modal-close" data-reauth-x aria-label="Fechar">&times;</button></div>' +
          '<p class="bp-reauth-lead">Para a segurança do espaço, confirme a sua palavra-passe.</p>' +
          '<div class="input-group"><label class="input-label">Palavra-passe</label>' +
          '<input type="password" id="bp-reauth-pass" class="input-field" autocomplete="current-password" /></div>' +
          '<p class="login-error" id="bp-reauth-err" hidden></p>' +
          '<div class="modal-footer" style="display:flex;gap:0.5rem;justify-content:flex-end;padding:0.75rem 0 0">' +
          '<button type="button" class="btn btn-secondary" data-reauth-cancel>Cancelar</button>' +
          '<button type="button" class="btn btn-primary" data-reauth-ok>Confirmar</button></div></div>';
        document.body.appendChild(ov);
        function close(ok) {
          try {
            ov.remove();
          } catch (_) {}
          resolve(!!ok);
        }
        ov.querySelector('[data-reauth-x]').onclick = function () {
          close(false);
        };
        ov.querySelector('[data-reauth-cancel]').onclick = function () {
          close(false);
        };
        ov.querySelector('[data-reauth-ok]').onclick = async function () {
          var pass = (document.getElementById('bp-reauth-pass') && document.getElementById('bp-reauth-pass').value) || '';
          var err = document.getElementById('bp-reauth-err');
          if (!pass) {
            if (err) {
              err.textContent = 'Indique a palavra-passe.';
              err.hidden = false;
            }
            return;
          }
          try {
            var u = await supabaseClient.auth.getUser();
            var em = (u && u.data && u.data.user && u.data.user.email) || email;
            if (!em) throw new Error('Email da sessão indisponível.');
            var res = await supabaseClient.auth.signInWithPassword({ email: em, password: pass });
            if (res.error) throw res.error;
            close(true);
          } catch (e) {
            if (err) {
              err.textContent = 'Palavra-passe incorrecta.';
              err.hidden = false;
            }
          }
        };
        try {
          document.getElementById('bp-reauth-pass').focus();
        } catch (_) {}
      }
    });
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
    if (!sid) return state.config.storeName || 'Organização';
    try {
      var { data } = await supabaseClient.from('saloes').select('nome').eq('id', sid).maybeSingle();
      if (data && data.nome) return data.nome;
    } catch (_) {}
    return state.config.storeName || 'Organização';
  }

  function roleLabel(r) {
    if (r === 'admin') return 'Administrador';
    if (r === 'gerente') return 'Gerente';
    if (r === 'operador') return 'Operador';
    return r || '—';
  }

  function openHub() {
    if (typeof bpPode === 'function' && !bpPode(['admin'])) {
      if (typeof toast === 'function') {
        toast('Apenas o responsável da organização gere os acessos.', 'warning');
      }
      return;
    }
    var id = 'bp-acessos-hub';
    var el =
      typeof ensureBpSheetModal === 'function'
        ? ensureBpSheetModal(id, 'Acessos', 'Configurações', 'Governação do espaço e da equipa')
        : null;
    if (!el) {
      if (typeof toast === 'function') toast('Interface de operações indisponível.', 'error');
      return;
    }
    var body = el.querySelector('.bp-sheet-body') || el.querySelector('.modal-body');
    if (!body) {
      body = document.createElement('div');
      body.className = 'bp-sheet-body';
      el.appendChild(body);
    }
    body.innerHTML =
      '<div class="bp-acc-list">' +
      '<button type="button" class="bp-acc-row" data-acc-go="org"><span>Organização</span><span class="bp-acc-chev">›</span></button>' +
      '<button type="button" class="bp-acc-row" data-acc-go="conta"><span>A sua conta</span><span class="bp-acc-chev">›</span></button>' +
      '<button type="button" class="bp-acc-row" data-acc-go="membros"><span>Membros</span><span class="bp-acc-chev">›</span></button>' +
      '<button type="button" class="bp-acc-row" data-acc-go="niveis"><span>Níveis e portas</span><span class="bp-acc-chev">›</span></button>' +
      '</div>';
    body.querySelectorAll('[data-acc-go]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var go = btn.getAttribute('data-acc-go');
        if (go === 'org') openOrg();
        else if (go === 'conta') openConta();
        else if (go === 'membros') openMembros();
        else if (go === 'niveis') openNiveis();
      });
    });
    if (typeof openBpSheetModal === 'function') openBpSheetModal(id);
    else if (typeof openModal === 'function') openModal(id);
  }

  async function openOrg() {
    var id = 'bp-acessos-org';
    var el = ensureBpSheetModal(id, 'Organização', 'Acessos', '');
    var body = el.querySelector('.bp-sheet-body') || el.querySelector('.modal-body');
    body.innerHTML = '<p class="bp-acc-muted">A carregar…</p>';
    openBpSheetModal(id);
    try {
      var nome = await loadSalaoNome();
      body.innerHTML =
        '<div class="input-group"><label class="input-label">Nome da organização</label>' +
        '<input type="text" class="input-field" id="bp-org-nome" value="' +
        esc(nome) +
        '" /></div>' +
        '<button type="button" class="btn btn-primary btn-block" id="bp-org-save">Guardar nome</button>';
      document.getElementById('bp-org-save').onclick = async function () {
        var n = (document.getElementById('bp-org-nome').value || '').trim();
        if (!n) {
          toast('Indique o nome da organização.', 'warning');
          return;
        }
        var ok = await bpReauthPassword();
        if (!ok) return;
        try {
          var { error } = await supabaseClient
            .from('saloes')
            .update({ nome: n })
            .eq('id', state.config.salaoId);
          if (error) throw error;
          state.config.storeName = n;
          toast('Nome da organização actualizado.', 'success');
        } catch (e) {
          toast((e && e.message) || 'Não foi possível guardar.', 'error');
        }
      };
    } catch (e) {
      body.innerHTML = '<p class="bp-acc-muted">Não foi possível carregar.</p>';
    }
  }

  async function openConta() {
    var id = 'bp-acessos-conta';
    var el = ensureBpSheetModal(id, 'A sua conta', 'Acessos', '');
    var body = el.querySelector('.bp-sheet-body') || el.querySelector('.modal-body');
    body.innerHTML = '<p class="bp-acc-muted">A carregar…</p>';
    openBpSheetModal(id);
    try {
      var u = await supabaseClient.auth.getUser();
      var user = u && u.data && u.data.user;
      var { data: prof } = await supabaseClient
        .from('profiles')
        .select('nome, email, role')
        .eq('user_id', user.id)
        .maybeSingle();
      body.innerHTML =
        '<div class="input-group"><label class="input-label">Nome</label>' +
        '<input type="text" class="input-field" id="bp-conta-nome" value="' +
        esc((prof && prof.nome) || '') +
        '" /></div>' +
        '<div class="input-group"><label class="input-label">Email</label>' +
        '<input type="text" class="input-field" value="' +
        esc((user && user.email) || '') +
        '" disabled /></div>' +
        '<p class="bp-acc-muted">Papel: ' +
        esc(roleLabel(prof && prof.role)) +
        '</p>' +
        '<button type="button" class="btn btn-primary btn-block" id="bp-conta-save">Guardar nome</button>';
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
          toast((e && e.message) || 'Não foi possível guardar.', 'error');
        }
      };
    } catch (e) {
      body.innerHTML = '<p class="bp-acc-muted">Não foi possível carregar a conta.</p>';
    }
  }

  async function openMembros() {
    var id = 'bp-acessos-membros';
    var el = ensureBpSheetModal(id, 'Membros', 'Acessos', 'Equipas deste espaço');
    var body = el.querySelector('.bp-sheet-body') || el.querySelector('.modal-body');
    body.innerHTML = '<p class="bp-acc-muted">A carregar…</p>';
    openBpSheetModal(id);
    try {
      var list = await loadMembros();
      var html =
        '<button type="button" class="btn btn-primary btn-block mb-2" id="bp-membro-add">Convidar membro</button>';
      html += '<div class="bp-acc-list">';
      list.forEach(function (m) {
        var st = m.bloqueado ? 'Bloqueado' : m.ativo === false ? 'Inactivo' : 'Activo';
        html +=
          '<button type="button" class="bp-acc-row" data-uid="' +
          esc(m.user_id) +
          '">' +
          '<span class="bp-acc-row-main"><strong>' +
          esc(m.nome || m.email || 'Membro') +
          '</strong><small>' +
          esc(roleLabel(m.role)) +
          ' · ' +
          esc(st) +
          '</small></span><span class="bp-acc-chev">›</span></button>';
      });
      html += '</div>';
      body.innerHTML = html;
      document.getElementById('bp-membro-add').onclick = function () {
        openConvidar();
      };
      body.querySelectorAll('[data-uid]').forEach(function (btn) {
        btn.onclick = function () {
          openMembroDetalhe(btn.getAttribute('data-uid'));
        };
      });
    } catch (e) {
      body.innerHTML = '<p class="bp-acc-muted">' + esc((e && e.message) || 'Erro ao listar') + '</p>';
    }
  }

  function openConvidar() {
    var id = 'bp-acessos-convidar';
    var el = ensureBpSheetModal(id, 'Convidar membro', 'Membros', '');
    var body = el.querySelector('.bp-sheet-body') || el.querySelector('.modal-body');
    body.innerHTML =
      '<div class="input-group"><label class="input-label">Nome</label>' +
      '<input type="text" class="input-field" id="bp-inv-nome" /></div>' +
      '<div class="input-group"><label class="input-label">Email</label>' +
      '<input type="email" class="input-field" id="bp-inv-email" autocomplete="off" /></div>' +
      '<div class="input-group"><label class="input-label">Nível</label>' +
      '<select class="input-field" id="bp-inv-role">' +
      '<option value="operador">Operador</option>' +
      '<option value="gerente">Gerente</option></select></div>' +
      '<div class="input-group"><label class="input-label">Palavra-passe inicial <span class="login-optional">(opcional)</span></label>' +
      '<input type="password" class="input-field" id="bp-inv-pass" autocomplete="new-password" placeholder="Mín. 8 caracteres" /></div>' +
      '<p class="bp-acc-muted">Se não indicar senha, o sistema gera uma temporária.</p>' +
      '<button type="button" class="btn btn-primary btn-block" id="bp-inv-go">Criar acesso</button>';
    openBpSheetModal(id);
    document.getElementById('bp-inv-go').onclick = async function () {
      var nome = (document.getElementById('bp-inv-nome').value || '').trim();
      var email = (document.getElementById('bp-inv-email').value || '').trim();
      var role = document.getElementById('bp-inv-role').value;
      var pass = (document.getElementById('bp-inv-pass').value || '').trim();
      var ok = await bpReauthPassword();
      if (!ok) return;
      try {
        var url =
          (typeof INVITE_MEMBRO_EDGE_URL !== 'undefined' && INVITE_MEMBRO_EDGE_URL) ||
          SUPABASE_URL + '/functions/v1/invite-membro';
        var res = await edgePost(url, { nome: nome, email: email, role: role, password: pass || undefined });
        var msg = (res && res.note) || 'Membro criado.';
        if (res && res.audit_ok === false) {
          msg += ' (Aviso: auditoria não registada.)';
        }
        toast(msg, 'success');
        openMembros();
      } catch (e) {
        toast((e && e.message) || 'Falha ao convidar.', 'error');
      }
    };
  }

  async function openMembroDetalhe(uid) {
    var id = 'bp-acessos-membro';
    var el = ensureBpSheetModal(id, 'Membro', 'Membros', '');
    var body = el.querySelector('.bp-sheet-body') || el.querySelector('.modal-body');
    body.innerHTML = '<p class="bp-acc-muted">A carregar…</p>';
    openBpSheetModal(id);
    try {
      var list = await loadMembros();
      var m = list.filter(function (x) {
        return x.user_id === uid;
      })[0];
      if (!m) {
        body.innerHTML = '<p class="bp-acc-muted">Membro não encontrado.</p>';
        return;
      }
      var st = m.bloqueado ? 'Bloqueado' : 'Activo';
      body.innerHTML =
        '<p><strong>' +
        esc(m.nome || '—') +
        '</strong></p>' +
        '<p class="bp-acc-muted">' +
        esc(m.email || '') +
        '<br/>' +
        esc(roleLabel(m.role)) +
        ' · ' +
        esc(st) +
        (m.is_owner ? ' · Proprietário' : '') +
        '</p>' +
        (m.is_owner
          ? '<p class="bp-acc-muted">O proprietário não pode ser bloqueado neste ecrã.</p>'
          : '<button type="button" class="btn btn-block ' +
            (m.bloqueado ? 'btn-primary' : 'btn-secondary') +
            '" id="bp-membro-block">' +
            (m.bloqueado ? 'Repor acesso' : 'Suspender acesso') +
            '</button>');
      var b = document.getElementById('bp-membro-block');
      if (b) {
        b.onclick = async function () {
          var ok = await bpReauthPassword();
          if (!ok) return;
          try {
            var url =
              (typeof SET_BLOQUEIO_EDGE_URL !== 'undefined' && SET_BLOQUEIO_EDGE_URL) ||
              SUPABASE_URL + '/functions/v1/set-membro-bloqueio';
            await edgePost(url, { target_user_id: uid, bloqueado: !m.bloqueado });
            toast(m.bloqueado ? 'Acesso reposto.' : 'Acesso suspenso.', 'success');
            openMembros();
          } catch (e) {
            toast((e && e.message) || 'Falha ao actualizar.', 'error');
          }
        };
      }
    } catch (e) {
      body.innerHTML = '<p class="bp-acc-muted">Erro.</p>';
    }
  }

  function openNiveis() {
    if (typeof bpOpenAcessosModal === 'function') {
      bpOpenAcessosModal();
      return;
    }
    toast('Matriz de níveis indisponível.', 'warning');
  }

  g.bpOpenAcessosHub = openHub;
  g.bpReauthPassword = bpReauthPassword;
})(typeof window !== 'undefined' ? window : this);
