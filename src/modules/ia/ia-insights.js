/*! BelezaPro — ia-insights.js (Fase 2)
 * Título humano + copy de insights. Carregar após ia-contract.js, antes ou com ia-module.
 */
(function (global) {
  'use strict';

  function titulo() {
    return (global.BP_IA && global.BP_IA.INSIGHTS_TITULO) || 'Benza visão ampla';
  }

  function applyTitulo() {
    var el = document.getElementById('ia-insights-titulo');
    if (el) el.textContent = titulo();
  }

  /** Textos humanos — valores já formatados (fmtKz / números) */
  var copy = {
    semVendasHoje: function (mediaFmt) {
      return 'Hoje ainda não entrou dinheiro no caixa. Nos últimos 7 dias, em média, o salão fez <strong>' +
        mediaFmt + '</strong> por dia.';
    },
    ticketVariacao: function (subiu, pct) {
      return 'Hoje, o valor médio por atendimento ' + (subiu ? 'subiu' : 'desceu') +
        ' <strong>' + pct + '%</strong> face aos últimos dias com vendas.';
    },
    clientesInactivos: function (n) {
      if (n === 1) {
        return 'Há <strong>1 cliente</strong> que não aparece há mais de 30 dias — vale a pena ligar ou mandar mensagem.';
      }
      return 'Há <strong>' + n + ' clientes</strong> que não aparecem há mais de 30 dias — vale a pena retomar o contacto.';
    },
    servicoConcentra: function (nomeHtml, pct, forte) {
      return 'O serviço «<strong>' + nomeHtml + '</strong>» representa <strong>' + pct +
        '%</strong> do que faturou esta semana' +
        (forte ? ' — quase tudo depende deste serviço.' : '.');
    },
    servicoSemItens: function () {
      return 'Há faturação esta semana, mas sem detalhe por serviço nas vendas — o ranking fica limitado.';
    },
    fluxoVsMedia: function (abaixo, fundoFmt) {
      var t = abaixo
        ? 'Depois das despesas, o dia está <strong>abaixo</strong> do habitual dos últimos 30 dias.'
        : 'Depois das despesas, o dia está <strong>acima</strong> do habitual dos últimos 30 dias.';
      if (fundoFmt) t += ' Fundo de caixa: ' + fundoFmt + '.';
      return t;
    },
    soFundo: function (fundoFmt) {
      return 'Hoje ainda não houve movimentos. O fundo de caixa está em <strong>' + fundoFmt + '</strong>.';
    },
    agendaAmanha: function (n) {
      if (n === 1) return 'Amanhã já tem <strong>1 marcação</strong> na agenda.';
      return 'Amanhã já tem <strong>' + n + ' marcações</strong> na agenda.';
    },
    agendaAmanhaVazia: function () {
      return 'Ainda <strong>não há marcações</strong> para amanhã — convém ir preenchendo a agenda.';
    },
    atrasados: function (n) {
      if (n === 1) {
        return 'Há <strong>1 marcação de hoje</strong> em atraso — finalize ou actualize o estado.';
      }
      return 'Há <strong>' + n + ' marcações de hoje</strong> em atraso — finalize ou actualize o estado.';
    },
    vazio: function () {
      return 'Ainda não há dados suficientes para apontar o que merece atenção.';
    },
    aCarregar: function () {
      return 'A preparar o que merece atenção…';
    }
  };

  global.BP_IA_Insights = {
    titulo: titulo,
    applyTitulo: applyTitulo,
    copy: copy
  };

  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyTitulo);
    } else {
      applyTitulo();
    }
  } catch (_) {}
})(typeof window !== 'undefined' ? window : this);
