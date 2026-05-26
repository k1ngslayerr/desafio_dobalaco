import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { adminLimiter } from "@/lib/rate-limit";
import { z } from "zod";

const penaltySchema = z.object({
  user_id: z.string().uuid(),
  // null = clear the penalty; string = set penalty text
  penalty: z.string().max(500).nullable(),
});

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: "Não autorizado", status: 401, supabase: null, adminUser: null };

  const { data: row } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (row?.role !== "admin") return { error: "Acesso negado", status: 403, supabase: null, adminUser: null };

  return { error: null, status: 200, supabase, adminUser: user };
}

// PATCH /api/admin/penalties – assign or clear an individual penalty for a user
export async function PATCH(request: Request) {
  const { error, status, supabase, adminUser } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  // [SECURITY] Rate limit by admin user id
  const { success: rateOk } = await adminLimiter.limit(adminUser!.id);
  if (!rateOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = penaltySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const { user_id, penalty } = parsed.data;

  // Update current_penalty on the users table
  const { error: dbError } = await supabase!
    .from("users")
    .update({ current_penalty: penalty })
    .eq("id", user_id);

  if (dbError) return NextResponse.json({ error: "Erro ao atualizar penalidade" }, { status: 500 });

  // [AUDIT] Keep a permanent history of every punishment using the admin client
  // (service_role) so RLS doesn't block the write.
  const adminClient = await createAdminClient();

  if (penalty) {
    // Assigning a new penalty: insert a history record.
    // Also clear any previously open record (edge case: admin overwrites without clearing first).
    await adminClient
      .from("penalty_history")
      .update({ cleared_at: new Date().toISOString() })
      .eq("user_id", user_id)
      .is("cleared_at", null);

    await adminClient.from("penalty_history").insert({
      user_id,
      penalty_text: penalty,
      assigned_by: adminUser!.id,
    });
  } else {
    // Clearing the penalty: stamp cleared_at on the most recent open record.
    await adminClient
      .from("penalty_history")
      .update({ cleared_at: new Date().toISOString() })
      .eq("user_id", user_id)
      .is("cleared_at", null);
  }

  return NextResponse.json({ ok: true });
}
