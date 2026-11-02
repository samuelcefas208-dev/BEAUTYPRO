# Manifesto E1–E19 (pacote consolidado)

## Origem
| Intervalo | Fonte |
|-----------|--------|
| E1–E5 | belezapro-E1-E5.zip |
| E5–E11 | belezapro-E5-E11.zip |
| E11–E19 | belezapro-E11-E19.zip |

**Regra de merge:** etapa posterior prevalece no mesmo caminho de ficheiro.

## Árvore do pacote

```
belezapro-E1-E19/
  LEIA-ME.txt
  index.html
  sw.js
  boot/main.js
  core/
    utils.js
    list-writers.js
    crud-operations.js
    sync-policy.js
    sync-tombstone.js
    sync-dlq.js
    sync-queue-store.js
    sync-outbox.js
    sync-lock.js
    sync-recover.js
    sync-queue.js
    sync-ui.js
    sync-scheduler.js
  ui/
    menu-accordion.js
    vendas-modais.js
    ui-render-clientes-caixa-equipa.js
    ui-render-dashboard-agenda.js
    detalhes-acessibilidade.js
    agenda-polish.js
    eventos-cadastros.js
    eventos-caixa-vendas.js
  features/
    finance-fase1-extra.js
  docs/
    …
```

## Notas
- Ficheiros do projecto **não** listados aqui (ex.: `state.js`, `auth-supabase.js`, `sync-rest.js`) mantêm-se da árvore base do dono.
- Features restantes (marketing, ops, equipa, …) continuam no disco do projecto; o boot carrega-as diferidas.
