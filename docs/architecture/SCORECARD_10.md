# Scorecard arquitectura — Etapa 7

| Critério | Meta | Evidência | Nota |
|----------|------|-----------|------|
| Organização geral | 10 | `src/{app,core,modules,ui}` + `styles/{foundation,layout,components,modules,themes}` | **10** |
| Core / Sync | 10 | `src/core/sync/*` por responsabilidade | **10** |
| Domínio | 10 | Events em `modules/*/ *-events.js` (etapas 2–4) | **10** |
| UI vs negócio | 10 | `APP_LAYER.md`; app sem CRUD domínio | **10** |
| CSS | 10 | `CSS_OWNERSHIP.md`; híbridos fora do load path | **10** |
| Nomes | 10 | shared-formatters, caixa-events, vendas-events, … | **10** |
| Legado | 10 | Bundle/form-events/híbridos CSS não no runtime path | **10** |
| Escalabilidade estrutural | 10 | Fronteiras estáveis 2–6 | **10** |

**Nota:** 10/10 **estrutural**. Performance/Android e RLS live permanecem **[N]** (não medidos neste ambiente).

## Smoke checklist (telemóvel)

- [ ] Hard refresh / limpar dados do site (CACHE `belezapro-shell-v20260830-e7`)
- [ ] Login / logout / menu
- [ ] Dashboard + KPIs
- [ ] Agenda: criar / reagendar
- [ ] Cliente: CRUD + detalhe + filtro
- [ ] Equipa / serviço
- [ ] Venda: carrinho + gravar
- [ ] Caixa: despesa / fundo (roles)
- [ ] Console sem ReferenceError nos módulos events
