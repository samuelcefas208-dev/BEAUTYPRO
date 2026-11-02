/* BelezaPro B3 — extraído do monólito; carregar após app.bundle.js */

// ================================================================
// BeautyPro — Fotos de perfil + Galeria de serviços
// Compressão no dispositivo · gravação imediata · offline-first
// ================================================================
(function () {
  "use strict";

  var BP_FOTO_ACTIONS_CSS = true;
  (function injectFotoActionsCss() {
    if (document.getElementById("bp-foto-actions-css")) return;
    var s = document.createElement("style");
    s.id = "bp-foto-actions-css";
    s.textContent =
      ".bp-foto-actions{display:none;gap:12px;align-items:center;margin-top:8px;justify-content:flex-start;}" +
      ".bp-foto-actions .bp-foto-view,.bp-foto-actions .bp-foto-remove{" +
      "background:none;border:none;padding:0;min-height:36px;" +
      "font-family:var(--font-sans,system-ui,sans-serif);cursor:pointer;line-height:1.2;}" +
      ".bp-foto-actions .bp-foto-view{font-size:0.8125rem;font-weight:600;color:var(--text-primary,#1c1a18);}" +
      ".bp-foto-actions .bp-foto-remove{font-size:0.75rem;font-weight:600;color:#c0392b;}" +
      ".bp-foto-actions .bp-foto-view:active,.bp-foto-actions .bp-foto-remove:active{opacity:0.55;}";
    document.head.appendChild(s);
  })();


  /** Sessão de UI (efémera) — não poluir window._bp* nem BeautyStore. */
  var session = {
    editingClienteId: null,
    editingProfId: null,
    pendingClienteFoto: null,
    pendingProfFoto: null,
    pendingClienteScope: null,
    pendingProfScope: null
  };
  var _uploadToken = Object.create(null);
  var UPLOAD_MS = 12000;

  var GALERIA_KEY_BASE = "bp_galeria_v1";
  var MAX_GALERIA = 60;
  function galeriaStorageKey() {
    try {
      var sid = (state && state.config && state.config.salaoId) ? String(state.config.salaoId) : "";
      return sid ? (GALERIA_KEY_BASE + "_" + sid) : GALERIA_KEY_BASE;
    } catch (_) {
      return GALERIA_KEY_BASE;
    }
  }
  var AVATAR_MAX = 160;      // lista/modal: thumb leve
  var GALERIA_MAX = 720;     // upload original galeria
  var GALERIA_THUMB = 240;   // thumb local/galeria
  var JPEG_Q = 0.62;         // perfil
  var JPEG_Q_GAL = 0.72;

  function esc(s) {
    return typeof escHtml === "function" ? escHtml(String(s == null ? "" : s)) : String(s == null ? "" : s);
  }
  function uid() {
    return typeof uuid === "function" ? uuid() : "img" + Date.now() + Math.random().toString(16).slice(2, 8);
  }
  function hojeStr() {
    return typeof hoje === "function" ? hoje() : new Date().toISOString().slice(0, 10);
  }
  function toastMsg(m, t) {
    if (typeof toast === "function") toast(m, t || "success");
  }

  /* ---------- compressão rápida ---------- */
  /* ---------- compressão robusta (CSP-safe: data: + createImageBitmap; blob: opcional) ---------- */
  function encodeCanvas(imgLike, w, h, maxSide, quality) {
    var scale = 1;
    if (w > maxSide || h > maxSide) scale = maxSide / Math.max(w, h);
    var nw = Math.max(1, Math.round(w * scale));
    var nh = Math.max(1, Math.round(h * scale));
    var canvas = document.createElement("canvas");
    canvas.width = nw;
    canvas.height = nh;
    var ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(imgLike, 0, 0, nw, nh);
    var dataUrl = canvas.toDataURL("image/jpeg", quality || JPEG_Q);
    if (dataUrl.length > 240000) {
      dataUrl = canvas.toDataURL("image/jpeg", 0.55);
    }
    return dataUrl;
  }

  function compressFile(file, maxSide, quality) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error("Ficheiro inválido"));
        return;
      }
      // Aceitar image/*; type vazio (alguns Android) tenta na mesma
      var t = String(file.type || "");
      if (t && t.indexOf("image/") !== 0) {
        reject(new Error("Ficheiro inválido"));
        return;
      }

      function fail(msg) {
        reject(new Error(msg || "Não foi possível ler a imagem"));
      }

      // 1) createImageBitmap — não depende de blob: no <img>
      if (typeof createImageBitmap === "function") {
        createImageBitmap(file)
          .then(function (bmp) {
            try {
              var dataUrl = encodeCanvas(bmp, bmp.width, bmp.height, maxSide, quality);
              if (bmp.close) try { bmp.close(); } catch (_) {}
              resolve(dataUrl);
            } catch (e) {
              if (bmp.close) try { bmp.close(); } catch (_) {}
              // fallback abaixo
              compressViaFileReader(file, maxSide, quality).then(resolve, reject);
            }
          })
          .catch(function () {
            compressViaFileReader(file, maxSide, quality).then(resolve, reject);
          });
        return;
      }

      compressViaFileReader(file, maxSide, quality).then(resolve, reject);
    });
  }

  function compressViaFileReader(file, maxSide, quality) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () {
        // último recurso: blob URL (requer CSP img-src blob:)
        compressViaBlobUrl(file, maxSide, quality).then(resolve, reject);
      };
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          try {
            resolve(encodeCanvas(img, img.naturalWidth || img.width, img.naturalHeight || img.height, maxSide, quality));
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = function () {
          compressViaBlobUrl(file, maxSide, quality).then(resolve, reject);
        };
        img.src = reader.result; // data: — permitido pelo CSP
      };
      try {
        reader.readAsDataURL(file);
      } catch (e) {
        compressViaBlobUrl(file, maxSide, quality).then(resolve, reject);
      }
    });
  }

  function compressViaBlobUrl(file, maxSide, quality) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var dataUrl = encodeCanvas(img, img.naturalWidth || img.width, img.naturalHeight || img.height, maxSide, quality);
          URL.revokeObjectURL(url);
          resolve(dataUrl);
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Não foi possível ler a imagem"));
      };
      img.src = url;
    });
  }

  function dataUrlToBlob(dataUrl) {
    try {
      var parts = String(dataUrl).split(",");
      var mime = (parts[0].match(/:(.*?);/) || [])[1] || "image/jpeg";
      var bin = atob(parts[1] || "");
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    } catch (e) {
      return null;
    }
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        resolve({ url: null, error: "timeout" });
      }, ms || UPLOAD_MS);
      Promise.resolve(promise).then(
        function (v) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(v);
        },
        function (err) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve({ url: null, error: (err && err.message) ? String(err.message) : "network" });
        }
      );
    });
  }

  function classifyStorageError(err) {
    var s = String(err && err.message ? err.message : err || "").toLowerCase();
    if (!s || s === "timeout") return "timeout";
    if (s.indexOf("offline") >= 0) return "offline";
    if (s.indexOf("403") >= 0 || s.indexOf("unauthorized") >= 0 || s.indexOf("row-level security") >= 0 || s.indexOf("policy") >= 0 || s.indexOf("jwt") >= 0)
      return "forbidden";
    if (s.indexOf("401") >= 0 || s.indexOf("session") >= 0) return "auth";
    if (s.indexOf("bucket") >= 0 || s.indexOf("not found") >= 0) return "bucket";
    if (s.indexOf("network") >= 0 || s.indexOf("fetch") >= 0) return "network";
    return "upload";
  }

  function toastUploadOutcome(result, opts) {
    opts = opts || {};
    if (result && result.url) {
      if (opts.silentOk) return;
      toastMsg(opts.okMsg || "Foto sincronizada na cloud", "success");
      return;
    }
    var code = (result && result.error) ? classifyStorageError({ message: result.error }) : "upload";
    var map = {
      timeout: "Foto guardada neste dispositivo. Cloud: tempo esgotado — tente com melhor rede.",
      offline: "Foto guardada neste dispositivo. Sem internet para a cloud.",
      forbidden: "Foto local OK. Cloud recusou (permissões Storage / RLS). Verifique políticas do bucket fotos.",
      auth: "Foto local OK. Sessão expirada — volte a entrar para sincronizar.",
      bucket: "Foto local OK. Bucket «fotos» em falta ou inacessível no Supabase.",
      network: "Foto local OK. Falha de rede ao enviar para a cloud.",
      upload: "Foto local OK. Falha ao enviar para a cloud."
    };
    toastMsg(map[code] || map.upload, "warning");
  }

  /** Upload Storage. Devolve { url, error }. Offline / falha → url null + error. */
  async function uploadFotoStorage(kind, entityId, dataUrl) {
    if (!dataUrl || !entityId) return { url: null, error: "upload" };
    if (typeof navigator !== "undefined" && !navigator.onLine) return { url: null, error: "offline" };
    if (typeof supabaseClient === "undefined" || !supabaseClient) return { url: null, error: "bucket" };
    var salaoId = (typeof state !== "undefined" && state.config && state.config.salaoId) ? state.config.salaoId : null;
    if (!salaoId) return { url: null, error: "auth" };
    try {
      var blob = dataUrlToBlob(dataUrl);
      if (!blob) return { url: null, error: "upload" };
      var path = String(salaoId) + "/" + kind + "/" + String(entityId) + ".jpg";
      var res = await supabaseClient.storage.from("fotos").upload(path, blob, {
        contentType: "image/jpeg",
        upsert: true,
        cacheControl: "60"
      });
      if (res.error) {
        console.warn("[BPMedia] storage upload:", res.error.message || res.error);
        return { url: null, error: res.error.message || "upload" };
      }
      var pub = supabaseClient.storage.from("fotos").getPublicUrl(path);
      var u = (pub && pub.data && pub.data.publicUrl) ? pub.data.publicUrl : null;
      if (!u) return { url: null, error: "upload" };
      return { url: u, error: null };
    } catch (e) {
      console.warn("[BPMedia] storage:", e && e.message ? e.message : e);
      return { url: null, error: (e && e.message) ? String(e.message) : "network" };
    }
  }

  async function removeFotoStorage(kind, entityId) {
    if (!entityId) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (typeof supabaseClient === "undefined" || !supabaseClient) return;
    var salaoId = (typeof state !== "undefined" && state.config && state.config.salaoId) ? state.config.salaoId : null;
    if (!salaoId) return;
    try {
      var path = String(salaoId) + "/" + kind + "/" + String(entityId) + ".jpg";
      await supabaseClient.storage.from("fotos").remove([path]);
    } catch (e) {
      console.warn("[BPMedia] storage remove:", e && e.message ? e.message : e);
    }
  }

  /** Offline robusto: se só há foto_url, descarrega e guarda data: em entity.foto */
  async function ensureLocalFotoCache(kind, entityId) {
    try {
      if (!entityId || typeof navigator === "undefined" || !navigator.onLine) return false;
      var ent = kind === "clientes" ? getCliente(entityId) : getProf(entityId);
      if (!ent) return false;
      if (ent.foto && String(ent.foto).indexOf("data:") === 0) return true;
      if (!ent.foto_url) return false;
      var res = await fetch(ent.foto_url, { mode: "cors", credentials: "omit" });
      if (!res.ok) return false;
      var blob = await res.blob();
      if (!blob || blob.size < 32) return false;
      var dataUrl = await new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function () { resolve(fr.result); };
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
      if (!dataUrl || String(dataUrl).indexOf("data:") !== 0) return false;
      var patch = { foto: dataUrl, updated_at: new Date().toISOString() };
      if (kind === "clientes" && typeof updateCliente === "function") await updateCliente(entityId, patch);
      else if (kind === "profissionais" && typeof updateProfissional === "function") await updateProfissional(entityId, patch);
      else {
        Object.assign(ent, patch);
        if (typeof dbPut === "function") await dbPut(kind, ent);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function warmFotoCaches() {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    try {
      /* Mesmo fluxo clientes + profissionais: se só há foto_url, grava data: local para offline nítido. */
      var queue = [];
      (state.clientes || []).slice(0, 40).forEach(function (c) {
        if (c && c.id && c.foto_url && !(c.foto && String(c.foto).indexOf("data:") === 0)) {
          queue.push({ kind: "clientes", id: c.id });
        }
      });
      (state.profissionais || []).slice(0, 40).forEach(function (p) {
        if (p && p.id && p.foto_url && !(p.foto && String(p.foto).indexOf("data:") === 0)) {
          queue.push({ kind: "profissionais", id: p.id });
        }
      });
      var i = 0;
      function next() {
        if (i >= queue.length) return;
        var item = queue[i++];
        ensureLocalFotoCache(item.kind, item.id).finally(function () { setTimeout(next, 120); });
      }
      setTimeout(next, 1500);
    } catch (_) {}
  }
  if (typeof window !== "undefined") {
    window.addEventListener("online", function () { setTimeout(warmFotoCaches, 800); });
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(warmFotoCaches, 2500); });
    else setTimeout(warmFotoCaches, 2500);
  }

  /** Preferir cache local (data:) depois URL remota. */
  function resolveFotoSrc(entity) {
    if (!entity) return null;
    if (entity.foto && String(entity.foto).indexOf("data:") === 0) return entity.foto;
    if (entity.foto_url) return entity.foto_url;
    if (entity.foto) return entity.foto;
    return null;
  }

  function pickImage(accept) {
    return new Promise(function (resolve) {
      var input = document.createElement("input");
      input.type = "file";
      input.accept = accept || "image/*";
      // mobile: prefer camera optional via capture not forced
      input.style.display = "none";
      document.body.appendChild(input);
      input.onchange = function () {
        var f = input.files && input.files[0];
        input.remove();
        resolve(f || null);
      };
      input.oncancel = function () {
        input.remove();
        resolve(null);
      };
      input.click();
    });
  }

  /* ---------- storage entidades (local + Supabase Storage) ---------- */
  async function setClienteFoto(clienteId, dataUrl) {
    if (!clienteId) return false;
    var prev = (state.clientes || []).find(function (x) { return x.id === clienteId; });
    var patch = { foto: dataUrl || null, updated_at: new Date().toISOString() };
    if (!dataUrl) {
      patch.foto_url = null;
      _uploadToken["clientes:" + clienteId] = "cleared";
      removeFotoStorage("clientes", clienteId);
    } else {
      // Nova foto: anular URL antiga (evita cache CDN da mesma path .jpg)
      patch.foto_url = null;
    }
    if (typeof updateCliente === "function") {
      await updateCliente(clienteId, patch);
    } else {
      var c = (state.clientes || []).find(function (x) { return x.id === clienteId; });
      if (!c) return false;
      Object.assign(c, patch);
      if (typeof dbPut === "function") await dbPut("clientes", c);
    }
    if (dataUrl) scheduleFotoUpload("clientes", clienteId, dataUrl);
    return true;
  }
  async function setProfFoto(profId, dataUrl) {
    if (!profId) return false;
    var prev = (state.profissionais || []).find(function (x) { return x.id === profId; });
    var patch = { foto: dataUrl || null, updated_at: new Date().toISOString() };
    if (!dataUrl) {
      patch.foto_url = null;
      _uploadToken["profissionais:" + profId] = "cleared";
      removeFotoStorage("profissionais", profId);
    } else {
      patch.foto_url = null;
    }
    if (typeof updateProfissional === "function") {
      await updateProfissional(profId, patch);
    } else {
      var p = (state.profissionais || []).find(function (x) { return x.id === profId; });
      if (!p) return false;
      Object.assign(p, patch);
      if (typeof dbPut === "function") await dbPut("profissionais", p);
    }
    if (dataUrl) scheduleFotoUpload("profissionais", profId, dataUrl);
    return true;
  }

  function currentClienteId() {
    var el = document.getElementById("cliente-id");
    var v = el && el.value ? String(el.value).trim() : "";
    return v || session.editingClienteId || null;
  }
  function currentProfId() {
    var el = document.getElementById("prof-id");
    var v = el && el.value ? String(el.value).trim() : "";
    return v || session.editingProfId || null;
  }
  function clearClientePending() {
    session.pendingClienteFoto = null;
    session.pendingClienteScope = null;
  }
  function clearProfPending() {
    session.pendingProfFoto = null;
    session.pendingProfScope = null;
  }
  var FOTO_QUEUE_KEY = "bp_foto_upload_queue";

  function getFotoQueue() {
    try {
      var raw = localStorage.getItem(FOTO_QUEUE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }
  function saveFotoQueue(arr) {
    try { localStorage.setItem(FOTO_QUEUE_KEY, JSON.stringify(arr || [])); } catch (e) {
      console.warn("[BPMedia] foto queue save failed", e);
    }
  }
  function enqueueFotoUpload(kind, entityId, dataUrl) {
    if (!kind || !entityId || !dataUrl) return;
    var q = getFotoQueue().filter(function (x) {
      return !(x.kind === kind && x.entityId === entityId);
    });
    q.push({
      kind: kind,
      entityId: entityId,
      dataUrl: dataUrl,
      ts: Date.now(),
      attempts: 0
    });
    // ET4.6: sem teto rígido; se storage falhar, foto continua no entity.foto (data:)
    saveFotoQueue(q);
  }
  function removeFotoQueueItem(kind, entityId) {
    saveFotoQueue(getFotoQueue().filter(function (x) {
      return !(x.kind === kind && x.entityId === entityId);
    }));
  }

  /** Processa fila de fotos offline quando há rede — lotes de 3. */
  async function flushFotoUploadQueue() {
    if (!navigator.onLine) return;
    if (flushFotoUploadQueue._running) return;
    flushFotoUploadQueue._running = true;
    try {
      var q = getFotoQueue();
      if (!q.length) {
        // Também varrer entidades com foto data: ainda pendente
        try {
          (state.clientes || []).forEach(function (c) {
            if (c && c.id && c.foto && String(c.foto).indexOf("data:") === 0 && !c.foto_url) {
              enqueueFotoUpload("clientes", c.id, c.foto);
            }
          });
          (state.profissionais || []).forEach(function (p) {
            if (p && p.id && p.foto && String(p.foto).indexOf("data:") === 0 && !p.foto_url) {
              enqueueFotoUpload("profissionais", p.id, p.foto);
            }
          });
          q = getFotoQueue();
        } catch (_) {}
      }
      var batch = q.slice(0, 3);
      var rest = q.slice(3);
      for (var i = 0; i < batch.length; i++) {
        if (!navigator.onLine) {
          rest = batch.slice(i).concat(rest);
          break;
        }
        var item = batch[i];
        try {
          var result = await withTimeout(uploadFotoStorage(item.kind, item.entityId, item.dataUrl), UPLOAD_MS);
          var url = result && result.url ? result.url : null;
          if (!url) {
            item.attempts = (item.attempts || 0) + 1;
            if (item.attempts < 10) rest.push(item);
            continue;
          }
          var bustUrl = url + (url.indexOf("?") >= 0 ? "&" : "?") + "v=" + Date.now();
          /* Offline: manter data URL local como cache; foto_url para online */
        var patch = { foto_url: bustUrl, updated_at: new Date().toISOString() };
          if (item.kind === "clientes" && typeof updateCliente === "function") {
            await updateCliente(item.entityId, patch);
          } else if (item.kind === "profissionais" && typeof updateProfissional === "function") {
            await updateProfissional(item.entityId, patch);
          }
          try { patchRowAvatar(item.kind, item.entityId); } catch (_) {}
        } catch (e) {
          item.attempts = (item.attempts || 0) + 1;
          if (item.attempts < 10) rest.push(item);
        }
      }
      saveFotoQueue(rest);
    } finally {
      flushFotoUploadQueue._running = false;
    }
  }

  function scheduleFotoUpload(kind, entityId, dataUrl) {
    if (!entityId || !dataUrl) return;
    // Sempre enfileirar — garante offline e retry
    enqueueFotoUpload(kind, entityId, dataUrl);
    if (!navigator.onLine) return;
    var token = String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8);
    _uploadToken[kind + ":" + entityId] = token;
    withTimeout(uploadFotoStorage(kind, entityId, dataUrl), UPLOAD_MS).then(function (result) {
      if (_uploadToken[kind + ":" + entityId] !== token) return;
      var url = result && result.url ? result.url : null;
      if (!url) {
        toastUploadOutcome(result || { url: null, error: "upload" }, { silentOk: true });
        return;
      }
      removeFotoQueueItem(kind, entityId);
      // Cache-bust: mesmo path .jpg no Storage mantém URL pública — forçar ?v=
      var bustUrl = url + (url.indexOf("?") >= 0 ? "&" : "?") + "v=" + Date.now();
      /* Offline: manter data URL local como cache; foto_url para online */
        var patch = { foto_url: bustUrl, updated_at: new Date().toISOString() };
      if (kind === "clientes") {
        var c = (state.clientes || []).find(function (x) { return x.id === entityId; });
        // Só cancelar se o utilizador já escolheu OUTRA foto mais recente
        if (c && c.foto && c.foto !== dataUrl && String(c.foto).indexOf("data:") === 0) return;
        if (typeof updateCliente === "function") updateCliente(entityId, patch);
        else if (c) { Object.assign(c, patch); if (typeof dbPut === "function") dbPut("clientes", c); }
        patchRowAvatar("clientes", entityId);
        showPreview("bp-cli-foto-preview", bustUrl, entityId);
      } else if (kind === "profissionais") {
        var p = (state.profissionais || []).find(function (x) { return x.id === entityId; });
        if (p && p.foto && p.foto !== dataUrl && String(p.foto).indexOf("data:") === 0) return;
        if (typeof updateProfissional === "function") updateProfissional(entityId, patch);
        else if (p) { Object.assign(p, patch); if (typeof dbPut === "function") dbPut("profissionais", p); }
        patchRowAvatar("profissionais", entityId);
        showPreview("bp-prof-foto-preview", bustUrl, entityId);
      }
      // Silencioso no sucesso cloud: UI já mostrou "Foto actualizada" no local
    });
  }

  /** Actualiza só a linha da lista (evita renderClientes/Profissionais completo). */
  function fallbackAvatarSrcMedia(nome) {
    if (window.BPAvatars && typeof BPAvatars.avatarDataUrl === "function") {
      try { return BPAvatars.avatarDataUrl(); } catch (_) {}
    }
    if (window.BPAvatars && BPAvatars.defaultSrc) return BPAvatars.defaultSrc;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#E8E6E1"/><circle cx="50" cy="38" r="20" fill="#B8B2A8"/><ellipse cx="50" cy="92" rx="38" ry="32" fill="#B8B2A8"/></svg>';
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function patchRowAvatar(kind, entityId) {
    if (!entityId) return;
    try {
      var _qid = String(entityId == null ? "" : entityId).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      var nodes = kind === "clientes"
        ? document.querySelectorAll('[data-cliente-id="' + _qid + '"]')
        : document.querySelectorAll('[data-prof-id="' + _qid + '"]');
      var ent = kind === "clientes" ? getCliente(entityId) : getProf(entityId);
      if (!ent) return;
      var src = resolveFotoSrc(ent) || fallbackAvatarSrcMedia(ent.nome);
      if (!src) src = fallbackAvatarSrcMedia(ent.nome);
      var displaySrc = src;
      if (displaySrc && (displaySrc.indexOf("http://") === 0 || displaySrc.indexOf("https://") === 0) && displaySrc.indexOf("?v=") < 0 && displaySrc.indexOf("&v=") < 0) {
        displaySrc = displaySrc + (displaySrc.indexOf("?") >= 0 ? "&" : "?") + "v=" + Date.now();
      }
      var safe = String(displaySrc).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
      var fb = fallbackAvatarSrcMedia(ent.nome);
      nodes.forEach(function (row) {
        var av = row.querySelector(".avatar, .bp-ag-avatar, .bp-avatar");
        if (!av) return;
        av.setAttribute("data-avatar-entity", String(entityId));
        av.classList.add("bp-avatar-img", "bp-avatar-done");
        av.innerHTML = '<img src="' + safe + '" alt="" loading="lazy" decoding="async" data-avatar-entity="' + bpGalEscAttr(entityId) + '">';
        var img = av.querySelector("img");
        if (img) {
          img.onerror = function () {
            try {
              if (fb && img.getAttribute("src") !== fb) img.setAttribute("src", fb);
              av.classList.add("bp-avatar-fallback");
            } catch (_) {}
          };
        }
      });
    } catch (e) {}
  }

  function getCliente(id) {
    return (state.clientes || []).find(function (c) { return c.id === id; });
  }
  function getProf(id) {
    return (state.profissionais || []).find(function (p) { return p.id === id; });
  }

  /* ---------- galeria ---------- */
  function loadGaleria() {
    try {
      var raw = localStorage.getItem(galeriaStorageKey());
      var list = raw ? JSON.parse(raw) : [];
      // Migração: chave antiga sem salao_id
      if ((!list || !list.length) && galeriaStorageKey() !== GALERIA_KEY_BASE) {
        try {
          var legacy = localStorage.getItem(GALERIA_KEY_BASE);
          if (legacy) {
            list = JSON.parse(legacy);
            if (Array.isArray(list) && list.length) saveGaleria(list);
          }
        } catch (_) {}
      }
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function saveGaleria(list) {
    try {
      var slim = (list || []).slice(-MAX_GALERIA).map(function (f) {
        var o = {
          id: f.id,
          profissional_id: f.profissional_id,
          profissional_nome: f.profissional_nome || "",
          caption: f.caption || "",
          data: f.data || "",
          ts: f.ts || "",
          url: f.url || null,
          thumb: f.thumb || null,
          updated_at: f.updated_at || f.ts || new Date().toISOString()
        };
        if (o.url && o.thumb && String(o.thumb).indexOf("data:") === 0) {
          o.thumb = o.url;
        }
        return o;
      });
      localStorage.setItem(galeriaStorageKey(), JSON.stringify(slim));
      return true;
    } catch (e) {
      toastMsg("Armazenamento cheio — remova fotos antigas", "error");
      return false;
    }
  }
  function addFotoGaleria(entry) {
    var list = loadGaleria();
    list.push(entry);
    if (!saveGaleria(list)) return null;
    return entry;
  }
  function removeFotoGaleria(id) {
    var list = loadGaleria().filter(function (x) { return x.id !== id; });
    saveGaleria(list);
  }
  function galeriaPorProf(profId) {
    return loadGaleria().filter(function (x) { return x.profissional_id === profId; }).reverse();
  }

  /** Push metadados da galeria para Supabase (tabela galeria_fotos). */
  async function upsertGaleriaRemoto(entry) {
    if (!entry || !entry.id) return false;
    if (typeof navigator !== "undefined" && !navigator.onLine) return false;
    if (typeof SUPABASE_URL === "undefined" || !SUPABASE_URL) return false;
    var salaoId = (state && state.config && state.config.salaoId) ? state.config.salaoId : null;
    if (!salaoId) return false;
    try {
      var authHeaders = typeof getAuthHeaders === "function" ? await getAuthHeaders() : null;
      if (!authHeaders) return false;
      var body = {
        id: entry.id,
        salao_id: salaoId,
        profissional_id: entry.profissional_id || null,
        profissional_nome: entry.profissional_nome || null,
        caption: entry.caption || null,
        data: entry.data || null,
        url: entry.url || null,
        ts: entry.ts || new Date().toISOString(),
        updated_at: entry.updated_at || new Date().toISOString()
      };
      var resp = await fetch(SUPABASE_URL + "/rest/v1/galeria_fotos", {
        method: "POST",
        headers: Object.assign({
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates"
        }, authHeaders),
        body: JSON.stringify(body)
      });
      if (!resp.ok) {
        var txt = "";
        try { txt = await resp.text(); } catch (_) {}
        console.warn("[BPMedia] galeria upsert", resp.status, txt);
        return false;
      }
      return true;
    } catch (e) {
      console.warn("[BPMedia] galeria upsert", e);
      return false;
    }
  }

  async function deleteGaleriaRemoto(id) {
    if (!id) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (typeof SUPABASE_URL === "undefined" || !SUPABASE_URL) return;
    var salaoId = (state && state.config && state.config.salaoId) ? state.config.salaoId : null;
    if (!salaoId) return;
    try {
      var authHeaders = typeof getAuthHeaders === "function" ? await getAuthHeaders() : null;
      if (!authHeaders) return;
      await fetch(
        SUPABASE_URL + "/rest/v1/galeria_fotos?id=eq." + encodeURIComponent(id) +
          "&salao_id=eq." + encodeURIComponent(salaoId),
        { method: "DELETE", headers: authHeaders }
      );
    } catch (e) {
      console.warn("[BPMedia] galeria delete remoto", e);
    }
  }

  /** Pull galeria do Supabase e funde com local (remoto com URL ganha). */
  async function pullGaleriaRemoto() {
    if (typeof navigator !== "undefined" && !navigator.onLine) return loadGaleria();
    if (typeof SUPABASE_URL === "undefined" || !SUPABASE_URL) return loadGaleria();
    var salaoId = (state && state.config && state.config.salaoId) ? state.config.salaoId : null;
    if (!salaoId) return loadGaleria();
    try {
      var authHeaders = typeof getAuthHeaders === "function" ? await getAuthHeaders() : null;
      if (!authHeaders) return loadGaleria();
      var resp = await fetch(
        SUPABASE_URL + "/rest/v1/galeria_fotos?salao_id=eq." + encodeURIComponent(salaoId) +
          "&select=*&order=ts.desc",
        { headers: authHeaders }
      );
      if (!resp.ok) {
        // tabela pode não existir ainda
        if (resp.status === 404 || resp.status === 406) {
          console.warn("[BPMedia] tabela galeria_fotos ausente — execute SUPABASE_GALERIA.sql");
        }
        return loadGaleria();
      }
      var rows = await resp.json();
      if (!Array.isArray(rows)) return loadGaleria();
      var local = loadGaleria();
      var map = Object.create(null);
      local.forEach(function (f) {
        if (f && f.id) map[f.id] = f;
      });
      rows.forEach(function (r) {
        if (!r || !r.id) return;
        var prev = map[r.id];
        // Preferir URL remota; manter thumb local se ainda não há url
        map[r.id] = {
          id: r.id,
          profissional_id: r.profissional_id,
          profissional_nome: r.profissional_nome || (prev && prev.profissional_nome) || "",
          caption: r.caption || (prev && prev.caption) || "",
          data: r.data || (prev && prev.data) || "",
          ts: r.ts || (prev && prev.ts) || "",
          url: r.url || (prev && prev.url) || null,
          thumb: (r.url || (prev && prev.thumb) || (prev && prev.url) || null),
          updated_at: r.updated_at || r.ts || (prev && prev.updated_at) || ""
        };
      });
      // Locais só data: sem url e sem remoto → manter (pendente upload)
      var merged = Object.keys(map).map(function (k) { return map[k]; });
      merged.sort(function (a, b) {
        return String(b.ts || "").localeCompare(String(a.ts || ""));
      });
      saveGaleria(merged);
      return merged;
    } catch (e) {
      console.warn("[BPMedia] pull galeria", e);
      return loadGaleria();
    }
  }

  /** Lista ficheiros no Storage se a tabela ainda não existir (contingência). */
  async function pullGaleriaFromStorage() {
    if (typeof supabaseClient === "undefined" || !supabaseClient) return;
    var salaoId = (state && state.config && state.config.salaoId) ? state.config.salaoId : null;
    if (!salaoId) return;
    try {
      var prefix = String(salaoId) + "/galeria";
      var res = await supabaseClient.storage.from("fotos").list("galeria", { limit: 100 });
      // path real: salaoId/galeria/profId/file — list hierarchical
      var profFolders = await supabaseClient.storage.from("fotos").list(String(salaoId) + "/galeria", { limit: 50 });
      if (profFolders.error || !profFolders.data) return;
      var local = loadGaleria();
      var byId = Object.create(null);
      local.forEach(function (f) { if (f && f.id) byId[f.id] = f; });
      for (var i = 0; i < profFolders.data.length; i++) {
        var folder = profFolders.data[i];
        if (!folder || !folder.name) continue;
        var files = await supabaseClient.storage.from("fotos").list(String(salaoId) + "/galeria/" + folder.name, { limit: 40 });
        if (files.error || !files.data) continue;
        files.data.forEach(function (file) {
          if (!file || !file.name || file.name === ".emptyFolderPlaceholder") return;
          var id = file.name.replace(/\.jpg$/i, "").replace(/\.jpeg$/i, "").replace(/\.webp$/i, "");
          if (byId[id] && byId[id].url) return;
          var path = String(salaoId) + "/galeria/" + folder.name + "/" + file.name;
          var pub = supabaseClient.storage.from("fotos").getPublicUrl(path);
          var u = pub && pub.data && pub.data.publicUrl ? pub.data.publicUrl : null;
          if (!u) return;
          byId[id] = {
            id: id,
            profissional_id: folder.name,
            profissional_nome: "",
            caption: "",
            data: "",
            ts: file.updated_at || file.created_at || new Date().toISOString(),
            url: u,
            thumb: u,
            updated_at: file.updated_at || ""
          };
        });
      }
      var merged = Object.keys(byId).map(function (k) { return byId[k]; });
      if (merged.length) saveGaleria(merged);
    } catch (e) {
      console.warn("[BPMedia] storage list galeria", e);
    }
  }

  async function syncGaleriaFull() {
    await pullGaleriaRemoto();
    // Contingência se tabela vazia mas há ficheiros
    var cur = loadGaleria();
    var hasUrl = cur.some(function (f) { return f && f.url; });
    if (!hasUrl) await pullGaleriaFromStorage();
    return loadGaleria();
  }

  /* ---------- UI avatar helpers ---------- */
  function avatarHtml(foto, nome, sizeClass) {
    var src = null;
    if (foto) {
      var s = String(foto);
      var ok = /^(https?:|data:image\/)/i.test(s.trim()) || s.indexOf("blob:") === 0;
      if (ok) src = s;
    }
    if (!src && window.BPAvatars && typeof BPAvatars.avatarDataUrl === "function") {
      try { src = BPAvatars.avatarDataUrl(); } catch (_) {}
    }
    if (!src && window.BPAvatars && BPAvatars.defaultSrc) src = BPAvatars.defaultSrc;
    if (!src) src = fallbackAvatarSrcMedia(nome);
    var safe = bpGalEscAttr(src);
    return '<div class="avatar bp-avatar-img ' + (sizeClass || "") + '"><img src="' + safe + '" alt="" loading="lazy" decoding="async"></div>';
  }

  function enhanceListAvatars() {
    try {
      document.querySelectorAll(".cliente-item[data-cliente-id]").forEach(function (row) {
        var id = row.getAttribute("data-cliente-id");
        var c = getCliente(id);
        if (!c) return;
        var av = row.querySelector(".avatar");
        if (!av) return;
        var src = resolveFotoSrc(c) || (window.BPAvatars && BPAvatars.avatarDataUrl());
        if (!src) return;
        var img = av.querySelector("img");
        var same = av.getAttribute("data-avatar-entity") === id && img && img.getAttribute("src") === src;
        if (same) return;
        av.setAttribute("data-avatar-entity", id);
        av.classList.add("bp-avatar-img", "bp-avatar-done");
        var _okSrc = /^(https?:|data:image\/)/i.test(String(src).trim()) || String(src).indexOf("blob:") === 0;
        if (!_okSrc) return;
        av.innerHTML = '<img src="' + bpGalEscAttr(src) + '" alt="" loading="lazy" decoding="async" data-avatar-entity="' + bpGalEscAttr(id) + '">';
      });
      document.querySelectorAll(".list-item[data-prof-id]").forEach(function (row) {
        var id = row.getAttribute("data-prof-id");
        var p = getProf(id);
        if (!p) return;
        var av = row.querySelector(".avatar");
        if (!av) return;
        var src = resolveFotoSrc(p) || (window.BPAvatars && BPAvatars.avatarDataUrl());
        if (!src) return;
        var img = av.querySelector("img");
        var same = av.getAttribute("data-avatar-entity") === id && img && img.getAttribute("src") === src;
        if (same) return;
        av.setAttribute("data-avatar-entity", id);
        av.classList.add("bp-avatar-img", "bp-avatar-done");
        var _okSrc = /^(https?:|data:image\/)/i.test(String(src).trim()) || String(src).indexOf("blob:") === 0;
        if (!_okSrc) return;
        av.innerHTML = '<img src="' + bpGalEscAttr(src) + '" alt="" loading="lazy" decoding="async" data-avatar-entity="' + bpGalEscAttr(id) + '">';
      });
    } catch (e) {}
  }

  function ensureClientePhotoUI() {
    var modal = document.getElementById("modal-cliente");
    if (!modal || modal.querySelector("#bp-cli-foto-wrap")) return;
    var title = modal.querySelector(".modal-title") || modal.querySelector("#cliente-modal-title");
    if (!title) return;
    var wrap = document.createElement("div");
    wrap.id = "bp-cli-foto-wrap";
    wrap.className = "bp-foto-wrap";
    wrap.innerHTML =
      '<button type="button" class="bp-foto-btn" id="bp-cli-foto-btn" aria-label="Foto do cliente">' +
        '<div class="bp-foto-preview" id="bp-cli-foto-preview"><span>Foto</span></div>' +
        '<span class="bp-foto-hint">Toque para adicionar ou alterar</span>' +
      "</button>" +
      '<div class="bp-foto-actions" id="bp-cli-foto-actions" style="display:none">' +
        '<button type="button" class="bp-foto-view" id="bp-cli-foto-view">Visualizar</button>' +
        '<button type="button" class="bp-foto-remove" id="bp-cli-foto-rm">Remover</button>' +
      "</div>";
    title.parentNode.insertBefore(wrap, title.nextSibling);

    document.getElementById("bp-cli-foto-btn").onclick = async function () {
      var id = currentClienteId();
      var file = await pickImage();
      if (!file) return;
      try {
        toastMsg("A processar foto…", "success");
        var dataUrl = await compressFile(file, AVATAR_MAX, JPEG_Q);
        // Isolamento: após await, só aplicar se o modal ainda for o mesmo registo
        if (!stillClienteContext(id)) {
          // Dados: se tinha id, gravar na entidade correcta na mesma (sem tocar no preview alheio)
          if (id) {
            clearClientePending();
            await setClienteFoto(id, dataUrl);
            patchRowAvatar("clientes", id);
            toastMsg("Foto guardada no cliente correcto", "success");
          }
          return;
        }
        if (!id) {
          session.pendingClienteFoto = dataUrl;
          session.pendingClienteScope = "new";
          showPreview("bp-cli-foto-preview", dataUrl, "new");
          var _ca = document.getElementById("bp-cli-foto-actions"); if (_ca) _ca.style.display = "flex";
          toastMsg("Foto pronta — guarde o cliente", "success");
          return;
        }
        clearClientePending();
        await setClienteFoto(id, dataUrl);
        if (!stillClienteContext(id)) return;
        showPreview("bp-cli-foto-preview", dataUrl, id);
        var _ca = document.getElementById("bp-cli-foto-actions"); if (_ca) _ca.style.display = "flex";
        enhanceListAvatars();
        toastMsg("Foto actualizada", "success");
        patchRowAvatar("clientes", id);
      } catch (e) {
        console.warn(e);
        toastMsg("Não foi possível processar a imagem.", "error");
      }
    };
        document.getElementById("bp-cli-foto-rm").onclick = async function () {
      var id = currentClienteId();
      clearClientePending();
      if (id) await setClienteFoto(id, null);
      if (stillClienteContext(id)) {
        showPreview("bp-cli-foto-preview", null, id || "new");
        var act = document.getElementById("bp-cli-foto-actions");
        if (act) act.style.display = "none";
      }
      toastMsg("Foto removida.", "success");
      patchRowAvatar("clientes", id);
    };
    var cliView = document.getElementById("bp-cli-foto-view");
    if (cliView) {
      cliView.onclick = function () {
        var id = currentClienteId();
        var c = id ? getCliente(id) : null;
        var src = (c && resolveFotoSrc(c)) || session.pendingClienteFoto || null;
        if (!src) {
          var prev = document.querySelector("#bp-cli-foto-preview img");
          if (prev) src = prev.getAttribute("src");
        }
        if (src) openFotoViewer(src, (c && c.nome) || "Cliente");
        else toastMsg("Sem fotografia para visualizar.", "info");
      };
    };
  }

  function ensureProfPhotoUI() {
    var modal = document.getElementById("modal-prof");
    if (!modal || modal.querySelector("#bp-prof-foto-wrap")) return;
    var title = modal.querySelector(".modal-title") || modal.querySelector("#prof-modal-title");
    if (!title) return;
    var wrap = document.createElement("div");
    wrap.id = "bp-prof-foto-wrap";
    wrap.className = "bp-foto-wrap";
    wrap.innerHTML =
      '<button type="button" class="bp-foto-btn" id="bp-prof-foto-btn" aria-label="Foto do profissional">' +
        '<div class="bp-foto-preview" id="bp-prof-foto-preview"><span>Foto</span></div>' +
        '<span class="bp-foto-hint">Toque para adicionar ou alterar</span>' +
      "</button>" +
      '<div class="bp-foto-actions" id="bp-prof-foto-actions" style="display:none">' +
        '<button type="button" class="bp-foto-view" id="bp-prof-foto-view">Visualizar</button>' +
        '<button type="button" class="bp-foto-remove" id="bp-prof-foto-rm">Remover</button>' +
      "</div>";
    title.parentNode.insertBefore(wrap, title.nextSibling);

    document.getElementById("bp-prof-foto-btn").onclick = async function () {
      var id = currentProfId();
      var file = await pickImage();
      if (!file) return;
      try {
        toastMsg("A processar foto…", "success");
        var dataUrl = await compressFile(file, AVATAR_MAX, JPEG_Q);
        if (!stillProfContext(id)) {
          if (id) {
            clearProfPending();
            await setProfFoto(id, dataUrl);
            patchRowAvatar("profissionais", id);
            toastMsg("Foto guardada no profissional correcto", "success");
          }
          return;
        }
        if (!id) {
          session.pendingProfFoto = dataUrl;
          session.pendingProfScope = "new";
          showPreview("bp-prof-foto-preview", dataUrl, "new");
          var _pa = document.getElementById("bp-prof-foto-actions"); if (_pa) _pa.style.display = "flex";
          toastMsg("Foto pronta — guarde o profissional", "success");
          return;
        }
        clearProfPending();
        await setProfFoto(id, dataUrl);
        if (!stillProfContext(id)) return;
        showPreview("bp-prof-foto-preview", dataUrl, id);
        var _pa = document.getElementById("bp-prof-foto-actions"); if (_pa) _pa.style.display = "flex";
        enhanceListAvatars();
        toastMsg("Foto actualizada", "success");
        patchRowAvatar("profissionais", id);
      } catch (e) {
        console.warn(e);
        toastMsg("Não foi possível processar a imagem.", "error");
      }
    };
        document.getElementById("bp-prof-foto-rm").onclick = async function () {
      var id = currentProfId();
      clearProfPending();
      if (id) await setProfFoto(id, null);
      if (stillProfContext(id)) {
        showPreview("bp-prof-foto-preview", null, id || "new");
        var act2 = document.getElementById("bp-prof-foto-actions");
        if (act2) act2.style.display = "none";
      }
      toastMsg("Foto removida.", "success");
      patchRowAvatar("profissionais", id);
    };
    var profView = document.getElementById("bp-prof-foto-view");
    if (profView) {
      profView.onclick = function () {
        var id = currentProfId();
        var pr = id ? getProf(id) : null;
        var src = (pr && resolveFotoSrc(pr)) || session.pendingProfFoto || null;
        if (!src) {
          var prev = document.querySelector("#bp-prof-foto-preview img");
          if (prev) src = prev.getAttribute("src");
        }
        if (src) openFotoViewer(src, (pr && pr.nome) || "Profissional");
        else toastMsg("Sem fotografia para visualizar.", "info");
      };
    };
  }

  
  /** Visualizar foto em ecrã discreto (não altera a foto). */
  function openFotoViewer(src, titulo) {
    if (!src) return;
    var existing = document.getElementById("bp-foto-viewer");
    if (existing) existing.remove();
    var ov = document.createElement("div");
    ov.id = "bp-foto-viewer";
    ov.className = "modal-overlay open";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.style.cssText = "display:flex;align-items:center;justify-content:center;z-index:10070;background:rgba(28,26,24,.55);";
    var safeSrc = String(src).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    ov.innerHTML =
      '<div class="modal-confirm-sheet" style="max-width:340px;width:calc(100% - 32px);padding:16px;text-align:center;">' +
        '<p style="margin:0 0 12px;font-size:0.8125rem;font-weight:600;color:var(--text-primary,#1c1a18);">' +
          esc(titulo || "Fotografia") +
        "</p>" +
        '<img src="' + safeSrc + '" alt="" style="max-width:100%;max-height:70vh;border-radius:12px;object-fit:cover;background:#EDE9E3;">' +
        '<div style="margin-top:14px;display:flex;justify-content:flex-end;">' +
          '<button type="button" class="bp-foto-view-close" style="background:none;border:none;font-weight:600;font-size:0.875rem;color:var(--text-primary);cursor:pointer;min-height:44px;padding:8px;">Fechar</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(ov);
    function close() {
      try { ov.remove(); } catch (_) {}
    }
    ov.addEventListener("click", function (e) {
      if (e.target === ov || (e.target && e.target.classList && e.target.classList.contains("bp-foto-view-close"))) close();
    });
  }

function showPreview(id, dataUrl, entityKey) {
    var el = document.getElementById(id);
    if (!el) return;
    var key = entityKey == null ? "" : String(entityKey);
    var bound = el.getAttribute("data-foto-for") || "";
    var actionsId = null;
    if (id === "bp-cli-foto-preview") actionsId = "bp-cli-foto-actions";
    if (id === "bp-prof-foto-preview") actionsId = "bp-prof-foto-actions";
    var actions = actionsId ? document.getElementById(actionsId) : null;
    if (dataUrl) {
      el.setAttribute("data-foto-for", key || bound || "");
      var _du = String(dataUrl || "");
      var _duOk = _du.indexOf("data:image/") === 0 || _du.indexOf("blob:") === 0 || /^https?:/i.test(_du.trim());
      if (!_duOk) {
        el.innerHTML = "<span>Foto</span>";
        el.classList.remove("has-img");
        if (actions) actions.style.display = "none";
        return;
      }
      el.innerHTML = '<img src="' + bpGalEscAttr(_du) + '" alt="" data-foto-for="' + bpGalEscAttr(key || "") + '">';
      el.classList.add("has-img");
      el.classList.remove("bp-avatar-fallback");
      if (actions) actions.style.display = "flex";
    } else {
      el.setAttribute("data-foto-for", key || "");
      el.innerHTML = "<span>Foto</span>";
      el.classList.remove("has-img");
      el.classList.remove("bp-avatar-fallback");
      if (actions) actions.style.display = "none";
    }
  }

  /** true se o modal ainda mostra a mesma entidade (evita leak após await). */
  function stillClienteContext(expectedId) {
    var modal = document.getElementById("modal-cliente");
    if (!modal || !modal.classList.contains("open")) return false;
    var cur = currentClienteId();
    if (!expectedId) return !cur; // novo cliente
    return String(cur) === String(expectedId);
  }
  function stillProfContext(expectedId) {
    var modal = document.getElementById("modal-prof");
    if (!modal || !modal.classList.contains("open")) return false;
    var cur = currentProfId();
    if (!expectedId) return !cur;
    return String(cur) === String(expectedId);
  }

  function syncModalPreviews() {
    ensureClientePhotoUI();
    ensureProfPhotoUI();
    var cli = document.getElementById("modal-cliente");
    if (cli && cli.classList.contains("open")) {
      var cid = currentClienteId();
      var c = cid ? getCliente(cid) : null;
      var foto = null;
      if (c) foto = resolveFotoSrc(c);
      else if (session.pendingClienteScope === "new") foto = session.pendingClienteFoto;
      showPreview("bp-cli-foto-preview", foto, cid || (foto ? "new" : ""));
      var _actC = document.getElementById("bp-cli-foto-actions"); if (_actC) _actC.style.display = foto ? "flex" : "none";
    }
    var pr = document.getElementById("modal-prof");
    if (pr && pr.classList.contains("open")) {
      var pid = currentProfId();
      var p = pid ? getProf(pid) : null;
      var foto2 = null;
      if (p) foto2 = resolveFotoSrc(p);
      else if (session.pendingProfScope === "new") foto2 = session.pendingProfFoto;
      showPreview("bp-prof-foto-preview", foto2, pid || (foto2 ? "new" : ""));
      var _actP = document.getElementById("bp-prof-foto-actions"); if (_actP) _actP.style.display = foto2 ? "flex" : "none";
    }
  }

  function hookEditTracking() {
    var cliModal = document.getElementById("modal-cliente");
    if (cliModal && !cliModal.dataset.bpFotoObs) {
      cliModal.dataset.bpFotoObs = "1";
      var obs = new MutationObserver(function () {
        if (cliModal.classList.contains("open")) {
          setTimeout(function () {
            var hid = document.getElementById("cliente-id");
            var id = hid && hid.value ? String(hid.value).trim() : "";
            session.editingClienteId = id || null;
            if (session.editingClienteId) clearClientePending();
            syncModalPreviews();
          }, 40);
        } else {
          session.editingClienteId = null;
          clearClientePending();
          showPreview("bp-cli-foto-preview", null, "");
        }
      });
      obs.observe(cliModal, { attributes: true, attributeFilter: ["class"] });
    }
    var prModal = document.getElementById("modal-prof");
    if (prModal && !prModal.dataset.bpFotoObs) {
      prModal.dataset.bpFotoObs = "1";
      var obs2 = new MutationObserver(function () {
        if (prModal.classList.contains("open")) {
          setTimeout(function () {
            var hid = document.getElementById("prof-id");
            var id = hid && hid.value ? String(hid.value).trim() : "";
            session.editingProfId = id || null;
            if (session.editingProfId) clearProfPending();
            syncModalPreviews();
          }, 40);
        } else {
          session.editingProfId = null;
          clearProfPending();
          showPreview("bp-prof-foto-preview", null, "");
        }
      });
      obs2.observe(prModal, { attributes: true, attributeFilter: ["class"] });
    }
  }

  function hookSaveButtons() {
    document.addEventListener("click", function (e) {
      var t = e.target.closest("#modal-cliente-save, #cliente-save, [data-save-cliente]");
      if (t && session.pendingClienteFoto && session.pendingClienteScope === "new") {
        var nome = ((document.getElementById("cliente-nome") || {}).value || "").trim();
        var foto = session.pendingClienteFoto;
        clearClientePending();
        setTimeout(async function () {
          if (!nome || !foto) return;
          var matches = (state.clientes || []).filter(function (x) { return x.nome === nome; });
          if (!matches.length) return;
          matches.sort(function (a, b) {
            return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
          });
          var c = matches[0];
          if (c) {
            await setClienteFoto(c.id, foto);
            patchRowAvatar("clientes", c.id);
          }
        }, 500);
      }
      var t2 = e.target.closest("#modal-prof-save, #prof-save, [data-save-prof]");
      if (t2 && session.pendingProfFoto && session.pendingProfScope === "new") {
        var nome2 = ((document.getElementById("prof-nome") || {}).value || "").trim();
        var foto2 = session.pendingProfFoto;
        // NÃO limpar ainda — eventos-cadastros / takePending também podem consumir
        var attempts = 0;
        var tryApply = async function () {
          attempts++;
          if (!foto2 || !nome2) return;
          var matches = (state.profissionais || []).filter(function (x) { return x.nome === nome2; });
          if (!matches.length) {
            if (attempts < 12) setTimeout(tryApply, 250);
            return;
          }
          matches.sort(function (a, b) {
            return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
          });
          var p = matches[0];
          if (!p) return;
          // Se já tem a mesma foto, só patch UI
          if (p.foto === foto2 || (p.foto && p.foto.indexOf("data:") === 0)) {
            clearProfPending();
            patchRowAvatar("profissionais", p.id);
            enhanceListAvatars();
            return;
          }
          await setProfFoto(p.id, foto2);
          clearProfPending();
          patchRowAvatar("profissionais", p.id);
          enhanceListAvatars();
          if (typeof renderProfissionais === "function") {
            try { renderProfissionais(); } catch (_) {}
          }
        };
        setTimeout(tryApply, 300);
      }
    });
  }

  /* Lazy load: IntersectionObserver + data-src (evita carregar todas de uma vez) */
  /* ================================================================
   * Galeria — lazy load robusto
   * - root = contentor com scroll do modal (não o viewport)
   * - URLs escapadas em atributos
   * - data: (thumb local) sempre eager; remote lazy
   * - disconnect no re-render; re-observe após paint
   * - sem src vazio; placeholder estável
   * ================================================================ */
  var _bpGalIo = null;
  var BP_GAL_PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">' +
    '<rect fill="#e8e4df" width="120" height="120"/>' +
    '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9a9288" font-size="11" font-family="sans-serif">…</text>' +
    "</svg>"
  );

  function bpGalEscAttr(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function bpGalSrc(f) {
    if (!f || typeof f !== "object") return "";
    var u = f.url || f.thumb || "";
    if (!u || typeof u !== "string") return "";
    // rejeitar lixo óbvio
    if (u === "null" || u === "undefined") return "";
    return u;
  }

  function bpGalIsLocalData(src) {
    return typeof src === "string" && src.indexOf("data:") === 0;
  }

  function bpGalDisconnect() {
    if (_bpGalIo) {
      try { _bpGalIo.disconnect(); } catch (_) {}
      _bpGalIo = null;
    }
  }

  function bpGalScrollRoot(fromEl) {
    // Preferir o corpo do modal / sheet com overflow; senão viewport (null)
    var el = fromEl;
    var hops = 0;
    while (el && hops < 12) {
      try {
        var st = window.getComputedStyle(el);
        var oy = st && st.overflowY;
        if ((oy === "auto" || oy === "scroll" || oy === "overlay") && el.scrollHeight > el.clientHeight + 8) {
          return el;
        }
      } catch (_) {}
      el = el.parentElement;
      hops++;
    }
    var body = document.getElementById("modal-bp-galeria-body");
    if (body) return body;
    return null;
  }

  function bpGalLoadOne(img) {
    if (!img || img.getAttribute("data-bp-gal-loaded") === "1") return;
    var src = img.getAttribute("data-src");
    if (!src) {
      img.setAttribute("data-bp-gal-loaded", "1");
      return;
    }
    img.setAttribute("data-bp-gal-loaded", "1");
    img.removeAttribute("data-src");
    var done = function () {
      img.classList.add("bp-gal-loaded");
      img.classList.remove("bp-gal-pending");
    };
    img.onload = done;
    img.onerror = function () {
      img.classList.add("bp-gal-error");
      img.classList.remove("bp-gal-pending");
      img.alt = "Falha ao carregar";
      // manter placeholder visual
      try { img.src = BP_GAL_PLACEHOLDER; } catch (_) {}
    };
    img.src = src;
    // cached images may already be complete
    if (img.complete && img.naturalWidth > 0) done();
  }

  function bpGalObserve(root) {
    if (!root) return;
    var imgs = root.querySelectorAll("img.bp-gal-lazy[data-src]");
    if (!imgs.length) return;

    // Sem IO: carregar tudo (compat)
    if (!("IntersectionObserver" in window)) {
      for (var i = 0; i < imgs.length; i++) bpGalLoadOne(imgs[i]);
      return;
    }

    bpGalDisconnect();
    var scrollRoot = bpGalScrollRoot(root);
    _bpGalIo = new IntersectionObserver(
      function (entries) {
        for (var k = 0; k < entries.length; k++) {
          var en = entries[k];
          if (!en.isIntersecting) continue;
          var img = en.target;
          try { _bpGalIo.unobserve(img); } catch (_) {}
          bpGalLoadOne(img);
        }
      },
      { root: scrollRoot, rootMargin: "160px 0px", threshold: 0.01 }
    );
    for (var j = 0; j < imgs.length; j++) {
      // Já visíveis no primeiro frame
      _bpGalIo.observe(imgs[j]);
    }
  }

  function bpGalEnsureStyles() {
    if (document.getElementById("bp-gal-lazy-css")) return;
    var st = document.createElement("style");
    st.id = "bp-gal-lazy-css";
    st.textContent =
      ".bp-gal-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;}" +
      ".bp-gal-item{position:relative;border-radius:10px;overflow:hidden;background:var(--bg-soft,#f0ebe6);aspect-ratio:1;}" +
      ".bp-gal-item img{width:100%;height:100%;object-fit:cover;display:block;transition:opacity .2s ease;}" +
      ".bp-gal-lazy.bp-gal-pending{opacity:.65;}" +
      ".bp-gal-lazy.bp-gal-loaded{opacity:1;}" +
      ".bp-gal-lazy.bp-gal-error{opacity:.4;}" +
      ".bp-gal-placeholder{display:flex;align-items:center;justify-content:center;height:100%;font-size:12px;color:var(--text-muted,#9a9288);}" +
      ".bp-gal-meta{position:absolute;left:0;right:0;bottom:0;padding:6px 8px;background:linear-gradient(transparent,rgba(0,0,0,.55));color:#fff;font-size:11px;display:flex;justify-content:space-between;align-items:center;gap:6px;}" +
      ".bp-gal-meta span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
      ".bp-gal-del{background:rgba(0,0,0,.35);border:0;color:#fff;border-radius:50%;width:24px;height:24px;cursor:pointer;flex-shrink:0;}";
    document.head.appendChild(st);
  }


  /** Shell do modal — independe de BPOps (ensureShell lá é privado ao IIFE). */
  function ensureShell(id, title, eyebrow, subtitle) {
    if (typeof ensureBpSheetModal === "function") {
      return ensureBpSheetModal(id, title, eyebrow, subtitle);
    }
    // Fallback mínimo se core-utils ainda não carregou
    var el = document.getElementById(id);
    if (el) return el;
    el = document.createElement("div");
    el.id = id;
    el.className = "modal-overlay";
    el.setAttribute("role", "dialog");
    el.innerHTML =
      '<div class="modal-sheet bp-sheet">' +
      '<div class="handle"></div>' +
      '<div class="modal-title" id="' + id + '-title">' + (title || "Galeria") + "</div>" +
      '<div class="bp-sheet-body" id="' + id + '-body"></div>' +
      '<div class="modal-actions"><button type="button" class="btn btn-secondary" data-close="' + id + '">Fechar</button></div>' +
      "</div>";
    document.body.appendChild(el);
    el.addEventListener("click", function (e) {
      if (e.target === el || e.target.getAttribute("data-close") === id) {
        if (typeof closeModal === "function") closeModal(id);
        else el.classList.remove("open");
      }
    });
    return el;
  }
  function openShell(id) {
    if (typeof openBpSheetModal === "function") openBpSheetModal(id);
    else if (typeof openModal === "function") openModal(id);
    else {
      var el = document.getElementById(id);
      if (el) {
        el.classList.add("open");
        el.style.display = "flex";
      }
    }
  }

  async function openGaleria(profIdPreset) {
    try {
      bpGalEnsureStyles();
      ensureShell("modal-bp-galeria", "Galeria de serviços", "Media", "Fotos dos trabalhos, associadas a cada profissional.");
      openShell("modal-bp-galeria");
      // Sync remoto antes de pintar (não bloqueia UI se falhar)
      try {
        if (navigator.onLine) await syncGaleriaFull();
      } catch (eSync) {
        console.warn("[BPMedia] sync galeria", eSync);
      }
      renderGaleria(profIdPreset);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          var body = document.getElementById("modal-bp-galeria-body");
          bpGalObserve((body && body.querySelector(".bp-gal-grid")) || body);
        });
      });
    } catch (err) {
      console.error("[BPMedia] openGaleria", err);
      if (typeof toastMsg === "function") toastMsg("Não foi possível abrir a galeria", "error");
      else if (typeof toast === "function") toast("Não foi possível abrir a galeria", "error");
      throw err;
    }
  }

  function renderGaleria(profIdPreset) {
    var body = document.getElementById("modal-bp-galeria-body");
    if (!body) return;
    bpGalDisconnect();

    var allProfs = state.profissionais || [];
    var profs = allProfs.filter(function (p) {
      if (!p || !p.id) return false;
      if (typeof isProfissionalAtivo === "function") return isProfissionalAtivo(p);
      return p.ativo !== false && p.ativo !== 0 && p.ativo !== "false";
    });
    var profId = profIdPreset || (profs[0] && profs[0].id) || "";
    if (profIdPreset) {
      var still = profs.some(function (p) { return p.id === profIdPreset; });
      if (!still) {
        var p0 = allProfs.find(function (x) { return x && x.id === profIdPreset; });
        if (p0) {
          profs = [p0].concat(profs);
          profId = profIdPreset;
        }
      } else {
        profId = profIdPreset;
      }
    }

    var opts = profs.map(function (p) {
      return '<option value="' + bpGalEscAttr(p.id) + '"' + (p.id === profId ? " selected" : "") + ">" + esc(p.nome) + "</option>";
    }).join("");

    var fotos = (profId ? galeriaPorProf(profId) : loadGaleria().slice().reverse()).filter(function (f) {
      return f && f.id;
    });

    var EAGER_REMOTE = 4;
    var remoteSeen = 0;
    var grid = fotos.map(function (f) {
      var src = bpGalSrc(f);
      var meta =
        '<div class="bp-gal-meta">' +
          "<span>" + esc(f.caption || f.data || "") + "</span>" +
          '<button type="button" class="bp-gal-del" data-del-gal="' + bpGalEscAttr(f.id) + '" title="Remover" aria-label="Remover">×</button>' +
        "</div>";
      if (!src) {
        return '<div class="bp-gal-item bp-gal-item--empty" data-gal-id="' + bpGalEscAttr(f.id) + '">' +
          '<div class="bp-gal-placeholder">Sem imagem</div>' + meta + "</div>";
      }
      var safe = bpGalEscAttr(src);
      var imgTag;
      // data: local → sempre eager (já em memória). Remote → primeiras N eager, resto lazy.
      if (bpGalIsLocalData(src) || remoteSeen < EAGER_REMOTE) {
        if (!bpGalIsLocalData(src)) remoteSeen++;
        imgTag =
          '<img class="bp-gal-lazy bp-gal-eager bp-gal-loaded" src="' + safe +
          '" alt="" loading="eager" decoding="async" data-bp-gal-loaded="1">';
      } else {
        imgTag =
          '<img class="bp-gal-lazy bp-gal-pending" src="' + BP_GAL_PLACEHOLDER +
          '" data-src="' + safe + '" alt="" loading="lazy" decoding="async">';
      }
      return '<div class="bp-gal-item" data-gal-id="' + bpGalEscAttr(f.id) + '">' + imgTag + meta + "</div>";
    }).join("") ||
      '<div class="bp-empty"><strong>Sem fotos</strong>Adicione a primeira foto do trabalho abaixo.</div>';

    body.innerHTML =
      '<div class="input-group"><label class="input-label">Profissional</label>' +
      '<select id="bp-gal-prof" class="input-field">' + (opts || '<option value="">—</option>') + "</select></div>" +
      '<div class="bp-gal-actions">' +
        '<button type="button" class="btn btn-primary btn-block" id="bp-gal-add"' + (!profId ? " disabled" : "") + ">Adicionar foto do serviço</button>" +
      "</div>" +
      '<div class="input-group" style="margin-top:12px"><label class="input-label">Legenda (opcional)</label>' +
      '<input type="text" id="bp-gal-caption" class="input-field" placeholder="Ex: Coloração · cliente A" maxlength="80"></div>' +
      '<div class="bp-section"><div class="bp-section-title">Fotos (' + fotos.length + ")</div>" +
      '<div class="bp-gal-grid">' + grid + "</div></div>";

    var sel = document.getElementById("bp-gal-prof");
    if (sel) {
      sel.onchange = function () { renderGaleria(sel.value); };
    }
    var add = document.getElementById("bp-gal-add");
    if (add) {
      add.onclick = async function () {
        var pid = (document.getElementById("bp-gal-prof") || {}).value;
        if (!pid) {
          toastMsg("Seleccione um profissional", "error");
          return;
        }
        var file = await pickImage();
        if (!file) return;
        try {
          toastMsg("A processar foto…", "success");
          var dataUrl = await compressFile(file, GALERIA_MAX, JPEG_Q_GAL);
          var thumbUrl = await compressFile(file, GALERIA_THUMB, JPEG_Q);
          var p = getProf(pid);
          var cap = ((document.getElementById("bp-gal-caption") || {}).value || "").trim();
          var galId = uid();
          var entry = {
            id: galId,
            profissional_id: pid,
            profissional_nome: (p && p.nome) || "",
            thumb: thumbUrl,
            url: null,
            caption: cap,
            data: hojeStr(),
            ts: new Date().toISOString()
          };
          if (addFotoGaleria(entry)) {
            toastMsg("Foto adicionada à galeria", "success");
            renderGaleria(pid);
            withTimeout(uploadFotoStorage("galeria/" + pid, galId, dataUrl), UPLOAD_MS).then(function (result) {
              var remoteUrl = result && result.url ? result.url : null;
              if (!remoteUrl) {
                toastUploadOutcome(result || { url: null, error: "upload" });
                return;
              }
              var list = loadGaleria();
              var hit = list.find(function (x) { return x.id === galId; });
              if (!hit || hit.profissional_id !== pid) return;
              hit.url = remoteUrl;
              hit.thumb = remoteUrl;
              hit.updated_at = new Date().toISOString();
              saveGaleria(list);
              upsertGaleriaRemoto(hit);
              renderGaleria(pid);
            });
          }
        } catch (e) {
          console.warn(e);
          toastMsg("Não foi possível processar a imagem.", "error");
        }
      };
    }
    body.querySelectorAll("[data-del-gal]").forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        (async function () {
          var ok = true;
          if (typeof showConfirmModal === "function") {
            ok = await showConfirmModal(
              "Remover foto?",
              "Esta foto deixa de aparecer na galeria deste profissional. Podes voltar a adicionar outra mais tarde.",
              true,
              { confirmLabel: "Remover", cancelLabel: "Cancelar", variant: "destructive" }
            );
          }
          if (!ok) return;
          var delId = btn.getAttribute("data-del-gal");
          var pidDel = (document.getElementById("bp-gal-prof") || {}).value;
          if (pidDel && delId) removeFotoStorage("galeria/" + pidDel, delId);
          removeFotoGaleria(delId);
          deleteGaleriaRemoto(delId);
          renderGaleria(pidDel);
          toastMsg("Foto removida.", "success");
        })();
      };
    });

    // Lazy load imagens fora do viewport (body no scope de renderGaleria)
    setTimeout(function () {
      try {
        if (body) bpGalObserve(body.querySelector(".bp-gal-grid") || body);
      } catch (_) {}
    }, 30);
  }



  /* ---------- Menu: CRM → Galeria (inject into accordion panel if exists) ---------- */
  function ensureMenuItem() {
    var panel = document.querySelector('.bp-acc-panel[data-acc-panel="crm"]');
    if (panel && !panel.querySelector('[data-bp-action="galeria"]')) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-bp-menu", "crm");
      btn.setAttribute("data-bp-action", "galeria");
      btn.innerHTML = "<span>Galeria de serviços</span>";
      panel.appendChild(btn);
    }
    // also listen
    var dd = document.getElementById("menu-dropdown");
    if (dd && !dd.dataset.bpMediaBound) {
      dd.dataset.bpMediaBound = "1";
      dd.addEventListener("click", function (e) {
        var t = e.target.closest('[data-bp-action="galeria"]');
        if (!t) return;
        e.stopPropagation();
        dd.style.display = "none";
        openGaleria();
      });
    }
  }

  /* ---------- observe list re-renders ---------- */
  function observeLists() {
    ["clientes-list", "profissionais-list"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.dataset.bpAvatarObs) return;
      el.dataset.bpAvatarObs = "1";
      var obs = new MutationObserver(function () {
        setTimeout(enhanceListAvatars, 30);
      });
      obs.observe(el, { childList: true, subtree: true });
    });
  }

  function init() {
    // ET4-P1-02: listeners só uma vez; re-ensure de menus permitido após login
    if (window.__bpMediaInitDone) {
      try {
        if (typeof ensureMenuItem === "function") ensureMenuItem();
        if (typeof enhanceListAvatars === "function") enhanceListAvatars();
      } catch (eRe) {}
      return;
    }
    window.__bpMediaInitDone = true;

    try {
      ensureClientePhotoUI();
      ensureProfPhotoUI();
      hookEditTracking();
      hookSaveButtons();
      observeLists();
      enhanceListAvatars();
      ensureMenuItem();
    } catch (e) {
      console.warn("[media-galeria]", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 220); });
  } else setTimeout(init, 220);
  setTimeout(init, 800);
  setTimeout(init, 2000);
  setTimeout(function () { enhanceListAvatars(); ensureMenuItem(); }, 4000);

  // after tab switches
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-tab], .nav-tab, .tab-btn")) {
      setTimeout(enhanceListAvatars, 120);
    }
  });


  // Sync galeria em background quando a app volta online / após login
  window.addEventListener("online", function () {
    setTimeout(function () {
      if (typeof syncGaleriaFull === "function") syncGaleriaFull();
    }, 2000);
  });

  window.openGaleria = openGaleria;
  window.BPMedia = {
    compressFile: compressFile,
    setClienteFoto: setClienteFoto,
    setProfFoto: setProfFoto,
    openGaleria: openGaleria,
    loadGaleria: loadGaleria,
    takePendingProfFoto: function () {
      var f = session.pendingProfFoto;
      var scope = session.pendingProfScope;
      clearProfPending();
      return scope === "new" ? f : null;
    },
    takePendingClienteFoto: function () {
      var f = session.pendingClienteFoto;
      var scope = session.pendingClienteScope;
      clearClientePending();
      return scope === "new" ? f : null;
    },
    peekPendingProfFoto: function () { return session.pendingProfFoto; },
    peekPendingClienteFoto: function () { return session.pendingClienteFoto; },
    syncGaleriaFull: syncGaleriaFull,
    pullGaleriaRemoto: pullGaleriaRemoto,
    enhanceListAvatars: enhanceListAvatars,
    patchRowAvatar: patchRowAvatar,
    resolveFotoSrc: resolveFotoSrc,
    ensureLocalFotoCache: ensureLocalFotoCache,
    uploadFotoStorage: uploadFotoStorage,
    session: session
  };

  window.addEventListener("online", function () {
    setTimeout(function () { flushFotoUploadQueue(); }, 1200);
  });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && navigator.onLine) {
      setTimeout(function () { flushFotoUploadQueue(); }, 1500);
    }
  });
  // Expor para flush global após sync de dados
  if (typeof window !== "undefined") {
    window.bpFlushFotoUploadQueue = flushFotoUploadQueue;
  }

})();

