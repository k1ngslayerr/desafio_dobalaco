import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";

// GET /api/submissions/[id] – fetch a single submission with user + reactions.
// Used by the realtime feed when a new submission arrives: the browser
// Supabase client cannot resolve the `user:users!user_id(...)` join because
// the `users` SELECT policy is restricted to the authenticated role and the
// browser client effectively runs as anon (auth cookies are httpOnly).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  // Admin client bypasses RLS so we can resolve the embedded user join
  // regardless of the caller's role.
  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("submissions")
    .select(
      `id, photo_url, title, description, status, xp_awarded, created_at, challenge_id,
       user:users!user_id(id, username, avatar_url),
       challenge:challenges(title, xp_reward),
       reactions(type, user_id)`
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[/api/submissions/:id] db error:", error.message);
    return NextResponse.json({ error: "Erro ao buscar submission" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
  }

  return NextResponse.json({ submission: data });
}
