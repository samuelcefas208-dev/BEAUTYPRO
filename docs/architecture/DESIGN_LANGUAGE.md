# BELEZAPRO — Design Language (F3-02)

**Estado:** especificação para validação humana  
**Fase:** F3-02 — definir a lei visual (sem aplicar à interface)  
**Base:** auditoria F3-01 + decisões registadas (Fase 2 / Orquestrador)  
**Produção:** **não alterada** (HTML / CSS / JS de runtime intactos)

---

## 0. Princípios

| Princípio | Significado |
|-----------|-------------|
| Rico em sistema, pobre em decoração | Hierarquia, espaço, tipo e estados > gradientes, sombras e ouro em excesso |
| Consolidar, não reconstruir | Já existem tokens e classes; a lei unifica **autoridade**, não inventa stack nova |
| Token ≠ Component ≠ Contexto | Agenda/Clientes/Caixa **consomem** Button/Input; não criam `AgendaButton` |
| Evidência vs proposta | Valores do CSS actual = **candidatos**. Oficiais = decisão justificada abaixo |
| deprecated ≠ apagar | Código novo não usa; remoção só com zero dependências (fase posterior) |
| Consistência antes de reorganização física | **Não** fundir os 17 CSS nesta fase |

**Stack proibida nesta fase e na aplicação da lei (até ordem em contrário):** React, Tailwind, shadcn, substituição de `app.bundle.js` por Vite.

---

## 1. Hierarquia oficial de tokens

Ordem de autoridade (do mais estável ao mais específico):

```text
1. Tokens semânticos oficiais (este documento → futuros --bp-*)
2. Tokens de base já em base-variaveis.css (fonte física actual [C])
3. Aliases de compatibilidade (legado / deprecated)
4. Valores de componente (só referem tokens; não inventam hex soltos)
5. Contexto de ecrã (Agenda, Caixa…) — zero tokens novos sem proposta F3
```

**Regra:** um componente referencia **tokens semânticos**, não hex crus (excepto brand assets externos comprovados, ex. verde WhatsApp de plataforma).

---

## 2. Cores semânticas

### 2.1 Oficiais (proposta F3-02 — mapear para tokens existentes)

| Semântica | Papel | Candidato actual [C] | Decisão F3-02 |
|-----------|--------|----------------------|---------------|
| **Brand** | Acento de marca, CTAs primários, nav activa | `--gold` `#D4AF37` | **Manter** como brand única |
| **Brand hover / active** | Pressão do acento | `--gold-600` / `--gold-900` | **Manter** escala 4 passos |
| **Brand soft** | Fundos ténues, pills warning | `--gold-50` | **Manter**; ouro **não** como fundo de ecrã inteiro |
| **Ink / texto principal** | Texto e ícones primários | `--text-primary` / `--neutral-900` | **Manter** |
| **Texto secundário / muted** | Labels, meta | `--text-secondary`, `--text-muted` | **Manter** (`--text-muted` com nota WCAG) |
| **Superfície app** | Fundo de página mobile | `--bg-soft` | **Manter** |
| **Superfície elevado** | Cards, modais, inputs | `--card-white` | **Manter** |
| **Borda** | Separadores suaves | `--border-soft` | **Manter** |
| **Canvas desktop** | Fora do shell ≥1024px | `--surface-canvas` | **Manter** (só desktop) |
| **Sucesso** | Confirmação, estados positivos | `--green` / `--green-50` | **Manter** |
| **Perigo** | Destrutivo, erro | `--red` / `--red-50` | **Manter** |
| **Aviso** | Preferir brand soft + texto gold-dark | pills warning actuais | **Manter** sem terceira cor de alerta |

### 2.2 Regras de uso do dourado

- **Sim:** primary button, item de nav activo, focus ring, detalhes de marca, palavra-chave de CTA pontual.  
- **Não:** fundos de lista inteiros, todos os botões, todos os títulos, bordas em massa.  
- Gradiente gold→gold-dark no primary/FAB: **permitido** como assinatura actual; **não** expandir a novos controlos sem necessidade.

### 2.3 Cor externa (excepção)

| Uso | Valor | Nota |
|-----|--------|------|
| WhatsApp / acções de canal | `#25D366` (hoje em CSS) | **Excepção de plataforma**; não vira token de marca BelezaPro |

### 2.4 Deprecated (cor) — não usar em código **novo**

