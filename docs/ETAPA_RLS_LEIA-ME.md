# Etapa RLS — o que vai acontecer

## Objectivo
Passar a segurança **do browser para o Postgres**: mesmo que alguém manipule o JavaScript, não lê nem escreve dados de outro salão.

## O que acontece quando corres o SQL
1. Funções `bp_meu_salao_id()` e `bp_sou_owner()` (baseadas no teu `profiles`).
2. RLS **ligado** nas tabelas principais.
3. Role **anon** perde ALL nessas tabelas (só entra quem está autenticado).
4. Policies: SELECT/INSERT/UPDATE só com `salao_id` = o teu salão.
5. `access_audit`: owner lê; escrita continua nas Edges (service_role).

## O que NÃO acontece
- Não apaga clientes, vendas, nem contas.
- Não publica Edges sozinho (invite-membro continua a precisar de deploy).
- Não altera o visual da app.

## Risco
Se alguma policy antiga for mais permissiva e for substituída, testes com **gerente/operador** e **dois salões** são obrigatórios após o Run.

## Como aplicar
1. Supabase → SQL Editor
2. Colar `ETAPA_RLS_HARDENING.sql`
3. Run
4. Testar: login owner, criar dado; segunda conta noutro salão não vê esses dados.

## Depois desta etapa
Verdade numérica (Resumo/Caixa/PDF) ou Recovery/Google de ponta a ponta.
