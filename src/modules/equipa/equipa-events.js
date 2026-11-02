/* BelezaPro — modules/equipa/equipa-events.js
 * Etapa 3: events de equipa extraídos de src/app/form-events.js
 * Ownership: modal profissional, detalhe, criar serviço inline no modal prof.
 * Inclui helpers de view (avatar/WhatsApp) usados pelo detalhe de profissional.
 * Carregar após equipa-render + utils.
 */
// CRUD Profissional
let editProfId = null;

function popularEspecialidadesProf(selected) {
  const sel = document.getElementById('prof-esp');
  if (!sel) return;
  // Só serviços activos e com nome — nunca lixo / eliminados / inactivos
  const servicos = (state.servicos || [])
    .filter(function (s) {
      if (!s || !s.nome) return false;
      if (typeof isServicoAtivo === 'function') return isServicoAtivo(s);
      return s.ativo !== false && s.ativo !== 0 && s.ativo !== 'false';
    })
    .slice()
    .sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome), 'pt'); });
  let html = '<option value="">Seleccionar serviço / especialidade</option>';
  html += '<option value="__criar">+ Criar novo serviço</option>';
  servicos.forEach(function (s) {
    html += '<option value="' + escHtml(s.nome) + '">' + escHtml(s.nome) + '</option>';
  });
  sel.innerHTML = html;
  const box = document.getElementById('prof-criar-servico-box');
  if (selected && selected !== '__criar') {
    // Se o serviço antigo já não existe na lista activa, ainda assim mostrar valor
    const exists = servicos.some(function (s) { return s.nome === selected; });
    if (!exists && selected) {
      sel.innerHTML = html + '<option value="' + escHtml(selected) + '">' + escHtml(selected) + ' (legado)</option>';
    }
    sel.value = selected;
    if (box) box.style.display = 'none';
  } else if (selected === '__criar') {
    sel.value = '__criar';
    if (box) box.style.display = 'block';
  } else {
    if (box) box.style.display = 'none';
  }
}

function bpToggleCriarServicoBox() {
  const sel = document.getElementById('prof-esp');
  const box = document.getElementById('prof-criar-servico-box');
  if (!sel || !box) return;
  const criar = sel.value === '__criar';
  box.style.display = criar ? 'block' : 'none';
  if (criar) {
    const nomeEl = document.getElementById('prof-novo-servico-nome');
    if (nomeEl) setTimeout(function () { try { nomeEl.focus(); } catch (_) {} }, 50);
  }
}

async function bpCriarServicoDesdeProfModal() {
  const nome = ((document.getElementById('prof-novo-servico-nome') || {}).value || '').trim();
  const preco = parseFloat((document.getElementById('prof-novo-servico-preco') || {}).value);
  if (!nome) {
    toast('Indica o nome do novo serviço.', 'warning');
    return null;
  }
  if (!preco || preco <= 0) {
    toast('Indica um preço válido.', 'warning');
    return null;
  }
  if (typeof existeNomeDuplicado === 'function' && existeNomeDuplicado('servicos', nome)) {
    toast('Já existe um serviço com este nome. Seleccione-o na lista.', 'warning');
    popularEspecialidadesProf(nome);
    return nome;
  }
  const draftProf = ((document.getElementById('prof-nome') || {}).value || '').trim();
  if (!draftProf) {
    toast('Preenche o nome do profissional antes de criar o serviço.', 'warning');
    return null;
  }
  const payload = {
    nome: nome,
    precoBase: preco,
    profissionais: [draftProf],
    ativo: true,
    duracao: 60,
    updated_at: new Date().toISOString()
  };
  let created = null;
  if (typeof addServico === 'function') {
    created = await addServico(payload, { pendingNomes: [draftProf] });
  }
  if (!created) return null;
  // Associar nome ao select e fechar box
  popularEspecialidadesProf(nome);
  const box = document.getElementById('prof-criar-servico-box');
  if (box) box.style.display = 'none';
  const nomeEl = document.getElementById('prof-novo-servico-nome');
  const precoEl = document.getElementById('prof-novo-servico-preco');
  if (nomeEl) nomeEl.value = '';
  if (precoEl) precoEl.value = '';
  toast('Serviço «' + nome + '» adicionado. Pode ajustá-lo depois na aba Serviços.', 'success');
  if (typeof renderServicos === 'function') {
    try { renderServicos(); } catch (_) {}
  }
  return nome;
}


