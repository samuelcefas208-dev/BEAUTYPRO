# Guia — Antes de adicionar uma feature (F4.4)

Checklist operacional. Seguir **por ordem**.

## 1. Antes de código
- [ ] Qual problema do utilizador resolve?
- [ ] Já existe owner (CRUD / UI / feature) para essa responsabilidade?
- [ ] Lê `CONTRACT_STATE_WRITERS.md` e ownership se tocar em dados ou render

## 2. Onde pôr o código
| Tipo | Sítio típico |
|------|----------------|
| Regra pura testável | `docs/fase2/domain/pure/` (+ teste) |
| Persistência / CRUD | `core/crud-operations.js` (não inventar segundo CRUD) |
| Fila offline | só via `addToSyncQueue` — não contornar |
| UI de ecrã | `ui/` ou `features/` existente do domínio |
| Boot / init | evitar; se precisar, depois de `hideSplash` e sem bloquear parse |

## 3. State
- **Não** fazer `state.clientes = [...]` em feature nova
- Filtros UI: chaves de período/filtro ok
- Preferir `BeautyStore.setState` / `setList` se a UI depende de `subscribe`
- Listas de negócio: CRUD + sync-rest

## 4. Multi-tenant
- Nunca inventar `salao_id`
- Operações de escrita passam pelo caminho que já injeta `salaoId` da sessão
- Não reprocessar DLQ cross-tenant

## 5. Offline-first
- Escrita local (`dbPut`) + fila
- Não assumir rede
- Não criar store paralelo “só online”

## 6. XSS / DOM
- Dados de utilizador em HTML → `escHtml` (texto) / `attrSafe` ou `escHtml` (atributos)
- Evitar novos `innerHTML` com strings concatenadas de API

## 7. Componentes visuais
- Reutilizar Design Language / classes existentes
- Não criar `AgendaButton` / `CaixaModal` sem necessidade semântica

## 8. Testes
- Regra de negócio nova → teste pure se possível
- Não afirmar E2E sem o executar

## 9. Documentação
- Actualizar contrato se mudares ownership
- Entrada curta no plano da fase se for fatia nomeada

## 10. Validação
- Smoke no dispositivo real quando tocares UI
- Confirmar que F1/F2B (tenant, fila, DLQ) não foram enfraquecidos
