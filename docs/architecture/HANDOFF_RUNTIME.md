# HANDOFF RUNTIME — verdade operacional (pós-migração estrutural)

**Data:** 2026-08-30  
**Fonte de verdade de paths:** este documento + `index.html`  
**O HANDOFF.md na raiz é histórico** (paths pré-`src/`). Não o usar para editar ficheiros.

---

## 1. Runtime real

```
index.html (scripts clássicos ordenados)
  → src/core/**  (window.*)
  → IndexedDB + localStorage
  → Sync Queue + DLQ
  → Supabase
  → src/modules/** · src/ui/** · src/media/** · src/charts/**
  → src/app/main.js (init + deferred)
  → experiments/piloto-legacy (ESM paralelo)
```

## 2. Core (ordem crítica — não inverter)

| Ordem | Path |
|-------|------|
| 1 | `src/core/shared/constants.js` |
| 2 | `src/core/shared/utils.js` |
| 3 | `src/app/hide-splash.js` |
| 4 | `src/core/state/state.js` |
| 5 | `src/core/state/store.js` |
| 6 | `src/core/state/list-writers.js` |
| 7 | `src/core/storage/db-indexeddb.js` |
| 8 | `src/core/api/supabase-resilience.js` |
| 9 | `src/core/auth/auth-supabase.js` |
| 10… | `src/core/sync/sync-*.js` (policy → … → queue → ui → scheduler) |
| | `src/core/sync/sync-rest.js` |
| | `app.bundle.js` (shell) |
| | `src/core/shared/plano-limites.js` |
| | `src/core/shared/crud-operations.js` |

**Regra:** `db-indexeddb` **antes** de `sync-queue` (monkey-patch `dbPut`).

## 3. Ownership de renders (contrato vivo)

| Hub | Dono (`_bpOwner` / authority) | Path actual |
|-----|-------------------------------|-------------|
| `renderClientes` | `modules/clientes` | `src/modules/clientes/clientes-render.js` |
| `renderProfissionais` | `modules/clientes` | idem (ainda partilhado — dívida etapa 2) |
| `renderCaixa` / `renderServicos` | mesmo ficheiro | dívida etapa 2 |
| Dashboard/Agenda UI | `modules/dashboard` | `src/modules/dashboard/dashboard-render.js + agenda-board.js` (dívida etapa 3) |

Media **não** reassign `window.render*`: usa `__bpAfterRenderClientes` / `__bpAfterRenderProfissionais`.

Policy pura: `docs/fase2/domain/pure/ownership-policy.mjs`

## 4. Modules — estado factual (não o ideal)

| Pasta | Ficheiros reais | Dívida |
|-------|-----------------|--------|
| agenda | agenda-render, expirar-agendamento | falta entry; parte do render ainda em dashboard |
| clientes | clientes-render | só clientes (etapa 2 concluída) |
| caixa | caixa-vendas-events | render caixa noutro sítio |
| dashboard | dashboard-agenda-render, bp-resumo-kpi | separados (etapa 3) |
| equipa / financeiro / marketing / crm / ia / vendas / servicos / configuracoes | 1–2 ficheiros cada | padrão entry/render/events incompleto |
| src/domain/ | **vazio** | policies em docs/fase2/domain |

## 5. Gates protegidos (inalterados)

Auth, state, IndexedDB, Sync Queue/DLQ, `salao_id`, `dbPut`/`dbDelete`, SW, REST merge, RLS servidor.

## 6. CACHE SW

`belezapro-shell-v20260830-mig1`

## 7. Metodologia

```
EVIDÊNCIA → [C]/[H]/[N] → DECISÃO → ALTERAÇÃO MÍNIMA → VALIDAR NO TELEMÓVEL → PARAR
```

Não Vite. Não Big Bang. Uma fatia de domínio de cada vez.


## API pública

Ver `docs/architecture/MODULE_API.md` (contrato window.* por domínio).

## Etapa 5 — fecho arquitectura por responsabilidade

- `src/domain/pure` canónico (9 policies)
- `form-events.js` em `src/app/` (wiring transversal, não “servicos”)
- `styles/` por camadas: foundation / layout / components / modules / themes
- Documento mestre: `docs/architecture/ARCHITECTURE.md`
- CACHE: `belezapro-shell-v20260830-m5`
