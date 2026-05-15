import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { submissionLimiter } from "@/lib/rate-limit";
import { checkImageMime } from "@/lib/security/mime-check";
import { buildAvatarPath } from "@/lib/security/sanitize";
import { profileSchema } from "@/lib/validators";

// GET /api/profile – return current user's profile + approved submissions
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: p } = await supabase
    .from("users")
    .select("id, username, full_name, avatar_url, xp, level")
    .eq("id", user.id)
    .single();

  if (!p) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const [{ data: lvlData }, { data: nextLvl }, { data: subs }] = await Promise.all([
    supabase.from("level_config").select("art_tier, xp_required").eq("level", p.level).single(),
    supabase.from("level_config").select("xp_required").eq("level", p.level + 1).single(),
    supabase
      .from("submissions")
      .select("id, photo_url, title, description, status, xp_awarded, created_at, user:users!user_id(id, username, avatar_url), challenge:challenges(title, xp_reward), reactions(type, user_id)")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .order("created_at", { ascending: false }),
  ]);

  const currentThreshold = p.level > 1 ? Number(lvlData?.xp_required ?? 0) : 0;
  const nextThreshold = Number(nextLvl?.xp_required ?? currentThreshold + 100);
  const levelXp = Math.max(0, Number(p.xp) - currentThreshold);
  const levelGap = Math.max(1, nextThreshold - currentThreshold);

  return NextResponse.json({
    profile: { ...p, art_tier: lvlData?.art_tier ?? 1, level_xp: levelXp, next_xp: levelGap },
    submissions: subs ?? [],
    userId: user.id,
  });
}

// PATCH /api/profile – update display name / username
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // [SECURITY] Rate limit profile updates to prevent username squatting bursts
  const { success: rateOk } = await submissionLimiter.limit(`profile:${user.id}`);
  if (!rateOk) return NextResponse.json({ error: "Muitas tentativas" }, { status: 429 });

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

  // [SECURITY/STORAGE] List the user's avatar folder and remove EVERY old
  // file before uploading the new one. The previous version tried to remove
  // a single object named literally `<userId>` (no extension), which never
  // matched anything — old avatars accumulated forever in storage and stayed
  // publicly retrievable via their stable URLs.
  const { data: existing } = await adminClient.storage
    .from("avatars")
    .list(user.id);
  if (existing && existing.length > 0) {
    const stalePaths = existing.map((f) => `${user.id}/${f.name}`);
    await adminClient.storage.from("avatars").remove(stalePaths).catch(() => {});
  }

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
