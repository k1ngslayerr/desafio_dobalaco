import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
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
      `id, photo_url, title, description, status, xp_awarded, created_at, challenge_id,
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

// PATCH /api/submissions/[id] – owner edits their own post (title, description, photo)
// Status is NOT changed — content edits don't affect approval state.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  // [SECURITY] Fetch the submission to verify ownership
  const admin = await createAdminClient();
  const { data: existing } = await admin
    .from("submissions")
    .select("id, user_id, photo_url, challenge_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Submissão não encontrada" }, { status: 404 });
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const titleRaw       = (formData.get("title")       as string | null)?.trim() || null;
  const descriptionRaw = (formData.get("description") as string | null)?.trim() || null;
  const file           = formData.get("photo") as File | null;

  // Validate text fields
  const textParsed = z.object({
    title:       z.string().max(120).nullable().optional(),
    description: z.string().max(500).nullable().optional(),
  }).safeParse({ title: titleRaw, description: descriptionRaw });
  if (!textParsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
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
