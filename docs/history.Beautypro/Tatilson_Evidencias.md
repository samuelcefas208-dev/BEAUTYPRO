# TATILSON — EVIDÊNCIAS

**Documento:** Auditoria forense e adversarial + práticas de protecção e escala  
**Plataforma:** BelezaPro / BeautyPro  
**Fonte de verdade:** artefacto de código fornecido (`Vercell.zip` / runtime real via `index.html`)  
**Data de referência da análise:** 28 de Agosto de 2026  
**Classificação de evidências:**
- **[C]** Confirmado — prova directa no código ou artefacto  
- **[H]** Hipótese / risco tecnicamente plausível sem prova total  
- **[N]** Não determinado — impossível confirmar com o material disponível (ex.: RLS live)

**Regra deste documento:** factos antes de opiniões. Cada ponto fraco liga-se a evidência. Não se transforma “pode acontecer” em “está vulnerável” sem prova.

---

## 1. VEREDITO EXECUTIVO (resumo)

1. A arquitectura híbrida offline-first (scripts clássicos + `window.*` + core modular + IndexedDB + fila + Supabase) é **consciente e documentada**, não automaticamente insegura por não ser ESM completo.
2. **Maior risco multi-tenant confirmado [C]:** a DLQ (`bp_dlq`) **não é limpa** na troca de salão; ao reprocessar, o payload é reenviado com `salao_id` da sessão **actual** → dados do Salão A podem ser gravados no Salão B.
3. **Maior risco de perda/inconsistência [C/H]:** fila em `localStorage` (quota, compressão, hard-block 5000); mirror localStorage pode truncar a 200 itens; falha de rede após pedido sem confirmação pode reenviar (mitigado por coalesce + `Prefer: merge-duplicates`, não por idempotência forte de negócio).
4. Isolamento local depende de `detetarTrocaDeSalao` + `loadState(true)` — limpa stores de domínio, fila e tombstones, mas **não** a DLQ nem a store `config` completa.
5. Logout **não limpa** IndexedDB nem fila (só sessão local + `signOut` + reload) — escolha offline-first; isolamento real só no próximo login com salão diferente.
6. Gate de sync remoto **existe [C]:** sem `state.config.salaoId` não há upsert/delete remoto.
7. Payload remoto **força `salao_id` da sessão [C]**, não confia no item local.
8. Auth com sessão dual (localStorage/sessionStorage), boot offline-first, refresh de token proactivo.
9. CSP presente, mas com `style-src 'unsafe-inline'`; anon key no frontend (esperado no modelo Supabase).
10. XSS: `escHtml` existe; cobertura nos sinks `innerHTML` **não é universal [H]**.
11. Sync com coalesce, tombstones, DLQ, LWW por `updated_at`, batch, backoff — base sólida.
12. Service Worker **não cacheia** API Supabase; shell network-first para críticos.
13. **RLS live [N]** — não auditável neste material; é o verdadero gate multi-tenant no servidor.
14. Políticas puras + testes em `docs/fase2` são um ponto positivo de contrato.
15. Estado geral: **operacional e defendido em vários eixos**, com **buraco multi-tenant real na DLQ** e dependência crítica de RLS não verificada aqui.

---

## 2. MAPA DO RUNTIME REAL

```
index.html
  ├─ IIFE no <head>: gate de sessão (bp_session_active + bp_salao_id_cache / meta)
  ├─ CSP
  ├─ Sentry CDN + Supabase CDN
  └─ Scripts (ordem efectiva de execução):
       core/constants.js          → SUPABASE_*, STORE_TO_TABLE, PLANOS → window.*
       core/utils.js
       core/state.js              → var state, activeTab → window
       core/store.js              → BeautyStore / setState / batch / subscribe
       core/db-indexeddb.js       → openDB, dbPut, dbDelete, dbPutLocal, mirrors bp_*
       core/supabase-resilience.js
       core/auth-supabase.js      → supabaseClient, checkSession, getAuthHeaders, sessão local
       core/sync-queue.js         → monkey-patch dbPut/dbDelete + fila + DLQ + flush
       core/sync-rest.js          → upsert/delete/getAll, merge, to/from format
       app.bundle.js              → shell vazio (compatibilidade SW / cache)
       core/plano-limites.js
       core/crud-operations.js    → detetarTrocaDeSalao, loadState, CRUD
       charts/*, ui/*, desktop/*, media/*, ia/*, features/*
       piloto/boot-pilot.js (ESM)
       bp-resumo-kpi.js
       boot/main.js               → arranque final

sw.js → cache do shell; bypass supabase.co; network-first para index/app.bundle
```

### Caminho real de dados (CRUD → servidor)

```
UI / CRUD
  → dbPut / dbDelete (versão patched em sync-queue.js)
  → IndexedDB + mirror localStorage (bp_<store>)
  → se existir tabela mapeada e state.config.salaoId:
       · online  → supabaseUpsert / supabaseDelete (REST + JWT)
       · falha / offline → addToSyncQueue (coalesce por id de entidade)
  → flushSyncQueue → REST → sucesso remove op; falha → backoff → DLQ (após 5 tentativas)
  → pull: carregarDoSupabase / bpSilentPull → merge LWW → dbPutLocal (sem re-enfileirar)
```

