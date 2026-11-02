# Fase 2 — Plano de execução (fundação)

## Objectivo
ESTABILIZAR → PROTEGER → SEPARAR → PREPARAR  
Sem React, sem Tailwind, sem reescrita UI, sem tocar no motor offline.

## Incrementos

| ID | Incremento | Depende de | Entrega |
|----|------------|------------|---------|
| **F2-01** | Tooling + Vitest + regras puras P0 (planos, soft-active, slimPayload) | — | package.json, vitest, domain/pure/*, testes verdes |
| **F2-02** | Contrato IndexedDB vs localStorage (doc + testes de política) | F2-01 | Documento CONTRACT_LOCAL_STORE.md; testes de política mirror |
| **F2-03** | Caracterizar sync-queue (retry/DLQ) sem reescrever | F2-01 | **Feito (mínimo):** CONTRACT + policy + testes; runtime intacto |
| **F2-04** | Contrato salao_id / isolamento (puro + testes; sem tocar runtime) | F2-01 | **Feito (mínimo):** CONTRACT_SALAO_ID + policy + testes; runtime intacto |
| **F2-05** | Repository clientes (contrato + pure; Opção A) | F2-01, F2-04 | **Fechado (Opção A).** Opção B (wire-up runtime) **adiada** — sem consumidor; risco de dois caminhos |
| **F2-06** | Use case criarCliente (decisão pure) | F2-05 Opção A | **Feito:** CONTRACT + decidirCriarCliente + testes; runtime intacto; sem Opção B |
| **F2-07** | ESLint legado (warn) + inventário | F2-01 | **Feito:** lint:legacy + 477 warnings / 0 errors; sem auto-fix |
| **F2-08** | Playwright scaffold + smoke | F2-01 | **Feito (scaffold):** config + e2e; smoke **[N]** sem staging |
| **F2-09** | Vite dev experimental (paralelo ao bundle) | F2-01 | **Feito (scaffold):** vite.config + contrato; parity **não** afirmada; sem index.html neste pacote **[N]** |
| **F2-10** | Design System: inventário Button/Input | — | **Feito (doc):** inventário + spec; sem unificar CSS em produção |

## Ordem recomendada
F2-01 → F2-02 → F2-03 → F2-04 → F2-05 → F2-06 → (F2-07 paralelo) → F2-08 → F2-09 → F2-10

## Testes primeiro (P0)
1. Limites PLANOS + canCreateWithinPlan  
2. isEntityActive / countActive (soft delete)  
3. slimPayload + DLQ thresholds  
4. (depois) salao_id em payloads  
5. (depois) golden offline e2e  

## O que NÃO se faz até F2-05+
Reescrever sync-queue, db-indexeddb, sync-rest; migrar React; editar app.bundle.js à mão.