document.getElementById('prof-esp')?.addEventListener('change', bpToggleCriarServicoBox);
document.getElementById('prof-criar-servico-btn')?.addEventListener('click', async function (e) {
  e.preventDefault();
  await bpCriarServicoDesdeProfModal();
});

function setProfModalMode(mode) {
  const modal = document.getElementById('modal-prof');
  const sheet = document.getElementById('modal-prof-sheet');
  const view = document.getElementById('prof-view-panel');
  const form = document.getElementById('prof-form-panel');
  if (modal) modal.setAttribute('data-mode', mode);
  if (sheet) sheet.classList.toggle('modal-sheet--view', mode === 'view');
  if (view) {
    view.hidden = mode !== 'view';
    try { view.style.display = mode === 'view' ? '' : 'none'; } catch (_) {}
  }
  if (form) {
    form.hidden = mode !== 'edit';
    try { form.style.display = mode === 'edit' ? '' : 'none'; } catch (_) {}
  }
  ['prof-nome','prof-idade','prof-data-contratual','prof-bi','prof-morada','prof-contacto','prof-esp','prof-taxa','prof-meta'].forEach(function (fid) {
    const el = document.getElementById(fid);
    if (el) {
      el.disabled = false;
      el.readOnly = false;
      el.style.opacity = '';
    }
  });
}

function _receitaProfissionalMes(profId) {
  try {
    if (typeof _bpStatsProf === 'function') return _bpStatsProf(profId, 'total').receita;
  } catch (e) {}
  return 0;
}
function _comissaoProfissionalMes(profId) {
  try {
    if (typeof _bpStatsProf === 'function') return _bpStatsProf(profId, 'total').comissao;
  } catch (e) {}
  return 0;
}


function bpFotoSrcEntidade(ent) {
  if (!ent) return null;
  if (window.BPMedia && typeof BPMedia.resolveFotoSrc === 'function') {
    var r = BPMedia.resolveFotoSrc(ent);
    if (r) return r;
  }
  if (ent.foto && String(ent.foto).indexOf('data:') === 0) return ent.foto;
  if (ent.foto_url) return ent.foto_url;
  if (ent.foto) return ent.foto;
  return null;
}
function bpViewHeroAvatarHtml(ent, fallbackChar) {
  var src = bpFotoSrcEntidade(ent);
  if (src) {
    var safe = (typeof bpSafeImgSrc === 'function')
      ? bpSafeImgSrc(src)
      : '';
    if (safe) {
      return '<div class="bp-view-hero-av bp-view-hero-av--img"><img src="' + safe + '" alt="" loading="lazy" decoding="async"></div>';
    }
  }
  return '<div class="bp-view-hero-av">' + escHtml(fallbackChar || '?') + '</div>';
}

function openEditProf(id) {
  const p = state.profissionais.find(x => x.id === id);
  if (!p) return;
  editProfId = id;
  setProfModalMode('edit');
  document.getElementById('prof-modal-title').textContent = 'Editar profissional';
  document.getElementById('prof-nome').value = p.nome || '';
  document.getElementById('prof-idade').value = p.idade || '';
  const dataEl = document.getElementById('prof-data-contratual');
  if (dataEl) dataEl.value = p.dataContratual || p.dataNascimento || '';
  document.getElementById('prof-bi').value = p.numeroBI || '';
  document.getElementById('prof-morada').value = p.morada || '';
  document.getElementById('prof-contacto').value = p.contacto || '';
  const taxaEl = document.getElementById('prof-taxa');
  if (taxaEl) taxaEl.value = p.taxa_comissao != null ? p.taxa_comissao : (p.taxa || 0);
  const metaEl = document.getElementById('prof-meta');
  if (metaEl) metaEl.value = p.meta_mensal != null ? p.meta_mensal : (p.meta || '');
  popularEspecialidadesProf(p.especialidade || '');
  document.getElementById('prof-id').value = id;
  openModal('modal-prof');
}


