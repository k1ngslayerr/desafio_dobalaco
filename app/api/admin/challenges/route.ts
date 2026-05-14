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

// POST /api/admin/challenges – create challenge
export async function POST(request: Request) {
  const { error, status, supabase, user } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const { success: rateOk } = await adminLimiter.limit(user!.id);
  if (!rateOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = challengeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error: dbError } = await supabase!
    .from("challenges")
    .insert({ ...parsed.data, created_by: user!.id })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: "Erro ao criar desafio" }, { status: 500 });
  return NextResponse.json({ challenge: data }, { status: 201 });
}
