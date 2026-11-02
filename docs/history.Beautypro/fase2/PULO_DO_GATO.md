# PULO DO GATO — BelezaPro
Documento interno de orientação. Linguagem simples. Actualiza-se a cada etapa.

**Última actualização:** Fase 2 · F2-09 Vite experimental + F2-10 DS inventário (runtime intacto)

---

## 1. O que é o BelezaPro (em miúdos)

Aplicação de gestão para salões (clientes, agenda, vendas, caixa, equipa, serviços, IA).

Funciona **primeiro no telemóvel/PC** (dados locais). Depois, quando há internet, **envia** alterações para o Supabase (nuvem).

Não é um site que só funciona online. Offline é parte do produto.

---

## 2. Onde vive cada coisa

| Coisa | Onde está | Para quê |
|-------|-----------|----------|
| Código modular (fonte) | Ficheiros `.js` na raiz do repo | Editar aqui |
| App que o browser corre | `app.bundle.js` | **Gerado** por `build-bundle.js` — **não editar à mão** |
| Entrada ESM (futuro/dev) | `app-entry.js` | Imports em cadeia; caminho para Vite |
| Estado do salão | `state` + `BeautyStore` | Listas e config em memória |
| Verdade local dos dados | **IndexedDB** | Fonte de verdade no dispositivo |
| Espelho / recuperação | **localStorage** (`bp_*`) | Fallback, não deve competir com IDB |
| Fila offline → nuvem | `sync-queue.js` + chave `bp_sync_queue` | Operações por enviar |
| Falhas repetidas | DLQ `bp_dlq` | Operações que esgotaram tentativas |
| Nuvem | Supabase (REST) via `sync-rest.js` | Persistência multi-dispositivo |
| Auth / salão / role | `auth-supabase.js` | Login, JWT, `salao_id` |
| Regras de criar (limites) | `core-constants.js` (`PLANOS`) + `plano-limites.js` | Trial/Pro/Premium |
| Soft delete | campo `ativo` | “Apagado” na UI sem perder histórico |
| CRUD | `crud-operations.js` | Criar/editar/apagar + fila |
| IA chat | `ia-module.js` (contexto local) + edge `ia-query` | Conversa; não grava sozinha |
| Design tokens | `base-variaveis.css` + `design-system-final.css` | Visual / botões |
| Testes de fundação (novos) | `domain/pure/*` + `tests/*` | Caracterizar regras **sem** mudar runtime |
| Build testes | `package.json` + Vitest | `npm test` |

---

## 3. Offline e sincronização (regras críticas)

### Fluxo normal
1. Utilizador faz algo (ex.: criar cliente).
2. Grava-se **já** no IndexedDB (e o ecrã actualiza).
3. A operação entra na **fila** (`bp_sync_queue`).
4. Se online, a fila tenta enviar ao Supabase.
5. Se ok, sai da fila. Se falhar, tenta outra vez.

### Limites de tentativas (números actuais no código)
| Constante | Valor | Significado |
|-----------|-------|-------------|
| `MAX_SYNC_ATTEMPTS` | **5** | Após 5 falhas, a operação pode ir para a **DLQ** (lista de falhas graves) |
| `QUEUE_SOFT_WARN` | **1000** | Fila grande → aviso (pressão) |
| `QUEUE_HARD_BLOCK` | **5000** | Fila enorme → bloqueio / proteção |
| DLQ guardada | últimos **~200** itens | `bp_dlq` no localStorage |

### `slimPayload`
Antes de meter na fila / enviar, tira fotos em base64 e blobs enormes. A fila guarda **metadados**, não imagens gigantes — evita encher o disco e rebentar o localStorage.

### O que isto **não** garante sozinho
- Ter o número 5 nos testes de `domain/pure` **não prova** que a Sync Queue real está correcta. Isso é trabalho do **F2-03** (testes de comportamento do runtime / caracterização da fila real).

---

## 4. IndexedDB vs localStorage (contrato F2-02 formalizado)

Documento completo: `docs/CONTRACT_LOCAL_STORE.md`  
Política testável: `domain/pure/local-store-policy.mjs`

