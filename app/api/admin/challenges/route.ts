import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminLimiter } from "@/lib/rate-limit";
import { challengeSchema } from "@/lib/validators";

async function requireAdmin(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: "Não autorizado", status: 401, supabase: null, user: null };

  const { data: row } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (row?.role !== "admin") return { error: "Acesso negado", status: 403, supabase: null, user: null };

  return { error: null, status: 200, supabase, user };
}

// GET /api/admin/challenges – list all challenges (including inactive)
export async function GET(request: Request) {
  const { error, status, supabase } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const { data, error: dbError } = await supabase!
    .from("challenges")
    .select("*")
    .order("created_at", { ascending: false });

  if (dbError) return NextResponse.json({ error: "Erro ao buscar desafios" }, { status: 500 });
  return NextResponse.json({ challenges: data });
}

// Day abbreviations (Sunday=0 … Saturday=6, matching Date.getUTCDay())
const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// POST /api/admin/challenges – create challenge(s)
//
// When frequency === "daily" AND both starts_at and ends_at are provided and
// span more than one day, the API auto-expands the range into one challenge
// per day, appending the day abbreviation to the title (e.g. "Leitura - Seg").
// Single-day and weekly/streak challenges are created as one row as before.
export async function POST(request: Request) {
  const { error, status, supabase, user } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const { success: rateOk } = await adminLimiter.limit(user!.id);
  if (!rateOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = challengeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { frequency, starts_at, ends_at, title } = parsed.data;

  // ── Multi-day daily challenge → auto-expand ──────────────────────────────
  if (frequency === "daily" && starts_at && ends_at && starts_at < ends_at) {
    // Safety cap: refuse absurd ranges
    const msPerDay = 86_400_000;
    const spanDays = (new Date(ends_at).getTime() - new Date(starts_at).getTime()) / msPerDay + 1;
    if (spanDays > 31) {
      return NextResponse.json({ error: "Intervalo máximo: 31 dias" }, { status: 400 });
    }

    const rows: Record<string, unknown>[] = [];
    let cur = new Date(starts_at + "T12:00:00Z");
    const end = new Date(ends_at + "T12:00:00Z");

    while (cur <= end) {
      const dayStr  = cur.toISOString().split("T")[0];
      const dayName = DAY_LABELS[cur.getUTCDay()];
      rows.push({
        ...parsed.data,
        title:      `${title} - ${dayName}`,
        starts_at:  dayStr,
        ends_at:    dayStr,
        created_by: user!.id,
      });
      cur = new Date(cur.getTime() + msPerDay);
    }

    const { data, error: dbError } = await supabase!
      .from("challenges")
      .insert(rows)
      .select();

    if (dbError) return NextResponse.json({ error: "Erro ao criar desafios" }, { status: 500 });
    return NextResponse.json({ challenges: data, count: data?.length }, { status: 201 });
  }

  // ── Single challenge (weekly, streak, or single-day daily) ───────────────
  const { data, error: dbError } = await supabase!
    .from("challenges")
    .insert({ ...parsed.data, created_by: user!.id })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: "Erro ao criar desafio" }, { status: 500 });
  return NextResponse.json({ challenge: data, count: 1 }, { status: 201 });
}
