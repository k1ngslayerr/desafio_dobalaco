import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/profile/status – lightweight "am I approved yet?" check.
// [SECURITY] Used by the /pending page to poll for admin approval.
// Returns only `{ status }` to keep the payload minimal.
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { data, error: dbError } = await supabase
    .from("users")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  if (dbError) {
    console.error("[/api/profile/status] db error:", dbError.message);
    return NextResponse.json({ error: "Erro" }, { status: 500 });
  }

  return NextResponse.json({ status: data?.status ?? null });
}
