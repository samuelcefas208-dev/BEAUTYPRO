/* BelezaPro — src/app/boot-migrations.js
 * Etapa 5: migrações de arranque (one-shot), sem regras de negócio contínuas.
 * Carregar antes de main.js (ou no início de init via chamada explícita).
 */
(function (g) {
  'use strict';

  /**
   * Migração histórica: removeu da fila local ops de profissionais/serviços
   * após limpeza no Supabase. Idempotente via flag localStorage.
   * NÃO adicionar aqui regras de venda/agenda/cliente.
   */
  function bpMigrateSyncQueueFilterProfServ() {
    var FLAG = 'bp_mig_filter_prof_serv_v1';
    try {
      if (localStorage.getItem(FLAG) === '1') return;
    } catch (_) {}
    var SYNC_QUEUE_KEY = 'bp_sync_queue';
    try {
      var raw = localStorage.getItem(SYNC_QUEUE_KEY);
      if (raw) {
        var queue = JSON.parse(raw);
        if (Array.isArray(queue)) {
          var filtered = queue.filter(function (op) {
            return op && op.tabela !== 'profissionais' && op.tabela !== 'servicos';
          });
          localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
        }
      }
      try { localStorage.setItem(FLAG, '1'); } catch (_) {}
    } catch (_) {}
  }


  function bpRestoreUiChrome() {
    try {
      var filtro = localStorage.getItem('bp_filtro_clientes') || 'todos';
      try { if (typeof state !== 'undefined' && state) state.filtroClientes = filtro; } catch (_) {}
      document.querySelectorAll('.filtro-frequencia').forEach(function (b) {
        b.classList.remove('active', 'is-active');
        if (b.dataset.filtro === filtro) b.classList.add('is-active');
      });
    } catch (_) {}
    try {
      var periodo = localStorage.getItem('bp_chart_periodo') || 'semana';
      document.querySelectorAll('.chart-filter').forEach(function (b) {
        b.classList.remove('btn-primary');
        b.classList.add('btn-secondary');
        if (b.dataset.periodo === periodo) {
          b.classList.remove('btn-secondary');
          b.classList.add('btn-primary');
        }
      });
    } catch (_) {}
  }

  function bpRunBootMigrations() {
    bpMigrateSyncQueueFilterProfServ();
    bpRestoreUiChrome();
  }

  g.bpRunBootMigrations = bpRunBootMigrations;
  g.bpMigrateSyncQueueFilterProfServ = bpMigrateSyncQueueFilterProfServ;
  g.bpRestoreUiChrome = bpRestoreUiChrome;
})(typeof window !== 'undefined' ? window : this);
