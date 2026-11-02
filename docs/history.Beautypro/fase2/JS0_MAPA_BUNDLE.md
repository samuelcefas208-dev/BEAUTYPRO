# JS-0 — Mapa factual do app.bundle

**Fase:** JS-0 (somente auditoria)  
**Referência de runtime:** ZIP `Beautypro.computador5.zip` (plataforma de trabalho actual)  
**Nota:** Ficheiros JS soltos (fontes) existem no Git; **este ZIP de runtime não os inclui**.  
**Data do mapa:** 2026-08-26  
**Produção alterada:** NÃO (zero JS/HTML/Assumindo que queres um prompt pronto para entregar à outra IA executar o JS-5.5, usa este:

JS-5.5 — Integração Controlada do Charts

Contexto

O JS-5.4 foi concluído e aprovado.

Foi comprovada a equivalência comportamental entre o domínio legado de Charts e o novo domínio ESM através do harness "equiv-harness.mjs".

Resultado:

"EQUIV_OK [C]"

Isso significa que o domínio puro ESM pode reproduzir o comportamento relevante do domínio legado no conjunto de testes estabelecido.

Importante: até este momento, o ESM ainda não foi colocado no caminho de produção.

O objetivo desta subfase é integrar o ESM ao Charts de maneira controlada, reversível e observável.

---

Objetivo do JS-5.5

Integrar o domínio ESM ao caminho utilizado pelo Dashboard, mantendo o caminho legado intacto como mecanismo de rollback.

A arquitetura desejada é:

Dashboard
   │
   ▼
chart-module.js
   │
   ▼
Bridge / Boundary explícita
   │
   ▼
charts-serie-core (ESM)

O legado deve permanecer disponível:

chart-module.js
   │
   ├──► ESM — NOVO CAMINHO
   │
   └──► Legado — ROLLBACK

---

REGRAS ABSOLUTAS

1. Não tocar fora da fatia Charts

É proibido alterar:

- Auth
- IDB
- Sync
- CRUD
- "state"
- "salao_id"
- isolamento multi-tenant
- persistência
- fila de sincronização
- contratos de dados externos ao Charts

Se alguma alteração nesses componentes parecer necessária, PARAR e registrar a descoberta em vez de implementá-la.

---

2. Não remover o legado

Não remover:

- "analise-temporal.js"
- referências existentes no "ORDER"
- implementação legada
- caminhos de fallback existentes

JS-5.5 NÃO é JS-6.

A remoção do legado só poderá acontecer posteriormente, mediante nova fase e nova evidência.

---

3. Não editar o bundle manualmente

Não modificar diretamente:

app.bundle.js

Não copiar código manualmente para dentro do bundle.

Não fazer alterações que dificultem a reprodução do build.

Se o projeto possuir processo oficial de build, utilizá-lo.

---

PROCEDIMENTO

Fase A — Reconhecimento

Antes de modificar qualquer arquivo:

1. Mapear o fluxo atual do Charts.
2. Identificar exatamente onde "chart-module.js" recebe os dados.
3. Identificar exatamente onde o legado é chamado.
4. Identificar as funções públicas utilizadas pelo Dashboard.
5. Identificar o formato de entrada.
6. Identificar o formato de saída.
7. Identificar efeitos colaterais.
8. Identificar dependências implícitas.
9. Confirmar como o ESM exporta suas funções.
10. Confirmar se existe alguma incompatibilidade de ambiente/browser.

Não implementar nada durante esta etapa.

Registrar as descobertas.

---

Fase B — Criar a Boundary

Criar uma bridge/boundary explícita entre:

chart-module.js

e:

charts-serie-core

A bridge deve:

- possuir responsabilidade única;
- esconder detalhes internos do ESM;
- preservar o contrato esperado pelo Charts atual;
- evitar espalhar imports ESM pelo restante da aplicação;
- permitir rollback;
- ser pequena e auditável.

Não duplicar lógica de negócio desnecessariamente.

Não mover funcionalidades não relacionadas ao Charts.

---

Fase C — Integração

Alterar o mínimo necessário para que o Dashboard passe a utilizar o ESM através da bridge.

O fluxo deverá ser:

Dashboard
   ↓
chart-module.js
   ↓
Charts Boundary
   ↓
charts-serie-core

O caminho legado deverá continuar disponível.

Se possível, estruturar a seleção do caminho de forma que o rollback possa ser feito alterando um único ponto.

---

Fase D — Testes

Executar obrigatoriamente:

1. Testes automatizados existentes

Todos os testes existentes relacionados ao Charts.

2. Harness de equivalência

Executar novamente:

equiv-harness.mjs

O resultado esperado deve continuar sendo:

EQUIV_OK

3. Browser smoke test

Abrir o Dashboard no browser e verificar:

- carregamento;
- ausência de erros no console;
- gráficos;
- séries;
- valores;
- labels;
- eixos;
- tooltips;
- estados vazios;
- atualização dos dados;
- filtros, se aplicável;
- insights;
- comportamento após atualização/re-render.

4. Regressão

Verificar que funcionalidades fora da fatia Charts continuam funcionando.

Especialmente:

- navegação;
- Dashboard;
- carregamento do estado;
- funcionalidades de dados;
- Auth;
- persistência;
- Sync.

Não alterar essas áreas para corrigir um problema do Charts.

Se uma regressão aparecer fora da fatia, registrar e parar.

---

Fase E — Offline / Service Worker

Não modificar o Service Worker nesta fase.

Primeiro avaliar:

- se o novo módulo ESM está disponível offline;
- como o browser resolve o módulo;
- se existe dependência externa;
- se o cache atual cobre os novos arquivos;
- se a instalação existente do PWA continua funcionando;
- se há risco de "import" falhar sem rede.

Se for necessária alteração do SW, apenas documentar:

SW IMPACT DETECTED

e explicar exatamente o que será necessário.

Não implementar automaticamente a alteração do SW dentro do JS-5.5 sem evidência e decisão explícita.

---

Fase F — Rollback

O rollback deve ser explícito e verificável.

Definir claramente:

NOVO CAMINHO
ESM → charts-serie-core

ROLLBACK
Charts → implementação legada

Testar o rollback.

O sistema deve conseguir voltar ao caminho legado sem apagar arquivos nem reconstruir manualmente o bundle.

Registrar o procedimento utilizado.

---

DOCUMENTAÇÃO OBRIGATÓRIA

Atualizar:

JS0_MAPA_BUNDLE.md

A atualização é obrigatória.

Registrar:

1. arquivos analisados;
2. arquivos modificados;
3. arquivos não modificados;
4. fluxo anterior;
5. fluxo novo;
6. bridge criada;
7. contrato da bridge;
8. dependências encontradas;
9. testes executados;
10. resultados;
11. falhas;
12. correções;
13. decisões;
14. impacto no browser;
15. impacto offline;
16. procedimento de rollback;
17. qualquer descoberta relevante para JS-6.

Não escrever documentação genérica.

Registrar fatos verificáveis.

---

CRITÉRIOS DE ACEITAÇÃO

O JS-5.5 só poderá ser considerado concluído se:

- [ ] Dashboard utiliza o ESM através de uma boundary explícita.
- [ ] Legado continua disponível.
- [ ] Rollback foi testado.
- [ ] "EQUIV_OK" continua válido.
- [ ] Gráficos foram verificados no browser.
- [ ] Insights foram verificados.
- [ ] Não existem erros novos relevantes no console.
- [ ] Regressão básica foi executada.
- [ ] Auth não foi alterado.
- [ ] IDB não foi alterado.
- [ ] Sync não foi alterado.
- [ ] CRUD não foi alterado.
- [ ] "state" não foi alterado.
- [ ] "salao_id" não foi alterado.
- [ ] "app.bundle.js" não foi editado manualmente.
- [ ] "analise-temporal.js" continua disponível.
- [ ] "ORDER" não foi alterado para remover o legado.
- [ ] Service Worker não foi alterado sem evidência.
- [ ] "JS0_MAPA_BUNDLE.md" foi atualizado completamente.

---

PROIBIÇÕES

Não:

- refatorar o projeto inteiro;
- aproveitar a tarefa para limpar CSS;
- alterar arquitetura fora do Charts;
- migrar outros módulos;
- remover código legado;
- otimizar funcionalidades não relacionadas;
- alterar contratos de dados;
- alterar banco;
- alterar Supabase;
- alterar autenticação;
- alterar sincronização;
- alterar multi-tenant;
- modificar o Service Worker preventivamente;
- editar o bundle manualmente.

A menor alteração que comprova a integração é preferível.

---

FORMATO DO RELATÓRIO FINAL

Ao terminar, apresentar:

1. Resultado

JS-5.5: PASS / BLOCKED

2. Caminho executado

Dashboard
→ chart-module.js
→ Boundary
→ charts-serie-core

3. Arquivos alterados

Lista exata.

4. Arquivos preservados

Principalmente:

analise-temporal.js
app.bundle.js

5. Testes

Apresentar comandos e resultados reais.

6. Browser

Informar o que foi testado e o resultado.

7. Rollback

Explicar exatamente como voltar ao legado.

8. Offline

Informar se existe impacto conhecido.

9. "JS0_MAPA_BUNDLE.md"

Confirmar atualização.

10. Próximo passo

Não iniciar JS-6 automaticamente.

Se tudo estiver estável, declarar:

JS-5.5 READY FOR REVIEW

Caso exista qualquer problema que viole as regras desta tarefa:

JS-5.5 BLOCKED

e explicar exatamente o bloqueio.

---

PRINCÍPIO CENTRAL

Esta fase não busca "melhorar o projeto".

Busca provar uma única coisa:

«O Dashboard consegue utilizar o novo domínio ESM em produção sem alterar os contratos existentes e com rollback seguro para o legado.»

Primeiro:

ESM → produção → smoke → equivalência → estabilidade

Depois, em uma fase separada:

remoção comprovada do legado → JS-6/SW de runtime editados nesta fase)

---

## 1. Estado do repositório (neste artefacto)

### O que existe na raiz do ZIP [C]

| Artefacto | Tamanho (aprox.) | Papel no runtime |
|-----------|------------------|------------------|
| `app.bundle.js` | ~980 KB / ~24 289 linhas | Runtime principal |
| `bp-resumo-kpi.js` | ~3,8 KB | Script **fora** do bundle (espelha KPIs Resumo) |
| `bp-financeiro-nav.js` | ~2,6 KB | Script **fora** do bundle (nav financeiro) |
| `sw.js` | ~3 KB | Service Worker |
| `index.html` | ~95 KB | Shell + gate de sessão inline |
| `fase2/` | testes pure, docs, domain | **Não** entra no boot da app |

### O que **não** existe neste ZIP [C]

- `build-bundle.js` (referenciado no header do bundle e no comentário do `index.html`)
- Fontes soltas: `auth-supabase.js`, `crud-operations.js`, `db-indexeddb.js`, `sync-*.js`, `main.js`, etc.
- `package.json` na raiz (apenas `fase2/package.json` para Vitest/ESLint)

**Implicação [C]:** neste artefacto de deploy/trabalho visual, o **runtime JS da app é o bundle + 2 scripts satélite**, não a árvore de fontes do Git.

---

## 2. Como o bundle é gerado

### Evidência no próprio artefacto [C]

Primeira linha de `app.bundle.js`:

```text
/* BeautyPro app.bundle.js — gerado por build-bundle.js; ordem de dependências explícita */
```

Marcadores internos repetidos:

```text
/* ===== FILE: <nome>.js ===== */
```

Há **40** marcadores `FILE:` em sequência linear.

### Script de build neste ZIP [N]

`build-bundle.js` **não está** no ZIP.  
Hipótese forte [H]: no Git existe `build-bundle.js` (ou equivalente) que concatena as fontes na ordem dos marcadores.  
**Não comprovável só com este ZIP.**

### Ferramentas de bundling “modernas” neste runtime [C]

- Não há evidência de que **este** `app.bundle.js` seja produto de webpack/rollup/esbuild/vite em produção.
- `fase2/package.json` tem `vite` / `build:experimental` — escopo **experimental da fase2**, não o pipeline do bundle de produção neste artefacto [C para existência do script; H se alguém o usa para o bundle real].

**Conclusão parcial [C]:** o bundle apresenta-se como **concatenação ordenada** de ficheiros-fonte com cabeçalhos `FILE:`, gerada por ferramenta nomeada `build-bundle.js`. O mecanismo exacto do comando **não está neste ZIP** → [N] para “comando npm run X”.

---

## 3. Comando real de build

| Pergunta | Resposta | Classe |
|----------|----------|--------|
| Comando exacto neste ZIP? | **Não encontrado** | [N] |
| Nome da ferramenta referido? | `build-bundle.js` | [C] (string no header) |
| `package.json` raiz com script `build`? | Ausente neste ZIP | [C] |
| Regenerar bundle a partir só deste ZIP? | **Impossível** (faltam fontes + script) | [C] |

---

## 4. Entradas do bundle (ordem de concatenação)

Ordem **exacta** pelos marcadores `/* ===== FILE: … ===== */` [C]:

| # | Ficheiro | Linha início (aprox.) | Classe funcional |
|---|----------|----------------------|------------------|
| 1 | `core-constants.js` | 4 | CORE / CONFIG |
| 2 | `core-utils.js` | 66 | UTIL |
| 3 | `tests-pure.js` | 753 | UTIL / TEST (no bundle!) |
| 4 | `core-state.js` | 807 | STATE |
| 5 | `core-store.js` | 856 | STATE |
| 6 | `db-indexeddb.js` | 977 | DATABASE |
| 7 | `auth-supabase.js` | 1280 | AUTH |
| 8 | `supabase-resilience.js` | 1937 | INFRA / AUTH |
| 9 | `sync-queue.js` | 2255 | SYNC |
| 10 | `sync-rest.js` | 3081 | SYNC |
| 11 | `plano-limites.js` | 3953 | DOMAIN / PLANOS |
| 12 | `crud-operations.js` | 4142 | CRUD |
| 13 | `ui-render-dashboard-agenda.js` | 5822 | UI / DOMAIN |
| 14 | `ui-render-clientes-caixa-equipa.js` | 7147 | UI / DOMAIN |
| 15 | `analise-temporal.js` | 7853 | DOMAIN / CHART-adj |
| 16 | `chart-module.js` | 8433 | CHART |
| 17 | `vendas-modais.js` | 9750 | DOMAIN / UI |
| 18 | `detalhes-acessibilidade.js` | 10478 | UI |
| 19 | `ui-events-navegacao.js` | 10943 | EVENTS |
| 20 | `eventos-cadastros.js` | 11048 | EVENTS |
| 21 | `eventos-caixa-vendas.js` | 12233 | EVENTS |
| 22 | `eventos-globais.js` | 12943 | EVENTS |
| 23 | `ia-module.js` | 13260 | IA |
| 24 | `benza-tools.js` | 15664 | IA |
| 25 | `expirar-agendamento.js` | 16017 | DOMAIN |
| 26 | `main.js` | 16426 | BOOT |
| 27 | `finance-comissoes.js` | 16890 | DOMAIN |
| 28 | `finance-fase1-extra.js` | 16976 | DOMAIN |
| 29 | `ops-crm-comercial.js` | 17557 | DOMAIN |
| 30 | `equipa-fase3.js` | 18699 | DOMAIN |
| 31 | `gestao-fase78.js` | 19327 | DOMAIN |
| 32 | `marketing-fase2.js` | 20297 | DOMAIN |
| 33 | `menu-accordion.js` | 20665 | UI |
| 34 | `avatars-realistas.js` | 20938 | UI |
| 35 | `media-galeria.js` | 21079 | UI / MEDIA |
| 36 | `agenda-polish.js` | 22751 | UI / DOMAIN |
| 37 | `avatars-listas.js` | 22974 | UI |
| 38 | `desktop-shell.js` | 23184 | UI / DESKTOP |
| 39 | `desktop-enterprise.js` | 23655 | UI / DESKTOP |
| 40 | `security-hardening.js` | 24222 | INFRA |

