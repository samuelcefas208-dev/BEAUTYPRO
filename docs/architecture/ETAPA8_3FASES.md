# Etapa 8 — 3 fases cirúrgicas (pós 1–7)

## Correcção de contexto

O “P0 20 scripts em falta” e “dark-mode eliminado” aplicavam-se a um **working tree incompleto** (extração parcial), **não** ao ZIP de referência nem à arquitectura. Core e `styles/themes/dark-mode.css` existem no pacote de referência. Neste ambiente o tree local foi alinhado com o REF **sem** alterar lógica de core/sync/auth.

## Plano em 3 etapas (sem sub-etapas)

| # | Alvo | Estado |
|---|------|--------|
| **1** | Ownership `openServicoModal` → `modules/servicos/` | **Feito** |
| **2** | Finalizar atendimento + FAB scroll | **Feito** |
| **3** | SW sem app.bundle operacional + restore UI chrome no boot | **Feito** |

## Etapa 1 — feito

- Novo: `src/modules/servicos/servicos-modal.js` (modal + detalhe + checkboxes prof)
- Removido bloco equivalente de `vendas-modais.js`
- `index.html`: `servicos-modal` **antes** de `servicos-events`
- `window.openServicoModal` / `abrirDetalheServicoView` / `setServicoModalMode` exportados no módulo serviços


## Etapa 2 — feito

- `modal-finalizar-save` / `cancel` → `agenda-events.js` (open permanece em `agenda-board.js`)
- `vendas-events.js` sem listeners de finalizar
- FAB scroll UX (`fab-scrolling`) → `agenda-events.js`; **removido** de `main.js`
- Visibility do FAB por tab permanece em `dashboard-render.js` (`atualizarVisibilidadeAtalhos`) — coordena também CTAs de venda


## Etapa 3 — feito

- `sw.js`: CACHE `e83`; **sem** ramos operacionais a `app.bundle.js` (só index/navigate/sw network-first)
- `bpRestoreUiChrome` em `boot-migrations.js` (filtros clientes + chart); removido do corpo de `main.init`
- `main.js` continua a chamar `bpRunBootMigrations()` (migração + restore)