**Ficheiros de suporte / não runtime de produção principal:** `docs/fase2/**` (políticas puras + testes Vitest), slices de caracterização em `piloto/`.

---

## 3. PONTOS FRACOS — EVIDÊNCIAS CIRÚRGICAS

Cada vulnerabilidade segue o formato pedido na auditoria.

---

### V-01 — DLQ não limpa na troca de salão (cross-tenant no reprocessamento)

| Campo | Conteúdo |
|--------|----------|
| **ID** | V-01 |
| **SEVERIDADE** | **P0** |
| **CLASSIFICAÇÃO** | **[C]** |
| **ÁREA** | Multi-tenant / Sync / DLQ |
| **FICHEIRO(S)** | `core/crud-operations.js` (`loadState`), `core/sync-queue.js` (`bpReprocessDlq`, `toSupabaseFormat` via `sync-rest.js`), `docs/fase2/domain/pure/salao-isolation-policy.mjs` |
| **LOCALIZAÇÃO** | Bloco `if (trocouDeSalao)` em `loadState`: limpa stores de domínio, `bp_sync_queue`, `bp_deleted_items`; **ausência** de remoção de `bp_dlq`. Política pura documenta `isDlqClearedOnSalaoSwitch() === false`. |
| **EVIDÊNCIA** | Código de `loadState(true)` remove fila e tombstones; não remove `bp_dlq`. `bpReprocessDlq` reintroduz ops na fila; `toSupabaseFormat` força `salao_id` de `state.config.salaoId` **actual**. |
| **CENÁRIO DE FALHA OU ATAQUE** | Utilizador no Salão A gera ops que vão para DLQ → troca para Salão B (ou login B no mesmo browser) → “Reprocessar falhadas” → payloads de A são enviados com `salao_id` de B. |
| **IMPACTO** | Poluição de dados multi-tenant; vendas/clientes de um salão no outro; potencial incumprimento de privacidade / RGPD-equivalente. |
| **PROBABILIDADE** | Média se utilizadores partilham dispositivo ou mudam de conta; alta se a UI de DLQ for usada após troca. |
| **PRIORIDADE** | **P0 — corrigir antes de escala** |
| **RECOMENDAÇÃO** | Limpar `bp_dlq` em `loadState(true)`; gravar `salao_id` em cada op/DLQ no enqueue; no reprocess, rejeitar ops cujo `salao_id` histórico ≠ sessão actual. |
| **RISCO DA CORRECÇÃO** | Baixo se limitada a limpeza na troca + filtro no reprocess. |

---

### V-02 — Logout não isola dados locais do dispositivo

| Campo | Conteúdo |
|--------|----------|
| **ID** | V-02 |
| **SEVERIDADE** | **P1** |
| **CLASSIFICAÇÃO** | **[C]** |
| **ÁREA** | Auth / Multi-tenant / Persistência |
| **FICHEIRO(S)** | `ui/eventos-cadastros.js` (handler `#logout-btn`), `core/auth-supabase.js` (`bpClearSessionLocal`) |
| **LOCALIZAÇÃO** | Logout: `bpClearSessionLocal()` + `signOut` + `location.reload()`. Não chama `dbClear` nem limpa fila/DLQ. |
| **EVIDÊNCIA** | `bpClearSessionLocal` remove flags de sessão, `bp_salao_id_cache`, role, meta, alguns caches de plano/IA — **não** IndexedDB de domínio nem `bp_sync_queue` / `bp_dlq`. |
| **CENÁRIO** | Utilizador A faz logout; utilizador B no mesmo browser; se detecção de troca falhar ou for o mesmo salão, dados locais de A permanecem visíveis/usáveis. |
| **IMPACTO** | Exposição local de dados de salão anterior; confusão operacional. |
| **PROBABILIDADE** | Alta em dispositivos partilhados (tablet de salão). |
| **PRIORIDADE** | P1 |
| **RECOMENDAÇÃO** | Aviso se houver fila/DLQ pendente; opção explícita “Limpar dados deste dispositivo”; em troca de `user_id`/`salao_id` garantir sempre `loadState(true)`. |
| **RISCO DA CORRECÇÃO** | Médio se apagar dados por defeito (quebra offline-first). Preferir confirmação + limpeza só em troca de salão. |

---

### V-03 — Quota e compressão da fila / mirror localStorage

