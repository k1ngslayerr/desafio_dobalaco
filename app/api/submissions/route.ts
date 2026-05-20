import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { submissionLimiter } from "@/lib/rate-limit";
import { checkImageMime } from "@/lib/security/mime-check";
import { buildStoragePath } from "@/lib/security/sanitize";
import { appDateStr, appYesterdayStr } from "@/lib/date";
import { z } from "zod";

const createSchema = z.object({
  challenge_id: z.string().uuid(),
  quantity: z.number().int().min(1).optional(),
  title: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
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
  const file  = formData.get("photo")  as File | null;
  const file2 = formData.get("photo2") as File | null;
  const quantityRaw = formData.get("quantity");
  const titleRaw = (formData.get("title") as string | null)?.trim() || null;
  const descriptionRaw = (formData.get("description") as string | null)?.trim() || null;

  // [SECURITY] Validate challenge_id and optional fields
  const parsed = createSchema.safeParse({
    challenge_id: challengeIdRaw,
    quantity: quantityRaw ? Number(quantityRaw) : undefined,
    title: titleRaw ?? undefined,
    description: descriptionRaw ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  // [SECURITY] Compute today's date in the app's timezone (BRT), NOT UTC.
  // The DB unique constraint on (challenge_id, user_id, submitted_date)
  // depends on this — if we used UTC, a user in BRT could submit twice
  // on the same local day (once before, once after UTC midnight) and
  // double-collect XP.
  const todayStr = appDateStr();

  // Fetch challenge to know its config
  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, is_active, requires_photo, frequency, weekly_target, quantity_label, xp_per_unit, xp_reward, max_quantity, ends_at")
    .eq("id", parsed.data.challenge_id)
    .eq("is_active", true)
    .single();

  if (!challenge) {
    return NextResponse.json({ error: "Desafio não encontrado" }, { status: 404 });
  }

  // [GRACE PERIOD] Allow submissions up to 1 day after ends_at so users can
  // post at the end of the day without being locked out at midnight.
  if (challenge.ends_at) {
    const yesterdayStr = appYesterdayStr();
    if (challenge.ends_at < yesterdayStr) {
      return NextResponse.json({ error: "Este desafio já encerrou" }, { status: 400 });
    }
  }

  // Validate photo requirement
  if (challenge.requires_photo && (!file || !(file instanceof File))) {
    return NextResponse.json({ error: "Foto é obrigatória para este desafio" }, { status: 400 });
  }

  // When photo is not required, title and description are mandatory
  if (!challenge.requires_photo) {
    if (!titleRaw) {
      return NextResponse.json({ error: "Título é obrigatório para este desafio" }, { status: 400 });
    }
    if (!descriptionRaw) {
      return NextResponse.json({ error: "Descrição é obrigatória para este desafio" }, { status: 400 });
    }
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

  // Handle photo upload(s) (both optional depending on challenge config)
  let storagePath:  string | null = null;
  let storagePath2: string | null = null;

  const adminUpload = await createAdminClient();

  async function uploadPhoto(f: File, label: string): Promise<{ path: string } | { error: string }> {
    if (f.size > 5 * 1024 * 1024) return { error: `${label}: arquivo muito grande (máx 5 MB)` };
    const buffer = await f.arrayBuffer();
    const mimeResult = await checkImageMime(buffer);
    if (!mimeResult.valid) return { error: mimeResult.error ?? `${label}: formato inválido` };
    const path = buildStoragePath(user.id, challenge.id, f.name);
    const { error: uploadError } = await adminUpload.storage
      .from("submissions")
      .upload(path, Buffer.from(buffer), { contentType: mimeResult.mime, upsert: false });
    if (uploadError) {
      console.error(`[submissions] ${label} upload error:`, uploadError.message);
      return { error: `Erro no upload da ${label}` };
    }
    return { path };
  }

  if (file && file instanceof File && file.size > 0) {
    const result = await uploadPhoto(file, "foto");
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    storagePath = result.path;
  }

  if (file2 && file2 instanceof File && file2.size > 0) {
    const result = await uploadPhoto(file2, "2ª foto");
    if ("error" in result) {
      // Rollback first upload if already done
      if (storagePath) await adminUpload.storage.from("submissions").remove([storagePath]).catch(() => {});
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    storagePath2 = result.path;
  }

  // Calculate XP for quantifiable challenges
  // If xp_per_unit is set, XP = min(quantity * xp_per_unit, xp_reward)
  // Otherwise XP is awarded by the approval trigger using xp_reward directly
  const xpAwarded = (challenge.xp_per_unit && parsed.data.quantity)
    ? Math.min(parsed.data.quantity * challenge.xp_per_unit, challenge.xp_reward)
    : null; // null = trigger will use xp_reward

  // [SECURITY] Store the relative storage path, NOT a public URL.
  // The submissions bucket is private; signed URLs are generated on demand
  // server-side via /api/storage/sign (which requires authentication).
  const insertPayload: Record<string, unknown> = {
    challenge_id: challenge.id,
    user_id: user.id,
    photo_url:   storagePath,
    photo_url_2: storagePath2,
    quantity: parsed.data.quantity ?? null,
    submitted_date: todayStr,
    title: titleRaw,
    description: descriptionRaw,
  };
  // Pass pre-calculated xp so the trigger can use it
  if (xpAwarded !== null) insertPayload.xp_awarded = xpAwarded;

  // Use admin client to bypass INSERT RLS — user_id is validated above from
  // the authenticated session, so this is safe.
  const { data: submission, error: insertError } = await adminUpload
    .from("submissions")
    .insert(insertPayload)
    .select()
    .single();

  if (insertError) {
    // [SECURITY] Log internally; never leak raw DB error details to the client
    console.error("[submissions] insert error:", insertError.message);
    // Cleanup orphaned uploads
    const toRemove = [storagePath, storagePath2].filter(Boolean) as string[];
    if (toRemove.length) await adminUpload.storage.from("submissions").remove(toRemove).catch(() => {});
    return NextResponse.json({ error: "Erro ao salvar submission" }, { status: 500 });
  }

  // Auto-approve immediately so the DB trigger fires and awards XP right away.
  const { data: approved } = await adminUpload
    .from("submissions")
    .update({ status: "approved" })
    .eq("id", submission.id)
    .select()
    .single();

  return NextResponse.json({ submission: approved ?? submission }, { status: 201 });
}
