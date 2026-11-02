# TATILSON EVIDÊNCIAS
## BelezaPro — Auditoria forense, pontos fracos e práticas de referência

**Documento:** Tatilson Evidências  
**Objecto:** Plataforma BelezaPro (artefacto runtime auditado: Vercell.zip / arquitectura híbrida pós extracção D-5.6)  
**Natureza:** Evidência técnica + enquadramento de práticas reconhecidas  
**Modo da auditoria de origem:** só leitura (código não alterado)  
**Classificação de afirmações:**  
- **[C]** Confirmado no código/artefacto  
- **[H]** Hipótese / risco tecnicamente plausível sem prova completa  
- **[N]** Não determinado com o material disponível  

---

# PARTE I — VEREDICTO EXECUTIVO

1. O runtime **já não é o monólito antigo**: `app.bundle.js` é um **shell (~466 bytes)**; o core está em `core/*.js` carregado pelo `index.html`. **[C]**  
2. A **maior dependência de segurança** é o **Supabase RLS em produção** — **não auditável no ZIP de frontend** → isolamento multi-tenant remoto = **[N]**.  
3. O **maior risco de mistura de salões no dispositivo** é mitigado em `loadState(trocouDeSalao)` (limpa IDB + fila), mas a **fila e a IDB são globais ao origin** (`bp_sync_queue`, `BelezaProDB`), não namespaced por salão. **[C]**  
4. O **maior risco de perda perceptível de dados** é ops na **DLQ** / fila bloqueada / mirror `localStorage` truncado — o local em IDB pode continuar, o remoto não. **[C]** / **[H]**  
5. **RBAC é só cliente** (`bpExigirRole`) — contornável no browser; não substitui políticas server-side. **[C]**  
6. **Anon key no frontend** é esperada no modelo Supabase; sem RLS forte = exposição de API. **[C]** + **[N]** RLS live.  
7. **Service Worker** faz precache alargado; **só** parte do shell é network-first — **chunks `core/*` podem servir versão antiga em cache**. **[C]**  
8. Sync tem defesas reais: batch, backoff, tombstones, dedupe na fila, `salao_id` no payload REST, gate sem `salaoId`. **[C]**  
9. Arquitectura híbrida (scripts ordenados + `window.*` + monkey-patch `dbPut`) é **frágil à ordem de carga**, não automaticamente “insegura”. **[C]**  
10. Há **innerHTML** com dados de domínio — risco XSS se nomes/descrições não forem escapados em todos os caminhos. **[H]**  
11. **Não há prova no artefacto frontend** de testes e2e multi-tenant ou de políticas SQL aplicadas. **[N]**  
12. Plataforma **utilizável e com defesas offline-first conscientes**; **não** declarar “seguro multi-tenant” sem auditoria RLS + teste de troca de salão com fila a meio.

---

# PARTE II — MAPA DO RUNTIME REAL

```text
index.html
  ├─ IIFE head (gate sessão localStorage)
  ├─ CSS
  ├─ Sentry CDN + Supabase JS CDN
  ├─ core/constants.js          ← URL + ANON_KEY
  ├─ core/utils.js
  ├─ core/state.js
  ├─ core/store.js
  ├─ core/db-indexeddb.js       ← BelezaProDB + dbPut/dbDelete
  ├─ core/supabase-resilience.js
  ├─ core/auth-supabase.js
  ├─ core/sync-queue.js         ← monkey-patch dbPut/dbDelete + fila + DLQ
  ├─ core/sync-rest.js          ← REST upsert/delete/get + salao_id
  ├─ app.bundle.js              ← SHELL vazio (compat cache)
  ├─ core/plano-limites.js
  ├─ core/crud-operations.js    ← loadState / detetarTrocaDeSalao / CRUD
  ├─ charts/* + ui/renders
  ├─ desktop/* media/* ia/* ui/* features/*
  ├─ piloto/boot-pilot.js (module)
  ├─ bp-resumo-kpi.js
  └─ boot/main.js

INPUT UI / eventos
  → CRUD / dbPut
  → IDB (+ mirror localStorage bp_*)
  → addToSyncQueue (patch)
  → flushSyncQueue (batch)
  → sync-rest (Bearer JWT + apikey + salao_id)
  → Supabase PostgREST
  → [RLS — NÃO AUDITADO AO VIVO]
  → resposta / merge pull
  → state + UI
```

