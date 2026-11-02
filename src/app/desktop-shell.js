/* BelezaPro — extraído do app.bundle (B2 Desktop)
 * Carregar DEPOIS de app.bundle.js (depende de state, fmtKz, toast, DOM).
 * Não é ESM: IIFE com side-effect no boot (isDesktop gated).
 */
/**
 * Desktop shell (≥1024px)
 * - Remove top bar legada
 * - Sidebar: brand + módulos (8 grupos) + Sair
 * - Agenda master-detail
 * - Faixa de atenção no Resumo
 * Mobile permanece intacto.
 */
(function () {
  "use strict";

  // ---- Utils ----
  function isDesktop() {
    try {
      return !!(window.matchMedia && window.matchMedia("(min-width: 1024px)").matches);
    } catch (e) {
      return false;
    }
  }

  function esc(s) {
    if (typeof escHtml === "function") return escHtml(String(s == null ? "" : s));
    return String(s == null ? "" : s);
  }

  function money(v) {
    return typeof fmtKz === "function" ? fmtKz(v) : Math.round(Number(v) || 0) + " Kz";
  }

  function goTab(tab) {
    var btn = document.querySelector('.nav-item[data-tab="' + tab + '"]');
    if (btn) btn.click();
  }

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  // ---- Top bar (removida a pedido do produto) ----
  function removeLegacyTopbar() {
    var bar = qs(".bp-desk-topbar");
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
  }

  // ---- Sidebar brand ----
  function ensureSidebarBrand() {
    var nav = qs(".bottom-nav");
    if (!nav || qs(".bp-side-brand", nav)) return;

    var brand = document.createElement("div");
    brand.className = "bp-side-brand";
    brand.innerHTML =
      '<div class="bp-side-logo">BP</div>' +
      '<div class="bp-side-meta">' +
        '<span class="bp-side-name">BeautyPro</span>' +
        '<span class="bp-side-sub">Gestão</span>' +
      "</div>";
    nav.insertBefore(brand, nav.firstChild);
  }

  // ---- Central de Operações (sidebar desktop) ----
  function restoreMenuToHeader() {
    var side = document.getElementById("bp-side-modules");
    var logoutWrap = document.getElementById("bp-side-logout");
    var divider = document.getElementById("bp-side-ops-divider");
    var dd = document.getElementById("menu-dropdown");
    if (!dd) return;

    var host = qs(".header-actions div");
    var logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn && dd && !dd.contains(logoutBtn)) {
      dd.appendChild(logoutBtn);
    }
    if (side && host && !host.contains(dd)) {
      host.appendChild(dd);
      dd.style.cssText = "";
      dd.style.display = "none";
      dd.classList.remove("bp-side-menu-dd");
    }
    if (side) side.remove();
    if (logoutWrap) logoutWrap.remove();
    if (divider) divider.remove();
  }

  function styleDropdownAsSideMenu(dd) {
    dd.classList.add("bp-side-menu-dd");
    dd.style.display = "block";
    dd.style.position = "static";
    dd.style.minWidth = "0";
    dd.style.width = "100%";
    dd.style.boxShadow = "none";
    dd.style.border = "none";
    dd.style.background = "transparent";
    dd.style.padding = "0";
  }

  function setOpsOpen(wrap, open) {
    wrap.classList.toggle("is-open", open);
    var trigger = document.getElementById("bp-side-ops-trigger");
    var opsBody = document.getElementById("bp-side-ops-body");
    if (trigger) {
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
    }
    if (opsBody) {
      opsBody.hidden = !open;
    }
  }

  function ensureSideLogout(nav) {
    var logoutBtn = document.getElementById("logout-btn");
    if (!logoutBtn) return;

    var wrap = document.getElementById("bp-side-logout");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "bp-side-logout";
      wrap.className = "bp-side-logout";
    }
    if (!wrap.contains(logoutBtn)) wrap.appendChild(logoutBtn);
    if (!nav.contains(wrap)) {
      var toggle = document.getElementById("bp-side-toggle");
      if (toggle) nav.insertBefore(wrap, toggle);
      else nav.appendChild(wrap);
    }
  }

  function ensureSideModules() {
    if (!isDesktop()) {
      restoreMenuToHeader();
      return;
    }

    var nav = qs(".bottom-nav");
    var dd = document.getElementById("menu-dropdown");
    if (!nav || !dd) return;

    // Linha divisória estratégica (após tabs, incl. IA)
    var divider = document.getElementById("bp-side-ops-divider");
    if (!divider) {
      divider = document.createElement("div");
      divider.id = "bp-side-ops-divider";
      divider.className = "bp-side-ops-divider";
      divider.setAttribute("role", "separator");
      divider.setAttribute("aria-hidden", "true");
    }

    var wrap = document.getElementById("bp-side-modules");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "bp-side-modules";
      wrap.className = "bp-side-modules";
      wrap.innerHTML =
        '<button type="button" class="bp-side-ops-trigger" id="bp-side-ops-trigger" aria-expanded="false" aria-controls="bp-side-ops-body">' +
          '<span class="bp-side-ops-icon" aria-hidden="true">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
              '<rect x="3" y="3" width="7" height="7" rx="1"/>' +
              '<rect x="14" y="3" width="7" height="7" rx="1"/>' +
              '<rect x="3" y="14" width="7" height="7" rx="1"/>' +
              '<rect x="14" y="14" width="7" height="7" rx="1"/>' +
            "</svg>" +
          "</span>" +
          '<span class="bp-side-ops-text">' +
            '<span class="bp-side-ops-title">Central de Operações</span>' +
            '<span class="bp-side-ops-hint">Toque para abrir</span>' +
          "</span>" +
          '<span class="bp-side-ops-chevron" aria-hidden="true">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="9 6 15 12 9 18"/></svg>' +
          "</span>" +
        "</button>" +
        '<div class="bp-side-ops-body" id="bp-side-ops-body" hidden></div>';
    }

    // Ordem: …tabs → divider → Central → Sair → (toggle sidebar)
    var sideToggle = document.getElementById("bp-side-toggle");
    if (!nav.contains(divider)) {
      if (sideToggle) nav.insertBefore(divider, sideToggle);
      else nav.appendChild(divider);
    }
    if (!nav.contains(wrap)) {
      if (sideToggle) nav.insertBefore(wrap, sideToggle);
      else nav.appendChild(wrap);
    }

    var opsBody = document.getElementById("bp-side-ops-body");
    if (opsBody && !opsBody.contains(dd)) opsBody.appendChild(dd);
    styleDropdownAsSideMenu(dd);

    // Sair FORA da central (sempre visível)
    ensureSideLogout(nav);

    var trigger = document.getElementById("bp-side-ops-trigger");
    if (trigger && trigger.dataset.bound !== "1") {
      trigger.dataset.bound = "1";
      trigger.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var open = trigger.getAttribute("aria-expanded") !== "true";
        setOpsOpen(wrap, open);
      });
    }
  }

  // ---- Agenda master-detail ----
  function ensureAgendaWorkspace() {
    if (!isDesktop()) return;
    var list = document.getElementById("agenda-full-list");
    if (!list || list.closest(".bp-agenda-workspace")) return;

    var parent = list.parentNode;
    var workspace = document.createElement("div");
    workspace.className = "bp-agenda-workspace";

    var listCol = document.createElement("div");
    listCol.className = "bp-agenda-list-col";

    var detail = document.createElement("div");
    detail.className = "bp-agenda-detail is-empty";
    detail.id = "bp-agenda-detail";
    detail.innerHTML = "<p>Selecione um agendamento na lista.</p>";

    parent.insertBefore(workspace, list);
    listCol.appendChild(list);
    workspace.appendChild(listCol);
    workspace.appendChild(detail);
  }

  function statusLabelAg(ag) {
    var st = (ag && (ag.status || ag.estado)) || "";
    st = String(st).toLowerCase();
    if (st === "realizado") return "Realizado";
    if (st === "cancelado") return "Cancelado";
    if (st === "nao_realizado" || st === "nao-realizado") return "Não realizado";
    if (st === "agendado" || !st) return "Agendado";
    return st;
  }

  function findAgendamentoById(id) {
    if (!id || typeof state === "undefined") return null;
    var list = state.agendamentos || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].id) === String(id)) return list[i];
    }
    return null;
  }

  function buildAgendaDetailHtml(ag) {
    if (!ag) return "";
    var prof = "";
    try {
      if (typeof getProfissionalNome === "function") prof = getProfissionalNome(ag.profissional_id) || "";
    } catch (e) {}
    if (!prof) prof = ag.profissional || "—";
    var nota = ag.notas || ag.nota || ag.observacao || ag.obs || "";
    return (
      '<div class="bp-ad-time">' + esc(String(ag.hora || "").slice(0, 5)) + " · " + esc(ag.data || "") + "</div>" +
      '<div class="bp-ad-title">' + esc(ag.servico || "Agendamento") + "</div>" +
      '<div class="bp-ad-row"><span>Cliente</span><span>' + esc(ag.cliente || "—") + "</span></div>" +
      '<div class="bp-ad-row"><span>Profissional</span><span>' + esc(prof) + "</span></div>" +
      '<div class="bp-ad-row"><span>Estado</span><span>' + esc(statusLabelAg(ag)) + "</span></div>" +
      '<div class="bp-ad-row"><span>Valor</span><span>' + money(ag.preco != null ? ag.preco : ag.valor) + "</span></div>" +
      (nota
        ? '<div class="bp-ad-row bp-ad-nota"><span>Notas</span><span>' + esc(nota) + "</span></div>"
        : "") +
      '<p class="bp-ad-hint">Use os botões no cartão para finalizar, reagendar ou cancelar.</p>'
    );
  }

  function showAgendaDetail(ag) {
    var detail = document.getElementById("bp-agenda-detail");
    if (!detail || !ag) return;
    detail.classList.remove("is-empty");
    detail.innerHTML = buildAgendaDetailHtml(ag);
  }

  function ensureMobileAgendaSheet() {
    var el = document.getElementById("bp-ag-mobile-sheet");
    if (el) return el;
    el = document.createElement("div");
    el.id = "bp-ag-mobile-sheet";
    el.className = "bp-ag-mobile-sheet";
    el.hidden = true;
    el.innerHTML =
      '<div class="bp-ag-mobile-backdrop" data-ag-close="1"></div>' +
      '<div class="bp-ag-mobile-panel" role="dialog" aria-modal="true" aria-label="Detalhe do agendamento">' +
        '<div class="bp-ag-mobile-handle" aria-hidden="true"></div>' +
        '<div class="bp-ag-mobile-body" id="bp-ag-mobile-body"></div>' +
        '<button type="button" class="btn btn-secondary bp-ag-mobile-close" data-ag-close="1">Fechar</button>' +
      "</div>";
    document.body.appendChild(el);
    el.addEventListener("click", function (ev) {
      if (ev.target.closest("[data-ag-close]")) {
        el.hidden = true;
      }
    });
    return el;
  }

  function showAgendaDetailMobile(ag) {
    var sheet = ensureMobileAgendaSheet();
    var sheetBody = document.getElementById("bp-ag-mobile-body");
    if (!sheetBody || !ag) return;
    sheetBody.innerHTML = buildAgendaDetailHtml(ag);
    sheet.hidden = false;
  }

  /**
   * Cards: data-agenda-id.
   * Desktop → painel lateral; Mobile → sheet de detalhe.
   */
  function bindAgendaClicks() {
    if (document.body.dataset.bpAgDesk === "1") return;
    document.body.dataset.bpAgDesk = "1";

    document.addEventListener("click", function (e) {
      if (e.target.closest("button, a, input, select, label, [data-action]")) return;

      var card = e.target.closest(".bp-ag-card[data-agenda-id], .list-item[data-agenda-id]");
      if (!card) return;

      var inAgenda =
        card.closest("#agenda-full-list") ||
        card.closest("#agenda-today-list");
      if (!inAgenda) return;

      var id = card.getAttribute("data-agenda-id");
      var ag = findAgendamentoById(id);
      if (!ag) return;

      document.querySelectorAll(".bp-ag-card.is-selected").forEach(function (el) {
        el.classList.remove("is-selected");
      });
      card.classList.add("is-selected");

      if (isDesktop()) {
        ensureAgendaWorkspace();
        showAgendaDetail(ag);
      } else {
        showAgendaDetailMobile(ag);
      }
    });
  }

  // ---- Resumo: faixa de atenção ----
  function ensureDashAttention() {
    if (!isDesktop()) return;
    var pane = document.getElementById("tab-dashboard");
    if (!pane || qs(".bp-desk-attention", pane)) return;

    var strip = document.createElement("div");
    strip.className = "bp-desk-attention";
    strip.id = "bp-desk-attention";
    var inner = qs(".tab-inner", pane) || pane;
    inner.insertBefore(strip, inner.firstChild);
    refreshDashAttention();
  }

  function refreshDashAttention() {
    var strip = document.getElementById("bp-desk-attention");
    if (!strip || typeof state === "undefined") return;

    var hoje = typeof window.hoje === "function" ? window.hoje() : "";
    var ags = (state.agendamentos || []).filter(function (a) {
      return a && a.data === hoje;
    });
    var pend = ags.filter(function (a) {
      return a.status === "agendado" || !a.status;
    }).length;
    var vendas = (state.movimentos || []).filter(function (m) {
      return m && m.tipo === "venda" && m.data === hoje;
    });
    var rec = vendas.reduce(function (s, m) {
      return s + (Number(m.valor) || 0);
    }, 0);

    strip.innerHTML =
      '<div class="bp-att-card"><div class="bp-att-label">Agenda hoje</div><div class="bp-att-value">' + ags.length + "</div></div>" +
      '<div class="bp-att-card"><div class="bp-att-label">Por realizar</div><div class="bp-att-value' + (pend ? " is-alert" : "") + '">' + pend + "</div></div>" +
      '<div class="bp-att-card"><div class="bp-att-label">Receita hoje</div><div class="bp-att-value">' + money(rec) + "</div></div>";
  }

  // ---- Atalhos numéricos 1–5 (tabs) ----
  function bindKeys() {
    if (document.body.dataset.bpDeskKeys === "1") return;
    document.body.dataset.bpDeskKeys = "1";

    document.addEventListener("keydown", function (e) {
      if (!isDesktop()) return;
      var tag = (e.target && e.target.tagName) || "";
      var typing =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target && e.target.isContentEditable);
      if (typing) return;

      var map = { "1": "dashboard", "2": "agenda", "3": "clientes", "4": "caixa", "5": "equipa" };
      if (map[e.key]) goTab(map[e.key]);
    });
  }

  // ---- Ciclo de vida ----
  function mount() {
    if (!qs(".app-container")) return;
    removeLegacyTopbar();
    ensureSidebarBrand();
    ensureSideModules();
    ensureAgendaWorkspace();
    bindAgendaClicks();
    ensureDashAttention();
    bindKeys();
  }

  function init() {
    try {
      mount();
    } catch (e) {
      console.warn("[desktop-shell]", e);
    }
  }

  function scheduleInit() {
    init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(scheduleInit, 250);
    });
  } else {
    setTimeout(scheduleInit, 250);
  }
  // Menu acordeão pode montar depois
  setTimeout(scheduleInit, 1000);
  setTimeout(scheduleInit, 3000);
  document.addEventListener("bp-menu-accordion-ready", function () {
    try { ensureSideModules(); } catch (e) {}
  });

  window.addEventListener("resize", function () {
    removeLegacyTopbar();
    try {
      ensureSideModules();
    } catch (e) {}
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".nav-item[data-tab]")) return;
    setTimeout(function () {
      ensureAgendaWorkspace();
      bindAgendaClicks();
      try {
        ensureSideModules();
      } catch (err) {}
      if (qs('.nav-item[data-tab="dashboard"].active')) {
        ensureDashAttention();
        refreshDashAttention();
      }
    }, 120);
  });

  setInterval(function () {
    if (isDesktop() && qs("#tab-dashboard.active")) refreshDashAttention();
  }, 8000);

  window.BPDesktopShell = {
    mount: mount,
    showAgendaDetail: showAgendaDetail
  };
})();
