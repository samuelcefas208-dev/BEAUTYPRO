// BeautyPro F6.2 — set-membro-bloqueio (pós-auditoria)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Não autenticado." });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: "Sessão inválida." });
  const actor = userData.user;

  const { data: actorProf, error: actorErr } = await admin
    .from("profiles")
    .select("salao_id, role, is_owner, bloqueado, ativo")
    .eq("user_id", actor.id)
    .maybeSingle();

  if (actorErr) {
    console.error(actorErr);
    return json(500, { error: "Não foi possível validar a sua conta. Tente mais tarde." });
  }
  if (!actorProf) return json(403, { error: "Perfil não encontrado." });
  if (actorProf.bloqueado || actorProf.ativo === false) {
    return json(403, { error: "A sua conta não tem permissão para esta operação." });
  }
  if (actorProf.is_owner !== true) {
    return json(403, {
      error: "Apenas o proprietário da organização pode suspender ou repor acessos.",
    });
  }
  if (!actorProf.salao_id) return json(403, { error: "Organização não associada." });

  let body: { target_user_id?: string; bloqueado?: boolean } = {};
  try { body = await req.json(); } catch { body = {}; }
  const targetId = String(body.target_user_id || "").trim();
  const bloqueado = !!body.bloqueado;
  if (!targetId) return json(400, { error: "Membro não indicado." });
  if (targetId === actor.id) {
    return json(400, { error: "Não pode suspender a sua própria conta de proprietário neste fluxo." });
  }

  const { data: target, error: targetErr } = await admin
    .from("profiles")
    .select("user_id, salao_id, role, is_owner, nome, email")
    .eq("user_id", targetId)
    .maybeSingle();

  if (targetErr) {
    console.error(targetErr);
    return json(500, { error: "Não foi possível carregar o membro. Tente mais tarde." });
  }
  if (!target || target.salao_id !== actorProf.salao_id) {
    return json(404, { error: "Membro não encontrado neste espaço." });
  }
  if (target.is_owner === true) {
    return json(403, {
      error: "O proprietário da organização não pode ter o acesso suspenso por outro utilizador.",
    });
  }

  const { data: salao, error: salaoErr } = await admin
    .from("saloes")
    .select("owner_user_id")
    .eq("id", actorProf.salao_id)
    .maybeSingle();

  if (salaoErr) {
    console.error(salaoErr);
    return json(500, { error: "Não foi possível validar a organização." });
  }
  if (salao?.owner_user_id && salao.owner_user_id === targetId) {
    return json(403, { error: "O proprietário registado do salão não pode ser suspenso." });
  }

  const patch = {
    bloqueado,
    bloqueado_em: bloqueado ? new Date().toISOString() : null,
    bloqueado_por: bloqueado ? actor.id : null,
  };

  const { error: upErr } = await admin.from("profiles").update(patch).eq("user_id", targetId);
  if (upErr) {
    console.error(upErr);
    return json(500, { error: "Não foi possível actualizar o acesso." });
  }

  let audit_ok = true;
  let audit_warning: string | null = null;
  const { error: auditErr } = await admin.from("access_audit").insert({
    salao_id: actorProf.salao_id,
    actor_user_id: actor.id,
    target_user_id: targetId,
    acao: bloqueado ? "bloquear_membro" : "desbloquear_membro",
    detalhe: { nome: target.nome, role: target.role, email: target.email },
  });
  if (auditErr) {
    audit_ok = false;
    audit_warning = auditErr.message || "audit_insert_failed";
    console.error("audit", auditErr);
  }

  return json(200, {
    ok: true,
    target_user_id: targetId,
    bloqueado,
    audit_ok,
    ...(audit_ok ? {} : { audit_warning }),
  });
});
