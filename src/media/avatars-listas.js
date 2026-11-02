/* BelezaPro B3 — extraído do monólito; carregar após app.bundle.js */

// ================================================================
// Avatars realistas nas listas Clientes + Equipa (pós-bundle)
// ================================================================
(function () {
  "use strict";

  function attrSafe(s) {
    if (s == null) return "";
    if (typeof escHtml === "function") return escHtml(s);
    return String(s).replace(/[&<>"']/g, function (m) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m];
    });
  }

  function srcFor(nome, foto, entity) {
    if (entity && window.BPMedia && typeof BPMedia.resolveFotoSrc === "function") {
      var r = BPMedia.resolveFotoSrc(entity);
      if (r) return r;
    }
    if (foto) return foto;
    if (entity && entity.foto_url) return entity.foto_url;
    if (window.BPAvatars && typeof BPAvatars.avatarDataUrl === "function") {
      return BPAvatars.avatarDataUrl(nome || "");
    }
    return null;
  }

  function isSafeImgSrc(src) {
    if (!src) return false;
    var low = String(src).trim().toLowerCase();
    return low.indexOf("http://") === 0 || low.indexOf("https://") === 0 ||
      low.indexOf("data:image/") === 0 || low.indexOf("blob:") === 0;
  }

  function fallbackAvatarSrc(nome) {
    if (window.BPAvatars && typeof BPAvatars.avatarDataUrl === "function") {
      try { return BPAvatars.avatarDataUrl(); } catch (_) {}
    }
    if (window.BPAvatars && BPAvatars.defaultSrc) return BPAvatars.defaultSrc;
    /* Silhueta neutra — nunca letra */
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<rect width="100" height="100" fill="#E8E6E1"/>' +
      '<circle cx="50" cy="38" r="20" fill="#B8B2A8"/>' +
      '<ellipse cx="50" cy="92" rx="38" ry="32" fill="#B8B2A8"/></svg>';
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function applyAvatar(av, nome, foto, entity) {
    if (!av) return;
    var id = entity && entity.id != null ? String(entity.id) : "";
    var src = srcFor(nome, foto, entity);
    if (!isSafeImgSrc(src)) src = fallbackAvatarSrc(nome);
    if (!isSafeImgSrc(src)) return;

    var img = av.querySelector("img");
    // Isolamento: só reutilizar DOM se for a MESMA entidade e o MESMO src
    if (id && av.getAttribute("data-avatar-entity") === id && img && img.getAttribute("src") === src) return;
    if (id) av.setAttribute("data-avatar-entity", id);
    else av.removeAttribute("data-avatar-entity");
    av.classList.add("bp-avatar-img");
    av.innerHTML = '<img src="' + attrSafe(src) + '" alt="" loading="lazy" decoding="async"' +
      (id ? ' data-avatar-entity="' + attrSafe(id) + '"' : "") + ">";
    img = av.querySelector("img");
    if (img) {
      img.onerror = function () {
        try {
          var fb = fallbackAvatarSrc(nome);
          if (fb && img.getAttribute("src") !== fb) img.setAttribute("src", fb);
          av.classList.add("bp-avatar-fallback");
        } catch (_) {}
      };
    }
  }

  function enhanceClientes() {
    try {
      document.querySelectorAll(".cliente-item[data-cliente-id]").forEach(function (row) {
        var id = row.getAttribute("data-cliente-id");
        var c = (state.clientes || []).find(function (x) { return x.id === id; });
        if (!c) return;
        applyAvatar(row.querySelector(".avatar"), c.nome, c.foto, c);
      });
    } catch (e) {}
  }

  function enhanceProfissionais() {
    try {
      document.querySelectorAll("[data-prof-id]").forEach(function (row) {
        var id = row.getAttribute("data-prof-id");
        if (!id || !window.state) return;
        var p = (state.profissionais || []).find(function (x) { return String(x.id) === String(id); });
        if (!p) return;
        var av = row.querySelector(".avatar, .bp-ag-avatar, .bp-avatar");
        applyAvatar(av, p.nome, p.foto, p);
      });
    } catch (e) {}
  }

  function enhanceAgendaClientes() {
    try {
      document.querySelectorAll("[data-cliente-id]").forEach(function (row) {
        var id = row.getAttribute("data-cliente-id");
        if (!id || !window.state) return;
        var c = (state.clientes || []).find(function (x) { return String(x.id) === String(id); });
        if (!c) return;
        var av = row.querySelector(".avatar, .bp-ag-avatar, .bp-avatar");
        applyAvatar(av, c.nome, c.foto, c);
      });
    } catch (e) {}
  }

  function enhanceAll() {
    enhanceClientes();
    enhanceProfissionais();
    enhanceAgendaClientes();
    syncModalAvatarFallback();
  }

  function wrapRender(name, enhancer) {
    try {
      var fn = window[name];
      if (typeof fn !== "function") {
        if (typeof globalThis[name] === "function") fn = globalThis[name];
      }
      if (typeof fn !== "function") return false;
      if (fn._bpAvatarWrapped) return true;
      /* F3.2 blindagem: se o dono marcou _bpOwner, NÃO roubar window[name] */
      if (fn._bpOwner) {
        try { console.info("[avatars] wrap recusado — ownership de", name, "em", fn._bpOwner); } catch (e) {}
        return false;
      }
      var wrapped = function () {
        var r = fn.apply(this, arguments);
        setTimeout(enhancer, 0);
        setTimeout(enhancer, 50);
        return r;
      };
      wrapped._bpAvatarWrapped = true;
      wrapped._bpOriginal = fn;
      window[name] = wrapped;
      try { globalThis[name] = wrapped; } catch (e) {}
      return true;
    } catch (e) {
      return false;
    }
  }

  function install() {
    /* F3.2 — ownership: NÃO reassign window.renderClientes / renderProfissionais.
       Regista hooks consumidos pelo módulo dono (modules/clientes). */
    var ok1 = false, ok2 = false;
    try {
      window.__bpAfterRenderClientes = window.__bpAfterRenderClientes || [];
      if (!window.__bpAfterRenderClientes._bpAvClientes) {
        window.__bpAfterRenderClientes.push(enhanceClientes);
        window.__bpAfterRenderClientes._bpAvClientes = true;
        ok1 = true;
      }
    } catch (e) {}
    try {
      window.__bpAfterRenderProfissionais = window.__bpAfterRenderProfissionais || [];
      if (!window.__bpAfterRenderProfissionais._bpAvProfs) {
        window.__bpAfterRenderProfissionais.push(enhanceProfissionais);
        window.__bpAfterRenderProfissionais._bpAvProfs = true;
        ok2 = true;
      }
    } catch (e) {}
    /* Fallback legado: se o dono ainda não expõe hooks, wrap uma vez apenas */
    try {
      if (!ok1 && typeof window.renderClientes === "function" && !window.renderClientes._bpAvatarWrapped && !window.renderClientes._bpOwner) {
        wrapRender("renderClientes", enhanceClientes);
      }
      if (!ok2 && typeof window.renderProfissionais === "function" && !window.renderProfissionais._bpAvatarWrapped && !window.renderProfissionais._bpOwner) {
        wrapRender("renderProfissionais", enhanceProfissionais);
      }
    } catch (e) {}
    enhanceAll();
    return ok1 || ok2;
  }

  function observe() {
    ["clientes-list", "profissionais-list"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.dataset.bpAvListObs) return;
      el.dataset.bpAvListObs = "1";
      var obs = new MutationObserver(function () {
        setTimeout(enhanceAll, 10);
      });
      obs.observe(el, { childList: true, subtree: true });
    });
  }

  function init() {
    install();
    observe();
    enhanceAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(init, 200);
    });
  } else {
    setTimeout(init, 200);
  }
  setTimeout(init, 800);
  setTimeout(init, 2000);
  setTimeout(init, 5000);

  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-tab], .nav-item, .tab-btn, #tab-clientes, #tab-equipa")) {
      setTimeout(enhanceAll, 100);
      setTimeout(enhanceAll, 300);
    }
  });

  // Fallback de avatar no modal: SÓ quando BPMedia não preencheu foto real.
  // Sem setInterval — evita race e vazamento visual entre registos.
  function syncModalAvatarFallback() {
    try {
      var cli = document.getElementById("modal-cliente");
      if (cli && cli.classList.contains("open")) {
        var prevC = document.getElementById("bp-cli-foto-preview");
        var hid = document.getElementById("cliente-id");
        var cid = hid && hid.value ? String(hid.value).trim() : "";
        var nomeC = (document.getElementById("cliente-nome") || {}).value;
        if (prevC && !prevC.classList.contains("has-img") && nomeC && window.BPAvatars) {
          // Não injectar se já há foto real no state
          var ent = cid && (state.clientes || []).find(function (x) { return String(x.id) === cid; });
          if (ent && window.BPMedia && BPMedia.resolveFotoSrc && BPMedia.resolveFotoSrc(ent)) return;
          var src = BPAvatars.avatarDataUrl(nomeC);
          prevC.setAttribute("data-foto-for", cid || "new");
          prevC.innerHTML = '<img src="' + attrSafe(src) + '" alt="" data-foto-for="' + attrSafe(cid || "new") + '">';
          prevC.classList.add("has-img", "bp-avatar-fallback");
        }
      }
      var pr = document.getElementById("modal-prof");
      if (pr && pr.classList.contains("open")) {
        var prevP = document.getElementById("bp-prof-foto-preview");
        var hidP = document.getElementById("prof-id");
        var pid = hidP && hidP.value ? String(hidP.value).trim() : "";
        var nomeP = (document.getElementById("prof-nome") || {}).value;
        if (prevP && !prevP.classList.contains("has-img") && nomeP && window.BPAvatars) {
          var entP = pid && (state.profissionais || []).find(function (x) { return String(x.id) === pid; });
          if (entP && window.BPMedia && BPMedia.resolveFotoSrc && BPMedia.resolveFotoSrc(entP)) return;
          var src2 = BPAvatars.avatarDataUrl(nomeP);
          prevP.setAttribute("data-foto-for", pid || "new");
          prevP.innerHTML = '<img src="' + attrSafe(src2) + '" alt="" data-foto-for="' + attrSafe(pid || "new") + '">';
          prevP.classList.add("has-img", "bp-avatar-fallback");
        }
      }
    } catch (e) {}
  }

  window.BPAvatarsListas = { enhanceAll: enhanceAll, install: install };
})();

