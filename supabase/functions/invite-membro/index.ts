// BeautyPro F6.2 — invite-membro (pós-auditoria)
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
    console.error("actorProf", actorErr);
    return json(500, { error: "Não foi possível validar a sua conta. Tente mais tarde." });
  }
  if (!actorProf) return json(403, { error: "Perfil não encontrado." });
  if (actorProf.bloqueado || actorProf.ativo === false) {
    return json(403, { error: "A sua conta não tem permissão para esta operação." });
  }
  if (actorProf.is_owner !== true) {
    return json(403, { error: "Apenas o proprietário da organização pode convidar membros." });
  }
  if (!actorProf.salao_id) return json(403, { error: "Organização não associada." });

  let body: { email?: string; nome?: string; role?: string; password?: string } = {};
  try { body = await req.json(); } catch { body = {}; }

  const email = String(body.email || "").trim().toLowerCase();
  const nome = String(body.nome || "").trim() || (email.includes("@") ? email.split("@")[0] : "");
  const role = String(body.role || "operador").trim();
  const explicitPass = String(body.password || "").trim();

  if (!email || !email.includes("@")) return json(400, { error: "Indique um email válido." });
  if (role !== "gerente" && role !== "operador") {
    return json(400, { error: "Papel inválido. Use gerente ou operador." });
  }
  if (explicitPass && explicitPass.length < 8) {
    return json(400, { error: "A palavra-passe inicial deve ter pelo menos 8 caracteres." });
  }

  const password = explicitPass || `Bp${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}!x`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome, full_name: nome, salao_id: actorProf.salao_id },
  });

  if (createErr || !created?.user) {
    const msg = createErr?.message || "";
    const friendly = /already|registered|exists/i.test(msg)
      ? "Este email já tem conta. Use outro email."
      : "Não foi possível criar a conta.";
    console.error(createErr);
    return json(400, { error: friendly });
  }

  const newUserId = created.user.id;
  const cleanupAuth = async () => {
    try { await admin.auth.admin.deleteUser(newUserId); } catch (e) { console.error("cleanupAuth", e); }
  };

  const { data: existingProf, error: existErr } = await admin
    .from("profiles")
    .select("id, salao_id")
    .eq("user_id", newUserId)
    .maybeSingle();

  if (existErr) {
    console.error(existErr);
    await cleanupAuth();
    return json(500, { error: "Falha ao verificar perfil. A conta foi revertida." });
  }

  if (existingProf?.salao_id && existingProf.salao_id !== actorProf.salao_id) {
    await cleanupAuth();
    return json(409, { error: "Este utilizador já pertence a outra organização. A conta criada foi revertida." });
  }

  if (!existingProf) {
    const { error: profErr } = await admin.from("profiles").insert({
      user_id: newUserId,
      salao_id: actorProf.salao_id,
      nome,
      role,
      email,
      ativo: true,
      bloqueado: false,
      is_owner: false,
    });
    if (profErr) {
      console.error(profErr);
      await cleanupAuth();
      return json(500, { error: "Não foi possível criar o perfil. A conta foi revertida." });
    }
  }

  let audit_ok = true;
  const { error: auditErr } = await admin.from("access_audit").insert({
    salao_id: actorProf.salao_id,
    actor_user_id: actor.id,
    target_user_id: newUserId,
    acao: "invite_membro",
    detalhe: { email, role, nome, password_mode: explicitPass ? "owner_set" : "generated_internal" },
  });
  if (auditErr) {
    audit_ok = false;
    console.error("audit", auditErr);
  }

  let recovery_sent = false;
  if (!explicitPass) {
    try {
      const site = Deno.env.get("BP_SITE_URL") || "https://tatilson.vercel.app";
      const { error: recErr } = await admin.auth.resetPasswordForEmail(email, {
        redirectTo: `${site.replace(/\/$/, "")}/?bp_recovery=1`,
      });
      recovery_sent = !recErr;
      if (recErr) console.error("recovery", recErr);
    } catch (e) {
      console.error(e);
    }
  }

  return json(200, {
    ok: true,
    user_id: newUserId,
    email,
    role,
    nome,
    password_set_by_owner: !!explicitPass,
    recovery_sent,
    audit_ok,
    note: explicitPass
      ? "Membro criado. Pode entrar com o email e a palavra-passe definida por si."
      : recovery_sent
      ? "Membro criado. Foi enviado um email para definir a palavra-passe."
      : "Membro criado. Peça ao membro para usar Recuperar palavra-passe no ecrã de entrada.",
  });
});