| Campo | Conteúdo |
|--------|----------|
| **ID** | V-03 |
| **SEVERIDADE** | **P1** |
| **CLASSIFICAÇÃO** | **[C]** |
| **ÁREA** | Sync Queue / Persistência |
| **FICHEIRO(S)** | `core/sync-queue.js` (`saveSyncQueue`, `slimPayload`), `core/db-indexeddb.js` (`_writeLSMirror`) |
| **LOCALIZAÇÃO** | Aviso ~4.5 MB; fallback para payload mínimo `{ id }`; hard-block 5000 ops; mirror LS `slice(-200)` sob falha de quota. |
| **EVIDÊNCIA** | Código de compressão e fallback mínimo; mirror truncado explicitamente. |
| **CENÁRIO** | Dispositivo com storage cheio; muitas vendas offline; fila “salva” mas sem campos de negócio → sync incompleto ou impossível. |
| **IMPACTO** | Perda efectiva de operações; totais incorrectos; DLQ massiva. |
| **PROBABILIDADE** | Média em salões com uso intensivo offline e pouco espaço. |
| **PRIORIDADE** | P1 |
| **RECOMENDAÇÃO** | Persistência primária da fila em IndexedDB; LS só como índice/backup; nunca reduzir payload a só `id` sem rehidratar de IDB. |
| **RISCO DA CORRECÇÃO** | Médio (migração de storage da fila). |

---

### V-04 — At-least-once sem idempotência de negócio completa

| Campo | Conteúdo |
|--------|----------|
| **ID** | V-04 |
| **SEVERIDADE** | **P1** |
| **CLASSIFICAÇÃO** | **[H]** (mecanismos de mitigação [C], garantia total [H]) |
| **ÁREA** | Sincronização distribuída |
| **FICHEIRO(S)** | `core/sync-queue.js` (flush), `core/sync-rest.js` (`Prefer: resolution=merge-duplicates`) |
| **LOCALIZAÇÃO** | Sucesso só após resposta OK; se a rede cai após o POST, a op pode voltar à fila. |
| **EVIDÊNCIA** | Fluxo try/catch no flush; POST com merge-duplicates; coalesce por id de entidade. |
| **CENÁRIO** | Request chega ao servidor; cliente não recebe 2xx; retry reenvia. |
| **IMPACTO** | Duplicação mitigada por mesmo `id` + merge; risco residual em lógica de negócio sem constraint única adequada. |
| **PROBABILIDADE** | Baixa a média em redes instáveis. |
| **PRIORIDADE** | P1 (monitorizar + constraints servidor) |
| **RECOMENDAÇÃO** | Idempotency-Key por op; constraints UNIQUE no servidor; confirmação explícita antes de remover da fila. |
| **RISCO DA CORRECÇÃO** | Médio. |

---

### V-05 — RLS / isolamento no servidor não auditado ao vivo

| Campo | Conteúdo |
|--------|----------|
| **ID** | V-05 |
| **SEVERIDADE** | **P0 se RLS ausente ou incorrecta** |
| **CLASSIFICAÇÃO** | **[N]** |
| **ÁREA** | Multi-tenant / Autorização servidor |
| **FICHEIRO(S)** | Não presente no artefacto frontend |
| **LOCALIZAÇÃO** | Policies Supabase PostgreSQL (não incluídas no ZIP) |
| **EVIDÊNCIA** | Frontend envia JWT + `salao_id`; **não prova** que o servidor rejeita cross-tenant. |
| **CENÁRIO** | Cliente manipula payload ou URL REST; sem RLS, lê/escreve outro salão. |
| **IMPACTO** | Exposição total multi-tenant (P0 real). |
| **PROBABILIDADE** | Indeterminada sem auditoria SQL. |
| **PRIORIDADE** | **Auditoria RLS obrigatória** |
| **RECOMENDAÇÃO** | Policies em todas as tabelas com `salao_id` ligadas a `auth.uid()` → `profiles.salao_id`; testes de penetração com dois JWT. |
| **RISCO DA CORRECÇÃO** | N/A (validação, não alteração frontend). |

---

### V-06 — XSS residual em sinks DOM (`innerHTML`)

| Campo | Conteúdo |
|--------|----------|
| **ID** | V-06 |
| **SEVERIDADE** | **P2** |
| **CLASSIFICAÇÃO** | **[H]** (existência de sinks [C]; exploração end-to-end [H]) |
| **ÁREA** | Segurança browser / UI |
| **FICHEIRO(S)** | `ui/*.js`, `features/*.js`, `charts/chart-module.js`, `core/utils.js` (`escHtml`) |
| **LOCALIZAÇÃO** | Múltiplos `innerHTML` com nomes, listas, recibos; `escHtml` usado em vários selects, não comprovado em todos os caminhos. |
| **EVIDÊNCIA** | `escHtml` definido em `utils.js`; greps mostram `innerHTML` com dados de domínio. |
| **CENÁRIO** | Nome de cliente/serviço com HTML/JS persistido → render sem escape → XSS armazenado. |
| **IMPACTO** | Sessão, dados locais, acções em nome do utilizador. |
| **PROBABILIDADE** | Baixa a média conforme cobertura de escape. |
| **PRIORIDADE** | P2 |
| **RECOMENDAÇÃO** | Política: zero `innerHTML` com dados de utilizador sem `escHtml`; preferir `textContent` / DOM APIs; Content Security Policy mais estrita. |
| **RISCO DA CORRECÇÃO** | Baixo a médio (regressões de UI). |

