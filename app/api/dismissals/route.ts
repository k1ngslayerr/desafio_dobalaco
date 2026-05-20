import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { submissionLimiter } from "@/lib/rate-limit";
import { z } from "zod";

// POST /api/dismissals
// Body: { challenge_id: <uuid> }
// Inserts a user_dismissals row so the challenge is hidden for this user.
const dismissalSchema = z.object({
  challenge_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // [SECURITY] Rate limit to prevent dismissal spam (could otherwise be used
  // to flood the DB with junk rows for fake challenge IDs, or cause excessive
  // queries on every challenges page load).
  const { success: rateOk } = await submissionLimiter.limit(`dismiss:${user.id}`);
  if (!rateOk) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um momento." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  // [SECURITY] Strict UUID validation — without this, arbitrary strings hit
  // the DB just for the FK to reject them, wasting load and producing noise.
  const parsed = dismissalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "challenge_id inválido" }, { status: 400 });
  }

  // Upsert — safe to call multiple times. RLS policy on user_dismissals
  // already enforces user_id = auth.uid().
  const { error } = await supabase
    .from("user_dismissals")
    .upsert(
      { user_id: user.id, challenge_id: parsed.data.challenge_id },
      { onConflict: "user_id,challenge_id" }
    );

  if (error) {
    console.error("[dismissals] upsert error:", error.message);
    return NextResponse.json({ error: "Erro ao registrar dismissal" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