/** Botões contacto com identidade visual (WhatsApp / Ligar) — ponto 6 */
function bpBtnWhatsAppHtml(href, label) {
  label = label || 'WhatsApp';
  var icon = '<svg class="bp-ic-wa" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.47 14.3c-.28-.14-1.64-.81-1.9-.9-.25-.1-.44-.14-.62.14-.18.28-.71.9-.87 1.08-.16.18-.32.2-.6.07-.28-.14-1.17-.43-2.23-1.37-.82-.73-1.38-1.64-1.54-1.92-.16-.28-.02-.43.12-.57.13-.13.28-.32.42-.48.14-.16.18-.28.28-.46.09-.18.05-.35-.02-.49-.07-.14-.62-1.49-.85-2.04-.22-.53-.45-.46-.62-.47h-.53c-.18 0-.47.07-.71.35-.25.28-.93.91-.93 2.22s.96 2.58 1.09 2.76c.14.18 1.88 2.87 4.56 4.02 1.7.73 2.15.8 2.92.67.45-.08 1.64-.67 1.87-1.32.23-.65.23-1.2.16-1.32-.07-.11-.25-.18-.53-.32z"/><path fill="currentColor" d="M12.04 2C6.5 2 2.01 6.49 2.01 12.03c0 1.85.5 3.57 1.37 5.07L2 22l5.04-1.32A9.96 9.96 0 0 0 12.04 22C17.57 22 22 17.52 22 11.99 22 6.49 17.57 2 12.04 2zm0 18.15c-1.67 0-3.22-.48-4.54-1.32l-.33-.19-3.08.81.82-3-.21-.35a7.94 7.94 0 0 1-1.3-4.38c0-4.4 3.58-7.98 7.99-7.98 4.4 0 7.98 3.58 7.98 7.98 0 4.4-3.58 7.98-7.98 7.98z"/></svg>';
  return '<a class="btn btn-sm bp-btn-whatsapp" href="' + href + '" target="_blank" rel="noopener noreferrer">' + icon + '<span>' + label + '</span></a>';
}
function bpBtnLigarHtml(href, label) {
  label = label || 'Ligar';
  var icon = '<svg class="bp-ic-call" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  return '<a class="btn btn-sm bp-btn-call" href="' + href + '">' + icon + '<span>' + label + '</span></a>';
}
if (typeof window !== 'undefined') {
  window.bpBtnWhatsAppHtml = bpBtnWhatsAppHtml;
  window.bpBtnLigarHtml = bpBtnLigarHtml;
}

