/* BelezaPro B6 — feature fora do monólito; carregar após app.bundle.js */

// ====================================================================
//  expirar-agendamento.js — alerta com minutos exactos (≤ 5 min)
// ====================================================================

var BP_ALERT_VISTO_PREFIX = 'bp_alert_visto_';
var BP_EXPIRING_WINDOW_MS = 5 * 60 * 1000;
var BP_EXPIRING_INTERVAL_MS = 15000; // 15s — leitura contínua, não só no reload
var _bpExpiringTimer = null;
var _bpExpiringBusy = false;
var _bpExpiringCurrentId = null;
var _bpExpiringLastShowAt = 0;
var _bpExpiringTick = null;
var BP_EXPIRING_MIN_GAP_MS = 1500;

function bpAlertVistoKey(id) {
  return BP_ALERT_VISTO_PREFIX + String(id || '');
}

function bpIsAlertVisto(id) {
  if (!id) return false;
  try {
    var v = localStorage.getItem(bpAlertVistoKey(id));
    return v === 'true' || v === '1';
  } catch (_) {
    return false;
  }
}

function bpMarkAlertVisto(id) {
  if (!id) return;
  try { localStorage.setItem(bpAlertVistoKey(id), 'true'); } catch (_) {}
}

function bpClearAlertVisto(id) {
  if (!id) return;
  try { localStorage.removeItem(bpAlertVistoKey(id)); } catch (_) {}
}

function bpGetClienteTelefoneFromAg(ag) {
  if (!ag) return '';
  var tel = '';
  if (ag.cliente_id && typeof state !== 'undefined' && state.clientes) {
    var c = state.clientes.find(function (x) {
      return x && String(x.id) === String(ag.cliente_id);
    });
    if (c && c.telefone) tel = String(c.telefone);
  }
  if (!tel && ag.telefone) tel = String(ag.telefone);
  if (!tel && ag.cliente && typeof state !== 'undefined' && state.clientes) {
    var c2 = state.clientes.find(function (x) {
      return x && x.nome === ag.cliente;
    });
    if (c2 && c2.telefone) tel = String(c2.telefone);
  }
  return String(tel || '').replace(/\D/g, '');
}

function bpNormTelWa(digits) {
  var d = String(digits || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.indexOf('244') === 0 && d.length >= 12) return d;
  if (d.length === 9) return '244' + d;
  return d;
}

function bpParseAgDtLocal(data, hora) {
  if (typeof _parseAgDateTime === 'function') {
    var dt0 = _parseAgDateTime(data, hora);
    if (dt0) return dt0;
  }
  var d = String(data || '').trim();
  var h = String(hora || '00:00').trim().slice(0, 5);
  if (!d) return null;
  // Garantir HH:MM com 2 dígitos
  var parts = h.split(':');
  var hh = String(parts[0] || '0').padStart(2, '0');
  var mm = String(parts[1] || '0').padStart(2, '0');
  var iso = d + 'T' + hh + ':' + mm + ':00';
  var dt = new Date(iso);
  if (isNaN(dt.getTime())) {
    // fallback local components
    var dp = d.split('-');
    if (dp.length === 3) {
      dt = new Date(
        parseInt(dp[0], 10),
        parseInt(dp[1], 10) - 1,
        parseInt(dp[2], 10),
        parseInt(hh, 10),
        parseInt(mm, 10),
        0
      );
    }
  }
  return isNaN(dt.getTime()) ? null : dt;
}

/** ms restantes. null = N/A; <=0 = já passou. */
function bpIsAppointmentExpiring(ag, nowMs) {
  if (!ag) return null;
  var st = String(ag.status || ag.estado || 'agendado').toLowerCase();
  if (st !== 'agendado') return null;
  var dt = bpParseAgDtLocal(ag.data, ag.hora);
  if (!dt) return null;
  var now = nowMs != null ? nowMs : Date.now();
  return dt.getTime() - now;
}

