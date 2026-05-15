import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// GET /api/challenges/scheduled
// Returns active challenges whose starts_at is in the future (agenda view).
// Uses the admin client to bypass RLS, which filters out future challenges for regular users.
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const todayStr = new Date().toISOString().split("T")[0];

  const adminClient = await createAdminClient();
  const { data, error: dbError } = await adminClient
    .from("challenges")
    .select("id, title, description, xp_reward, frequency, weekly_target, starts_at, ends_at")
    .eq("is_active", true)
    .gt("starts_at", todayStr)
    .order("starts_at", { ascending: true });

  return NextResponse.json({
    challenges: data ?? [],
    _debug: { todayStr, count: data?.length ?? 0, error: dbError?.message ?? null },
  });
}
