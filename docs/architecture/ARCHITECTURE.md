# BelezaPro — Arquitectura modular por responsabilidade

**Estado:** 2026-08-30 · pós etapas 1–5  
**Runtime:** scripts clássicos ordenados + `window.*` + offline-first + Supabase  
**Princípio:** organizar por responsabilidade de negócio e fronteira técnica.

## Camadas

```
index.html / sw.js
    │
    ├─ styles/          foundation → layout → components → modules → themes
    ├─ src/core/        state · storage · sync · auth · api · shared
    ├─ src/domain/      políticas puras (contratos / testes)
    ├─ src/modules/     um domínio de produto por pasta
    ├─ src/ui/          helpers transversais (listas, datas, a11y, nav)
    ├─ src/app/         boot, coordinator, form-events, desktop
    ├─ src/media/ · src/charts/
    └─ experiments/     não promovido
```

## Módulos de produto (`src/modules/`)

| Domínio | Responsabilidade | Entrada típica |
|---------|------------------|----------------|
| clientes | lista + estatísticas cliente | `renderClientes` |
| caixa | movimentos + período | `renderCaixa` |
| equipa | profissionais + BPEquipa | `renderProfissionais` |
| servicos | catálogo + selects | `renderServicos` |
| agenda | board + polish + expiração | `renderAgendaFull` |
| dashboard | KPIs + período dash | `renderDashboard` |
| vendas | carrinho + modais | `addToCart` |
| financeiro | BPFinance + comissões | diferido |
| marketing | BPMarketing | diferido |
| crm | BPOps | diferido |
| ia | insights Benza | diferido |
| configuracoes | BPGestao | diferido |

API pública: `MODULE_API.md` · Ownership: `_bpOwner` + `ownership-policy.mjs`

## O que é modular de facto [C]

1. Pastas por domínio de negócio (não por “fase”).  
2. Renders multi-domínio partidos (clientes/caixa/equipa/serviços; dashboard/agenda).  
3. Core isolado em `src/core/*` por fronteira técnica.  
4. Domain policies em `src/domain/pure`.  
5. CSS por camada.  
6. App shell (`form-events`, `ui-coordinator`, boot) fora dos módulos de produto.  
7. Experiments separado da produção.

## Limites honestos (não são falhas escondidas)

- Comunicação runtime ainda via `window.*` (scripts clássicos; sem ESM total).  
- `form-events.js` agrega listeners de vários formulários (wiring de app, não um domínio).  
- Policies de domain **não** são importadas pelo runtime no telemóvel — guiam testes e evolução.  
- RLS Supabase e E2E multi-dispositivo continuam fora deste artefacto frontend.

## Regra de evolução

Código **novo** → módulo ou core correctos + `MODULE_API.md`.  
Código **antigo** → migrar só ao tocar.  
Gates (auth, sync, IDB, salao_id) → contrato explícito.

---

## Actualização Etapa 7 (2026-08-30)

- Runtime **sem** `app.bundle.js` no `index.html`.
- Events de domínio sob `src/modules/<domínio>/*-events.js`.
- `src/app/` limitado a shell + boot (ver `APP_LAYER.md`).
- CSS por ownership (ver `CSS_OWNERSHIP.md`).
- Scorecard: `SCORECARD_10.md`.
