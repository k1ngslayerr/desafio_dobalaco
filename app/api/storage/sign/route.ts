import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Only private buckets are signable via this endpoint.
// Public buckets (e.g. "avatars") expose getPublicUrl directly on the client.
const ALLOWED_PRIVATE_BUCKETS = ["submissions"];

/**
 * GET /api/storage/sign?bucket=submissions&path=<storagePath>&expiresIn=3600
 *
 * Server-side signed URL generation. The browser Supabase client has no auth
 * session (cookies are httpOnly, not readable by JS), so createSignedUrl()
 * called from the browser always fails for private buckets.
 * This endpoint runs in the server context where httpOnly cookies are
 * available, uses the admin client to bypass RLS, and returns a signed URL.
 */
export async function GET(request: Request) {
  // [SECURITY] Require authenticated session
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const bucket = searchParams.get("bucket");
  const path = searchParams.get("path");
  const expiresIn = Math.min(Number(searchParams.get("expiresIn") ?? "3600"), 86400);

  if (!bucket || !path) {
    return NextResponse.json({ error: "bucket e path são obrigatórios" }, { status: 400 });
  }

  // [SECURITY] Only allow whitelisted private buckets
  if (!ALLOWED_PRIVATE_BUCKETS.includes(bucket)) {
    return NextResponse.json({ error: "Bucket não permitido" }, { status: 403 });
  }

  // [SECURITY] Reject path traversal attempts
  if (path.includes("..") || path.startsWith("/")) {
    return NextResponse.json({ error: "Path inválido" }, { status: 400 });
  }

  const adminClient = await createAdminClient();
  const { data, error: signError } = await adminClient.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (signError || !data?.signedUrl) {
    console.error("[/api/storage/sign] createSignedUrl failed:", signError?.message, { bucket, path });
    return NextResponse.json({ error: "Erro ao gerar URL assinada", detail: signError?.message }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
