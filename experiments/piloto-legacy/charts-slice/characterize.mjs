/**
 * Caracterização charts-serie-core (JS-5.2) — executar:
 *   node --input-type=module piloto/charts-slice/characterize.mjs
 * Não altera produção. Não liga à UI.
 */
import {
  buildSerieTemporal,
  buildAnaliseTemporal,
  intervaloAnteriorEspelhado,
  SLICE_VERSION,
} from './analise-temporal.mjs';

let failed = 0;
function assert(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK', name);
}

const empty = buildAnaliseTemporal({ inicio: '2026-08-01', fim: '2026-08-07' }, [], {});
assert('empty hasData', empty.hasData === false);
assert('empty serie 7', empty.serie.length === 7);

const one = buildAnaliseTemporal(
  { inicio: '2026-08-01', fim: '2026-08-01' },
  [{ tipo: 'venda', data: '2026-08-01', valor: 100 }],
  {}
);
assert('one', one.totais.receita === 100 && one.totais.nVendas === 1);

const multi = buildAnaliseTemporal(
  { inicio: '2026-08-01', fim: '2026-08-07' },
  [
    { tipo: 'venda', data: '2026-08-01', valor: 1000 },
    { tipo: 'venda', data: '2026-08-01', valor: 500 },
    { tipo: 'venda', data: '2026-08-03', valor: 2000 },
    { tipo: 'despesa', data: '2026-08-01', valor: 99 },
  ],
  {}
);
assert('multi 3500/3', multi.totais.receita === 3500 && multi.totais.nVendas === 3);
assert('insights is array', Array.isArray(multi.insights));
assert('insights max 3', multi.insights.length <= 3);
// concentração: melhor dia 2000/3500 ≈ 57% → pode gerar insight de concentração
assert('insights strings', multi.insights.every(function (s) { return typeof s === 'string'; }));

assert('null intervalo', buildSerieTemporal(null, [], {}).length === 0);
assert(
  'anterior',
  (() => {
    const a = intervaloAnteriorEspelhado({ inicio: '2026-08-01', fim: '2026-08-07' });
    return a && a.inicio === '2026-07-25' && a.fim === '2026-07-31';
  })()
);

const long = buildSerieTemporal({ inicio: '2026-01-01', fim: '2026-12-31' }, [], {});
assert('year months', long.length >= 12 && long.length <= 13);

const hora = buildSerieTemporal(
  { inicio: '2026-08-10', fim: '2026-08-10' },
  [
    { tipo: 'venda', data: '2026-08-10', hora: '09:30', valor: 100 },
    { tipo: 'venda', data: '2026-08-10', hora: '09:00', valor: 50 },
  ],
  { modoHora: true }
);
assert('modoHora 16', hora.length === 16);
const b9 = hora.find((x) => x.hora === 9);
assert('hora9', b9 && b9.receita === 150);

// medium passo (32+ days): ceil(dias/31)
const mid = buildSerieTemporal({ inicio: '2026-07-01', fim: '2026-08-15' }, [], {});
assert('mid passo buckets < dias', mid.length > 0 && mid.length < 50);

const conc = buildAnaliseTemporal(
  { inicio: '2026-08-01', fim: '2026-08-03' },
  [
    { tipo: 'venda', data: '2026-08-01', valor: 100 },
    { tipo: 'venda', data: '2026-08-03', valor: 900 },
  ],
  {}
);
assert('conc has insight or empty ok', Array.isArray(conc.insights));
if (conc.totais.receita === 1000 && conc.extremos.melhorDia) {
  const pct = Math.round((conc.extremos.melhorDia.receita / conc.totais.receita) * 100);
  assert('conc pct 90', pct === 90);
  assert('conc insight text', conc.insights.some(function (s) { return s.indexOf('concentrou') >= 0; }));
}

console.log('VERSION', SLICE_VERSION);
console.log(failed ? 'CHAR_FAIL ' + failed : 'CHAR_OK');
process.exit(failed ? 1 : 0);