| | IndexedDB | localStorage `bp_${store}` | LS fila/DLQ |
|---|-----------|----------------------------|-------------|
| Papel | **Fonte de verdade local** (domínio) | Espelho / recuperação / private mode | Infra de sync (`bp_sync_queue`, `bp_dlq`, `bp_deleted_items`) |
| Base | `BelezaProDB` v8 · 7 stores · keyPath `id` | JSON array por store | Fila + DLQ (máx. ~200 na DLQ) |
| Truncagem | Não | Só se quota falhar e length > 200 → últimos 200 | DLQ slice(-200) |
| Cache RAM | — | — | Memória TTL **800 ms** só para leituras IDB path |

**Regra de ouro:** nunca assumir que o mirror LS é o inventário completo do salão.

---

## 5. Soft delete e planos

- `ativo === false` (ou `0` ou `"false"`) → entidade **inactiva** (não “existe” nas listas normais).
- Limites de **profissionais** contam só **activos** (soft-deleted não deve consumir vaga).
- Exemplos trial: 30 clientes, 60 agendamentos, 1 profissional, 0 perguntas IA/dia.

---

## 6. Multi-tenant

- Cada registo de negócio deve ir com **`salao_id`**.
- Sem salão identificado, o sync formata e falha de propósito (evita misturar salões).
- RLS no Supabase (políticas no servidor) é a rede de segurança final — o frontend sozinho não basta.

---

## 7. O que **não** fazer (acordado)

- Não editar `app.bundle.js` à mão.
- Não reescrever sync / IDB / React / Tailwind nesta fase.
- Não mudar regras de negócio só “porque a arquitectura ficou mais bonita”.
- Refactor só se o comportamento continuar igual (ou bug documentado).

---

## 8. `domain/pure` — regra arquitectural (após F2-01)

Os módulos em `domain/pure` são **temporariamente** uma camada de **caracterização/teste** das regras que já existem no runtime.

- **Não** devem ficar para sempre como **cópias independentes** das regras de produção.
- Quando os testes mostrarem equivalência, a regra deve **consolidar-se numa única fonte de verdade**, de forma **incremental e segura**.

### Dois tipos de teste (não confundir)

1. **Constantes / configuração / política pura** — “o número é 5?”, “trial tem 30 clientes?”, “slimPayload remove data:?”.  
2. **Comportamento real do runtime** — a fila real, o IDB real, o flush real, retries reais.

F2-01 = tipo 1.  
F2-03 = começar a provar tipo 2 na Sync Queue.

---

## 9. Fase 2 — estado dos incrementos

| ID | Estado |
|----|--------|
| F2-01 Tooling + Vitest + pure P0 | **Aprovado** |
| F2-02 Contrato IDB vs LS | **Concluído** (doc + pure + testes; runtime intacto) |
| F2-03 Sync queue comportamento | **Concluído (mínimo — política, não prova runtime)** |
| F2-04 salao_id / isolamento | **Concluído (mínimo — contrato + pure + testes; runtime intacto)** |
| F2-05 Repository clientes | **Fechada (Opção A).** Opção B adiada (sem consumidor) |
| F2-06 criarCliente use case | **Concluído (pure decidirCriarCliente; sem runtime)** |
| F2-07 ESLint legado | **Concluído (warn + inventário; 0 errors)** |
| F2-08 Playwright | **Scaffold; smoke [N] sem staging** |
| … | Ver `FASE2_PLANO.md` |

---

## 10. Porque estas regras existem

- **Offline:** o salão em Angola (ou em qualquer sítio) não pode parar se a rede cair.
- **Fila + tentativas + DLQ:** não perder operações nem repetir para sempre em silêncio.
- **slimPayload:** não rebentar armazenamento com fotos.
- **Soft delete:** histórico e comissões não desaparecem ao “apagar”.
- **salao_id + RLS:** um salão nunca vê dados de outro.
- **Testes primeiro:** modernizar sem partir o que já fatura.

---

*Fim do Pulo do Gato (versão actual).*


---

## 11. Evidências / bugs registados (não corrigir agora)

