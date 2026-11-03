# Deploy Edge — Acessos (próxima etapa)

## Funções obrigatórias
- `invite-membro` (agora grava `access_tabs` em `salao_config.acessos.membros[user_id]`)
- `set-membro-bloqueio`

## CLI (exemplo)
```bash
supabase functions deploy invite-membro --project-ref xbudnftutemakjbgxayf
supabase functions deploy set-membro-bloqueio --project-ref xbudnftutemakjbgxayf
```

## Secrets
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, BP_SITE_URL

## Teste
POST autenticado a `/functions/v1/invite-membro` não deve devolver **404**.
401/403/400 = função existe; 404 = não publicada.

## Schema
`salao_config.acessos` JSONB (já usado). Estrutura:
```json
{
  "gerente": { "dashboard": true },
  "operador": { "agenda": true },
  "membros": {
    "<user_id>": { "role": "operador", "tabs": { "agenda": true }, "updated_at": "..." }
  }
}
```