- Cadeia `--gold-100`…`--gold-800` quando for só alias duplicado de 50/gold/600/900.  
- `--amber*` como nome paralelo a gold (preferir `--gold*`).  
- Hex soltos de cinza/bege em componentes quando existir token equivalente.  
- Fallbacks `#e5e0d8`, `#C9A227` em regras novas (usar `var(--…)`).

*Remoção física: fora de F3-02.*

---

## 3. Tipografia

### 3.1 Famílias **[C]**

| Token | Uso |
|-------|-----|
| `--font-sans` (Inter) | UI, corpo, botões, labels, modais |
| `--font-serif` (Playfair) | **Marca / momentos** (logo wordmark, onboarding hero) — **não** títulos de secção de dados |
| `--font-mono` | Números densos / recibos se necessário |

**Proposta:** títulos de secção de produto usam **sans** (já reflectido em partes do `design-system-final`). Serif não é default de H2 de ecrã.

### 3.2 Escala de tamanho (oficial proposta)

Base actual em `base-variaveis` **[C]** — **adotar como oficial**:

| Token | Valor | Uso |
|-------|--------|-----|
| `--text-2xs` | 0.65rem | Badges, legendas mínimas |
| `--text-xs` | 0.75rem | Labels uppercase, meta |
| `--text-sm` | 0.85rem | Secundário, list sub |
| `--text-base` | 0.95rem | Corpo |
| `--text-lg` | 1.1rem | Subtítulos / títulos de secção |
| `--text-xl` | 1.4rem | Títulos de modal / destaque |
| `--text-2xl` | 2.2rem | KPI grandes, splash |

Aliases `--fs-*` → **deprecated para código novo**; equivalem à escala `--text-*`.

### 3.3 Peso e tracking

| Uso | Peso | Tracking |
|-----|------|----------|
| Corpo | 400–500 | default |
| UI emphase / botão | 600 | −0.01em |
| Título secção | 700 | −0.02em |
| Label uppercase | 600 | 0.06em |

---

## 4. Escala de espaçamento

**Oficial:** grelha **8px** já em uso **[C]**.

| Token | Valor | Uso típico |
|-------|--------|------------|
| `--s1` | 8px | Gap interno mínimo, padding compacto |
| `--s2` | 16px | Padding de ecrã / card standard |
| `--s3` | 24px | Secções |
| `--s4` | 32px | Empty states / respiro |
| `--s5` | 40px | Blocos maiores |
| `--s6` | 48px | Separação hero rara |

**Proposta:** evitar `12px` / `14px` / `18px` **novos** salvo excepção documentada (ex. ícone+texto num botão). Densidade mobile prefere múltiplos de 8.

Utilitários legados `.mt-2` com significados diferentes entre ficheiros → **não** expandir; preferir tokens `--s*`.

---

## 5. Escala de radius

**Candidatos [C]** em `base-variaveis`:

| Token | Valor | Uso proposto |
|-------|--------|--------------|
| `--radius-sm` | 4px | Pills, chips, toast |
| `--radius-md` | 8px | **Default controlos** (button, input, card) |
| `--radius-lg` | 12px | Sheets, painéis |
| `--radius-xl` | 16px | Destaques raros |
| `--radius-2xl` | 20px | Evitar em controlos; só contentores especiais |
| `--radius-full` | 9999px | Avatares, dots, FAB **se** se adoptar círculo |

**Decisão proposta (não facto só por CSS):**  
- Controlos (Button, Input, Select): **`--radius-md` (8px)** como default único.  
- FAB: hoje 52px + radius-md vs 56px círculo — **proposta F3-03:** uma geometria; preferência de especificação = **alinhada ao button system (radius-md + tamanho fixo)** *ou* círculo full — **a validar em F3-03/04**; até lá listar como **divergência conhecida**, não lei.

Radius 10px no search cliente → **não** promover a token novo; alinhar a `--radius-md` ou `--radius-lg` na aplicação futura.

---

## 6. Sombras

| Token | Uso oficial proposto |
|-------|----------------------|
| `--shadow-rest` | Cards em repouso, listas |
| `--shadow-raised` | Elevação leve |
| `--shadow-floating` | Modais / popovers |
| `--shadow-gold` | **Só** primary / FAB brand — não em secondary |

Aliases `--shadow-premium`, `--shadow-card`, `--shadow-modal`, `--shadow-strong` → **deprecated para código novo** (mapear para a tabela acima).

**Princípio:** sombra não substitui hierarquia; evitar empilhar shadow + border + gradient no mesmo controlo.

---

## 7. Motion / transição