1. **bpProbePersistence** não conta mirror de `fechos_caixa` → bug de **observabilidade**.
2. Truncagem do mirror: só após falha de quota e se length > 200 (não é política permanente de 200 itens em toda a escrita).
3. Testes F2-01/F2-02 de constantes/política **não** provam runtime da Sync Queue nem IDB real.


## 12. Sync Queue (F2-03 — caracterização)

Documento: `docs/CONTRACT_SYNC_QUEUE.md`  
Política de teste: `domain/pure/sync-queue-policy.mjs`

**Três níveis:**
1. Comportamento real observado no `sync-queue.js` (doc).
2. Política mínima testada (enqueue guards + classificação de erros).
3. Ainda não validado no runtime: flush real, Supabase, online/offline browser, `dbPut` override com salaoId.

**Erros especiais no flush (não simplificar para “5 = DLQ”):**
- `SESSION_EXPIRED` → interrompe; não DLQ; attempts não incrementados nesse ramo.
- `LIMITE_PLANO_ATINGIDO` → backoff; fica na fila.
- `DUPLICADO*` → DLQ imediato.
- genérico → attempts++; se ≥ 5 → DLQ; senão backoff.

Os testes F2-03 **não** provam que `sync-queue.js` funciona em produção.

---

## 13. salao_id / multi-tenant (F2-04 — caracterização)

Documento: `docs/CONTRACT_SALAO_ID.md`  
Política de teste: `domain/pure/salao-isolation-policy.mjs`

**Confirmado pelo código [C]:**
- Origem: `profiles.salao_id` via JWT / Auth.
- Persistência: `state.config.salaoId`, `bp_salao_id_cache`, IDB `config`.
- `toSupabaseFormat` força sempre o `salao_id` da **sessão** (não o do item local).
- Sem `salaoId` → override `dbPut`/`dbDelete` só local (sem sync remoto).
- Troca detectada → limpa stores de domínio IDB + fila + tombstones + caches de plano/IA.
- **`bp_dlq` NÃO é limpa** na troca de salão.

**RLS live (auditoria 2026-08-19, projecto Supabase live — read-only):** ver secção 14.

**Ainda [N] / parcial:** Edge Function real; prova REST com dois JWT reais em staging (opcional); isolamento multi-conta só no browser.

**Não corrigido (não é bloqueio F2-05):** residual DLQ na troca; `bpReprocessDlq` sem filtro de salão (reetiqueta com sessão); guia RLS desactualizado (`salao_membros`).

Os testes F2-04 **não** substituem a auditoria live nem prova JWT dual.

---

## 14. Auditoria RLS live (2026-08-19) — evidência

**Fonte:** SQL Editor read-only no projecto live (`xbudnftutemakjbgxayf`).  
**Método:** inventário `pg_class` / `pg_policies` + colunas `profiles`. Nenhuma alteração aplicada.

### RLS activo [C]

Todas as tabelas críticas com `relrowsecurity = true`:  
`agendamentos`, `clientes`, `fechos_caixa`, `galeria_fotos`, `ia_uso_diario`, `logs`, `movimentos`, `profiles`, `profissionais`, `salao_config`, `saloes`, `servicos`.

### Modelo de isolamento real [C]

Tabelas de negócio usam o predicado:

```sql
salao_id IN (SELECT salao_id FROM profiles WHERE user_id = auth.uid())
```

Escrita com **WITH CHECK** no mesmo eixo. Roles principais: `authenticated`.  
**Não** existe `salao_membros` no modelo live observado.  
**Alinhado** com o frontend (`profiles.salao_id` → `state.config.salaoId`) e com `SUPABASE_HARDENING` / etapa4 (não com o texto antigo do `GUIA_RLS_SUPABASE.md`).

### `profiles` [C]

Colunas relevantes: `user_id`, `salao_id` (NOT NULL), `nome`, `role` — compatível com `auth-supabase.js`.

### Ressalvas documentadas (não P0)

| Item | Nota |
|------|------|
| `saloes`, `logs` | `roles = {public}` mas mantêm predicado por `salao_id` / `user_id` — risco baixo |
| Prova JWT dual via REST | Validação adicional via `SET LOCAL` documentada no relatório; prova com dois tokens reais em staging = opcional |
| `GUIA_RLS_SUPABASE.md` | Menciona `salao_membros` — **desactualizado** face ao live; actualizar doc quando autorizado |

