/* BelezaPro — modules/notificacoes — push / notificações locais (PWA)
 * Cirúrgico: sem VAPID obrigatório. Push remoto fica preparado no SW;
 * o runtime usa Notification API + registo do service worker.
 */
(function (g) {
  'use strict';

  var PREF_KEY = 'bp_push_pref'; // granted | denied | default | dismissed

  function supported() {
    return typeof g.Notification !== 'undefined' && 'serviceWorker' in g.navigator;
  }

  function permission() {
    if (!supported()) return 'unsupported';
    try {
      return g.Notification.permission || 'default';
    } catch (e) {
      return 'unsupported';
    }
  }

  function getPref() {
    try {
      return g.localStorage.getItem(PREF_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function setPref(v) {
    try {
      g.localStorage.setItem(PREF_KEY, String(v || ''));
    } catch (e) {}
  }

  /**
   * Pede permissão uma vez (respeita preferência local).
   * @returns {Promise<'granted'|'denied'|'default'|'unsupported'>}
   */
  function requestPermission() {
    if (!supported()) return Promise.resolve('unsupported');
    var p = permission();
    if (p === 'granted' || p === 'denied') {
      setPref(p);
      return Promise.resolve(p);
    }
    return g.Notification.requestPermission()
      .then(function (r) {
        setPref(r);
        return r;
      })
      .catch(function () {
        setPref('denied');
        return 'denied';
      });
  }

  /**
   * Mostra notificação local (app em background ou via SW).
   * @param {{title:string, body?:string, tag?:string, data?:object, requireInteraction?:boolean}} opts
   */
  function showLocal(opts) {
    opts = opts || {};
    var title = opts.title || 'BelezaPro';
    var body = opts.body || '';
    var tag = opts.tag || 'bp-local';
    var data = opts.data || {};
    var ri = !!opts.requireInteraction;

    if (!supported()) return Promise.resolve(false);
    if (permission() !== 'granted') return Promise.resolve(false);

    var icon = './assets/img/icon-192.png';
    var badge = './assets/img/icon-192.png';

    return g.navigator.serviceWorker.ready
      .then(function (reg) {
        if (reg && typeof reg.showNotification === 'function') {
          return reg
            .showNotification(title, {
              body: body,
              icon: icon,
              badge: badge,
              tag: tag,
              data: data,
              requireInteraction: ri,
              vibrate: [120, 60, 120],
            })
            .then(function () {
              return true;
            });
        }
        // fallback: Notification no cliente
        try {
          // eslint-disable-next-line no-new
          new g.Notification(title, { body: body, icon: icon, tag: tag, data: data });
          return true;
        } catch (e) {
          return false;
        }
      })
      .catch(function () {
        try {
          // eslint-disable-next-line no-new
          new g.Notification(title, { body: body, icon: icon, tag: tag, data: data });
          return true;
        } catch (e2) {
          return false;
        }
      });
  }

  /** Atalho: alerta de agendamento a expirar */
  function notifyExpiring(ag, minutesLeft) {
    ag = ag || {};
    var nome = ag.cliente || 'Cliente';
    var serv = ag.servico || 'serviço';
    var min = minutesLeft != null ? minutesLeft : 5;
    return showLocal({
      title: 'Agendamento a expirar',
      body: nome + ' · ' + serv + ' · em ~' + min + ' min',
      tag: 'bp-expirar-' + String(ag.id || nome),
      requireInteraction: true,
      data: { type: 'expirar', agendaId: ag.id || null, url: './index.html#agenda' },
    });
  }

  /** Pedido suave pós-login (não bloqueia UI) */
  function maybePromptAfterLogin() {
    if (!supported()) return;
    if (permission() === 'granted' || permission() === 'denied') return;
    if (getPref() === 'dismissed') return;
    setTimeout(function () {
      requestPermission().catch(function () {});
    }, 2500);
  }

  var API = {
    supported: supported,
    permission: permission,
    requestPermission: requestPermission,
    showLocal: showLocal,
    notifyExpiring: notifyExpiring,
    maybePromptAfterLogin: maybePromptAfterLogin,
    getPref: getPref,
    setPref: setPref,
    _bpOwner: 'modules/notificacoes',
  };

  g.BPNotify = API;
  g.bpNotifyRequest = requestPermission;
  g.bpNotifyLocal = showLocal;
  g.bpNotifyExpiring = notifyExpiring;
})(typeof window !== 'undefined' ? window : globalThis);