**Padrão de ordem [C]:** constantes → utils → state → IDB → auth → sync → planos → CRUD → renders → charts → vendas → eventos → IA → **main (boot)** → extensões financeiras/ops/equipa/gestão/marketing → polish UI → desktop → security.

**Nota [C]:** `main.js` **não** é o último ficheiro; vários módulos de feature registam `DOMContentLoaded` **depois** de `main.js` na concatenação (finance, ops, equipa, etc.).

---

## 5. Transformações

| Tipo | Evidência | Classe |
|------|-----------|--------|
| Concatenação com marcadores `FILE:` | Header + 40 secções | [C] |
| `"use strict"` no topo do bundle | Linha 2 | [C] |
| Minificação total / uglify | Código legível, comentários preservados | [C] **não** minificado de forma agressiva |
| Transpilação TypeScript | Sintaxe JS clássica | [H] não TS |
| Tree-shaking | Secções inteiras de domínio presentes | [H] improvável |
| Source map | Não encontrado no artefacto | [C] ausente neste ZIP |

**Conclusão [C]:** o artefacto comporta-se como **concatenação ordenada quase em texto claro**, não como bundle minificado opaco de webpack.

---

## 6. Ficheiros JS fora do bundle

| Ficheiro | Runtime? | Papel | Classe |
|----------|----------|-------|--------|
| `bp-resumo-kpi.js` | Sim (`index.html`) | Lê `state` / helpers do bundle; espelha KPIs | [C] |
| `bp-financeiro-nav.js` | Sim | UI nav financeiro; chama `closeModal` se existir | [C] |
| `sw.js` | Sim (SW) | Cache shell; network-first para bundle/index | [C] |
| `fase2/**/*.js` | Não no boot da app | Vitest / pure / policies | [C] |
| Fontes Git (`auth-supabase.js`, …) | Não neste ZIP | Fontes de desenvolvimento (alegadas) | [H] no Git; [N] conteúdo vs bundle **neste** artefacto |

---

## 7. Runtime real (o que o browser carrega)

### Cadeia observada no `index.html` [C]

```text
1) <head> script IIFE — gate sessão (localStorage bp_session_*, classes html)
2) CSS (vários)
3) Sentry (CDN, defer)
4) @supabase/supabase-js@2 (CDN)
5) … DOM …
6) app.bundle.js?v=20260822-p3perf
7) bp-resumo-kpi.js?v=20260822-mirror3
8) bp-financeiro-nav.js?v=20260825-fin2
```

Comentário no HTML [C]:

```text
<!-- SCRIPTS — runtime único (Fase 1.4). Fontes individuais ficam no repo
     para edição; ordem em build-bundle.js. -->
```

### Service Worker [C]

- `CACHE_NAME = 'belezapro-shell-v20260825-f7-19'`
- `app.bundle.js` e `index.html`: **network-first** (fallback cache)
- Supabase: **nunca** cacheado via SW neste código

---

## 8. Mapa de boot (sequência factual)

### A. Antes do bundle [C]

1. IIFE no `<head>`: se `bp_session_active` + `bp_salao_id_cache` (ou meta), adiciona `bp-has-session` / `bp-booting`.
2. CSS de gate esconde login quando há sessão.

### B. Parse/execução do bundle [C]

- Todo o ficheiro é um script clássico (não `type="module"`).
- Definições em cascata por ordem de concatenação (funções/vars no scope do script / globais conforme declaração).

### C. `main.js` — `DOMContentLoaded` async `init` [C]

Trecho central (por volta da linha 16448):

- Esconde splash
- Reforça anti-flash login se sessão local
- `bpShowBootOverlay` se online/offline + salão
- Fluxo de sessão / UI (continuidade no mesmo listener)

### D. Outros `DOMContentLoaded` / `load` no bundle [C]

Múltiplos registos **espalhados** (auth upgrade buttons, chart chrome, IA hist, placeholders, finance/ops/equipa/gestão inits com `setTimeout`, etc.).  
Ordem de *callback* = ordem de registo no parse ≈ ordem no ficheiro, não “só main.js”.

### E. Scripts satélite [C]

- `bp-resumo-kpi.js` e `bp-financeiro-nav.js`: IIFE; dependem de símbolos já definidos pelo bundle (`state`, `closeModal`, …) → **devem carregar depois** do bundle (como no HTML).

---

## 9. Side effects (amostra classificada)

| Padrão | Exemplos no bundle | Classificação preliminar |
|--------|--------------------|-------------------------|
| `DOMContentLoaded` → `init` | `main.js` | BOOT-CRITICAL [C] |
| `DOMContentLoaded` + `setTimeout(init)` | finance, ops, equipa, gestao, marketing, … | BOOT-SIDE-EFFECT / FEATURE [C existência; H criticidade] |
| `addEventListener('load')` | presente | BOOT-SIDE-EFFECT [C] |
| Definição `let state = {…}` | `core-state.js` | BOOT-CRITICAL (estado) [C] |
| `openDB` / IDB | `db-indexeddb.js` | INFRA; momento exacto de abertura [H] até ler todos os call sites |
| Listeners online/offline, visibility | presentes em várias zonas | FEATURE / SYNC-adj [H] |
| `tests-pure.js` **dentro** do bundle | expõe testes pure no runtime | BOOT-SIDE-EFFECT indesejável para produção? [H] produto; [C] está no bundle |

---

## 10. Globals (amostra factual)

### Definidos no scope do bundle (visíveis a scripts seguintes na página) [C]

| Símbolo | Onde (ficheiro lógico) | Notas |
|---------|------------------------|-------|
| `state` | `core-state.js` (`let state = {`) | Estado central |
| `toast` | `core-utils.js` (`function toast`) | UI feedback |
| `openDB` / `dbPut` | `db-indexeddb.js` | Persistência |
| `checkSession` | `auth-supabase.js` | Auth |
| `addCliente` | `crud-operations.js` | CRUD |
| `updateUI` / `renderBadges` | renders UI | UI |

### `window.*` com uso relevante (contagens aproximadas de ocorrência) [C]

| Símbolo | Uso relativo |
|---------|----------------|
| `window.BeautyStore` | Alto |
| `window.BPMedia` / `BPOps` / `BPRuntime` / `BPFinance` / `BPGestao` / `BPEquipa` / `BPMarketing` / `BPAgendaUI` / `BPAvatars` | Namespaces de feature |
| `window.state` | Espelhamento / acesso externo |
| `window.addToCart` / `clearCart` / `openModal` / `closeModal` | API UI |

**Conclusão [C]:** o acoplamento entre “módulos” é predominantemente **global / temporal**, não `import`/`export`.

---

## 11. Dependências críticas (exemplos, não grafo completo)

| Consumidor (lógico) | Precisa de | Tipo de dependência | Classe |
|---------------------|------------|---------------------|--------|
| `crud-operations` | `state`, IDB (`dbPut`), possivelmente toast/limites | Global + temporal (CRUD após state/IDB/planos) | [C] ordem; [H] lista exacta de símbolos |
| `sync-rest` / `sync-queue` | auth/session, IDB, queue key | Global + side effects | [H] detalhe fino |
| `ui-render-*` | `state`, DOM IDs | Global + DOM | [C] padrão |
| `main.js` init | `checkSession`, overlay, UI | Temporal + global | [C] |
| `bp-resumo-kpi.js` | `state`, `getIntervaloDashAtual` | Global **entre ficheiros de página** | [C] |
| `bp-financeiro-nav.js` | `closeModal` | Global | [C] |

**Regra observada [C]:** a **ordem de concatenação** materializa dependências temporais (“B só funciona se A já definiu o símbolo”).

---

## 12. Estado fonte vs bundle

| Pergunta | Resposta | Classe |
|----------|----------|--------|
| Fontes soltas neste ZIP? | Não | [C] |
| Posso diff fonte↔bundle aqui? | Não | [C] |
| Editar `sync-rest.js` no Git **sem** rebuild altera o que o browser corre **neste** deploy? | **NÃO** — o browser carrega `app.bundle.js` | [C] para este artefacto |
| HTML admite fontes no repo? | Sim (comentário) | [C] texto; conteúdo Git [N] neste ZIP |
| Divergência fonte/bundle possível? | **Sim**, se alguém editar fontes e não regenerar o bundle | [H] cenário; [C] risco arquitectural |

**Resposta objectiva à pergunta do prompt:**

> Se eu editar `sync-rest.js` hoje e NÃO executar o comando de build, o browser passa a executar essa alteração?

**NÃO** (no runtime deste ZIP/plataforma servida via `app.bundle.js`).  
**DEPENDE** apenas se existir outro mecanismo de carga das fontes (não encontrado no `index.html` deste artefacto).

---

## 13. Candidatos futuros à modularização (só classificação, zero implementação)

| Área | Potencial | Motivo / risco |
|------|-----------|----------------|
| Charts (`chart-module`, analise-temporal) | ALTO | Feature pesada; muitos inits tardios |
| IA (`ia-module`, benza-tools) | ALTO | Isolável; não crítica offline do caixa |
| Marketing / gestao / ops-crm | ALTO–MÉDIO | Extensões após `main` |
| Desktop shell/enterprise | MÉDIO | Só desktop |
| Avatars / media-galeria | MÉDIO | UI auxiliar |
| Agenda polish | MÉDIO | Acoplado a UI agenda |
| CRUD + state + IDB + sync | **NÃO SEPARAR AINDA** | Núcleo offline / multi-tenant |
| Auth + supabase-resilience | **NÃO SEPARAR AINDA** | Boot / sessão |
| `main.js` boot | **NÃO SEPARAR AINDA** | Orquestra init |
| `tests-pure.js` **no** bundle | Remover do artefacto de produção (futuro) | Não é feature de utilizador [H produto] |

---

## 14. Riscos encontrados

1. **Fonte ≠ runtime** se o Git for editado sem rebuild [C risco de processo].  
2. **Muitos side effects de boot** além de `main.js` (inits com timeout em dezenas de sítios) [C].  
3. **`tests-pure.js` empacotado no bundle de produção** [C].  
4. **Acoplamento global** impede ESM ingénuo sem mapa de símbolos [C].  
5. **SW network-first no bundle** reduz risco de JS antigo em cache, mas offline depende de falha de rede → fallback cache [C].  
6. **Dois JS satélite** fora do bundle aumentam superfície de ordem de carga [C].  
7. **Segredos no bundle** — `SUPABASE_ANON_KEY` em texto claro no início do ficheiro [C] (esperado para anon key; não é secret de serviço).

---

## 15. Lacunas [N]

| Lacuna | Impacto |
|--------|---------|
| Conteúdo exacto de `build-bundle.js` | Não se pode reproduzir o build só com este ZIP |
| Diff linha-a-linha fonte Git ↔ secções do bundle | Requer checkout Git + script de build |
| Grafo completo símbolo→consumidores | Só amostra; JS-1 |
| Momento exacto de `openDB` / primeiro sync em todos os paths | Requer leitura call-site completa |
| Lista completa de long tasks / bytes transferidos em rede real | JS-2 (baseline) |
| Se Vite experimental já gerou algum artefacto de produção | Não evidenciado neste ZIP |

---

## 16. Conclusão factual

1. **Hipótese “fontes concatenadas → app.bundle.js”:** **confirmada ao nível do artefacto** pelos marcadores `FILE:` e pelo header `build-bundle.js` [C].  
2. **Prova do comando e das fontes neste ZIP:** **incompleta** — faltam `build-bundle.js` e JS soltos [N/C].  
3. **Runtime do browser (este ZIP):** gate inline → CDN Supabase/Sentry → **`app.bundle.js` (quase toda a app)** → `bp-resumo-kpi.js` → `bp-financeiro-nav.js` [C].  
4. **Dependências:** sobretudo **globais + ordem temporal + side effects**, não módulos ES [C].  
5. **Boot:** `main.js` é o orquestrador principal, mas **não** é o único código de init [C].  
6. **Editar fontes sem rebuild não actualiza este runtime** [C].  
7. **JS-0 cumpre o objectivo de mapa** para **este** artefacto de plataforma; o cruzamento com o Git (fontes + `build-bundle.js`) fica como **próximo passo de evidência** ainda dentro de JS-0 alargado ou início de JS-1, **sem** mover código de produção.

---

## 17. Validação de integridade desta fase

| Item | Estado |
|------|--------|
| `app.bundle.js` alterado? | **Não** |
| HTML/CSS/SW alterados? | **Não** |
| JS de produção editados? | **Não** |
| Único entregável novo | `fase2/docs/JS0_MAPA_BUNDLE.md` (documentação) |
| Modularização / import() / src/ | **Não iniciados** |

---

## 18. Paragem

**JS-0 (mapa deste ZIP): concluído ao nível documental.**  

**Não iniciar JS-1** sem validação humana.  
**Não** tocar no bundle.  
**Não** optimizar.

Se a validação exigir prova fonte↔bundle: fornecer acesso ao Git com `build-bundle.js` + JS soltos e repetir a secção 12 com diffs amostrais — ainda como auditoria, sem alterar produção.

---

## JS-0.1 — Cruzamento ZIP × Git

**Data:** 2026-08-26  
**Repo:** https://github.com/BeautyPro07/Belezapro  
**Branch:** `main`  
**Commit analisado:** `a351909de350cb2181d228ba9919bfc2bf210f6d` (clone `--depth 1`)  
**ZIP cruzado:** `Beautypro.computador5.zip` (runtime de trabalho)  
**Produção alterada:** NÃO (leituras + clone temporário em `/tmp` apenas)

### Objectivo desta sub-fase

Fechar os `[N]` do JS-0 relativos a: *quem gera o bundle*, *comando*, *paridade fonte↔bundle*, *ZIP vs Git*.

---

### A. Build script e comando [C]

| Item | Evidência |
|------|-----------|
| Script | `build-bundle.js` na raiz do Git |
| Uso documentado no script | `node build-bundle.js` |
| Comportamento | Lê `ORDER[]`, concatena cada ficheiro com marcador `/* ===== FILE: name ===== */`, escreve `app.bundle.js` |
| Transformações | **Nenhuma** além de prefixo header + `"use strict";` + marcadores + concatenação de texto |
| Script SW | `build.js` gera `sw.js` a partir de `sw.template.js` (hash de shell) — **pipeline separado** do JS app |
| `package.json` raiz | **Ausente** no commit analisado (não há `npm run build` padrão na raiz) |

**Pipeline factual [C]:**

```text
SOURCE (40 × *.js na raiz, lista ORDER)
  ↓
node build-bundle.js
  ↓
app.bundle.js
  ↓
index.html → <script src="app.bundle.js?v=…">
  ↓
BROWSER
```

---

### B. Ordem real [C]

A lista `ORDER` em `build-bundle.js` tem **40** entradas e coincide **1:1** com os marcadores `FILE:` do `app.bundle.js` no Git e com o mapa JS-0 do ZIP.

Ordem = a documentada no JS-0 (core → … → main → features → polish → security).

---

### C. Fonte → secção do bundle [C]

Comparação programática (normalizando newline final):

- **40/40** ficheiros do `ORDER`: conteúdo da fonte = conteúdo da secção correspondente no bundle (**match após normalizar `\n` final**).
- Divergências de 1 byte antes da normalização = apenas newline terminal acrescentada pelo build — **não** divergência de lógica.

**Conclusão [C]:** no commit `a351909…`, as fontes do `ORDER` estão **sincronizadas** com o `app.bundle.js` do Git.

---

### D. ZIP × Git — `app.bundle.js` [C]

| Artefacto | MD5 | Bytes |
|-----------|-----|-------|
| ZIP `Beautypro.computador5` `app.bundle.js` | `62a3a6d328694f41eb64b11dd10415ad` | 980489 |
| Git `main` @ `a351909` `app.bundle.js` | `62a3a6d328694f41eb64b11dd10415ad` | 980489 |

