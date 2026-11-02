# BelezaPro — E1–E5 (State · XSS · Boot · Blindagem)

**Data:** 2026-08-29  
**Método:** EVIDÊNCIA → [C]/[H]/[N] → CONTRATO → PATCH MÍNIMO → VALIDAR → PARAR  

## Objectivo
Domar sem destruir: um caminho de notify, sinks XSS fechados, marketing fora do parse crítico, inconsistências das próprias etapas eliminadas.

## Etapas

| ID | Tema | Resultado |
|----|------|-----------|
| E1 | State notify | `_bpNotifyLists` nos caminhos com double/miss |
| E2 | XSS `renderAgendaItem` | `data-*` com `escHtml` |
| E3 | Boot marketing | script removido do `index.html`; loader em `boot/main.js` |
| E4 | XSS “próximos” | `data-agenda-id` + allowlist `src` |
| E5 | Blindagem | race menu marketing, null-safe ids, SW cache, export helper |

## Ficheiros neste pacote

```
index.html
sw.js
boot/main.js
core/crud-operations.js
ui/ui-render-dashboard-agenda.js
ui/ui-render-clientes-caixa-equipa.js
ui/menu-accordion.js
docs/E1-E5_RELATORIO.md
```

## Contratos preservados
F1 tenant/DLQ · F2B payload/intent/outbox/lock · F3.2 ownership · hideSplash em boot · charts/IA/desktop diferidos · openModal idempotente

## Não feito (de propósito)
- Migrar **todo** o CRUD para `_bpNotifyLists` (legado `if (!(subscribe)) updateUI` é equivalente)
- Diferir os outros 6 `features/*` (1 grupo por fase)
- RLS JWT live / TTI Android **[N]**
- React / Vite / reescrita Sync

## Deploy
1. Copiar ficheiros preservando pastas.
2. Hard refresh / limpar dados do site (CACHE_NAME: `belezapro-shell-v20260829-e5`).
3. Validar: login, lista clientes, agenda, menu Marketing (1.ª abertura pode mostrar “A carregar…”).

## Validação local
`node --check` em todos os JS do pacote → OK
