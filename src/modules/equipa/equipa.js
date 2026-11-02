/* BelezaPro B6 — feature fora do monólito; carregar após app.bundle.js */

// ================================================================
// Grupo 3 — Gestão de Equipa (robusto, realista, offline-first)
// F6 Ranking | F14 Horários/folgas | F25 Chat interno
// ================================================================
(function () {
  'use strict';

  var CHAT_KEY = 'bp_chat_msgs_v2';
  var HORARIOS_KEY = 'bp_horarios_equipa_v2';
  var RANK_PERIODO_KEY = 'bp_rank_periodo';
  var DIAS_ORD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  var DIAS_LABEL = { dom: 'Dom', seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb' };
  var DIAS_JS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

  function fmt(v) {
    return typeof fmtKz === 'function' ? fmtKz(v) : (Math.round(Number(v) || 0) + ' Kz');
  }
  function esc(s) {
    return typeof escHtml === 'function' ? escHtml(String(s == null ? '' : s)) : String(s == null ? '' : s);
  }
  function hojeStr() {
    return typeof hoje === 'function' ? hoje() : new Date().toISOString().slice(0, 10);
  }
  function parseHoraMin(hhmm) {
    var p = String(hhmm || '00:00').split(':');
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }
  function safeJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function writeJson(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) {
      if (typeof toast === 'function') toast('Armazenamento local cheio ou bloqueado', 'error');
      return false;
    }
  }

  function inicioSemanaISO() {
    var d = new Date(hojeStr() + 'T12:00:00');
    var day = d.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  }
  function fimSemanaISO() {
    var d = new Date(inicioSemanaISO() + 'T12:00:00');
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  }
  function inPeriodo(dataStr, periodo) {
    if (!dataStr) return false;
    if (periodo === 'semana') {
      return dataStr >= inicioSemanaISO() && dataStr <= fimSemanaISO();
    }
    return String(dataStr).startsWith(hojeStr().slice(0, 7));
  }

  function calcRanking(periodo) {
    periodo = periodo || localStorage.getItem(RANK_PERIODO_KEY) || 'mes';
    var map = {};
    (state.profissionais || []).forEach(function (p) {
      map[p.id] = {
        id: p.id, nome: p.nome || '—', receita: 0, comissao: 0, vendas: 0,
        ticket: 0, meta: Number(p.meta_mensal) || 0, metaOk: false, pontos: 0, diasActivos: {}
      };
    });
    (state.movimentos || []).forEach(function (m) {
      if (m.tipo !== 'venda' || !m.profissional_id) return;
      if (!inPeriodo(m.data, periodo)) return;
      if (!map[m.profissional_id]) {
        map[m.profissional_id] = {
          id: m.profissional_id, nome: m.profissional || '—', receita: 0, comissao: 0,
          vendas: 0, ticket: 0, meta: 0, metaOk: false, pontos: 0, diasActivos: {}
        };
      }
      var r = map[m.profissional_id];
      r.receita += Number(m.valor) || 0;
      r.comissao += Number(m.comissao_gerada) || 0;
      r.vendas += 1;
      if (m.data) r.diasActivos[m.data] = true;
    });
    var totalReceita = 0;
    Object.keys(map).forEach(function (k) {
      var r = map[k];
      totalReceita += r.receita;
      r.ticket = r.vendas > 0 ? Math.round(r.receita / r.vendas) : 0;
      r.dias = Object.keys(r.diasActivos).length;
      r.pontos = (r.vendas * 10) + Math.floor(r.receita / 1000);
      if (periodo === 'mes' && r.meta > 0 && r.receita >= r.meta) {
        r.metaOk = true;
        r.pontos += 50;
      }
    });
    var list = Object.keys(map).map(function (k) {
      var r = map[k];
      r.share = totalReceita > 0 ? Math.round((r.receita / totalReceita) * 100) : 0;
      return r;
    });
    list.sort(function (a, b) {
      if (b.pontos !== a.pontos) return b.pontos - a.pontos;
      if (b.receita !== a.receita) return b.receita - a.receita;
      return (a.nome || '').localeCompare(b.nome || '');
    });
    return { list: list, totalReceita: totalReceita, periodo: periodo };
  }

  function defaultHorario() {
    return {
      entrada: '09:00', saida: '18:00', dias: ['seg', 'ter', 'qua', 'qui', 'sex'],
      folgas: [], intervaloInicio: '13:00', intervaloFim: '14:00', activo: true
    };
  }
  function loadHorarios() {
    var v = safeJson(HORARIOS_KEY, {});
    return v && typeof v === 'object' ? v : {};
  }
  function getHorarioProf(id) {
    return Object.assign(defaultHorario(), loadHorarios()[id] || {});
  }
  function setHorarioProf(id, partial) {
    var all = loadHorarios();
    var next = Object.assign(defaultHorario(), all[id] || {}, partial);
    if (parseHoraMin(next.entrada) >= parseHoraMin(next.saida)) {
      if (typeof toast === 'function') toast('A entrada deve ser antes da saída', 'error');
      return null;
    }
    if (!Array.isArray(next.dias)) next.dias = [];
    if (!Array.isArray(next.folgas)) next.folgas = [];
    var limite = new Date();
    limite.setDate(limite.getDate() - 90);
    var limStr = limite.toISOString().slice(0, 10);
    next.folgas = next.folgas.filter(function (d) { return d >= limStr; }).sort();
    all[id] = next;
    if (!writeJson(HORARIOS_KEY, all)) return null;
    return next;
  }
  function diaSemanaDeData(dataStr) {
    try {
      return DIAS_JS[new Date(dataStr + 'T12:00:00').getDay()];
    } catch (e) { return null; }
  }
  function estadoHojeProf(id) {
    var h = getHorarioProf(id);
    if (h.activo === false) return { code: 'inactivo', label: 'Inactivo' };
    var hs = hojeStr();
    if ((h.folgas || []).indexOf(hs) >= 0) return { code: 'folga', label: 'Folga' };
    var dia = diaSemanaDeData(hs);
    if ((h.dias || []).indexOf(dia) < 0) return { code: 'dia_folga_semana', label: 'Folga semanal' };
    var now = new Date();
    var mins = now.getHours() * 60 + now.getMinutes();
    var en = parseHoraMin(h.entrada), sa = parseHoraMin(h.saida);
    var i0 = parseHoraMin(h.intervaloInicio), i1 = parseHoraMin(h.intervaloFim);
    if (mins < en || mins >= sa) return { code: 'fora_horario', label: 'Fora de horário' };
    if (i1 > i0 && mins >= i0 && mins < i1) return { code: 'intervalo', label: 'Intervalo' };
    return { code: 'em_turno', label: 'Em turno' };
  }
  function conflitosAgenda(profId, dataStr) {
    var h = getHorarioProf(profId);
    var data = dataStr || hojeStr();
    var out = [];
    (state.agendamentos || []).forEach(function (a) {
      if (a.profissional_id !== profId || a.data !== data) return;
      var st = String(a.status || a.estado || '').toLowerCase();
      if (st === 'cancelado' || st.indexOf('conclu') === 0) return;
      var reasons = [];
      if ((h.folgas || []).indexOf(data) >= 0) reasons.push('dia de folga');
      var dia = diaSemanaDeData(data);
      if ((h.dias || []).indexOf(dia) < 0) reasons.push('não trabalha neste dia');
      var hm = parseHoraMin(a.hora);
      if (hm < parseHoraMin(h.entrada) || hm >= parseHoraMin(h.saida)) reasons.push('fora do turno');
      if (reasons.length) out.push({ ag: a, reasons: reasons });
    });
    return out;
  }

  function loadChat() {
    var list = safeJson(CHAT_KEY, []);
    return Array.isArray(list) ? list : [];
  }
  function saveChat(list) {
    return writeJson(CHAT_KEY, (list || []).slice(-300));
  }
  function autorActual() {
    var role = (state && state.config && state.config.userRole) || 'admin';
    var store = (state && state.config && state.config.storeName) || 'Salão';
    var label = (role === 'admin' || role === 'gerente') ? ('Gestão · ' + store) : ('Colaborador · ' + store);
    return { nome: label, role: role };
  }
  function enviarMensagem(texto) {
    var t = String(texto || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length < 2) {
      if (typeof toast === 'function') toast('Escreva uma mensagem válida', 'error');
      return null;
    }
    var autor = autorActual();
    var msg = {
      id: (typeof uuid === 'function' ? uuid() : ('m' + Date.now())),
      texto: t.slice(0, 500),
      autor: autor.nome,
      role: autor.role,
      ts: new Date().toISOString()
    };
    var list = loadChat();
    var last = list[list.length - 1];
    if (last && last.texto === msg.texto && last.autor === msg.autor) {
      if (Math.abs(new Date(msg.ts) - new Date(last.ts)) < 5000) {
        if (typeof toast === 'function') toast('Mensagem já enviada', 'warning');
        return last;
      }
    }
    list.push(msg);
    if (!saveChat(list)) return null;
    return msg;
  }
  function formatMsgTime(ts) {
    try {
      var d = new Date(ts);
      var dia = d.toISOString().slice(0, 10);
      var hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      return dia === hojeStr() ? hm : (dia.slice(8, 10) + '/' + dia.slice(5, 7) + ' ' + hm);
    } catch (e) { return ''; }
  }
  function groupChatByDay(list) {
    var groups = [], cur = null;
    list.forEach(function (m) {
      var day = String(m.ts || '').slice(0, 10) || '—';
      if (!cur || cur.day !== day) { cur = { day: day, items: [] }; groups.push(cur); }
      cur.items.push(m);
    });
    return groups;
  }

  function ensureShell(id, title, eyebrow, subtitle) {
    if (typeof ensureBpSheetModal === 'function') {
      return ensureBpSheetModal(id, title, eyebrow, subtitle);
    }
    var el = document.getElementById(id);
    if (el) {
      var tEl = el.querySelector('.bp-sheet-title');
      if (tEl && title) tEl.textContent = title;
      return el;
    }
    el = document.createElement('div');
    el.id = id;
    el.className = 'modal-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', id + '-title');
    var eye = eyebrow || 'BeautyPro';
    var sub = subtitle || '';
    el.innerHTML =
      '<div class="bp-sheet modal-sheet">' +
        '<div class="bp-sheet-handle handle" aria-hidden="true"></div>' +
        '<div class="bp-sheet-header">' +
          '<div class="bp-sheet-eyebrow">' + eye + '</div>' +
          '<h2 class="bp-sheet-title modal-title" id="' + id + '-title">' + title + '</h2>' +
          (sub ? '<p class="bp-sheet-subtitle">' + sub + '</p>' : '') +
        '</div>' +
        '<div class="bp-sheet-body" id="' + id + '-body"></div>' +
        '<div class="bp-sheet-footer modal-actions">' +
          '<button type="button" class="btn btn-secondary" data-close="' + id + '">Fechar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (e) {
      if (e.target === el || e.target.getAttribute('data-close') === id) {
        if (typeof closeModal === 'function') closeModal(id);
        else el.classList.remove('open');
      }
    });
    return el;
  }
  function openShell(id) {
    if (typeof openModal === 'function') openModal(id);
    else { var el = document.getElementById(id); if (el) el.classList.add('open'); }
  }

  function openRanking() {
    ensureShell('modal-bp-rank', 'Ranking da equipa', 'Desempenho', 'Pontuação com base em vendas reais, receita e metas.');
    renderRankingBody();
    openShell('modal-bp-rank');
  }
  function renderRankingBody() {
    var body = document.getElementById('modal-bp-rank-body');
    if (!body) return;
    var periodo = localStorage.getItem(RANK_PERIODO_KEY) || 'mes';
    var data = calcRanking(periodo);
    var rank = data.list;
    var activos = (state.profissionais || []).filter(function (p) {
      return typeof isProfissionalAtivo === 'function' ? isProfissionalAtivo(p) : (p.ativo !== false);
    });
    var toggle =
      '<div class="bp-seg" role="tablist" aria-label="Período do ranking">' +
        '<button type="button" class="bp-seg-btn' + (periodo === 'semana' ? ' is-active' : '') + '" data-rank-p="semana" role="tab">Esta semana</button>' +
        '<button type="button" class="bp-seg-btn' + (periodo === 'mes' ? ' is-active' : '') + '" data-rank-p="mes" role="tab">Este mês</button></div>';
    if (!activos.length) {
      body.innerHTML = toggle + '<div class="bp-empty"><strong>Sem profissionais activos</strong>Adicione a equipa na aba Equipa.</div>';
      bindRankToggle(body); return;
    }
    if (!rank.some(function (r) { return r.vendas > 0; })) {
      body.innerHTML = toggle + '<div class="bp-empty"><strong>Sem vendas no período</strong>O ranking actualiza com vendas atribuídas a profissionais.</div>';
      bindRankToggle(body); return;
    }
    var top = rank[0];
    var kpis =
      '<div class="bp-kpi-grid">' +
        '<div class="bp-kpi"><div class="bp-kpi-label">Líder</div><div class="bp-kpi-value is-gold" style="font-size:.8rem;line-height:1.25">' + esc(top.nome) + '</div></div>' +
        '<div class="bp-kpi"><div class="bp-kpi-label">Pontos</div><div class="bp-kpi-value">' + top.pontos + '</div></div>' +
        '<div class="bp-kpi"><div class="bp-kpi-label">Receita equipa</div><div class="bp-kpi-value" style="font-size:.75rem">' + fmt(data.totalReceita) + '</div></div></div>';
    var rows = rank.map(function (r, i) {
      var rankClass = i === 0 ? ' is-rank-1' : (i === 1 ? ' is-rank-2' : (i === 2 ? ' is-rank-3' : ''));
      var badge = '<span class="bp-badge' + rankClass + '">' + (i + 1) + '.º</span> ';
      var metaBadge = r.metaOk ? ' <span class="bp-badge is-green">Meta</span>' : '';
      var pctMeta = (r.meta > 0) ? Math.min(100, Math.round((r.receita / r.meta) * 100)) : 0;
      var bar = r.meta > 0 ? '<div class="bp-meta-bar" title="Progresso da meta"><i style="width:' + pctMeta + '%"></i></div>' : '';
      return '<div class="bp-row"><div class="bp-row-main"><div class="bp-row-title">' + badge + esc(r.nome) + metaBadge + '</div>' +
        '<div class="bp-row-meta">' + r.vendas + ' vendas · ticket ' + fmt(r.ticket) + ' · ' + (r.share || 0) + '% receita</div>' +
        bar +
        '</div><div class="bp-row-value is-gold">' + r.pontos + '<span style="display:block;font-size:.6rem;font-weight:500;color:var(--text-muted)">pts</span></div></div>';
    }).join('');
    body.innerHTML = toggle + kpis +
      '<p class="bp-ref-line">10 pts/venda · 1 pt/1.000 Kz · +50 pts ao atingir a meta</p>' +
      '<div class="bp-section"><div class="bp-section-title">Classificação</div>' + rows + '</div>';
    bindRankToggle(body);
  }
  function bindRankToggle(body) {
    body.querySelectorAll('[data-rank-p]').forEach(function (btn) {
      btn.onclick = function () {
        localStorage.setItem(RANK_PERIODO_KEY, btn.getAttribute('data-rank-p'));
        renderRankingBody();
      };
    });
  }

  function openHorarios() {
    ensureShell('modal-bp-horarios', 'Horários e folgas', 'Equipa', 'Turnos, intervalos, folgas e conflitos com a agenda de hoje.');
    renderHorariosList();
    openShell('modal-bp-horarios');
  }
  function renderHorariosList() {
    var body = document.getElementById('modal-bp-horarios-body');
    if (!body) return;
    var profs = (state.profissionais || []).filter(function (p) {
      return typeof isProfissionalAtivo === 'function' ? isProfissionalAtivo(p) : (p.ativo !== false);
    });
    if (!profs.length) {
      body.innerHTML = '<div class="bp-empty"><strong>Sem profissionais activos</strong>Cadastre a equipa na aba Equipa.</div>';
      return;
    }

    var emTurno = 0, emFolga = 0, conflitosTotal = 0;
    var rows = profs.map(function (p) {
      var h = getHorarioProf(p.id);
      var st = estadoHojeProf(p.id);
      var conf = conflitosAgenda(p.id, hojeStr());
      conflitosTotal += conf.length;
      if (st.code === 'em_turno') emTurno++;
      if (st.code === 'folga' || st.code === 'dia_folga_semana') emFolga++;

      var badgeClass = '';
      if (st.code === 'em_turno') badgeClass = ' is-green';
      else if (st.code === 'folga' || st.code === 'dia_folga_semana') badgeClass = ' is-gold';
      else if (st.code === 'intervalo') badgeClass = '';
      else if (st.code === 'fora_horario' || st.code === 'inactivo') badgeClass = ' is-red';

      var dias = (h.dias || []).map(function (d) { return DIAS_LABEL[d] || d; }).join(', ') || 'Sem dias definidos';
      var alert = conf.length
        ? '<div class="bp-row-meta" style="color:var(--red);margin-top:4px">' + conf.length + ' marcação(ões) em conflito hoje</div>'
        : '';

      return '<div class="bp-row"><div class="bp-row-main"><div class="bp-row-title">' + esc(p.nome) +
        ' <span class="bp-badge' + badgeClass + '">' + esc(st.label) + '</span></div>' +
        '<div class="bp-row-meta">' + esc(h.entrada) + '–' + esc(h.saida) +
        (h.intervaloInicio ? ' · intervalo ' + esc(h.intervaloInicio) + '–' + esc(h.intervaloFim) : '') +
        '<br>' + esc(dias) + '</div>' + alert + '</div>' +
        '<button type="button" class="bp-action-btn" data-edit-horario="' + (typeof escHtml==='function'?escHtml(String(p.id)):String(p.id)) + '">Editar</button></div>';
    }).join('');

    var insight = '';
    if (conflitosTotal > 0) {
      insight = '<div class="bp-alert-banner is-warn"><strong>' + conflitosTotal +
        (conflitosTotal === 1 ? ' conflito com a agenda' : ' conflitos com a agenda') +
        '</strong>Há marcações fora do turno ou em dia de folga. Edite o horário ou reagende.</div>';
    } else {
      insight = '<div class="bp-alert-banner is-ok"><strong>Escala alinhada com a agenda</strong>Nenhum conflito detectado para hoje.</div>';
    }

    body.innerHTML =
      insight +
      '<div class="bp-kpi-grid">' +
        '<div class="bp-kpi"><div class="bp-kpi-label">Em turno</div><div class="bp-kpi-value is-positive">' + emTurno + '</div></div>' +
        '<div class="bp-kpi"><div class="bp-kpi-label">Folga</div><div class="bp-kpi-value">' + emFolga + '</div></div>' +
        '<div class="bp-kpi"><div class="bp-kpi-label">Conflitos</div><div class="bp-kpi-value' + (conflitosTotal ? ' is-negative' : '') + '">' + conflitosTotal + '</div></div>' +
      '</div>' +
      '<p class="bp-ref-line">Estado em tempo real · ' + esc(hojeStr()) + ' · só profissionais activos</p>' +
      '<div class="bp-section"><div class="bp-section-title">Equipa · hoje</div>' + rows + '</div>' +
      '<div id="bp-horario-editor" style="display:none;margin-top:8px"></div>';

    body.querySelectorAll('[data-edit-horario]').forEach(function (btn) {
      btn.onclick = function () { renderEditorHorario(btn.getAttribute('data-edit-horario')); };
    });
  }

  function renderEditorHorario(profId) {
    var box = document.getElementById('bp-horario-editor');
    if (!box) return;
    var p = (state.profissionais || []).find(function (x) { return x.id === profId; });
    if (!p) return;
    var h = getHorarioProf(profId);
    var diasChecks = DIAS_ORD.map(function (d) {
      var on = (h.dias || []).indexOf(d) >= 0;
      return '<label style="display:inline-flex;align-items:center;gap:4px;margin:0 10px 8px 0;font-size:.8rem;cursor:pointer">' +
        '<input type="checkbox" data-dia="' + (typeof escHtml==='function'?escHtml(String(d)):String(d)) + '"' + (on ? ' checked' : '') + '> ' + (typeof escHtml==='function'?escHtml(String(DIAS_LABEL[d] || d)):String(DIAS_LABEL[d] || d)) + '</label>';
    }).join('');
    var folgasHtml = (h.folgas || []).filter(function (d) { return d >= hojeStr(); }).slice(0, 8).map(function (d) {
      return '<span class="bp-badge" style="margin:0 6px 6px 0">' + esc(d) +
        ' <button type="button" data-rm-folga="' + esc(d) + '" style="border:0;background:none;cursor:pointer;color:inherit;font-weight:700">×</button></span>';
    }).join('') || '<span style="font-size:.8rem;color:var(--text-muted)">Nenhuma folga futura</span>';
    var conf = conflitosAgenda(profId, hojeStr());
    var confHtml = conf.length
      ? '<div style="margin:12px 0;padding:12px;border-radius:10px;background:var(--red-50,#FDE8E8);border:1px solid rgba(179,58,74,.25)">' +
        '<div style="font-size:.75rem;font-weight:600;color:var(--red);margin-bottom:6px">Conflitos com agenda de hoje</div>' +
        conf.map(function (c) {
          return '<div style="font-size:.8rem">' + esc(c.ag.hora) + (c.ag.cliente ? ' · ' + esc(c.ag.cliente) : '') +
            ' — ' + esc(c.reasons.join(', ')) + '</div>';
        }).join('') + '</div>'
      : '';
    box.style.display = 'block';
    box.innerHTML =
      '<div style="padding-top:16px;border-top:1px solid var(--border-soft)">' +
      '<div class="bp-section-title">Editar · ' + esc(p.nome) + '</div>' + confHtml +
      '<div class="bp-form-grid-2" style="margin-bottom:12px">' +
        '<div class="input-group"><label class="input-label" for="bp-h-entrada">Entrada</label><input type="time" id="bp-h-entrada" class="input-field" value="' + esc(h.entrada) + '"></div>' +
        '<div class="input-group"><label class="input-label" for="bp-h-saida">Saída</label><input type="time" id="bp-h-saida" class="input-field" value="' + esc(h.saida) + '"></div>' +
        '<div class="input-group"><label class="input-label" for="bp-h-i0">Início intervalo</label><input type="time" id="bp-h-i0" class="input-field" value="' + esc(h.intervaloInicio || '13:00') + '"></div>' +
        '<div class="input-group"><label class="input-label" for="bp-h-i1">Fim intervalo</label><input type="time" id="bp-h-i1" class="input-field" value="' + esc(h.intervaloFim || '14:00') + '"></div></div>' +
      '<div class="input-group"><label class="input-label">Dias de trabalho</label><div>' + diasChecks + '</div></div>' +
      '<div class="input-group"><label class="input-label">Folgas futuras</label><div style="margin-bottom:8px">' + folgasHtml + '</div>' +
      '<input type="date" id="bp-h-folga" class="input-field" min="' + hojeStr() + '"></div>' +
      '<label style="display:flex;align-items:center;gap:8px;font-size:.85rem;margin:12px 0">' +
        '<input type="checkbox" id="bp-h-activo"' + (h.activo !== false ? ' checked' : '') + '> Profissional activo na escala</label>' +
      '<button type="button" class="btn btn-primary btn-block" id="bp-h-save">Guardar horário</button></div>';
    box.querySelectorAll('[data-rm-folga]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.preventDefault();
        var d = btn.getAttribute('data-rm-folga');
        setHorarioProf(profId, { folgas: (h.folgas || []).filter(function (x) { return x !== d; }) });
        renderEditorHorario(profId);
      };
    });
    document.getElementById('bp-h-save').onclick = function () {
      var dias = [];
      box.querySelectorAll('[data-dia]:checked').forEach(function (c) { dias.push(c.getAttribute('data-dia')); });
      if (!dias.length) { if (typeof toast === 'function') toast('Seleccione pelo menos um dia', 'error'); return; }
      var folgas = (getHorarioProf(profId).folgas || []).slice();
      var nova = (document.getElementById('bp-h-folga') || {}).value;
      if (nova) {
        if (nova < hojeStr()) { if (typeof toast === 'function') toast('Folga deve ser hoje ou futura', 'error'); return; }
        if (folgas.indexOf(nova) < 0) folgas.push(nova);
      }
      var saved = setHorarioProf(profId, {
        entrada: (document.getElementById('bp-h-entrada') || {}).value || '09:00',
        saida: (document.getElementById('bp-h-saida') || {}).value || '18:00',
        intervaloInicio: (document.getElementById('bp-h-i0') || {}).value || '13:00',
        intervaloFim: (document.getElementById('bp-h-i1') || {}).value || '14:00',
        dias: dias, folgas: folgas,
        activo: !!(document.getElementById('bp-h-activo') || {}).checked
      });
      if (!saved) return;
      if (typeof toast === 'function') toast('Horário de ' + p.nome + ' actualizado', 'success');
      renderHorariosList();
    };
  }

  function openChat() {
    ensureShell('modal-bp-chat', 'Chat interno', 'Comunicação', 'Recados de turno neste dispositivo.');
    var footer = document.querySelector('#modal-bp-chat .bp-sheet-footer');
    if (footer) {
      footer.innerHTML =
        '<div style="display:flex;flex-direction:column;gap:6px;width:100%">' +
          '<div style="display:flex;gap:8px;width:100%;align-items:center">' +
            '<input type="text" id="bp-chat-input" class="input-field" placeholder="Mensagem para a equipa…" maxlength="500" autocomplete="off" style="flex:1;height:44px">' +
            '<button type="button" class="btn btn-primary" id="bp-chat-send" style="flex:0;padding:0 18px;height:44px">Enviar</button></div>' +
          '<div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--text-muted)">' +
            '<span id="bp-chat-count">0 / 500</span>' +
            '<button type="button" id="bp-chat-clear" style="border:0;background:none;color:var(--text-muted);font-size:.7rem;cursor:pointer;text-decoration:underline">Limpar histórico</button></div></div>';
    }
    renderChatBody();
    openShell('modal-bp-chat');
    var send = document.getElementById('bp-chat-send');
    var input = document.getElementById('bp-chat-input');
    var count = document.getElementById('bp-chat-count');
    var clear = document.getElementById('bp-chat-clear');
    function doSend() {
      if (!input) return;
      if (enviarMensagem(input.value)) {
        input.value = '';
        if (count) count.textContent = '0 / 500';
        renderChatBody();
      }
    }
    if (send) send.onclick = doSend;
    if (input) {
      input.oninput = function () { if (count) count.textContent = input.value.length + ' / 500'; };
      input.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); doSend(); } };
      setTimeout(function () { try { input.focus(); } catch (e) {} }, 200);
    }
    if (clear) {
      clear.onclick = async function () {
        var ok = true;
        if (typeof showConfirmModal === 'function') {
          ok = await showConfirmModal(
            'Limpar mensagens?',
            'Todas as mensagens deste chat neste dispositivo serão apagadas. Esta ação não remove dados do salão noutros sítios.',
            true,
            { confirmLabel: 'Limpar', cancelLabel: 'Cancelar', variant: 'destructive' }
          );
        }
        if (!ok) return;
        saveChat([]);
        renderChatBody();
        if (typeof toast === 'function') toast('Histórico limpo.', 'success');
      };
    }
  }
  function renderChatBody() {
    var body = document.getElementById('modal-bp-chat-body');
    if (!body) return;
    var list = loadChat();
    if (!list.length) {
      body.innerHTML = '<div class="bp-empty"><strong>Sem mensagens</strong>Use o campo abaixo para recados de turno, faltas ou avisos.</div>';
      return;
    }
    body.innerHTML = groupChatByDay(list).map(function (g) {
      var label = g.day === hojeStr() ? 'Hoje' : g.day;
      var items = g.items.map(function (m) {
        var isGestao = m.role === 'admin' || m.role === 'gerente';
        return '<div class="bp-row" style="flex-direction:column;align-items:stretch;gap:4px">' +
          '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center">' +
            '<div class="bp-row-title" style="font-size:.78rem">' + esc(m.autor) +
            (isGestao ? ' <span class="bp-badge">Gestão</span>' : '') + '</div>' +
            '<div class="bp-row-meta">' + esc(formatMsgTime(m.ts)) + '</div></div>' +
          '<div style="font-size:.9rem;color:var(--text-primary);line-height:1.5">' + esc(m.texto) + '</div></div>';
      }).join('');
      return '<div class="bp-section"><div class="bp-section-title">' + esc(label) + '</div>' + items + '</div>';
    }).join('');
    try { body.scrollTop = body.scrollHeight; } catch (e) {}
  }

  function ensureMenuItems() {
    var dd = document.getElementById('menu-dropdown');
    if (!dd || dd.querySelector('[data-bp-menu="equipa"]')) return;
    var frag = document.createDocumentFragment();
    var sec = document.createElement('div');
    sec.className = 'bp-menu-section';
    sec.setAttribute('data-bp-menu', 'equipa');
    sec.textContent = 'Equipa';
    frag.appendChild(sec);
    [{ key: 'ranking', label: 'Ranking' }, { key: 'horarios', label: 'Horários e folgas' }, { key: 'chat', label: 'Chat interno' }].forEach(function (it) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-bp-menu', 'equipa');
      btn.setAttribute('data-bp-action', it.key);
      btn.innerHTML = '<span>' + it.label + '</span>';
      frag.appendChild(btn);
    });
    var logout = dd.querySelector('#logout-btn');
    if (logout) dd.insertBefore(frag, logout);
    else dd.appendChild(frag);
    if (!dd.dataset.bpEquipaBound) {
      dd.dataset.bpEquipaBound = '1';
      dd.addEventListener('click', function (e) {
        var t = e.target.closest('[data-bp-action]');
        if (!t || t.getAttribute('data-bp-menu') !== 'equipa') return;
        e.stopPropagation();
        dd.style.display = 'none';
        var a = t.getAttribute('data-bp-action');
        try {
          if (a === 'ranking') openRanking();
          if (a === 'horarios') openHorarios();
          if (a === 'chat') openChat();
        } catch (err) {
          console.error('[BPEquipa]', err);
          if (typeof toast === 'function') toast('Não foi possível abrir esta secção', 'error');
        }
      });
    }
  }

  function init() {
    // ET4-P1-02: listeners só uma vez; re-ensure de menus permitido após login
    if (window.__bpEquipaInitDone) {
      try {
        if (typeof ensureMenuItems === "function") ensureMenuItems();
      } catch (eRe) {}
      return;
    }
    window.__bpEquipaInitDone = true;

    try { ensureMenuItems(); } catch (e) { console.warn('[equipa]', e); }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 140); });
  } else setTimeout(init, 140);
  setTimeout(init, 1600);
  setTimeout(init, 4200);

  window.BPEquipa = {
    calcRanking: calcRanking,
    getHorarioProf: getHorarioProf,
    setHorarioProf: setHorarioProf,
    estadoHojeProf: estadoHojeProf,
    conflitosAgenda: conflitosAgenda,
    enviarMensagem: enviarMensagem,
    loadChat: loadChat,
    openRanking: openRanking,
    openHorarios: openHorarios,
    openChat: openChat
  };
})();


if (typeof window !== 'undefined' && window.BPEquipa) window.BPEquipa._bpOwner = 'modules/equipa';
