# F5 — Provisionamento de organização (Supabase)

## O que faz

Utilizador autenticado **sem** `profiles` → ecrã «A sua organização» → Edge Function `provision-empresa` cria:

1. `saloes` (id novo, nome)
2. `profiles` (`role: admin`, `user_id`, `salao_id`)
3. `salao_config` (trial, se a tabela existir)

**Service role só na Edge.** O browser envia apenas o JWT do utilizador.

## Deploy da function

```bash
# Na pasta do projecto com CLI Supabase ligada ao projecto xbudnftutemakjbgxayf
supabase functions deploy provision-empresa
```

Ou no Dashboard: **Edge Functions** → criar `provision-empresa` → colar `supabase/functions/provision-empresa/index.ts`.

Garantir secrets (hosted já tem):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## SQL (opcional — só se inserts falharem por RLS/constraints)

Service role **bypassa RLS**. Não é necessário abrir INSERT anónimo em `saloes`/`profiles`.

Confirme apenas:

- `profiles.user_id` UNIQUE
- `profiles.role` IN (`admin`,`gerente`,`operador`)
- `saloes.id` UUID PK

## Teste

1. Conta Auth **nova** (email confirmado ou Google) sem linha em `profiles`
2. Login → painel organização → nome empresa → **Criar espaço de trabalho**
3. Deve entrar na app com dados do salão

## Segurança

- Um user só provisiona **uma** vez (se já tem profile, devolve o existente)
- Não aceita `salao_id` do cliente
- Role fixo `admin` no primeiro provisionamento