**Ordem crítica [C]:** `db-indexeddb` **antes** de `sync-queue` (o patch captura o `dbPut` original). Inverter scripts parte o offline-first.

---

# PARTE III — PONTOS FRACOS (CIRÚRGICOS E FACTUAIS)

## 3.1 Matriz de vulnerabilidades / riscos

| ID | Área | Severidade | Class. | Evidência | Impacto |
|----|------|------------|--------|-----------|---------|
| AUDIT-001 | Multi-tenant local | P0 | [C] | IDB nome fixo `BelezaProDB`; fila `bp_sync_queue` global | Dados de dois salões no mesmo origin se a limpeza falhar |
| AUDIT-002 | Multi-tenant remoto | P0 | [N] | REST envia `salao_id`; RLS **não** está no ZIP | Sem RLS = leitura/escrita cross-tenant via API |
| AUDIT-003 | Fila vs troca de salão | P1 | [C]/[H] | `loadState(true)` remove `SYNC_QUEUE_KEY` | Race se flush estiver activo durante a troca **[H]** |
| AUDIT-004 | Autorização cliente | P1 | [C] | `bpExigirRole` em UI/CRUD | Operador pode invocar APIs JS no DevTools |
| AUDIT-005 | Secrets frontend | P2 | [C] | `SUPABASE_ANON_KEY` em `core/constants.js` | Esperado no modelo; abuso se RLS fraco |
| AUDIT-006 | SW cache do core | P1 | [C] | `core/*.js` no precache; fetch cache-first excepto shell | Runtime antigo após deploy |
| AUDIT-007 | DLQ / tentativas | P1 | [C] | Após `MAX_ATTEMPTS` → `moveOpToDlq` | Sync remoto parado; local pode continuar OK |
| AUDIT-008 | Mirror localStorage | P2 | [C] | Fallback de mirror com truncagem (ex. últimos N) | Recuperação incompleta (ex. private mode) |
| AUDIT-009 | XSS DOM | P1 | [H] | Uso de `innerHTML` em fluxos de vendas/caixa/utils | Se campos de utilizador não forem escapados |
| AUDIT-010 | Sessão em localStorage | P2 | [C] | `bp_session_*`, `bp_salao_id_cache`, role em LS | Residual após logout incompleto |
| AUDIT-011 | Ordem de scripts | P1 | [C] | Patch `dbPut` depende da ordem no HTML | Boot parcial / escrita incorrecta |
| AUDIT-012 | Hard block da fila | P2 | [C] | `QUEUE_HARD_BLOCK` rejeita novas ops | UX bloqueada; novas alterações não entram na fila |

## 3.2 Top riscos reais (melhor evidência)

1. **RLS não verificável neste artefacto** — isolação real desconhecida **[N]**  
2. **Storage local partilhado por origin** (IDB + fila) — depende de `detetarTrocaDeSalao` + `loadState(true)` **[C]**  
3. **Service Worker a servir `core/*` antigo** **[C]**  
4. **RBAC apenas no cliente** **[C]**  
5. **DLQ engole operações após N tentativas** **[C]**  
6. **Anon key + PostgREST** sem prova de policies no artefacto **[C]** + **[N]**  
7. **Race entre flush da fila e troca de salão** **[H]**  
8. **innerHTML + dados de negócio** **[H]**  
9. **Arquitectura acoplada à ordem dos `<script>`** **[C]**  
10. **Política de conflitos / merge LWW** não auditada em profundidade neste passo **[N]** / **[H]**

## 3.3 Cenários adversariais (estado)