| Token | Uso |
|-------|-----|
| `--transition-fast` (150ms) | Hover, press, focus |
| `--transition-base` (250ms) | Painéis, tabs |
| `--transition-slow` (400ms) | Entradas raras |
| `--ease-out` | Default de UI |

**Acessibilidade:** respeitar `prefers-reduced-motion` em animações de entrada (splash, modal slide) — **requisito** para implementação futura; hoje cobertura **[N]** completa no repo.

Sem bounce exagerado em controlos de dados (caixa, tabelas).

---

## 8. Z-index (proposta de escala)

Valores observados **[C]:** modal ~2000, toast 2500, boot 10001, FAB 400.

| Camada | Z proposto | Exemplos |
|--------|------------|----------|
| Base conteúdo | 0–10 | Listas, cards |
| Sticky header / nav | 100–200 | Header, bottom nav |
| FAB | 400 | Acção flutuante |
| Overlay modal | 2000 | `.modal-overlay` |
| Confirm sobre venda | 2200 | Já usado em parte |
| Toast | 2500 | Acima de modal para feedback |
| Boot / bloqueio sessão | 10000+ | Gate crítico |

**Regra:** não inventar z-index ad hoc (`9998`, `9999`) em código novo sem encaixar nesta tabela.

---

## 9. Estados (global de controlos)

| Estado | Comportamento esperado |
|--------|------------------------|
| **default** | Tokens de superfície + texto |
| **hover** | Só onde há ponteiro fino (desktop); mobile pode omitir |
| **focus-visible** | Anel **brand** (`outline` gold 1px + offset) — não depender só de border |
| **active / pressed** | Escurecer ou translateY(1px) ligeiro; feedback ≤150ms |
| **disabled** | Opacity ~0.45; `pointer-events: none`; manter layout |
| **loading** | Spinner no controlo; texto transparente ou aria-busy |
| **error** | Borda `--red`; mensagem associada (não só cor) |
| **success** | Uso semântico pontual (toast / pill), não botão genérico a verde sem significado |

Checkbox/radio: `accent-color` brand quando nativo.

---

## 10. Button — especificação

### 10.1 API semântica (única)

```text
Button
  ├── primary     → acção principal do contexto
  ├── secondary   → alternativa / cancelar
  ├── ghost       → terciário, toolbar
  ├── danger      → destrutivo (sair, apagar)
  └── success     → só quando o significado é “confirmar operação positiva” (ex. fecho ok)
```

**Tamanhos (proposta justificada — não cópia cega do CSS):**

| Tamanho | Altura alvo | Uso | Justificação |
|---------|-------------|-----|--------------|
| **md (default)** | **44px** | Primário mobile, formulários, CTAs de ecrã | Touch target recomendado ≥44px (a11y); acima do 40px actual e do 36px de confirms |
| **sm** | **36px** | Acções em modal compacto, toolbars densas | Densidade sem ir aos 30px do fecho |
| **icon** | **44×44** | Menu, ícone só | Alvo tocável mínimo |

> **Nota metodológica:** o CSS dominante declara **40px** no `.btn` **[C]**. Isso é **candidato**, não lei. A especificação oficial propõe **44px default** por touch/a11y; a **aplicação** (F3-03) fará a migração gradual e medirá regressão visual. Até lá, produção permanece 40px.

**Proibidos como API:** `AgendaButton`, `CaixaButton`, `btn-fecho-especial` sem mapear a primary/secondary/danger/sm.

**Excepções de canal:** WhatsApp / Ligar → podem manter cor de plataforma, mas **altura e radius** devem convergir para a escala Button (sm ou md), não 40 com `!important` paralelo eterno.

### 10.2 Anatomia

- `inline-flex`, centro, gap `--s1`  
- Radius: `--radius-md`  
- Font: sans, weight 600, ~0.8125–0.875rem no md  
- Primary: brand (gradiente actual permitido)  
- Secondary: superfície branco + borda soft  
- Ghost: transparente  
- Danger: `--red`  
- Loading / disabled: estados da §9  

### 10.3 Variantes **não** criadas sem prova

- `xl`, `xs` (comentário no CSS já notou baixo uso)  
- Full-width: utilitário `block` / `btn-block`, não variante de cor  

---

## 11. Input e Select — especificação

### 11.1 Input