**ZIP bundle ≡ Git bundle** neste ponto de análise [C].

Nota: `node build-bundle.js` reexecutado no clone produz MD5 diferente por **1 byte** (newline); não indica fontes desactualizadas — indica sensibilidade a newline no artefacto. O bundle **commitado** no Git coincide com o ZIP.

---

### E. Ficheiros no Git que **não** entram no bundle [C]

Declarados no próprio `build-bundle.js` + verificação em disco:

| Ficheiro | Motivo |
|----------|--------|
| `sw.js` / `sw.template.js` | Service Worker |
| `build-bundle.js` / `build.js` | Tooling |
| `app-entry.js` | Entrada ESM **futura** (`import` de um subconjunto; **não** usado pelo `index.html` de produção) |
| `app.js` | Stub (~2 bytes) — legado vazio |
| `bp-resumo-kpi.js` | Runtime **fora** do bundle (carregado no HTML) |

**Fora do ORDER e presentes no Git (exemplos):** qualquer JS não listado em `ORDER` não é concatenado.

---

### F. Ficheiros no ZIP **ausentes** no Git (divergência de packaging) [C]

| Ficheiro | ZIP | Git `main` |
|----------|-----|------------|
| `bp-financeiro-nav.js` | Presente + referenciado no `index.html` do ZIP | **Ausente** |
| `index.html` scripts | `app.bundle` + `bp-resumo-kpi` + `bp-financeiro-nav` | `app.bundle` + `bp-resumo-kpi` (**sem** financeiro-nav no grep do commit) |

**Implicação [C]:** o ZIP de trabalho pode incluir **patches de runtime** (ex. nav financeiro) ainda não reflectidos no Git, ou o Git está atrás do ZIP em scripts satélite. O **bundle principal** está alinhado; a **superfície HTML/scripts extra** pode divergir.

---

### G. Respostas às hipóteses críticas

#### 1) Alterar `sync-rest.js` no Git **sem** `node build-bundle.js` chega ao browser?

**NÃO [C].**  
O browser carrega `app.bundle.js`. O build é concatenação explícita; não há `<script src="sync-rest.js">` no `index.html` de produção.

#### 2) Alterar `app.bundle.js` directamente?

**Impacto [C]:** o runtime **muda** (é o que o browser executa).  
**Risco de processo [C]:** a alteração **não** actualiza as fontes; o próximo `node build-bundle.js` **sobrescreve** o bundle a partir das fontes e **apaga** edições manuais no bundle.

#### 3) Fonte de verdade

| Papel | Artefacto | Classe |
|-------|-----------|--------|
| **Desenvolvimento (código editável)** | Ficheiros JS do `ORDER` no Git | [C] intenção do repo + `build-bundle.js` |
| **Runtime (o que corre)** | `app.bundle.js` (+ satélites no HTML) | [C] |
| **Regeneração** | `node build-bundle.js` | [C] |

---

### H. `app-entry.js` (ESM) [C]

Existe no Git com `import './…'` de um subconjunto de módulos.  
**Não** é o entry do `index.html` actual (comentários e HTML apontam para o bundle).  
Documentação `MODULOS_ESM_VITE.md` confirma: produção = bundle; ESM = caminho futuro.

---

### I. Matriz actualizada (pós JS-0.1)

| Questão | Estado | Evidência |
|---------|--------|-----------|
| Build script | **[C]** | `build-bundle.js` |
| Comando build | **[C]** | `node build-bundle.js` |
| Ordem | **[C]** | `ORDER` ≡ marcadores FILE (40) |
| Fonte → bundle | **[C]** | 40/40 match (newline normalizado) |
| Bundle → browser | **[C]** | `index.html` script src |
| JS externo ao bundle | **[C]** | `bp-resumo-kpi.js`; SW; (ZIP: + `bp-financeiro-nav.js`) |
| SW pipeline | **[C]** | `build.js` + `sw.template.js` |
| Paridade Git bundle × ZIP bundle | **[C]** | MD5 idêntico |
| Paridade Git × ZIP (scripts satélite) | **[C]** divergência | `bp-financeiro-nav` só no ZIP |
| Globals / side effects | **[C]** amostra JS-0; grafo completo → JS-1 | JS-0 |
| `package.json` raiz scripts npm | **[N]** | ficheiro ausente no commit |
| Commit exacto que *gerou* o blob historicamente | **[N]** | só comprovámos igualdade actual fonte↔bundle↔ZIP |

---

### J. Lacunas que **restam** [N] (honestas)

1. Histórico git *blame* de quando o blob do bundle foi commitado vs cada fonte (não necessário para o gate actual).  
2. Grafo completo símbolo→consumidor (adiado a **JS-1**).  
3. Alinhar oficialmente `bp-financeiro-nav.js` Git ↔ ZIP (processo de packaging, não arquitectura de módulos).

---

### K. Riscos descobertos nesta sub-fase

1. Editar só o bundle ou só a fonte **sem** rebuild → dessincronia (processo).  
2. ZIP de trabalho pode ter **extras** (ex. `bp-financeiro-nav.js`) fora do Git.  
3. `app-entry.js` pode induzir a pensar que ESM já é runtime — **não é**.  
4. `build.js` (SW) lista ainda alguns JS individuais no template de hash — pode estar **desactualizado** face ao modelo “só bundle” ([H] até ler `sw.template.js` completo; não bloqueia o mapa do bundle).

---

### L. Validação

| Check | |
|-------|--|
| `app.bundle.js` de produção do utilizador editado? | **Não** |
| GitHub alterado? | **Não** |
| Documento | **Actualizado** (secção JS-0.1 acrescentada; histórico JS-0 preservado) |
| JS-1 iniciado? | **Não** |

---

**JS-0.1: concluído.**  
Hipótese fontes → concatenação → bundle → browser: **provada** no Git.  
ZIP e Git: **mesmo** `app.bundle.js`; divergência menor em script satélite.

**PARAR.** Não iniciar JS-1 sem ordem explícita.

---

# JS-1 — Dependências, Estado e DOM

**Data:** 2026-08-26  
**Repo:** https://github.com/BeautyPro07/Belezapro  
**Branch:** `main`  
**Commit:** `a351909de350cb2181d228ba9919bfc2bf210f6d`  
**Fontes:** JS soltos do Git (= secções do bundle, JS-0.1)  
**Produção alterada:** NÃO  

**Pergunta da fase:** *Se amanhã retirarmos responsabilidades do bundle, o que pode separar-se sem partir o runtime?*  
**Resposta preliminar:** só após respeitar acoplamento **global + temporal + redefinição de funções** (ex. `dbPut`). Não há ESM; separação ingénua parte sync/CRUD.

---

## 1. Escopo analisado

- 40 módulos do `ORDER` (leitura direccionada, não linha-a-linha de 24k)
- Foco: `core-state`, `core-store`, `db-indexeddb`, `auth-supabase`, `sync-queue`, `sync-rest`, `crud-operations`, `main`, renders/eventos (amostra), `window.BP*`
- DOM: inventário de `getElementById` mais frequentes
- Side effects: contagem `DOMContentLoaded` por ficheiro

**Limite:** não é grafo exaustivo de *cada* símbolo; é mapa dos **elos críticos** Auth / Estado / IDB / Sync / CRUD / Boot / DOM.

---

## 2. Dependências — tipos (regra)

| Tipo | Significado neste codebase |
|------|----------------------------|
| **Global** | Símbolo no scope do script partilhado (`state`, `dbPut`, `toast`, …) |
| **Temporal** | A só funciona se B já correu (ORDER) |
| **Side effect** | B **substitui** ou regista algo ao carregar (ex. reassign `dbPut`) |
| **DOM** | `getElementById` / classes assumidas |
| **Explícita** | `import`/`export` — **quase ausente** no runtime de produção |

Não existe grafo ESM no runtime. `app-entry.js` tem imports mas **não** é o entry do HTML [C JS-0.1].

---

## 3. Elos críticos comprovados

### 3.1 `dbPut` — redefinição temporal [C]

1. `db-indexeddb.js` define `let dbPut = async function…` (IDB + mirror localStorage).  
2. `sync-queue.js` (mais tarde no ORDER) faz **`dbPut = async function…`** e, após escrita, chama `addToSyncQueue` para upsert/delete.

**Implicação:** qualquer “módulo” que chame `dbPut` **depende** de `sync-queue.js` já ter corrido.  
Separar IDB sem o wrapper de sync **parte** a fila.  
Tipo: **global + temporal + side effect** (monkey-patch do símbolo).

### 3.2 `state` + `BeautyStore` [C]

- `core-state.js`: `let state = { config, clientes, agendamentos, … }`.  
- `core-store.js`: `setState` / `setList` / `pushToList` / … mutam o **mesmo** objecto `state` e notificam; expõe `window.BeautyStore = { … }`.  
- CRUD e UI: escrevem `state.*` **directamente** e/ou via `BeautyStore` se existir.

**Autoridade:** o objecto `state` em memória é a fonte de verdade **em sessão**; persistência em IDB/mirror; não há store isolado por domínio.

### 3.3 `salao_id` [C]

| Camada | Onde |
|--------|------|
| Memória | `state.config.salaoId` |
| localStorage | `bp_salao_id_cache` (+ meta sessão) |
| IDB config | key/id `salaoId` |
| Remoto | `profiles.salao_id` (Supabase) |

Escrita principal: `auth-supabase.js` (`bpMarkSessionLocal`, `checkSession`).  
Leitura: auth, sync payloads, limites, IA, UI.  
Troca de salão: `detetarTrocaDeSalao` em **`crud-operations.js`** + limpeza em `loadState(true)` (clear stores + queue; **DLQ não limpa** — alinhado com F2).

### 3.4 Fila de sync [C]

- Chave: `bp_sync_queue` (localStorage)  
- DLQ: `bp_dlq`  
- API: `addToSyncQueue`, `flushSyncQueue`, reprocessamento DLQ  
- Payload filtrado/`salao_id`: lógica em sync-rest / queue (já caracterizada em F2; não re-auditar RLS aqui)

---

## 4. Globals prioritários (amostra)

| Símbolo | Criado por (ORDER) | Consumido por (amostra) | Tipo | Risco |
|---------|-------------------|-------------------------|------|-------|
| `state` | core-state | Quase tudo | Global | **P0** se duplicar stores |
| `activeTab` | core-state | navegação UI | Global | Médio |
| `setState` / `BeautyStore` | core-store | CRUD, UI | Global | Alto se ignorado |
| `openDB` / `dbPut` / `dbPutLocal` / `dbGetAll` | db-indexeddb; **dbPut reassign** sync-queue | CRUD, loadState, sync | Global+SE | **P0** |
| `toast` | core-utils | CRUD, UI, sync | Global | Médio |
| `checkSession` / `bpMarkSessionLocal` | auth-supabase | main boot | Global | **P0** |
| `addToSyncQueue` / `flushSyncQueue` | sync-queue | wrapper dbPut, alguns CRUD | Global | **P0** |
| `addCliente` / CRUD | crud-operations | eventos UI | Global | Alto |
| `updateUI` / `renderBadges` | ui-render-* | main, store fallback | Global | Alto |
| `window.BPFinance` / `BPOps` / `BPEquipa` / `BPGestao` / `BPMarketing` / `BPMedia` / `BPAvatars` / `BPAgendaUI` | respectivos domain files | menus/desktop | window.* | Médio–isolável |
| `window.BPRuntime` | main / sync paths | pull timestamps | window.* | Médio |
| `cartItems` (carrinho) | vendas-modais (+ LS) | vendas | Global de domínio | Alto no fluxo venda |

---

## 5. State Ownership Matrix (factual)

| Dado | Quem lê | Quem escreve | Persistência | Fonte de verdade (runtime) | Risco |
|------|---------|--------------|--------------|----------------------------|-------|
| Sessão local | gate HTML, auth, main | auth (`bpMarkSessionLocal`, logout) | `localStorage` (`bp_session_*`, meta) | LS + Supabase session | Múltiplas chaves — documentar, não unificar agora |
| `salao_id` | auth, sync, CRUD, IA, UI | auth (+ cache IDB config) | LS `bp_salao_id_cache`, IDB config, `state.config` | **profile remoto** quando online; cache local offline | Multi-writer de *cache*; autoridade de negócio = profile |
| `state.config` (plano, nome, …) | UI, limites | auth, loadState, CRUD config | IDB `config` + LS plano por salão | Híbrido | |
| `state.clientes` (e listas) | UI, CRUD, IA | CRUD, `loadState`, pull | IDB store + mirror LS | Memória hidratada de IDB; remoto via pull | Escrita directa **e** BeautyStore |
| Agenda / movimentos / … | idem | idem | IDB | idem | |
| Sync queue | sync-queue, indicadores | addToSyncQueue, flush | **LS** `bp_sync_queue` | Fila local | |
| DLQ | sync-queue | falhas de flush | **LS** `bp_dlq` | DLQ local | **Não** limpa na troca de salão [C F2/JS-1] |
| Carrinho venda | vendas-modais | vendas-modais | LS (não `state.carrinho`) | Módulo vendas | Estado **fora** do objecto `state` principal |
| `activeTab` | UI nav | nav events | LS `bp_active_tab` | LS + memória | |

**Múltiplos escritores em listas:** `state.x.push` **ou** `BeautyStore.pushToList` — risco de divergência se um caminho esquecer notify [C padrão no código].

---

## 6. Fluxos críticos

### 6.1 AUTH (simplificado) [C]

```text
login UI
  → supabase auth (CDN client)
  → checkSession / profile.salao_id
  → state.config.salaoId + bpMarkSessionLocal
  → detetarTrocaDeSalao? → loadState(true) limpa IDB/queue
  → loadState / carregarDoSupabase
  → updateUI
```

Ficheiros: `auth-supabase.js`, `crud-operations.js` (`loadState`, troca), `main.js` (chama `checkSession`), `db-indexeddb.js`.

### 6.2 CRUD (ex. cliente) [C]

```text
UI evento
  → addCliente (crud-operations)
  → validar limite/telefone/duplicado
  → dbPut('clientes', n)   // após sync-queue: também enqueue
  → BeautyStore.pushToList | state.clientes.push + updateUI
  → toast
```

**Nota:** `addCliente` em si não chama `addToSyncQueue`; depende do **wrapper** de `dbPut` em `sync-queue.js` [C].

### 6.3 SYNC [C]

```text
dbPut (wrapper) / delete
  → addToSyncQueue (LS)
  → flushSyncQueue (online)
  → sync-rest / formato payload + salao_id
  → Supabase REST
  → sucesso remove op | falha backoff | DLQ
```

Pull remoto: `dbPutLocal` (sem enqueue) + hidratação de `state`.

### 6.4 BOOT [C]

```text
index gate (LS sessão)
  → parse app.bundle (ORDER completo)
  → side effects: vários DOMContentLoaded registados
  → bp-resumo-kpi.js / (ZIP) bp-financeiro-nav.js
  → main.js: DOMContentLoaded async init
       openDB → checkSession → load/pull → updateUI
  → outros inits (finance, ops, IA, charts, …) com setTimeout
```

**Ordem de callbacks DOMContentLoaded ≈ ordem de registo ≈ ORDER** [H fino; [C] múltiplos registos existem].

---

## 7. DOM contracts (amostra de alta frequência)

IDs mais referenciados via `getElementById` nas fontes (contagem aproximada) [C]:

| ID | Uso típico | Obrigatoriedade |
|----|------------|-----------------|
| `menu-dropdown` | Menu global | [C] alto |
| `login-view` / `app-view` | Gate auth UI | [C] obrigatório boot |
| `ia-chat` / `ia-input` / `ia-enviar` | Benza | [C] se aba IA |
| `modal-cliente` / `modal-prof` / `cliente-id` / `prof-id` | Cadastros | [C] fluxos |
| `modal-expirar` | Alerta agendamento | [C] feature |
| `splash-screen` / `bp-boot-overlay` | Boot UX | [C] main |
| `tab-dashboard` | Nav | [C] |
| `movimentos-list` / `weekly-chart` | Caixa/dashboard | [C] ecrãs |
| `agenda-cliente` / `agenda-edit-id` | Agenda | [C] |

