# ETAPA8_VALIDATION — circuito de testes

**Resultado: PASS (34 OK, 0 ERR)**

## Checks executados

1. Existência dos 8 artefactos JS/SW tocados
2. `node --check` syntax em todos
3. F1: `openServicoModal` só em `servicos-modal.js`; ausente em `vendas-modais`
4. F1: load order index modal → events
5. F2: `modal-finalizar-save` só em `agenda-events`
6. F2: `fab-scrolling` / `fab-agendar` ausentes de `main.js`
7. F3: zero linhas operacionais `app.bundle` em `sw.js`
8. F3: CACHE `v20260830-e83`
9. F3: `bpRestoreUiChrome` em boot-migrations; `main` sem `.filtro-frequencia`
10. Todos os `src=` do index existem no tree de trabalho
11. Uma única definição `function openServicoModal`

## Não coberto neste ambiente [N]

- Smoke visual no telemóvel
- Clique real finalizar / serviço / FAB