---

### V-07 — Chave anon Supabase no frontend

| Campo | Conteúdo |
|--------|----------|
| **ID** | V-07 |
| **SEVERIDADE** | **P3** (no modelo Supabase) |
| **CLASSIFICAÇÃO** | **[C]** |
| **ÁREA** | Config / Secrets |
| **FICHEIRO(S)** | `core/constants.js` |
| **LOCALIZAÇÃO** | `SUPABASE_ANON_KEY` exposta em claro e em `window.*` |
| **EVIDÊNCIA** | Constante hardcoded no script carregado pelo browser. |
| **CENÁRIO** | Qualquer utilizador vê a anon key (normal). Risco real só se RLS/policies falharem. |
| **IMPACTO** | Nenhum *por si só*; amplifica V-05. |
| **PROBABILIDADE** | N/A |
| **PRIORIDADE** | P3 + dependência de V-05 |
| **RECOMENDAÇÃO** | Manter anon key; **nunca** service role no frontend; validar RLS. |
| **RISCO DA CORRECÇÃO** | Nulo se só documentação/processo. |

---

### V-08 — CSP com `unsafe-inline` em estilos

| Campo | Conteúdo |
|--------|----------|
| **ID** | V-08 |
| **SEVERIDADE** | **P3** |
| **CLASSIFICAÇÃO** | **[C]** |
| **ÁREA** | Browser / CSP |
| **FICHEIRO(S)** | `index.html` (meta CSP) |
| **LOCALIZAÇÃO** | `style-src 'self' 'unsafe-inline' …` |
| **EVIDÊNCIA** | Meta CSP no HTML. |
| **CENÁRIO** | XSS que injecta estilo ou, em combinação com outros sinks, facilita abuso. |
| **IMPACTO** | Reduz eficácia da CSP. |
| **PRIORIDADE** | P3 |
| **RECOMENDAÇÃO** | Migrar estilos críticos para ficheiros; nonces/hashes se necessário. |

---

### V-09 — IndexedDB global por origem (sem partição por salão)

| Campo | Conteúdo |
|--------|----------|
| **ID** | V-09 |
| **SEVERIDADE** | **P1** |
| **CLASSIFICAÇÃO** | **[C]** mecanismo · **[H]** falha sob race |
| **ÁREA** | Multi-tenant / Persistência |
| **FICHEIRO(S)** | `core/db-indexeddb.js` (`BelezaProDB`), `core/crud-operations.js` |
| **LOCALIZAÇÃO** | Uma DB por origem; isolamento = clear na troca de salão. |
| **EVIDÊNCIA** | `indexedDB.open('BelezaProDB', 8)`; `dbClear` só nas stores listadas na troca. |
| **CENÁRIO** | Duas tabs: uma a escrever salão A, outra a trocar para B a meio; ou falha a meio do clear. |
| **IMPACTO** | Mistura temporária ou residual de dados. |
| **PRIORIDADE** | P1 |
| **RECOMENDAÇÃO** | Prefixo/namespace por `salao_id` nas keys ou DB name versionada por salão; `navigator.locks` na troca; limpar `config` de forma controlada. |

---

### V-10 — Store `config` não entra no clear da troca de salão

| Campo | Conteúdo |
|--------|----------|
| **ID** | V-10 |
| **SEVERIDADE** | **P2** |
| **CLASSIFICAÇÃO** | **[C]** |
| **ÁREA** | Multi-tenant / Estado |
| **FICHEIRO(S)** | `core/crud-operations.js`, política `salao-isolation-policy.mjs` |
| **LOCALIZAÇÃO** | `IDB_STORES_CLEARED_ON_SALAO_SWITCH` omite `config` de propósito (ler salão anterior). |
| **EVIDÊNCIA** | Código e política pura. |
| **CENÁRIO** | Valores de config do salão anterior persistem até overwrite. |
| **IMPACTO** | Plano/nome/fundo incorrectos temporariamente. |
| **PRIORIDADE** | P2 |
| **RECOMENDAÇÃO** | Após detecção, gravar explicitamente config do novo salão e apagar chaves órfãs. |

---

### V-11 — Conflitos LWW sensíveis ao relógio do dispositivo

| Campo | Conteúdo |
|--------|----------|
| **ID** | V-11 |
| **SEVERIDADE** | **P2** |
| **CLASSIFICAÇÃO** | **[H]** |
| **ÁREA** | Sync / Integridade |
| **FICHEIRO(S)** | `core/sync-rest.js` (`mergeTable`), `core/db-indexeddb.js` (`updated_at` em `dbPut`) |
| **LOCALIZAÇÃO** | Comparação de `updated_at` local vs remoto. |
| **EVIDÊNCIA** | Merge usa timestamps ISO gerados no cliente. |
| **CENÁRIO** | Dispositivo com data errada sobrescreve dados correctos no servidor. |
| **IMPACTO** | Perda de actualizações legítimas. |
| **PRIORIDADE** | P2 |
| **RECOMENDAÇÃO** | Autoridade do servidor quando online; version vector ou `updated_at` só servidor; NTP/aviso de relógio. |