**Contrato invisível:** o HTML do ZIP/Git deve manter estes IDs; CSS pode mudar classes, mas **IDs** são API do JS.

---

## 8. Side effects de boot (por ficheiro, `DOMContentLoaded`)

| Ficheiro | Ocorrências (fonte) |
|----------|---------------------|
| sync-queue.js | 3 |
| main.js | 2 |
| ia-module.js | 2 |
| chart-module.js | 2 |
| eventos-globais.js | 2 |
| media-galeria.js | 2 |
| + 1 em vários domain/polish | equipa, gestao, marketing, finance, desktop, … |

**[C]** Boot **não** é só `main.js`.  
**[C]** `sync-queue` regista efeitos cedo (além de reassign `dbPut`).

---

## 9. Grafo factual (dependência de runtime, não pastas)

```text
core-constants / core-utils
        ↓
   core-state (state)
        ↓
   core-store (BeautyStore → mesmo state)
        ↓
   db-indexeddb (openDB, dbPut base, mirror)
        ↓
   auth-supabase (session, salaoId)
        ↓
   sync-queue (REDEFINE dbPut + fila + DOMContentLoaded)
        ↓
   sync-rest (transporte)
        ↓
   plano-limites / crud-operations (loadState, CRUD, troca salão)
        ↓
   ui-render-* / eventos-* / vendas / charts / ia
        ↓
   main.js (init orquestrador)
        ↓
   domain BP* (finance, ops, equipa, …) + polish + desktop
        ↓
   security-hardening
```

**Ciclos:** não há import cycles; há **acoplamento circular de facto** via globals (UI ↔ state ↔ CRUD ↔ UI) [C].  
**“Ciclo” perigoso:** CRUD assume `dbPut` já wrappado; wrapper assume `addToSyncQueue` e tabelas — ordem ORDER é load-bearing.

---

## 10. Classification matrix (preparação JS-4 — **não migrar**)

| Unidade | Classe | Acoplamento | Isolável? |
|---------|--------|-------------|-----------|
| core-constants/utils | CORE | Baixo–médio | Cuidado (toast, uuid) |
| core-state/store | STATE | **Máximo** | **Não** cedo |
| db-indexeddb | PERSISTÊNCIA | Máximo | **Não** sem sync |
| sync-queue/rest | SYNC | Máximo | **Não** cedo |
| auth-supabase | AUTH | Máximo | **Não** cedo |
| crud-operations | DOMAIN+PERSIST | Máximo | **Não** cedo |
| main.js | BOOT | Máximo | **Não** |
| chart / analise-temporal | CHARTS | Médio | **Potencial** lazy |
| ia-module / benza-tools | IA | Médio | **Potencial** lazy |
| marketing / gestao / ops / equipa / finance | DOMAIN | Médio (via state/CRUD) | **Cuidado** |
| desktop-* / avatars / menu / agenda-polish | POLISH | Médio–baixo | **Potencial** |
| tests-pure no bundle | LEGACY | — | Candidato a sair do artefacto prod |
| app-entry.js | ESM futuro | — | Não runtime |

---

## 11. Architecture gates (offline / multi-tenant)

| Elo | Estado | Nota |
|-----|--------|------|
| Auth ↔ salao_id | [C] | profile → state + LS |
| salao_id ↔ state | [C] | `state.config.salaoId` |
| state ↔ IDB | [C] | loadState / dbPut / listas |
| IDB ↔ sync queue | [C] | **via reassign dbPut** |
| queue ↔ Supabase | [C] | flush + sync-rest |
| logout/troca ↔ dados locais | [C] | clear stores + queue; **DLQ permanece** |
| RLS | [C] auditoria F2 live | Não reabrir aqui |

**BLOCKERS para migração precoce:** reassign `dbPut`; `state` global único; `loadState`+troca salão; boot multi-`DOMContentLoaded`.

Qualquer `[N]` residual em call-sites exactos de *cada* listener não bloqueia o entendimento dos gates acima.

---

## 12. Refinamento face ao JS-0

| Antes (JS-0) | Depois (JS-1) |
|--------------|---------------|
| Dependências = ordem | Ordem **mais** monkey-patch `dbPut` [C] |
| state “central” | state + BeautyStore + LS + IDB + carrinho fora de state [C] |
| main = boot | main + muitos DOMContentLoaded [C] |
| Candidatos lazy | Charts/IA/polish mais credíveis; núcleo **não** |

Nada do JS-0.1 (build, paridade) foi invalidado.

---

## 13. [C] / [H] / [N]

**[C]**  
- ORDER e tipos de dependência global/temporal/SE  
- Matriz de donos para salao_id, state listas, queue, DLQ  
- Fluxos auth/CRUD/sync/boot em linhas gerais  
- Reassign `dbPut`  
- DOM IDs de alta frequência  

**[H]**  
- Ordem exacta de *todos* os callbacks DOMContentLoaded no browser  
- Cobertura 100% de writers de cada lista  

**[N]**  
- Grafo símbolo-a-símbolo completo  
- Cada listener de cada modal  

---

## 14. Testes

Não executados nesta sessão de sandbox (foco mapa).  
Os 76 pure **não** validam este grafo (regra já aceite).  
Recomendação: na máquina do projecto, `cd fase2 && npm test` como smoke de ambiente — **não** prova JS-1.

---

## 15. Ficheiros alterados

- Apenas documentação: `JS0_MAPA_BUNDLE.md` (secção JS-1)  
- **Produção alterada: NÃO**

---

## 16. Conclusão JS-1

1. O runtime é um **sistema de símbolos globais ordenados**, não módulos isolados.  
2. O elo mais perigoso para “separar ficheiros” é **`dbPut` redefinido por `sync-queue`**.  
3. Estado crítico tem **várias camadas** (memória, LS, IDB, remoto); `state` não é o único sítio.  
4. DOM IDs são contratos rígidos do JS.  
5. Candidatos a isolamento futuro: **charts, IA, polish, desktop** — nunca o núcleo Auth/IDB/Sync/CRUD/state sem desenho de ports.  
6. **Não** declarar ESM/lazy/core mínimo com base só neste mapa.

**PARAR. Não iniciar JS-2.**

---

# JS-2 — Baseline de Performance e Política de Carga

**Data:** 2026-08-26  
**Repo:** `BeautyPro07/Belezapro` · `main` @ `a351909de350cb2181d228ba9919bfc2bf210f6d`  
**Método:** medição de **bytes em disco** + análise estática de `index.html` / `sw.js` / `ORDER` + cruzamento com JS-1.  
**Não medido aqui:** tempos reais de parse/compile/execution, long tasks, TTI em dispositivo Android — marcados **[N]**.  
**Produção alterada:** NÃO  

**Distinção obrigatória:**

| Conceito | Significado |
|----------|-------------|
| ATUALMENTE CARREGADO | O que o HTML/SW puxam no arranque |
| NECESSÁRIO NO BOOT | O que a app precisa para login/sessão/shell/dados base |
| CANDIDATO A LAZY | Hipótese de carga posterior — **não implementado** |

---

## 1. Método de medição

| Métrica | Método | Ambiente |
|---------|--------|----------|
| Tamanho de ficheiros | `stat` / bytes UTF-8 de secções do bundle | Clone Git |
| JS/CSS no boot | Parse de `index.html` (`script src`, `link href`) | Estático |
| Composição do monólito | Split por `FILE:` markers | Estático |
| SW | Leitura de `sw.js` (`APP_SHELL`, fetch handlers) | Estático |
| Parse / long tasks / boot ms | — | **[N]** — requer Chrome DevTools / WebPageTest / dispositivo real |
| CDN Supabase + Sentry | Apenas presença no HTML | Tamanho de rede **[N]** sem fetch medido |

---

## 2. Baseline factual — tamanhos [C]

### 2.1 JavaScript servido pela app (1.ª carga típica)

| Asset | Bytes | Notas |
|-------|------:|-------|
| `app.bundle.js` | **980 489** | ~958 KiB; **quase todo o JS da app** |
| `bp-resumo-kpi.js` | 3 847 | Após o bundle |
| **Subtotal JS 1.ª parte app** | **~984 336** | Sem CDN |
| Sentry (CDN) | **[N]** rede | `defer` |
| `@supabase/supabase-js@2` (CDN) | **[N]** rede | Bloqueante no HTML (sem defer no snippet analisado) |

### 2.2 CSS ligado no `index.html` [C]

| Total CSS (ficheiros existentes) | **~299 220 bytes** (~292 KiB) |

Maiores: `kpis-caixa-listas.css` (~66 KB), `ia.css` (~39 KB), `layout-nav-tabs.css` (~36 KB), `login-carrinho-venda.css` (~25 KB), `desktop-responsive.css` (~24 KB).

### 2.3 HTML + ícones [C]

| Asset | Bytes |
|-------|------:|
| `index.html` | ~94 5 00 |
| `icon-192.png` + `icon-512.png` | **~2,1 MB** (cada ~1,05 MB) |
| `logo.png` | ~39 KB |
| `ia-empty-duo.png` | ~67 KB |

**Nota SW [C]:** comentário no `sw.js` — ícones **não** estão no precache leve (evita install lento); ficam em runtime.

### 2.4 Composição do `app.bundle.js` por secção (top) [C]

| Secção | Bytes (texto) | % do bundle (aprox.) |
|--------|-------------:|---------------------:|
| `ia-module.js` | 101 652 | ~10,4% |
| `media-galeria.js` | 67 205 | ~6,9% |
| `crud-operations.js` | 62 656 | ~6,4% |
| `ui-render-dashboard-agenda.js` | 55 348 | ~5,6% |
| `chart-module.js` | 52 137 | ~5,3% |
| `ops-crm-comercial.js` | 51 765 | ~5,3% |
| `eventos-cadastros.js` | 51 344 | ~5,2% |
| … | … | … |
| `tests-pure.js` | 1 513 | ~0,2% |

### 2.5 Agregado por categoria (mapeamento ORDER) [C]

| Categoria | Bytes | % bundle |
|-----------|------:|--------:|
| UI_RENDER + EVENTOS + vendas/acessib. | ~250 KB | **~25,5%** |
| DOMAIN_EXTRA (finance/ops/equipa/gestão/marketing) | ~170 KB | **~17,4%** |
| POLISH + DESKTOP + media/avatars | ~136 KB | **~13,9%** |
| PERSIST + AUTH + SYNC + planos | ~118 KB | **~12,1%** |
| IA (`ia-module` + `benza-tools`) | ~113 KB | **~11,5%** |
| CHARTS | ~72 KB | **~7,4%** |
| CRUD | ~63 KB | **~6,4%** |
| CORE + main + security (+ tests-pure) | ~56 KB | **~5,7%** |

**Facto [C]:** o “núcleo” persist/auth/sync+core é **menor** que UI+eventos, domain extra, polish ou IA isolada. O custo do monólito não é só “infra”.

---

## 3. O que está ATUALMENTE CARREGADO no boot [C]

```text
1. CSS × 17 (todos os link do index)     ~299 KB
2. Sentry CDN (defer)
3. supabase-js CDN
4. app.bundle.js                          ~980 KB  → parse + execute do ORDER inteiro
5. bp-resumo-kpi.js                       ~4 KB
6. SW: precache APP_SHELL (install)       index + bundle + CSS listados + logo + ia-empty + bp-resumo
```

**Facto [C]:** **não há code-splitting**. Qualquer visita que execute a app paga o **bundle completo** em download (ou cache) e em parse do script clássico.

### Service Worker [C]

| Aspeto | Comportamento |
|--------|----------------|
| `CACHE_NAME` | `belezapro-shell-v20260824-f7-11` (Git analisado; ZIP de trabalho pode ter versão mais nova) |
| Precache | Shell HTML/CSS/bundle/logo/ia-empty/bp-resumo — **sem** icon-192/512 |
| `app.bundle.js` / `index.html` | **network-first** (`no-store`), fallback cache |
| Outros (CSS, etc.) | cache-first com refresh de rede |
| Supabase | **nunca** via cache SW |

**Implicação offline [C]:** se o bundle já estiver em cache (visita prévia ou install), a app pode arrancar offline. Se for a **primeira** visita offline, sem cache do bundle → app JS indisponível.

---

## 4. Métricas de tempo / long tasks

| Métrica | Estado |
|---------|--------|
| Tempo até `DOMContentLoaded` | **[N]** |
| Tempo de parse de ~980 KB JS | **[N]** (depende CPU; Android modestos: risco de long tasks) |
| Long tasks > 50 ms | **[N]** — hipótese **[H]** de que parse+vários `DOMContentLoaded` geram trabalho longo no main thread |
| Memória JS heap | **[N]** |

**Método necessário [C descrição]:** Lighthouse / Performance panel num Android representativo (e desktop); throttling CPU 4–6×; comparar cold cache vs SW warm.

---

## 5. NECESSÁRIO NO BOOT vs apenas presente no bundle

Com base em JS-1 (fluxos), não em “está no ficheiro”:

### Necessário para boot útil (sessão + shell + dados base) — evidência de fluxo [C]

| Capacidade | Porquê no boot |
|------------|----------------|
| constants / utils / state / store | Sessão e UI base |
| IDB + auth + sync-queue/rest + planos | Offline + sessão + fila |
| CRUD + loadState | Hidratar listas |
| ui-render + eventos de navegação essenciais | Shell após login |
| main.js | Orquestra init |
| Gate HTML + login DOM | Entrada |

### Presente no bundle mas **não** requerido para o *primeiro* paint de login/shell — classificação de **candidatura** [H embasada em tamanho + JS-1]

| Capacidade | Motivo |
|------------|--------|
| Charts + analise-temporal (~72 KB) | Só dashboard/análises |
| IA + benza (~113 KB) | Só aba IA |
| media-galeria + avatars (~80 KB+) | Só quando há fotos/listas ricas |
| desktop-shell/enterprise (~34 KB) | Viewport ≥1024 |
| marketing / parte de gestão/ops | Menus secundários |
| tests-pure (~1,5 KB) | Não é feature de utilizador |

**Importante [C]:** “candidato” ≠ autorizado a lazy. Offline-critical pode **impedir** lazy mesmo se a feature for “secundária” na UX.

---

## 6. Tabela de política de carga (candidatos — **não implementados**)

Legenda: **BOOT** = deve estar disponível para arranque seguro · **EAGER** = logo após boot · **PREFETCH** = idle · **LAZY** = ao entrar na feature · **OFFLINE-CRITICAL** = não pode falhar sem rede se o utilizador já usou a app · **OPTIONAL** = pode degradar.

| Funcionalidade / bloco | Actualmente no bundle? | Classificação candidata | OFFLINE-CRITICAL? | Evidência |
|------------------------|------------------------|-------------------------|-------------------|-----------|
| Core state/store/utils | Sim | **BOOT** | Sim (estado) | JS-1 |
| IDB + auth + sync | Sim | **BOOT** | **Sim** | Offline-first |
| CRUD + loadState | Sim | **BOOT** | **Sim** | Dados locais |
| Render dashboard/agenda + nav events | Sim | **BOOT** / EAGER | Sim (UI principal) | Abas principais |
| Vendas / caixa events | Sim | **EAGER** (após shell) | **Sim** (operação) | Negócio core |
| Clientes/equipa events | Sim | **EAGER** | Sim | |
| Charts | Sim | **LAZY** candidato | Não (só visual) | ~7% bundle; não bloqueia CRUD |
| IA / Benza | Sim | **LAZY** candidato | Parcial (histórico LS) | ~11% bundle; aba dedicada |
| Media galeria | Sim | **LAZY** / PREFETCH | Não essencial | ~67 KB |
| Desktop shell | Sim | **LAZY** ou conditional | Não em mobile | Só desktop |
| Marketing / gestão extra | Sim | **LAZY** candidato | Depende uso | Domain extra |
| Finance comissões UI | Sim | **EAGER** ou LAZY | Se usado offline | Acoplado a movimentos |
| tests-pure | Sim | **OPTIONAL** (remover do prod) | Não | Não é UX |
| bp-resumo-kpi | Script extra | **EAGER** | Não crítico | Pequeno |
| CDN Supabase | Sim | **BOOT** (auth online) | Offline usa sessão/cache | |
| Ícones 1 MB+ | Runtime | OPTIONAL precache | Não | SW já os exclui |

