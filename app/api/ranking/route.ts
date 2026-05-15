import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/ranking – top 100 users by XP, with art_tier resolved.
// [SECURITY] Requires an authenticated session. Browser client cannot read
// public.users directly because the auth cookie is httpOnly and the SELECT
// policy is restricted to the authenticated role.
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { data: users, error: usersError } = await supabase
    .from("users")
    // [SECURITY] Only public-safe fields
    .select("id, username, full_name, avatar_url, xp, level")
    .order("xp", { ascending: false })
    .limit(100);

  if (usersError) {
    console.error("[/api/ranking] users error:", usersError.message);
    return NextResponse.json({ error: "Erro ao buscar ranking" }, { status: 500 });
  }

  // Bulk-fetch art tiers so we avoid an N+1 round-trip on the client
  const levels = Array.from(new Set((users ?? []).map((u) => u.level)));
  const { data: levelRows } = levels.length
    ? await supabase.from("level_config").select("level, art_tier").in("level", levels)
    : { data: [] as Array<{ level: number; art_tier: number }> };

  const tierMap = new Map((levelRows ?? []).map((l) => [l.level, l.art_tier]));
  const ranking = (users ?? []).map((u) => ({
    ...u,
    art_tier: tierMap.get(u.level) ?? 1,
  }));

  return NextResponse.json({ ranking });
}
