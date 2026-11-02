# FASE 4 — RELATÓRIO FINAL

## 1. Estado inicial
F4.1 iniciada sobre runtime actual (não ZIP antigo como verdade). XSS parcial F3; boot charts/IA/desktop já diferidos em fases anteriores.

## 2. F4.1 — Writers de state
Contrato + policy pure + 14 testes. **Produção: 0.**

## 3. F4.2 — XSS
Inventário de sinks. Patch mínimo:
- `ui/ui-render-dashboard-agenda.js` — `escHtml` em `data-agenda-id` / `data-id`
- `ui/ui-render-clientes-caixa-equipa.js` — `escHtml` em `data-cliente-id` / `data-id`
Residual IA/features documentado, não Big Bang.

## 4. F4.3 — RLS
- Handoff F2-04 (2026-08-19): RLS activo, policies por `salao_id` / `profiles.salao_id` → **[C] no relatório F2-04**
- Revalidação por esta sessão → **[N]**
- JWT real REST → **[N]**
Não se afirma “validei eu agora” nem “nunca foi validado”.

## 5. F4.4 — Guia features
`GUIA_ADICIONAR_FEATURE.md` checklist operacional.

## 6. F4.5 — Boot
Mapa + candidatos futuros. Sem novo lazy load. TTI **[N]**.

## 7–8. Ficheiros
**Runtime:** só os 2 em `ui/`.  
**Docs/testes:** ver árvore do pacote.

## 9. Testes
- state-writers-policy: 14 PASS (quando Node disponível)
- E2E XSS / RLS live / TTI: [N]

## 10. Regressão
F1 / F2B / núcleo Auth-IDB-Sync: não tocados.

## 11. Riscos residuais
XSS IA/features; JWT real; performance não medida.

## 12. Backlog
1. JWT real (staging) opcional  
2. Revalidar policies se Supabase mudou desde 19/08  
3. XSS residual IA/features  
4. Medir boot no dispositivo  
5. Fase 5 — só com ordem  

## 15. Estado final
**FASE 4 CONCLUÍDA (local/documental) · PARAR**
