/**
 * F4.1 — testes de caracterização (Node, sem Vitest obrigatório).
 * node docs/fase2/tests/state-writers-policy.test.js
 */
import {
  BUSINESS_LIST_KEYS,
  UI_FILTER_KEYS,
  mayBulkReplaceList,
  mayWriteUiFilter,
  featureShouldAvoidBulkListWrite,
  prefersStoreApiForNewCode,
} from '../domain/pure/state-writers-policy.mjs';

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  OK', msg); }
  else { failed++; console.error('  FAIL', msg); }
}

console.log('F4.1 state-writers-policy');

assert(BUSINESS_LIST_KEYS.includes('clientes'), 'clientes is business list');
assert(BUSINESS_LIST_KEYS.includes('movimentos'), 'movimentos is business list');
assert(!BUSINESS_LIST_KEYS.includes('filtroClientes'), 'filtro is not business list');

assert(mayBulkReplaceList('core/crud-operations.js', 'clientes') === true, 'CRUD may bulk clientes');
assert(mayBulkReplaceList('core/sync-rest.js', 'agendamentos') === true, 'sync-rest may bulk');
assert(mayBulkReplaceList('features/gestao-fase78.js', 'clientes') === false, 'feature may not bulk clientes');
assert(mayBulkReplaceList('ui/eventos-caixa-vendas.js', 'clientes') === false, 'UI may not bulk clientes');

assert(mayWriteUiFilter('ui/ui-render-dashboard-agenda.js', 'dashPeriodo') === true, 'dash UI filter');
assert(mayWriteUiFilter('charts/chart-module.js', 'chartPeriodo') === true, 'chart filter');
assert(mayWriteUiFilter('features/x.js', 'dashPeriodo') === false, 'unknown feature no filter write');

assert(featureShouldAvoidBulkListWrite('features/gestao-fase78.js', 'clientes') === true, 'feature avoid bulk');
assert(featureShouldAvoidBulkListWrite('core/crud-operations.js', 'clientes') === false, 'CRUD not feature');

assert(prefersStoreApiForNewCode() === true, 'prefer store for new code');
assert(UI_FILTER_KEYS.includes('agendaDataAtual'), 'agenda date is UI key');

console.log('');
console.log(failed === 0 ? `PASS ${passed}` : `FAIL ${failed} / ${passed + failed}`);
process.exit(failed === 0 ? 0 : 1);