| Aspecto | Oficial proposto | Notas |
|---------|------------------|--------|
| Altura default | **48px** | Candidato forte no `design-system-final` **[C]**; bom para toque e polegar |
| Padding horizontal | 14–16px | Alinhar a um valor na F3-03 |
| Radius | `--radius-md` | |
| Border default | 1px solid `--border-soft` | Evitar dual 1.5px transparent vs 1px solid em código novo |
| Focus | border brand 1px; **sem** box-shadow pesado *ou* ring 3px — **escolher um** na F3-03; proposta: **border brand + focus-visible outline** (menos ruído) |
| Error | border `--red` + texto de erro (obrigatório em forms) |
| Disabled | fundo ivory-deep, opacity |
| Label | uppercase xs, secondary, margem inferior 6–8px |

Search (clientes): **mesmo Input**; não segunda família com radius 10px / height 42px a longo prazo.

### 11.2 Select

- Mesma altura, radius e borda que Input.  
- Seta SVG via background (padrão actual) **[C]**.  
- Evitar `<select>` estilizado de forma diferente por ecrã.

### 11.3 Variantes

- `error` / `disabled` / `readonly`  
- **Não:** `InputAgenda`, `InputCaixa`

---

## 12. Variantes permitidas — resumo

| Componente | Variantes OK | Só com necessidade semântica comprovada |
|------------|--------------|------------------------------------------|
| Button | primary, secondary, ghost, danger, success, sm, block, icon | compact extra, cores de canal (WA) |
| Input | default, error, disabled | search (mesmo input) |
| Select | default, error, disabled | — |
| Modal | sheet (mobile), center confirm | — |
| Toast | success, error, warning, info | — |

---

## 13. Tabela de autoridade

| Decisão | Fonte oficial (lei F3-02) | Fonte física actual [C] | Notas |
|---------|---------------------------|-------------------------|--------|
| Tokens de cor/espaço/tipo | Este documento + `base-variaveis.css` | `base-variaveis.css` | Extra tokens → `design-tokens-extra` a inventariar na aplicação |
| Button visual | Spec §10 | `design-system-final.css` (+ overrides) | Overrides em `componentes-base` / modais = **não oficiais** |
| Input visual | Spec §11 | `design-system-final` vs `componentes-base` | Conflito a resolver em F3-03 |
| Toast | Spec estados + uma definição | Duplicado final + modais-toast | F3-04 unifica |
| FAB | Uma geometria (a fechar F3-03/04) | Duas definições | Divergência conhecida |
| Contexto Agenda/Caixa/… | Consome componentes | CSS de domínio | Pode layoutar; **não** redefine Button |

**Autoridade de cascata desejada (futuro):**  
tokens → primitivos (button/input) → layout domínio → **proibido** inline novo.

---

## 14. Legado / deprecated (código novo)

| Item | Motivo |
|------|--------|
| `--fs-*` | Duplica `--text-*` |
| `--gold-100`…`800` redundantes | Usar 50 / gold / 600 / 900 |
| `--amber*` | Preferir gold |
| `--shadow-premium/card/modal/strong` em API nova | Usar rest/raised/floating/gold |
| Alturas 30px / 34px ad hoc | Fora da escala sm/md/icon |
| Novos `!important` em botões de modal | Resolver por especificidade de componente |
| Novos `style=""` de layout em HTML | Usar classes do sistema |
| `AgendaButton` / CSS só de ecrã que copia `.btn` com outros px | Consumir Button |

---

## 15. Regras anti-fragmentação

1. **Proibido** criar classe de botão específica de contexto sem RFC / entrada neste documento.  
2. **Proibido** inline style para cor, padding, height, radius de controlos em código **novo**.  
3. Inline residual (header, onboarding) → catalogado; migração só em incrementos de ecrã (F3-07+).  
4. CSS de domínio (caixa, agenda) pode definir **grid/layout**, não uma terceira família de botões.  
5. WhatsApp/Call: excepções de **cor de canal**, não de **sistema de tamanho** a longo prazo.  
6. Qualquer token novo exige: nome semântico, valor, razão, e se depreca outro.

---

## 16. Critérios de validação (antes de considerar um primitivo “aplicado”)

### Mobile
- Alvo tocável ≥ **44×44px** em acções primárias (proposta; validar em device).  
- Bottom nav e FAB não colidem com toast.  
- Safe-area respeitada em sheets.

### Desktop
- Hover visível em secondary/ghost.  
- Canvas `--surface-canvas` sem esticar cards sem limite.  
- Mesmos componentes; **composição** muda, não a lei.