/** Placeholder animado (typewriter + rotação) — ponto 4 */
var _bpPhTimers = {};
function bpPrefersReducedMotion() {
  try {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_) { return false; }
}
function bpStartPlaceholderRotation(inputId, phrases) {
  var el = document.getElementById(inputId);
  if (!el || !phrases || !phrases.length) return;
  if (el.dataset.bpPhBound === '1') return;
  el.dataset.bpPhBound = '1';
  /* Acessibilidade: sem animação, placeholder estático da 1.ª frase */
  if (bpPrefersReducedMotion()) {
    el.setAttribute('placeholder', phrases[0]);
    return;
  }
  var idx = 0;
  var char = 0;
  var phase = 'type'; // type | hold | erase
  var current = phrases[0];
  function tick() {
    if (!document.body.contains(el)) {
      try { clearTimeout(_bpPhTimers[inputId]); } catch (_) {}
      return;
    }
    if (document.activeElement === el || (el.value && String(el.value).length)) {
      _bpPhTimers[inputId] = setTimeout(tick, 830);
      return;
    }
    if (phase === 'type') {
      char++;
      el.setAttribute('placeholder', current.slice(0, char));
      if (char >= current.length) {
        phase = 'hold';
        _bpPhTimers[inputId] = setTimeout(tick, 4200);
        return;
      }
      _bpPhTimers[inputId] = setTimeout(tick, 110);
      return;
    }
    if (phase === 'hold') {
      phase = 'erase';
      _bpPhTimers[inputId] = setTimeout(tick, 30);
      return;
    }
    // erase
    char--;
    if (char <= 0) {
      char = 0;
      el.setAttribute('placeholder', '');
      idx = (idx + 1) % phrases.length;
      current = phrases[idx];
      phase = 'type';
      _bpPhTimers[inputId] = setTimeout(tick, 900);
      return;
    }
    el.setAttribute('placeholder', current.slice(0, char));
    _bpPhTimers[inputId] = setTimeout(tick, 75);
  }
  _bpPhTimers[inputId] = setTimeout(tick, 1000);
}
function bpStartLabelRotation(elId, phrases) {
  var el = document.getElementById(elId);
  if (!el || !phrases || !phrases.length) return;
  if (el.dataset.bpPhBound === '1') return;
  el.dataset.bpPhBound = '1';
  if (bpPrefersReducedMotion()) {
    el.textContent = phrases[0];
    return;
  }
  var idx = 0, char = 0, phase = 'type', current = phrases[0];
  function tick() {
    if (!document.body.contains(el)) return;
    try {
      var trig = document.getElementById('caixa-localizar-btn');
      if (trig && trig.getAttribute('aria-expanded') === 'true') {
        _bpPhTimers[elId] = setTimeout(tick, 1200);
        return;
      }
    } catch (_) {}
    if (phase === 'type') {
      char++;
      el.textContent = current.slice(0, char);
      if (char >= current.length) {
        phase = 'hold';
        _bpPhTimers[elId] = setTimeout(tick, 4800);
        return;
      }
      _bpPhTimers[elId] = setTimeout(tick, 95);
      return;
    }
    if (phase === 'hold') {
      phase = 'erase';
      _bpPhTimers[elId] = setTimeout(tick, 40);
      return;
    }
    char--;
    if (char <= 0) {
      char = 0;
      el.textContent = '\u00a0';
      idx = (idx + 1) % phrases.length;
      current = phrases[idx];
      phase = 'type';
      _bpPhTimers[elId] = setTimeout(tick, 700);
      return;
    }
    el.textContent = current.slice(0, char);
    _bpPhTimers[elId] = setTimeout(tick, 65);
  }
  _bpPhTimers[elId] = setTimeout(tick, 1200);
}
function bpInitPlaceholderRotations() {
  bpStartPlaceholderRotation('search-cliente', [
    'Nome ou telefone...',
    'Localizar cliente...',
    'Pesquisar na lista...',
    'Nome do cliente...'
  ]);
  bpStartPlaceholderRotation('caixa-localizar-input', [
    'Nome do cliente...',
    'Localizar no histórico...',
    'Pesquisar venda por cliente...'
  ]);
  bpStartLabelRotation('caixa-loc-label-ph', [
    'Localizar cliente no histórico',
    'Pesquisar por nome...',
    'Cliente no histórico...',
    'Procurar venda por cliente...'
  ]);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { setTimeout(bpInitPlaceholderRotations, 400); });
} else {
  setTimeout(bpInitPlaceholderRotations, 400);
}

