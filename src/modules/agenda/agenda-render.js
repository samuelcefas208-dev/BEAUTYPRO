/* BelezaPro B5 — polish residual; carregar após app.bundle.js */

/* BeautyPro — Agenda cards + acções (Ag-2)
   Hierarquia: Finalizar (primário) · WhatsApp · Cancelar
   Todos os botões: mesma altura, grelha estável, área de toque ≥40px
*/
(function () {
  "use strict";

  function esc(s) {
    return typeof escHtml === "function" ? escHtml(String(s || "")) : String(s || "");
  }
  function money(v) {
    return typeof fmtKz === "function" ? fmtKz(v) : String(v || 0) + " Kz";
  }
  function statusOf(a) {
    if (typeof _statusAg === "function") return _statusAg(a);
    return String((a && (a.status || a.estado)) || "agendado").toLowerCase();
  }
  function profName(a) {
    if (typeof getProfissionalNome === "function") return getProfissionalNome(a.profissional_id);
    return a.profissional || "—";
  }
  function clienteTelefone(ag) {
    var list = (typeof state !== "undefined" && state.clientes) || [];
    var c = list.find(function (x) {
      return (ag.cliente_id && x.id === ag.cliente_id) || (ag.cliente && x.nome === ag.cliente);
    });
    if (!c || !c.telefone) return "";
    return String(c.telefone).replace(/\D/g, "");
  }
  function waHref(ag) {
    var digits = clienteTelefone(ag);
    if (!digits) return "";
    var num = digits.length === 9 ? "244" + digits : digits;
    var msg =
      "Olá " +
      (ag.cliente || "") +
      ", lembrete do seu agendamento de " +
      (ag.servico || "serviço") +
      " no dia " +
      (ag.data || "") +
      " às " +
      String(ag.hora || "").slice(0, 5) +
      ".";
    return "https://wa.me/" + num + "?text=" + encodeURIComponent(msg);
  }

  function renderAgendaItemPro(a, opts) {
    if (!a) return "";
    opts = opts || null;
    var st = statusOf(a);
    var isRealizado = st === "realizado";
    var isCancelado = st === "cancelado";
    var isExpirado = st === "nao_realizado" || st === "nao-realizado" || st === "expirado";
    var isAgendado = st === "agendado";
    var expirado =
      typeof agendamentoExpirado === "function" ? agendamentoExpirado(a) : false;
    var podeFinalizar = isAgendado && !expirado;
    var podeCancelar = isAgendado;
    var podeWhatsApp = isAgendado && !!clienteTelefone(a);

    /* Tipologia de plataforma = mesmas classes das abas Clientes/Equipa */
    var statusLabel = "Agendado";
    var statusClass = "cliente-stat cliente-stat--agenda";
    if (isRealizado) {
      statusLabel = "Realizado";
      statusClass = "cliente-stat cliente-stat--gasto";
    } else if (isCancelado) {
      statusLabel = "Cancelado";
      statusClass = "cliente-stat";
    } else if (isExpirado) {
      statusLabel = "Não realizado";
      statusClass = "cliente-stat cliente-stat--risco";
    }

    var hora = String(a.hora || "").slice(0, 5);
    if (hora.length === 4 && hora.indexOf(":") === 1) hora = "0" + hora;
    if (hora.length < 5) hora = (hora + "00:00").slice(0, 5);
    var whenTxt = hora || "—";
    var nomeProf = profName(a);

    /* Avatar: foto real ou silhueta padrão — nunca letra */
    var avHtml = "";
    try {
      var cli = ((typeof state !== "undefined" && state.clientes) || []).find(function (c) {
        return c.nome === a.cliente || c.id === a.cliente_id;
      });
      var fotoSrc = cli && (window.BPMedia && BPMedia.resolveFotoSrc
        ? BPMedia.resolveFotoSrc(cli)
        : (cli && (cli.foto || cli.foto_url)));
      var _fs = "";
      if (fotoSrc && typeof bpSafeImgSrc === "function") _fs = bpSafeImgSrc(fotoSrc) || "";
      else if (fotoSrc) _fs = String(fotoSrc);
      if (!_fs && window.BPAvatars && typeof BPAvatars.avatarDataUrl === "function") {
        _fs = BPAvatars.avatarDataUrl();
      }
      if (!_fs && window.BPAvatars && BPAvatars.defaultSrc) _fs = BPAvatars.defaultSrc;
      if (!_fs) {
        _fs = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#E8E6E1"/><circle cx="50" cy="38" r="20" fill="#B8B2A8"/><ellipse cx="50" cy="92" rx="38" ry="32" fill="#B8B2A8"/></svg>'
        );
      }
      avHtml =
        '<div class="avatar bp-avatar-img bp-ag-avatar"><img src="' +
        _fs +
        '" alt="" loading="lazy" decoding="async"></div>';
    } catch (e) {
      avHtml =
        '<div class="avatar bp-avatar-img bp-ag-avatar"><img src="' +
        (window.BPAvatars && BPAvatars.defaultSrc ? BPAvatars.defaultSrc : "") +
        '" alt="" loading="lazy" decoding="async"></div>';
    }

    var actions = "";
    if (podeFinalizar || podeWhatsApp || podeCancelar) {
      var cells = [];
      if (podeFinalizar) {
        cells.push(
          '<button type="button" class="btn btn-sm btn-primary bp-ag-btn" data-id="' +
            esc(a.id) +
            '" data-action="finalizar">Finalizar</button>'
        );
        cells.push(
          '<button type="button" class="btn btn-sm btn-secondary bp-ag-btn" data-id="' +
            esc(a.id) +
            '" data-action="reagendar-agenda">Reagendar</button>'
        );
      }
      if (podeWhatsApp) {
        var href = waHref(a);
        cells.push(
          '<a class="btn btn-sm bp-ag-btn bp-btn-whatsapp" href="' +
            esc(href) +
            '" target="_blank" rel="noopener noreferrer" data-action="whatsapp"><svg class="bp-ic-wa" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.47 14.3c-.28-.14-1.64-.81-1.9-.9-.25-.1-.44-.14-.62.14-.18.28-.71.9-.87 1.08-.16.18-.32.2-.6.07-.28-.14-1.17-.43-2.23-1.37-.82-.73-1.38-1.64-1.54-1.92-.16-.28-.02-.43.12-.57.13-.13.28-.32.42-.48.14-.16.18-.28.28-.46.09-.18.05-.35-.02-.49-.07-.14-.62-1.49-.85-2.04-.22-.53-.45-.46-.62-.47h-.53c-.18 0-.47.07-.71.35-.25.28-.93.91-.93 2.22s.96 2.58 1.09 2.76c.14.18 1.88 2.87 4.56 4.02 1.7.73 2.15.8 2.92.67.45-.08 1.64-.67 1.87-1.32.23-.65.23-1.2.16-1.32-.07-.11-.25-.18-.53-.32z"/><path fill="currentColor" d="M12.04 2C6.5 2 2.01 6.49 2.01 12.03c0 1.85.5 3.57 1.37 5.07L2 22l5.04-1.32A9.96 9.96 0 0 0 12.04 22C17.57 22 22 17.52 22 11.99 22 6.49 17.57 2 12.04 2zm0 18.15c-1.67 0-3.22-.48-4.54-1.32l-.33-.19-3.08.81.82-3-.21-.35a7.94 7.94 0 0 1-1.3-4.38c0-4.4 3.58-7.98 7.99-7.98 4.4 0 7.98 3.58 7.98 7.98 0 4.4-3.58 7.98-7.98 7.98z"/></svg><span>WhatsApp</span></a>'
        );
      } else if (podeFinalizar) {
        /* mantém grelha 2x2 estável quando não há telefone */
        cells.push(
          '<button type="button" class="btn btn-sm btn-secondary bp-ag-btn" disabled title="Sem telefone">WhatsApp</button>'
        );
      }
      if (podeCancelar) {
        cells.push(
          '<button type="button" class="btn btn-sm btn-secondary bp-ag-btn bp-ag-btn-muted" data-id="' +
            esc(a.id) +
            '" data-action="cancelar-agenda" data-role="admin,gerente">Cancelar</button>'
        );
      }
      actions =
        '<div class="bp-ag-actions" style="--bp-ag-cols:2">' + cells.join("") + "</div>";
    }

    var pulseCls = (opts && opts.pulse) ? " bp-ag-card--pulse" : "";
    var precoNum = Number(a.preco != null ? a.preco : a.valor) || 0;
    var precoBase = (typeof fmtKz === "function") ? fmtKz(precoNum) : (precoNum + " Kz");
    var priceCls = "bp-ag-price";
    var precoTxt;
    var statusExtra = "";
    if (isRealizado) {
      priceCls += " bp-ag-price--ok";
      precoTxt = "+" + precoBase;
    } else if (isExpirado || isCancelado) {
      priceCls += " bp-ag-price--off";
      precoTxt = precoBase;
    } else {
      priceCls += " bp-ag-price--pend";
      precoTxt = precoBase;
    }

    return (
      '<div class="list-item bp-ag-card' + pulseCls + '" data-agenda-id="' +
      esc(a.id) +
      '">' +
      avHtml +
      '<div class="info bp-ag-info">' +
      '<div class="bp-ag-head">' +
      '<div class="bp-ag-head-main">' +
      '<div class="sub bp-ag-when">' + esc(whenTxt) + "</div>" +
      '<div class="title">' + esc(a.servico || "Serviço") + "</div>" +
      '<div class="sub bp-ag-cli-line">cliente: ' + esc(a.cliente || "—") + "</div>" +
      '<div class="sub bp-ag-prof-line">prof: ' + esc(nomeProf || "—") + "</div>" +
      "</div>" +
      '<div class="bp-ag-head-side">' +
      '<span class="bp-ag-status ' + statusClass + statusExtra + '">' + statusLabel + "</span>" +
      '<span class="' + priceCls + '">' + precoTxt + "</span>" +
      "</div>" +
      "</div>" +
      actions +
      "</div>" +
      "</div>"
    );
  }

  function install() {
    try {
      if (typeof renderAgendaItem === "function") renderAgendaItem = renderAgendaItemPro;
    } catch (e) {}
    window.renderAgendaItem = renderAgendaItemPro;
    window.renderAgendaItem._bpOwner = 'modules/agenda';
    window.renderAgendaItem._bpEnhanced = 'agenda-render';
  }

  function init() {
    install();
    try {
      if (typeof renderAgendaFull === "function") {
        var tab = document.getElementById("tab-agenda");
        if (tab && tab.classList.contains("active")) renderAgendaFull();
      }
    } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(init, 200);
    });
  } else setTimeout(init, 200);
  setTimeout(init, 1000);

  document.addEventListener("click", function (e) {
    if (e.target.closest('[data-tab="agenda"]')) {
      install();
      setTimeout(function () {
        try {
          if (typeof renderAgendaFull === "function") renderAgendaFull();
        } catch (err) {}
      }, 60);
    }
  });

  window.BPAgendaUI = {
    renderAgendaItemPro: renderAgendaItemPro,
    install: install,
    clienteTelefone: clienteTelefone,
    waHref: waHref,
  };
})();

