import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/feed?before=<ISO>&limit=<n>
//
// Returns the most recent submissions from all users, newest first.
// Cursor-based pagination: pass `before` (created_at of the oldest item in
// the current page) to fetch the next page.
//
// The server-side Supabase client runs as `authenticated` (session cookies
// are forwarded), so the users join resolves correctly against the
// "users: authenticated can read" RLS policy.
export async function GET(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const before = searchParams.get("before");
  const limit  = Math.min(Math.max(1, Number(searchParams.get("limit") ?? "10")), 20);

  // Fetch limit+1 rows so we can detect whether there are more pages
  let query = supabase
    .from("submissions")
    .select(`
      id, photo_url, title, description, status, xp_awarded, created_at,
      user:users!user_id(id, username, avatar_url),
      challenge:challenges(title, xp_reward),
      reactions(type, user_id)
    `)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Erro ao carregar feed" }, { status: 500 });
  }

  const rows   = data ?? [];
  const hasMore = rows.length > limit;
  const page   = rows.slice(0, limit);

  const submissions = page.map((s) => ({
    id:         s.id,
    photo_url:  s.photo_url,
    title:      s.title,
    description: s.description,
    status:     s.status,
    xp_awarded: s.xp_awarded,
    created_at: s.created_at,
    user:       s.user,
    challenge:  s.challenge,
    reactions: {
      positive: (s.reactions as Array<{ type: string }>).filter((r) => r.type === "positive").length,
      negative: (s.reactions as Array<{ type: string }>).filter((r) => r.type === "negative").length,
    },
    userReaction:
      (s.reactions as Array<{ type: string; user_id: string }>)
        .find((r) => r.user_id === user.id)?.type ?? null,
    currentUserId: user.id,
  }));

  return NextResponse.json({ submissions, hasMore });
}
