# Mapa `core/sync-*.js` (BelezaPro E15–E17)

Documentação interna do domínio de sincronização offline-first.

## Ordem de carga (`index.html`)

```
sync-policy.js
sync-tombstone.js
sync-dlq.js
sync-queue-store.js
sync-outbox.js
sync-lock.js
sync-recover.js
sync-queue.js          ← cofre (orquestração)
sync-ui.js
sync-scheduler.js
sync-rest.js           ← REST Supabase (upsert/delete)
```

## Responsabilidades

| Módulo | Responsabilidade | Não faz |
|--------|------------------|---------|
| **sync-policy** | `slimPayload`, `classifySyncFailure` | I/O, UI, flush |
| **sync-tombstone** | Lista negra de eliminados (TTL 30d) | Fila, REST |
| **sync-dlq** | Armazenamento DLQ (zero silent drop) | Modal UI |
| **sync-queue-store** | get/save fila em LS + limites soft/hard | Flush, lock |
| **sync-outbox** | Hidratar / espelhar outbox IDB (F2B.6) | REST |
| **sync-lock** | Lock multi-tab no flush (F2B.7) | Política |
| **sync-recover** | Payload degradado + recover upsert (F2-B.1) | UI |
| **sync-queue** | `addToSyncQueue`, `flushSyncQueue`, intercept `dbPut`/`dbDelete`, retry/reprocess | UI, policy pura |
| **sync-ui** | Banner offline, indicador, modal DLQ | Persistência |
| **sync-scheduler** | Clique no indicador, `online`, visibility, intervalo 25s | Regras de op |
| **sync-rest** | Chamadas Supabase upsert/delete/deactivate | Fila |

## Contratos preservados

- **F1** `salaoId` / isolamento tenant
- **F2B.1** payload degradado
- **F2B.3** no silent drop + classify
- **F2B.5** intent-first + hard-block sem drop
- **F2B.6** outbox IDB + hydrate
- **F2B.7** lock flush + tentativa atómica

## APIs públicas (window)

Principais: `addToSyncQueue`, `flushSyncQueue`, `getSyncQueue`, `saveSyncQueue`,
`getDlq`, `moveOpToDlq`, `bpGetDlqCount`, `isDeletedItem`, `addDeletedItem`,
`hydrateQueueFromIdb`, `withSyncFlushLock`, `bpRetryFailedSync`, `bpReprocessDlq`,
`atualizarIndicadorSync`, `bpOpenDlqModal`, `slimPayload`, `classifySyncFailure`.

## Evolução do cofre

```
~1247 linhas (monólito)
  → ~987 (E15: policy + UI)
  → ~864 (E16: tombstone + DLQ)
  → ~519 (E17: store + outbox + lock + recover + scheduler)
```

## Smoke sugerido (manual no dispositivo)

1. Login com salão válido  
2. DevTools → Network Offline (ou modo avião)  
3. Registar uma venda  
4. Confirmar `getSyncQueue().length >= 1`  
5. Voltar online  
6. Aguardar flush (ou toque no indicador)  
7. `getSyncQueue().length === 0` e `bpGetDlqCount() === 0` (salvo erro real)

