/*! BelezaPro — ia-contract.js (Fase 1)
 * Fonte de verdade da aba IA. Carregar ANTES de ia-module.js.
 */
(function (global) {
  'use strict';

  var BP_IA = {
    NOME: 'Benza',
    PAPEL_UI: 'Agente IA',
    STATUS: {
      READY: 'IA pronta',
      OFFLINE: 'Sem rede',
      BUSY: 'A processar…',
      ERROR: 'Indisponível',
      NEUTRAL: '—'
    },
    HEADER_LABEL: {
      OK: 'Ligado',
      OFFLINE: 'Sem rede',
      BUSY: 'A trabalhar',
      ERROR: 'Erro',
      NEUTRAL: '—'
    },
    /* Fase 3 — ids estáveis */
    HABILIDADES: [
      { id: 'consultor', label: 'Consultor' },
      { id: 'construtor', label: 'Construtor' },
      { id: 'relator', label: 'Relator' }
    ],
    HABILIDADE_DEFAULT: 'consultor',
    /* Fase 2 — título humano do bloco de insights (substituir «Insights automáticos») */
    INSIGHTS_TITULO: 'Benza visão ampla',
    EMPTY_TITLE: 'O que quer descobrir?',
    EMPTY_SUB: 'Eu analiso os dados do seu salão e mostro o que merece a sua atenção.',
    PLACEHOLDERS: [
      'Como está o desempenho do salão hoje?',
      'Quanto entrou no caixa hoje?',
      'Quem não vem há mais de 30 dias?',
      'Qual serviço mais faturou esta semana?',
      'A agenda de amanhã está preenchida?',
      'O fluxo de hoje está acima do habitual?'
    ],
    VERSION: 'f4-20260907'
  };

  global.BP_IA = BP_IA;

  try {
    document.documentElement.setAttribute('data-bp-ia-contract', BP_IA.VERSION);
  } catch (_) {}
})(typeof window !== 'undefined' ? window : this);