| Cenário | Estado | Notas |
|---------|--------|-------|
| Troca de salão com dados locais | PARCIALMENTE PROTEGIDO **[C]** | Detecção + clear de stores + limpeza de fila |
| Troca com flush a correr | RISCO / NÃO DETERMINADO **[H]** | Sem lock global troca↔flush evidenciado |
| Venda offline | PROTEGIDO **[C]** | IDB + fila + retry |
| Edições múltiplas offline | PARCIAL **[C]** | Dedupe por entidade na fila (última op prevalece na fila) |
| Create + delete antes do sync | PARCIAL **[C]** | Tombstones / ignore upsert se delete já na fila |
| Sync a meio / app terminada | PARCIAL **[C]** | Fila em LS; at-least-once exige idempotência no servidor **[H]** |
| Servidor OK, cliente sem resposta | PARCIAL **[H]** | Retry pode duplicar se o servidor não for idempotente |
| Duas tabs no mesmo origin | NÃO DETERMINADO **[N]** | LS partilhado; sem leader election evidenciado |
| Logout com pendentes | PARCIAL **[H]** | Depende da limpeza completa de sessão/fila |
| DLQ acumulada | PARCIAL **[C]** | Capacidade limitada; ops saem da fila activa |
| Relógio do dispositivo errado | NÃO DETERMINADO **[N]** | `updated_at` gerado no cliente |
| XSS via nome/descrição | RISCO PARCIAL **[H]** | Presença de `innerHTML` |
| Request REST manipulada no cliente | DEPENDE DE RLS **[N]** | Server deve recusar |
| Cache SW desactualizado | NÃO TOTALMENTE PROTEGIDO **[C]** | core em padrão cache-first |

## 3.4 O que está bem (protecções reais)

- Extracção modular do core (D-1…D-5.6); shell do bundle sem lógica de negócio. **[C]**  
- Offline-first com patch explícito de `dbPut` / `dbDelete`. **[C]**  
- REST exige `salao_id` em upsert/delete/get. **[C]**  
- Sem `salaoId` → persistência local, sem enqueue remoto. **[C]**  
- Troca de salão: clear de stores de domínio + fila + preferências + carrinho. **[C]**  
- Namespaces parciais (ex. `bp_plano_cache_<salaoId>`). **[C]**  
- Fila: batch, backoff, avisos, hard block, slim payload, tombstones. **[C]**  
- Tráfego Supabase **não** cacheado pelo Service Worker. **[C]**  
- Shell crítico em network-first. **[C]**  
- RBAC operacional em fluxos sensíveis (despesa, fecho, cancelamentos). **[C]**  
- Tolerância a schema drift (colunas em falta) para não matar a fila. **[C]**  

## 3.5 Plano de correcção orientado (prioridade)

**P0**  
1. Auditar e testar **RLS live** (dois JWT / dois `salao_id`).  
2. Teste automatizado **troca de salão com fila a meio** (pausa de flush ou lock).  

**P1**  
3. Namespace de fila/DLQ/IDB por `salaoId` **ou** atomicidade rigorosa flush+switch.  
4. SW: network-first ou cache bust por hash para **todos** os `core/*.js` e `boot/main.js`.  
5. Escapar sistematicamente dados de utilizador em HTML.  
6. UI e fluxo de **reprocessamento da DLQ**.  

**P2**  
7. Contratos de boot / asserts de ordem de scripts.  
8. Mirror LS sem truncar operações críticas em silêncio.  
9. Checklist único de logout (sessão, fila, DLQ, role, caches de salão).  

**P3**  
10. Métricas de fila, DLQ e erros de sync.  
11. Inventário contínuo scripts carregados vs órfãos.  

## 3.6 Registo de rasto (extracto)

| ID | Estado | Nota |
|----|--------|------|
| AUDIT-001 | ABERTA | IDB/fila globais ao origin |
| AUDIT-002 | NÃO AUDITÁVEL AO VIVO | RLS |
| AUDIT-003 | ABERTA | Race flush/troca |
| AUDIT-004 | ACEITE COMO RISCO DE MODELO (cliente) | Mitigar com RLS |
| AUDIT-005 | ACEITE (modelo Supabase) | Anon key pública por desenho |
| AUDIT-006 | ABERTA | SW / core cache |
| AUDIT-007 | ABERTA | DLQ |
| AUDIT-008 | ABERTA | Truncagem de mirror |
| AUDIT-009 | HIPÓTESE | XSS |
| AUDIT-010 | ABERTA | Residual de sessão em LS |
| “Bundle ainda contém o core” | FALSO POSITIVO neste artefacto | Shell sem lógica |