**Caixa / agenda / clientes:** mesmo que “pareçam ecrãs”, a lógica está entrelaçada com CRUD/state — **não** marcar LAZY só por UX [C JS-1].

---

## 7. Onde está o ganho potencial real? [H + tamanhos C]

| Alavanca | Potencial | Condição |
|----------|-----------|----------|
| Diferir **IA** (~113 KB) | Alto em bytes | SW deve precachear se IA for usada offline; senão só online |
| Diferir **charts** (~72 KB) | Médio-alto | OK se dashboard tolerar carga ao abrir gráfico |
| Diferir **media/avatars/desktop** (~100 KB+) | Médio | Mobile beneficia mais |
| Diferir domain marketing/gestão | Médio | Menus pouco usados |
| Partir **CRUD/sync/auth** | **Falso ganho** se partir offline | BLOCKER JS-1 |
| Só minificar o monólito | **[N]** não medido; bundle já é texto legível | Ganho de download possível sem mudar arquitectura |
| Ícones | Já fora do precache install | [C] |

**Falso ganho [C princípio Angola]:** reduzir JS inicial e deixar **Caixa/Agenda** a exigir chunk em rede na primeira abertura offline.

---

## 8. Respostas ao critério de saída

| Pergunta | Resposta factual |
|----------|------------------|
| O que custa no boot? | **~980 KB JS app + ~299 KB CSS + CDN**; parse do monólito inteiro; muitos inits `DOMContentLoaded` [C tamanho; N tempo] |
| O que precisa estar no boot? | Auth, state, IDB, sync, CRUD, shell UI, main [C fluxos] |
| O que pode carregar depois? | **Candidatos:** charts, IA, media, desktop, marketing — **sem implementação** [H+C tamanho] |
| O que não pode quebrar offline? | Bundle (ou chunks equivalentes) de **persist/auth/sync/CRUD** + shell já em cache SW [C] |
| Ganho potencial real? | Tirar do caminho crítico **IA + charts + polish** (~20%+ do bundle), **depois** de política SW [H] |

---

## 9. Limitações [N]

- Sem perfil de Performance em dispositivo real.  
- Tamanhos CDN Supabase/Sentry não medidos.  
- Gzip/brotli de transferência **não** medidos (bytes em disco > bytes rede típicos).  
- `CACHE_NAME` do Git pode diferir do ZIP de trabalho do utilizador.

---

## 10. Riscos

1. Declarar LAZY sem SW → feature morta offline.  
2. Lazy de código que ainda muta `state`/`dbPut` no load → corrida com boot.  
3. Otimizar só o 1.º paint e partir operação de salão (caixa).  
4. Assumir que “core 5,7%” é o único custo — UI+IA+domain são a maioria dos bytes.

---

## 11. Conclusão JS-2

1. O custo dominante e **mensurável aqui** é o **monólito de ~980 KB** parseado de uma vez + **~300 KB CSS**.  
2. Infra (auth/IDB/sync) **não** é a fatia maior em bytes; **UI, domain extra, IA e polish** somam a maior parte.  
3. Política candidata: manter **BOOT** o núcleo offline; estudar **LAZY** só para IA/charts/media/desktop **com** contrato SW.  
4. Tempos e long tasks permanecem **[N]** até medição em device.  
5. **Nenhuma** optimização foi aplicada.

---

## 12. Ficheiros alterados

- Documentação apenas: secção JS-2 neste ficheiro.  
- **Produção alterada: NÃO**

## 13. Paragem

**JS-2 concluído ao nível documental/estático.**  
**Não** iniciar JS-3.  
**Não** implementar lazy/`import()`.  
**Não** alterar bundle/HTML/SW.

---

# JS-3 — Pipeline de build e Service Worker (as-is)

**Data:** 2026-08-26  
**Commit:** `a351909de350cb2181d228ba9919bfc2bf210f6d` (`main`)  
**Produção alterada:** NÃO  

**Objectivo:** documentar a cadeia real  

```text
FONTE → build-bundle.js → app.bundle.js → index.html → Service Worker → CACHE → BROWSER
```

sem alterar nada e sem implementar lazy/ESM.

**Refinamento do veredito JS-2 (aceite):**  
“~20%+ diferindo IA/charts/polish” permanece **[H / candidato]**, não ganho garantido. Impacto em Android/parse/TTI continua **[N]** até medição em device.

---

## 1. Pipeline factual [C]

```text
┌─────────────────────────────────────────────────────────────┐
│  FONTES (Git): 40 ficheiros em build-bundle.js ORDER        │
│  (+ tests-pure.js, ia-module.js, …)                         │
└──────────────────────────┬──────────────────────────────────┘
                           │  node build-bundle.js
                           │  (concatenação + marcadores FILE)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  app.bundle.js  (~980 KB)  artefacto de runtime             │
└──────────────────────────┬──────────────────────────────────┘
                           │
     index.html            │
     • CSS ×17             │
     • Sentry CDN          │
     • supabase-js CDN     │
     • app.bundle.js?v=…   │
     • bp-resumo-kpi.js    │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  BROWSER: parse/exec monólito + scripts satélite            │
│  main.js: navigator.serviceWorker.register('sw.js')         │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  sw.js                                                      │
│  install → precache APP_SHELL                               │
│  fetch: bundle/index = network-first; resto cache-oriented  │
│  supabase.co = network only                                 │
└─────────────────────────────────────────────────────────────┘
```

### Scripts de tooling [C]

| Script | Função | Gera |
|--------|--------|------|
| `build-bundle.js` | `node build-bundle.js` | `app.bundle.js` |
| `build.js` | `node build.js` | `sw.js` a partir de `sw.template.js` (hash) |
| `app-entry.js` | ESM experimental | **Não** usado pelo `index.html` de produção |
| `package.json` raiz | — | **Ausente** neste commit |

### Transformações [C]

- Bundle: **só** concatenação + header + `"use strict"` + `FILE:` markers.  
- SW: substituição de `CACHE_NAME_PLACEHOLDER` no template (quando se corre `build.js`).

---

## 2. Divergência crítica: `sw.template.js` vs `sw.js` em produção [C]

| | `sw.template.js` (modelo do `build.js`) | `sw.js` **efectivo** no repo |
|--|----------------------------------------|------------------------------|
| JS precache | Lista **muitos JS individuais** (`core-*.js`, `auth-…`, `main.js`, …) + CDN | **`app.bundle.js`** + `bp-resumo-kpi.js` |
| Ícones 192/512 | Incluídos no `APP_SHELL` | **Excluídos** (precache leve) |
| CSS extra | Subconjunto | Inclui `bp-premium-panels`, `desktop-responsive` |
| Modelo mental | Era multi-script | Alinhado ao **bundle único** |

**Implicação [C]:**  
Se alguém correr `node build.js` **hoje** a partir do template desactualizado, pode **regenerar um `sw.js` incompatível** com o modelo actual (tentar cachear ficheiros JS soltos que o HTML **já não carrega**).

**Estado actual do runtime [C]:** o `sw.js` commitado é a verdade de cache; o template **atrasado** é risco de processo, não o comportamento actual do browser.

**Contrato futuro:** qualquer mudança de chunks/lazy **tem** de actualizar em conjunto: HTML entry, `build-bundle` ORDER, **e** `APP_SHELL` / template SW.

---

## 3. `CONTRACT_BUILD_PIPELINE` (as-is, embutido)

```text
SOURCE (ORDER[40])
  → node build-bundle.js
  → ARTIFACT app.bundle.js
  → index.html <script src="app.bundle.js">
  → BROWSER

SOURCE sw.template.js + hash de ficheiros (build.js lista)
  → node build.js
  → ARTIFACT sw.js
  → register em main.js
  → CACHE + fetch handlers
```

**Regra [C processo]:**  
Alterar fontes do ORDER **sem** `node build-bundle.js` → browser **não** vê a mudança.  
Alterar só `app.bundle.js` → próximo build **apaga** a alteração.

---

## 4. `CONTRACT_SW_CHUNKS` — estado **actual** (esqueleto)

### SHELL (precache `APP_SHELL` no `sw.js` actual) [C]

- `./`, `index.html`
- `app.bundle.js`
- CSS listados no SW (subset alinhado ao produto bundle)
- `manifest.json`, `logo.png`, `ia-empty-duo.png`
- `bp-resumo-kpi.js`

### FEATURES ESSENCIAIS OFFLINE (hoje = dentro do monólito) [C]

- Todo o JS de auth / IDB / sync / CRUD / UI principal está **dentro** de `app.bundle.js`  
- Offline útil **depois** de o bundle ter sido cacheado (install ou network-first bem-sucedido)

### FEATURES OPCIONAIS / CANDIDATAS A CHUNK FUTURO [H — JS-2]

- IA, charts, media, desktop, marketing — **ainda no mesmo ficheiro**  
- Classificação LAZY continua candidata; **não** implementada

### CACHE VERSION [C]

- Git analisado: `belezapro-shell-v20260824-f7-11`  
- ZIPs de trabalho do utilizador podem ter nomes mais recentes (F7-18/19) — **divergência de packaging** possível [H/C conforme artefacto]

### UPDATE STRATEGY [C]

- Bundle + index: **network-first** (evita shell JS antiga quando há rede)
- Fallback: cache se rede falhar
- Activate: apaga caches com nome ≠ `CACHE_NAME`

### FALLBACK [C]

- Sem rede e sem cache do bundle → app JS não arranca  
- Com cache → monólito completo disponível (incluindo IA/charts não “necessários”)

### Regra arquitectural (para JS-4+, não executar agora)

> Nenhuma feature pode ser declarada LAZY se o SW não garantir o chunk no cenário offline esperado do BelezaPro.

---

## 5. Verificação `tests-pure.js` (pedido do veredito JS-2) [C]

| Pergunta | Resposta |
|----------|----------|
| Está no ORDER / bundle de produção? | **Sim** (~1,5 KB) |
| Executa automaticamente no boot? | **Não** — só define `function runPureTests` e `window.runPureTests = …` |
| Alguém chama `runPureTests()` no load? | **Não** encontrado nas fontes (só comentário de uso manual) |
| Runtime de negócio depende dele? | **Não** — testa `escHtml`, `fmtKz`, `uuid`, `hoje`, `nextReciboNum` **se existirem** |
| Outros testes no bundle? | `ia-module` expõe `window.runBeautyProTests` (sob demanda) [C] |
| Classificação | **OPTIONAL** para remoção **futura** do artefacto de produção; **não remover agora** |

**Custo actual:** ~1,5 KB + parse trivial de definições — desperdício **simbólico** face a 980 KB; útil como prova de “código de teste no monólito de produção”.

---

## 6. Registo do Service Worker [C]

```text
main.js
  → if ('serviceWorker' in navigator)
  → navigator.serviceWorker.register('sw.js')
```

Não há registo no `index.html` inline; depende de o bundle (secção main) executar.

---

## 7. Matriz pipeline (pós JS-3)

| Elo | Estado | Evidência |
|-----|--------|-----------|
| Fontes → ORDER | [C] | `build-bundle.js` |
| Build bundle | [C] | `node build-bundle.js` |
| Bundle → index | [C] | `<script src="app.bundle.js">` |
| SW register | [C] | `main.js` |
| SW precache actual | [C] | `sw.js` APP_SHELL |
| Template SW alinhado ao runtime | **[C divergente]** | template ainda multi-JS |
| `build.js` seguro para correr cego | **[H risco]** | pode reescrever SW “antigo” |
| Chunks / lazy no SW | **[N]** inexistentes |
| Impacto CPU Android | **[N]** JS-2 |

---

## 8. Riscos descobertos nesta fase

1. **`sw.template.js` desactualizado** vs modelo bundle — risco se alguém regenerar SW sem actualizar o template.  
2. Network-first no bundle: bom para updates; 1.ª visita offline sem cache = falha.  
3. Todo o JS “lazy-candidato” ainda viaja no mesmo artefacto precacheado → offline “gordo”.  
4. Dois pipelines (`build-bundle` vs `build.js`) sem `package.json` raiz unificado neste commit.

---

## 9. O que JS-3 **não** faz

- Não implementa chunks  
- Não corrige o template SW  
- Não remove `tests-pure`  
- Não mede TTI  
- Não inicia JS-4  

---

## 10. Conclusão JS-3

A cadeia completa está documentada:

**Fontes ordenadas → concatenação → um bundle → HTML → registo SW → cache network-first do monólito.**

O desmonte futuro do monólito **não** é só `import()`: é **ORDER + HTML + APP_SHELL/template + política offline** em simultâneo.

`tests-pure` é código de teste no bundle, **inerte no boot** (~1,5 KB), candidato OPTIONAL futuro.

**PARAR.** Não iniciar JS-4 / piloto strangler sem autorização.

---

# JS-4 — Piloto Strangler

**Data:** 2026-08-26  
**Commit base:** `a351909de350cb2181d228ba9919bfc2bf210f6d`  
**Produção legada (bundle/ORDER/build-bundle/auth/IDB/sync/CRUD/state):** **não removida nem reescrita**  

---

## 1. Selecção do candidato

| Candidato | Acoplamento (JS-1) | Side effects no load | Veredito |
|-----------|--------------------|----------------------|----------|
| Auth / IDB / Sync / CRUD / state / salao_id | Máximo | Boot-critical | **Excluídos** por ordem |
| **IA** (`ia-module`) | Alto (`state`, DOM, sessão) | `DOMContentLoaded`, globals | Extrair feature completa **agora** = risco de double-init se ORDER mantido |
| **Charts** (`chart-module` + `analise-temporal`) | Alto (DOM, `state`, listeners) | `DOMContentLoaded`, resize, globals | Idem |
| Marketing / desktop / media | Médio | Vários inits | Possível mais tarde |

**Escolha [C]:** domínio **Charts** como *alvo de estrangulamento futuro*, mas o piloto **não** reimplementa o gráfico.

**Motivo:**  
Com a regra “**não retirar** do `app.bundle.js` / ORDER”, carregar uma cópia ESM completa de `chart-module` **duplicaria** listeners e renders. Isso quebraria o critério de não interferência.

**Piloto implementado:** `charts-boundary` — módulo ESM **sem side effects de feature**, API explícita, prova de `import()` ao lado do legado.

**Não é BLOCKER total:** a fronteira modular foi provada.  
**É limite [C]:** *feature Charts completa* ainda vive só no LEGACY_RUNTIME até haver autorização para alterar ORDER/SW.

---

## 2. Boundary

```text
LEGACY_RUNTIME (app.bundle.js)
  - chart-module.js, analise-temporal.js intactos
  - continuam a registar DOMContentLoaded / render

PILOTO ESM
  piloto/boot-pilot.js          (type=module no index)
       ↓ import()
  piloto/charts-boundary/index.js
       ↓ (opcional, só leitura)
  probe de símbolos legados (typeof functions / window.*)
```

**Dependência documentada:**

```text
PILOTO → leitura opcional de globals LEGACY (probe)
```

**Não:**

```text
PILOTO → escrita em state / dbPut / sync / auth
```

| Dependência | Classe |
|-------------|--------|
| `import()` nativo | [C] |
| `window.__BP_PILOT_CHARTS` (namespace próprio) | [C] |
| Leitura `typeof renderizarGrafico` etc. | [C] probe opcional |
| Mutação legado | **Não** |

---

## 3. Ficheiros criados