function bpFormatRemainText(remainMs) {
  if (remainMs == null || remainMs <= 0) return '0 segundos';
  var totalSec = Math.max(1, Math.ceil(remainMs / 1000));
  var mins = Math.floor(totalSec / 60);
  var secs = totalSec % 60;
  var timeText = '';
  if (mins > 0) {
    timeText = mins + ' minuto' + (mins > 1 ? 's' : '');
    if (secs > 0) {
      timeText += ' e ' + secs + ' segundo' + (secs > 1 ? 's' : '');
    }
  } else {
    timeText = secs + ' segundo' + (secs > 1 ? 's' : '');
  }
  return timeText;
}

function bpEscHtmlLite(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Actualiza a frase completa do modal (countdown fluido). */
function bpUpdateExpiryMessage(remainMs, clienteNome) {
  var msgEl = document.getElementById('expirar-message');
  if (!msgEl) return;
  var nome = bpEscHtmlLite(clienteNome || 'Cliente');
  var timeText = bpEscHtmlLite(bpFormatRemainText(remainMs));
  msgEl.innerHTML =
    'O agendamento com <strong class="bp-expirar-cliente" id="expirar-cliente-nome">' + nome + '</strong> ' +
    'está prestes a ser marcado como não realizado em <strong class="bp-expirar-tempo" id="expirar-tempo">' + timeText + '</strong>. ' +
    'Entre em contacto agora para tentar recuperar o atendimento ou combinar um novo horário com a cliente.';
}

function bpGetClosestExpiring() {
  var now = Date.now();
  var best = null;
  var bestRemain = Infinity;
  var list = (typeof state !== 'undefined' && state.agendamentos) ? state.agendamentos : [];
  for (var i = 0; i < list.length; i++) {
    var ag = list[i];
    if (!ag || !ag.id) continue;
    if (bpIsAlertVisto(ag.id)) continue;
    var remain = bpIsAppointmentExpiring(ag, now);
    if (remain == null) continue;
    if (remain <= 0) continue;
    if (remain > BP_EXPIRING_WINDOW_MS) continue;
    if (remain < bestRemain) {
      bestRemain = remain;
      best = ag;
    }
  }
  return best ? { ag: best, remain: bestRemain } : null;
}

function bpIsExpirarModalOpen() {
  var open = document.getElementById('modal-expirar');
  if (!open) return false;
  return open.classList.contains('open') || open.classList.contains('is-open');
}

function bpAnyBlockingModalOpen() {
  try {
    var nodes = document.querySelectorAll('.modal-overlay.open, .modal-overlay.is-open');
    for (var i = 0; i < nodes.length; i++) {
      var id = nodes[i].id || '';
      if (id && id !== 'modal-expirar') return true;
    }
  } catch (_) {}
  return false;
}

function bpAppShellVisible() {
  try {
    var app = document.getElementById('app-view');
    if (!app) return false;
    if (app.style.display === 'none') return false;
  } catch (_) {}
  return true;
}

function bpStopRemainTick() {
  if (_bpExpiringTick) {
    clearInterval(_bpExpiringTick);
    _bpExpiringTick = null;
  }
}

function bpStartRemainTick() {
  bpStopRemainTick();
  _bpExpiringTick = setInterval(function () {
    if (!bpIsExpirarModalOpen() || !_bpExpiringCurrentId) {
      bpStopRemainTick();
      return;
    }
    if (typeof state === 'undefined' || !state.agendamentos) return;
    var cur = null;
    for (var i = 0; i < state.agendamentos.length; i++) {
      var a = state.agendamentos[i];
      if (a && String(a.id) === String(_bpExpiringCurrentId)) { cur = a; break; }
    }
    var rem = cur ? bpIsAppointmentExpiring(cur) : null;
    if (rem == null || rem <= 0) {
      bpStopRemainTick();
      bpCloseExpirarModal();
      return;
    }
    var nome = cur.cliente || 'Cliente';
    bpUpdateExpiryMessage(rem, nome);
  }, 1000);
}

function bpCloseExpirarModal() {
  bpStopRemainTick();
  _bpExpiringCurrentId = null;
  if (typeof closeModal === 'function') closeModal('modal-expirar');
  else {
    var m = document.getElementById('modal-expirar');
    if (m) {
      m.classList.remove('open', 'is-open');
      m.style.display = '';
      m.setAttribute('aria-hidden', 'true');
      try { m.setAttribute('hidden', ''); } catch (_) {}
    }
  }
}

function bpShowExpirarModal(ag, remainMs) {
  if (!ag || !ag.id) return;
  if (!bpAppShellVisible()) return;
  if (bpAnyBlockingModalOpen()) return;
  if (bpIsAlertVisto(ag.id)) return;
  var remain = remainMs != null ? remainMs : bpIsAppointmentExpiring(ag);
  if (remain == null || remain <= 0 || remain > BP_EXPIRING_WINDOW_MS) return;

  var modal = document.getElementById('modal-expirar');
  if (!modal) return;

  var nowShow = Date.now();
  if (bpIsExpirarModalOpen() && _bpExpiringCurrentId === ag.id) {
    bpUpdateExpiryMessage(remain, ag.cliente || 'Cliente');
    return;
  }
  if (nowShow - _bpExpiringLastShowAt < BP_EXPIRING_MIN_GAP_MS && bpIsExpirarModalOpen()) return;
  _bpExpiringLastShowAt = nowShow;
  _bpExpiringCurrentId = ag.id;

  bpUpdateExpiryMessage(remain, ag.cliente || 'Cliente');

  var tel = bpGetClienteTelefoneFromAg(ag);
  var btnLigar = document.getElementById('expirar-ligar');
  var btnWa = document.getElementById('expirar-whatsapp');
  function setTelBtn(btn, ok) {
    if (!btn) return;
    if (ok) {
      btn.disabled = false;
      btn.classList.remove('is-disabled');
      btn.style.opacity = '';
      btn.removeAttribute('aria-disabled');
      btn.dataset.tel = tel;
      if (btn.id === 'expirar-ligar') btn.classList.add('bp-call-anim');
    } else {
      btn.disabled = true;
      btn.classList.add('is-disabled');
      btn.style.opacity = '0.4';
      btn.setAttribute('aria-disabled', 'true');
      delete btn.dataset.tel;
      if (btn.id === 'expirar-ligar') btn.classList.remove('bp-call-anim');
    }
  }
  setTelBtn(btnLigar, !!tel);
  setTelBtn(btnWa, !!tel);

  try { modal.removeAttribute('hidden'); } catch (_) {}
  try {
    if (typeof window.bpNotifyExpiring === 'function' && ag) {
      var _mins = (typeof minutesLeft === 'number') ? minutesLeft : 5;
      window.bpNotifyExpiring(ag, _mins);
    }
  } catch (_n) {}
  if (typeof openModal === 'function') openModal('modal-expirar');
  else {
    modal.style.display = 'flex';
    modal.classList.add('open', 'is-open');
  }
  try { modal.setAttribute('aria-hidden', 'false'); } catch (_) {}
  bpStartRemainTick();
}

function bpCheckExpiringAppointments() {
  if (_bpExpiringBusy) return;
  _bpExpiringBusy = true;
  try {
    if (!bpAppShellVisible()) return;
    if (typeof state === 'undefined' || !state.agendamentos) return;

    if (bpIsExpirarModalOpen() && _bpExpiringCurrentId) {
      var cur = state.agendamentos.find(function (a) {
        return a && String(a.id) === String(_bpExpiringCurrentId);
      });
      var rem = cur ? bpIsAppointmentExpiring(cur) : null;
      if (!cur || rem == null || rem <= 0 || bpIsAlertVisto(_bpExpiringCurrentId)) {
        bpCloseExpirarModal();
      } else if (rem <= BP_EXPIRING_WINDOW_MS) {
        bpUpdateExpiryMessage(rem, cur.cliente || 'Cliente');
        return;
      }
    }

    if (bpAnyBlockingModalOpen()) return;

    var hit = bpGetClosestExpiring();
    if (hit) bpShowExpirarModal(hit.ag, hit.remain);
  } catch (e) {
    console.warn('[expirar] check', e);
  } finally {
    _bpExpiringBusy = false;
  }
}

function bpBindExpirarModalOnce() {
  var modal = document.getElementById('modal-expirar');
  if (!modal || modal.dataset.bpBound === '1') return;
  modal.dataset.bpBound = '1';

  var ligar = document.getElementById('expirar-ligar');
  var wa = document.getElementById('expirar-whatsapp');
  var ignorar = document.getElementById('expirar-visto') || document.getElementById('expirar-ignorar');

  if (ligar && !ligar.dataset.bpBound) {
    ligar.dataset.bpBound = '1';
    ligar.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (ligar.disabled) return;
      var tel = ligar.dataset.tel || '';
      if (!tel) return;
      window.location.href = 'tel:' + tel;
    });
  }
  if (wa && !wa.dataset.bpBound) {
    wa.dataset.bpBound = '1';
    wa.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (wa.disabled) return;
      var tel = bpNormTelWa(wa.dataset.tel || '');
      if (!tel) return;
      window.open('https://wa.me/' + tel, '_blank', 'noopener,noreferrer');
    });
  }
  if (ignorar && !ignorar.dataset.bpBound) {
    ignorar.dataset.bpBound = '1';
    ignorar.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (_bpExpiringCurrentId) bpMarkAlertVisto(_bpExpiringCurrentId);
      bpCloseExpirarModal();
      setTimeout(bpCheckExpiringAppointments, 400);
    });
  }

  try {
    if (typeof MutationObserver !== 'undefined') {
      var obs = new MutationObserver(function () {
        if (!bpIsExpirarModalOpen() && _bpExpiringCurrentId) {
          _bpExpiringCurrentId = null;
        }
      });
      obs.observe(modal, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    }
  } catch (_) {}
}

