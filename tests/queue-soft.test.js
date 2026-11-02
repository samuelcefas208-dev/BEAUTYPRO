/**
 * BelezaPro — testes unitários FASE 1 (fila soft-delete)
 * Executar: node tests/queue-soft.test.js
 * Sem DOM / sem rede — só lógica pura extraída de sync-queue.js
 */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var srcPath = path.join(__dirname, '../src/core/sync-queue.js');
var src = fs.readFileSync(srcPath, 'utf8');

// Extrair helpers puros do ficheiro fonte (garante que testamos o código real)
function extractFn(name) {
  var re = new RegExp('function ' + name + '\\([\\s\\S]*?\\n\\}\\n');
  var m = src.match(re);
  if (!m) throw new Error('Função não encontrada no fonte: ' + name);
  return m[0];
}

var sandbox = { Date: Date, Object: Object, Array: Array, String: String, console: console };
vm.createContext(sandbox);
vm.runInContext(
  extractFn('bpIsSoftIntent') +
  extractFn('bpBuildSoftPayload') +
  extractFn('bpNormalizeQueueOps'),
  sandbox
);

var bpIsSoftIntent = sandbox.bpIsSoftIntent;
var bpBuildSoftPayload = sandbox.bpBuildSoftPayload;
var bpNormalizeQueueOps = sandbox.bpNormalizeQueueOps;

var passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    console.error('  ✗ ' + name);
    console.error('    ' + (e && e.message ? e.message : e));
    process.exitCode = 1;
  }
}

console.log('BelezaPro queue soft-delete tests\n');

test('bpIsSoftIntent: ativo false', function () {
  assert.strictEqual(bpIsSoftIntent({ ativo: false }), true);
  assert.strictEqual(bpIsSoftIntent({ ativo: 0 }), true);
  assert.strictEqual(bpIsSoftIntent({ ativo: 'false' }), true);
});

test('bpIsSoftIntent: deleted_at', function () {
  assert.strictEqual(bpIsSoftIntent({ deleted_at: '2026-01-01T00:00:00.000Z' }), true);
});

test('bpIsSoftIntent: status cancelado', function () {
  assert.strictEqual(bpIsSoftIntent({ status: 'cancelado' }), true);
  assert.strictEqual(bpIsSoftIntent({ status: 'CANCELADO' }), true);
});

test('bpIsSoftIntent: activo normal', function () {
  assert.strictEqual(bpIsSoftIntent({ ativo: true, nome: 'Ana' }), false);
  assert.strictEqual(bpIsSoftIntent({ status: 'agendado' }), false);
  assert.strictEqual(bpIsSoftIntent(null), false);
});

test('bpBuildSoftPayload: clientes', function () {
  var s = bpBuildSoftPayload('clientes', { id: 'u1', nome: 'Ana', ativo: true }, 'u1');
  assert.strictEqual(s.id, 'u1');
  assert.strictEqual(s.ativo, false);
  assert.ok(s.deleted_at);
  assert.ok(s.updated_at);
  assert.strictEqual(s.nome, 'Ana');
});

test('bpBuildSoftPayload: profissionais inclui data_desativacao', function () {
  var s = bpBuildSoftPayload('profissionais', { id: 'p1', nome: 'João' }, 'p1');
  assert.strictEqual(s.ativo, false);
  assert.ok(s.data_desativacao);
  assert.ok(s.deleted_at);
});

test('bpBuildSoftPayload: agendamentos → status cancelado', function () {
  var s = bpBuildSoftPayload('agendamentos', { id: 'a1', status: 'agendado' }, 'a1');
  assert.strictEqual(s.status, 'cancelado');
  assert.ok(s.deleted_at);
});

test('bpBuildSoftPayload: movimentos → status cancelado + cancelado_em', function () {
  var s = bpBuildSoftPayload('movimentos', { id: 'm1', status: 'activo', valor: 1000 }, 'm1');
  assert.strictEqual(s.status, 'cancelado');
  assert.ok(s.cancelado_em);
  assert.strictEqual(s.valor, 1000);
});

test('bpNormalizeQueueOps: delete → upsert soft', function () {
  var ops = bpNormalizeQueueOps([
    { id: 'op1', tabela: 'clientes', operacao: 'delete', payload: { id: 'c1', nome: 'X' } },
    { id: 'op2', tabela: 'clientes', operacao: 'upsert', payload: { id: 'c2', nome: 'Y', ativo: true } }
  ]);
  assert.strictEqual(ops.length, 2);
  assert.strictEqual(ops[0].operacao, 'upsert');
  assert.strictEqual(ops[0].payload.ativo, false);
  assert.ok(ops[0].payload.deleted_at);
  assert.strictEqual(ops[1].operacao, 'upsert');
  assert.strictEqual(ops[1].payload.ativo, true);
});

test('bpNormalizeQueueOps: idempotente em soft já normalizado', function () {
  var once = bpNormalizeQueueOps([
    { id: 'op1', tabela: 'servicos', operacao: 'delete', payload: { id: 's1' } }
  ]);
  var twice = bpNormalizeQueueOps(once);
  assert.strictEqual(twice[0].operacao, 'upsert');
  assert.strictEqual(twice[0].payload.ativo, false);
});

test('bpNormalizeQueueOps: array vazio / inválido', function () {
  assert.strictEqual(bpNormalizeQueueOps([]).length, 0);
  assert.strictEqual(Array.isArray(bpNormalizeQueueOps(null)), true);
  assert.strictEqual(bpNormalizeQueueOps(null).length, 0);
  assert.strictEqual(bpNormalizeQueueOps(undefined).length, 0);
});

test('soft não reactiva: softIntent bloqueia false em payload activo', function () {
  // Documenta contrato: reactivação exige removeDeletedItem + payload sem soft
  assert.strictEqual(bpIsSoftIntent({ id: 'c1', ativo: true }), false);
  assert.strictEqual(bpIsSoftIntent({ id: 'c1', ativo: false }), true);
});

console.log('\n' + passed + ' testes passaram.');
if (process.exitCode) {
  console.error('FALHA');
  process.exit(1);
}