function abrirDetalheProfView(id) {
  const p = state.profissionais.find(x => x.id === id);
  if (!p) return;
  editProfId = id;
  setProfModalMode('view');
  setTimeout(function () {
    var btnFin = document.getElementById('prof-fin-open-btn');
    if (btnFin) btnFin.onclick = function () {
      if (typeof bpProfFinOpenModal === 'function') bpProfFinOpenModal(id);
    };
  }, 0);
  document.getElementById('prof-modal-title').textContent = 'Ficha do profissional';
  document.getElementById('prof-id').value = id;

  const receita = _receitaProfissionalMes(p.id);
  const meta = Number(p.meta_mensal != null ? p.meta_mensal : p.meta) || 0;
  const taxa = Number(p.taxa_comissao != null ? p.taxa_comissao : p.taxa) || 0;
  const digits = String(p.contacto || '').replace(/\D/g, '');
  let contactActions = '';
  if (digits.length === 9) {
    const wa = '244' + digits;
    const msg = encodeURIComponent('Olá ' + (p.nome || '') + ',');
    contactActions =
      '<div class="bp-view-contact-actions">' +
      bpBtnWhatsAppHtml('https://wa.me/' + wa + '?text=' + msg) +
      bpBtnLigarHtml('tel:+244' + digits) +
      '</div>';
  }

  let metaHtml = '';
  if (meta > 0) {
    const pct = Math.min(100, Math.round((receita / meta) * 100));
    metaHtml =
      '<div class="bp-view-section-title">Desempenho (total)</div>' +
      '<div class="bp-view-dl">' +
      '<div class="bp-view-row"><span class="bp-view-label">Receita</span><span class="bp-view-value">' + fmtKz(receita) + '</span></div>' +
      '<div class="bp-view-row"><span class="bp-view-label">Meta</span><span class="bp-view-value">' + fmtKz(meta) + ' · ' + pct + '%</span></div>' +
      '</div>';
  } else if (receita > 0) {
    metaHtml =
      '<div class="bp-view-section-title">Desempenho (total)</div>' +
      '<div class="bp-view-dl">' +
      '<div class="bp-view-row"><span class="bp-view-label">Receita</span><span class="bp-view-value">' + fmtKz(receita) + '</span></div>' +
      '</div>';
  }

  const body = document.getElementById('prof-view-body');
  if (body) {
    body.innerHTML =
      '<div class="bp-view-hero">' +
      bpViewHeroAvatarHtml(p, (p.nome || '?').charAt(0).toUpperCase()) +
      '<div><div class="bp-view-hero-name">' + escHtml(p.nome || 'Profissional') + '</div>' +
      '<div class="bp-view-hero-meta">' + escHtml(p.especialidade || 'Sem especialidade') + '</div></div></div>' +
      contactActions +
      '<div class="bp-view-dl">' +
      '<div class="bp-view-row"><span class="bp-view-label">Nome</span><span class="bp-view-value">' + escHtml(p.nome || '—') + '</span></div>' +
      '<div class="bp-view-row"><span class="bp-view-label">Especialidade</span><span class="bp-view-value">' + escHtml(p.especialidade || '—') + '</span></div>' +
      '<div class="bp-view-row"><span class="bp-view-label">Contacto</span><span class="bp-view-value">' + (digits ? escHtml(digits) : '—') + '</span></div>' +
      '<div class="bp-view-row"><span class="bp-view-label">Comissão</span><span class="bp-view-value">' + taxa + '%</span></div>' +
      (p.idade ? '<div class="bp-view-row"><span class="bp-view-label">Idade</span><span class="bp-view-value">' + escHtml(String(p.idade)) + ' anos</span></div>' : '') +
      (p.dataContratual || p.dataNascimento ? '<div class="bp-view-row"><span class="bp-view-label">Contrato</span><span class="bp-view-value">' + escHtml(p.dataContratual || p.dataNascimento) + '</span></div>' : '') +
      (p.morada ? '<div class="bp-view-row"><span class="bp-view-label">Morada</span><span class="bp-view-value">' + escHtml(p.morada) + '</span></div>' : '') +
      (p.numeroBI ? '<div class="bp-view-row"><span class="bp-view-label">BI</span><span class="bp-view-value">' + escHtml(p.numeroBI) + '</span></div>' : '') +
      '</div>' + metaHtml + (typeof bpProfFinHtmlResumo === 'function' ? bpProfFinHtmlResumo(id) : '');
  }
  openModal('modal-prof');
}