| Ficheiro | Papel |
|----------|--------|
| `piloto/charts-boundary/index.js` | ESM: `mountPilot`, `probeLegacyCharts`, exports |
| `piloto/boot-pilot.js` | Entry `type=module`; `import()` dinâmico; falha não quebra legado |

## 4. Ficheiros modificados

| Ficheiro | Alteração |
|----------|-----------|
| `index.html` | **Aditivo:** um `<script type="module" src="piloto/boot-pilot.js">` após `bp-resumo-kpi.js` |

## 5. Explicitamente **não** modificados [C]

- `app.bundle.js` (MD5 inalterado no clone de trabalho: `62a3a6d3…`)
- `build-bundle.js` / ORDER
- Auth, IDB, Sync, CRUD, state, salao_id
- `sw.js` / `sw.template.js` / `build.js`

---

## 6. Estratégia de carregamento

- Legado: inalterado (bundle completo no boot).  
- Piloto: **depois** do parse do HTML, como módulo ES; `import()` do boundary.  
- **Afirmação permitida [C]:** o código do piloto **não** faz parte do `app.bundle.js` nem do ORDER.  
- **Afirmação proibida:** “mais rápido / melhor TTI” — **[N]** não medido.

---

## 7. Service Worker [C / limitação]

| Aspeto | Estado |
|--------|--------|
| `piloto/**` no `APP_SHELL` | **Não** |
| Offline do piloto | Depende de rede ou cache manual — **não garantido** [C] |
| Correção automática do SW | **Não feita** (gate da ordem) |
| Risco template `build.js` | Mantém-se (JS-3) |

**Para expandir o piloto offline:** é necessária **autorização separada** para actualizar `sw.js` / template.

---

## 8. Smoke / testes

| Check | Resultado |
|-------|-----------|
| Sintaxe ESM `import()` em Node | **[C]** `import OK charts-boundary js4-0.1.0` |
| HTTP 200 `piloto/*.js` + `app.bundle.js` | **[C]** servidor local |
| `index.html` referencia boot-pilot | **[C]** |
| Boot login/CRUD/offline no browser real | **[N]** não executado nesta sessão (sem UI automatizada autenticada) |
| Vitest 76 | **[N]** `fase2/` incompleto no clone shallow usado; correr no repo completo localmente |
| Duplicação de listeners de charts | **[C]** piloto não regista listeners de chart |

---

## 9. Medições

| Métrica | Valor |
|---------|--------|
| Tamanho `charts-boundary/index.js` | ~1,5 KB ordem de grandeza (texto) |
| Tamanho `boot-pilot.js` | ~0,7 KB |
| Δ `app.bundle.js` | **0** |
| TTI / long tasks | **[N]** |

---

## 10. Rollback

1. Remover de `index.html` a linha do `piloto/boot-pilot.js`.  
2. Apagar a pasta `piloto/`.  
3. Legado permanece idêntico (nunca saiu do bundle).

Rollback **simples** [C] — sinal de baixo acoplamento do piloto (porque a feature real não foi movida).

---

## 11. Equivalência

| Prova | Estado |
|-------|--------|
| Módulo ESM com exports ao lado do monólito | **[C]** |
| Legado charts ainda no bundle | **[C]** |
| Feature charts 100% servida só por ESM | **Não** — fora de âmbito sem ORDER |
| Offline / auth / IDB / sync intactos por desenho | **[C]** desenho; smoke browser autenticado **[N]** |

---

## 12. [C] / [H] / [N]

- **[C]** selecção Charts como domínio; piloto boundary; ficheiros; ORDER intacto; SW sem piloto; import Node OK  
- **[H]** full charts/IA extraíveis após ORDER+SW  
- **[N]** smoke UI completo; Vitest nesta sessão; performance  

---

## 13. Conclusão e paragem

O JS-4 **provou a fronteira** (ESM + `import()` + legado intacto), **não** a migração da feature Charts.

**Decisão humana seguinte:** EXPANDIR (extrair charts de verdade com ORDER/SW) · AJUSTAR · REVERTER (rollback de 2 passos).

**PARAR. Não iniciar JS-5.**

---

# JS-4.1 — Validação do Piloto

**Data:** 2026-08-26  
**Objecto:** `piloto/boot-pilot.js` + `piloto/charts-boundary/index.js`  
**Produção legada alterada nesta subfase:** **NÃO**  
**JS-5 / migração Charts / remoção de bundle:** **NÃO**

---

## 1. Resultado (um dos três)

### **B) PILOTO COM ACOPLAMENTO** (leve, diagnóstico)

Não é isolamento absoluto (opção A).  
Não é evidência insuficiente (opção C).

O módulo **carrega e executa sem o legado**, mas o caminho por omissão **lê** símbolos globais do legado (`probeLegacyCharts`) e **escreve** um namespace próprio em `window`.

---

## 2. Exports reais [C]

| Export | Tipo |
|--------|------|
| `PILOT_ID` | const string `'charts-boundary'` |
| `PILOT_VERSION` | const string `'js4-0.1.0'` |
| `probeLegacyCharts` | function |
| `mountPilot` | function |
| `default` | object agregador |

**Imports reais [C]:** nenhum (`import` de outros módulos).  
Único carregamento: `boot-pilot.js` faz `import('./charts-boundary/index.js')` [C].

---

## 3. Inventário de efeitos

| Elemento | Presente? | Evidência |
|----------|-----------|-----------|
| `document` | **Não** | Código do piloto |
| `addEventListener` / `DOMContentLoaded` | **Não** | Código do piloto |
| Timers / fetch / IDB / Supabase | **Não** | Código do piloto |
| Mutação de `state` / `dbPut` / sync | **Não** | Código do piloto |
| `window.__BP_PILOT_CHARTS = handle` | **Sim** | `mountPilot` |
| `typeof window` / `window` como bag de leitura | **Sim** | `probeLegacyCharts` |
| `typeof renderizarGrafico` (identificador livre) | **Sim** | probe — leitura, não chamada |
| `typeof buildAnaliseTemporal` | **Sim** | idem |
| `window.__bpUltimaAnaliseTemporal` | **Sim** | só `!== 'undefined'` |
| `window.__bpChartChromeBound` | **Sim** | idem |
| `console.info` / `console.warn` | **Sim** | boot-pilot (diagnóstico) |

---

## 4. Classificação de cada dependência

| Dependência | Direcção | Tipo | Classe |
|-------------|----------|------|--------|
| ESM `import()` boot → boundary | PILOTO interno | explícita | [C] |
| `window.__BP_PILOT_CHARTS` (escrita) | PILOTO → window | global **próprio** (não é API do legado) | [C] |
| Probe `typeof` símbolos charts do bundle | **PILOTO → LEGACY** (leitura) | global / temporal (só verdadeiros se o bundle já correu) | [C] |
| Chamada a `renderizarGrafico` / init charts | — | — | **Ausente [C]** |
| LEGACY → PILOTO | — | o bundle **não** importa o piloto | **Ausente [C]** |
| DOM do dashboard/chart | — | — | **Ausente [C]** |

**Contrato de `window.__BP_PILOT_CHARTS`:**  
É **diagnóstico / inspeção** (handle com id, version, legacy flags).  
**Não** é contrato funcional de renderização de gráficos.  
Nenhum código legado o consome [C — ausência de referências no desenho do piloto; consumo no bundle **[N]** não varrido byte-a-byte nesta validação, mas o símbolo é novo e namespaced `__BP_PILOT_*`].

---

## 5. Isolamento — pergunta objectiva

> O piloto pode ser carregado, executado e removido sem modificar o comportamento do LEGACY_RUNTIME?

| Aspeto | Resposta | Evidência |
|--------|----------|-----------|
| Carregar sem bundle | **Sim** (probe devolve `false` nos flags) | Node ESM sem globals de chart [C] |
| Executar sem chamar charts legados | **Sim** | nenhuma invocação de render/init [C] |
| Remover (apagar script + pasta) | **Sim** — legado não depende do piloto | JS-4 rollback [C] |
| Side effect residual | Escreve `window.__BP_PILOT_CHARTS` se `window` existe | poluição mínima de namespace [C] |
| Comportamento charts/auth/IDB/sync | **Não alterado pelo código do piloto** | ausência de mutações [C] |
| Smoke browser autenticado | **[N]** nesta sessão | |

**Conclusão parcial:** isolamento **funcional do legado** relativamente a charts/auth/IDB/sync está **provado no código**.  
Acoplamento restante = **sonda de leitura opcional** + **namespace de diagnóstico**.

---

## 6. Double-init

| Pergunta | Resposta [C] |
|----------|----------------|
| O piloto inicializa Charts? | **Não** |
| Apenas expõe fronteira? | **Sim** (`mountPilot` / exports) |
| Apenas observa o legado? | **Sim**, se `legacyProbe: true` (default no boot) |
| Lógica duplicada de desenho/listeners? | **Não** |

O Charts legado continua com os seus `DOMContentLoaded` no bundle; o piloto **não** adiciona um segundo pipeline de chart.

---

## 7. Direcção da dependência

```text
LEGACY ──(não conhece)──► PILOTO     [C]

PILOTO ──(probe leitura opcional)──► LEGACY globals   [C]

PILOTO ↔ LEGACY (bidireccional de feature)            NÃO [C]
```

Classificação: **PILOTO → LEGACY (read-only diagnóstico)**, não o inverso.

---

## 8. Service Worker (só registo; sem alteração)

| Aspeto | Estado |
|--------|--------|
| Como o browser obtém o piloto | Request de rede a `piloto/boot-pilot.js` e `piloto/charts-boundary/index.js` (script `type=module`) [C desenho] |
| Cache no `APP_SHELL` actual | **Não** incluído [C JS-3/JS-4] |
| Offline após install | Piloto **não garantido** sem estar no cache [C] |
| Legado offline | Inalterado (bundle no SW) [C desenho] |
| Alterações SW necessárias para piloto offline | Incluir `piloto/**` no precache/estratégia; alinhar template — **só documentado**, não feito |

---

## 9. Browser smoke

| Item | Estado |
|------|--------|
| App abre / login / shell | **[N]** |
| Módulo no console `__BP_PILOT_CHARTS` | **[N]** browser; **[C]** estrutura do handle em Node |
| Desactivar piloto (rollback) | **[C]** por desenho (2 passos) |
| Legado sem regressão por código do piloto | **[C]** análise estática; **[N]** UI autenticada |

---

## 10. Performance

| Item | Estado |
|------|--------|
| Bytes piloto (texto) | ~1,8 KB + ~0,8 KB [C ordem de grandeza] |
| Δ bundle | 0 [C] |
| “Mais rápido” | **Não declarado** [N medição TTI] |

---

## 11. Limitações

- Validação é **principalmente estática** + import Node.  
- Não prova ausência total de *qualquer* string `__BP_PILOT` no bundle histórico.  
- Offline do piloto continua **[N]/não garantido**.

---

## 12. Síntese para decisão humana

| Afirmação | Tag |
|-----------|-----|
| ESM + `import()` ao lado do monólito | [C] JS-4 |
| Piloto não migra Charts | [C] |
| Piloto não faz double-init de Charts | [C] |
| Piloto sem dependência **funcional** do legado para carregar | [C] |
| Piloto com **ponte de leitura** diagnóstica ao legado | [C] → por isso **não** é “A) isolado puro” |
| Pronto para JS-5 (migrar Charts / cortar ORDER) | **Não automaticamente** — falta SW + extrair feature de verdade + smoke |

**Recomendação documental:** tratar o piloto como **prova de técnica de estrangulamento** com acoplamento diagnóstico **removível** (`legacyProbe: false` ou eliminar probe).  
Antes de JS-5: decidir se a sonda deve ser removida para isolamento mais estrito, e se o SW deve passar a conhecer `piloto/**`.

---

## 13. Paragem

**JS-4.1 concluído.**  
Resultado oficial: **B) PILOTO COM ACOPLAMENTO** (leve, diagnóstico).  

**Não** iniciar JS-5.  
**Não** migrar Charts.  
**Não** reduzir bundle.  
**Não** criar outro piloto.

---

# JS-5 — Expansão Controlada

**Data:** 2026-08-26  
**Base:** JS-0 → JS-4.1  
**Produção legada (bundle / ORDER / auth / IDB / sync / CRUD / state / salao_id / sw):** **não removida; bundle MD5 inalterado**  

---

## 1. Fatia escolhida

| Campo | Valor |
|-------|--------|
| **Fatia** | **Charts · modelo puro de série temporal** (`charts-serie-core`) |
| **Origem legada** | `analise-temporal.js` (funções de série / intervalo / totais) |
| **Não incluído nesta fatia** | `gerarInsightsTemporais`, render DOM, `chart-module.js`, listeners |

### Motivo [C / H]

| Critério | Avaliação |
|----------|-----------|
| Fora de Auth/IDB/Sync/CRUD/state/salao_id | **[C]** — só funções puras + args |
| Sem DOM / double-init de gráfico | **[C]** — não chama `renderizarGrafico` |
| Responsabilidade única | **[C]** — série + totais + período anterior |
| Isolável vs UI chart | **[C]** legada continua a desenhar |
| Risco de divergência insights | **[C]** insights[] sempre vazio no ESM — documentado |

**Candidatos rejeitados nesta ronda:** IA (state/DOM), chart render completo (side effects), media/desktop (mais largos).

---

## 2. Boundary

```text
LEGACY (app.bundle.js)
  analise-temporal.js + chart-module.js  →  UI do dashboard (inalterado)

ESM (piloto/)
  charts-slice/analise-temporal.mjs
       ↑ import
  charts-boundary + boot-pilot.js
       → window.__BP_PILOT_CHARTS.slice.buildSerieTemporal / buildAnaliseTemporal
```

**Contrato da fatia:**

- Entrada: `intervalo`, `movs[]`, `opts` (argumentos) — **não** lê `state`.
- Saída: objecto de análise / série.
- `insights`: sempre `[]` nesta versão (legado mantém insights na UI).

**Dependências:**

| Dep | Classe |
|-----|--------|
| Nenhuma de Auth/IDB/Sync | [C] |
| Probe legado (opcional, JS-4.1) | [C] leitura |
| `toLocaleDateString('pt-AO')` | [C] ambiente browser/Node ICU |

---

## 3. Arquivos criados / alterados

| Arquivo | Acção |
|---------|--------|
| `piloto/charts-slice/analise-temporal.mjs` | **Criado** — fatia ESM |
| `piloto/charts-boundary/index.js` | **Actualizado** — expõe `slice` no handle |
| `piloto/boot-pilot.js` | **Actualizado** — importa boundary + slice |
| `index.html` | **Aditivo** `type=module` boot-pilot (se ainda não existia) |

**Não alterados [C]:** `app.bundle.js`, `build-bundle.js`, ORDER, `sw.js`, núcleos de negócio.

---

## 4. Integração

- Caminho **novo:** API em `window.__BP_PILOT_CHARTS.slice.*` após load do módulo.
- Caminho **legado:** dashboard/charts **inalterados** (ainda 100% bundle).
- **Não** há feature flag a redireccionar o render do gráfico para ESM (evita risco UI sem smoke autenticado completo).

Isto cumpre “fatia real de lógica” + “legado funcional”, sem fingir que a UI já migrou.

---

## 5. Equivalência (core)

Fixture Node [C]:

```text
movs: vendas 1000+500 em 2026-08-01, 2000 em 2026-08-03
intervalo: 2026-08-01 .. 2026-08-07
→ totais.receita = 3500, nVendas = 3
→ serie.length = 7
→ insights = []
→ EQUIV_CORE_OK
```

**Não** comparado byte-a-byte com `gerarInsightsTemporais` do legado (fora da fatia).  
**Não** comparado modoHora exaustivo [N] cobertura parcial.

---

## 6. Double-init

| | |
|--|--|
| ESM regista DOMContentLoaded charts? | **Não [C]** |
| ESM chama renderizarGrafico? | **Não [C]** |
| Dois motores de desenho activos? | **Não [C]** — só legado desenha |