---

### V-12 — Sincronização multi-tab sem coordenação

| Campo | Conteúdo |
|--------|----------|
| **ID** | V-12 |
| **SEVERIDADE** | **P2** |
| **CLASSIFICAÇÃO** | **[H]** |
| **ÁREA** | Sync / Reliability |
| **FICHEIRO(S)** | `core/sync-queue.js` (`flushSyncQueue._promise` por contexto de página) |
| **LOCALIZAÇÃO** | Lock apenas in-memory por tab; fila partilhada em localStorage. |
| **EVIDÊNCIA** | `_promise` não é cross-tab. |
| **CENÁRIO** | Duas tabs fazem flush em paralelo; estados de fila intercalados. |
| **IMPACTO** | Ops perdidas, duplicadas ou ordem incorrecta. |
| **PRIORIDADE** | P2 |
| **RECOMENDAÇÃO** | `navigator.locks` ou `BroadcastChannel` com eleição de líder. |

---

## 4. MATRIZ RESUMIDA

| ID | Área | Severidade | Class. | Impacto principal |
|----|------|------------|--------|-------------------|
| V-01 | Multi-tenant / DLQ | **P0** | [C] | Dados A → salão B |
| V-05 | RLS servidor | **P0*** | [N] | IDOR se RLS falhar |
| V-02 | Logout / isolamento | P1 | [C] | Dados locais após sair |
| V-03 | Quota fila/mirror | P1 | [C] | Perda de ops |
| V-04 | Idempotência sync | P1 | [H] | Duplicação residual |
| V-09 | IDB global / race | P1 | [C/H] | Mistura sob race |
| V-06 | XSS DOM | P2 | [H] | Sessão / UI |
| V-10 | Config na troca | P2 | [C] | Config residual |
| V-11 | Relógio / LWW | P2 | [H] | Overwrite incorrecto |
| V-12 | Multi-tab | P2 | [H] | Fila inconsistente |
| V-07 | Anon key | P3 | [C] | Amplifica V-05 |
| V-08 | CSP unsafe-inline | P3 | [C] | CSP mais fraca |

\*P0 **condicional** à ausência/incorrecção de RLS.

---

## 5. CENÁRIOS ADVERSARIAIS (estado)

| Cenário | Estado | Nota factual |
|---------|--------|--------------|
| Troca de salão | **PARCIALMENTE PROTEGIDO** | Fila e domínio limpos; **DLQ não** |
| Offline — criar venda | **PROTEGIDO** | Local + enqueue |
| Editar N vezes offline | **PROTEGIDO** | Coalesce por id |
| Criar + apagar antes do sync | **PROTEGIDO** | Tombstones + rejeição |
| Sync interrompido | **PARCIALMENTE** | Restantes na fila |
| App fechada no flush | **PARCIALMENTE** | Fila em LS; op em voo pode reenviar |
| Request sem resposta | **PARCIALMENTE** | Retry + merge-duplicates |
| Retry → duplicação | **PARCIALMENTE** | Mitigado por id/merge |
| Duas tabs | **NÃO PROTEGIDO / [H]** | Sem lock cross-tab |
| Troca com queue pendente | **PROTEGIDO (fila) / NÃO (DLQ)** | |
| Logout com ops pendentes | **PARCIALMENTE** | Dados ficam |
| DLQ acumulada | **PARCIALMENTE** | Cap ~200; risco cross-tenant |
| Relógio incorrecto | **NÃO PROTEGIDO** | LWW cliente |
| Conflito local vs remoto | **PARCIALMENTE** | LWW + merge |
| IDB indisponível | **PARCIALMENTE** | Mirror LS (pode truncar) |
| XSS | **PARCIALMENTE** | Escape parcial |
| Request manipulada | **DEPENDE RLS [N]** | |
| Cache SW de dados privados | **PROTEGIDO (API)** | Bypass supabase.co |

---

## 6. O QUE ESTÁ BEM (protecções reais)

- Gate `salaoId` no monkey-patch de `dbPut` / `dbDelete` — sem salão, sem sync remoto **[C]**.
- `toSupabaseFormat` força `salao_id` da sessão, não do item **[C]**.
- Coalesce de fila por entidade + tombstones (TTL 30 dias) + hard-block **[C]**.
- DLQ com UI de reprocessamento e indicador de sync **[C]**.
- Write-through IndexedDB + mirror localStorage + rehydrate **[C]**.
- Boot offline-first com overlay, timeouts e “continuar offline” **[C]**.
- Refresh proactivo de token em `getAuthHeaders` **[C]**.
- Service Worker: não cacheia Supabase; network-first no shell crítico **[C]**.
- Limpeza alargada na troca de salão (domínio, fila, prefs, IA namespaced) **[C]**.
- Políticas puras + testes Vitest em `docs/fase2` **[C]**.
- CSP com `default-src 'self'` e `connect-src` restrito **[C]**.

