/*! BeautyPro — ia-relatorio.js
 * Relator + PDF: totais via BPMetrics (mesma regra Resumo/Caixa).
 * Periodos via calcularIntervaloPeriodo (mesma verdade que Resumo/Agenda/Caixa).
 * Encoding WinAnsi; marca BeautyPro.
 */
(function (global) {
  'use strict';

  function fmtKz(n) {
    if (typeof global.fmtKz === 'function') return global.fmtKz(n);
    var v = Math.round(Number(n) || 0);
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Kz';
  }

  function hojeStr() {
    try {
      if (typeof global.dataLocalISO === 'function') return global.dataLocalISO(new Date());
    } catch (_) {}
    var d = new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  function salaoNome() {
    try {
      var c = global.state && state.config;
      if (!c) return 'Salao';
      return (c.nomeSalao || c.nome || c.storeName || 'Salao');
    } catch (_) { return 'Salao'; }
  }

  function salaoContactoLinha() {
    try {
      var c = global.state && state.config;
      if (!c) return '';
      var bits = [];
      if (c.telefone || c.phone) bits.push(String(c.telefone || c.phone));
      if (c.cidade || c.localidade) bits.push(String(c.cidade || c.localidade));
      if (c.nif || c.NIF) bits.push('NIF ' + String(c.nif || c.NIF));
      return bits.join(' · ');
    } catch (_) { return ''; }
  }

  /**
   * Ponto 3 — intervalos canónicos (mesma função do Resumo/Agenda/Caixa).
   * Chaves: hoje|dia, semana, 7dias, 30dias, mes|mes_civil, 90dias.
   */
  function resolverIntervalo(periodo) {
    periodo = String(periodo || 'semana').toLowerCase().trim();
    var hoje = hojeStr();
    var tipo = periodo;
    var offset = 0;
    if (periodo === 'hoje') tipo = 'dia';
    else if (periodo === '30d' || periodo === '30' || periodo === 'mes30') tipo = '30dias';
    else if (periodo === 'mes_civil' || periodo === 'mescivil') tipo = 'mes';
    else if (periodo === '7d' || periodo === '7') tipo = '7dias';
    /* "mes" no PDF antigo = 30 dias; preferir 30dias explícito; mes = mês civil */
    if (periodo === 'mes') tipo = 'mes';

    var iv = null;
    if (typeof global.calcularIntervaloPeriodo === 'function') {
      try { iv = global.calcularIntervaloPeriodo(tipo, offset); } catch (_) { iv = null; }
    } else if (typeof calcularIntervaloPeriodo === 'function') {
      try { iv = calcularIntervaloPeriodo(tipo, offset); } catch (_) { iv = null; }
    }

    var inicio, fim, labelCurto;
    if (iv && iv.inicio && iv.fim) {
      inicio = String(iv.inicio).slice(0, 10);
      fim = String(iv.fim).slice(0, 10);
      labelCurto = iv.labelCurto || iv.label || tipo;
      /* Mês civil corrente: não projectar além de hoje nos totais */
      if (tipo === 'mes' && fim > hoje) fim = hoje;
    } else {
      /* Fallback mínimo alinhado ao glossário ponto 2 */
      function isoOffset(days) {
        var d = new Date(hoje + 'T12:00:00');
        d.setDate(d.getDate() + days);
        var m = d.getMonth() + 1, day = d.getDate();
        return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
      }
      if (tipo === 'dia' || tipo === 'hoje') {
        inicio = fim = hoje;
        labelCurto = 'Hoje';
      } else if (tipo === '30dias') {
        inicio = isoOffset(-29); fim = hoje; labelCurto = 'Ultimos 30 dias';
      } else if (tipo === '7dias') {
        inicio = isoOffset(-6); fim = hoje; labelCurto = 'Ultimos 7 dias';
      } else if (tipo === 'mes') {
        inicio = hoje.slice(0, 7) + '-01'; fim = hoje; labelCurto = 'Este mes';
      } else {
        /* semana civil aproximada: seg-dom via offset simples se motor ausente */
        inicio = isoOffset(-6); fim = hoje; labelCurto = 'Esta semana';
        tipo = 'semana';
      }
    }

    var rotulo = labelCurto + ' (' + _fmtDataAO(inicio) + (inicio === fim ? '' : ' a ' + _fmtDataAO(fim)) + ')';
    return {
      inicio: inicio,
      fim: fim,
      rotulo: rotulo,
      periodo: tipo,
      labelCurto: labelCurto
    };
  }

  function _fmtDataAO(iso) {
    var s = String(iso || '').slice(0, 10);
    if (s.length < 10) return s;
    return s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4);
  }

  /**
   * Fonte unica de totais: BPMetrics (mesma regra que Resumo/Caixa).
   * Fallback apenas se BPMetrics indisponivel — ainda tenta excluir canceladas.
   */
  function construirDados(periodo) {
    var iv = resolverIntervalo(periodo);
    var inicio = iv.inicio;
    var fim = iv.fim;
    var M = null;
    try {
      if (typeof global.BPMetrics !== 'undefined' && global.BPMetrics && typeof global.BPMetrics.getMetricasPeriodo === 'function') {
        M = global.BPMetrics.getMetricasPeriodo(inicio, fim);
      } else if (typeof BPMetrics !== 'undefined' && BPMetrics && typeof BPMetrics.getMetricasPeriodo === 'function') {
        M = BPMetrics.getMetricasPeriodo(inicio, fim);
      }
    } catch (_) { M = null; }

    var fat = 0, desp = 0, nVendas = 0, ticket = 0, topServ = [];
    var vendCancel = 0, fatCancel = 0, agCancel = 0, agTotal = 0, taxaAg = 0;

    if (M && M.ok !== false) {
      fat = Number(M.faturamento) || 0;
      desp = Number(M.despesas) || 0;
      nVendas = Number(M.vendas) || 0;
      ticket = Number(M.ticketMedio) || 0;
      vendCancel = Number(M.vendasCanceladas) || 0;
      fatCancel = Number(M.faturamentoCancelado) || 0;
      agCancel = Number(M.agendamentosCancelados) || 0;
      agTotal = Number(M.agendamentos) || 0;
      taxaAg = Number(M.taxaCancelamento) || 0;
      if (Array.isArray(M.topServicos) && M.topServicos.length) {
        topServ = M.topServicos.slice(0, 5).map(function (s) {
          return { nome: s.nome || s.name || 'Servico', n: s.n || s.qtd || s.count || 0 };
        });
      }
    } else {
      /* Fallback alinhado a isVendaValida se existir */
      var movs = (global.state && Array.isArray(state.movimentos)) ? state.movimentos : [];
      var ags = (global.state && Array.isArray(state.agendamentos)) ? state.agendamentos : [];
      function isCancelMov(m) {
        if (typeof global.BPMetrics !== 'undefined' && BPMetrics.isVendaCancelada) return BPMetrics.isVendaCancelada(m);
        var st = String((m && (m.status || m.estado)) || '').toLowerCase();
        return /cancel|anul/.test(st);
      }
      movs.forEach(function (m) {
        if (!m || !m.data || m.data < inicio || m.data > fim) return;
        if (m.tipo === 'despesa') { desp += Number(m.valor) || 0; return; }
        if (m.tipo !== 'venda') return;
        if (isCancelMov(m)) {
          vendCancel++;
          fatCancel += Number(m.valor) || 0;
          return;
        }
        fat += Number(m.valor) || 0;
        nVendas++;
        var nome = m.servicoNome || m.servico || m.descricao || 'Servico';
        var found = null;
        for (var i = 0; i < topServ.length; i++) if (topServ[i].nome === nome) found = topServ[i];
        if (found) found.n++; else topServ.push({ nome: nome, n: 1 });
      });
      ticket = nVendas ? fat / nVendas : 0;
      topServ.sort(function (a, b) { return b.n - a.n; });
      topServ = topServ.slice(0, 5);
      ags.forEach(function (a) {
        if (!a || !a.data || a.data < inicio || a.data > fim) return;
        agTotal++;
        var st = String(a.status || a.estado || '').toLowerCase();
        if (st === 'cancelado' || st === 'cancelada') agCancel++;
      });
      taxaAg = agTotal ? Math.round((agCancel / agTotal) * 100) : 0;
    }

    return {
      salao: salaoNome(),
      contacto: salaoContactoLinha(),
      marca: 'BeautyPro',
      periodo: iv.periodo,
      rotulo: iv.rotulo,
      inicio: inicio,
      fim: fim,
      criterio: 'Vendas validas (exclui canceladas/anuladas) — mesmo criterio BPMetrics / Resumo / Caixa',
      faturamento: fat,
      despesas: desp,
      liquido: fat - desp,
      vendas: nVendas,
      ticket: ticket,
      topServicos: topServ,
      vendasCanceladas: vendCancel,
      faturamentoCancelado: fatCancel,
      agendamentosCancelados: agCancel,
      agendamentosPeriodo: agTotal,
      taxaCancelamentoAgenda: taxaAg,
      geradoEm: new Date().toISOString()
    };
  }

  /**
   * Corpo textual do PDF — MVP profissional (sem avisos experimentais).
   * Hierarquia: identificacao → periodo → resumo → operacao → destaques.
   */
  function linhasTexto(dados) {
    var L = [];
    var sep = '----------------------------------------------------------------';
    /* Identificacao do estabelecimento */
    L.push(String(dados.salao || 'Salao'));
    if (dados.contacto) L.push(String(dados.contacto));
    L.push('');
    L.push('RELATORIO DE GESTAO');
    L.push(sep);
    L.push('Periodo: ' + String(dados.rotulo || ''));
    if (dados.inicio && dados.fim) {
      L.push(
        'Intervalo: ' +
          _fmtDataAO(dados.inicio) +
          (dados.inicio === dados.fim ? '' : ' a ' + _fmtDataAO(dados.fim))
      );
    }
    L.push('Criterio: vendas validas (exclui canceladas)');
    L.push(
      'Emitido em: ' +
        String(dados.geradoEm || '')
          .replace('T', ' ')
          .slice(0, 19)
    );
    L.push(sep);
    L.push('RESUMO FINANCEIRO');
    L.push('Faturamento                    ' + fmtKz(dados.faturamento));
    L.push('Despesas                       ' + fmtKz(dados.despesas));
    L.push('Resultado liquido              ' + fmtKz(dados.liquido));
    L.push(sep);
    L.push('OPERACAO');
    L.push('Vendas validas                 ' + (dados.vendas || 0));
    L.push('Ticket medio                   ' + fmtKz(dados.ticket));
    L.push(
      'Vendas canceladas              ' +
        (dados.vendasCanceladas || 0) +
        '  (' +
        fmtKz(dados.faturamentoCancelado || 0) +
        ')'
    );
    L.push('Agendamentos no periodo        ' + (dados.agendamentosPeriodo || 0));
    L.push(
      'Agendamentos cancelados        ' +
        (dados.agendamentosCancelados || 0) +
        '  (' +
        (dados.taxaCancelamentoAgenda || 0) +
        '%)'
    );
    L.push(sep);
    L.push('SERVICOS EM DESTAQUE');
    if (dados.topServicos && dados.topServicos.length) {
      dados.topServicos.forEach(function (s, i) {
        L.push('  ' + (i + 1) + '. ' + s.nome + ' — ' + s.n + 'x');
      });
    } else {
      L.push('  Sem servicos registados neste periodo.');
    }
    L.push(sep);
    L.push('BeautyPro  ·  Relator Benza');
    return L;
  }

  /**
   * PDF 1.4 + WinAnsi — cabecalho com marca BeautyPro (vector) + corpo tipografico.
   * Sem dependencias externas.
   */
  function gerarPdfBlob(dados) {
    var lines = linhasTexto(dados);

    function toWinAnsiPdfString(s) {
      s = String(s || '');
      var out = '';
      for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i);
        if (c === 0x5c) { out += '\\\\'; continue; }
        if (c === 0x28) { out += '\\('; continue; }
        if (c === 0x29) { out += '\\)'; continue; }
        if (c >= 0x20 && c <= 0x7e) { out += s.charAt(i); continue; }
        if (c >= 0xa0 && c <= 0xff) {
          var oct = c.toString(8);
          while (oct.length < 3) oct = '0' + oct;
          out += '\\' + oct;
          continue;
        }
        var map = {
          0x2014: '-', 0x2013: '-', 0x2018: "'", 0x2019: "'",
          0x201c: '"', 0x201d: '"', 0x2022: '*', 0x00a0: ' '
        };
        if (map[c] != null) { out += map[c]; continue; }
        out += '?';
      }
      return out;
    }

    /* --- Marca BeautyPro (logotipo vectorial + wordmark) --- */
    /* Cores: dourado BP #B7791F ≈ 0.72 0.47 0.12 RGB */
    var logo =
      /* barra superior dourada */ 
      '0.718 0.475 0.122 rg\n' +
      '50 812 495 3 re f\n' +
      /* medalhao arredondado (quadrado com cantos suaves) */ 
      '0.718 0.475 0.122 rg\n' +
      '50 768 28 28 re f\n' +
      /* "B" em branco no medalhao */ 
      '1 1 1 rg\n' +
      'BT /F2 16 Tf 57 776 Td (B) Tj ET\n' +
      /* wordmark BeautyPro */ 
      '0.12 0.16 0.22 rg\n' +
      'BT /F2 18 Tf 86 778 Td (BeautyPro) Tj ET\n' +
      /* subtitulo de produto */ 
      '0.40 0.42 0.45 rg\n' +
      'BT /F1 9 Tf 86 764 Td (Plataforma de gestao) Tj ET\n' +
      /* linha divisoria suave */ 
      '0.85 0.84 0.82 rg\n' +
      '50 752 495 0.8 re f\n';

    /* Margens ~2 cm esq/dir; corpo a partir de y=738 */
    var yStart = 738;
    var content = logo + 'BT /F1 11 Tf 50 ' + yStart + ' Td\n';
    var lineH = 15;
    lines.forEach(function (line, idx) {
      var t = String(line || '');
      /* Titulo principal */
      if (t === 'RELATORIO DE GESTAO') {
        content += '/F2 13 Tf\n';
      } else if (
        t === 'RESUMO FINANCEIRO' ||
        t === 'OPERACAO' ||
        t === 'SERVICOS EM DESTAQUE'
      ) {
        content += '/F2 11 Tf\n';
      } else if (t.indexOf('---') === 0) {
        content += '/F1 9 Tf\n';
      } else if (idx === 0) {
        /* Nome do salao */
        content += '/F2 12 Tf\n';
      } else {
        content += '/F1 10 Tf\n';
      }
      content += '(' + toWinAnsiPdfString(t) + ') Tj\n0 -' + lineH + ' Td\n';
    });
    content += 'ET';

    /* Rodape fixo */
    var footer =
      '0.85 0.84 0.82 rg\n50 36 495 0.6 re f\n' +
      '0.45 0.47 0.50 rg\n' +
      'BT /F1 8 Tf 50 24 Td (BeautyPro) Tj ET\n';

    content = content + '\n' + footer;

    var objects = [];
    objects.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
    objects.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n');
    objects.push(
      '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>endobj\n'
    );
    objects.push('4 0 obj<< /Length ' + content.length + ' >>stream\n' + content + '\nendstream\nendobj\n');
    objects.push(
      '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>endobj\n'
    );
    objects.push(
      '6 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>endobj\n'
    );

    var pdf = '%PDF-1.4\n';
    var offsets = [0];
    objects.forEach(function (obj) {
      offsets.push(pdf.length);
      pdf += obj;
    });
    var xrefPos = pdf.length;
    pdf += 'xref\n0 ' + (objects.length + 1) + '\n';
    pdf += '0000000000 65535 f \n';
    for (var i = 1; i < offsets.length; i++) {
      var off = String(offsets[i]);
      while (off.length < 10) off = '0' + off;
      pdf += off + ' 00000 n \n';
    }
    pdf += 'trailer<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\n';
    pdf += 'startxref\n' + xrefPos + '\n%%EOF';
    return new Blob([pdf], { type: 'application/pdf' });
  }

  function descarregar(periodo) {
    var periodoN = periodo || 'semana';
    var dados = construirDados(periodoN);
    var blob = gerarPdfBlob(dados);
    var nome = '';
    try { nome = tituloLinhas(periodoN).main; } catch (_) { nome = ''; }
    if (!nome) {
      nome = nomeFicheiroPdf(dados.periodo, dados.fim);
    }
    if (!/\.pdf$/i.test(nome)) nome += '.pdf';

    var url = URL.createObjectURL(blob);
    var via1 = false;
    var via2 = false;

    /* VIA 1 — <a download> + clique sintético */
    try {
      var a = document.createElement('a');
      a.href = url;
      a.download = nome;
      a.rel = 'noopener';
      a.target = '_blank';
      a.setAttribute('type', 'application/pdf');
      a.style.display = 'none';
      document.body.appendChild(a);
      try {
        a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        via1 = true;
      } catch (_) {
        try { a.click(); via1 = true; } catch (__) {}
      }
      setTimeout(function () {
        try { document.body.removeChild(a); } catch (_) {}
      }, 2000);
    } catch (_) {}

    /* VIA 2 — abrir blob (WebView) ou iframe oculto se open bloqueado */
    try {
      var w = null;
      try { w = window.open(url, '_blank'); } catch (_) { w = null; }
      if (w) {
        via2 = true;
      } else {
        var iframe = document.createElement('iframe');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;border:0;';
        iframe.src = url;
        document.body.appendChild(iframe);
        via2 = true;
        setTimeout(function () {
          try { document.body.removeChild(iframe); } catch (_) {}
        }, 5000);
      }
    } catch (_) {}

    setTimeout(function () {
      try { URL.revokeObjectURL(url); } catch (_) {}
    }, 120000);

    return { dados: dados, ok: !!(via1 || via2), via1: via1, via2: via2, nome: nome };
  }

  function detectarPeriodo(pergunta) {
    var n = String(pergunta || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/hoje|diario|diaria/.test(n)) return 'hoje';
    if (/ultimos 30|ultimo 30|30 dias/.test(n)) return '30dias';
    if (/ultimos 7|ultimo 7|7 dias/.test(n)) return '7dias';
    if (/mes civil|este mes|mes atual|mensal/.test(n)) return 'mes';
    if (/semana civil|esta semana|semanal/.test(n)) return 'semana';
    if (/\bmes\b/.test(n)) return 'mes';
    return 'semana';
  }

  function isRelator() {
    try {
      return global.BP_IA_Habilidade && BP_IA_Habilidade.get() === 'relator';
    } catch (_) { return false; }
  }

  function nomeSalaoSlug() {
    var raw = '';
    try {
      raw = (global.state && state.config && (state.config.nomeSalao || state.config.salaoNome || state.config.nome)) || '';
    } catch (_) {}
    if (!raw) {
      try { raw = (global.state && state.salao && state.salao.nome) || ''; } catch (_) {}
    }
    raw = String(raw || 'Alfa').trim() || 'Alfa';
    /* slug: letras/números, espaços → _ */
    raw = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    raw = raw.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (!raw) raw = 'Alfa';
    return raw;
  }

  function periodoLabelCurto(periodo) {
    if (periodo === 'hoje') return 'hoje';
    if (periodo === 'mes' || periodo === '30d') return '30dias';
    return 'semana';
  }

  function slugSalao() {
    var n = salaoNome();
    return String(n || 'Salao')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'Salao';
  }

  function nomeFicheiroPdf(periodo, fim) {
    return slugSalao() + '_Relatorio_' + String(fim || hojeStr()).slice(0, 10) + '.pdf';
  }

  function tituloLinhas(periodo) {
    var iv = resolverIntervalo(periodo);
    var chave = iv.periodo || periodo || 'semana';
    var base = nomeSalaoSlug() + '_Relatorio_' + String(chave) + '_' + String(iv.fim || hojeStr()).slice(0, 10) + '.pdf';
    return { main: base, sub: iv.rotulo || '' };
  }

  function makePdfBlob(periodo) {
    var periodoN = periodo || 'semana';
    var dados = construirDados(periodoN);
    var blob = gerarPdfBlob(dados);
    var nome = nomeFicheiroPdf(dados.periodo, dados.fim);
    try {
      var t = tituloLinhas(periodoN);
      if (t && t.main) nome = t.main;
    } catch (_) {}
    if (!/\.pdf$/i.test(nome)) nome += '.pdf';
    var titulo = 'BeautyPro — ' + (dados.salao || 'Relatorio');
    var resumo = (dados.salao || 'Salao') + ' | ' + (dados.rotulo || '') +
      ' | Faturamento ' + fmtKz(dados.faturamento) +
      ' | Liquido ' + fmtKz(dados.liquido);
    return { blob: blob, nome: nome, dados: dados, titulo: titulo, resumo: resumo };
  }

  function anexarNaUltimaBolha(pergunta) {
    if (!isRelator()) return;
    var chat = document.getElementById('ia-chat');
    if (!chat) return;
    var blocks = chat.querySelectorAll('.ia-msg-block');
    if (!blocks.length) return;
    var last = blocks[blocks.length - 1];
    if (last.querySelector('.ia-pdf-row')) return;
    var periodo = detectarPeriodo(pergunta);
    var t = tituloLinhas(periodo);
    var row = document.createElement('div');
    row.className = 'ia-pdf-row';
    row.setAttribute('data-ia-pdf-periodo', periodo);
    row.innerHTML =
      '<div class="ia-pdf-card" role="group" aria-label="' + t.main + '">' +
      '<span class="ia-pdf-file" aria-hidden="true">' +
      '<svg class="ia-pdf-doc" width="28" height="32" viewBox="0 0 28 32" fill="none">' +
      '<path d="M7 1.5h9.5L25 10v18.5A2.5 2.5 0 0 1 22.5 31h-15A2.5 2.5 0 0 1 5 28.5v-25A2.5 2.5 0 0 1 7 1.5z" fill="#FAFAF8" stroke="#C8C3BA" stroke-width="1.2"/>' +
      '<path d="M16.5 1.5V8a1.5 1.5 0 0 0 1.5 1.5h6.5" stroke="#C8C3BA" stroke-width="1.2" fill="none"/>' +
      '<text x="14" y="21.5" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="6.5" font-weight="700" letter-spacing="0.04em" fill="#DC2626">PDF</text>' +
      '</svg></span>' +
      '<span class="ia-pdf-meta">' +
      '<span class="ia-pdf-title">' + (t.sub || t.main) + '</span>' +
      '</span>' +
      '<span class="ia-pdf-actions">' +
      '<button type="button" class="ia-pdf-act ia-pdf-share" data-ia-pdf-share="' + periodo + '" aria-label="Partilhar relatório" title="Partilhar">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/>' +
      '<path d="M8.5 13.5l7 4M15.5 6.5l-7 4"/></svg></button>' +
      '<button type="button" class="ia-pdf-act ia-pdf-dl" data-ia-pdf-dl="' + periodo + '" aria-label="Descarregar PDF" title="Descarregar">' +
      '<svg class="ia-pdf-dl-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 3v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19h14"/></svg>' +
      '<svg class="ia-pdf-dl-check" hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M5 12.5l5 5L19 7"/></svg>' +
      '<span class="ia-pdf-spin" hidden aria-hidden="true"></span>' +
      '</button>' +
      '</span></div>';
    last.appendChild(row);
  }

  function _bpPdfSpin(btn, on) {
    if (!btn) return;
    var icon = btn.querySelector('.ia-pdf-dl-icon');
    var check = btn.querySelector('.ia-pdf-dl-check');
    var spin = btn.querySelector('.ia-pdf-spin');
    if (on) {
      btn.classList.remove('is-done');
      if (btn._bpDoneTimer) { clearTimeout(btn._bpDoneTimer); btn._bpDoneTimer = null; }
      if (icon) icon.setAttribute('hidden', '');
      if (check) check.setAttribute('hidden', '');
      if (spin) spin.removeAttribute('hidden');
    } else {
      if (spin) spin.setAttribute('hidden', '');
      if (!btn.classList.contains('is-done')) {
        if (icon) icon.removeAttribute('hidden');
        if (check) check.setAttribute('hidden', '');
      }
    }
    btn.classList.toggle('is-busy', !!on);
    btn.setAttribute('aria-busy', on ? 'true' : 'false');
    btn.disabled = !!on;
  }

  function _bpPdfMarkDone(btn) {
    if (!btn) return;
    var icon = btn.querySelector('.ia-pdf-dl-icon');
    var check = btn.querySelector('.ia-pdf-dl-check');
    var spin = btn.querySelector('.ia-pdf-spin');
    btn.classList.remove('is-busy');
    btn.classList.add('is-done');
    btn.disabled = false;
    btn.setAttribute('aria-busy', 'false');
    btn.setAttribute('aria-label', 'PDF descarregado');
    if (icon) icon.setAttribute('hidden', '');
    if (spin) spin.setAttribute('hidden', '');
    if (check) {
      check.removeAttribute('hidden');
      check.style.display = 'block';
      check.style.width = '20px';
      check.style.height = '20px';
      check.style.opacity = '1';
      check.style.position = 'static';
    }
    if (btn._bpDoneTimer) clearTimeout(btn._bpDoneTimer);
    btn._bpDoneTimer = setTimeout(function () {
      try {
        btn.classList.remove('is-done');
        btn.setAttribute('aria-label', 'Descarregar PDF');
        if (check) {
          check.setAttribute('hidden', '');
          check.style.display = 'none';
          check.style.width = '0';
          check.style.height = '0';
          check.style.opacity = '0';
        }
        if (icon) {
          icon.removeAttribute('hidden');
          icon.style.display = 'block';
        }
        btn._bpDoneTimer = null;
      } catch (_) {}
    }, 5000);
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;

        var shareBtn = t.closest('[data-ia-pdf-share]');
    if (shareBtn) {
      try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}
      var perS = shareBtn.getAttribute('data-ia-pdf-share') || 'semana';
      /* Partilhar ≠ descarregar: só fallback de download se o utilizador o pedir no botão Descarregar. */
      try {
        var packS = makePdfBlob(perS);
        var nomeS = packS.nome || (tituloLinhas(perS).main || 'relatorio.pdf');
        if (!/\.pdf$/i.test(nomeS)) nomeS += '.pdf';
        var fileS = null;
        try { fileS = new File([packS.blob], nomeS, { type: 'application/pdf' }); } catch (_) { fileS = null; }
        var tituloS = 'BeautyPro — ' + (packS.titulo || 'Relatorio');
        var textoS = (packS.resumo || 'Relatorio de gestao BeautyPro.');

        if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
          if (typeof toast === 'function') {
            toast('Partilha nao disponivel neste dispositivo. Use Descarregar.', 'info', { duration: 4000 });
          }
          return;
        }

        var payload = { title: tituloS, text: textoS };
        var canFiles = false;
        try {
          canFiles = !!(fileS && navigator.canShare && navigator.canShare({ files: [fileS] }));
        } catch (_) { canFiles = false; }

        if (canFiles) {
          payload.files = [fileS];
        } else if (fileS) {
          /* Alguns browsers aceitam files sem canShare */
          payload.files = [fileS];
        }

        navigator.share(payload).then(function () {
          if (typeof toast === 'function') toast('Partilha iniciada.', 'success', { duration: 2500 });
        }).catch(function (err) {
          var aborted = err && (err.name === 'AbortError' || /abort|cancel/i.test(String(err.message || err)));
          if (aborted) return;
          /* Sem suporte a ficheiro: tentar so texto (WhatsApp etc.) — ainda nao e download */
          if (payload.files) {
            navigator.share({ title: tituloS, text: textoS + ' (abra o PDF pelo botao Descarregar se o ficheiro nao anexar.)' })
              .then(function () {
                if (typeof toast === 'function') toast('Partilha de texto iniciada. Para o PDF use Descarregar.', 'info', { duration: 4500 });
              })
              .catch(function () {
                if (typeof toast === 'function') toast('Nao foi possivel partilhar. Use Descarregar.', 'warning', { duration: 4000 });
              });
          } else {
            if (typeof toast === 'function') toast('Nao foi possivel partilhar. Use Descarregar.', 'warning', { duration: 4000 });
          }
        });
      } catch (e) {
        if (typeof toast === 'function') toast('Falha ao preparar partilha. Use Descarregar.', 'error', { duration: 4000 });
      }
      return;
    }

    var dlBtn = t.closest('[data-ia-pdf-dl]');
    if (dlBtn) {
      try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}
      var perD = dlBtn.getAttribute('data-ia-pdf-dl') || 'semana';
      /* cada clique força novo download */
      _bpPdfSpin(dlBtn, true);
      try {
        setTimeout(function () {
          var result = null;
          try {
            result = descarregar(perD);
          } catch (e2) {
            result = { ok: false };
          }
          _bpPdfSpin(dlBtn, false);
          /* Só mostra ✓ se AMBAS as vias tentaram e pelo menos uma reportou ok.
             Não afirmamos "guardado no telefone" — o WebView muitas vezes só abre o PDF. */
          if (result && result.ok) {
            _bpPdfMarkDone(dlBtn);
            if (typeof toast === 'function') {
              toast('PDF aberto.', 'success', { duration: 3000 });
            }
          } else {
            if (typeof toast === 'function') {
              toast('PDF não gerado.', 'error', { duration: 3500 });
            }
          }
        }, 280);
      } catch (e) {
        _bpPdfSpin(dlBtn, false);
        if (typeof toast === 'function') toast('Falha ao gerar PDF.', 'error', { duration: 4000 });
      }
      return;
    }
  }, true);

  global.BP_IA_Relatorio = {
    construirDados: construirDados,
    descarregar: descarregar,
    anexarNaUltimaBolha: anexarNaUltimaBolha,
    makePdfBlob: makePdfBlob,
    isRelator: isRelator,
    detectarPeriodo: detectarPeriodo
  };
})(typeof window !== 'undefined' ? window : this);
