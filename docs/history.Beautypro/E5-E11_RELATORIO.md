# BelezaPro — Pacote E5 → E11

**Data:** 2026-08-29  
**CACHE_NAME:** `belezapro-shell-v20260829-e11`

## Etapas neste pacote

| ID | Tema |
|----|------|
| E5 | Blindagem race marketing + notify + avatar |
| E6 | Defer ops-crm |
| E7 | Defer equipa |
| E8 | Defer finance + gestão + expirar |
| E9 | Prefetch finance em openVendaModal |
| E10 | Extracção list-writers (notify + dual write) |
| E11 | Migrar CRUD restante para bpList*; silent cascades; idEq |

Inclui também sinks XSS agenda (E2–E4) nos UI tocados para deploy coerente.

## Ficheiros

```
index.html
sw.js
boot/main.js
core/list-writers.js          ← NOVO
core/crud-operations.js
ui/menu-accordion.js
ui/vendas-modais.js
ui/ui-render-clientes-caixa-equipa.js
ui/ui-render-dashboard-agenda.js
docs/E5-E11_RELATORIO.md
LEIA-ME.txt
```

## Deploy

1. Copiar preservando pastas sobre o projecto actual.
2. Hard refresh / limpar dados do site (novo CACHE_NAME e11).
3. Validar: login, agenda, clientes, venda (comissões), menu Marketing/Ops/Equipa/Finance/Gestão.

## Não incluído (não alterado nestas etapas)

sync-queue, auth, db-indexeddb, store.js, state.js, features/*.js (só diferidos, ficheiros iguais)
