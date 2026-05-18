import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resetPasswordSchema } from "@/lib/validators";

/**
 * POST /api/auth/reset-password
 *
 * Called from the /reset-password page after the user enters a new password.
 * By the time the request arrives the user has a valid session in their
 * httpOnly cookies (established by /auth/callback after the magic-link click).
 *
 * supabase.auth.updateUser() uses that session to update the password in
 * Supabase Auth — no token needs to be passed explicitly.
 *
 * [SECURITY]
 *  - Requires an active session. If there's none, Supabase returns an error
 *    and we respond with 401.
 *  - Password is validated with the same rules used during registration.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Senha inválida.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    // Likely "Auth session missing" when the link expired or was already used.
    console.error("[reset-password] updateUser error:", error.message);
    return NextResponse.json(
      { error: "Link expirado ou inválido. Solicite um novo link." },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true });
}
