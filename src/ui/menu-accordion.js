/* BelezaPro B5 — polish residual; carregar após app.bundle.js */

// ================================================================
// Menu ☰ — acordeão: 8 grupos visíveis; subsecções só ao expandir
// + scroll do dropdown (max-height / overflow-y)
// ================================================================
(function () {
  "use strict";

  /* Todas as 8 áreas do menu ☰ bloqueadas — só Sair disponível. */
  var BP_MENU_AREAS_LOCKED = true;

  function lockSvg() {
    return (
      '<svg class="bp-acc-lock" viewBox="0 0 24 24" width="14" height="14" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="5" y="11" width="14" height="10" rx="2"/>' +
      '<path d="M8 11V8a4 4 0 0 1 8 0v3"/>' +
      '</svg>'
    );
  }

  var GROUPS = [
    {
      key: "finance",
      label: "Financeiro",
      items: [
        { action: "fluxo", label: "Fluxo de caixa" },
        { action: "rentab", label: "Rentabilidade" },
        { action: "meta", label: "Meta do salão" },
        { action: "despesas", label: "Despesas" }
      ]
    },
    {
      key: "mkt",
      label: "Marketing",
      items: [
        { action: "fidelidade", label: "Fidelidade" },
        { action: "indicacao", label: "Indicações" },
        { action: "lembretes", label: "Lembretes WhatsApp" },
        { action: "push", label: "Notificações" }
      ]
    },
    {
      key: "equipa",
      label: "Equipa",
      items: [
        { action: "ranking", label: "Ranking" },
        { action: "horarios", label: "Horários e folgas" },
        { action: "chat", label: "Chat interno" }
      ]
    },
    {
      key: "ops",
      label: "Operações",
      items: [
        { action: "stock", label: "Stock de produtos" },
        { action: "forn", label: "Fornecedores e compras" }
      ]
    },
    {
      key: "crm",
      label: "CRM",
      items: [
        { action: "nps", label: "Avaliação NPS" },
        { action: "timeline", label: "Histórico do cliente" },
        { action: "cal", label: "Calendário (.ics)" },
        { action: "galeria", label: "Galeria de serviços" }
      ]
    },
    {
      key: "com",
      label: "Comercial",
      items: [
        { action: "pacotes", label: "Pacotes e assinaturas" }
      ]
    },
    {
      key: "auto",
      label: "Automação",
      items: [
        { action: "reagg", label: "Reagendamento" }
      ]
    },
    {
      key: "gestao",
      label: "Gestão",
      items: [
        { action: "dash", label: "Dashboard executivo" },
        { action: "export", label: "Exportar relatórios" },
        { action: "backup", label: "Backups" },
        { action: "audit", label: "Auditoria" },
        { action: "filiais", label: "Filiais" }
      ]
    },
    {
      key: "config",
      label: "Configurações",
      items: [
        { action: "acessos", label: "Acessos" }
      ]
    }
  ];

  function chevronSvg() {
    return '<svg class="bp-acc-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>';
  }

  function stripLegacy(dd) {
    // remove flat injections from feature modules (keep logout + our accordion)
    Array.prototype.slice.call(dd.querySelectorAll("[data-bp-menu], .bp-menu-section")).forEach(function (el) {
      if (el.closest && el.closest(".bp-acc-group")) return;
      if (el.classList && el.classList.contains("bp-acc-toggle")) return;
      if (el.classList && el.classList.contains("bp-acc-panel")) return;
      el.parentNode && el.parentNode.removeChild(el);
    });
  }

  function buildAccordion(dd) {
    if (dd.querySelector(".bp-acc-root")) return;

    stripLegacy(dd);

    var root = document.createElement("div");
    root.className = "bp-acc-root";

    GROUPS.forEach(function (g) {
      var group = document.createElement("div");
      group.className = "bp-acc-group";
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", g.label);

      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "bp-acc-toggle";
      toggle.setAttribute("data-bp-menu", g.key); // impede re-injecção dos módulos
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("data-acc-key", g.key);
      var groupUnlocked = g.key === "config";
      if (BP_MENU_AREAS_LOCKED && !groupUnlocked) {
        toggle.classList.add("bp-acc-locked");
        toggle.setAttribute("aria-disabled", "true");
        toggle.setAttribute("title", "Disponível em breve");
        toggle.innerHTML = "<span>" + g.label + "</span>" + lockSvg();
      } else {
        toggle.innerHTML = "<span>" + g.label + "</span>" + chevronSvg();
      }

      var panel = document.createElement("div");
      panel.className = "bp-acc-panel";
      panel.setAttribute("data-acc-panel", g.key);
      panel.hidden = true;

      g.items.forEach(function (it) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("data-bp-menu", g.key);
        btn.setAttribute("data-bp-action", it.action);
        if (BP_MENU_AREAS_LOCKED && g.key !== "config") {
          btn.classList.add("bp-acc-item-locked");
          btn.setAttribute("aria-disabled", "true");
          btn.setAttribute("title", "Disponível em breve");
          btn.innerHTML = "<span>" + it.label + "</span>" + lockSvg();
        } else {
          btn.innerHTML = "<span>" + it.label + "</span>";
        }
        panel.appendChild(btn);
      });

      group.appendChild(toggle);
      group.appendChild(panel);
      root.appendChild(group);
    });

    var logout = dd.querySelector("#logout-btn");
    if (logout) dd.insertBefore(root, logout);
    else 
dd.appendChild(root);

    // Acções dos itens (galeria, nps, etc.) — o acordeão só abria painéis
    root.addEventListener("click", function (e) {
      var actBtn = e.target.closest("[data-bp-action]");
      if (actBtn && root.contains(actBtn) && !actBtn.classList.contains("bp-acc-toggle")) {
        e.preventDefault();
        e.stopPropagation();
        var menuKey = actBtn.getAttribute("data-bp-menu") || "";
        var actName = actBtn.getAttribute("data-bp-action") || "";
        var isConfigOpen = menuKey === "config" || actName === "acessos";
        if ((BP_MENU_AREAS_LOCKED && !isConfigOpen) || actBtn.classList.contains("bp-acc-item-locked")) {
          if (typeof toast === "function") toast("Esta área está bloqueada por agora.", "info");
          return;
        }
        var a = actBtn.getAttribute("data-bp-action");
        var menu = actBtn.getAttribute("data-bp-menu") || "";
        try {
          var dd = document.getElementById("menu-dropdown");
          if (dd) dd.style.display = "none";
          function call() {
            var args = Array.prototype.slice.call(arguments);
            var fn = args.shift();
            if (typeof fn === "function") { fn.apply(null, args); return true; }
            return false;
          }
          var ok = false;
          if (a === "acessos") {
            ok = call(window.bpOpenAcessosHub);
            if (!ok && typeof toast === "function") toast("Acessos indisponível neste momento.", "warning");
          } else if (a === "galeria") {
            ok = call(window.openGaleria) || call(window.BPMedia && BPMedia.openGaleria);
            if (!ok) {
              console.warn("[menu] openGaleria ausente — BPMedia?", !!window.BPMedia);
            }
          } else if (a === "stock" || a === "forn" || a === "nps" || a === "timeline" || a === "cal" || a === "pacotes") {
            /* E6 — ops diferido: load + abrir sem race */
            function _opsOpen() {
              if (a === "stock") return call(window.BPOps && BPOps.openStock);
              if (a === "forn") return call(window.BPOps && BPOps.openFornecedores);
              if (a === "nps") return call(window.BPOps && BPOps.openNps);
              if (a === "timeline") return call(window.BPOps && BPOps.openTimeline);
              if (a === "cal") return call(window.BPOps && BPOps.openCalendario);
              if (a === "pacotes") return call(window.BPOps && BPOps.openPacotes);
              return false;
            }
            if (window.BPOps) {
              ok = _opsOpen();
            } else if (typeof window.bpLoadDeferredOps === "function") {
              ok = true;
              if (typeof toast === "function") toast("A carregar Ops…", "info");
              window.bpLoadDeferredOps(function () {
                if (!_opsOpen() && typeof toast === "function") toast("Função indisponível neste momento", "warning");
              });
            } else {
              ok = false;
            }
          } else if (a === "ranking" || a === "horarios" || a === "chat") {
            /* E7 — equipa diferido: load + abrir sem race */
            function _eqOpen() {
              if (a === "ranking") return call(window.BPEquipa && BPEquipa.openRanking);
              if (a === "horarios") return call(window.BPEquipa && BPEquipa.openHorarios);
              if (a === "chat") return call(window.BPEquipa && BPEquipa.openChat);
              return false;
            }
            if (window.BPEquipa) {
              ok = _eqOpen();
            } else if (typeof window.bpLoadDeferredEquipa === "function") {
              ok = true;
              if (typeof toast === "function") toast("A carregar Equipa…", "info");
              window.bpLoadDeferredEquipa(function () {
                if (!_eqOpen() && typeof toast === "function") toast("Função indisponível neste momento", "warning");
              });
            } else {
              ok = false;
            }
          } else if (a === "fluxo" || a === "rentab" || a === "meta" || a === "despesas") {
            /* E8 — finance diferido */
            function _finOpen() {
              if (a === "fluxo") return call(window.BPFinance && (BPFinance.openModalFluxo || BPFinance.openFluxo));
              if (a === "rentab") return call(window.BPFinance && (BPFinance.openModalRentabilidade || BPFinance.openRentabilidade));
              if (a === "meta") return call(window.BPFinance && (BPFinance.openModalMetaSalao || BPFinance.openMeta));
              if (a === "despesas") return call(window.BPFinance && (BPFinance.openModalDespesaEnh || BPFinance.openDespesas));
              return false;
            }
            if (window.BPFinance) {
              ok = _finOpen();
            } else if (typeof window.bpLoadDeferredFinance === "function") {
              ok = true;
              if (typeof toast === "function") toast("A carregar Financeiro…", "info");
              window.bpLoadDeferredFinance(function () {
                if (!_finOpen() && typeof toast === "function") toast("Função indisponível neste momento", "warning");
              });
            } else {
              ok = false;
            }
          } else if (a === "fidelidade" || a === "indicacao" || a === "lembretes" || a === "push") {
            /* E5 — marketing diferido: load + abrir sem race */
            function _mktOpen() {
              if (a === "fidelidade") return call(window.BPMarketing && (BPMarketing.openModalFidelidade || BPMarketing.openFidelidade));
              if (a === "indicacao") return call(window.BPMarketing && (BPMarketing.openModalIndicacao || BPMarketing.openIndicacao));
              if (a === "lembretes") return call(window.BPMarketing && (BPMarketing.openModalLembretes || BPMarketing.openLembretes));
              if (a === "push") return call(window.BPMarketing && (BPMarketing.pedirPermissaoPush || BPMarketing.openPush));
              return false;
            }
            if (window.BPMarketing) {
              ok = _mktOpen();
            } else if (typeof window.bpLoadDeferredMarketing === "function") {
              ok = true;
              if (typeof toast === "function") toast("A carregar Marketing…", "info");
              window.bpLoadDeferredMarketing(function () {
                if (!_mktOpen() && typeof toast === "function") toast("Função indisponível neste momento", "warning");
              });
            } else {
              ok = false;
            }
          }
          else if (a === "dash" || a === "export" || a === "backup" || a === "audit" || a === "filiais" || a === "reagg") {
            /* E8 — gestão diferida */
            function _gesOpen() {
              if (a === "dash") return call(window.BPGestao && (BPGestao.openDashboard || BPGestao.dashboardExecutivo));
              if (a === "export") return call(window.BPGestao && (BPGestao.openExport || BPGestao.exportRelatorio));
              if (a === "backup") return call(window.BPGestao && (BPGestao.openBackup || BPGestao.downloadBackup));
              if (a === "audit") return call(window.BPGestao && (BPGestao.openAudit || BPGestao.loadAudit));
              if (a === "filiais") return call(window.BPGestao && (BPGestao.openFiliais || BPGestao.loadFiliais));
              if (a === "reagg") return call(window.BPGestao && BPGestao.openReagendar);
              return false;
            }
            if (window.BPGestao) {
              ok = _gesOpen();
            } else if (typeof window.bpLoadDeferredGestao === "function") {
              ok = true;
              if (typeof toast === "function") toast("A carregar Gestão…", "info");
              window.bpLoadDeferredGestao(function () {
                if (!_gesOpen() && typeof toast === "function") toast("Função indisponível neste momento", "warning");
              });
            } else {
              ok = false;
            }
          }
          if (!ok && typeof toast === "function") toast("Função indisponível neste momento", "warning");
        } catch (err) {
          console.error("[menu-accordion] action", a, err);
          if (typeof toast === "function") toast("Não foi possível abrir", "error");
        }
        return;
      }
    });

    // toggle acordeão — um aberto de cada vez
    root.addEventListener("click", function (e) {
      var tog = e.target.closest(".bp-acc-toggle");
      if (!tog || !root.contains(tog)) return;
      e.preventDefault();
      e.stopPropagation();
      var togKey = tog.getAttribute("data-acc-key") || "";
      if ((BP_MENU_AREAS_LOCKED && togKey !== "config") || tog.classList.contains("bp-acc-locked")) {
        if (typeof toast === "function") toast("Esta área está bloqueada por agora.", "info");
        return;
      }
      var key = tog.getAttribute("data-acc-key");
      var open = tog.getAttribute("aria-expanded") === "true";
      root.querySelectorAll(".bp-acc-toggle").forEach(function (t) {
        t.setAttribute("aria-expanded", "false");
      });
      root.querySelectorAll(".bp-acc-panel").forEach(function (p) {
        p.classList.remove("open");
        p.hidden = true;
      });
      if (!open) {
        tog.setAttribute("aria-expanded", "true");
        var panel = root.querySelector('[data-acc-panel="' + key + '"]');
        if (panel) {
          panel.hidden = false;
          panel.classList.add("open");
        }
        // garantir que o item expandido fica visível no scroll
        try {
          tog.scrollIntoView({ block: "nearest", behavior: "smooth" });
        } catch (err) {}
      }
    });
  }

  function ensureScrollable(dd) {
    dd.style.maxHeight = "min(70vh, 420px)";
    dd.style.overflowX = "hidden";
    dd.style.overflowY = "auto";
    dd.style.webkitOverflowScrolling = "touch";
  }

  function mount() {
    var dd = document.getElementById("menu-dropdown");
    if (!dd) return;
    ensureScrollable(dd);
    // limpar legados que módulos possam ter injectado
    if (!dd.querySelector(".bp-acc-root")) {
      stripLegacy(dd);
      buildAccordion(dd);
    } else {
      // se módulos injectaram irmãos fora do acordeão, remover
      Array.prototype.slice.call(dd.children).forEach(function (ch) {
        if (ch.id === "logout-btn") return;
        if (ch.classList && ch.classList.contains("bp-acc-root")) return;
        if (ch.hasAttribute && ch.hasAttribute("data-bp-menu")) ch.remove();
        if (ch.classList && ch.classList.contains("bp-menu-section")) ch.remove();
      });
    }
  }

  function init() {
    try {
      mount();
      try {
        document.dispatchEvent(new CustomEvent("bp-menu-accordion-ready"));
      } catch (_) {}
    } catch (e) { console.warn("[menu-accordion]", e); }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(init, 200);
    });
  } else setTimeout(init, 200);
  // depois dos módulos de features (que injectam a ~100–5000ms)
  setTimeout(init, 600);
  setTimeout(init, 1800);
  setTimeout(init, 4500);
})();

