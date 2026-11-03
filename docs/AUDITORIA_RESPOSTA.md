# Resposta à auditoria F6.2

## Pergunta 1 — Interface (evidência no artefacto)

- Bearer + apikey; INVITE_MEMBRO_EDGE_URL / SET_BLOQUEIO_EDGE_URL
- Reauth antes de convidar/bloquear
- Pós-fix: note + audit_ok; sem temporary_password

## Correcções publicáveis

Ver Edges neste ZIP + acessos-governanca.js

## SQL só leitura (no teu Supabase)

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('profiles','saloes','access_audit','salao_config')
ORDER BY 1,2;
```
