# BeautyPro — Criar conta v2

Versão endurecida após auditoria da v1.

## Correções face à v1

- CTA **desactivado** em tempo real nos passos 3–5 até validação mínima
- Banner **sem innerHTML** (só textContent + botão DOM)
- Sem `alert`
- i18n **completo** nas 7 línguas (todas as chaves)
- `BP_SIGNUP_DEMO` isola emails de teste
- Rascunho em `sessionStorage` **sem password**
- Validação de submit **única** (`validateAllForSubmit`)
- Foco no primeiro erro
- Enter avança / submete
- Modal: Escape, «Ver planos» via `bpOnViewPlans`
- Mensagem de email existente distinta no campo e no banner

## Teste

```bash
cd BeautyPro-signup-circuit-v2
python3 -m http.server 8080
```

Conflito demo: email `existe@beautypro.ao` no passo 6.

Produção: `window.BP_SIGNUP_DEMO = false` e definir `window.bpSignupCreateAccount`.
