# Smoke: login → offline → venda → online → fila 0

## Limitação factual

Este ambiente **não** tem sessão Supabase nem browser autenticado do salão.
O smoke **live** tem de correr no dispositivo/staging do dono.

Abaixo: **verificação estática** dos elos do fluxo no código actual (E17).

## Elos do fluxo [C no código]

| Passo | Evidência no código |
|-------|---------------------|
| Login / sessão | `core/auth-supabase.js` → `checkSession` / `loadState` |
| Offline | `flushSyncQueue` retorna cedo se `!navigator.onLine` |
| Venda grava local | `dbPut` intercept em `sync-queue.js` → `addToSyncQueue` |
| Enqueue | `addToSyncQueue` + `saveSyncQueue` (store) |
| Online | `sync-scheduler.js` listener `online` → `bpRetryFailedSync` |
| Flush | `flushSyncQueue` processa fila com rede |
| Fila 0 | UI: `atualizarIndicadorSync` + toasts no scheduler |

## Procedimento manual (dono)

1. Abrir app, login OK, splash some.  
2. Chrome DevTools → Network → Offline **ou** modo avião.  
3. Abrir Venda → cliente + serviço + pagar → guardar.  
4. Consola: `getSyncQueue().length` → deve ser **≥ 1**.  
5. Voltar online.  
6. Esperar ≤ 25s **ou** toque no indicador de sync.  
7. `getSyncQueue().length === 0` e `bpGetDlqCount() === 0`.  
8. Noutro dispositivo (mesmo salão): venda aparece após pull.

## Critério de falha

- Fila não cresce offline → intercept/enqueue.  
- Fila não esvazia online → flush/REST/auth.  
- DLQ sobe → ver `classifySyncFailure` / payload degradado.

