import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/users/[username]
// Returns a user's public profile and their approved submissions.
// Authentication is required to resolve the current user's reactions.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const supabase = await createClient();
  const { data: { user: me } } = await supabase.auth.getUser();
  if (!me) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Fetch target user
  const { data: target } = await supabase
    .from("users")
    .select("id, username, full_name, avatar_url, xp, level")
    .eq("username", username)
    .single();

  if (!target) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  // Fetch level art tier + next-level threshold
  const [{ data: lvlData }, { data: nextLvl }, { data: subs }] = await Promise.all([
    supabase
      .from("level_config")
      .select("art_tier, xp_required")
      .eq("level", target.level)
      .single(),
    supabase
      .from("level_config")
      .select("xp_required")
      .eq("level", target.level + 1)
      .single(),
    supabase
      .from("submissions")
      .select(
        "id, photo_url, title, description, status, xp_awarded, created_at, " +
        "user:users!user_id(id, username, avatar_url), " +
        "challenge:challenges(title, xp_reward), " +
        "reactions(type, user_id, user:users!user_id(username, avatar_url))"
      )
      .eq("user_id", target.id)
      .eq("status", "approved")
      .order("created_at", { ascending: false }),
  ]);

  const currentThreshold = target.level > 1 ? Number(lvlData?.xp_required ?? 0) : 0;
  const nextThreshold    = Number(nextLvl?.xp_required ?? currentThreshold + 100);
  const levelXp  = Math.max(0, Number(target.xp) - currentThreshold);
  const levelGap = Math.max(1, nextThreshold - currentThreshold);

  return NextResponse.json({
    profile: {
      ...target,
      art_tier:  lvlData?.art_tier ?? 1,
      level_xp:  levelXp,
      next_xp:   levelGap,
    },
    submissions: subs ?? [],
    currentUserId: me.id,
  });
}
