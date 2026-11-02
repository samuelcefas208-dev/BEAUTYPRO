# Auditoria sequencial E11 → E19

## Falhas corrigidas nesta revisão

1. **sync-queue-store.js** — `const MAX_SYNC_*` não partilhava entre scripts clássicos → `var` + `window.*`
2. **utils.js** — `const escHtml` idem → `function escHtml` (global clássico) + `window.escHtml`
3. **Cache** — versões alinhadas a `e19` / `CACHE_NAME …-e19`

## Ficheiros auditados (OK após revisão)

list-writers · crud-operations · boot/main · index ordem sync · todos sync-* ·
menu · vendas · clientes · dashboard · detalhes · agenda-polish · cadastros · caixa ·
finance-fase1-extra (XSS E18)

## Ordem sync

policy → tombstone → dlq → queue-store → outbox → lock → recover → queue → ui → scheduler → rest
