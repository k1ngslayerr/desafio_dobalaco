import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Only private buckets are signable via this endpoint.
// Public buckets (e.g. "avatars") expose getPublicUrl directly on the client.
const ALLOWED_PRIVATE_BUCKETS = ["submissions"] as const;

// [SECURITY] Strict path shape: <uuid>/<uuid>/<uuid>.<ext>
// This is exactly what buildStoragePath() produces. Anything else is rejected.
const SUBMISSION_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/;

/**
 * GET /api/storage/sign?bucket=submissions&path=<storagePath>&expiresIn=3600
 *
 * Server-side signed URL generation. The browser Supabase client has no
 * auth session (cookies are httpOnly, not readable by JS), so calling
 * createSignedUrl() from the browser fails for private buckets.
 *
 * [SECURITY] This endpoint:
 *   - requires an authenticated session (httpOnly cookie)
 *   - whitelists buckets
 *   - validates path against a strict regex (matches buildStoragePath output)
 *   - never leaks the underlying storage error to the client
 */
export async function GET(request: Request) {
  // Require authenticated session
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const bucket = searchParams.get("bucket");
  const path = searchParams.get("path");
  const requestedExpires = Number(searchParams.get("expiresIn") ?? "3600");
  const expiresIn = Number.isFinite(requestedExpires)
    ? Math.min(Math.max(requestedExpires, 60), 3600) // [60s, 1h]
    : 3600;

  if (!bucket || !path) {
    return NextResponse.json({ error: "bucket e path são obrigatórios" }, { status: 400 });
  }

  if (!(ALLOWED_PRIVATE_BUCKETS as readonly string[]).includes(bucket)) {
    return NextResponse.json({ error: "Bucket não permitido" }, { status: 403 });
  }

  // Strict per-bucket path validation (defense in depth vs. traversal,
  // double-encoding, backslashes, absolute paths, query injection, etc.)
  if (bucket === "submissions" && !SUBMISSION_PATH_RE.test(path)) {
    return NextResponse.json({ error: "Path inválido" }, { status: 400 });
  }

  const adminClient = await createAdminClient();
  const { data, error: signError } = await adminClient.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (signError || !data?.signedUrl) {
    // [SECURITY] Log server-side, never expose storage error details to the client
    console.error("[/api/storage/sign] createSignedUrl failed", {
      bucket,
      path,
      message: signError?.message,
    });
    return NextResponse.json({ error: "Erro ao gerar URL" }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
