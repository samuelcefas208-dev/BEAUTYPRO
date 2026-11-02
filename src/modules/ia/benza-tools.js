/* BelezaPro B4 — benza-tools extraído do monólito
 * Carregar APÓS app.bundle.js e ia/ia-module.js (CRUD + contexto IA).
 */

// ====================================================================
//  benza-tools.js — Camada segura entre a Benza e o sistema real
//  NÃO chama Supabase directamente.
//  Usa exclusivamente as funções CRUD existentes (addCliente, etc.).
//  Carregar DEPOIS de crud-operations.js e ia-module.js (ver ORDER).
// ====================================================================
(function () {
  "use strict";

  // ----------------------------------------------------------
  // UTILITÁRIOS
  // ----------------------------------------------------------
  function ok(data, extra) {
    extra = extra || {};
    return Object.assign({ ok: true, data: data }, extra);
  }

  function erro(codigo, mensagem, extra) {
    extra = extra || {};
    return Object.assign({ ok: false, codigo: codigo, mensagem: mensagem }, extra);
  }

  function exigirConfirmacao(operacao, dados) {
    return {
      ok: false,
      precisa_confirmacao: true,
      operacao: operacao,
      dados: dados
    };
  }

  function obterFuncao(nome) {
    var fn = null;
    if (typeof window !== "undefined" && typeof window[nome] === "function") {
      fn = window[nome];
    } else if (typeof globalThis !== "undefined" && typeof globalThis[nome] === "function") {
      fn = globalThis[nome];
    }
    if (typeof fn !== "function") {
      throw new Error("TOOL_NOT_IMPLEMENTED:" + nome);
    }
    return fn;
  }

  function obterState() {
    if (typeof window !== "undefined" && window.state && typeof window.state === "object") {
      return window.state;
    }
    if (typeof state !== "undefined" && state && typeof state === "object") {
      return state;
    }
    return null;
  }

  // ----------------------------------------------------------
  // CONSULTAS (read-only)
  // ----------------------------------------------------------
  function clientes() {
    try {
      var st = obterState();
      if (!st || !Array.isArray(st.clientes)) {
        return erro("DADOS_INDISPONIVEIS", "Os dados de clientes não estão disponíveis.");
      }
      var lista = st.clientes.filter(function (c) {
        return c && c.ativo !== false && c.ativo !== 0 && c.ativo !== "false";
      });
      return ok(lista);
    } catch (e) {
      return erro("ERRO_CLIENTES", e && e.message ? e.message : String(e));
    }
  }

  function agendamentos() {
    try {
      var st = obterState();
      if (!st || !Array.isArray(st.agendamentos)) {
        return erro("DADOS_INDISPONIVEIS", "Os dados de agendamentos não estão disponíveis.");
      }
      return ok(st.agendamentos);
    } catch (e) {
      return erro("ERRO_AGENDAMENTOS", e && e.message ? e.message : String(e));
    }
  }

  function movimentos() {
    try {
      var st = obterState();
      if (!st || !Array.isArray(st.movimentos)) {
        return erro("DADOS_INDISPONIVEIS", "Os movimentos não estão disponíveis.");
      }
      return ok(st.movimentos);
    } catch (e) {
      return erro("ERRO_MOVIMENTOS", e && e.message ? e.message : String(e));
    }
  }

  function profissionais() {
    try {
      var st = obterState();
      if (!st || !Array.isArray(st.profissionais)) {
        return erro("DADOS_INDISPONIVEIS", "Os profissionais não estão disponíveis.");
      }
      var lista = st.profissionais.filter(function (p) {
        return p && p.ativo !== false && p.ativo !== 0 && p.ativo !== "false";
      });
      return ok(lista);
    } catch (e) {
      return erro("ERRO_PROFISSIONAIS", e && e.message ? e.message : String(e));
    }
  }

  function servicos() {
    try {
      var st = obterState();
      if (!st || !Array.isArray(st.servicos)) {
        return erro("DADOS_INDISPONIVEIS", "Os serviços não estão disponíveis.");
      }
      var lista = st.servicos.filter(function (s) {
        return s && s.ativo !== false && s.ativo !== 0 && s.ativo !== "false";
      });
      return ok(lista);
    } catch (e) {
      return erro("ERRO_SERVICOS", e && e.message ? e.message : String(e));
    }
  }

  // ----------------------------------------------------------
  // CRIAR CLIENTE
  // ----------------------------------------------------------
  async function criarCliente(dados) {
    try {
      if (!dados || typeof dados !== "object") {
        return erro("DADOS_INVALIDOS", "Dados do cliente inválidos.");
      }
      if (!dados.nome || !String(dados.nome).trim()) {
        return erro("NOME_OBRIGATORIO", "O nome do cliente é obrigatório.");
      }
      if (!dados.telefone || !String(dados.telefone).trim()) {
        return erro("TELEFONE_OBRIGATORIO", "O telefone do cliente é obrigatório.");
      }
      var addCliente = obterFuncao("addCliente");
      var cliente = await addCliente({
        nome: String(dados.nome).trim(),
        telefone: String(dados.telefone).trim(),
        notas: dados.notas != null ? String(dados.notas) : undefined
      });
      if (!cliente) {
        return erro(
          "CLIENTE_NAO_CRIADO",
          "O cliente não foi criado. A validação do sistema recusou a operação (telefone inválido, nome duplicado ou limite de plano)."
        );
      }
      return ok(cliente);
    } catch (e) {
      return erro("ERRO_CRIAR_CLIENTE", e && e.message ? e.message : String(e));
    }
  }

  // ----------------------------------------------------------
  // CRIAR AGENDAMENTO
  // ----------------------------------------------------------
  async function criarAgendamento(dados, confirmado) {
    if (!confirmado) {
      return exigirConfirmacao("criar_agendamento", dados);
    }
    try {
      if (!dados || typeof dados !== "object") {
        return erro("DADOS_INVALIDOS", "Dados do agendamento inválidos.");
      }
      if (!dados.profissional_id) {
        return erro("PROFISSIONAL_OBRIGATORIO", "É necessário identificar o profissional.");
      }
      if (!dados.data || !dados.hora) {
        return erro("DATA_HORA_OBRIGATORIAS", "É necessário indicar data e hora.");
      }
      var addAgendamento = obterFuncao("addAgendamento");
      var agendamento = await addAgendamento({
        data: String(dados.data).trim(),
        hora: String(dados.hora).trim().slice(0, 5),
        profissional_id: dados.profissional_id,
        profissional: dados.profissional || "",
        cliente: dados.cliente || "",
        cliente_id: dados.cliente_id || null,
        servico: dados.servico || "",
        preco: dados.preco != null ? Number(dados.preco) : undefined
      });
      if (!agendamento) {
        return erro(
          "AGENDAMENTO_NAO_CRIADO",
          "O agendamento não foi criado. Pode existir conflito de horário, data no passado, profissional em falta ou limite de plano."
        );
      }
      return ok(agendamento);
    } catch (e) {
      return erro("ERRO_CRIAR_AGENDAMENTO", e && e.message ? e.message : String(e));
    }
  }

  // ----------------------------------------------------------
  // REGISTAR DESPESA
  // ----------------------------------------------------------
  async function registarDespesa(dados, confirmado) {
    if (!confirmado) {
      return exigirConfirmacao("registar_despesa", dados);
    }
    try {
      if (!dados || typeof dados !== "object") {
        return erro("DADOS_INVALIDOS", "Dados da despesa inválidos.");
      }
      var valor = Number(dados.valor);
      if (!Number.isFinite(valor) || valor <= 0) {
        return erro("VALOR_INVALIDO", "O valor da despesa deve ser superior a zero.");
      }
      var addMovimento = obterFuncao("addMovimento");
      var movimento = await addMovimento({
        tipo: "despesa",
        valor: valor,
        descricao: dados.descricao ? String(dados.descricao).trim() : ""
      });
      if (!movimento) {
        return erro("DESPESA_NAO_REGISTADA", "A despesa não foi registada.");
      }
      return ok(movimento);
    } catch (e) {
      return erro("ERRO_REGISTAR_DESPESA", e && e.message ? e.message : String(e));
    }
  }

  // ----------------------------------------------------------
  // CANCELAR AGENDAMENTO
  // ----------------------------------------------------------
  async function cancelarAgendamento(id, confirmado) {
    if (!id) {
      return erro("ID_OBRIGATORIO", "É necessário identificar o agendamento.");
    }
    if (!confirmado) {
      return exigirConfirmacao("cancelar_agendamento", { id: id });
    }
    try {
      var updateAgendamento = obterFuncao("updateAgendamento");
      var resultado = await updateAgendamento(id, { status: "cancelado" });
      if (!resultado) {
        return erro(
          "AGENDAMENTO_NAO_CANCELADO",
          "O agendamento não foi cancelado. Pode faltar permissão (admin/gerente) ou o registo não existir."
        );
      }
      return ok(resultado);
    } catch (e) {
      return erro("ERRO_CANCELAR_AGENDAMENTO", e && e.message ? e.message : String(e));
    }
  }

  // ----------------------------------------------------------
  // CATÁLOGO OFICIAL DE TOOLS
  // ----------------------------------------------------------
  var BENZA_TOOLS = {
    "customer.list": {
      descricao: "Consultar clientes activos.",
      tipo: "read",
      confirmacao: false,
      executar: clientes
    },
    "appointment.list": {
      descricao: "Consultar agendamentos.",
      tipo: "read",
      confirmacao: false,
      executar: agendamentos
    },
    "sales.list": {
      descricao: "Consultar movimentos de vendas e despesas.",
      tipo: "read",
      confirmacao: false,
      executar: movimentos
    },
    "team.list": {
      descricao: "Consultar profissionais activos.",
      tipo: "read",
      confirmacao: false,
      executar: profissionais
    },
    "service.list": {
      descricao: "Consultar serviços activos.",
      tipo: "read",
      confirmacao: false,
      executar: servicos
    },
    "customer.create": {
      descricao: "Criar cliente.",
      tipo: "write",
      confirmacao: true,
      executar: criarCliente
    },
    "appointment.create": {
      descricao: "Criar agendamento.",
      tipo: "write",
      confirmacao: true,
      executar: criarAgendamento
    },
    "expense.create": {
      descricao: "Registar despesa.",
      tipo: "write",
      confirmacao: true,
      executar: registarDespesa
    },
    "appointment.cancel": {
      descricao: "Cancelar agendamento.",
      tipo: "write",
      confirmacao: true,
      executar: cancelarAgendamento
    }
  };

  // ----------------------------------------------------------
  // EXPOSIÇÃO GLOBAL
  // ----------------------------------------------------------
  window.BenzaTools = {
    listar: function () {
      return Object.keys(BENZA_TOOLS);
    },
    existe: function (nome) {
      return !!BENZA_TOOLS[nome];
    },
    obter: function (nome) {
      return BENZA_TOOLS[nome] || null;
    },
    catalogo: function () {
      return Object.keys(BENZA_TOOLS).map(function (k) {
        var t = BENZA_TOOLS[k];
        return {
          nome: k,
          descricao: t.descricao,
          tipo: t.tipo,
          confirmacao: !!t.confirmacao
        };
      });
    },
    executar: async function (nome) {
      var args = Array.prototype.slice.call(arguments, 1);
      var tool = BENZA_TOOLS[nome];
      if (!tool) {
        return erro("TOOL_INEXISTENTE", "Essa operação não está disponível para a Benza.");
      }
      if (tool.confirmacao && tool.tipo === "write") {
        var tok = null;
        try { tok = window.__bpIaAuthToken; } catch (_) { tok = null; }
        if (!tok || tok.tool !== nome) {
          return exigirConfirmacao(nome, args[0] || {});
        }
        try { window.__bpIaAuthToken = null; } catch (_) {}
      }
      try {
        return await tool.executar.apply(null, args);
      } catch (e) {
        return erro("TOOL_ERROR", e && e.message ? e.message : String(e));
      }
    }
  };
})();

