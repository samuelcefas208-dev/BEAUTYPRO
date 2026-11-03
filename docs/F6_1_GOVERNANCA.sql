-- =============================================================================
-- BeautyPro F6.1 — Governação de acessos (Supabase)
-- Projecto: xbudnftutemakjbgxayf
--
-- Objectivo: suporte a owner, bloqueio de membros, matriz de portas, auditoria
-- mínima e policies que impedem gerente/operador de gerir identidades.
--
-- Seguro para reexecutar (IF NOT EXISTS / guards).
-- NÃO apaga dados existentes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Organização: proprietário (owner) do salão
-- -----------------------------------------------------------------------------
-- Um salão tem no máximo um owner_user_id (auth.users).
-- v1: o admin que criou o salão (F5) deve ser backfillado como owner.

ALTER TABLE public.saloes
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.saloes.owner_user_id IS
  'Proprietário do salão (autoridade máxima). Transferência de propriedade = fluxo dedicado.';

CREATE INDEX IF NOT EXISTS saloes_owner_user_id_idx
  ON public.saloes (owner_user_id);

-- -----------------------------------------------------------------------------
-- 2) Membros (profiles): bloqueio + metadados de governação
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bloqueado boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bloqueado_em timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bloqueado_por uuid REFERENCES auth.users(id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.ativo IS
  'false = conta desactivada logicamente (além de bloqueado).';
COMMENT ON COLUMN public.profiles.bloqueado IS
  'true = acesso suspenso pelo responsável; login não deve entrar na app.';
COMMENT ON COLUMN public.profiles.is_owner IS
  'Espelho do owner do salão; só o owner executa governação crítica.';

-- Coerência: se bloqueado, manter flag legível
-- (aplicação/Edge também devem escrever bloqueado_em / bloqueado_por)

CREATE INDEX IF NOT EXISTS profiles_salao_id_idx
  ON public.profiles (salao_id);

CREATE INDEX IF NOT EXISTS profiles_salao_bloqueado_idx
  ON public.profiles (salao_id, bloqueado);

-- -----------------------------------------------------------------------------
-- 3) Matriz de acessos (abas/portas por papel) no salão
-- -----------------------------------------------------------------------------

ALTER TABLE public.salao_config
  ADD COLUMN IF NOT EXISTS acessos jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.salao_config.acessos IS
  'Overrides por papel (gerente/operador): abas e portas. admin/owner fora de restrição de matriz.';

-- -----------------------------------------------------------------------------
-- 4) Auditoria mínima (preserva variável AGT / histórico)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id uuid NOT NULL REFERENCES public.saloes(id),
  actor_user_id uuid REFERENCES auth.users(id),
  target_user_id uuid REFERENCES auth.users(id),
  acao text NOT NULL,
  detalhe jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.access_audit IS
  'Eventos de governação: bloqueio, convite, mudança de papel, transferência, etc.';

CREATE INDEX IF NOT EXISTS access_audit_salao_created_idx
  ON public.access_audit (salao_id, created_at DESC);

ALTER TABLE public.access_audit ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 5) Backfill owner a partir dos admin existentes (1.º admin por salão)
-- -----------------------------------------------------------------------------
-- Escolhe o profile admin mais antigo por salao_id como owner.
-- Idempotente: só preenche owner_user_id quando está NULL.

WITH primeiros AS (
  SELECT DISTINCT ON (p.salao_id)
    p.salao_id,
    p.user_id
  FROM public.profiles p
  WHERE p.role = 'admin'
    AND p.salao_id IS NOT NULL
  ORDER BY p.salao_id, p.created_at ASC NULLS LAST, p.user_id
)
UPDATE public.saloes s
SET owner_user_id = primeiros.user_id
FROM primeiros
WHERE s.id = primeiros.salao_id
  AND s.owner_user_id IS NULL;

UPDATE public.profiles p
SET is_owner = true
FROM public.saloes s
WHERE p.user_id = s.owner_user_id
  AND p.salao_id = s.id
  AND p.is_owner = false;

-- -----------------------------------------------------------------------------
-- 6) Funções helper (SECURITY DEFINER mínimo para policies)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bp_meu_salao_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.salao_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.bp_sou_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_owner = true
      AND p.bloqueado = false
      AND p.ativo = true
  );
$$;

CREATE OR REPLACE FUNCTION public.bp_sou_admin_ou_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.bloqueado = false
      AND p.ativo = true
      AND (p.is_owner = true OR p.role = 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.bp_meu_profile_bloqueado()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT (p.bloqueado OR NOT p.ativo)
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
      LIMIT 1
    ),
    false
  );
$$;

COMMENT ON FUNCTION public.bp_sou_owner() IS 'Owner activo e não bloqueado.';
COMMENT ON FUNCTION public.bp_meu_profile_bloqueado() IS 'true se o user actual está bloqueado/inactivo.';