document.getElementById('add-prof-btn')?.addEventListener('click', () => {
  editProfId = null;
  setProfModalMode('edit');
  document.getElementById('prof-modal-title').textContent = 'Novo profissional';
  ['prof-nome', 'prof-idade', 'prof-data-contratual', 'prof-bi', 'prof-morada', 'prof-contacto', 'prof-id', 'prof-taxa', 'prof-meta'].forEach(fid => {
    const el = document.getElementById(fid);
    if (el) el.value = '';
  });
  popularEspecialidadesProf('');
  try {
    var esp = document.getElementById('prof-esp');
    if (esp) esp.value = '';
    var box = document.getElementById('prof-criar-servico-box');
    if (box) box.style.display = 'none';
  } catch (_) {}
  try {
    if (window.BPMedia && typeof BPMedia.clearPendingProfFoto === 'function') BPMedia.clearPendingProfFoto();
  } catch (_) {}
  openModal('modal-prof');
});


/** Data contratual: obrigatória; aceita AAAA-MM-DD ou DD/MM/AAAA; devolve ISO. */
function bpValidarDataContratual(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) {
    return {
      ok: false,
      message: 'A data contratual é obrigatória. Introduza a data no formato AAAA-MM-DD (ex: 2024-03-15) ou DD/MM/AAAA (ex: 15/03/2024).'
    };
  }
  var y, m, d;
  var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  var br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (iso) {
    y = parseInt(iso[1], 10);
    m = parseInt(iso[2], 10);
    d = parseInt(iso[3], 10);
  } else if (br) {
    d = parseInt(br[1], 10);
    m = parseInt(br[2], 10);
    y = parseInt(br[3], 10);
  } else {
    return {
      ok: false,
      message: 'Data contratual inválida. Use AAAA-MM-DD (ex: 2024-03-15) ou DD/MM/AAAA (ex: 15/03/2024).'
    };
  }
  if (y < 1950 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
    return {
      ok: false,
      message: 'Data contratual impossível. Verifique o dia, o mês e o ano (entre 1950 e 2100).'
    };
  }
  var dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return {
      ok: false,
      message: 'Data contratual inválida. Essa combinação de dia, mês e ano não existe no calendário.'
    };
  }
  var value = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  return { ok: true, value: value };
}
if (typeof window !== 'undefined') window.bpValidarDataContratual = bpValidarDataContratual;

