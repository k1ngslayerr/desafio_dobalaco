import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: "Não autorizado", status: 401 };
  const { data: row } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (row?.role !== "admin") return { error: "Acesso negado", status: 403 };
  return { error: null, status: 200 };
}

// GET /api/admin/submissions – list all submissions (admin only)
export async function GET() {
  const check = await requireAdmin();
  if (check.error) return NextResponse.json({ error: check.error }, { status: check.status });

  const adminClient = await createAdminClient();
  const [{ data: subs }, { data: challenges }] = await Promise.all([
    adminClient
      .from("submissions")
      .select("id, photo_url, title, description, status, xp_awarded, created_at, user:users(id, username, avatar_url), challenge:challenges(id, title, xp_reward), reactions(type)")
      .order("created_at", { ascending: false }),
    adminClient.from("challenges").select("id, title"),
  ]);

  return NextResponse.json({ submissions: subs ?? [], challenges: challenges ?? [] });
}
