# MODULE_API — contrato público por domínio

**Etapa 4 · 2026-08-30**  
Scripts clássicos: funções `function foo()` no ficheiro tornam-se globais; o contrato **oficial** é o que está em `window.*` com `_bpOwner` quando aplicável.

**Regra:** quem não é o dono **não** reassign `window[fn]` se `fn._bpOwner` existir. Preferir hooks (`__bpAfterRender*`) ou namespaces `BP*`.

---

## Core / App (infra)

| Símbolo | Dono | Notas |
|---------|------|--------|
| `state`, `BeautyStore` | `src/core/state/*` | SSOT memória |
| `dbPut` / `dbDelete` | storage + patch sync | ordem de scripts crítica |
| `updateUI`, `initStoreBindings` | `src/app/ui-coordinator.js` | orquestra abas |
| `hideSplash` | `src/app/hide-splash.js` · `_bpOwner=app` | |

## Helpers UI

| Símbolo | Dono |
|---------|------|
| `getProfissionalNome`, `formatarDataISO`, `formatarDataCurta`, `_statusAg` | `src/ui/domain-helpers.js` |
| `appendRowsHtml`, `observeLoadMore` | `src/ui/list-helpers.js` |

---

## modules/clientes

| API | Owner |
|-----|--------|
| `renderClientes` | `modules/clientes` |
| `getEstatisticasCliente`, `resolverClienteIdPorNome` | `modules/clientes` |

Ficheiro: `clientes-render.js`

## modules/caixa

| API | Owner |
|-----|--------|
| `renderCaixa` | `modules/caixa` |
| `getMovimentosPeriodo`, `tituloPeriodoCaixa` | `modules/caixa` |

Events: `caixa-vendas-events.js` (listeners; usa `addToCart` de vendas)

## modules/equipa

| API | Owner |
|-----|--------|
| `renderProfissionais` | `modules/equipa` |
| `BPEquipa` | `modules/equipa` |

## modules/servicos

| API | Owner |
|-----|--------|
| `renderServicos` | `modules/servicos` |
| `setupPrecoAutomatico`, `populateAgendaSelects`, `populateVendaSelects` | `modules/servicos` |

## modules/agenda

| API | Owner |
|-----|--------|
| `renderAgendaFull` | `modules/agenda` · `agenda-board.js` |
| `renderAgendaItem` | `modules/agenda` (pode ser *enhanced* por `agenda-render.js` / `BPAgendaUI`) |
| `renderBadges`, `mudarAgenda`, `syncAgenda`, … | `modules/agenda` |
| `bpCheckExpiringAppointments`, `bpStartExpiringWatcher`, … | `expirar-agendamento.js` |

## modules/dashboard

| API | Owner |
|-----|--------|
| `renderDashboard` | `modules/dashboard` |
| `getIntervaloDashAtual`, `calcularIntervaloPeriodo`, `initKpiTemporalUi` | `modules/dashboard` |
| KPIs mirror | `bp-resumo-kpi.js` |

## modules/vendas

| API | Owner |
|-----|--------|
| `addToCart`, `clearCart`, `loadCartFromStorage`, `saveCartToStorage` | `modules/vendas` |
| `abrirDetalheServicoView`, `openServicoModal`, … | `modules/vendas` |

## modules/financeiro

| API | Owner |
|-----|--------|
| `BPFinance` | `modules/financeiro` |
| comissões | `comissoes.js` (carregamento diferido) |

## modules/marketing · crm · configuracoes · ia

| Namespace / API | Owner |
|-----------------|--------|
| `BPMarketing` | `modules/marketing` |
| `BPOps` | `modules/crm` |
| `BPGestao` | `modules/configuracoes` |
| `bpPullIAUsoFromSupabase`, `bpResetIaHistorico`, … | `modules/ia` |

---

## Como adicionar API nova

1. Implementar no módulo dono.  
2. Exportar em `window` no fim do ficheiro.  
3. Se for render/hub crítico: `fn._bpOwner = 'modules/<domínio>'`.  
4. Actualizar esta tabela.  
5. Não reassign de outro módulo sem hook.

---

## Dívida consciente

- Muitos listeners ainda no mesmo ficheiro que o render (events vs render não separados em todos os domínios).  
- `cadastros-events.js` continua multi-entidade (nome histórico).  
- Core ainda expõe dezenas de globais sem `_bpOwner` (gates protegidos — não dispersar aqui).

## modules/notificacoes

| API | Owner |
|-----|--------|
| `BPNotify` | `modules/notificacoes` |
| `bpNotifyRequest`, `bpNotifyLocal`, `bpNotifyExpiring` | `modules/notificacoes` |

Ficheiro: `src/modules/notificacoes/push.js`  
SW: eventos `push` + `notificationclick`  
Integração: alerta de expiração de agenda + prompt suave após load