---

## 7. Testes / smoke / offline / performance

| Item | Estado |
|------|--------|
| Teste Node da fatia (receita/série) | **[C]** EQUIV_CORE_OK |
| Import boundary+slice | **[C]** |
| Browser autenticado (login, dashboard chart visual) | **[N]** |
| Offline do módulo `piloto/**` | **Não garantido** (fora APP_SHELL) [C JS-3] |
| Offline do legado (bundle) | **Preservado por não toque** [C desenho] |
| Performance / TTI | **[N]** — não declarado ganho |
| Vitest 76 | **[N]** nesta sessão |

---

## 8. Riscos

1. **Duas cópias** da lógica de série (legado + ESM) podem divergir se só uma for corrigida no futuro.  
2. UI ainda não consome a fatia ESM — valor = base para JS futuro, não substituição visual.  
3. Labels `pt-AO` podem diferir ligeiramente entre ambientes.  
4. SW sem `piloto/**` → fatia indisponível offline até autorização SW.

---

## 9. Rollback

1. Remover `<script type="module" src="piloto/boot-pilot.js">` do `index.html`.  
2. Remover pasta `piloto/` (ou só `charts-slice` se quiser manter boundary JS-4).  
3. Legado intacto (nunca saiu do bundle).

---

## 10. [C] / [H] / [N]

- **[C]** fatia serie-core ESM; boundary; bundle intacto; sem double-init; teste receita 3500  
- **[H]** próxima ligação UI→slice será segura após smoke dashboard  
- **[N]** smoke browser autenticado; paridade total com legado incluindo insights/modoHora; TTI  

---

## 11. Critério de saída

| Requisito | Estado |
|-----------|--------|
| Nova fatia funciona (API + teste) | **[C]** Node / ESM |
| Legado restante funciona | **[C]** por não alteração; UI **[N]** |
| Sem regressão conhecida no código | **[C]** estático |
| Offline aplicável do **legado** | **[C]** desenho |
| Offline da **fatia** | não aplicável garantido |
| Rollback definido | **[C]** |
| Documentação | esta secção |

**Nota:** “funcionar no browser” para a *API do piloto* depende de servir `piloto/**` + módulo no HTML — desenho pronto; verificação visual autenticada **[N]**.

---

## 12. Paragem

**Uma fatia apenas. JS-5 documentalmente fechado para esta fatia.**  

**Não** iniciar outra migração, JS-5.1 ou JS-6 sem autorização.  
**Não** remover `analise-temporal.js` do ORDER.  
**Não** alterar SW.

---

# JS-5.1 — Auditoria da fatia charts-serie-core

**Data:** 2026-08-26  
**Objecto:** fatia JS-5 (`piloto/charts-slice/analise-temporal.mjs`) vs legado (`analise-temporal.js`)  
**Produção legada / ORDER / SW / núcleo:** **não removidos**  

---

## 1. Respostas objectivas (critério final)

| # | Pergunta | Resposta |
|---|----------|----------|
| 1 | ESM equivalente ao legado? | **Parcial [H→C após alinhamento 5.1]** no core série/totais/modoHora/mensal; **insights e UI não** |
| 2 | Existe duplicação? | **Sim [C]** — duas implementações |
| 3 | Fonte de verdade **produção UI**? | **Legado** (`analise-temporal.js` no bundle) [C] |
| 4 | ESM arquitecturalmente limpo? | **Sim no domínio puro** (args-only, sem DOM) [C]; API ainda exposta via `window.__BP_PILOT_CHARTS` [C diagnóstico] |
| 5–7 | Falhas | Ver secção *Falhas encontradas* |
| 8 | Dependências | Nenhuma de Auth/IDB/Sync; `toLocaleDateString`; probe opcional |
| 9 | O que falta para UI consumir ESM? | Bridge no legado **ou** feature flag + smoke dashboard + decisão de SSOT + SW se offline |
| 10 | Risco de remover legado depois? | **Alto** enquanto UI não usar ESM e insights não migrados [C] |

**Não declarar “migração concluída”.** UI continua no legado.

---

## 2. Funções comparadas

| Função | Entradas | Saídas (legado) | ESM JS-5 inicial | ESM após 5.1 | Equivalência |
|--------|----------|-----------------|------------------|--------------|--------------|
| `intervaloAnteriorEspelhado` | intervalo | `{inicio,fim,label}` | alinhado | alinhado | **[C]** fixture 7 dias |
| `buildSerieTemporal` (≤31d) | intervalo, movs | série diária | passo errado (2/7) | `passo = ceil(dias/31)` | **[C]** após correção |
| `buildSerieTemporal` (>90d) | … | **meses civis** | passo semanal/erróneo | agregação mensal | **[C]** após correção |
| `buildSerieTemporal` (`modoHora`) | … | buckets **1h 7–22** + `anterior` | buckets **2h 0–24** | alinhado 7–22 | **[C]** após correção |
| `buildAnaliseTemporal` core | … | totais, série, tendência… | core ok; diaRef/modoHora incompleto | modoHora branch alinhada | **[C]** core; ver insights |
| `gerarInsightsTemporais` | modelo + movs | insights[] | **ausente** → `[]` | **ausente** | **[C] não equivalente** (fora de fatia) |
| `_atFmtISO` / `formatarDataISO` | Date | ISO | `fmtISO` local | idem | **[H]** se legado usar `formatarDataISO` global divergente |

---

## 3. ## Falhas encontradas

| ID | Arquivo | Localização | Problema | Gravidade | Impacto | Corrigida? | Correção | Evidência | Risco residual |
|----|---------|-------------|----------|-----------|---------|------------|----------|-----------|----------------|
| FALHA-JS5-001 | `piloto/charts-slice/analise-temporal.mjs` (JS-5.0) | `buildSerieTemporal` modoHora | Algoritmo 2h ≠ legado 1h (7–22) | **P1** | Série horária incorrecta se UI usasse ESM | **SIM** | Reimplementar buckets alinhados ao legado | Testes modoHora 16 buckets + receita hora 9 | Manter parity se legado mudar |
| FALHA-JS5-002 | idem | `buildSerieTemporal` dias>90 | Sem agregação mensal | **P1** | Ano/períodos longos divergentes | **SIM** | Loop mensal como legado | `long.length` 12–13 | idem |
| FALHA-JS5-003 | idem | passo médio | `passo` 2/7 ≠ `ceil(dias/31)` | **P1** | Séries 32–90d divergentes | **SIM** | `passo = dias > 31 ? Math.ceil(dias/31) : 1` | Caracterização multi | idem |
| FALHA-JS5-004 | idem | `buildAnaliseTemporal` | `insights` sempre `[]` | **P2** | Não substitui insights do dashboard | **NÃO** (deliberado) | Fora de âmbito da fatia | Documentado | UI não pode trocar SSOT sem migrar insights |
| FALHA-JS5-005 | arquitectura | — | Duplicação legado+ESM | **P1** manutenção | Drift futuro | **NÃO** (eliminar legado proibido) | SSOT ainda = legado | Auditoria | Até UI consumir ESM |
| FALHA-JS5-006 | arquitectura | `window.__BP_PILOT_CHARTS` | API via global, não só import | **P2** | Acoplamento diagnóstico | **NÃO** nesta fase | Manter piloto | JS-4.1 | Preferir import quando UI migrar |
| FALHA-JS5-007 | runtime | `piloto/**` | Fora do SW APP_SHELL | **P1** se fatia for crítica offline | Módulo some offline | **NÃO** (SW gate) | Só documentar | JS-3 | Não usar como caminho único offline sem SW |
| FALHA-JS5-008 | processo | JS-5.0 | Fixture único (3 vendas) insuficiente | **P2** | Falsa confiança de equivalência | **SIM** (testes) | Suite de caracterização alargada | `ALL_CHAR_OK` | Ainda não fuzz completo |

---

## 4. Correções aplicadas (ficheiros)

```text
piloto/charts-slice/analise-temporal.mjs
  → realinhamento de buildSerieTemporal (modoHora, >90d, passo)
  → buildAnaliseTemporal modoHora (diaRef / anterior dia)
  → SLICE_VERSION = js5.1-0.2.0
  → motivo: eliminar divergências P1 comprovadas vs legado
  → evidência: ALL_CHAR_OK
```

**Não alterados:** `analise-temporal.js`, `app.bundle.js`, ORDER, SW, Auth/IDB/Sync/CRUD/state.

---

## 5. Duplicação e fonte de verdade

| Caminho | Papel actual |
|---------|----------------|
| `analise-temporal.js` no **bundle** | **SSOT de produção** — alimenta charts UI [C] |
| `piloto/charts-slice/analise-temporal.mjs` | **Cópia experimental alinhada (core)** — API piloto [C] |

Risco de divergência futura: **alto** se só um for corrigido (FALHA-JS5-005).

Forma segura de SSOT único (só plano, **não executar**):

```text
1) UI passa a importar ESM (ou bridge mínimo)
2) Smoke dashboard + offline policy
3) Só então retirar analise-temporal do ORDER / rebuild
```

---

## 6. Arquitectura (legibilidade / manutenção / escala)

| Critério | Avaliação |
|----------|-----------|
| Domínio puro vs infra | **OK** — sem DOM/IDB [C] |
| API pequena | **OK** — 3 exports públicos + constants [C] |
| Globals | Probe + `__BP_PILOT_CHARTS` — diagnóstico [C] |
| Uma fonte de verdade | **Falhou enquanto UI no legado** [C] |
| Reutilizável sem Dashboard | **Sim** (args) [C] |
| Escalabilidade | Boa para outras features **depois** de SSOT [H] |

**API `window.__BP_PILOT_CHARTS.slice.*`:** classificada como **mecanismo de piloto/diagnóstico**, não arquitectura final. Destino desejável: `import { buildSerieTemporal } from '…'` na UI [H decisão futura].

---

## 7. Build

| Check | Estado |
|-------|--------|
| ESM no `app.bundle.js`? | **Não** [C] |
| ORDER inclui piloto? | **Não** [C] |
| Bundle reproduzível | **Sim** (não tocado) [C] |
| Dependência de ORDER para a fatia ESM | **Não** [C] |

---

## 8. Offline

| Cenário | Estado |
|---------|--------|
| Legado charts offline (bundle em cache) | Inalterado [C desenho] |
| Fatia ESM sem rede, 1.ª visita | Falha a carregar módulo [C] |
| Fatia ESM após visit online sem precache SW | Pode falhar offline [C] |
| Tornar fatia crítica offline | Exige alterar SW — **não feito** |

---

## 9. Testes de caracterização (após 5.1)

```text
OK empty / one / multi 3500 / zero / negativo
OK intervalo null
OK anterior 7 dias
OK agregação anual (meses)
OK modoHora 16 buckets + hora 9 = 150
OK insights []
ALL_CHAR_OK
```

Vitest no monorepo fase2: **[N]** nesta sessão (não integrado à suite fase2).

---

## 10. Performance

Não medida / não declarada ganho **[N]**.

---

## 11. Rollback

Inalterado: remover script piloto + pasta `piloto/`; legado SSOT permanece.

---

## 12. O que falta para a UI consumir ESM

1. Decisão: SSOT = ESM.  
2. Ponto de chamada em `chart-module` / pipeline de análise (fonte, **não** edição manual do bundle sem rebuild autorizado).  
3. Migrar ou aceitar `insights: []` vs `gerarInsightsTemporais`.  
4. Smoke dashboard autenticado.  
5. Política SW para `piloto/**` se offline for requisito.  
6. Remoção posterior do ORDER (só com equivalência + autorização).

---

## 13. [C] / [H] / [N]

- **[C]** divergências 001–003 existiam e foram corrigidas no ESM; SSOT=legado; duplicação; testes char; insights fora  
- **[H]** `formatarDataISO` global no legado raramente diverge de `fmtISO`  
- **[N]** smoke UI; Vitest CI; paridade total de labels `pt-AO` em todos os locales  

---

## 14. Conclusão JS-5.1

A fatia **não** era equivalência completa na JS-5.0 (falhas P1 de algoritmo).  
Após auditoria e realinhamento, o **core série/totais/modoHora/mensal** está **muito mais alinhado** ao legado, com testes alargados.

Continua a ser:

> **duplicação controlada + caminho experimental**,  
> **não** migração concluída da feature Charts.

**PARAR.** Sem nova fatia, sem JS-6, sem remover bundle, sem SW.

---

# JS-5.2 — Decisão sobre a fatia charts-serie-core

**Data:** 2026-08-26  
**Commit Git analisado:** `a351909de350cb2181d228ba9919bfc2bf210f6d` (`main`)  
**Produção legada / ORDER / SW / núcleo:** **não alterados**  

---

## 1. Estado actual (evidência)

### Consumidor real da lógica [C]

```text
chart-module.js (~L435–447)
  → typeof buildAnaliseTemporal === 'function'
  → buildAnaliseTemporal(intervalo, movs, { modoHora, diaRef })
  → actualizarDashChartExec(analise)
  → actualizarDashChartInsights(analise)   // usa analise.insights
  → desenha série a partir de analise.serie
```

`buildAnaliseTemporal` de produção vem do **legado** no bundle:

```text
analise-temporal.js (~L442–463)
  → window.buildAnaliseTemporal = …
  → window.buildSerieTemporal = …
```

### Caminho ESM em produção? [C]

| Caminho | Usa ESM? |
|---------|----------|
| Dashboard / chart-module | **Não** |
| `window.__BP_PILOT_CHARTS.slice.*` | Só se `piloto/boot-pilot.js` estiver no HTML **e** módulos carregarem |
| `index.html` no Git `main` @ a351909 | **Sem** referência a `piloto/` [C neste commit] |
| Artefactos de trabalho / JS-4–5 | Podem ter script aditivo local [H packaging] |
| `sw.js` APP_SHELL | **Sem** `piloto/**` [C] |

**Conclusão [C]:** o ESM continua **duplicação experimental**, não caminho de produção.

### Diferenças restantes legado × ESM [C]

| Área | Estado pós-5.1 |
|------|----------------|
| Série / totais / modoHora / mensal / passo | Alinhados (suite CHAR_OK) |
| `insights` / `gerarInsightsTemporais` | **ESM = `[]`**; legado gera lista — **não equivalente** |
| `chart-module` consumo de insights | **Depende do legado** |
| Exposição | Legado: `window.buildAnaliseTemporal`; ESM: exports + opcional `__BP_PILOT_CHARTS` |

### API `window.__BP_PILOT_*` [C]

Continua **diagnóstico / piloto**, não contrato de produção.  
O módulo puro (`analise-temporal.mjs`) **não** referencia `window`/`document`/`state`/`dbPut` [C `SLICE_NO_RUNTIME_GLOBALS`].  
O boundary/boot ainda escrevem `__BP_PILOT_CHARTS` [C].

---

## 2. Fronteira arquitectural do `.mjs`

| Critério | Estado |
|----------|--------|
| Entrada/saída explícitas | **[C]** |
| Sem estado global no slice | **[C]** |
| Sem DOM / IDB / Supabase / Sync | **[C]** |
| Side effects no import | **[C]** nenhum no `.mjs` |
| Responsabilidade única (série/análise core) | **[C]** |
| Equivalência total incl. insights | **Não [C]** |
| Isolamento do boundary (`window`) | Acoplamento leve no boot [C JS-4.1] |

---

## 3. Decisão (uma opção)

### **A. Fortalecer o módulo ESM antes de integrá-lo**

**Não B** — integrar agora na cadeia real de Charts.

**Porquê B fica rejeitado (evidência):**

1. `chart-module` **exige** `analise.insights` para `actualizarDashChartInsights` [C]. ESM devolve `[]` → **mudança observável de UI** se se substituir o global agora.  
2. Integração exigiria alterar fonte do chart + rebuild do bundle **ou** monkey-patch de `window.buildAnaliseTemporal` — risco de regressão sem smoke autenticado **[N]**.  
3. Offline do ESM **não** garantido (fora do SW) [C].  
4. Pergunta da ordem: *“já é suficientemente equivalente para SSOT da lógica pura sem alterar comportamento?”* → **Não**, enquanto insights e UI não estiverem cobertos [C].

