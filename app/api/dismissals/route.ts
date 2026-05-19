import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/dismissals
// Body: { challenge_id: string }
// Inserts a user_dismissals row so the challenge is hidden for this user.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: { challenge_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const { challenge_id } = body;
  if (!challenge_id || typeof challenge_id !== "string") {
    return NextResponse.json({ error: "challenge_id obrigatório" }, { status: 400 });
  }

  // Upsert — safe to call multiple times
  const { error } = await supabase
    .from("user_dismissals")
    .upsert({ user_id: user.id, challenge_id }, { onConflict: "user_id,challenge_id" });

  if (error) {
    console.error("[dismissals] upsert error:", error);
    return NextResponse.json({ error: "Erro ao registrar dismissal" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
