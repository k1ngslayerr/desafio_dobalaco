import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminLimiter } from "@/lib/rate-limit";
import { submissionStatusSchema } from "@/lib/validators";
import { z } from "zod";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: "Não autorizado", status: 401, supabase: null, user: null };
  const { data: row } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (row?.role !== "admin") return { error: "Acesso negado", status: 403, supabase: null, user: null };
  return { error: null, status: 200, supabase, user };
}

// PATCH /api/admin/submissions/[id] – approve, contest, or reject a submission
// XP logic is handled by the DB trigger handle_submission_status_change
// [SECURITY] Only admin can change submission status
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, supabase, user } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  // [SECURITY] Rate limit by admin user id
  const { success: rateOk } = await adminLimiter.limit(user!.id);
  if (!rateOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = submissionStatusSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { status: newStatus } = parsed.data;

  const updatePayload: Record<string, unknown> = { status: newStatus };
  if (newStatus === "contested") {
    updatePayload.contested_by = user!.id;
  }

  // The DB trigger will handle XP credit/debit automatically
  const { data, error: dbError } = await supabase!
    .from("submissions")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: "Erro ao atualizar submission" }, { status: 500 });
  return NextResponse.json({ submission: data });
}
