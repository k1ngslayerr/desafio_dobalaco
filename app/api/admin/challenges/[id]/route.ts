import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { challengeSchema } from "@/lib/validators";
import { z } from "zod";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: "Não autorizado", status: 401, supabase: null };
  const { data: row } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (row?.role !== "admin") return { error: "Acesso negado", status: 403, supabase: null };
  return { error: null, status: 200, supabase };
}

// Combined partial schema that also allows toggling is_active
const patchSchema = challengeSchema.partial().merge(
  z.object({ is_active: z.boolean().optional() })
);

// PATCH /api/admin/challenges/[id] – update title, description, xp, is_active, requires_photo, quantity fields
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, supabase } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const partial = patchSchema.safeParse(body);
  if (!partial.success) return NextResponse.json({ error: partial.error.flatten() }, { status: 400 });

  const { data, error: dbError } = await supabase!
    .from("challenges")
    .update(partial.data)
    .eq("id", id)
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
  return NextResponse.json({ challenge: data });
}

// DELETE /api/admin/challenges/[id] – hard delete the challenge and all its submissions.
// Requires the FK submissions.challenge_id to have ON DELETE CASCADE (see migration SQL).
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, supabase } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const { error: dbError } = await supabase!
    .from("challenges")
    .delete()
    .eq("id", id);

  if (dbError) return NextResponse.json({ error: "Erro ao excluir desafio" }, { status: 500 });
  return NextResponse.json({ success: true });
}