---

## 7. PLANO DE CORRECÇÃO MÍNIMA (ordem)

### P0
1. **V-01** — Limpar `bp_dlq` na troca; etiquetar ops com `salao_id`; filtrar no reprocess.  
2. **V-05** — Auditoria e testes live de RLS em todas as tabelas com `salao_id`.

### P1
3. **V-02** — Fluxo de logout com aviso de pendentes; garantir `detetarTrocaDeSalao` em todo login.  
4. **V-03** — Fila primária em IndexedDB; proibir payload mínimo destrutivo.  
5. **V-09 / V-12** — Locks na troca e no flush (uma tab líder).  
6. **V-04** — Idempotency-Key + constraints UNIQUE no servidor.

### P2
7. **V-06** — Inventário de `innerHTML` + escape obrigatório.  
8. **V-10 / V-11** — Config na troca; autoridade de timestamp no servidor.

### P3
9. **V-08** — Endurecer CSP.  
10. **V-07** — Processo: nunca service role no cliente; monitorização de abuso da anon key.

---

## 8. RASTO DE AUDITORIA (AUDIT-xxx)

| ID | Descoberta | Class. | Decisão |
|----|------------|--------|---------|
| AUDIT-001 | Ordem real de scripts em `index.html` | [C] | Base do runtime |
| AUDIT-002 | `app.bundle.js` é shell vazio pós extracção core | [C] | Core modular activo |
| AUDIT-003 | Anon key em `constants.js` | [C] | Aceite no modelo Supabase |
| AUDIT-004 | Monkey-patch com gate `salaoId` | [C] | Protecção real |
| AUDIT-005 | `loadState(true)` não limpa DLQ | [C] | **V-01 P0** |
| AUDIT-006 | Política pura: DLQ não limpa na troca | [C] | Confirma observação |
| AUDIT-007 | Logout não limpa IDB/fila | [C] | Offline-first consciente |
| AUDIT-008 | `toSupabaseFormat` sobrescreve `salao_id` | [C] | Bom em ops novas; perigoso com DLQ antiga |
| AUDIT-009 | Merge LWW por `updated_at` | [C] | Sensível a relógio |
| AUDIT-010 | SW não cacheia API Supabase | [C] | Bom |
| AUDIT-011 | RLS live | [N] | Não auditado ao vivo |
| AUDIT-012 | `escHtml` existe; cobertura incompleta | [H] | XSS residual |
| AUDIT-013 | Fila em LS com hard-block e compressão | [C] | Risco de perda de campos |
| AUDIT-014 | Coalesce + tombstones + MAX 5 → DLQ | [C] | Bem desenhado |
| AUDIT-015 | Store `config` não limpa na troca | [C] | Resíduo menor |
| AUDIT-016 | Multi-tab sem locks | [H] | Sem coordenação |
| AUDIT-017 | CSP `unsafe-inline` em styles | [C] | Melhoria |
| AUDIT-018 | Testes de políticas em fase2 | [C] | Contrato útil |

**Descartados / limitados:**
- “Não é ESM completo ⇒ inseguro” — **falso** neste contexto.  
- “Anon key = segredo crítico” — **falso** no modelo Supabase (o segredo é a service role).  
- “SW envenena dados de salão” — **não reproduzido** (API em bypass).

---

# 9. PRÁTICAS RECONHECIDAS PARA PROTEGER PLATAFORMAS OFFLINE-FIRST COM SINCRONIZAÇÃO

Referências de enquadramento (internacionais e alinháveis a boas práticas nacionais de privacidade/segurança em Angola e CPLP via princípios equivalentes a ISO, NIST, OWASP e RGPD):

| Família | Referências típicas |
|---------|---------------------|
| Segurança aplicação | OWASP ASVS, OWASP Top 10, OWASP Offline / Mobile (conceitos) |
| Sessão e autenticação | OWASP Session Management Cheat Sheet; NIST SP 800-63B |
| Privacidade / dados pessoais | Princípios RGPD / Lei de Protecção de Dados aplicável; minimização e isolamento por titular/tenant |
| Continuidade e fiabilidade | NIST SP 800-160; práticas SRE (Google SRE Book — error budgets, SLIs) |
| Multi-tenant | Isolamento por tenant no servidor (RLS / row-level); nunca confiar só no cliente |
| Sync offline | Padrões CRDT / LWW documentados; idempotency keys (HTTP APIs); outbox pattern |
| PWA | Web App Manifest + Service Worker best practices (não cachear dados autenticados sensíveis) |

---

## 9.1 Isolamento multi-tenant (obrigatório)