function bpStartExpiringWatcher() {
  bpBindExpirarModalOnce();
  if (_bpExpiringTimer) {
    clearInterval(_bpExpiringTimer);
    _bpExpiringTimer = null;
  }
  _bpExpiringTimer = setInterval(bpCheckExpiringAppointments, BP_EXPIRING_INTERVAL_MS);
  // Checks iniciais escalonados (dados podem chegar após loadState)
  setTimeout(bpCheckExpiringAppointments, 800);
  setTimeout(bpCheckExpiringAppointments, 3000);
  setTimeout(bpCheckExpiringAppointments, 8000);
  if (!window._bpExpiringVisBound) {
    window._bpExpiringVisBound = true;
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        setTimeout(bpCheckExpiringAppointments, 400);
      }
    });
  }
}

if (typeof window !== 'undefined') {
  window.bpCheckExpiringAppointments = bpCheckExpiringAppointments;
  window.bpStartExpiringWatcher = bpStartExpiringWatcher;
  window.bpIsAppointmentExpiring = bpIsAppointmentExpiring;
  window.bpGetClosestExpiring = bpGetClosestExpiring;
  window.bpClearAlertVisto = bpClearAlertVisto;
  window.bpMarkAlertVisto = bpMarkAlertVisto;
}

/* B6: main pode ter corrido antes deste script — arranque autónomo do watcher */
(function () {
  function boot() {
    try {
      if (typeof bpStartExpiringWatcher === 'function') bpStartExpiringWatcher();
    } catch (_) {}
  }
  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); });
  } else {
    setTimeout(boot, 0);
  }
})();
