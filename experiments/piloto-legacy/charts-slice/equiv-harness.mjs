/**
 * JS-5.4 — Harness de equivalência legado (vm) × ESM
 * node piloto/charts-slice/equiv-harness.mjs
 */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildSerieTemporal as esmSerie,
  buildAnaliseTemporal as esmAnalise,
  intervaloAnteriorEspelhado as esmAnt,
  gerarInsightsTemporais as esmInsights,
} from './analise-temporal.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const legacySrc = fs.readFileSync(
  path.join(__dirname, '../../analise-temporal.js'),
  'utf8'
);

function loadLegacy() {
  const sandbox = {
    console,
    Date,
    Math,
    String,
    Number,
    Object,
    Array,
    parseInt,
    isFinite,
    window: {},
    hoje: () => '2026-08-15',
    fmtKz: (n) => Math.round(Number(n) || 0) + ' Kz',
    formatarDataISO: (d) => {
      return (
        d.getFullYear() +
        '-' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0')
      );
    },
  };
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(legacySrc + '\n;this.__leg = { buildSerieTemporal, buildAnaliseTemporal, intervaloAnteriorEspelhado, gerarInsightsTemporais };', sandbox);
  return sandbox.__leg || {
    buildSerieTemporal: sandbox.window.buildSerieTemporal,
    buildAnaliseTemporal: sandbox.window.buildAnaliseTemporal,
    intervaloAnteriorEspelhado: sandbox.window.intervaloAnteriorEspelhado,
    gerarInsightsTemporais: sandbox.window.gerarInsightsTemporais,
  };
}

const leg = loadLegacy();

function stable(obj) {
  return JSON.stringify(obj, (_k, v) => {
    if (typeof v === 'number' && !Number.isInteger(v)) {
      return Math.round(v * 1e6) / 1e6;
    }
    return v;
  });
}

function stripInsights(a) {
  if (!a || typeof a !== 'object') return a;
  const { insights, _slice, ...rest } = a;
  return rest;
}

let fail = 0;
function check(name, cond, detail) {
  if (!cond) {
    console.error('FAIL', name, detail || '');
    fail++;
  } else console.log('OK', name);
}

const cases = [
  {
    name: 'empty-week',
    intervalo: { inicio: '2026-08-01', fim: '2026-08-07' },
    movs: [],
    opts: {},
  },
  {
    name: 'one-sale',
    intervalo: { inicio: '2026-08-01', fim: '2026-08-01' },
    movs: [{ tipo: 'venda', data: '2026-08-01', valor: 100 }],
    opts: {},
  },
  {
    name: 'multi-ignore-despesa',
    intervalo: { inicio: '2026-08-01', fim: '2026-08-07' },
    movs: [
      { tipo: 'venda', data: '2026-08-01', valor: 1000 },
      { tipo: 'venda', data: '2026-08-01', valor: 500 },
      { tipo: 'venda', data: '2026-08-03', valor: 2000 },
      { tipo: 'despesa', data: '2026-08-01', valor: 99 },
    ],
    opts: {},
  },
  {
    name: 'zero-value',
    intervalo: { inicio: '2026-08-01', fim: '2026-08-02' },
    movs: [{ tipo: 'venda', data: '2026-08-01', valor: 0 }],
    opts: {},
  },
  {
    name: 'negative-value',
    intervalo: { inicio: '2026-08-01', fim: '2026-08-02' },
    movs: [{ tipo: 'venda', data: '2026-08-01', valor: -50 }],
    opts: {},
  },
  {
    name: 'missing-valor',
    intervalo: { inicio: '2026-08-01', fim: '2026-08-02' },
    movs: [{ tipo: 'venda', data: '2026-08-01' }],
    opts: {},
  },
  {
    name: 'out-of-range',
    intervalo: { inicio: '2026-08-01', fim: '2026-08-02' },
    movs: [{ tipo: 'venda', data: '2026-07-01', valor: 999 }],
    opts: {},
  },
  {
    name: 'year-empty',
    intervalo: { inicio: '2026-01-01', fim: '2026-12-31' },
    movs: [],
    opts: {},
  },
  {
    name: 'mid-45d',
    intervalo: { inicio: '2026-07-01', fim: '2026-08-14' },
    movs: [{ tipo: 'venda', data: '2026-07-15', valor: 300 }],
    opts: {},
  },
  {
    name: 'modoHora',
    intervalo: { inicio: '2026-08-10', fim: '2026-08-10' },
    movs: [
      { tipo: 'venda', data: '2026-08-10', hora: '09:30', valor: 100 },
      { tipo: 'venda', data: '2026-08-10', hora: '09:00', valor: 50 },
      { tipo: 'venda', data: '2026-08-10', hora: '03:00', valor: 10 },
    ],
    opts: { modoHora: true },
  },
  {
    name: 'conc-insight',
    intervalo: { inicio: '2026-08-01', fim: '2026-08-03' },
    movs: [
      { tipo: 'venda', data: '2026-08-01', valor: 100, servico_nome: 'Corte' },
      { tipo: 'venda', data: '2026-08-03', valor: 900, servico_nome: 'Coloração' },
    ],
    opts: {},
  },
];

for (const c of cases) {
  const sL = leg.buildSerieTemporal(c.intervalo, c.movs, c.opts);
  const sE = esmSerie(c.intervalo, c.movs, c.opts);
  check(c.name + ':serie', stable(sL) === stable(sE), {
    legLen: sL.length,
    esmLen: sE.length,
  });

  const aL = leg.buildAnaliseTemporal(c.intervalo, c.movs, c.opts);
  const aE = esmAnalise(c.intervalo, c.movs, {
    ...c.opts,
    hoje: () => '2026-08-15',
    fmtKz: (n) => Math.round(Number(n) || 0) + ' Kz',
  });

  check(c.name + ':core', stable(stripInsights(aL)) === stable(stripInsights(aE)));
  check(
    c.name + ':insights',
    stable(aL.insights || []) === stable(aE.insights || []),
    { leg: aL.insights, esm: aE.insights }
  );
}

const antL = leg.intervaloAnteriorEspelhado({
  inicio: '2026-08-01',
  fim: '2026-08-07',
});
const antE = esmAnt({ inicio: '2026-08-01', fim: '2026-08-07' });
check('anterior', stable(antL) === stable(antE));

check('null-serie', stable(leg.buildSerieTemporal(null, [], {})) === stable(esmSerie(null, [], {})));

console.log(fail ? 'EQUIV_FAIL ' + fail : 'EQUIV_OK');
process.exit(fail ? 1 : 0);
