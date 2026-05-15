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

// GET /api/admin/excuses?week_start=YYYY-MM-DD
// Returns all excuses for the given week (or current week if not specified).
// Accessible to all authenticated users so the weekly page can read excuses.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const weekStartParam = searchParams.get("week_start");

  // Default to current week Monday in app timezone (matches submissions)
  let weekStart: string;
  if (weekStartParam && /^\d{4}-\d{2}-\d{2}$/.test(weekStartParam)) {
    weekStart = weekStartParam;
  } else {
    const { appWeekStartStr } = await import("@/lib/date");
    weekStart = appWeekStartStr();
  }
  const [wsy, wsm, wsd] = weekStart.split("-").map(Number);
  const weekEnd = new Date(Date.UTC(wsy, wsm - 1, wsd));
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const weekEndStr =
    `${weekEnd.getUTCFullYear()}-${String(weekEnd.getUTCMonth() + 1).padStart(2, "0")}-${String(weekEnd.getUTCDate()).padStart(2, "0")}`;

  const { data, error: dbError } = await supabase
    .from("user_excuses")
    .select("id, user_id, excuse_date, reason")
    .gte("excuse_date", weekStart)
    .lte("excuse_date", weekEndStr)
    .order("excuse_date");

  if (dbError) return NextResponse.json({ error: "Erro ao buscar atestados" }, { status: 500 });
  return NextResponse.json({ excuses: data ?? [] });
}

const createSchema = z.object({
  user_id: z.string().uuid(),
  excuse_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).optional(),
});

// POST /api/admin/excuses – create an excuse for a user on a specific date
export async function POST(request: Request) {
  const { error, status, supabase, adminUser } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  // [SECURITY] Rate limit by admin user id
  const { success: rateOk } = await adminLimiter.limit(adminUser!.id);
  if (!rateOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const { data, error: dbError } = await supabase!
    .from("user_excuses")
    .insert({
      user_id: parsed.data.user_id,
      excuse_date: parsed.data.excuse_date,
      reason: parsed.data.reason ?? null,
      created_by: adminUser!.id,
    })
    .select()
    .single();

  if (dbError) {
    // Unique violation = excuse already exists for that user+date
    if (dbError.code === "23505") {
      return NextResponse.json({ error: "Atestado já existe para esta data" }, { status: 409 });
    }
    return NextResponse.json({ error: "Erro ao criar atestado" }, { status: 500 });
  }

  return NextResponse.json({ excuse: data }, { status: 201 });
}

// DELETE /api/admin/excuses?id=UUID – remove a specific excuse
export async function DELETE(request: Request) {
  const { error, status, supabase, adminUser } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  // [SECURITY] Rate limit by admin user id
  const { success: rateOk } = await adminLimiter.limit(adminUser!.id);
  if (!rateOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  // [SECURITY] Validate UUID shape to avoid garbage queries
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const { error: dbError } = await supabase!
    .from("user_excuses")
    .delete()
    .eq("id", id);

  if (dbError) return NextResponse.json({ error: "Erro ao remover atestado" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