## 3.7 Limitações da auditoria de origem

- Sem execução instrumentada no browser com duas contas reais.  
- Sem acesso ao SQL Editor / policies aplicadas no projecto Supabase.  
- Sem cobertura exaustiva de todos os `innerHTML` em `ui/*`.  
- CDN (Supabase JS, Sentry) = risco residual de supply chain **[H]**.  

---

# PARTE IV — PRÁTICAS RECONHECIDAS (NACIONAIS E INTERNACIONAIS)

Esta secção **não** afirma que o BelezaPro cumpre ou falha certificações. Lista **referências e práticas** amplamente usadas em sistemas offline-first, multi-tenant e APIs públicas, aplicáveis a um produto do género (gestão com sync).

## 4.1 Segurança da informação e gestão de risco

| Referência | Âmbito | Práticas relevantes |
|------------|--------|---------------------|
| **ISO/IEC 27001** | SGSI internacional | Inventário de activos, gestão de risco, controlo de acesso, gestão de incidentes, melhoria contínua |
| **ISO/IEC 27017 / 27018** | Cloud / PII em cloud | Controlos adicionais para dados em fornecedores cloud |
| **NIST Cybersecurity Framework (CSF)** | EUA / uso global | Identify → Protect → Detect → Respond → Recover |
| **NIST SP 800-53 / 800-63** | Controlos / identidade | Autenticação, gestão de sessão, níveis de garantia de identidade |
| **OWASP Top 10** | Aplicações web | Broken Access Control, Injection, XSS, Security Misconfiguration, etc. |
| **OWASP ASVS** | Verificação de segurança de apps | Requisitos verificáveis por nível (auth, session, API, data) |
| **OWASP Mobile Top 10 / MASVS** | Clientes móveis / PWA | Armazenamento local, comunicação, autenticação no dispositivo |
| **CIS Controls** | Baseline defensivo | Inventário de software, configurações seguras, gestão de contas |
| **Lei n.º 22/11 (Angola)** — Protecção de Dados Pessoais | Nacional AO | Licitude, finalidade, minimização, segurança, direitos do titular |
| **Boas práticas AGPD / reguladores africanos e UE (GDPR como referência de mercado)** | Privacidade | Minimização, retenção, transparência, DPA com subprocessadores |

**Aplicação típica a plataformas como o BelezaPro:**  
tratar `salao_id` e dados de clientes/movimentos como **activo crítico**; documentar bases legais e retenção; contratos com Supabase/hosting; processo de resposta a incidente (fuga de dados entre salões = incidente grave).

## 4.2 Multi-tenant e controlo de acesso

Práticas de mercado (SaaS B2B):

1. **Tenant isolation no servidor (obrigatório)**  
   - Row Level Security / policies por `tenant_id` / `salao_id`.  
   - Nunca confiar só no cliente para filtrar dados.  

2. **Defense in depth**  
   - JWT com claims de tenant + policies na BD + validação em Edge Functions quando houver lógica privilegiada.  

3. **RBAC server-side**  
   - Papéis (admin/gerente/operador) aplicados em policies ou funções RPC, não apenas em botões ocultos.  

4. **Testes de isolamento**  
   - Suite automatizada: utilizador do Salão A não lê/escreve Salão B (API directa, não só UI).  

5. **Separação de storage por tenant quando o risco o justificar**  
   - Em clientes offline: prefixar chaves de fila/IDB por tenant **ou** garantir wipe atómico na troca de contexto.  

## 4.3 Offline-first, sincronização e integridade

Padrões e práticas reconhecidas na engenharia de sistemas distribuídos / mobile:

