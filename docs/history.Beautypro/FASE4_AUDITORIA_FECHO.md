# FASE 4 — FECHO CÓDIGO (sem pendências de código)

## Separação clara

| Domínio | Responsável | Estado |
|---------|-------------|--------|
| Código app (XSS listas, IA, features attrs, boot defer) | Esta entrega | **FECHADO** |
| Supabase RLS re-query / JWT real | Responsável do projecto | Exterior — não bloqueia fecho de **código** |
| Medição TTI no telemóvel | Responsável (já reportou ganhos perceptíveis) | Exterior — código de defer já em produção |

## Matriz

| ID | Código | Nota |
|----|--------|------|
| F4.1 | ✅ | Contratos state + testes |
| F4.2 | ✅ | XSS listas + IA insights/followups + features attrs |
| F4.3 | ✅ estrutural | JWT/SQL live = dono do Supabase |
| F4.4 | ✅ | Guia features |
| F4.5 | ✅ | Charts/IA/Desktop diferidos no código |

## Runtime alterado (esta ronda XSS)

- `ia/ia-module.js`
- `features/ops-crm-comercial.js`
- `features/finance-fase1-extra.js`
- (+ UI F4 anterior: agenda, clientes, eventos-caixa)

## Testes executados

- `node --check` nos JS tocados
- policy state-writers 14 PASS (se Node)

## Pontos de atenção de CÓDIGO Fase 4

**Nenhum.** Pendências restantes são **operacionais externas** (Supabase/JWT/lab dispositivo), não gaps de implementação nesta fase.
