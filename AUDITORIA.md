# Auditoria factual — v1 vs idealização

## Veredicto
A v1 **não está aprovada** para produção. Cumpre a silhueta do wizard, mas falha em rigor de validação, i18n, segurança de DOM, estados de botão e circuitos de fecho.

## Inconsistências face ao idealizado

| # | Idealizado | v1 | Severidade |
|---|------------|----|------------|
| 1 | Erros só inline; banner só sistema | OK na forma | — |
| 2 | Continuar desactivado até passo válido (3/4/5) | Só valida no clique; botão sempre activo | Alta |
| 3 | Termos: Continuar só com checkbox | Valida no clique; botão activo com termos por aceitar | Alta |
| 4 | Foco no primeiro campo com erro | Ausente | Média |
| 5 | Idioma = app inteira, 7 línguas | fr/es/ar/zh/sw **parciais** (muitas chaves em inglês) | Alta |
| 6 | Banner persistente com acções | `innerHTML` com HTML injectado — risco XSS se msg externa | Alta |
| 7 | Sem toast/alert amador | `alert()` no fim do demo | Alta |
| 8 | Email já existe: nunca criar + caminho claro | Campo usa `err_email` genérico em vez de mensagem de conflito | Média |
| 9 | Localização obrigatória | OK | — |
| 10 | Criar conta só no passo 6 | OK | — |
| 11 | Plano gratuito X dias (política) | Modal OK; botão «Ver planos» **sem acção** | Média |
| 12 | Password nunca em storage | Não grava password (OK) mas também **não persiste rascunho** dos outros campos | Média |
| 13 | Loading + anti duplo submit | Há flag `submitting` | OK |
| 14 | DEMO emails misturados no caminho real | `DEMO_TAKEN` sempre activo | Alta |
| 15 | `validateStep` em cadeia no submit | Cada chamada faz `clearFieldErrors` — frágil e confuso | Média |
| 16 | Acessibilidade progresso | Sem `aria-live` / `aria-current` | Média |
| 17 | Enter nos campos avança | Ausente | Baixa |
| 18 | Integração login/recuperação | Só stub «Iniciar sessão» | Esperado neste circuito, mas contrato incompleto |

## Código frágil / mal feito (v1)

1. **`showBanner(..., innerHTML)`** — qualquer string com HTML é interpretada.
2. **`createAccount` chama `validateStep` 3×** — cada uma limpa erros da anterior antes de revalidar; lógica opaca.
3. **`alert()`** como fallback de `bpOnSignupComplete`.
4. **i18n**: `fr`/`es`/`ar`/`zh`/`sw` = inglês com 5–10 chaves trocadas.
5. **Checkbox termos**: `setFieldError('signup-terms')` aplica `is-invalid` a input checkbox sem estilo dedicado.
6. **Selector de idioma** recriado a cada init sem preservar foco.
7. **Sem modo `demo` explícito** — comportamento de teste colado ao núcleo.

## Circuitos incompletos

- Persistência de rascunho (empresa, localização, email) em `sessionStorage` sem password.
- Estado contínuo do CTA (disabled/enabled) nos passos 3–5.
- Modal plano: secundário sem handler; sem `Escape` / foco preso.
- Contrato de integração documentado mas não tipado (`bpSignupCreateAccount` retorno esperado).

## O que a v2 corrige

- Validação única, foco no primeiro erro, CTA desactivado em tempo real nos passos 3–5.
- Banner só com `textContent` + botões criados em DOM.
- i18n completo nas 7 línguas para todas as chaves do circuito.
- `BP_SIGNUP_DEMO=true` para emails de teste; produção sem lista hardcode activa.
- Rascunho sessionStorage (sem password).
- Modal com foco, Escape, secundário com callback.
- Zero `alert`.
- `aria-live` no banner e meta do passo.