| Prática | Descrição | Porquê |
|---------|-----------|--------|
| **Local-first / offline-first** | Fonte de verdade imediata no dispositivo; rede assíncrona | Rede instável (contexto Africano/Angola: 3G/4G intermitente) |
| **Outbox pattern** | Operações de escrita vão primeiro para uma outbox persistente, depois o worker envia | Evita perder writes se a app fechar |
| **At-least-once + idempotência** | Reenvio seguro; server deduplica por `id` / idempotency-key | Falhas de rede após commit no servidor |
| **Tombstones** | Deletes deixam marca para não “ressuscitar” registos | Create/delete offline antes do sync |
| **Version vectors / `updated_at` + regras de conflito** | LWW documentado, ou merge por campo, ou “server wins” | Conflito multi-dispositivo |
| **Backoff exponencial + jitter** | Retentativas espaçadas | Evita thundering herd |
| **Dead Letter Queue (DLQ) com operador humano** | Ops que falham N vezes saem da fila quente | Evita filas infinitas; exige reprocessamento explícito |
| **Exactly-once na prática de negócio** | Não é exactamente-once na rede; é “efectivamente uma vez” via IDs estáveis (UUID) | Vendas e movimentos não devem duplicar receita |
| **Relógio** | Preferir timestamp de servidor em conflitos críticos; tolerar skew | Dispositivos com data errada |
| **CRDTs** (quando aplicável) | Estruturas mergeáveis | Mais raro em ERP de salão; overkill salvo colaboração em tempo real |

Referências de leitura técnica amplamente citadas: padrões de **enterprise integration** (outbox), literatura **local-first** (ex. discussões Ink & Switch), documentação de filas e **idempotency keys** (Stripe e APIs modernas como referência de desenho), **OWASP** para storage no cliente.

## 4.4 API, browser e PWA

| Prática | Norma / origem |
|---------|----------------|
| CSP (Content Security Policy) | OWASP / browsers modernos |
| Escapar output HTML (prevenir XSS) | OWASP XSS Prevention Cheat Sheet |
| Não armazenar secrets privilegiados no frontend | OWASP / fornecedores cloud |
| HTTPS obrigatório | Prática universal |
| Service Worker: estratégia explícita por tipo de recurso | MDN / workbox patterns (network-first para app shell crítico) |
| Cache busting por hash de ficheiro | Webpack/Vite/rollout industry standard |
| Subresource Integrity (SRI) em CDNs quando possível | W3C / OWASP |
| Minimizar `innerHTML` com dados não confiáveis | OWASP DOM-based XSS |

## 4.5 Fiabilidade e escala (~20 000 utilizadores/dia)

**20 000 utilizadores diários** não é “big tech”, mas exige disciplina se forem **concorrentes no pico** (ex. manhãs de salão) e **sync em massa** ao recuperar rede.

### Capacidade e arquitectura

1. **Stateless API + BD gerida** (Supabase/Postgres) com índices em `salao_id`, `updated_at`, FKs usadas em filtros.  
2. **Connection pooling** (PgBouncer / pooler do fornecedor).  
3. **Rate limiting** por utilizador/IP/tenant nas Edge Functions e, se possível, na API.  
4. **Paginação** em pulls (`Range` / cursor), nunca “get all do salão” ilimitado em salões grandes.  
5. **Sync incremental** (since `updated_at`) em vez de full snapshot sempre.  
6. **Filas e workers** no servidor para trabalhos pesados (relatórios, IA, export).  
7. **Observabilidade:** logs estruturados, métricas (latência, erros 4xx/5xx, tamanho de fila client-side reportado), tracing opcional, alerting.  
8. **Objectivos SLO** (ex. 99% das syncs &lt; N segundos em rede boa) e error budget.  
9. **Testes de carga** nos endpoints de sync e login (k6, Locust, etc.).  
10. **Feature flags** para desligar módulos caros (IA, media) sob stress.

### Cliente (PWA)

1. **Code splitting / lazy load** por aba (Agenda, Caixa, IA) — menos JS no boot.  
2. **Evitar N listeners duplicados** e N `DOMContentLoaded` sem guarda.  
3. **IndexedDB** com transacções curtas; não bloquear a main thread com JSON gigante.  
4. **Batch de UI** (requestAnimationFrame / debouncing de renders).  
5. **Limitar precache do SW** ao shell; resto network ou cache com versão.

## 4.6 Manutibilidade, legibilidade e escalabilidade de equipa

