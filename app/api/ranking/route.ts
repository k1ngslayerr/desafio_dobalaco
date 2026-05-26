import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { appWeekStartStr } from "@/lib/date";

// GET /api/ranking – top 100 users by XP, with art_tier and weekly XP resolved.
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
    // [SECURITY] Only public-safe fields. Filter to active users only — suspended
    // users are removed from the group and should not appear in the ranking.
    .select("id, username, full_name, avatar_url, xp, level, current_penalty")
    .eq("status", "active")
    .order("xp", { ascending: false })
    .limit(100);

  if (usersError) {
    console.error("[/api/ranking] users error:", usersError.message);
    return NextResponse.json({ error: "Erro ao buscar ranking" }, { status: 500 });
  }

  // Bulk-fetch art tiers, submission counts, and weekly XP in parallel
  const levels = Array.from(new Set((users ?? []).map((u) => u.level)));
  const userIds = (users ?? []).map((u) => u.id);
  const weekStart = appWeekStartStr();

  const [{ data: levelRows }, { data: subRows }, { data: weeklyRows }] = await Promise.all([
    levels.length
      ? supabase.from("level_config").select("level, art_tier").in("level", levels)
      : Promise.resolve({ data: [] as Array<{ level: number; art_tier: number }> }),
    // Count approved and contested submissions per user — single query, aggregate in JS
    userIds.length
      ? supabase
          .from("submissions")
          .select("user_id, status")
          .in("user_id", userIds)
          .in("status", ["approved", "contested"])
      : Promise.resolve({ data: [] as Array<{ user_id: string; status: string }> }),
    // Weekly XP: sum xp_awarded from approved submissions since week start
    userIds.length
      ? supabase
          .from("submissions")
          .select("user_id, xp_awarded")
          .in("user_id", userIds)
          .eq("status", "approved")
          .gte("submitted_date", weekStart)
      : Promise.resolve({ data: [] as Array<{ user_id: string; xp_awarded: number }> }),
  ]);

  const tierMap      = new Map((levelRows ?? []).map((l) => [l.level, l.art_tier]));
  const approvedMap  = new Map<string, number>();
  const contestedMap = new Map<string, number>();
  for (const s of subRows ?? []) {
    if (s.status === "approved") {
      approvedMap.set(s.user_id, (approvedMap.get(s.user_id) ?? 0) + 1);
    } else {
      contestedMap.set(s.user_id, (contestedMap.get(s.user_id) ?? 0) + 1);
    }
  }

  const weeklyXpMap = new Map<string, number>();
  for (const s of weeklyRows ?? []) {
    weeklyXpMap.set(s.user_id, (weeklyXpMap.get(s.user_id) ?? 0) + (s.xp_awarded ?? 0));
  }

  const ranking = (users ?? []).map((u) => ({
    ...u,
    art_tier:        tierMap.get(u.level)      ?? 1,
    approvedCount:   approvedMap.get(u.id)     ?? 0,
    contestedCount:  contestedMap.get(u.id)    ?? 0,
    weeklyXp:        weeklyXpMap.get(u.id)     ?? 0,
    current_penalty: u.current_penalty         ?? null,
  }));

  return NextResponse.json({ ranking, weekStart });
}
