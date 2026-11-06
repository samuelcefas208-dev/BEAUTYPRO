# Criar conta — 4 etapas (completo)

| Etapa | Estado | Conteúdo |
|-------|--------|----------|
| 1 | Feita | Localização · Passo N de 6 · CTA disabled |
| 2 | Feita | Ecrã único · rascunho · termsVersion |
| 3 | Feita | Modal plano gratuito |
| 4 | Feita | i18n 7 línguas · Alterar no resumo · login erros alinhados |

## Etapa 4

- `src/core/auth/auth-i18n.js` — pt, en, fr, es, ar, zh, sw
- Selector canto superior direito (`#bp-auth-lang-host`)
- Preferência `localStorage.bp_auth_lang` — não apaga campos
- RTL para árabe
- Resumo: botões Alterar → passos 3/4/5
- Login: mensagens vazias / credenciais via `bpAuthT`