document.getElementById('modal-prof-save')?.addEventListener('click', async () => {
  var saveBtn = document.getElementById('modal-prof-save');
  if (saveBtn && saveBtn.dataset.bpSaving === '1') return;
  if (saveBtn) {
    saveBtn.dataset.bpSaving = '1';
    try { saveBtn.disabled = true; } catch (_) {}
  }
  try {
  const nome = (document.getElementById('prof-nome')?.value || '').trim();
  const idade = document.getElementById('prof-idade')?.value;
  let dataContratual = (document.getElementById('prof-data-contratual')?.value || '').trim();
  let espSelect = document.getElementById('prof-esp')?.value || '';
  let especialidade = espSelect === '__criar' ? '' : espSelect;
  const numeroBI = (document.getElementById('prof-bi')?.value || '').trim().toUpperCase();
  const morada = (document.getElementById('prof-morada')?.value || '').trim();
  const contacto = (document.getElementById('prof-contacto')?.value || '').replace(/\D/g, '');
  const id = document.getElementById('prof-id')?.value;
  const taxa = parseFloat(document.getElementById('prof-taxa')?.value);
  const meta = parseFloat(document.getElementById('prof-meta')?.value);

  if (!nome) {
    if (typeof bpNotifyFormError === 'function') bpNotifyFormError('Introduza o nome do profissional para continuar.', 'prof-nome');
    else toast('Introduza o nome do profissional para continuar.', 'warning');
    return;
  }
  if (!idade || isNaN(parseInt(idade, 10))) {
    if (typeof bpNotifyFormError === 'function') bpNotifyFormError('A idade é obrigatória. Indique a idade do profissional para continuar.', 'prof-idade', 'warning');
    else toast('A idade é obrigatória. Indique a idade do profissional para continuar.', 'warning');
    return;
  }
  var idadeN = parseInt(idade, 10);
  if (idadeN < 16 || idadeN > 99) {
    if (typeof bpNotifyFormError === 'function') bpNotifyFormError('Indique uma idade válida entre 16 e 99 anos.', 'prof-idade', 'warning');
    else toast('Idade inválida (16 a 99).', 'warning');
    return;
  }
  /* Ponto 2 — data contratual: formato obrigatório + orientação */
  var dataChk = typeof bpValidarDataContratual === 'function'
    ? bpValidarDataContratual(dataContratual)
    : { ok: !!dataContratual, value: dataContratual, message: 'A data contratual é obrigatória.' };
  if (!dataChk.ok) {
    if (typeof bpNotifyFormError === 'function') bpNotifyFormError(dataChk.message, 'prof-data-contratual', 'warning');
    else toast(dataChk.message, 'warning');
    return;
  }
  dataContratual = dataChk.value;

  // Criar serviço no próprio fluxo se escolheu «Criar novo serviço»
  if (espSelect === '__criar') {
    const criado = await bpCriarServicoDesdeProfModal();
    if (!criado) return;
    especialidade = criado;
  }

  /* Ponto 1 — serviço obrigatório (anula R29 permissivo) */
  if (!especialidade || !String(especialidade).trim()) {
    if (typeof bpNotifyFormError === 'function') {
      bpNotifyFormError('Associe o profissional a um serviço (especialidade). Sem serviço não pode guardar.', 'prof-esp', 'warning');
    } else {
      toast('Associe o profissional a um serviço (especialidade).', 'warning');
    }
    return;
  }

  /* Ponto 1 — morada obrigatória */
  if (!morada) {
    if (typeof bpNotifyFormError === 'function') {
      bpNotifyFormError('A morada é obrigatória. Indique a morada do profissional para continuar.', 'prof-morada', 'warning');
    } else {
      toast('A morada é obrigatória.', 'warning');
    }
    return;
  }

  /* Ponto 1 — número/contacto obrigatório (9 dígitos) */
  if (!contacto || contacto.length !== 9) {
    if (typeof bpNotifyFormError === 'function') {
      bpNotifyFormError('O contacto é obrigatório e deve ter exactamente 9 dígitos (ex: 923456789).', 'prof-contacto', 'warning');
    } else {
      toast('Contacto obrigatório: exactamente 9 dígitos.', 'warning');
    }
    return;
  }

  /* Ponto 1 — comissão obrigatória (taxa preenchida, 0–100) */
  var taxaRaw = (document.getElementById('prof-taxa')?.value || '').trim();
  if (taxaRaw === '' || isNaN(taxa)) {
    if (typeof bpNotifyFormError === 'function') {
      bpNotifyFormError('A taxa de comissão é obrigatória. Indique um valor entre 0 e 100 (ex: 30).', 'prof-taxa', 'warning');
    } else {
      toast('A taxa de comissão é obrigatória (0 a 100).', 'warning');
    }
    return;
  }
  if (taxa < 0 || taxa > 100) {
    if (typeof bpNotifyFormError === 'function') {
      bpNotifyFormError('A taxa de comissão deve estar entre 0 e 100%.', 'prof-taxa', 'warning');
    } else {
      toast('Taxa de comissão inválida (0 a 100).', 'warning');
    }
    return;
  }

  /* Meta obrigatória (valor estimado de receita > 0) */
  var metaRaw = (document.getElementById('prof-meta')?.value || '').trim();
  var metaNum = Number(metaRaw);
  if (metaRaw === '' || isNaN(metaNum) || metaNum <= 0) {
    if (typeof bpNotifyFormError === 'function') {
      bpNotifyFormError('A meta é obrigatória. Indique o valor de receita alvo em Kz (ex: 200000).', 'prof-meta', 'warning');
    } else if (typeof bpInfoEntendi === 'function') {
      bpInfoEntendi('A meta é obrigatória. Indique o valor de receita alvo em Kz (ex: 200000).', 'Meta obrigatória');
    } else {
      toast('A meta é obrigatória (valor superior a zero).', 'warning');
    }
    return;
  }

  if (numeroBI && typeof validarBI === 'function' && !validarBI(numeroBI)) {
    toast('Número do BI incompleto ou em formato inválido. Preencha correctamente ou deixe em branco.', 'error');
    return;
  }

  const dados = {
    nome,
    idade: idadeN,
    dataContratual,
    especialidade,
    numeroBI: numeroBI || '',
    morada,
    contacto: contacto,
    taxa_comissao: taxa,
    meta_mensal: metaNum,
    meta: metaNum
  };

  if (id) {
    const upd = await updateProfissional(id, dados);
    if (upd) {
      toast('Profissional actualizado.', 'success');
      closeModal('modal-prof');
    }
  } else {
    const result = await addProfissional(dados);
    if (result) {
      // Foto escolhida antes de guardar (criação)
      try {
        var fotoP = null;
        if (window.BPMedia && typeof BPMedia.takePendingProfFoto === 'function') {
          fotoP = BPMedia.takePendingProfFoto();
        }
        if (fotoP && typeof BPMedia.setProfFoto === 'function') {
          await BPMedia.setProfFoto(result.id, fotoP);
          if (typeof BPMedia.patchRowAvatar === 'function') BPMedia.patchRowAvatar('profissionais', result.id);
          if (typeof BPMedia.enhanceListAvatars === 'function') BPMedia.enhanceListAvatars();
          if (typeof renderProfissionais === 'function') renderProfissionais();
        }
      } catch (eFoto) { console.warn('[prof foto save]', eFoto); }
      closeModal('modal-prof');
    }
  }
  } finally {
    var saveBtn2 = document.getElementById('modal-prof-save');
    if (saveBtn2) {
      saveBtn2.dataset.bpSaving = '';
      try { saveBtn2.disabled = false; } catch (_) {}
    }
  }
});

document.getElementById('prof-view-fechar')?.addEventListener('click', () => {
  setProfModalMode('edit');
  closeModal('modal-prof');
});
document.getElementById('prof-view-editar')?.addEventListener('click', () => {
  const id = document.getElementById('prof-id')?.value || editProfId;
  if (id) openEditProf(id);
});
document.getElementById('modal-prof-cancel')?.addEventListener('click', () => {
  setProfModalMode('edit');
  closeModal('modal-prof');
});

// Clique na linha do profissional → detalhe só leitura
document.addEventListener('click', function(e) {
  const row = e.target.closest('.list-item[data-prof-id]');
  if (!row) return;
  if (e.target.closest('.row-menu-btn') || e.target.closest('.row-menu')) return;
  const id = row.dataset.profId;
  if (id) abrirDetalheProfView(id);
});



/* Etapa 3 — API global para app-events / renders */
if (typeof window !== "undefined") {
  window.openEditProf = openEditProf;
  window.abrirDetalheProfView = abrirDetalheProfView;
  window.setProfModalMode = setProfModalMode;
  window.bpFotoSrcEntidade = bpFotoSrcEntidade;
  window.bpViewHeroAvatarHtml = bpViewHeroAvatarHtml;
}
