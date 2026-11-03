# Etapa 3 — Recovery + Google (ponta a ponta)

## O que a app já faz (código)
- **Recuperar:** `resetPasswordForEmail` com `redirectTo` = domínio público + `?bp_recovery=1`
- **Link do email:** troca código/sessão → painel "nova palavra-passe" → `updateUser({ password })` → signOut local → login
- **Google:** `signInWithOAuth({ provider: 'google', redirectTo })` com PKCE
- **SPCK / localhost:** OAuth e recovery **não** usam o preview como redirect (usam `BP_AUTH_SITE_URL` = https://tatilson.vercel.app)

## O que tens de configurar no Supabase (obrigatório)

### Authentication → URL Configuration
- **Site URL:** `https://tatilson.vercel.app`
- **Redirect URLs** (adicionar todas as que usas):
  - `https://tatilson.vercel.app`
  - `https://tatilson.vercel.app/**`
  - `https://tatilson.vercel.app/?bp_recovery=1`
  - (se tiveres domínio próprio, o mesmo padrão)

### Authentication → Providers → Google
1. Enable Google
2. Client ID + Client Secret do Google Cloud Console
3. No Google Cloud → OAuth client → Authorized redirect URIs:
   - `https://xbudnftutemakjbgxayf.supabase.co/auth/v1/callback`

### Authentication → Emails
- Template **Reset password** activo
- SMTP de produção (ou email nativo Supabase em testes; em free pode atrasar / ir a spam)

### Edge invite (opcional alinhado)
- Secret `BP_SITE_URL` = `https://tatilson.vercel.app`

## Teste Recovery (produção / Vercel, não SPCK)
1. Abrir https://tatilson.vercel.app
2. Email + "Esqueci a palavra-passe"
3. Abrir email → link deve cair no mesmo domínio com painel de nova senha
4. Definir senha → mensagem de sucesso → login com a nova senha

## Teste Google (produção)
1. Botão Google no login
2. Conta Google → voltar à app já com sessão (ou provision se for conta nova)
3. Se erro "provider not enabled" → Provider ainda off no Supabase

## Teste no SPCK
- **Recuperar / Google:** o redirect vai para Vercel (esperado). Completa o fluxo **no domínio publicado**.
- Preview SPCK serve para UI; o circuito OAuth fecha em produção.

## Código tocado nesta etapa
- `src/core/auth/auth-supabase.js` — limpar URL após recovery; Entendi após nova senha; exports `bpAuthRedirectTo` / `bpAuthCleanUrlParams`