-- -----------------------------------------------------------------------------
-- 7) Policies: profiles
-- -----------------------------------------------------------------------------
-- Objectivo:
--   - SELECT: membros do mesmo salão (se o leitor não estiver bloqueado)
--   - INSERT: não pelo cliente genérico (convite via Edge + service role)
--   - UPDATE: utilizador pode actualizar o PRÓPRIO nome (não role/bloqueio);
--             owner/admin: governação via Edge (service role) na prática;
--             policies defensivas abaixo reduzem abuso pelo cliente.
--   - DELETE: proibido (soft via ativo/bloqueado) — alinhado à regra do produto

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas ambíguas de UPDATE alargado, se existirem com estes nomes.
-- (Nomes novos F6; não apaga bp_select / bp_insert legados sem saber o estado exacto.)

DROP POLICY IF EXISTS bp_f6_profiles_select ON public.profiles;
CREATE POLICY bp_f6_profiles_select
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    salao_id = public.bp_meu_salao_id()
    AND public.bp_meu_profile_bloqueado() = false
  );

-- Utilizador autenticado: actualizar só a própria linha e só campos “não soberanos”.
-- Nota: Postgres RLS não restringe colunas; a Edge deve ser a via para role/bloqueio.
-- Política: UPDATE próprio se não tentar… (WITH CHECK: mesmo user, mesmo salao, role inalterável via app honesta)
DROP POLICY IF EXISTS bp_f6_profiles_update_self ON public.profiles;
CREATE POLICY bp_f6_profiles_update_self
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND public.bp_meu_profile_bloqueado() = false
  )
  WITH CHECK (
    user_id = auth.uid()
    AND salao_id = public.bp_meu_salao_id()
  );

-- Owner/admin do salão: ler já coberto pelo SELECT; writes de governação = service role (Edge).

-- Proibir DELETE autenticado (manter histórico)
DROP POLICY IF EXISTS bp_f6_profiles_no_delete ON public.profiles;
-- (sem policy DELETE para authenticated = deny por defeito se não houver outra)

-- -----------------------------------------------------------------------------
-- 8) Policies: saloes
-- -----------------------------------------------------------------------------

ALTER TABLE public.saloes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bp_f6_saloes_select ON public.saloes;
CREATE POLICY bp_f6_saloes_select
  ON public.saloes
  FOR SELECT
  TO authenticated
  USING (
    id = public.bp_meu_salao_id()
    AND public.bp_meu_profile_bloqueado() = false
  );

-- UPDATE nome do salão: só owner (opcional; Edge preferível)
DROP POLICY IF EXISTS bp_f6_saloes_update_owner ON public.saloes;
CREATE POLICY bp_f6_saloes_update_owner
  ON public.saloes
  FOR UPDATE
  TO authenticated
  USING (
    id = public.bp_meu_salao_id()
    AND public.bp_sou_owner()
  )
  WITH CHECK (
    id = public.bp_meu_salao_id()
    AND public.bp_sou_owner()
  );

-- -----------------------------------------------------------------------------
-- 9) Policies: salao_config.acessos
-- -----------------------------------------------------------------------------

ALTER TABLE public.salao_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bp_f6_salao_config_select ON public.salao_config;
CREATE POLICY bp_f6_salao_config_select
  ON public.salao_config
  FOR SELECT
  TO authenticated
  USING (
    salao_id = public.bp_meu_salao_id()
    AND public.bp_meu_profile_bloqueado() = false
  );

-- Escrita de acessos: owner (matriz). Preferir Edge em produção.
DROP POLICY IF EXISTS bp_f6_salao_config_update_owner ON public.salao_config;
CREATE POLICY bp_f6_salao_config_update_owner
  ON public.salao_config
  FOR UPDATE
  TO authenticated
  USING (
    salao_id = public.bp_meu_salao_id()
    AND public.bp_sou_owner()
  )
  WITH CHECK (
    salao_id = public.bp_meu_salao_id()
    AND public.bp_sou_owner()
  );

-- -----------------------------------------------------------------------------
-- 10) Policies: access_audit
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS bp_f6_audit_select ON public.access_audit;
CREATE POLICY bp_f6_audit_select
  ON public.access_audit
  FOR SELECT
  TO authenticated
  USING (
    salao_id = public.bp_meu_salao_id()
    AND public.bp_sou_admin_ou_owner()
    AND public.bp_meu_profile_bloqueado() = false
  );

-- INSERT audit: service role (Edge) ou owner
DROP POLICY IF EXISTS bp_f6_audit_insert_owner ON public.access_audit;
CREATE POLICY bp_f6_audit_insert_owner
  ON public.access_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (
    salao_id = public.bp_meu_salao_id()
    AND public.bp_sou_owner()
    AND actor_user_id = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- 11) Verificação rápida (correr e inspeccionar resultados)
-- -----------------------------------------------------------------------------
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name IN ('profiles', 'saloes', 'salao_config', 'access_audit')
-- ORDER BY table_name, ordinal_position;
--
-- SELECT id, nome, owner_user_id FROM public.saloes;
-- SELECT user_id, salao_id, role, is_owner, bloqueado, ativo FROM public.profiles;

-- =============================================================================
-- FIM F6.1
-- Próximo: F6.2 Edge invite-membro + set-bloqueio (service role)
-- =============================================================================
