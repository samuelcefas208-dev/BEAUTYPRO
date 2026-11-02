// BeautyPro F5 — provision-empresa
// Deploy: supabase functions deploy provision-empresa --no-verify-jwt
// (JWT validado manualmente abaixo; ou deploy COM verify-jwt e sem validação extra)
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (automáticos no hosted)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Cliente com JWT do utilizador — valida sessão
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida ou expirada." }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    let body: { empresa?: string; nif_bi?: string | null } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const empresa = String(body.empresa || "").trim();
    const nifBi = body.nif_bi ? String(body.nif_bi).trim() : null;
    if (!empresa || empresa.length < 2) {
      return new Response(JSON.stringify({ error: "Indique o nome da empresa ou organização." }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Admin client (service role) — bypass RLS de forma controlada
    const admin = createClient(supabaseUrl, serviceKey);

    // Já tem profile?
    const { data: existing } = await admin
      .from("profiles")
      .select("id, salao_id, role, nome")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing && existing.salao_id) {
      return new Response(
        JSON.stringify({
          ok: true,
          already: true,
          salao_id: existing.salao_id,
          role: existing.role,
          nome: existing.nome,
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const salaoId = crypto.randomUUID();
    const displayNome = empresa.slice(0, 120);

    const { error: salaoErr } = await admin.from("saloes").insert({
      id: salaoId,
      nome: displayNome,
    });
    if (salaoErr) {
      console.error("saloes insert", salaoErr);
      return new Response(JSON.stringify({ error: "Não foi possível criar a organização." }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { error: profErr } = await admin.from("profiles").insert({
      user_id: user.id,
      salao_id: salaoId,
      nome: displayNome,
      role: "admin",
      email: user.email || null,
    });
    if (profErr) {
      console.error("profiles insert", profErr);
      // compensação mínima
      await admin.from("saloes").delete().eq("id", salaoId);
      return new Response(JSON.stringify({ error: "Não foi possível associar o perfil." }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // salao_config (ignorar se já existir / colunas em falta)
    try {
      await admin.from("salao_config").upsert({
        salao_id: salaoId,
        plano: "trial",
        trial_inicio: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("salao_config", e);
    }

    // metadata opcional no user (não crítico)
    try {
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...(user.user_metadata || {}),
          empresa: displayNome,
          nif_bi: nifBi,
          salao_id: salaoId,
        },
      });
    } catch (_) {}

    return new Response(
      JSON.stringify({
        ok: true,
        already: false,
        salao_id: salaoId,
        role: "admin",
        nome: displayNome,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Erro interno de provisionamento." }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
