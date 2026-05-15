import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reactionLimiter } from "@/lib/rate-limit";
import { reactionSchema } from "@/lib/validators";

// POST /api/reactions – create or update a reaction (upsert)
export async function POST(request: Request) {
  const supabase = await createClient();

  // [SECURITY] Validate session
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // [SECURITY] Rate limit by user ID
  const { success: rateOk } = await reactionLimiter.limit(user.id);
  if (!rateOk) {
    return NextResponse.json({ error: "Muitas reações. Aguarde um momento." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = reactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { submission_id, type } = parsed.data;

  // Verify submission exists, and that the user is not the author.
  // [SECURITY] Block self-reactions server-side (client UI also disables this,
  //  but a direct API call would otherwise let users inflate their own scores).
  const { data: sub } = await supabase
    .from("submissions")
    .select("id, user_id")
    .eq("id", submission_id)
    .maybeSingle();

  if (!sub) {
    return NextResponse.json({ error: "Submission não encontrada" }, { status: 404 });
  }
  if (sub.user_id === user.id) {
    return NextResponse.json(
      { error: "Você não pode reagir à própria submissão" },
      { status: 403 }
    );
  }

  // Upsert: if reaction exists for this user+submission, update type
  const { data, error } = await supabase
    .from("reactions")
    .upsert(
      { submission_id, user_id: user.id, type },
      { onConflict: "submission_id,user_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Erro ao salvar reação" }, { status: 500 });
  }

  return NextResponse.json({ reaction: data });
}

// DELETE /api/reactions?submission_id=...
export async function DELETE(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const submissionId = searchParams.get("submission_id");

  if (!submissionId) {
    return NextResponse.json({ error: "submission_id é obrigatório" }, { status: 400 });
  }

  await supabase
    .from("reactions")
    .delete()
    .eq("submission_id", submissionId)
    .eq("user_id", user.id);

  return NextResponse.json({ success: true });
}
