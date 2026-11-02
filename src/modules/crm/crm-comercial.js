/* BelezaPro B6 — feature fora do monólito; carregar após app.bundle.js */

// ================================================================
// Grupos 4–6 — Operações, CRM, Comercial (robusto, offline-first)
// F3 Stock | F18 Fornecedores/compras | F7 NPS | F9 Timeline
// F24 Calendário (.ics) | F8 Pacotes / assinaturas
// ================================================================
(function () {
  "use strict";

  var STOCK_KEY = "bp_stock_v1";
  var STOCK_MOV_KEY = "bp_stock_mov_v1";
  var FORN_KEY = "bp_fornecedores_v1";
  var COMPRAS_KEY = "bp_compras_v1";
  var NPS_KEY = "bp_nps_v1";
  var PACOTES_KEY = "bp_pacotes_v1";
  var CLIENTE_PACOTES_KEY = "bp_cliente_pacotes_v1";

  function fmt(v) {
    return typeof fmtKz === "function" ? fmtKz(v) : Math.round(Number(v) || 0) + " Kz";
  }
  function esc(s) {
    return typeof escHtml === "function" ? escHtml(String(s == null ? "" : s)) : String(s == null ? "" : s);
  }
  function hojeStr() {
    return typeof hoje === "function" ? hoje() : new Date().toISOString().slice(0, 10);
  }
  function uid() {
    return typeof uuid === "function" ? uuid() : "id" + Date.now() + Math.random().toString(16).slice(2, 8);
  }
  function safeJson(key, fb) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fb;
      var v = JSON.parse(raw);
      return v == null ? fb : v;
    } catch (e) { return fb; }
  }
  function writeJson(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) {
      if (typeof toast === "function") toast("Armazenamento local indisponível", "error");
      return false;
    }
  }
  function loadArr(key) {
    var v = safeJson(key, []);
    return Array.isArray(v) ? v : [];
  }

  /* ========== F3 STOCK ========== */
  function loadStock() { return loadArr(STOCK_KEY); }
  function saveStock(list) { return writeJson(STOCK_KEY, list); }
  function loadStockMov() { return loadArr(STOCK_MOV_KEY); }
  function saveStockMov(list) { return writeJson(STOCK_MOV_KEY, list.slice(-400)); }

  function findProduto(id) {
    return loadStock().find(function (p) { return p.id === id; }) || null;
  }

  function upsertProduto(data) {
    var list = loadStock();
    var nome = String(data.nome || "").trim();
    if (!nome) {
      if (typeof toast === "function") toast("Introduz o nome do produto.", "warning");
      return null;
    }
    var qtd = Math.max(0, Number(data.qtd) || 0);
    var qtdMin = Math.max(0, Number(data.qtd_min) || 0);
    var custo = Math.max(0, Number(data.preco_custo) || 0);
    if (data.id) {
      var idx = list.findIndex(function (p) { return p.id === data.id; });
      if (idx < 0) return null;
      list[idx] = Object.assign({}, list[idx], {
        nome: nome,
        sku: String(data.sku || list[idx].sku || "").trim(),
        qtd: qtd,
        qtd_min: qtdMin,
        preco_custo: custo,
        unidade: data.unidade || list[idx].unidade || "un",
        updated_at: new Date().toISOString()
      });
      saveStock(list);
      return list[idx];
    }
    // evitar nome duplicado
    if (list.some(function (p) { return p.nome.toLowerCase() === nome.toLowerCase(); })) {
      if (typeof toast === "function") toast("Já existe um produto com este nome", "error");
      return null;
    }
    var p = {
      id: uid(),
      nome: nome,
      sku: String(data.sku || "").trim(),
      qtd: qtd,
      qtd_min: qtdMin,
      preco_custo: custo,
      unidade: data.unidade || "un",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    list.push(p);
    saveStock(list);
    return p;
  }

  function movimentarStock(produtoId, tipo, quantidade, nota) {
    var q = Math.abs(Number(quantidade) || 0);
    if (!q) {
      if (typeof toast === "function") toast("Quantidade inválida", "error");
      return null;
    }
    var list = loadStock();
    var idx = list.findIndex(function (p) { return p.id === produtoId; });
    if (idx < 0) {
      if (typeof toast === "function") toast("Produto não encontrado", "error");
      return null;
    }
    var p = list[idx];
    var delta = tipo === "entrada" || tipo === "ajuste_mais" ? q : -q;
    if (tipo === "ajuste") {
      // quantidade = novo valor absoluto
      delta = q - (Number(p.qtd) || 0);
    }
    var nova = (Number(p.qtd) || 0) + (tipo === "ajuste" ? delta : delta);
    if (tipo !== "ajuste" && tipo !== "entrada" && tipo !== "ajuste_mais" && nova < 0) {
      if (typeof toast === "function") toast("Stock insuficiente (" + p.qtd + " " + (p.unidade || "un") + ")", "error");
      return null;
    }
    if (tipo === "ajuste") nova = q;
    if (nova < 0) nova = 0;
    list[idx] = Object.assign({}, p, { qtd: nova, updated_at: new Date().toISOString() });
    saveStock(list);
    var mov = {
      id: uid(),
      produto_id: produtoId,
      produto: p.nome,
      tipo: tipo === "ajuste" ? "ajuste" : tipo,
      quantidade: tipo === "ajuste" ? Math.abs(delta) : q,
      qtd_antes: Number(p.qtd) || 0,
      qtd_depois: nova,
      nota: String(nota || "").slice(0, 200),
      data: hojeStr(),
      ts: new Date().toISOString()
    };
    var movs = loadStockMov();
    movs.push(mov);
    saveStockMov(movs);
    return { produto: list[idx], movimento: mov };
  }

  function produtosBaixoStock() {
    return loadStock().filter(function (p) {
      return (Number(p.qtd_min) || 0) > 0 && (Number(p.qtd) || 0) <= (Number(p.qtd_min) || 0);
    });
  }

  function valorStockTotal() {
    return loadStock().reduce(function (s, p) {
      return s + (Number(p.qtd) || 0) * (Number(p.preco_custo) || 0);
    }, 0);
  }

  /* ========== F18 FORNECEDORES / COMPRAS ========== */
  function loadForn() { return loadArr(FORN_KEY); }
  function saveForn(list) { return writeJson(FORN_KEY, list); }
  function loadCompras() { return loadArr(COMPRAS_KEY); }
  function saveCompras(list) { return writeJson(COMPRAS_KEY, list.slice(-200)); }

  function upsertFornecedor(data) {
    var nome = String(data.nome || "").trim();
    if (!nome) {
      if (typeof toast === "function") toast("Introduz o nome do fornecedor.", "warning");
      return null;
    }
    var list = loadForn();
    if (data.id) {
      var i = list.findIndex(function (f) { return f.id === data.id; });
      if (i < 0) return null;
      list[i] = Object.assign({}, list[i], {
        nome: nome,
        contacto: String(data.contacto || "").trim(),
        nota: String(data.nota || "").slice(0, 200),
        updated_at: new Date().toISOString()
      });
      saveForn(list);
      return list[i];
    }
    if (list.some(function (f) { return f.nome.toLowerCase() === nome.toLowerCase(); })) {
      if (typeof toast === "function") toast("Fornecedor já existe", "error");
      return null;
    }
    var f = {
      id: uid(),
      nome: nome,
      contacto: String(data.contacto || "").trim(),
      nota: String(data.nota || "").slice(0, 200),
      created_at: new Date().toISOString()
    };
    list.push(f);
    saveForn(list);
    return f;
  }

  function registarCompra(data) {
    var fornId = data.fornecedor_id;
    var forn = loadForn().find(function (f) { return f.id === fornId; });
    var produtoId = data.produto_id;
    var qtd = Math.abs(Number(data.quantidade) || 0);
    var valor = Math.max(0, Number(data.valor) || 0);
    if (!forn) {
      if (typeof toast === "function") toast("Selecciona um fornecedor.", "warning");
      return null;
    }
    if (!produtoId || !findProduto(produtoId)) {
      if (typeof toast === "function") toast("Selecciona um produto de stock.", "warning");
      return null;
    }
    if (!qtd) {
      if (typeof toast === "function") toast("Quantidade inválida", "error");
      return null;
    }
    // entrada de stock
    var mov = movimentarStock(produtoId, "entrada", qtd, "Compra · " + forn.nome);
    if (!mov) return null;
    var compra = {
      id: uid(),
      fornecedor_id: forn.id,
      fornecedor: forn.nome,
      produto_id: produtoId,
      produto: mov.produto.nome,
      quantidade: qtd,
      valor: valor,
      data: data.data || hojeStr(),
      nota: String(data.nota || "").slice(0, 200),
      ts: new Date().toISOString()
    };
    var list = loadCompras();
    list.push(compra);
    saveCompras(list);
    // opcional: despesa no caixa
    if (data.lancar_despesa && valor > 0 && typeof addMovimento === "function") {
      try {
        addMovimento({
          tipo: "despesa",
          descricao: "Compra stock · " + mov.produto.nome + " (" + forn.nome + ")",
          valor: valor,
          categoria: "produtos",
          fornecedor: forn.nome
        });
      } catch (e) {}
    }
    return compra;
  }

  /* ========== F7 NPS ========== */
  function loadNps() { return loadArr(NPS_KEY); }
  function saveNps(list) { return writeJson(NPS_KEY, list.slice(-500)); }

  function registarNps(data) {
    var score = Number(data.score);
    if (isNaN(score) || score < 0 || score > 10) {
      if (typeof toast === "function") toast("Avaliação deve ser de 0 a 10", "error");
      return null;
    }
    var entry = {
      id: uid(),
      score: score,
      comentario: String(data.comentario || "").slice(0, 300),
      cliente: String(data.cliente || "").trim(),
      cliente_id: data.cliente_id || null,
      movimento_id: data.movimento_id || null,
      data: hojeStr(),
      ts: new Date().toISOString()
    };
    // classificar
    entry.tipo = score >= 9 ? "promotor" : score >= 7 ? "passivo" : "detractor";
    var list = loadNps();
    list.push(entry);
    saveNps(list);
    return entry;
  }

  function calcNpsScore(dias) {
    var list = loadNps();
    if (dias) {
      var cut = new Date();
      cut.setDate(cut.getDate() - dias);
      var cutIso = cut.toISOString();
      list = list.filter(function (n) { return n.ts >= cutIso; });
    }
    if (!list.length) return { nps: null, total: 0, promotores: 0, passivos: 0, detractores: 0, media: null };
    var prom = 0, pass = 0, det = 0, sum = 0;
    list.forEach(function (n) {
      sum += n.score;
      if (n.score >= 9) prom++;
      else if (n.score >= 7) pass++;
      else det++;
    });
    var total = list.length;
    var nps = Math.round(((prom - det) / total) * 100);
    return {
      nps: nps,
      total: total,
      promotores: prom,
      passivos: pass,
      detractores: det,
      media: Math.round((sum / total) * 10) / 10
    };
  }

  /* ========== F9 Timeline cliente ========== */
  function timelineCliente(nomeOuId) {
    var cliente = null;
    if (!nomeOuId) return { cliente: null, eventos: [] };
    var clients = (typeof state !== "undefined" && state.clientes) ? state.clientes : [];
    cliente = clients.find(function (c) {
      return c.id === nomeOuId || String(c.nome || "").toLowerCase() === String(nomeOuId).toLowerCase();
    }) || null;
    var nome = cliente ? cliente.nome : String(nomeOuId);
    var cid = cliente ? cliente.id : null;
    var eventos = [];

    function matchCliente(row) {
      if (cid && row.cliente_id && String(row.cliente_id) === String(cid)) return true;
      if (nome && String(row.cliente || "").toLowerCase() === String(nome).toLowerCase()) return true;
      return false;
    }

    (state.movimentos || []).forEach(function (m) {
      if (m.tipo !== "venda") return;
      if (!matchCliente(m)) return;
      eventos.push({
        tipo: "venda",
        data: m.data,
        ts: m.updated_at || (m.data + "T" + (m.hora || "12:00")),
        titulo: "Venda · " + fmt(m.valor),
        detalhe: (m.descricao || "") + (m.profissional ? " · " + m.profissional : ""),
        ref: m.id
      });
    });
    (state.agendamentos || []).forEach(function (a) {
      if (!matchCliente(a)) return;
      eventos.push({
        tipo: "agenda",
        data: a.data,
        ts: a.data + "T" + (a.hora || "12:00"),
        titulo: "Marcação · " + (a.hora || ""),
        detalhe: (a.servico || a.servicos || "") + " · " + (a.status || a.estado || "agendado"),
        ref: a.id
      });
    });
    loadNps().forEach(function (n) {
      if (String(n.cliente || "").toLowerCase() !== nome.toLowerCase()) return;
      eventos.push({
        tipo: "nps",
        data: n.data,
        ts: n.ts,
        titulo: "NPS " + n.score + "/10 · " + n.tipo,
        detalhe: n.comentario || "",
        ref: n.id
      });
    });
    // pacotes cliente
    loadClientePacotes().filter(function (cp) {
      return String(cp.cliente || "").toLowerCase() === nome.toLowerCase();
    }).forEach(function (cp) {
      eventos.push({
        tipo: "pacote",
        data: (cp.created_at || "").slice(0, 10),
        ts: cp.created_at || cp.created_at,
        titulo: "Pacote · " + (cp.pacote_nome || ""),
        detalhe: cp.sessoes_restantes + " sessões restantes",
        ref: cp.id
      });
    });

    eventos.sort(function (a, b) {
      return String(b.ts || "").localeCompare(String(a.ts || ""));
    });
    return {
      cliente: cliente || { nome: nome },
      eventos: eventos,
      totalGasto: eventos.filter(function (e) { return e.tipo === "venda"; }).length
        ? (state.movimentos || []).filter(function (m) {
            return m.tipo === "venda" && String(m.cliente || "").toLowerCase() === nome.toLowerCase();
          }).reduce(function (s, m) { return s + (Number(m.valor) || 0); }, 0)
        : 0,
      pontos: cliente ? (Number(cliente.pontos) || 0) : 0
    };
  }

  /* ========== F24 Calendário ICS ========== */
  function escapeIcs(text) {
    return String(text || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  }
  function buildIcsAgendamentos(diasFuturos) {
    diasFuturos = diasFuturos || 30;
    var start = hojeStr();
    var endD = new Date(start + "T12:00:00");
    endD.setDate(endD.getDate() + diasFuturos);
    var end = endD.toISOString().slice(0, 10);
    var store = (state && state.config && state.config.storeName) || "BeautyPro";
    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//BeautyPro//AO//PT",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:" + escapeIcs(store)
    ];
    (state.agendamentos || []).forEach(function (a) {
      if (!a.data || a.data < start || a.data > end) return;
      var st = (typeof _statusAg === "function")
        ? _statusAg(a)
        : String(a.status || a.estado || "").toLowerCase();
      if (st === "cancelado") return;
      var hora = (a.hora || "09:00").replace(":", "");
      if (hora.length === 3) hora = "0" + hora;
      var dtStart = a.data.replace(/-/g, "") + "T" + (hora.length >= 4 ? hora.slice(0, 4) : "0900") + "00";
      // +1h default duration
      var hh = parseInt((a.hora || "09:00").split(":")[0], 10) || 9;
      var mm = parseInt((a.hora || "09:00").split(":")[1], 10) || 0;
      var endMin = hh * 60 + mm + 60;
      var eh = String(Math.floor(endMin / 60) % 24).padStart(2, "0");
      var em = String(endMin % 60).padStart(2, "0");
      var dtEnd = a.data.replace(/-/g, "") + "T" + eh + em + "00";
      var summary = (a.cliente || "Cliente") + (a.servico ? " · " + a.servico : "");
      var desc = "Profissional: " + (a.profissional || "—");
      lines.push("BEGIN:VEVENT");
      lines.push("UID:" + (a.id || uid()) + "@beautypro.local");
      lines.push("DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z");
      lines.push("DTSTART:" + dtStart);
      lines.push("DTEND:" + dtEnd);
      lines.push("SUMMARY:" + escapeIcs(summary));
      lines.push("DESCRIPTION:" + escapeIcs(desc));
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }
  function downloadIcs() {
    var ics = buildIcsAgendamentos(45);
    var blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "beautypro-agenda.ics";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      a.remove();
    }, 500);
    if (typeof toast === "function") toast("Ficheiro de calendário descarregado", "success");
  }

  /* ========== F8 PACOTES ========== */
  function loadPacotes() { return loadArr(PACOTES_KEY); }
  function savePacotes(list) { return writeJson(PACOTES_KEY, list); }
  function loadClientePacotes() { return loadArr(CLIENTE_PACOTES_KEY); }
  function saveClientePacotes(list) { return writeJson(CLIENTE_PACOTES_KEY, list); }

  function upsertPacote(data) {
    var nome = String(data.nome || "").trim();
    var preco = Math.max(0, Number(data.preco) || 0);
    var sessoes = Math.max(1, parseInt(data.sessoes, 10) || 1);
    var validade = Math.max(0, parseInt(data.validade_dias, 10) || 90);
    if (!nome) {
      if (typeof toast === "function") toast("Introduz o nome do pacote.", "warning");
      return null;
    }
    var list = loadPacotes();
    if (data.id) {
      var i = list.findIndex(function (p) { return p.id === data.id; });
      if (i < 0) return null;
      list[i] = Object.assign({}, list[i], {
        nome: nome,
        preco: preco,
        sessoes: sessoes,
        validade_dias: validade,
        descricao: String(data.descricao || "").slice(0, 200),
        updated_at: new Date().toISOString()
      });
      savePacotes(list);
      return list[i];
    }
    var p = {
      id: uid(),
      nome: nome,
      preco: preco,
      sessoes: sessoes,
      validade_dias: validade,
      descricao: String(data.descricao || "").slice(0, 200),
      created_at: new Date().toISOString()
    };
    list.push(p);
    savePacotes(list);
    return p;
  }

  function venderPacote(pacoteId, clienteNome) {
    var pac = loadPacotes().find(function (p) { return p.id === pacoteId; });
    var cliente = String(clienteNome || "").trim();
    if (!pac) {
      if (typeof toast === "function") toast("Pacote não encontrado", "error");
      return null;
    }
    if (!cliente) {
      if (typeof toast === "function") toast("Indica o cliente.", "warning");
      return null;
    }
    var exp = new Date();
    exp.setDate(exp.getDate() + (Number(pac.validade_dias) || 90));
    var cp = {
      id: uid(),
      pacote_id: pac.id,
      pacote_nome: pac.nome,
      cliente: cliente,
      sessoes_total: pac.sessoes,
      sessoes_restantes: pac.sessoes,
      preco: pac.preco,
      expira_em: exp.toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
      activo: true
    };
    var list = loadClientePacotes();
    list.push(cp);
    saveClientePacotes(list);
    // registar venda no caixa se possível
    if (typeof registarVenda === "function" && pac.preco > 0) {
      try {
        // não forçar profissional — só movimento simples via addMovimento
      } catch (e) {}
    }
    if (typeof addMovimento === "function" && pac.preco > 0) {
      try {
        addMovimento({
          tipo: "venda",
          descricao: "Pacote · " + pac.nome,
          valor: pac.preco,
          cliente: cliente,
          metodoPagamento: "Numerário"
        });
      } catch (e) {}
    }
    return cp;
  }

  function consumirSessaoPacote(clientePacoteId) {
    var list = loadClientePacotes();
    var i = list.findIndex(function (x) { return x.id === clientePacoteId; });
    if (i < 0) return null;
    var cp = list[i];
    if (!cp.activo) {
      if (typeof toast === "function") toast("Pacote inactivo", "error");
      return null;
    }
    if (cp.expira_em && cp.expira_em < hojeStr()) {
      list[i] = Object.assign({}, cp, { activo: false });
      saveClientePacotes(list);
      if (typeof toast === "function") toast("Pacote expirado", "error");
      return null;
    }
    if ((Number(cp.sessoes_restantes) || 0) <= 0) {
      if (typeof toast === "function") toast("Sem sessões restantes", "error");
      return null;
    }
    var rest = (Number(cp.sessoes_restantes) || 0) - 1;
    list[i] = Object.assign({}, cp, {
      sessoes_restantes: rest,
      activo: rest > 0,
      updated_at: new Date().toISOString()
    });
    saveClientePacotes(list);
    return list[i];
  }

  /* ========== UI SHELL ========== */
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
    if (typeof openModal === "function") openModal(id);
    else {
      var el = document.getElementById(id);
      if (el) el.classList.add("open");
    }
  }

  /* ----- Stock UI ----- */
  function openStock() {
    ensureShell("modal-bp-stock", "Stock de produtos", "Operações", "Inventário, alertas de mínimo e movimentos.");
    renderStock();
    openShell("modal-bp-stock");
  }
  function renderStock() {
    var body = document.getElementById("modal-bp-stock-body");
    if (!body) return;
    var list = loadStock();
    var baixo = produtosBaixoStock();
    var kpis =
      '<div class="bp-kpi-grid">' +
        '<div class="bp-kpi"><div class="bp-kpi-label">Produtos</div><div class="bp-kpi-value">' + list.length + "</div></div>" +
        '<div class="bp-kpi"><div class="bp-kpi-label">Valor stock</div><div class="bp-kpi-value" style="font-size:.72rem">' + fmt(valorStockTotal()) + "</div></div>" +
        '<div class="bp-kpi"><div class="bp-kpi-label">Alertas</div><div class="bp-kpi-value' + (baixo.length ? " is-negative" : "") + '">' + baixo.length + "</div></div></div>";
    var rows = list.map(function (p) {
      var alert = (Number(p.qtd_min) > 0 && p.qtd <= p.qtd_min) ? ' <span class="bp-badge" style="background:var(--red-50);color:var(--red)">Mín.</span>' : "";
      return '<div class="bp-row"><div class="bp-row-main"><div class="bp-row-title">' + esc(p.nome) + alert + "</div>" +
        '<div class="bp-row-meta">' + (p.sku ? esc(p.sku) + " · " : "") + fmt(p.preco_custo) + "/un · mín " + (p.qtd_min || 0) + "</div></div>" +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">' +
        '<div class="bp-row-value">' + p.qtd + " " + esc(p.unidade || "un") + "</div>" +
        '<div style="display:flex;gap:4px">' +
        '<button type="button" class="bp-action-btn" data-stock-out=\"' + (typeof escHtml==='function'?escHtml(String(p.id)):String(p.id)) + '\">−</button>' +
        '<button type="button" class="bp-action-btn is-primary" data-stock-in=\"' + (typeof escHtml==='function'?escHtml(String(p.id)):String(p.id)) + '\">+</button></div></div></div>';
    }).join("") || '<div class="bp-empty"><strong>Stock vazio</strong>Adicione o primeiro produto abaixo.</div>';

    var alertHtml = "";
    if (baixo.length) {
      alertHtml = '<div class="bp-alert-banner is-warn"><strong>' + baixo.length + (baixo.length === 1 ? " produto abaixo do mínimo" : " produtos abaixo do mínimo") +
        "</strong>" + baixo.slice(0, 3).map(function (p) { return esc(p.nome); }).join(", ") +
        (baixo.length > 3 ? "…" : "") + "</div>";
    }
    rows = list.map(function (p) {
      var alert = (Number(p.qtd_min) > 0 && p.qtd <= p.qtd_min) ? ' <span class="bp-badge is-red">Mín.</span>' : "";
      return '<div class="bp-row"><div class="bp-row-main"><div class="bp-row-title">' + esc(p.nome) + alert + "</div>" +
        '<div class="bp-row-meta">' + (p.sku ? esc(p.sku) + " · " : "") + fmt(p.preco_custo) + "/un · mín " + (p.qtd_min || 0) + "</div></div>" +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">' +
        '<div class="bp-row-value">' + p.qtd + " " + esc(p.unidade || "un") + "</div>" +
        '<div class="bp-stepper">' +
        '<button type="button" class="bp-action-btn" data-stock-out=\"' + (typeof escHtml==='function'?escHtml(String(p.id)):String(p.id)) + '\" aria-label="Saída">−</button>' +
        '<button type="button" class="bp-action-btn is-primary" data-stock-in=\"' + (typeof escHtml==='function'?escHtml(String(p.id)):String(p.id)) + '\" aria-label="Entrada">+</button></div></div></div>';
    }).join("") || '<div class="bp-empty"><strong>Stock vazio</strong>Adicione o primeiro produto abaixo.</div>';

    body.innerHTML = alertHtml + kpis +
      '<div class="bp-section"><div class="bp-section-title">Inventário</div>' + rows + "</div>" +
      '<div class="bp-section"><div class="bp-section-title">Novo produto</div>' +
      '<div class="input-group"><label class="input-label" for="bp-st-nome">Nome</label><input id="bp-st-nome" class="input-field" placeholder="Ex: Shampoo 1L" autocomplete="off"></div>' +
      '<div class="bp-form-grid-2">' +
        '<div class="input-group"><label class="input-label" for="bp-st-qtd">Qtd inicial</label><input type="number" id="bp-st-qtd" class="input-field" min="0" value="0" inputmode="numeric"></div>' +
        '<div class="input-group"><label class="input-label" for="bp-st-min">Qtd mínima</label><input type="number" id="bp-st-min" class="input-field" min="0" value="2" inputmode="numeric"></div>' +
        '<div class="input-group"><label class="input-label" for="bp-st-custo">Custo unit. (Kz)</label><input type="number" id="bp-st-custo" class="input-field" min="0" value="0" inputmode="numeric"></div>' +
        '<div class="input-group"><label class="input-label" for="bp-st-sku">SKU</label><input id="bp-st-sku" class="input-field" placeholder="Opcional"></div></div>' +
      '<button type="button" class="btn btn-primary btn-block" id="bp-st-add" style="margin-top:12px">Adicionar produto</button></div>';

    var add = document.getElementById("bp-st-add");
    if (add) add.onclick = function () {
      var p = upsertProduto({
        nome: (document.getElementById("bp-st-nome") || {}).value,
        qtd: (document.getElementById("bp-st-qtd") || {}).value,
        qtd_min: (document.getElementById("bp-st-min") || {}).value,
        preco_custo: (document.getElementById("bp-st-custo") || {}).value,
        sku: (document.getElementById("bp-st-sku") || {}).value
      });
      if (p) {
        if (typeof toast === "function") toast("Produto adicionado.", "success");
        renderStock();
      }
    };
    body.querySelectorAll("[data-stock-in]").forEach(function (btn) {
      btn.onclick = function () {
        var q = prompt("Quantidade a entrar:", "1");
        if (q == null) return;
        if (movimentarStock(btn.getAttribute("data-stock-in"), "entrada", q, "Entrada manual")) {
          if (typeof toast === "function") toast("Entrada registada", "success");
          renderStock();
        }
      };
    });
    body.querySelectorAll("[data-stock-out]").forEach(function (btn) {
      btn.onclick = function () {
        var q = prompt("Quantidade a sair:", "1");
        if (q == null) return;
        if (movimentarStock(btn.getAttribute("data-stock-out"), "saida", q, "Saída manual")) {
          if (typeof toast === "function") toast("Saída registada", "success");
          renderStock();
        }
      };
    });
  }

  /* ----- Fornecedores UI ----- */
  function openFornecedores() {
    ensureShell("modal-bp-forn", "Fornecedores e compras", "Operações", "Cadastro de fornecedores e entrada de mercadoria.");
    renderForn();
    openShell("modal-bp-forn");
  }
  function renderForn() {
    var body = document.getElementById("modal-bp-forn-body");
    if (!body) return;
    var forns = loadForn();
    var compras = loadCompras().slice().reverse().slice(0, 15);
    var stock = loadStock();
    var fornOpts = forns.map(function (f) {
      return '<option value=\"' + (typeof escHtml==='function'?escHtml(String(f.id)):String(f.id)) + '\">' + esc(f.nome) + "</option>";
    }).join("");
    var prodOpts = stock.map(function (p) {
      return '<option value=\"' + (typeof escHtml==='function'?escHtml(String(p.id)):String(p.id)) + '\">' + esc(p.nome) + " (" + p.qtd + ")</option>";
    }).join("");

    var fornRows = forns.map(function (f) {
      return '<div class="bp-row"><div class="bp-row-main"><div class="bp-row-title">' + esc(f.nome) + "</div>" +
        '<div class="bp-row-meta">' + esc(f.contacto || "Sem contacto") + "</div></div></div>";
    }).join("") || '<div class="bp-empty">Nenhum fornecedor ainda.</div>';

    var compraRows = compras.map(function (c) {
      return '<div class="bp-row"><div class="bp-row-main"><div class="bp-row-title">' + esc(c.produto) + "</div>" +
        '<div class="bp-row-meta">' + esc(c.data) + " · " + esc(c.fornecedor) + " · ×" + c.quantidade + "</div></div>" +
        '<div class="bp-row-value">' + fmt(c.valor) + "</div></div>";
    }).join("") || '<div class="bp-empty">Sem compras registadas.</div>';

    body.innerHTML =
      '<div class="bp-section" style="margin-top:0"><div class="bp-section-title">Nova compra (entra no stock)</div>' +
      (stock.length && forns.length
        ? '<div class="input-group"><label class="input-label">Fornecedor</label><select id="bp-cp-forn" class="input-field">' + fornOpts + "</select></div>" +
          '<div class="input-group"><label class="input-label">Produto</label><select id="bp-cp-prod" class="input-field">' + prodOpts + "</select></div>" +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
            '<div class="input-group"><label class="input-label">Quantidade</label><input type="number" id="bp-cp-qtd" class="input-field" min="1" value="1"></div>' +
            '<div class="input-group"><label class="input-label">Valor total (Kz)</label><input type="number" id="bp-cp-valor" class="input-field" min="0" value="0"></div></div>' +
          '<label style="display:flex;align-items:center;gap:8px;font-size:.85rem;margin:8px 0"><input type="checkbox" id="bp-cp-desp" checked> Lançar como despesa no caixa</label>' +
          '<button type="button" class="btn btn-primary btn-block" id="bp-cp-save">Registar compra</button>'
        : '<div class="bp-empty">Crie pelo menos 1 produto e 1 fornecedor.</div>') +
      "</div>" +
      '<div class="bp-section"><div class="bp-section-title">Novo fornecedor</div>' +
      '<div class="input-group"><label class="input-label">Nome</label><input id="bp-fn-nome" class="input-field" placeholder="Ex: Distribuidora Luanda"></div>' +
      '<div class="input-group"><label class="input-label">Contacto</label><input id="bp-fn-tel" class="input-field" placeholder="Telefone ou WhatsApp"></div>' +
      '<button type="button" class="btn btn-secondary btn-block" id="bp-fn-add">Guardar fornecedor</button></div>' +
      '<div class="bp-section"><div class="bp-section-title">Fornecedores</div>' + fornRows + "</div>" +
      '<div class="bp-section"><div class="bp-section-title">Últimas compras</div>' + compraRows + "</div>";

    var fnAdd = document.getElementById("bp-fn-add");
    if (fnAdd) fnAdd.onclick = function () {
      if (upsertFornecedor({ nome: (document.getElementById("bp-fn-nome") || {}).value, contacto: (document.getElementById("bp-fn-tel") || {}).value })) {
        if (typeof toast === "function") toast("Fornecedor guardado", "success");
        renderForn();
      }
    };
    var cpSave = document.getElementById("bp-cp-save");
    if (cpSave) cpSave.onclick = function () {
      var c = registarCompra({
        fornecedor_id: (document.getElementById("bp-cp-forn") || {}).value,
        produto_id: (document.getElementById("bp-cp-prod") || {}).value,
        quantidade: (document.getElementById("bp-cp-qtd") || {}).value,
        valor: (document.getElementById("bp-cp-valor") || {}).value,
        lancar_despesa: !!(document.getElementById("bp-cp-desp") || {}).checked
      });
      if (c) {
        if (typeof toast === "function") toast("Compra registada.", "success");
        renderForn();
      }
    };
  }

  /* ----- NPS UI ----- */
  function openNps() {
    ensureShell("modal-bp-nps", "Avaliação NPS", "Experiência", "De 0 a 10 — promotores, passivos e detractores.");
    renderNps();
    openShell("modal-bp-nps");
  }
  function renderNps() {
    var body = document.getElementById("modal-bp-nps-body");
    if (!body) return;
    var stats = calcNpsScore(90);
    var clientes = ((state && state.clientes) || []).map(function (c) {
      return '<option value="' + esc(c.nome) + '">' + esc(c.nome) + "</option>";
    }).join("");
    var insight = "";
    if (stats.total === 0) {
      insight = '<div class="bp-alert-banner"><strong>Ainda sem avaliações</strong>Peça uma nota 0–10 após o atendimento para medir a satisfação.</div>';
    } else if (stats.nps != null && stats.nps >= 50) {
      insight = '<div class="bp-alert-banner is-ok"><strong>NPS saudável (' + stats.nps + ')</strong>Boa proporção de promotores nos últimos 90 dias.</div>';
    } else if (stats.nps != null && stats.nps < 0) {
      insight = '<div class="bp-alert-banner is-warn"><strong>NPS negativo (' + stats.nps + ')</strong>Há mais detractores do que promotores — vale rever a experiência.</div>';
    }
    var kpis =
      insight +
      '<div class="bp-kpi-grid">' +
        '<div class="bp-kpi"><div class="bp-kpi-label">NPS 90d</div><div class="bp-kpi-value' + (stats.nps != null && stats.nps < 0 ? " is-negative" : " is-gold") + '">' + (stats.nps != null ? stats.nps : "—") + "</div></div>" +
        '<div class="bp-kpi"><div class="bp-kpi-label">Média</div><div class="bp-kpi-value">' + (stats.media != null ? stats.media : "—") + "</div></div>" +
        '<div class="bp-kpi"><div class="bp-kpi-label">Respostas</div><div class="bp-kpi-value">' + stats.total + "</div></div></div>" +
      '<p class="bp-ref-line">Promotores ' + stats.promotores + " · Passivos " + stats.passivos + " · Detractores " + stats.detractores + "</p>";

    var recent = loadNps().slice().reverse().slice(0, 12).map(function (n) {
      var badgeCls = n.score >= 9 ? " is-green" : (n.score <= 6 ? " is-red" : "");
      return '<div class="bp-row"><div class="bp-row-main"><div class="bp-row-title">' + esc(n.cliente || "Anónimo") +
        ' <span class="bp-badge' + badgeCls + '">' + n.score + "/10</span></div>" +
        '<div class="bp-row-meta">' + esc(n.data) + " · " + esc(n.tipo) + (n.comentario ? " · " + esc(n.comentario) : "") + "</div></div></div>";
    }).join("") || '<div class="bp-empty"><strong>Sem avaliações</strong>As notas aparecem aqui após registar.</div>';

    body.innerHTML = kpis +
      '<div class="bp-section"><div class="bp-section-title">Nova avaliação</div>' +
      '<div class="input-group"><label class="input-label" for="bp-nps-cli">Cliente</label><select id="bp-nps-cli" class="input-field"><option value="">— opcional —</option>' + clientes + "</select></div>" +
      '<div class="bp-form-grid-2">' +
        '<div class="input-group"><label class="input-label" for="bp-nps-score">Nota (0–10)</label><input type="number" id="bp-nps-score" class="input-field" min="0" max="10" step="1" value="9" inputmode="numeric"></div>' +
        '<div class="input-group"><label class="input-label" for="bp-nps-com">Comentário</label><input id="bp-nps-com" class="input-field" placeholder="Opcional" maxlength="300"></div></div>' +
      '<button type="button" class="btn btn-primary btn-block" id="bp-nps-save" style="margin-top:12px">Guardar NPS</button></div>' +
      '<div class="bp-section"><div class="bp-section-title">Recentes</div>' + recent + "</div>";

    var save = document.getElementById("bp-nps-save");
    if (save) save.onclick = function () {
      var e = registarNps({
        score: (document.getElementById("bp-nps-score") || {}).value,
        cliente: (document.getElementById("bp-nps-cli") || {}).value,
        comentario: (document.getElementById("bp-nps-com") || {}).value
      });
      if (e) {
        if (typeof toast === "function") toast("NPS " + e.score + " registado (" + e.tipo + ")", "success");
        renderNps();
      }
    };
  }

  /* ----- Timeline UI ----- */
  function openTimeline() {
    ensureShell("modal-bp-timeline", "Histórico do cliente", "CRM", "Vendas, marcações, NPS e pacotes num só lugar.");
    renderTimeline();
    openShell("modal-bp-timeline");
  }
  function renderTimeline(nomePreset) {
    var body = document.getElementById("modal-bp-timeline-body");
    if (!body) return;
    var clientes = ((state && state.clientes) || []).slice().sort(function (a, b) {
      return String(a.nome || "").localeCompare(String(b.nome || ""), "pt");
    });
    if (!clientes.length) {
      body.innerHTML = '<div class="bp-empty"><strong>Sem clientes</strong>Cadastre clientes na aba Clientes para ver o histórico.</div>';
      return;
    }

    var opts = clientes.map(function (c) {
      return '<option value="' + esc(c.nome) + '"' + (nomePreset && nomePreset === c.nome ? " selected" : "") + ">" + esc(c.nome) + "</option>";
    }).join("");
    var selected = nomePreset || "";
    if (!selected) {
      // manter seleção do select se re-render interno
      var prev = document.getElementById("bp-tl-cli");
      if (prev && prev.value) selected = prev.value;
    }

    var head = "";
    var events = "";
    var insight = "";

    if (!selected) {
      insight = '<div class="bp-alert-banner"><strong>Seleccione um cliente</strong>Veja vendas, agenda, avaliações e pacotes associados.</div>';
      events = '<div class="bp-empty"><strong>Nenhum cliente seleccionado</strong>Escolha um nome acima.</div>';
    } else {
      var tl = timelineCliente(selected);
      var nVendas = (tl.eventos || []).filter(function (e) { return e.tipo === "venda"; }).length;
      var nAgenda = (tl.eventos || []).filter(function (e) { return e.tipo === "agenda"; }).length;
      var ultimo = (tl.eventos || [])[0];

      if (!(tl.eventos || []).length) {
        insight = '<div class="bp-alert-banner"><strong>Sem eventos</strong>Este cliente ainda não tem vendas, marcações, NPS ou pacotes registados.</div>';
      } else if (ultimo) {
        insight = '<div class="bp-alert-banner is-ok"><strong>Última actividade</strong>' +
          esc(ultimo.data || "") + " · " + esc(ultimo.titulo || "") +
          (ultimo.detalhe ? " — " + esc(String(ultimo.detalhe).slice(0, 80)) : "") + "</div>";
      }

      head =
        '<div class="bp-kpi-grid">' +
          '<div class="bp-kpi"><div class="bp-kpi-label">Gasto total</div><div class="bp-kpi-value is-positive" style="font-size:.75rem">' + fmt(tl.totalGasto) + "</div></div>" +
          '<div class="bp-kpi"><div class="bp-kpi-label">Pontos</div><div class="bp-kpi-value is-gold">' + (tl.pontos || 0) + "</div></div>" +
          '<div class="bp-kpi"><div class="bp-kpi-label">Eventos</div><div class="bp-kpi-value">' + (tl.eventos || []).length + "</div></div>" +
        "</div>" +
        '<p class="bp-ref-line">' + nVendas + " vendas · " + nAgenda + " marcações · últimos 40 eventos</p>";

      events = (tl.eventos || []).slice(0, 40).map(function (e) {
        var badgeCls = "";
        var badge = "Evento";
        if (e.tipo === "venda") { badge = "Venda"; badgeCls = " is-green"; }
        else if (e.tipo === "agenda") { badge = "Agenda"; badgeCls = " is-gold"; }
        else if (e.tipo === "nps") { badge = "NPS"; }
        else if (e.tipo === "pacote") { badge = "Pacote"; }
        return '<div class="bp-row"><div class="bp-row-main"><div class="bp-row-title"><span class="bp-badge' + badgeCls + '">' + badge + "</span> " + esc(e.titulo) + "</div>" +
          '<div class="bp-row-meta">' + esc(e.data || "") + (e.detalhe ? " · " + esc(e.detalhe) : "") + "</div></div></div>";
      }).join("") || '<div class="bp-empty"><strong>Sem eventos</strong>Nada registado para este cliente.</div>';
    }

    body.innerHTML =
      '<div class="input-group"><label class="input-label" for="bp-tl-cli">Cliente</label>' +
      '<select id="bp-tl-cli" class="input-field"><option value="">— seleccionar —</option>' + opts + "</select></div>" +
      insight + head +
      '<div class="bp-section"><div class="bp-section-title">Timeline</div>' + events + "</div>";

    var sel = document.getElementById("bp-tl-cli");
    if (sel) {
      if (selected) sel.value = selected;
      sel.onchange = function () { renderTimeline(sel.value); };
    }
  }

  /* ----- Calendário UI ----- */
  function openCalendario() {
    ensureShell("modal-bp-cal", "Calendário do telemóvel", "CRM", "Exportar marcações em formato .ics (Apple, Google, Outlook).");
    var body = document.getElementById("modal-bp-cal-body");
    var futuros = (state.agendamentos || []).filter(function (a) {
      return a.data && a.data >= hojeStr() && String(a.status || a.estado || "").toLowerCase() !== "cancelado";
    }).length;
    body.innerHTML =
      '<div class="bp-kpi-grid">' +
        '<div class="bp-kpi"><div class="bp-kpi-label">Próximas</div><div class="bp-kpi-value">' + futuros + '</div></div>' +
        '<div class="bp-kpi"><div class="bp-kpi-label">Janela</div><div class="bp-kpi-value" style="font-size:.8rem">45 dias</div></div>' +
        '<div class="bp-kpi"><div class="bp-kpi-label">Formato</div><div class="bp-kpi-value" style="font-size:.8rem">.ics</div></div>' +
      '</div>' +
      '<div class="bp-alert-banner"><strong>Calendário .ics</strong>Importe no Google Calendar, Apple Calendar ou Outlook. Janela de 45 dias.</div>' +
      '<button type="button" class="btn btn-primary btn-block" id="bp-cal-dl">Descarregar agenda.ics</button>';
    var btn = document.getElementById("bp-cal-dl");
    if (btn) btn.onclick = downloadIcs;
    openShell("modal-bp-cal");
  }

  /* ----- Pacotes UI ----- */
  function openPacotes() {
    ensureShell("modal-bp-pacotes", "Pacotes e assinaturas", "Comercial", "Pacotes de sessões com validade e consumo.");
    renderPacotes();
    openShell("modal-bp-pacotes");
  }
  function renderPacotes() {
    var body = document.getElementById("modal-bp-pacotes-body");
    if (!body) return;
    var pacs = loadPacotes();
    var cps = loadClientePacotes().filter(function (c) { return c.activo !== false && (c.sessoes_restantes || 0) > 0; });
    var clientes = ((state && state.clientes) || []).map(function (c) {
      return '<option value="' + esc(c.nome) + '">' + esc(c.nome) + "</option>";
    }).join("");
    var pacOpts = pacs.map(function (p) {
      return '<option value=\"' + (typeof escHtml==='function'?escHtml(String(p.id)):String(p.id)) + '\">' + esc(p.nome) + " · " + fmt(p.preco) + "</option>";
    }).join("");

    var pacRows = pacs.map(function (p) {
      return '<div class="bp-row"><div class="bp-row-main"><div class="bp-row-title">' + esc(p.nome) + "</div>" +
        '<div class="bp-row-meta">' + p.sessoes + " sessões · validade " + p.validade_dias + " dias" +
        (p.descricao ? " · " + esc(p.descricao) : "") + "</div></div>" +
        '<div class="bp-row-value">' + fmt(p.preco) + "</div></div>";
    }).join("") || '<div class="bp-empty">Crie o primeiro pacote abaixo.</div>';

    var cpRows = cps.map(function (c) {
      return '<div class="bp-row"><div class="bp-row-main"><div class="bp-row-title">' + esc(c.cliente) + "</div>" +
        '<div class="bp-row-meta">' + esc(c.pacote_nome) + " · expira " + esc(c.expira_em) + "</div></div>" +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">' +
        '<div class="bp-row-value is-gold">' + c.sessoes_restantes + "/" + c.sessoes_total + "</div>" +
        '<button type="button" class="bp-action-btn is-primary" data-consume="' + (typeof escHtml==='function'?escHtml(String(c.id)):String(c.id)) + '">Usar 1</button></div></div>';
    }).join("") || '<div class="bp-empty">Nenhum pacote activo vendido.</div>';

    body.innerHTML =
      '<div class="bp-section" style="margin-top:0"><div class="bp-section-title">Vender pacote</div>' +
      (pacs.length
        ? '<div class="input-group"><label class="input-label">Pacote</label><select id="bp-vp-pac" class="input-field">' + pacOpts + "</select></div>" +
          '<div class="input-group"><label class="input-label">Cliente</label><select id="bp-vp-cli" class="input-field"><option value="">—</option>' + clientes + "</select></div>" +
          '<button type="button" class="btn btn-primary btn-block" id="bp-vp-save">Vender e activar</button>'
        : '<div class="bp-empty">Crie um pacote primeiro.</div>') +
      "</div>" +
      '<div class="bp-section"><div class="bp-section-title">Pacotes activos de clientes</div>' + cpRows + "</div>" +
      '<div class="bp-section"><div class="bp-section-title">Catálogo</div>' + pacRows + "</div>" +
      '<div class="bp-section"><div class="bp-section-title">Novo pacote</div>' +
      '<div class="input-group"><label class="input-label">Nome</label><input id="bp-pk-nome" class="input-field" placeholder="Ex: 5 Coloracões"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">' +
        '<div class="input-group"><label class="input-label">Preço</label><input type="number" id="bp-pk-preco" class="input-field" min="0" value="0"></div>' +
        '<div class="input-group"><label class="input-label">Sessões</label><input type="number" id="bp-pk-ses" class="input-field" min="1" value="5"></div>' +
        '<div class="input-group"><label class="input-label">Validade (dias)</label><input type="number" id="bp-pk-val" class="input-field" min="1" value="90"></div></div>' +
      '<button type="button" class="btn btn-secondary btn-block" id="bp-pk-add">Criar pacote</button></div>';

    var pkAdd = document.getElementById("bp-pk-add");
    if (pkAdd) pkAdd.onclick = function () {
      if (upsertPacote({
        nome: (document.getElementById("bp-pk-nome") || {}).value,
        preco: (document.getElementById("bp-pk-preco") || {}).value,
        sessoes: (document.getElementById("bp-pk-ses") || {}).value,
        validade_dias: (document.getElementById("bp-pk-val") || {}).value
      })) {
        if (typeof toast === "function") toast("Pacote criado", "success");
        renderPacotes();
      }
    };
    var vpSave = document.getElementById("bp-vp-save");
    if (vpSave) vpSave.onclick = function () {
      var cp = venderPacote(
        (document.getElementById("bp-vp-pac") || {}).value,
        (document.getElementById("bp-vp-cli") || {}).value
      );
      if (cp) {
        if (typeof toast === "function") toast("Pacote activado para " + cp.cliente, "success");
        renderPacotes();
        if (typeof renderCaixa === "function") try { renderCaixa(); } catch (e) {}
      }
    };
    body.querySelectorAll("[data-consume]").forEach(function (btn) {
      btn.onclick = function () {
        var r = consumirSessaoPacote(btn.getAttribute("data-consume"));
        if (r) {
          if (typeof toast === "function") toast("Sessão consumida · restam " + r.sessoes_restantes, "success");
          renderPacotes();
        }
      };
    });
  }

  /* ========== MENU ========== */
  function ensureMenuItems() {
    var dd = document.getElementById("menu-dropdown");
    if (!dd || dd.querySelector('[data-bp-menu="ops"]')) return;
    var frag = document.createDocumentFragment();

    function section(label, key) {
      var sec = document.createElement("div");
      sec.className = "bp-menu-section";
      sec.setAttribute("data-bp-menu", key);
      sec.textContent = label;
      frag.appendChild(sec);
    }
    function item(menu, key, label) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-bp-menu", menu);
      btn.setAttribute("data-bp-action", key);
      btn.innerHTML = "<span>" + label + "</span>";
      frag.appendChild(btn);
    }

    section("Operações", "ops");
    item("ops", "stock", "Stock de produtos");
    item("ops", "forn", "Fornecedores e compras");
    section("CRM", "crm");
    item("crm", "nps", "Avaliação NPS");
    item("crm", "timeline", "Histórico do cliente");
    item("crm", "cal", "Calendário (.ics)");
    item("crm", "galeria", "Galeria de serviços");
    section("Comercial", "com");
    item("com", "pacotes", "Pacotes e assinaturas");

    var logout = dd.querySelector("#logout-btn");
    if (logout) dd.insertBefore(frag, logout);
    else dd.appendChild(frag);

    if (!dd.dataset.bpOpsBound) {
      dd.dataset.bpOpsBound = "1";
      dd.addEventListener("click", function (e) {
        var t = e.target.closest("[data-bp-action]");
        if (!t) return;
        var menu = t.getAttribute("data-bp-menu");
        if (menu !== "ops" && menu !== "crm" && menu !== "com") return;
        e.stopPropagation();
        dd.style.display = "none";
        var a = t.getAttribute("data-bp-action");
        try {
          if (a === "stock") openStock();
          if (a === "forn") openFornecedores();
          if (a === "nps") openNps();
          if (a === "timeline") openTimeline();
          if (a === "cal") openCalendario();
          if (a === "pacotes") openPacotes();
          if (a === "galeria") {
            if (window.BPMedia && typeof BPMedia.openGaleria === "function") BPMedia.openGaleria();
            else if (typeof openGaleria === "function") openGaleria();
            else if (typeof toast === "function") toast("Galeria indisponível", "warning");
          }
        } catch (err) {
          console.error("[BPOpsCRM]", err);
          if (typeof toast === "function") toast("Não foi possível abrir esta secção", "error");
        }
      });
    }
  }

  function init() {
    // ET4-P1-02: listeners só uma vez; re-ensure de menus permitido após login
    if (window.__bpOpsInitDone) {
      try {
        if (typeof ensureMenuItems === "function") ensureMenuItems();
      } catch (eRe) {}
      return;
    }
    window.__bpOpsInitDone = true;

    try { ensureMenuItems(); } catch (e) { console.warn("[crm]", e); }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 160); });
  } else setTimeout(init, 160);
  setTimeout(init, 1800);
  setTimeout(init, 4500);

  window.BPOps = {
    loadStock: loadStock,
    upsertProduto: upsertProduto,
    movimentarStock: movimentarStock,
    produtosBaixoStock: produtosBaixoStock,
    registarCompra: registarCompra,
    registarNps: registarNps,
    calcNpsScore: calcNpsScore,
    timelineCliente: timelineCliente,
    downloadIcs: downloadIcs,
    upsertPacote: upsertPacote,
    venderPacote: venderPacote,
    consumirSessaoPacote: consumirSessaoPacote,
    openStock: openStock,
    openFornecedores: typeof openFornecedores === "function" ? openFornecedores : openStock,
    openNps: openNps,
    openTimeline: typeof openTimeline === "function" ? openTimeline : null,
    openCalendario: typeof openCalendario === "function" ? openCalendario : null,
    openPacotes: typeof openPacotes === "function" ? openPacotes : null
  };
})();


if (typeof window !== 'undefined' && window.BPOps) window.BPOps._bpOwner = 'modules/crm';
