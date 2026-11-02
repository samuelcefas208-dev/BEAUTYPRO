/* BelezaPro D-4 — core/state.js
 * Extraído de app.bundle.js (FILE: core-state.js).
 *
 * ORDEM: constants → utils → state → store → app.bundle.js → plano-limites
 * Depende de: hoje() (utils) no init de agendaDataAtual.
 * Consumido por: quase todo o runtime (CRUD, Sync, UI, IA, features).
 *
 * CRÍTICO: state e activeTab são `var` + window.* (não use let/const partilhado).
 * Ver docs/D4_CORE_STATE_STORE.md
 */

// ====================================================================
//  CORE — ESTADO GLOBAL (extraído do app.js na Fase B da modularização)
//  Fase D: integrado com core-store.js (subscribe / setState / batch)
// ====================================================================
var state = {
  config: {
    storeName: 'Glamour Beauty',
    fundo: 0,
    plano: (function () {
    try {
      var sid = localStorage.getItem('bp_salao_id_cache');
      if (sid) {
        var ns = localStorage.getItem('bp_plano_cache_' + sid);
        if (ns) return ns;
      }
      return 'trial';
    } catch (_) { return 'trial'; }
  })(),
    trialInicio: null,
    salaoId: null,
    userRole: null,
    userId: null,
  },
  clientes: [],
  agendamentos: [],
  movimentos: [],
  profissionais: [],
  servicos: [],
  fechos_caixa: [],
  agendaDataAtual: (typeof hoje === 'function' ? hoje() : new Date().toISOString().slice(0, 10)),
  histPeriodo: 'hoje',
  // NOTA: o carrinho de vendas vive em cartItems (vendas-modais.js) + localStorage.
  // A chave "carrinho" foi removida para eliminar estado morto/duplicado.
  filtroClientes: 'todos',
  chartPeriodo: localStorage.getItem('bp_chart_periodo') || 'semana',
  chartOffset: parseInt(localStorage.getItem('bp_chart_offset'), 10) || 0,
  chartCustomInicio: localStorage.getItem('bp_chart_custom_inicio') || null,
  chartCustomFim: localStorage.getItem('bp_chart_custom_fim') || null,
  chartMostrarValores: false,
  /* Janela rolante do gráfico (7dias/30dias/90dias): 7 → swipe → 8, 9, 10… */
  chartSpanDays: parseInt(localStorage.getItem('bp_chart_span'), 10) || 0,
  /* Resolução (n.º de barras da série). 0 = usar predefinição do período. */
  chartResBars: parseInt(localStorage.getItem('bp_chart_res'), 10) || 0,


  // Filtro do Dashboard (KPIs / hero) — independente do gráfico
  dashPeriodo: localStorage.getItem('bp_dash_periodo') || 'dia',
  dashOffset: parseInt(localStorage.getItem('bp_dash_offset')) || 0,
  dashCustomInicio: localStorage.getItem('bp_dash_custom_inicio') || null,
  dashCustomFim: localStorage.getItem('bp_dash_custom_fim') || null,
};

// Restaura a última aba visitada neste dispositivo
var activeTab = localStorage.getItem('bp_active_tab') || 'dashboard';

/* D-4: exposição global (scripts clássicos não partilham let) */
if (typeof window !== 'undefined') {
  window.state = state;
  window.activeTab = activeTab;
}
