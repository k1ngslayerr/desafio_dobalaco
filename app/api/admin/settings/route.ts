import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: "Não autorizado", status: 401, supabase: null };

  const { data: row } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (row?.role !== "admin") return { error: "Acesso negado", status: 403, supabase: null };

  return { error: null, status: 200, supabase };
}

// GET /api/admin/settings – fetch app-wide settings
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // All authenticated users can read settings (group penalty is visible to all)
  const { data, error } = await supabase
    .from("app_settings")
    .select("group_penalty_text, group_penalty_active")
    .single();

  if (error) return NextResponse.json({ error: "Erro ao buscar configurações" }, { status: 500 });
  return NextResponse.json({ settings: data });
}

// PATCH /api/admin/settings – update group penalty
export async function PATCH(request: Request) {
  const { error, status, supabase } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Payload inválido" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (typeof body.group_penalty_text    === "string")  update.group_penalty_text    = body.group_penalty_text;
  if (typeof body.group_penalty_active  === "boolean") update.group_penalty_active  = body.group_penalty_active;
  if (!Object.keys(update).length) return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });

  update.updated_at = new Date().toISOString();

  const { error: dbError } = await supabase!
    .from("app_settings")
    .update(update)
    .eq("id", true); // single-row table

  if (dbError) return NextResponse.json({ error: "Erro ao salvar configurações" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
