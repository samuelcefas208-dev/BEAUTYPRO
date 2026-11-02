# Constituição — Aba IA (Benza)

Documento de governação das 4 fases. Qualquer alteração à aba IA deve respeitar este contrato.

## Identidade
- Nome: **Benza**
- Papel UI: **Agente IA**
- Papel de produto: consultor de gestão do salão (generativo, não chat casual)
- Offline: **não responde** ao chat («Sem rede»). Sem motor local de backup.
- KPIs (3 cards): **só desktop** (≥1024px)

## Quatro fases

### Fase 1 — Fundação UI + contrato (esta entrega)
- `ia-contract.js` como fonte de strings/constantes
- Header e status honestos (sem título inventado só por CSS)
- Composer: campo de escrita e botão **Enviar** separados (enviar ao lado, fora do campo)
- CSS sem conflito verde/dourado no enviar
- `bp:ia-ready` após carga diferida; insights/resumo quando o módulo carrega
- Critério: mobile previsível; offline não mente «Ligado»/«Modo local»

### Fase 2 — Insights humanos + sugestões robustas
- Retirar a expressão **«Insights automáticos»** → nome humano (ex. «O que merece atenção»)
- Templates de insight em linguagem de dono de salão
- Sugestões só com dados reais; offline desactiva chips
- Ficheiros: `ia-insights.js`, `ia-sugestoes.js`

### Fase 3 — Habilidades + Benza Loop
- Três **habilidades** (nunca «rápido», nunca «números»):
  1. **Consultor** — diagnóstico e direcção
  2. **Construtor** — propõe criações (cliente, agenda, …) com **Autorizar**
  3. **Relator** — prepara relatório (PDF na fase 4)
- Persistência em `state` + localStorage; enviada no POST
- Writes só após botão Autorizar na mensagem (`ia-loop.js` + `benza-tools.js`)
- `customer.create` com confirmação obrigatória

### Fase 4 — PDF + quota dura
- `ia-relatorio.js` + descarregar PDF a partir da bolha
- Quota: remoto como verdade quando online; UI clara do limite
- Auth 401/403 com mensagem única

## Regras permanentes
1. Não reintroduzir motor local de chat.
2. Não injectar título só com `content:` CSS se o HTML já for a fonte.
3. Uma regra de cor para o botão enviar.
4. Tools de escrita nunca executam sem confirmação explícita do utilizador.
5. Alterar o modelo = deploy de `ia-query.ts` (Edge), não só o ZIP da PWA.


## Blindagem F1+F2 (pacote único)
- Status header sem «modo local» / respostas locais.
- Export `renderIAResumo` / `actualizarInsightsIA` / `actualizarResumoIA`.
- `window._bpIaIsOnline` para sugestões offline.
- Enviar: dourado único (verde anulado).
- Contrato `VERSION: f1f2-20260907`.


## Fase 3 entregue
- Habilidades: Consultor / Construtor / Relator (`ia-habilidade.js`), persistidas.
- Loop Autorizar (`ia-loop.js`) — writes só após clique.
- `customer.create` com `confirmacao: true`.
- POST inclui `habilidade` + `toolsCatalog`.
- Composer −30% e placeholders a rolar no vazio.


## Auditoria F3 (blindagem)
- Writes com `confirmacao` exigem `__bpIaAuthToken` definido só no clique Autorizar.
- Proposta também quando `perguntarIA` devolve null (quota/auth) — Construtor offline-safe.
- Dedupe de cartão (mesmo tool+dados).
- Telefone: 9 dígitos ou 244+9.
- Chip com `order:50` para não ser empurrado pelo status Offline.
- Placeholder pára com `document.hidden`.


## Fase 4 entregue
- `ia-relatorio.js`: dados do salão → PDF (Helvetica, sem libs externas).
- Botão **Descarregar PDF** na última bolha quando habilidade = Relator.
- Período detectado na pergunta (hoje / semana / 30 dias).
- Quota: `bpPullIAUsoFromSupabase` antes do limite local (remoto manda quando online).
- 401/403: status + toast únicos.
- Sugestões Relator: relatório semana/hoje/30 dias.
