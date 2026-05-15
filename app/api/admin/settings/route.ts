import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminLimiter } from "@/lib/rate-limit";
import { z } from "zod";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: "Não autorizado", status: 401, supabase: null, adminUser: null };

  const { data: row } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (row?.role !== "admin") return { error: "Acesso negado", status: 403, supabase: null, adminUser: null };

  return { error: null, status: 200, supabase, adminUser: user };
}

// [SECURITY] Strict schema bounds the payload size: a flat object with
// known fields. Rejects unknown keys and oversized text.
const settingsPatchSchema = z
  .object({
    group_penalty_text:   z.string().max(2000).optional(),
    group_penalty_active: z.boolean().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: "Nada para atualizar" });

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

  if (error) {
    console.error("[/api/admin/settings] read error:", error.message);
    return NextResponse.json({ error: "Erro ao buscar configurações" }, { status: 500 });
  }
  return NextResponse.json({ settings: data });
}

// PATCH /api/admin/settings – update group penalty
export async function PATCH(request: Request) {
  const { error, status, supabase, adminUser } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  // [SECURITY] Rate limit by admin user id
  const { success: rateOk } = await adminLimiter.limit(adminUser!.id);
  if (!rateOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = settingsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };

  const { error: dbError } = await supabase!
    .from("app_settings")
    .update(update)
    .eq("id", true); // single-row table

  if (dbError) {
    console.error("[/api/admin/settings] write error:", dbError.message);
    return NextResponse.json({ error: "Erro ao salvar configurações" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
