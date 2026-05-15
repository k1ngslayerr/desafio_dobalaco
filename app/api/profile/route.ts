import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { submissionLimiter } from "@/lib/rate-limit";
import { checkImageMime } from "@/lib/security/mime-check";
import { buildAvatarPath } from "@/lib/security/sanitize";
import { profileSchema } from "@/lib/validators";

// PATCH /api/profile – update display name / username
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // [SECURITY] Only update allowed fields; role is not in profileSchema
  const { data, error: dbError } = await supabase
    .from("users")
    .update(parsed.data)
    .eq("id", user.id)
    .select("id, username, full_name, avatar_url, xp, level")
    .single();

  if (dbError) {
    if (dbError.code === "23505") return NextResponse.json({ error: "Username já em uso" }, { status: 409 });
    return NextResponse.json({ error: "Erro ao atualizar perfil" }, { status: 500 });
  }
  return NextResponse.json({ user: data });
}

// POST /api/profile/avatar – upload avatar image
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { success: rateOk } = await submissionLimiter.limit(user.id);
  if (!rateOk) return NextResponse.json({ error: "Muitas tentativas" }, { status: 429 });

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Payload inválido" }, { status: 400 });

  const file = formData.get("avatar") as File | null;
  if (!file || !(file instanceof File)) return NextResponse.json({ error: "Avatar é obrigatório" }, { status: 400 });

  // [SECURITY] Server-side size check
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Arquivo muito grande (máx 5 MB)" }, { status: 400 });

  // [SECURITY] Magic bytes validation
  const buffer = await file.arrayBuffer();
  const mimeResult = await checkImageMime(buffer);
  if (!mimeResult.valid) return NextResponse.json({ error: mimeResult.error }, { status: 400 });

  const storagePath = buildAvatarPath(user.id, file.name);
  const adminClient = await createAdminClient();

  // Remove old avatar if exists then upload new
  await adminClient.storage.from("avatars").remove([`${user.id}`]).catch(() => {});

  const { error: uploadError } = await adminClient.storage
    .from("avatars")
    .upload(storagePath, Buffer.from(buffer), {
      contentType: mimeResult.mime,
      upsert: true,
    });

  if (uploadError) return NextResponse.json({ error: "Erro no upload" }, { status: 500 });

  // avatars bucket is public — store the stable public URL so any user can view it
  const { data: { publicUrl } } = adminClient.storage.from("avatars").getPublicUrl(storagePath);

  const { error: dbError } = await supabase
    .from("users")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);

  if (dbError) return NextResponse.json({ error: "Erro ao salvar avatar" }, { status: 500 });

  return NextResponse.json({ avatar_url: publicUrl });
}
