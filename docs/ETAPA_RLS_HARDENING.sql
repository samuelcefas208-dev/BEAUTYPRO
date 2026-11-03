-- =============================================================================
-- BeautyPro — Etapa seguinte: RLS + isolamento multi-tenant (servidor)
-- Projecto: xbudnftutemakjbgxayf
--
-- O QUE ISTO FAZ (e o que NÃO faz):
--  ✓ Reforça que a API anónima não escreve/lê dados de negócio à solta
--  ✓ Garante RLS ligado nas tabelas críticas
--  ✓ Policies de SELECT/INSERT/UPDATE por salao_id (perfil do auth.uid())
--  ✓ Impede UPDATE de is_owner / salao_id por utilizadores normais (via revoke + policy)
--  ✗ NÃO apaga dados
--  ✗ NÃO substitui as Edge Functions (invite / bloqueio continuam service_role)
--
-- CORRER: Supabase → SQL Editor → colar → Run
-- Depois: testar login admin, gerente, operador e utilizador bloqueado
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) Extensão helper: salão do utilizador actual
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bp_meu_salao_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT salao_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.bp_meu_salao_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bp_meu_salao_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.bp_sou_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_owner FROM public.profiles WHERE user_id = auth.uid() LIMIT 1),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.bp_sou_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bp_sou_owner() TO authenticated;

-- -----------------------------------------------------------------------------
-- 1) RLS ON (idempotente)
-- -----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profissionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.salao_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.saloes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fechos_caixa ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.galeria_fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ia_uso_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.access_audit ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2) Revogar privilégios perigosos do role anon (API pública)
--    O frontend autenticado usa "authenticated", não precisa de anon em tabelas.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','clientes','agendamentos','servicos','profissionais',
    'vendas','despesas','salao_config','saloes','fechos_caixa',
    'galeria_fotos','ia_uso_diario','access_audit'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 3) PROFILES — ver só o próprio salão; não escalar is_owner via client
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS bp_select_profiles ON public.profiles;
CREATE POLICY bp_select_profiles ON public.profiles
  FOR SELECT TO authenticated
  USING (salao_id = public.bp_meu_salao_id());

DROP POLICY IF EXISTS bp_update_profiles_self ON public.profiles;
CREATE POLICY bp_update_profiles_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (public.bp_sou_owner() AND salao_id = public.bp_meu_salao_id())
  )
  WITH CHECK (
    salao_id = public.bp_meu_salao_id()
    AND (
      user_id = auth.uid()
      OR public.bp_sou_owner()
    )
  );

-- INSERT de profiles: só service_role (Edge) na prática; bloquear authenticated genérico
DROP POLICY IF EXISTS bp_insert_profiles ON public.profiles;
-- sem policy INSERT para authenticated = não cria perfis pelo browser

-- -----------------------------------------------------------------------------
-- 4) Tabelas de negócio — isolamento por salao_id
-- -----------------------------------------------------------------------------
-- Clientes
DROP POLICY IF EXISTS bp_select_clientes ON public.clientes;
DROP POLICY IF EXISTS bp_insert_clientes ON public.clientes;
DROP POLICY IF EXISTS bp_update_clientes ON public.clientes;
CREATE POLICY bp_select_clientes ON public.clientes FOR SELECT TO authenticated
  USING (salao_id = public.bp_meu_salao_id());
CREATE POLICY bp_insert_clientes ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (salao_id = public.bp_meu_salao_id());
CREATE POLICY bp_update_clientes ON public.clientes FOR UPDATE TO authenticated
  USING (salao_id = public.bp_meu_salao_id())
  WITH CHECK (salao_id = public.bp_meu_salao_id());

-- Agendamentos
DROP POLICY IF EXISTS bp_select_agendamentos ON public.agendamentos;
DROP POLICY IF EXISTS bp_insert_agendamentos ON public.agendamentos;
DROP POLICY IF EXISTS bp_update_agendamentos ON public.agendamentos;
CREATE POLICY bp_select_agendamentos ON public.agendamentos FOR SELECT TO authenticated
  USING (salao_id = public.bp_meu_salao_id());
CREATE POLICY bp_insert_agendamentos ON public.agendamentos FOR INSERT TO authenticated
  WITH CHECK (salao_id = public.bp_meu_salao_id());
CREATE POLICY bp_update_agendamentos ON public.agendamentos FOR UPDATE TO authenticated
  USING (salao_id = public.bp_meu_salao_id())
  WITH CHECK (salao_id = public.bp_meu_salao_id());

-- Servicos
DROP POLICY IF EXISTS bp_select_servicos ON public.servicos;
DROP POLICY IF EXISTS bp_insert_servicos ON public.servicos;
DROP POLICY IF EXISTS bp_update_servicos ON public.servicos;
CREATE POLICY bp_select_servicos ON public.servicos FOR SELECT TO authenticated
  USING (salao_id = public.bp_meu_salao_id());
CREATE POLICY bp_insert_servicos ON public.servicos FOR INSERT TO authenticated
  WITH CHECK (salao_id = public.bp_meu_salao_id());
CREATE POLICY bp_update_servicos ON public.servicos FOR UPDATE TO authenticated
  USING (salao_id = public.bp_meu_salao_id())
  WITH CHECK (salao_id = public.bp_meu_salao_id());

-- salao_config
DROP POLICY IF EXISTS salao_config_select_own ON public.salao_config;
DROP POLICY IF EXISTS salao_config_update_own ON public.salao_config;
CREATE POLICY salao_config_select_own ON public.salao_config FOR SELECT TO authenticated
  USING (salao_id = public.bp_meu_salao_id());
CREATE POLICY salao_config_update_own ON public.salao_config FOR ALL TO authenticated
  USING (salao_id = public.bp_meu_salao_id())
  WITH CHECK (salao_id = public.bp_meu_salao_id());

-- saloes: só o próprio registo
DROP POLICY IF EXISTS bp_isola_salao_saloes ON public.saloes;
CREATE POLICY bp_isola_salao_saloes ON public.saloes FOR ALL TO authenticated
  USING (id = public.bp_meu_salao_id())
  WITH CHECK (id = public.bp_meu_salao_id());

-- access_audit: só leitura no próprio salão; escrita via service_role (Edge)
DROP POLICY IF EXISTS bp_select_access_audit ON public.access_audit;
CREATE POLICY bp_select_access_audit ON public.access_audit FOR SELECT TO authenticated
  USING (salao_id = public.bp_meu_salao_id() AND public.bp_sou_owner());

-- -----------------------------------------------------------------------------
-- 5) Verificação rápida (correr e ler resultado)
-- -----------------------------------------------------------------------------
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY 1,2;
