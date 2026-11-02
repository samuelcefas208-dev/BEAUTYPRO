# MODULE_MAP — estado final (etapas 1–5)

## Estrutura de produto

```
src/modules/<domínio>/
```

| Domínio | Ficheiros principais |
|---------|----------------------|
| clientes | `clientes-render.js` |
| caixa | `caixa-render.js`, `caixa-vendas-events.js` |
| equipa | `equipa-render.js`, `equipa.js` |
| servicos | `servicos-render.js` |
| agenda | `agenda-board.js`, `agenda-render.js`, `expirar-agendamento.js` |
| dashboard | `dashboard-render.js`, `bp-resumo-kpi.js` |
| vendas | `vendas-modais.js` |
| financeiro | `financeiro.js`, `comissoes.js` |
| marketing | `marketing.js` |
| crm | `crm-comercial.js` |
| ia | `ia-module.js`, `benza-tools.js` |
| configuracoes | `gestao.js` |

## App (não é domínio de produto)

- `src/app/main.js`, `hide-splash.js`, `ui-coordinator.js`, `form-events.js`, desktop-*

## Domain

- `src/domain/pure/*.mjs` — canónico

## Ver também

- `ARCHITECTURE.md` · `MODULE_API.md` · `HANDOFF_RUNTIME.md` · `NAMING.md`
