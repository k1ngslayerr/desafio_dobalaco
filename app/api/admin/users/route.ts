import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { adminLimiter } from "@/lib/rate-limit";
import { z } from "zod";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: "Não autorizado", status: 401, supabase: null, user: null };
  const { data: row } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (row?.role !== "admin") return { error: "Acesso negado", status: 403, supabase: null, user: null };
  return { error: null, status: 200, supabase, user };
}

// GET /api/admin/users – list all users ordered by status (pending first) then XP
export async function GET(request: Request) {
  const { error, status, supabase } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { data, error: dbError } = await supabase!
    .from("users")
    // [SECURITY] Select only non-sensitive columns – never SELECT *
    .select("id, username, full_name, avatar_url, xp, level, role, status, current_penalty, created_at")
    .order("status", { ascending: true })   // pending < active alphabetically — pendentes sobem
    .order("xp",     { ascending: false });

  if (dbError) return NextResponse.json({ error: "Erro ao buscar usuários" }, { status: 500 });
  return NextResponse.json({ users: data });
}

// Accepts either a role change OR a status change (not both at once)
const updateSchema = z.discriminatedUnion("action", [
  z.object({
    action:  z.literal("role"),
    user_id: z.string().uuid(),
    role:    z.enum(["user", "admin"]),
  }),
  z.object({
    action:  z.literal("status"),
    user_id: z.string().uuid(),
    status:  z.enum(["active", "pending", "suspended"]),
  }),
]);

// PATCH /api/admin/users – change a user's role OR approval status
// [SECURITY] Only admins can call this; service role key bypasses RLS
export async function PATCH(request: Request) {
  const { error, status, user } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { success: rateOk } = await adminLimiter.limit(user!.id);
  if (!rateOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // [SECURITY] Use admin client (service role) to bypass RLS
  const adminClient = await createAdminClient();

  const updatePayload =
    parsed.data.action === "role"
      ? { role:   parsed.data.role }
      : { status: parsed.data.status };

  const { data: updated, error: dbError } = await adminClient
    .from("users")
    .update(updatePayload)
    .eq("id", parsed.data.user_id)
    .select("id, username, role, status")
    .single();

  if (dbError) return NextResponse.json({ error: "Erro ao atualizar usuário" }, { status: 500 });
  return NextResponse.json({ user: updated });
}