### Classificação

| Critério | Resultado |
|----------|-----------|
| Isolamento multi-tenant **backend** | **APROVADO** (evidência live 2026-08-19) |
| Risco residual DLQ cliente | Mantém-se P1 comportamental; **não** anula RLS |
| F2-05 repository clientes | **Fechada Opção A**; Opção B adiada — ver §15 |

Documento de arquivo: `docs/RLS_LIVE_AUDIT.md`. Relatório completo: sessão Orquestrador / investigação RLS 2026-08-19.

---

## 15. F2-05 — Repository de Clientes (**fechada · Opção A**)

Documento: `docs/CONTRACT_CLIENTES_REPOSITORY.md`  
Política: `domain/pure/clientes-repository-policy.mjs`

**Feito (Opção A):**
- Contrato da fachada conceptual (`listAll` / `listActive` / `getById` / `create` / `update` / `remove`).
- Caracterização de `addCliente` / `updateCliente` / `deleteCliente` (hard delete, RBAC admin/gerente, rename → movimentos/agendamentos).
- Testes de política/shape (não prova browser/IDB/sync).

### Opção B (adaptador no runtime) — **ADIADA**

**Decisão (Orquestrador, 2026-08-19):** não autorizar Opção B neste momento.

| Motivo | Justificação |
|--------|----------------|
| Sem consumidor | Nenhum caso de uso actual exige chamar o adaptador em vez de `addCliente` / UI / Benza |
| Risco de duplicação | UI continuaria a chamar CRUD directo → dois caminhos |
| Benefício incerto | Adaptador sem callers = código morto / dívida |

**Pré-requisitos para reabrir Opção B:**
1. Consumidor identificado (quem chama `create`/`update`/`remove` da fachada)
2. Estratégia de migração gradual das chamadas directas
3. Critério de sucesso mensurável
4. Plano de rollback

Até lá: contrato + pure bastam. Wire-up runtime só com nova autorização explícita.

**Regra:** repository futuro **delega**; não reimplementa telefone, duplicados nem limites.


---

## 16. F2-06 — Use case `decidirCriarCliente` (pure)

Documento: `docs/CONTRACT_CRIAR_CLIENTE.md`  
Módulo: `domain/pure/criar-cliente.mjs`

**Feito:** decisão pura (shape → limite → telefone injectável T2 → duplicado → ok).  
**Não** substitui `addCliente`. **Não** gera id/salao_id. **Não** wire-up. Opção B continua adiada.


---

## 17. F2-07 — ESLint legado (warn only)

- Lista explícita de ficheiros raiz (7 ficheiros neste checkout).
- Globals browser documentados; `no-undef` / `no-var` / unused = **warn**.
- Script: `npm run lint:legacy` · pure continua em `npm run lint`.
- Inventário: `docs/LINT_LEGACY_INVENTORY.md` — **477 warnings, 0 errors**.
- **Sem** auto-fix · **sem** Prettier no legado · `app.bundle.js` ignorado.

## 18. F2-08 — Playwright scaffold

- `@playwright/test` + `playwright.config.js` + `e2e/smoke.spec.js`.
- `baseURL` só via env `BP_E2E_BASE_URL` (nunca produção por defeito).
- Smoke shell: **skip [N]** sem staging nesta sessão.
- Login→clientes: **skip [N]** sem credenciais.
- Sem `data-testid` novos · sem escrita de dados.


---

## 19. F2-09 — Vite experimental

Documento: `docs/CONTRACT_VITE_EXPERIMENTAL.md`  
Config: `vite.config.js` · script `npm run dev:experimental`

- **Não** substitui `app.bundle.js`.
- Output experimental: `fase2/dev-dist/` (se build).
- Neste checkout parcial sem `index.html` → arranque real **[N]**.

## 20. F2-10 — Design System (inventário)

Documento: `docs/DESIGN_SYSTEM_INVENTORY.md`

- Spec mínima Button/Input (contrato).
- **Zero** alteração a CSS/HTML de produção.
- Inventário de classes live **[N]** até repo completo com CSS.
