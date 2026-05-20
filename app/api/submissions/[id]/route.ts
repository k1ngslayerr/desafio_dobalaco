import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { submissionLimiter } from "@/lib/rate-limit";
import { checkImageMime } from "@/lib/security/mime-check";
import { buildStoragePath } from "@/lib/security/sanitize";
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
      `id, photo_url, photo_url_2, title, description, status, xp_awarded, created_at, challenge_id,
       user:users!user_id(id, username, avatar_url),
       challenge:challenges(title, xp_reward),
       reactions(type, user_id, user:users!user_id(username, avatar_url))`
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

// DELETE /api/submissions/[id] – owner deletes their own submission.
// XP rollback + row delete happens atomically inside a Postgres function
// (rollback_and_delete_submission) to prevent race-condition exploits where
// two concurrent deletes would only deduct one submission's worth of XP.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // [SECURITY] Rate limit by user.id — without this an attacker could spam
  // DELETE requests to exploit any future race conditions or DoS the storage API.
  const { success: rateOk } = await submissionLimiter.limit(`del:${user.id}`);
  if (!rateOk) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um momento." }, { status: 429 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const admin = await createAdminClient();

  // [SECURITY] Atomic: lock row, rollback XP (if approved), delete.
  // The RPC also enforces ownership (defense in depth).
  // [SECURITY] Unified error path: do not distinguish "not found" vs "not owner"
  // — both return 404 so an attacker can't enumerate valid submission IDs.
  const { data: rpcRows, error: rpcError } = await admin.rpc(
    "rollback_and_delete_submission",
    { _submission_id: id, _caller_id: user.id }
  );

  if (rpcError) {
    if (rpcError.code === "P0002" || /not_found_or_forbidden/.test(rpcError.message)) {
      return NextResponse.json({ error: "Submissão não encontrada" }, { status: 404 });
    }
    console.error("[submissions DELETE] rpc error:", rpcError.message);
    return NextResponse.json({ error: "Erro ao apagar submissão" }, { status: 500 });
  }

  // Best-effort storage cleanup (separate concern; never blocks the API response).
  // Photo paths come from the RPC's return value, which read them off the locked row.
  const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
  const toRemove = [row?.photo_url, row?.photo_url_2].filter(Boolean) as string[];
  if (toRemove.length) {
    await admin.storage.from("submissions").remove(toRemove).catch(() => {});
  }

  return NextResponse.json({ success: true });
}

// PATCH /api/submissions/[id] – owner edits their own post (title, description, photo)
// Status is NOT changed — content edits don't affect approval state.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // [SECURITY] Rate limit by user.id — without this, an authenticated user
  // could spam PATCH to upload orphaned files repeatedly (storage abuse).
  const { success: rateOk } = await submissionLimiter.limit(`patch:${user.id}`);
  if (!rateOk) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um momento." }, { status: 429 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  // [SECURITY] Fetch submission + challenge config to verify ownership AND
  // the post is in an editable state. We also need requires_photo to enforce
  // creation-time invariants (title/description mandatory on no-photo challenges).
  const admin = await createAdminClient();
  const { data: existing } = await admin
    .from("submissions")
    .select("id, user_id, photo_url, challenge_id, status, challenge:challenges(requires_photo)")
    .eq("id", id)
    .maybeSingle();

  // [SECURITY] Unified 404 for not-found and not-owner to avoid ID enumeration
  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: "Submissão não encontrada" }, { status: 404 });
  }

  // [SECURITY] Block edits on terminal states — a contested/rejected post is
  // evidence of a rule violation. Allowing edits would let the user swap the
  // photo or rewrite the description after being caught.
  if (existing.status === "contested" || existing.status === "rejected") {
    return NextResponse.json(
      { error: "Submissões contestadas ou rejeitadas não podem ser editadas." },
      { status: 403 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requiresPhoto: boolean = (existing.challenge as any)?.requires_photo ?? true;

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const titleRaw       = (formData.get("title")       as string | null)?.trim() || null;
  const descriptionRaw = (formData.get("description") as string | null)?.trim() || null;
  const file           = formData.get("photo") as File | null;

  // Validate text length
  const textParsed = z.object({
    title:       z.string().max(120).nullable().optional(),
    description: z.string().max(500).nullable().optional(),
  }).safeParse({ title: titleRaw, description: descriptionRaw });
  if (!textParsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  // [SECURITY] Enforce creation-time invariants on edit:
  // when the challenge has no photo, title + description are required. PATCH
  // must not let the user clear them to bypass the original create validation.
  if (!requiresPhoto) {
    if (!titleRaw) {
      return NextResponse.json({ error: "Título é obrigatório para este desafio" }, { status: 400 });
    }
    if (!descriptionRaw) {
      return NextResponse.json({ error: "Descrição é obrigatória para este desafio" }, { status: 400 });
    }
  }

  // Handle optional photo replacement
  let newPhotoPath: string | undefined;
  if (file && file instanceof File && file.size > 0) {
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Arquivo muito grande (máx 5 MB)" }, { status: 400 });
    }
    const buffer = await file.arrayBuffer();
    const mimeResult = await checkImageMime(buffer);
    if (!mimeResult.valid) {
      return NextResponse.json({ error: mimeResult.error ?? "Formato inválido" }, { status: 400 });
    }
    newPhotoPath = buildStoragePath(user.id, existing.challenge_id, file.name);
    const { error: uploadError } = await admin.storage
      .from("submissions")
      .upload(newPhotoPath, Buffer.from(buffer), { contentType: mimeResult.mime, upsert: false });
    if (uploadError) {
      console.error("[submissions PATCH] upload error:", uploadError.message);
      return NextResponse.json({ error: "Erro no upload" }, { status: 500 });
    }
    // Delete old photo (best-effort — don't fail the whole request if this errors)
    if (existing.photo_url) {
      await admin.storage.from("submissions").remove([existing.photo_url]).catch(() => {});
    }
  }

  const updatePayload: Record<string, unknown> = {
    title:       titleRaw,
    description: descriptionRaw,
  };
  if (newPhotoPath !== undefined) {
    updatePayload.photo_url = newPhotoPath;
  }

  const { data: updated, error: updateError } = await admin
    .from("submissions")
    .update(updatePayload)
    .eq("id", id)
    .select("id, title, description, photo_url, status")
    .single();

  if (updateError) {
    console.error("[submissions PATCH] update error:", updateError.message);
    // Rollback orphaned upload
    if (newPhotoPath) {
      await admin.storage.from("submissions").remove([newPhotoPath]).catch(() => {});
    }
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
  }

  return NextResponse.json({ submission: updated });
}
