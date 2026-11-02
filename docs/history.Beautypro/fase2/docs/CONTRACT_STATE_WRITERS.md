# CONTRACT — Escritores de `state` (F4.1)

**Tipo:** caracterização / consolidação  
**Produção alterada:** NÃO  
**Método:** EVIDÊNCIA → [C]/[H]/[N] → DOCUMENTAR → PARAR

## 1. O que é `state`

[C] `core/state.js` declara `var state = { ... }` e `window.state = state`.  
[C] `core/store.js` expõe `BeautyStore` (`setState`, `setConfig`, `setList`, `batch`, `subscribe`) sobre o **mesmo** objecto.  
[C] Escrita directa `state.x = …` continua válida no runtime; o store **não** intercepta todas as mutações.

## 2. Chaves canónicas (shape)

| Chave | Tipo esperado | Autoridade preferida |
|-------|---------------|----------------------|
| `config` | object (`storeName`, `fundo`, `plano`, `salaoId`, …) | Auth + `loadState` + `setConfig` |
| `clientes` | array | CRUD + merge `sync-rest` |
| `agendamentos` | array | CRUD + merge `sync-rest` |
| `movimentos` | array | CRUD + merge `sync-rest` |
| `profissionais` | array | CRUD + merge `sync-rest` |
| `servicos` | array | CRUD + merge `sync-rest` |
| `fechos_caixa` | array | CRUD + eventos caixa |
| `agendaDataAtual` | string YYYY-MM-DD | UI agenda |
| `histPeriodo` | string | UI caixa / loadState defaults |
| `filtroClientes` | string | UI clientes / loadState |
| `chartPeriodo` / `chartOffset` / `chartMostrarValores` | UI charts + dash |
| `dashPeriodo` / `dashOffset` / `dashCustomInicio` / `dashCustomFim` | UI dashboard |

## 3. Escritores observados no código [C]

### Listas de negócio (alta criticidade)
| Ficheiro | O quê |
|----------|--------|
| `core/crud-operations.js` | `loadState` substitui listas; mutações CRUD pontuais |
| `core/sync-rest.js` | merge pós-pull nas 5 listas principais |

### UI / filtros (média)
| Ficheiro | O quê |
|----------|--------|
| `ui/ui-render-dashboard-agenda.js` | `agendaDataAtual`, `dash*`, `chartPeriodo` |
| `ui/eventos-caixa-vendas.js` | `histPeriodo`, `filtroClientes`, guard `fechos_caixa` |
| `charts/chart-module.js` | `chartPeriodo`, `dashPeriodo`, `dashOffset`, `chartMostrarValores` |
| `boot/main.js` | `filtroClientes` (ligação UI) |

### Outros
| Ficheiro | O quê | Nota |
|----------|--------|------|
| `features/gestao-fase78.js` | `state.config` via `Object.assign` | [H] caminho de snapshot — não expandir sem gate |
| `ia/ia-module.js` | **não** escreve listas (comentário SSOT clientes) | [C] só leitura pretendida |

## 4. Regras de consolidação (política, não runtime)

1. **Listas de negócio** só devem ser substituídas em massa por `loadState` ou merge documentado de `sync-rest`.
2. **Mutações de item** preferir CRUD (`add*` / `update*` / `delete*`) + `dbPut` + fila — não `state.clientes.push` ad-hoc em features novas.
3. **Filtros UI** podem escrever chaves de filtro/periodo; não devem substituir arrays de entidades.
4. **Código novo** deve preferir `BeautyStore.setState` / `setList` / `setConfig` **quando** precisar de notificar subscribers; escrita directa sem notify pode deixar UI desactualizada se o ecrã depender de `subscribe`.
5. Este contrato **não** proíbe o legado existente; orienta evolução e reviews.

## 5. Limitações [N]

- Não medimos quantos ecrãs dependem só de `subscribe` vs `updateUI` manual.
- Não há proxy que force writers.
- RLS / multi-tenant no servidor continua [N] nesta fatia.

## 6. Rollback

Apagar apenas este contrato + policy + testes. Zero impacto no browser.