Práticas de engenharia de software amplamente adoptadas:

| Prática | Objectivo |
|---------|----------|
| **Arquitectura hexagonal / ports & adapters** | UI ≠ domínio ≠ infra (IDB/Supabase) |
| **Bounded contexts por domínio** (Agenda, Caixa, Clientes, Sync) | Equipas e módulos com fronteiras |
| **Dependency graph explícito** (ESM `import`/`export`) | Evitar “ordem mágica” de scripts |
| **Contratos e testes de política** (como em `fase2/domain/pure`) | Regras de isolamento testáveis sem DOM |
| **Documentação de decisões (ADR)** | Porquê RLS, porquê outbox, porquê LWW |
| **CI:** lint + testes unitários + testes de isolamento tenant | Regressão precoce |
| **Semantic versioning / changelog** do protocolo de sync | Clientes antigos vs API nova |
| **Observabilidade de fila** (profundidade, idade da op mais antiga, taxa DLQ) | Operação |
| **Code owners** em `core/sync-*`, `auth`, `db-*` | Mudanças perigosas com review obrigatório |
| **Proibição de “fix catch vazio”** em caminhos de dinheiro/sync** | Falhas silenciosas |

### Evolução recomendável a partir do estado híbrido actual (orientação, não ordem de rewrite)

```text
Hoje: scripts clássicos + window.* + core extraído
        ↓
Contratos estáveis (BPStore, BPSync, BPAuth) + testes
        ↓
Namespaces por tenant no storage local
        ↓
ESM / chunks por rota com entry única (bootstrap)
        ↓
Core mínimo no boot; features sob import()
        ↓
RLS + testes e2e multi-tenant no CI
```

O objectivo **não** é “ter 150 ficheiros”. É **fronteiras claras, carregamento sob demanda e core auditável**.

## 4.7 Checklist prático “plataforma do género” (offline + sync + multi-tenant)

- [ ] RLS (ou equivalente) testado com dois tenants  
- [ ] Ops de escrita com ID estável (UUID) e upsert idempotente  
- [ ] Outbox/fila persistente com backoff e DLQ operável  
- [ ] Troca de tenant: wipe atómico ou storage namespaced  
- [ ] Logout: zero residual de dados do tenant anterior na UI  
- [ ] SW: estratégia definida; core versionado  
- [ ] CSP e escaping HTML  
- [ ] RBAC no servidor para operações sensíveis  
- [ ] Sync incremental + índices  
- [ ] Métricas de fila e taxa de erro de sync  
- [ ] Testes automatizados das políticas de isolamento  
- [ ] Documentação do protocolo de sincronização  
- [ ] Plano de incidente (fuga cross-tenant, perda de fila)  

---

# PARTE V — SÍNTESE PARA DECISÃO

| Dimensão | Leitura factual |
|----------|-----------------|
| Maturidade offline | Boa base (fila, patch dbPut, tombstones, batch) **[C]** |
| Maturidade multi-tenant no cliente | Mitigações na troca de salão; storage ainda global ao origin **[C]** |
| Maturidade multi-tenant no servidor | **Não provada neste artefacto** **[N]** |
| Segurança de autorização | UI guards sim; server enforcement **[N]/parcial [C]** |
| Operação em escala 20k users/dia | Exige índices, sync incremental, limites, observabilidade, testes de carga — não só mais features |
| Manutenção | Extracção do monólito foi o passo certo; próximo salto é **contratos + testes + menos ordem mágica** |

**Frase final:**  
O BelezaPro mostra **engenharia offline-first real e extracção modular em curso**. Os pontos que impedem uma declaração de “produção robusta multi-tenant à prova de auditoria” são sobretudo **RLS/isolamento no servidor (não visível aqui)**, **storage local global ao dispositivo**, **cache do Service Worker no core**, e **autorização ainda centrada no cliente**. As práticas listadas na Parte IV são o referencial nacional/internacional para fechar esses gaps sem reescrever a aplicação por impulso.

---

*Fim do documento — Tatilson Evidências*  
*Gerado para validação humana. Não substitui auditoria RLS no projecto Supabase nem teste de penetração formal.*