1. **Servidor é a autoridade** — RLS ou policies equivalentes em **todas** as tabelas com `tenant_id` / `salao_id`.  
2. **Cliente nunca é a única barreira** — filtros REST no frontend são UX, não segurança.  
3. **Toda operação local e de fila deve carregar `salao_id` imutável no momento da criação** — e ser rejeitada se divergir na sessão actual.  
4. **Troca de tenant = purge completo** de: estado em memória, IDB de domínio, mirrors, fila, **DLQ**, tombstones, caches de UI namespaced.  
5. **Logout em dispositivo partilhado** — opção “esquecer dados locais”; default documentado.  
6. **Testes de penetração com dois tenants** em CI (JWT A não lê/escreve B).

## 9.2 Fila de sincronização e outbox

1. **Outbox pattern:** gravar domínio + op de sync na **mesma** transacção local (ou sequência atómica o mais próxima possível).  
2. **Idempotency-Key** por operação (UUID da op, não só id da entidade) nos headers REST.  
3. **Coalesce por entidade** (já presente) + ordem causal quando necessário.  
4. **Exactly-once *de efeito*** no servidor via constraints UNIQUE / upsert por chave natural.  
5. **DLQ com retenção, alerta e isolamento por tenant** — nunca reprocessar cross-tenant.  
6. **Persistência da fila em IndexedDB**, não só `localStorage` (quota ~5 MB, single-thread, síncrono).  
7. **Backpressure:** soft/hard limits (já há); métricas de profundidade de fila.  
8. **Um flusher por dispositivo** (`navigator.locks` / leader election).

## 9.3 Conflitos e relógio

1. Preferir **autoridade do servidor** para `updated_at` quando online.  
2. LWW só com relógios fiáveis; considerar version vectors ou field-level merge explícito.  
3. Tombstones com TTL (já 30 dias) e garbage collection.  
4. Nunca apagar remoto só porque o local está vazio (evitar wipe acidental).

## 9.4 Autenticação e sessão offline

1. Tokens de curta duração + refresh (já há lógica de refresh).  
2. Sessão local **assinada ou pelo menos com integridade mínima** (evitar só flags booleanas).  
3. Logout e expiração claros; não expulsar offline se política offline-first o exigir — mas **não sincronizar** sem JWT válido.  
4. NIST 800-63B: autenticadores, reautenticação para acções sensíveis (fecho de caixa, exportação).

## 9.5 Dados em repouso no dispositivo

1. Minimizar PII em `localStorage` (preferir IDB; considerar `indexedDB` + Web Crypto se ameaça de roubo de dispositivo).  
2. Não guardar passwords; não guardar service role.  
3. Limpar dados na troca de conta/tenant.  
4. Mirror LS apenas como recuperação, com limites e sem dados binários grandes (já há `slimPayload`).

## 9.6 XSS, CSP, supply chain

1. OWASP: escape de saída; CSP sem `unsafe-inline` quando possível; nonces.  
2. Dependências CDN: pin de versão / SRI (Subresource Integrity) para scripts externos.  
3. Sentry e telemetria **sem** PII em claro nos eventos.

## 9.7 Service Worker / PWA

1. **Nunca** cachear respostas autenticadas de API com dados de tenant.  
2. Network-first para HTML/JS de shell em deploys frequentes.  
3. Versionar `CACHE_NAME`; `skipWaiting` + `clients.claim` com cautela (já alinhado).  
4. Não servir shell antigo que fale API nova incompatível sem feature detection.

## 9.8 Observabilidade e fiabilidade (SRE)

1. SLIs: taxa de sucesso de sync, profundidade de fila, idade da op mais antiga, erros 401/403/5xx.  
2. Alertas: DLQ > N; fila > soft limit; taxa de SESSION_EXPIRED.  
3. Error budget para releases que tocam Auth/Sync/IDB.  
4. Feature flags para desligar flush agressivo se necessário.

## 9.9 Privacidade e conformidade (princípios)

1. Minimização: só dados necessários offline.  
2. Limitação de finalidade: IA/analytics com bases legais e opt-out.  
3. Direito ao apagamento: cascade local + remoto por `salao_id` / titular.  
4. Registo de acessos administrativos e exports.

---

# 10. MANUTIBILIDADE, LEGIBILIDADE E ESCALA (≥ 20 000 utilizadores/dia)

Meta de escala: **20k+ utilizadores activos diários**, muitos offline-first, multi-tenant (salões), PWA.

## 10.1 Arquitectura de código (manter o híbrido sob controlo)

| Prática | Porquê |
|---------|--------|
| **Mapa de ordem de scripts como contrato** | Já existe modularização; documentar e testar ordem (smoke boot). |
| **Um dono por concern** | Auth, IDB, Queue, REST, CRUD — evitar segundo escritor de `dbPut`. |
| **API pública explícita em `window.*` versionada** | Reduz monkey-patch acidental; listar exports. |
| **Políticas puras testáveis** (já em `docs/fase2`) | Expandir para merge, DLQ, logout. |
| **Proibir novos `innerHTML` sem review** | Checklist PR. |
| **Não reescrever para React “por impulso”** | Custo de regressão em offline/sync >> ganho cosmético; evoluir por fatias. |

## 10.2 Escalabilidade backend (Supabase / Postgres)

