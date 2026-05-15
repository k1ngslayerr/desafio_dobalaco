import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { submissionLimiter, getClientIp } from "@/lib/rate-limit";
import { checkImageMime } from "@/lib/security/mime-check";
import { buildStoragePath } from "@/lib/security/sanitize";
import { z } from "zod";

const createSchema = z.object({
  challenge_id: z.string().uuid(),
  quantity: z.number().int().min(1).optional(),
});

// POST /api/submissions – create a new submission (photo optional per challenge config)
export async function POST(request: Request) {
  const supabase = await createClient();

  // [SECURITY] Validate JWT from httpOnly cookie
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // [SECURITY] Rate limit by user ID to prevent spam uploads
  const { success: rateOk } = await submissionLimiter.limit(user.id);
  if (!rateOk) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um momento." }, { status: 429 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const challengeIdRaw = formData.get("challenge_id");
  const file = formData.get("photo") as File | null;
  const quantityRaw = formData.get("quantity");

  // [SECURITY] Validate challenge_id and optional quantity
  const parsed = createSchema.safeParse({
    challenge_id: challengeIdRaw,
    quantity: quantityRaw ? Number(quantityRaw) : undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  // Compute today's date in UTC (consistent with DB DEFAULT CURRENT_DATE)
  const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // Fetch challenge to know its config
  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, is_active, requires_photo, frequency, weekly_target, quantity_label, xp_per_unit, xp_reward, max_quantity")
    .eq("id", parsed.data.challenge_id)
    .eq("is_active", true)
    .single();

  if (!challenge) {
    return NextResponse.json({ error: "Desafio não encontrado" }, { status: 404 });
  }

  // Validate photo requirement
  if (challenge.requires_photo && (!file || !(file instanceof File))) {
    return NextResponse.json({ error: "Foto é obrigatória para este desafio" }, { status: 400 });
  }

  // Validate quantity requirement
  if (challenge.quantity_label && !parsed.data.quantity) {
    return NextResponse.json({ error: `Informe a quantidade de ${challenge.quantity_label}` }, { status: 400 });
  }
  if (parsed.data.quantity && challenge.max_quantity && parsed.data.quantity > challenge.max_quantity) {
    return NextResponse.json({ error: `Quantidade máxima é ${challenge.max_quantity}` }, { status: 400 });
  }

  // Check for existing submission today (DB unique constraint on challenge_id+user_id+submitted_date)
  const { data: existing } = await supabase
    .from("submissions")
    .select("id")
    .eq("challenge_id", challenge.id)
    .eq("user_id", user.id)
    .eq("submitted_date", todayStr)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Você já enviou uma submissão para este desafio hoje" }, { status: 409 });
  }

  // Handle photo upload (if provided)
  let storagePath: string | null = null;

  if (file && file instanceof File) {
    // [SECURITY] Validate file size server-side (client validation is not sufficient)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Arquivo muito grande (máx 5 MB)" }, { status: 400 });
    }

    // [SECURITY] Read actual bytes and verify magic bytes, not just extension/Content-Type
    const buffer = await file.arrayBuffer();
    const mimeResult = await checkImageMime(buffer);
    if (!mimeResult.valid) {
      return NextResponse.json({ error: mimeResult.error ?? "Formato inválido" }, { status: 400 });
    }

    // [SECURITY] Upload with UUID filename to prevent path traversal
    storagePath = buildStoragePath(user.id, challenge.id, file.name);

    const adminClient = await createAdminClient();
    const { error: uploadError } = await adminClient.storage
      .from("submissions")
      .upload(storagePath, Buffer.from(buffer), {
        contentType: mimeResult.mime,
        upsert: false,
      });

    if (uploadError) {
      console.error("[submissions] upload error:", uploadError.message);
      return NextResponse.json({ error: "Erro no upload" }, { status: 500 });
    }
  }

  // Calculate XP for quantifiable challenges
  // If xp_per_unit is set, XP = min(quantity * xp_per_unit, xp_reward)
  // Otherwise XP is awarded by the approval trigger using xp_reward directly
  const xpAwarded = (challenge.xp_per_unit && parsed.data.quantity)
    ? Math.min(parsed.data.quantity * challenge.xp_per_unit, challenge.xp_reward)
    : null; // null = trigger will use xp_reward

  // [SECURITY] Bucket is private — store path, not publicUrl.
  // Signed URLs are generated on demand by the client via useSignedUrl().
  const insertPayload: Record<string, unknown> = {
    challenge_id: challenge.id,
    user_id: user.id,
    photo_url: storagePath,
    quantity: parsed.data.quantity ?? null,
    submitted_date: todayStr,
  };
  // Pass pre-calculated xp so the trigger can use it
  if (xpAwarded !== null) insertPayload.xp_awarded = xpAwarded;

  // Use admin client to bypass INSERT RLS — user_id is validated above from
  // the authenticated session, so this is safe.
  const adminInsert = await createAdminClient();
  const { data: submission, error: insertError } = await adminInsert
    .from("submissions")
    .insert(insertPayload)
    .select()
    .single();

  if (insertError) {
    console.error("[submissions] insert error:", insertError.message);
    // Cleanup orphaned upload
    if (storagePath) {
      await adminInsert.storage.from("submissions").remove([storagePath]);
    }
    return NextResponse.json({ error: "Erro ao salvar submission", detail: insertError.message }, { status: 500 });
  }

  // Auto-approve immediately so the DB trigger fires and awards XP right away.
  const adminClient = await createAdminClient();
  const { data: approved } = await adminClient
    .from("submissions")
    .update({ status: "approved" })
    .eq("id", submission.id)
    .select()
    .single();

  return NextResponse.json({ submission: approved ?? submission }, { status: 201 });
}