**Não C** (reverter): o módulo puro alinhado + CHAR_OK tem valor como base; reverter apagaria evidência útil.

**Não D** (parar por [N] total): o bloqueio a B está **determinado**; o passo correcto é fortalecer, não parar a orquestração por desconhecimento.

---

## 4. Fortalecimento feito nesta subfase (sem integrar UI)

| Acção | Detalhe |
|-------|---------|
| Suite reproduzível | `piloto/charts-slice/characterize.mjs` → `CHAR_OK` |
| Confirmação pureza do slice | Sem globals de runtime no `.mjs` |
| Documentação | Esta secção JS-5.2 |

**Não feito (deliberado):**

- Ligar `chart-module` ao ESM  
- Migrar insights  
- Alterar ORDER / bundle / SW  
- Remover legado  

---

## 5. O que falta para B ser autorizável (checklist)

1. Migrar ou aceitar explicitamente o comportamento de **insights** (contrato UI).  
2. Bridge controlada: `buildAnaliseTemporal` de produção → ESM **com** paridade de saída usada pelo chart.  
3. Smoke browser autenticado no dashboard (gráfico + insights + modoHora).  
4. Política SW se a fatia for necessária offline.  
5. Rollback documentado (repor global legado).  
6. Só depois: considerar SSOT + remoção do ORDER.

---

## 6. Performance

| Item | Estado |
|------|--------|
| Redução de bytes no bundle | **0** (legado intacto) [C] |
| JS a menos no boot | **0** no Git sem piloto; com piloto = **bytes a mais** no load [C] |
| Custo `import()` do piloto | Pequeno (~9 KB slice) [C ordem]; TTI **[N]** |
| Offline | Legado ok; ESM não precacheado [C] |

**Sem declaração de ganho de performance.**

---

## 7. Testes executados

```text
node piloto/charts-slice/characterize.mjs
→ CHAR_OK (empty, one, multi, insights [], null, anterior, year, modoHora, mid passo)
```

Browser smoke dashboard: **[N]**

---

## 8. Falhas

| ID | Notas |
|----|--------|
| FALHA-JS5-004 insights | **Permanece** — bloqueia B |
| FALHA-JS5-005 duplicação | **Permanece** — esperado até SSOT |
| FALHA-JS5-007 SW | **Permanece** |
| Novas FALHA-JS5.2-* de divergência algorítmica core | **Não** encontradas além do já corrigido em 5.1 |

---

## 9. Git / artefactos

| Item | Estado |
|------|--------|
| Branch | `main` |
| Commit | `a351909…` |
| `piloto/` no remoto analisado | **Ausente** do tree de produção Git neste commit [C] |
| Diff bundle | não aplicável (não tocado) |
| Risco ZIP ≠ Git | piloto pode existir só em artefactos de trabalho [C/H] |

---

## 10. Rollback

Inalterado: remover pasta `piloto/` + script HTML se presente; legado SSOT.

---

## 11. Veredito final

| Afirmação | |
|-----------|--|
| ESM é SSOT de produção? | **Não** |
| ESM é módulo puro utilizável? | **Sim** (core), com lacuna insights |
| Integração Charts agora? | **Não autorizada por evidência** |
| Próximo passo **permitido** | **Permanecer em modo A**: fortalecer (insights contract / testes / eventual bridge) **só com nova autorização** antes de B |
| JS-6 / outra feature | **Proibido** nesta saída |

---

## 12. Paragem

**JS-5.2 concluída com decisão A.**  

Não integrar UI. Não remover legado. Não alterar núcleo. Não iniciar JS-6.

---

# JS-5.3 — Contrato de insights + fortalecimento do domínio puro

**Data:** 2026-08-26  
**Commit Git referência:** `a351909…`  
**UI / chart-module / ORDER / bundle / SW / núcleo:** **não alterados**  

---

## 1. Pureza do ESM (slice)

| Critério | `analise-temporal.mjs` |
|----------|-------------------------|
| DOM / `document` | **Não** [C] |
| `window` | **Não** [C] |
| `state` / IDB / Sync / Supabase | **Não** [C] |
| Side effects no import | **Não** [C] |
| Entrada/saída explícitas | **Sim** [C] |

`piloto/charts-boundary` e `boot-pilot` mantêm escrita diagnóstica em `window.__BP_PILOT_CHARTS` (temporário) [C].

**Nenhuma FALHA-JS5.3 de pureza no `.mjs`.**

---

## 2. Contrato de `insights` (legado)

### Produção [C]

```text
buildAnaliseTemporal (legado)
  → gerarInsightsTemporais(analise, movs)
  → analise.insights : string[]  (máx. 3, dedupe)

chart-module.actualizarDashChartInsights(analise)
  → #dash-chart-insights
  → se list.length === 0: ul.hidden = true  (UI tolera vazio)
  → senão: <li> por string (escape)
```

### Classificação da responsabilidade

| Opção | Avaliação |
|-------|-----------|
| **A. Lógica pura no domínio** | **[C] Escolhida** — só usa `analise` + `movs`; gera strings |
| B. Módulo separado de apresentação | UI (`actualizarDashChartInsights`) é **outra** responsabilidade (DOM) [C] |
| C. Runtime legado impede isolamento | **Não** para a *geração*; deps suaves: `hoje()`, `fmtKz` no item de projecção mensal [C] |

**Deps opcionais no legado (insight #6 projecção):** `hoje`, `fmtKz`.  
No ESM: injectáveis via `opts.hoje` / `opts.fmtKz`; senão `fmtISO(new Date())` e `String(proj)` [C].

**Formato de saída [C]:** `string[]`, ≤ 3 elementos, mensagens em pt.

**Efeitos colaterais da geração [C]:** nenhum (não muta `movs`/`state`).

**`insights: []` como “equivalente UI”:** a UI **já esconde** a lista se vazia [C] — não crash — mas **não** é equivalente de *conteúdo* informativo [C].

---

## 3. Matriz legado × ESM (pós-5.3)

| Comportamento | Legado | ESM | Equivalente? | Evidência |
|---------------|--------|-----|--------------|-----------|
| Série / totais / modoHora / mensal | sim | alinhado 5.1 | **[C]** | CHAR |
| `intervaloAnteriorEspelhado` | sim | sim | **[C]** | CHAR |
| `gerarInsightsTemporais` | sim | **agora no ESM** | **[H→C]** regras portadas; labels/`fmtKz` podem diferir ligeiramente | CHAR conc + código |
| Insights no `buildAnaliseTemporal` | preenchidos | preenchidos via mesma função | **[C]** caminho | código |
| UI dashboard | consome legado | **não consome ESM** | N/A produção | chart-module |
| Export PDF/CSV insights | legado | não ligado | N/A | |

---

## 4. Alterações nesta subfase

| Arquivo | Acção |
|---------|--------|
| `piloto/charts-slice/analise-temporal.mjs` | + `export gerarInsightsTemporais`; `buildAnaliseTemporal` preenche `insights`; versão `js5.3-0.3.0` |
| `piloto/charts-slice/characterize.mjs` | Asserts de insights (array, max 3, concentração) |
| `piloto/charts-boundary/index.js` | Expõe `gerarInsightsTemporais` no handle `slice` |

**Não alterados:** `analise-temporal.js`, `chart-module.js`, bundle, ORDER, SW, Auth/IDB/Sync/CRUD/state.

---

## 5. Testes

```text
node piloto/charts-slice/characterize.mjs → CHAR_OK
incl. concentração 90% → insight com "concentrou"
```

Browser / UI: **[N]**

---

## 6. API

| Superfície | Classificação |
|------------|---------------|
| `export function buildSerieTemporal / buildAnaliseTemporal / gerarInsightsTemporais / intervaloAnteriorEspelhado` | **Contrato de domínio desejável** [C] |
| `window.__BP_PILOT_CHARTS` | **Temporário / diagnóstico** [C] — não arquitectura final |

---

## 7. Resposta à pergunta arquitectural

> Unidade de domínio independente ou só duplicação?

**Ambos, em camadas:**

- O **`.mjs`** é agora uma unidade de domínio **coesa** (série + análise core + insights textuais), testável, sem acoplamento ao monólito [C].  
- Em **produção**, continua a haver **duplicação** porque a UI ainda usa o legado [C].  
- Não é “só um ficheiro a mais sem contrato”: há exports explícitos + caracterização + insights no mesmo bounded context temporal.

---

## 8. Blockers restantes para integração UI (B)

| Blocker | Estado |
|---------|--------|
| Insights vazios no ESM | **Mitigado** no módulo (ainda falta smoke UI) |
| Wire `chart-module` → ESM | **Não feito** (proibido nesta fase) |
| Rebuild / não editar bundle à mão | Processo |
| SW `piloto/**` | Offline do módulo |
| Smoke autenticado dashboard | **[N]** |
| Paridade byte-a-byte de cada string de insight | **[H]** — regras portadas, não diff exaustivo de todas as frases |

---

## 9. Decisão / próximo passo permitido

Continua **modo A (fortalecer)** concluído para o contrato de insights **no domínio**.  

**Próximo passo possível (só com autorização explícita):** planear **B** (bridge controlada legado→ESM na análise pura) **ou** mais caracterização/diff de insights — **não** automático.

**Proibido agora:** JS-6, outra feature, remover ORDER, alterar SW/núcleo.

---

## 10. Rollback

Remover/atualizar ficheiros em `piloto/`; legado intacto.

---

## 11. Veredito JS-5.3

| | |
|--|--|
| Contrato `insights` compreendido? | **Sim [C]** |
| ESM responsabilidade definida? | **Sim [C]** — domínio análise temporal incl. insights |
| Equivalência core + insights caracterizada? | **Core [C]; insights [H/C] regras** |
| Dependências ocultas no `.mjs`? | **Não [C]** |
| Ligável à UI sem acoplamento indevido? | **Sim em princípio** via import/bridge de funções puras [H] — falta autorização + smoke |
| Bloqueia integração? | Wire + smoke + SW policy + processo de build |

**PARAR.**

---

# JS-5.4 — Prova de equivalência do domínio puro

**Data:** 2026-08-26  
**Harness:** `piloto/charts-slice/equiv-harness.mjs`  
**Resultado:** **`EQUIV_OK`** (0 falhas no conjunto de casos)  
**UI / bundle / ORDER / SW / núcleo:** **não alterados**  

---

## 1. Resposta ao critério de saída

> O domínio puro ESM reproduz o comportamento relevante do domínio legado?

### **SIM [C]** — para o conjunto de comportamentos exercitados pelo harness

Evidência: comparação JSON estável (números arredondados a 1e-6) entre:

- legado carregado em `vm` a partir de `analise-temporal.js` (com stubs `hoje` / `fmtKz` / `formatarDataISO`);
- ESM `piloto/charts-slice/analise-temporal.mjs`.

Campos comparados: série completa, core de `buildAnaliseTemporal` **sem** `_slice`, e array `insights`.

**Não significa:** UI de produção já usa ESM, nem que *todos* os ambientes/timezones de `toLocaleDateString` foram esgotados.

---

## 2. Arquivos analisados

| Arquivo | Papel |
|---------|--------|
| `analise-temporal.js` | SSOT produção (bundle) |
| `piloto/charts-slice/analise-temporal.mjs` | Domínio experimental |
| `chart-module.js` | Consumidor (não alterado; confirma SSOT legado) |
| `equiv-harness.mjs` | **Novo** — prova automática |

---

## 3. Arquivos alterados / criados

| Arquivo | Acção |
|---------|--------|
| `piloto/charts-slice/equiv-harness.mjs` | **Criado** |
| Restante produção | **Não modificado** |

Nenhuma correção adicional ao ESM foi necessária nesta subfase: o alinhamento JS-5.1–5.3 já produziu **EQUIV_OK**.

---

## 4. Matriz de equivalência (casos do harness)

| Comportamento / caso | Legado | ESM | Tag |
|----------------------|--------|-----|-----|
| Semana vazia | série 7, totais 0 | igual | **[C]** |
| Uma venda | totais correctos | igual | **[C]** |
| Multi + ignora despesa | 3500 / 3 | igual | **[C]** |
| Valor 0 | conta venda, receita 0 | igual | **[C]** |
| Valor negativo | soma negativa | igual | **[C]** |
| `valor` ausente | trata como 0 | igual | **[C]** |
| Data fora do intervalo | ignorada | igual | **[C]** |
| Ano civil vazio | agregação mensal | igual | **[C]** |
| ~45 dias (passo médio) | buckets alinhados | igual | **[C]** |
| `modoHora` (7–22, madrugada no bucket 7) | série + core + insights | igual | **[C]** |
| Concentração + top serviço (insights) | strings iguais com stubs | igual | **[C]** |
| `intervaloAnteriorEspelhado` 7d | 25–31 jul | igual | **[C]** |
| `intervalo` null | série [] | igual | **[C]** |

### Diferenças residuais / limites da prova

| Tema | Classificação | Nota |
|------|---------------|------|
| Labels `toLocaleDateString('pt-AO')` noutro OS/ICU | **[H]** | Mesmo runtime no harness → iguais; CI noutro locale pode divergir no *texto* do label, não nos totais |
| `formatarDataISO` global ≠ `fmtISO` local | **[H]** | No harness, stub = mesma fórmula; produção real se `formatarDataISO` divergir |
| `hoje()` / `fmtKz` na projecção mensal | **[C]** injectável no ESM; harness fixa `2026-08-15` |
| Campo `_slice` só no ESM | **[C]** intencional; excluído da comparação core |
| Cobertura de *todas* as combinações de insights | **[H]** | Casos representativos OK; não é prova formal exaustiva de cada ramo textual |
| Timezone `Date` local do host | **[H]** | Ambos usam `T00:00:00` local no mesmo processo |

---

## 5. Pureza do ESM [C]

Reconfirmado: sem `window` / `document` / `state` / IDB / Sync / Auth / side effects de boot no `.mjs`.

---

## 6. Falhas

| ID | Estado |
|----|--------|
| Divergências algorítmicas core no harness | **Nenhuma** nesta corrida |
| FALHA-JS5-005 duplicação produção | **Não corrigida** (UI ainda no legado — fora de âmbito) |
| Integração UI | **Não feita** (proibida) |

---

## 7. Testes executados

```text
node piloto/charts-slice/equiv-harness.mjs
→ EQUIV_OK (11 cenários × serie/core/insights + anterior + null)
```

`characterize.mjs` (JS-5.3) permanece válido como suite unitária do ESM.

Browser / dashboard: **[N]**

---

## 8. Impactos

| Área | Impacto |
|------|---------|
| Legado / offline bundle | **Nenhum** (não tocado) |
| Offline do módulo ESM | Continua fora do SW [C] |
| Performance app | **Não medida / não declarada** [N] |

---

## 9. Riscos remanescentes

1. Drift futuro se só um dos dois ficheiros for corrigido.  
2. Labels dependentes de locale do ambiente.  
3. Produção ainda não beneficia do ESM.  
4. Harness não substitui smoke visual do gráfico.

---

## 10. Decisão recomendada para a **próxima** subfase (humana)

Com **EQUIV_OK** no domínio puro:

| Opção | Quando |
|-------|--------|
| **Integrar (B)** com bridge + rollback + smoke dashboard | Se a prioridade for SSOT único |
| **Continuar A** (mais casos / diff de locale) | Se quiserem mais margem antes do wire |
| **Reverter piloto** | Só se a estratégia ESM for abandonada |

**Esta subfase não escolhe B automaticamente.**

---

## 11. Paragem

**JS-5.4 fechada.**  
Não JS-6. Não integração UI. Não remoção de legado. Não alteração de núcleo.

Aguardar decisão humana: **integrar · fortalecer · reverter**.