### Touch
- Espaço entre acções destrutivas e primárias ≥ 8px.  
- Não depender só de hover para descobrir acção.

### Acessibilidade
- Contraste texto muted ≥ alvo AA quando possível (`--text-muted` já anotado).  
- `focus-visible` sempre em Button/Input/Select.  
- Loading: `aria-busy` / texto alternativo.  
- Error: não só cor.  
- `prefers-reduced-motion` em animações de entrada.

### Densidade
- Formulários: input 48px + labels.  
- Tabelas/listas densas: button **sm** 36px, não 30px.

---

## 17. O que F3-02 **não** decide (explícito)

- Valor final renderizado em produção (continua o CSS actual).  
- Fusão dos 17 ficheiros.  
- Geometria final do FAB (duas opções em aberto).  
- Prova adversarial de contraste em dark mode (**[N]** sem auditoria dark dedicada).  
- Contagens exactas de uso de cada classe no HTML (**[N]** no F3-01).

---

## 18. Critério de sucesso F3-02

Este documento permite responder:

1. Qual é a **única lei** de cor, espaço, tipo, radius, sombra, motion, z-index?  
2. Quais são as **únicas** variantes de Button / Input / Select?  
3. O que é **oficial** vs **deprecated** vs **divergência conhecida**?  
4. O que a F3-03 pode aplicar primeiro sem inventar por ecrã?

**Sim — desde que validado por ti.**

---

## 19. Próximo passo (não executar aqui)

**F3-03:** aplicar a lei a **Button + Input + Select** no CSS de autoridade, com diff mínimo, sem redesenhar ecrãs inteiros, sem fundir os 17 ficheiros, medindo regressão.

---

*F3-02 — especificação apenas. Zero alteração de produção.*

---

## 20. Decisões fechadas (P0–P3 · polimento visual 2026-08)

Actualização de produção **aplicada** na linha CSS (runtime). Esta secção fecha divergências abertas nas §§ anteriores.

### 20.1 Autoridade de componentes

| Componente | Autoridade única | Notas |
|------------|------------------|--------|
| **Button** (`.btn` + variantes) | `design-system-final.css` | primary / secondary / ghost / danger / success / sm / block |
| **Card** (`.card` / `.card-highlight`) | `design-system-final.css` | Duplicado removido de `componentes-base.css` |
| **FAB** | `modais-toast-fab.css` | **Círculo 56×56**; posição desktop só em media queries |
| **Input** | `design-system-final.css` | altura alvo 48px; contextos (IA composer) podem densificar |
| **Confirm actions** | `modais-toast-fab.css` → `.confirm-actions` | **Só tipografia** (Cancelar ink / Eliminar `--red`); sem caixa preenchida |
| **Chips de período** | `.agenda-periodo-filter` (+ chart-filter) | **Não** são Button; active = brand |
| **Tile Caixa/Resumo** | `.caixa-acao` | Contexto; Resumo fixa altura via `.resumo-kpi-acao` |
| **CTA venda** | `.venda-cta-bar` | Padrão de marca; não misturar com `.btn` |

### 20.2 Escala de controlos (oficial em produção)

| Escala | Altura | Uso |
|--------|--------|-----|
| **md** | 44px | `.btn` default, FAB hit, send IA |
| **sm** | 36px | `.btn-sm`, acções densas de modal (cliente/prof), WA/Ligar |
| **chip** | ≥32px | filtros de período / segment |
| **Proibido** | 30px em botões de dados | (fecho já migrado para `.btn-sm`) |

### 20.3 Deprecated (não usar em markup novo)

- `.bp-fecho-btn` / `--ghost` / `--primary` → usar `.btn` + variantes  
- `.btn-modal-compact` / `.btn-modal-quiet` → legados do bundle no confirm; CSS mapeia a tipografia em `.confirm-actions`  
- `.kpi-grid--resumo` / `.kpi-card--fat` → substituídos por `.resumo-hero`  
- Redefinir `.card` ou `.fab` fora dos ficheiros de autoridade  

### 20.4 Excepções de plataforma (mantidas)

- WhatsApp `#25D366` — cor de canal; **altura/radius** alinhados a sm  
- Não expandir verdes de canal a botões genéricos BelezaPro  

### 20.5 Princípio operativo

```text
Tokens → Primitivos (btn/input/card) → Contexto (layout/densidade) → Ecrã
```

Contexto **não** cria `AgendaButton` / `CaixaButton`.  
Contexto **pode** ajustar grelha, gap e tipografia local sem segunda família de botão.

---