1. **Índices** em `(salao_id, updated_at)`, `(salao_id, id)`, FKs usadas em filtros.  
2. **RLS eficiente** — policies simples; evitar joins pesados por row.  
3. **Connection pooling** (PgBouncer / pooler Supabase).  
4. **Paginação** em pulls (`range` / cursor); não `getAll` ilimitado quando o salão crescer.  
5. **Rate limiting** por utilizador/tenant nas Edge Functions (IA, exports).  
6. **Particionamento** futuro de tabelas quentes (`movimentos`) por tempo ou hash de `salao_id` se volume exigir.  
7. **CDN** só para assets estáticos; API sempre origem autenticada.

## 10.3 Escalabilidade cliente

1. **Pull incremental** por `updated_at` / cursor, não full dump diário.  
2. **Virtualização de listas** (clientes, movimentos) — já há sinais de “mostrar mais”.  
3. **Web Worker** para merge pesado / charts se long tasks > 50 ms.  
4. **Throttle de sync** (já 4s / 25s) — calibrar com telemetria.  
5. **Limites de plano** já existem — alinhar com quotas reais de storage local.

## 10.4 Processo e qualidade

1. **Testes de contrato** das políticas puras em CI (Vitest já presente na fase2).  
2. **Testes de integração** Auth → troca de salão → fila vazia + DLQ vazia.  
3. **Chaos local:** offline a meio do flush; quota full; duas tabs.  
4. **Code owners** em `core/auth-supabase.js`, `sync-queue.js`, `sync-rest.js`, `db-indexeddb.js`, `crud-operations.js`.  
5. **Changelog de protocolo de sync** (v1, v2) para app antiga vs API nova.  
6. **Feature flags** remotos para desligar IA, charts ou flush agressivo.

## 10.5 Capacidade humana / operação a 20k DAU

| Capacidade | Prática |
|------------|---------|
| On-call | Runbook: “fila presa”, “DLQ cresce”, “401 em massa”, “IDB corrompida” |
| Deploy | Canary por percentagem de clientes; rollback de shell SW |
| Suporte | Ferramenta interna: ver profundidade de fila por `salao_id` (só com audit log) |
| Custo | Monitorizar storage Supabase, egress, invocações Edge |

## 10.6 Roadmap técnico mínimo (sem reescrita)

```
Fase A (segurança tenant)     → V-01 DLQ + auditoria RLS
Fase B (fiabilidade sync)     → fila em IDB + locks multi-tab + idempotency
Fase C (integridade)          → pull incremental + timestamps servidor
Fase D (escala leitura)       → índices + paginação + virtualização UI
Fase E (endurecimento)        → CSP, escape DOM, SRI CDN
Fase F (observabilidade)      → SLIs de sync + alertas DLQ
```

Cada fase: **correcção mínima → teste → rollback documentado**.

---

## 11. CHECKLIST OPERACIONAL RÁPIDO

**Antes de considerar a plataforma “pronta para 20k DAU”:**

- [ ] RLS testada com dois JWT reais (A não acede B)  
- [ ] DLQ limpa e etiquetada por `salao_id`  
- [ ] Troca de salão: IDB domínio + LS mirrors + fila + DLQ + memória  
- [ ] Fila primária em IndexedDB  
- [ ] Flush com lock cross-tab  
- [ ] Pull incremental  
- [ ] Índices Postgres por `salao_id`  
- [ ] SLI: p95 idade da op na fila < limiar acordado  
- [ ] Zero `innerHTML` com dados crus de utilizador  
- [ ] Runbook de incidentes de sync  

---

## 12. LIMITAÇÕES DESTE DOCUMENTO

- Análise **estática** do artefacto frontend; sem execução browser instrumentada.  
- **Sem** acesso ao projecto Supabase (policies, triggers, Edge Functions).  
- **Sem** medição de performance em dispositivos reais.  
- Hipóteses [H] exigem prova adicional antes de serem tratadas como incidentes confirmados em produção.

---

## 13. CONCLUSÃO

O BelezaPro demonstra **engenharia offline-first real**: gates de `salao_id`, coalesce, tombstones, DLQ, boot resiliente, SW cuidadoso com a API. O ponto fraco **mais grave e confirmado no código** é o **ciclo de vida da DLQ na troca de salão (V-01)**. O ponto fraco **mais grave potencial** é a **RLS no servidor (V-05)**, não verificável neste material.

Com as correcções P0/P1 e as práticas das secções 9–10 — isolamento no servidor, outbox fiável, locks, pull incremental, observabilidade e disciplina de código no núcleo Auth/Sync/IDB — a plataforma pode ser **mantível, legível e capaz de sustentar mais de 20 000 utilizadores diários**, sem reescrita total e sem abandonar o modelo híbrido que já funciona.

---

*Fim do documento Tatilson — Evidências.*  
*AUDITA PRIMEIRO. CORRIGE COM EVIDÊNCIA. TESTA. SÓ DEPOIS ESCALA.*
