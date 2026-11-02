# OWNERSHIP_MAP — Estado final (Etapas 1–7)

**Data:** 2026-08-30  
**Artefacto:** BelezaPro pós remodularização + etapas 1b–7

Classificação: **[C]** no código do working tree.

## Load path

| Item | Estado |
|------|--------|
| `app.bundle.js` | **Fora do index** (shell em disco só histórico) **[C]** |
| `form-events.js` | **Não carregar** → `app-shell-events.js` |
| `domain-helpers.js` | **Não carregar** → `shared-formatters.js` |
| `caixa-vendas-events.js` | **Não carregar** → `caixa-events` + `vendas-events` |
| CSS híbridos | **Não carregar** → ver `CSS_OWNERSHIP.md` |

## Domínios

| Domínio | Render | Events | CSS |
|---------|--------|--------|-----|
| agenda | agenda-board, agenda-render | agenda-events, expirar (deferred) | menus-agenda |
| clientes | clientes-render | clientes-events | list-items (partilhado) |
| equipa | equipa-render, equipa.js | equipa-events | equipa.css |
| servicos | servicos-render | servicos-events | — |
| vendas | vendas-modais | vendas-events | venda-carrinho |
| caixa | caixa-render | caixa-events | caixa.css |
| dashboard | dashboard-render, bp-resumo-kpi | — | kpis.css, dashboard.css |
| app shell | — | app-shell-events | login.css |
| core | sync/*, state, storage, auth | — | — |

## app/

| Ficheiro | Papel |
|----------|--------|
| main.js | Boot + deferred only |
| boot-migrations.js | One-shot migrations |
| app-shell-events.js | Menu/logout/signup |
| ui-coordinator.js | updateUI por tab |
| hide-splash.js | Splash |
| desktop-* | Shell desktop diferido |

Ver também: `APP_LAYER.md`, `CSS_OWNERSHIP.md`, `SCORECARD_10.md`.
